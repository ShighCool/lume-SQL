use lazy_static::lazy_static;
use redis::{Client, Commands, Connection};
use serde_json::{json, Value};
use std::collections::HashMap;
use tokio::sync::Mutex;
use base64::{Engine as _, engine::general_purpose::STANDARD};

lazy_static! {
    static ref CONNECTIONS: Mutex<HashMap<String, Connection>> = Mutex::new(HashMap::new());
}

#[tauri::command]
pub async fn test_redis_connection(
    host: String,
    port: u16,
    password: Option<String>,
    db: i64,
) -> Result<bool, String> {
    let client = create_client(&host, port, &password, db)?;
    
    let mut conn = client.get_connection()
        .map_err(|e| format!("Connection test failed: {}", e))?;

    let _: String = redis::cmd("PING")
        .query(&mut conn)
        .map_err(|e| format!("PING failed: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn connect_redis(
    conn_id: String,
    host: String,
    port: u16,
    password: Option<String>,
    db: i64,
) -> Result<bool, String> {
    let client = create_client(&host, port, &password, db)?;
    
    let mut conn = client.get_connection()
        .map_err(|e| format!("Connection failed: {}", e))?;

    if db > 0 {
        let _: () = redis::cmd("SELECT")
            .arg(db)
            .query(&mut conn)
            .map_err(|e| format!("Select database failed: {}", e))?;
    }

    let mut connections = CONNECTIONS.lock().await;

    connections.insert(conn_id, conn);
    Ok(true)
}

#[tauri::command]
pub async fn disconnect_redis(conn_id: String) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    match connections.remove(&conn_id) {
        Some(_) => Ok(true),
        None => Err(format!("Connection ID '{}' does not exist", conn_id)),
    }
}

#[tauri::command]
pub async fn get_redis_keys(conn_id: String, pattern: String) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let keys: Vec<String> = redis::cmd("KEYS")
        .arg(&pattern)
        .query(conn)
        .map_err(|e| format!("Failed to get keys: {}", e))?;

    serde_json::to_string_pretty(&keys)
        .map_err(|e| format!("Serialization failed: {}", e))
}

#[tauri::command]
pub async fn get_redis_value(conn_id: String, key: String) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let key_type: String = redis::cmd("TYPE")
        .arg(&key)
        .query(conn)
        .map_err(|e| format!("Failed to get type: {}", e))?;

    let result = match key_type.as_str() {
        "string" => {
            let value: String = conn.get(&key)
                .map_err(|e| format!("Failed to get value: {}", e))?;
            json!({ "type": "string", "value": value })
        }
        "hash" => {
            let value: HashMap<String, String> = conn.hgetall(&key)
                .map_err(|e| format!("Failed to get hash: {}", e))?;
            json!({ "type": "hash", "value": value })
        }
        "list" => {
            let value: Vec<String> = conn.lrange(&key, 0, -1)
                .map_err(|e| format!("Failed to get list: {}", e))?;
            json!({ "type": "list", "value": value })
        }
        "set" => {
            let value: Vec<String> = conn.smembers(&key)
                .map_err(|e| format!("Failed to get set: {}", e))?;
            json!({ "type": "set", "value": value })
        }
        "zset" => {
            let value: Vec<(String, i64)> = conn.zrange_withscores(&key, 0, -1)
                .map_err(|e| format!("Failed to get zset: {}", e))?;
            json!({ "type": "zset", "value": value })
        }
        _ => json!({ "type": key_type, "value": null })
    };

    serde_json::to_string_pretty(&result)
        .map_err(|e| format!("Serialization failed: {}", e))
}

#[tauri::command]
pub async fn get_redis_key_type(conn_id: String, key: String) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let key_type: String = redis::cmd("TYPE")
        .arg(&key)
        .query(conn)
        .map_err(|e| format!("Failed to get type: {}", e))?;

    Ok(key_type)
}

#[tauri::command]
pub async fn get_redis_key_ttl(conn_id: String, key: String) -> Result<i64, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let ttl: i64 = redis::cmd("TTL")
        .arg(&key)
        .query(conn)
        .map_err(|e| format!("Failed to get TTL: {}", e))?;

    Ok(ttl)
}

#[tauri::command]
pub async fn delete_redis_key(conn_id: String, key: String) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let _: i32 = redis::cmd("DEL")
        .arg(&key)
        .query(conn)
        .map_err(|e| format!("Failed to delete key: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn set_redis_value(
    conn_id: String,
    key: String,
    value: String,
    ttl: Option<i64>,
) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    if let Some(expiry) = ttl {
        let _: () = redis::cmd("SETEX")
            .arg(&key)
            .arg(expiry)
            .arg(&value)
            .query(conn)
            .map_err(|e| format!("Failed to set value: {}", e))?;
    } else {
        let _: () = redis::cmd("SET")
            .arg(&key)
            .arg(&value)
            .query(conn)
            .map_err(|e| format!("Failed to set value: {}", e))?;
    }

    Ok(true)
}

#[tauri::command]
pub async fn set_redis_key_ttl(conn_id: String, key: String, ttl: i64) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let _: () = redis::cmd("EXPIRE")
        .arg(&key)
        .arg(ttl)
        .query(conn)
        .map_err(|e| format!("Failed to set TTL: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn delete_redis_keys_batch(conn_id: String, keys: Vec<String>) -> Result<i32, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let deleted: i32 = redis::cmd("DEL")
        .arg(&keys)
        .query(conn)
        .map_err(|e| format!("Failed to batch delete: {}", e))?;

    Ok(deleted)
}

#[tauri::command]
pub async fn get_redis_db_info(conn_id: String) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let info: String = redis::cmd("INFO")
        .query(conn)
        .map_err(|e| format!("Failed to get database info: {}", e))?;

    Ok(info)
}

#[tauri::command]
pub async fn select_redis_database(conn_id: String, db: i64) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let _: () = redis::cmd("SELECT")
        .arg(db)
        .query(conn)
        .map_err(|e| format!("Failed to select database: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn add_hash_field(
    conn_id: String,
    key: String,
    field: String,
    value: String,
) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let _: () = conn.hset(&key, &field, &value)
        .map_err(|e| format!("Failed to add hash field: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn update_hash_field(
    conn_id: String,
    key: String,
    field: String,
    value: String,
) -> Result<bool, String> {
    add_hash_field(conn_id, key, field, value).await
}

#[tauri::command]
pub async fn delete_hash_field(
    conn_id: String,
    key: String,
    field: String,
) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let _: i32 = conn.hdel(&key, &field)
        .map_err(|e| format!("Failed to delete hash field: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn push_list_element(
    conn_id: String,
    key: String,
    value: String,
    direction: String,
) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    if direction == "left" {
        let _: () = conn.lpush(&key, &value)
            .map_err(|e| format!("Failed to push left: {}", e))?;
    } else {
        let _: () = conn.rpush(&key, &value)
            .map_err(|e| format!("Failed to push right: {}", e))?;
    }

    Ok(true)
}

#[tauri::command]
pub async fn pop_list_element(
    conn_id: String,
    key: String,
    direction: String,
) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let value: String = if direction == "left" {
        conn.lpop(&key, None)
            .map_err(|e| format!("Failed to pop left: {}", e))?
    } else {
        conn.rpop(&key, None)
            .map_err(|e| format!("Failed to pop right: {}", e))?
    };

    Ok(value)
}

#[tauri::command]
pub async fn set_list_element(
    conn_id: String,
    key: String,
    index: i64,
    value: String,
) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let _: () = redis::cmd("LSET")
        .arg(&key)
        .arg(index)
        .arg(&value)
        .query(conn)
        .map_err(|e| format!("Failed to set list element: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn delete_list_element(
    conn_id: String,
    key: String,
    index: i64,
) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let mut values: Vec<String> = conn.lrange(&key, 0, -1)
        .map_err(|e| format!("Failed to get list: {}", e))?;

    if index >= 0 && (index as usize) < values.len() {
        values.remove(index as usize);
        
        let _: () = conn.del(&key)
            .map_err(|e| format!("Failed to delete old list: {}", e))?;
        
        for v in values {
            let _: () = conn.rpush(&key, &v)
                .map_err(|e| format!("Failed to rebuild list: {}", e))?;
        }
    }

    Ok(true)
}

#[tauri::command]
pub async fn add_set_members(
    conn_id: String,
    key: String,
    members: Vec<String>,
) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let _: () = conn.sadd(&key, &members)
        .map_err(|e| format!("Failed to add set members: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn remove_set_members(
    conn_id: String,
    key: String,
    members: Vec<String>,
) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let _: i32 = conn.srem(&key, &members)
        .map_err(|e| format!("Failed to remove set members: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn check_set_member(
    conn_id: String,
    key: String,
    member: String,
) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let exists: bool = conn.sismember(&key, &member)
        .map_err(|e| format!("Failed to check member: {}", e))?;

    Ok(exists)
}

#[tauri::command]
pub async fn add_zset_member(
    conn_id: String,
    key: String,
    member: String,
    score: i64,
) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let _: () = conn.zadd(&key, &member, score)
        .map_err(|e| format!("Failed to add zset member: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn update_zset_score(
    conn_id: String,
    key: String,
    member: String,
    score: i64,
) -> Result<bool, String> {
    add_zset_member(conn_id, key, member, score).await
}

#[tauri::command]
pub async fn remove_zset_member(
    conn_id: String,
    key: String,
    member: String,
) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let _: i32 = conn.zrem(&key, &member)
        .map_err(|e| format!("Failed to remove zset member: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn increment_zset_score(
    conn_id: String,
    key: String,
    member: String,
    delta: i64,
) -> Result<i64, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let new_score: i64 = redis::cmd("ZINCRBY")
        .arg(&key)
        .arg(delta)
        .arg(&member)
        .query(conn)
        .map_err(|e| format!("Failed to increment zset score: {}", e))?;

    Ok(new_score)
}

#[tauri::command]
pub async fn get_redis_key_memory_usage(
    conn_id: String,
    key: String,
) -> Result<i64, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let usage: i64 = redis::cmd("MEMORY")
        .arg("USAGE")
        .arg(&key)
        .query(conn)
        .map_err(|e| format!("Failed to get memory usage: {}", e))?;

    Ok(usage)
}

#[tauri::command]
pub async fn rename_redis_key(
    conn_id: String,
    old_key: String,
    new_key: String,
) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let _: () = redis::cmd("RENAME")
        .arg(&old_key)
        .arg(&new_key)
        .query(conn)
        .map_err(|e| format!("Failed to rename key: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn execute_redis_command(
    conn_id: String,
    command: String,
) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() {
        return Err("Command cannot be empty".to_string());
    }

    let cmd = parts[0];
    let mut redis_cmd = redis::cmd(cmd);

    for arg in &parts[1..] {
        redis_cmd.arg(arg);
    }

    let result: String = redis_cmd
        .query(conn)
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn export_redis_keys(
    conn_id: String,
    pattern: String,
) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let keys: Vec<String> = redis::cmd("KEYS")
        .arg(&pattern)
        .query(conn)
        .map_err(|e| format!("Failed to get keys: {}", e))?;

    let mut export_data: Vec<Value> = Vec::new();

    for key in keys {
        let key_type: String = redis::cmd("TYPE")
            .arg(&key)
            .query(conn)
            .map_err(|e| format!("Failed to get type: {}", e))?;

        let ttl: i64 = redis::cmd("TTL")
            .arg(&key)
            .query(conn)
            .map_err(|e| format!("Failed to get TTL: {}", e))?;

        let value = get_redis_value_internal(conn, &key, &key_type)?;

        export_data.push(json!({
            "key": key,
            "type": key_type,
            "value": value,
            "ttl": ttl
        }));
    }

    serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Serialization failed: {}", e))
}

#[tauri::command]
pub async fn get_redis_info(conn_id: String) -> Result<String, String> {
    get_redis_db_info(conn_id).await
}

#[tauri::command]
pub async fn get_redis_slowlog(conn_id: String) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let logs: String = redis::cmd("SLOWLOG")
        .arg("GET")
        .arg(10)
        .query(conn)
        .map_err(|e| format!("Failed to get slowlog: {}", e))?;

    Ok(logs)
}

#[tauri::command]
pub async fn get_redis_clients(conn_id: String) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let clients: String = redis::cmd("CLIENT")
        .arg("LIST")
        .query(conn)
        .map_err(|e| format!("Failed to get clients: {}", e))?;

    Ok(clients)
}

#[tauri::command]
pub async fn get_redis_stats(conn_id: String) -> Result<String, String> {
    let info = get_redis_info(conn_id).await?;

    let stats: Value = json!({
        "info": info,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });

    serde_json::to_string_pretty(&stats)
        .map_err(|e| format!("Serialization failed: {}", e))
}

#[tauri::command]
pub async fn import_redis_keys(
    conn_id: String,
    data: String,
) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let keys_data: Vec<Value> = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse import data: {}", e))?;

    for item in keys_data {
        let key = item.get("key")
            .and_then(|v| v.as_str())
            .ok_or("Missing key field")?;

        let key_type = item.get("type")
            .and_then(|v| v.as_str())
            .ok_or("Missing type field")?;

        let value = item.get("value")
            .ok_or("Missing value field")?;

        let ttl = item.get("ttl")
            .and_then(|v| v.as_i64());

        set_redis_value_internal(conn, key, key_type, value, ttl)?;
    }

    Ok(true)
}

#[tauri::command]
pub async fn dump_redis_key(
    conn_id: String,
    key: String,
) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let data: Vec<u8> = redis::cmd("DUMP")
        .arg(&key)
        .query(conn)
        .map_err(|e| format!("Failed to dump key: {}", e))?;

    let base64_str = STANDARD.encode(&data);
    Ok(base64_str)
}

#[tauri::command]
pub async fn restore_redis_key(
    conn_id: String,
    key: String,
    data: String,
    ttl: i64,
) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let decoded = STANDARD.decode(&data)
        .map_err(|e| format!("Failed to decode data: {}", e))?;

    let _: () = redis::cmd("RESTORE")
        .arg(&key)
        .arg(ttl)
        .arg(&decoded)
        .arg("REPLACE")
        .query(conn)
        .map_err(|e| format!("Failed to restore key: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn set_redis_bit(
    conn_id: String,
    key: String,
    offset: i64,
    value: i64,
) -> Result<i64, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let old_value: i64 = redis::cmd("SETBIT")
        .arg(&key)
        .arg(offset)
        .arg(value)
        .query(conn)
        .map_err(|e| format!("Failed to set bit: {}", e))?;

    Ok(old_value)
}

#[tauri::command]
pub async fn get_redis_bit(
    conn_id: String,
    key: String,
    offset: i64,
) -> Result<i64, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let value: i64 = redis::cmd("GETBIT")
        .arg(&key)
        .arg(offset)
        .query(conn)
        .map_err(|e| format!("Failed to get bit: {}", e))?;

    Ok(value)
}

#[tauri::command]
pub async fn bitcount_redis(
    conn_id: String,
    key: String,
    start: Option<i64>,
    end: Option<i64>,
) -> Result<i64, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let mut binding = redis::cmd("BITCOUNT");
    let cmd = binding.arg(&key);

    if let Some(s) = start {
        cmd.arg(s);
        if let Some(e) = end {
            cmd.arg(e);
        }
    }

    let count: i64 = cmd
        .query(conn)
        .map_err(|e| format!("Bitcount failed: {}", e))?;

    Ok(count)
}

#[tauri::command]
pub async fn bitop_redis(
    conn_id: String,
    operation: String,
    destkey: String,
    keys: Vec<String>,
) -> Result<i64, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let mut binding = redis::cmd("BITOP");
    let cmd = binding
        .arg(&operation)
        .arg(&destkey);

    for key in keys {
        cmd.arg(&key);
    }

    let length: i64 = cmd
        .query(conn)
        .map_err(|e| format!("Bitop failed: {}", e))?;

    Ok(length)
}

#[tauri::command]
pub async fn bitpos_redis(
    conn_id: String,
    key: String,
    bit: i64,
    start: Option<i64>,
    end: Option<i64>,
) -> Result<i64, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let mut binding = redis::cmd("BITPOS");
    let cmd = binding
        .arg(&key)
        .arg(bit);

    if let Some(s) = start {
        cmd.arg(s);
        if let Some(e) = end {
            cmd.arg(e);
        }
    }

    let position: i64 = cmd
        .query(conn)
        .map_err(|e| format!("Bitpos failed: {}", e))?;

    Ok(position)
}

#[tauri::command]
pub async fn geoadd_redis(
    conn_id: String,
    key: String,
    members: Vec<(f64, f64, String)>,
) -> Result<i32, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let mut binding = redis::cmd("GEOADD");
    let cmd = binding.arg(&key);

    for (longitude, latitude, member) in members {
        cmd.arg(longitude).arg(latitude).arg(&member);
    }

    let count: i32 = cmd
        .query(conn)
        .map_err(|e| format!("Geoadd failed: {}", e))?;

    Ok(count)
}

#[tauri::command]
pub async fn geodist_redis(
    conn_id: String,
    key: String,
    member1: String,
    member2: String,
    unit: String,
) -> Result<f64, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let distance: f64 = redis::cmd("GEODIST")
        .arg(&key)
        .arg(&member1)
        .arg(&member2)
        .arg(&unit)
        .query(conn)
        .map_err(|e| format!("Geodist failed: {}", e))?;

    Ok(distance)
}

#[tauri::command]
pub async fn geohash_redis(
    conn_id: String,
    key: String,
    members: Vec<String>,
) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let result: Vec<Option<String>> = redis::cmd("GEOHASH")
        .arg(&key)
        .arg(&members)
        .query(conn)
        .map_err(|e| format!("Geohash failed: {}", e))?;

    serde_json::to_string_pretty(&result)
        .map_err(|e| format!("Serialization failed: {}", e))
}

#[tauri::command]
pub async fn geopos_redis(
    conn_id: String,
    key: String,
    members: Vec<String>,
) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let result: Vec<Vec<f64>> = redis::cmd("GEOPOS")
        .arg(&key)
        .arg(members)
        .query(conn)
        .map_err(|e| format!("GEOPOS failed: {}", e))?;

    let positions: Vec<Value> = result.iter().map(|pos| {
        if pos.len() >= 2 {
            let longitude = pos.get(0).copied().unwrap_or(0.0);
            let latitude = pos.get(1).copied().unwrap_or(0.0);
            json!({
                "longitude": longitude,
                "latitude": latitude,
            })
        } else {
            Value::Null
        }
    }).collect();

    serde_json::to_string_pretty(&positions)
        .map_err(|e| format!("Serialization failed: {}", e))
}

#[tauri::command]
pub async fn georadius_redis(
    conn_id: String,
    key: String,
    longitude: f64,
    latitude: f64,
    radius: f64,
    unit: String,
    withdist: bool,
    withcoord: bool,
    withhash: bool,
    count: Option<i64>,
) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let mut binding = redis::cmd("GEORADIUS");
    let cmd = binding
        .arg(&key)
        .arg(longitude)
        .arg(latitude)
        .arg(radius)
        .arg(&unit);

    if withdist {
        cmd.arg("WITHDIST");
    }
    if withcoord {
        cmd.arg("WITHCOORD");
    }
    if withhash {
        cmd.arg("WITHHASH");
    }
    if let Some(c) = count {
        cmd.arg("COUNT");
        cmd.arg(c);
    }

    let result: Vec<Vec<String>> = cmd
        .query(conn)
        .map_err(|e| format!("GEORADIUS failed: {}", e))?;

    let points: Vec<Value> = result.iter().map(|point| {
        let mut obj = json!({
            "member": point.get(0).map(|s| s.as_str()).unwrap_or(""),
        });

        if withdist && point.len() > 1 {
            if let Some(dist) = point.get(1) {
                obj["distance"] = Value::String(dist.clone());
            }
        }
        if withcoord && point.len() > 2 {
            if let Some(coord_str) = point.get(2) {
                if let Ok(coords) = serde_json::from_str::<Vec<f64>>(coord_str.as_str()) {
                    if coords.len() >= 2 {
                        let longitude = coords.get(0).copied().unwrap_or(0.0);
                        let latitude = coords.get(1).copied().unwrap_or(0.0);
                        obj["longitude"] = Value::Number(serde_json::Number::from_f64(longitude).unwrap_or(serde_json::Number::from(0)));
                        obj["latitude"] = Value::Number(serde_json::Number::from_f64(latitude).unwrap_or(serde_json::Number::from(0)));
                    }
                }
            }
        }
        if withhash && point.len() > 3 {
            if let Some(hash) = point.get(3) {
                obj["hash"] = Value::String(hash.clone());
            }
        }

        obj
    }).collect();

    serde_json::to_string_pretty(&points)
        .map_err(|e| format!("Serialization failed: {}", e))
}

#[tauri::command]
pub async fn georadiusbymember_redis(
    conn_id: String,
    key: String,
    member: String,
    radius: f64,
    unit: String,
    withdist: bool,
    withcoord: bool,
    withhash: bool,
    count: Option<i64>,
) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let mut binding = redis::cmd("GEORADIUSBYMEMBER");
    let cmd = binding
        .arg(&key)
        .arg(&member)
        .arg(radius)
        .arg(&unit);

    if withdist {
        cmd.arg("WITHDIST");
    }
    if withcoord {
        cmd.arg("WITHCOORD");
    }
    if withhash {
        cmd.arg("WITHHASH");
    }
    if let Some(c) = count {
        cmd.arg("COUNT");
        cmd.arg(c);
    }

    let result: Vec<Vec<String>> = cmd
        .query(conn)
        .map_err(|e| format!("GEORADIUSBYMEMBER failed: {}", e))?;

    let points: Vec<Value> = result.iter().map(|point| {
        let mut obj = json!({
            "member": point.get(0).map(|s| s.as_str()).unwrap_or(""),
        });

        if withdist && point.len() > 1 {
            if let Some(dist) = point.get(1) {
                obj["distance"] = Value::String(dist.clone());
            }
        }
        if withcoord && point.len() > 2 {
            if let Some(coord_str) = point.get(2) {
                if let Ok(coords) = serde_json::from_str::<Vec<f64>>(coord_str.as_str()) {
                    if coords.len() >= 2 {
                        let longitude = coords.get(0).copied().unwrap_or(0.0);
                        let latitude = coords.get(1).copied().unwrap_or(0.0);
                        obj["longitude"] = Value::Number(serde_json::Number::from_f64(longitude).unwrap_or(serde_json::Number::from(0)));
                        obj["latitude"] = Value::Number(serde_json::Number::from_f64(latitude).unwrap_or(serde_json::Number::from(0)));
                    }
                }
            }
        }
        if withhash && point.len() > 3 {
            if let Some(hash) = point.get(3) {
                obj["hash"] = Value::String(hash.clone());
            }
        }

        obj
    }).collect();

    serde_json::to_string_pretty(&points)
        .map_err(|e| format!("Serialization failed: {}", e))
}

fn create_client(
    host: &str,
    port: u16,
    password: &Option<String>,
    db: i64,
) -> Result<Client, String> {
    let addr = format!("{}:{}", host, port);
    let client = Client::open(addr)
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let mut conn = client.get_connection()
        .map_err(|e| format!("Connection failed: {}", e))?;

    if let Some(pwd) = password {
        let _: String = redis::cmd("AUTH")
            .arg(pwd)
            .query(&mut conn)
            .map_err(|e| format!("Authentication failed: {}", e))?;
    }

    if db > 0 {
        let _: () = redis::cmd("SELECT")
            .arg(db)
            .query(&mut conn)
            .map_err(|e| format!("Select database failed: {}", e))?;
    }

    Ok(client)
}

fn get_redis_value_internal(
    conn: &mut Connection,
    key: &str,
    key_type: &str,
) -> Result<Value, String> {
    let result = match key_type {
        "string" => {
            let value: String = conn.get(key)
                .map_err(|e| format!("Failed to get value: {}", e))?;
            json!(value)
        }
        "hash" => {
            let value: HashMap<String, String> = conn.hgetall(key)
                .map_err(|e| format!("Failed to get hash: {}", e))?;
            json!(value)
        }
        "list" => {
            let value: Vec<String> = conn.lrange(key, 0, -1)
                .map_err(|e| format!("Failed to get list: {}", e))?;
            json!(value)
        }
        "set" => {
            let value: Vec<String> = conn.smembers(key)
                .map_err(|e| format!("Failed to get set: {}", e))?;
            json!(value)
        }
        "zset" => {
            let value: Vec<(String, i64)> = conn.zrange_withscores(key, 0, -1)
                .map_err(|e| format!("Failed to get zset: {}", e))?;
            json!(value)
        }
        _ => json!(null)
    };

    Ok(result)
}

fn set_redis_value_internal(
    conn: &mut Connection,
    key: &str,
    key_type: &str,
    value: &Value,
    ttl: Option<i64>,
) -> Result<(), String> {
    match key_type {
        "string" => {
            let str_val = value.as_str().unwrap_or("");
            if let Some(expiry) = ttl {
                let _: () = redis::cmd("SETEX")
                    .arg(key)
                    .arg(expiry)
                    .arg(str_val)
                    .query(conn)
                    .map_err(|e| format!("Failed to set value: {}", e))?;
            } else {
                let _: () = redis::cmd("SET")
                    .arg(key)
                    .arg(str_val)
                    .query(conn)
                    .map_err(|e| format!("Failed to set value: {}", e))?;
            }
        }
        "hash" => {
            let hash: HashMap<String, String> = serde_json::from_value(value.clone())
                .map_err(|e| format!("Failed to parse hash: {}", e))?;
            let hash_vec: Vec<(&String, &String)> = hash.iter().collect();
            let _: () = conn.hset_multiple(key, &hash_vec)
                .map_err(|e| format!("Failed to set hash: {}", e))?;
        }
        "list" => {
            let list: Vec<String> = serde_json::from_value(value.clone())
                .map_err(|e| format!("Failed to parse list: {}", e))?;
            for item in list {
                let _: () = conn.rpush(key, &item)
                    .map_err(|e| format!("Failed to add list element: {}", e))?;
            }
        }
        "set" => {
            let set: Vec<String> = serde_json::from_value(value.clone())
                .map_err(|e| format!("Failed to parse set: {}", e))?;
            let _: () = conn.sadd(key, &set)
                .map_err(|e| format!("Failed to add set members: {}", e))?;
        }
        "zset" => {
            let zset: Vec<(String, i64)> = serde_json::from_value(value.clone())
                .map_err(|e| format!("Failed to parse zset: {}", e))?;
            for (member, score) in zset {
                let _: () = conn.zadd(key, &member, score)
                    .map_err(|e| format!("Failed to add zset element: {}", e))?;
            }
        }
        _ => {
            return Err(format!("Unsupported type: {}", key_type));
        }
    }

    Ok(())
}

