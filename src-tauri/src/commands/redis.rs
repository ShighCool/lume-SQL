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
    username: Option<String>,
    password: Option<String>,
    db: i64,
) -> Result<bool, String> {
    use tokio::time::{timeout, Duration};

    let client = create_client(&host, port, &username, &password, db)?;

    // 使用 tokio timeout 包装连接过程，设置5秒超时
    let connection_result = timeout(Duration::from_secs(5), async {
        let mut conn = client.get_connection()
            .map_err(|e| format!("Connection test failed: {}", e))?;

        // 如果指定了数据库索引，先切换数据库
        if db > 0 {
            let _: () = redis::cmd("SELECT")
                .arg(db)
                .query(&mut conn)
                .map_err(|e| format!("SELECT database failed: {}", e))?;
        }

        let _: String = redis::cmd("PING")
            .query(&mut conn)
            .map_err(|e| format!("PING failed: {}", e))?;

        Ok::<bool, String>(true)
    }).await;

    match connection_result {
        Ok(result) => result,
        Err(_) => Err("Connection test failed: 连接超时，请检查Redis服务器是否运行并确保网络畅通".to_string()),
    }
}

#[tauri::command]
pub async fn connect_redis(
    conn_id: String,
    host: String,
    port: u16,
    username: Option<String>,
    password: Option<String>,
    db: i64,
) -> Result<bool, String> {
    use tokio::time::{timeout, Duration};

    let client = create_client(&host, port, &username, &password, db)?;

    // 使用 tokio timeout 包装连接过程，设置5秒超时
    let connection_result = timeout(Duration::from_secs(5), async {
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
        Ok::<bool, String>(true)
    }).await;

    match connection_result {
        Ok(result) => result,
        Err(_) => Err("Connection failed: 连接超时，请检查Redis服务器是否运行并确保网络畅通".to_string()),
    }
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
pub async fn get_redis_keys(
    conn_id: String,
    pattern: String,
    limit: Option<usize>,
    cursor: Option<usize>,
) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let limit = limit.unwrap_or(100);
    let cursor = cursor.unwrap_or(0);

    // 使用 SCAN 命令（渐进式，不会阻塞 Redis）
    let result: (usize, Vec<String>) = redis::cmd("SCAN")
        .arg(cursor)
        .arg("MATCH")
        .arg(&pattern)
        .arg("COUNT")
        .arg(limit * 2) // 获取更多以确保有足够的结果
        .query(conn)
        .map_err(|e| {
            format!("Failed to scan keys: {}", e)
        })?;

    let (next_cursor, mut keys) = result;

    // 限制返回的数量
    if keys.len() > limit {
        keys.truncate(limit);
    }

    let response = json!({
        "keys": keys,
        "cursor": next_cursor,
        "has_more": next_cursor != 0
    });

    serde_json::to_string(&response)
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
        .map_err(|e| {
            format!("Failed to get type: {}", e)
        })?;



    let result = match key_type.as_str() {
        "string" => {
            let value: String = conn.get(&key)
                .map_err(|e| {
                    format!("Failed to get value: {}", e)
                })?;
            json!({ "type": "string", "value": value })
        }
        "hash" => {
            let value: HashMap<String, String> = conn.hgetall(&key)
                .map_err(|e| {
                    format!("Failed to get hash: {}", e)
                })?;
            json!({ "type": "hash", "value": value })
        }
        "list" => {
            let value: Vec<String> = conn.lrange(&key, 0, -1)
                .map_err(|e| {
                    format!("Failed to get list: {}", e)
                })?;
            json!({ "type": "list", "value": value })
        }
        "set" => {
            let value: Vec<String> = conn.smembers(&key)
                .map_err(|e| {
                    format!("Failed to get set: {}", e)
                })?;
            json!({ "type": "set", "value": value })
        }
        "zset" => {
            let value: Vec<(String, i64)> = conn.zrange_withscores(&key, 0, -1)
                .map_err(|e| {
                    format!("Failed to get zset: {}", e)
                })?;
            json!({ "type": "zset", "value": value })
        }
        _ => {
            json!({ "type": key_type, "value": null })
        }
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
        .map_err(|e| {
            format!("Failed to get type: {}", e)
        })?;


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

    // 记录开始时间
    let start_time = std::time::Instant::now();

    let result: String = redis_cmd
        .query(conn)
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    // 计算耗时（毫秒）
    let duration_ms = start_time.elapsed().as_millis() as u64;

    // 返回包含结果和耗时的 JSON
    let response = json!({
        "result": result,
        "duration_ms": duration_ms
    });

    serde_json::to_string(&response)
        .map_err(|e| format!("Serialization failed: {}", e))
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
pub async fn get_redis_slowlog(conn_id: String, limit: Option<i64>) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let limit = limit.unwrap_or(100);

    let logs: Vec<redis::Value> = redis::cmd("SLOWLOG")
        .arg("GET")
        .arg(limit)
        .query(conn)
        .map_err(|e| format!("Failed to get slowlog: {}", e))?;

    let formatted_logs: Vec<Value> = logs.iter().map(|log| {
        if let redis::Value::Array(items) = log {
            let id = items.get(0).and_then(|v| {
                if let redis::Value::Int(n) = v {
                    Some(n)
                } else {
                    None
                }
            }).unwrap_or(&0);
            
            let timestamp = items.get(1).and_then(|v| {
                if let redis::Value::Int(n) = v {
                    Some(n)
                } else {
                    None
                }
            }).unwrap_or(&0);
            
            let duration = items.get(2).and_then(|v| {
                if let redis::Value::Int(n) = v {
                    Some(n)
                } else {
                    None
                }
            }).unwrap_or(&0);
            
            let command = items.get(3).and_then(|v| {
                if let redis::Value::Array(cmd_items) = v {
                    Some(cmd_items.iter().filter_map(|item| {
                        if let redis::Value::BulkString(bytes) = item {
                            std::str::from_utf8(bytes).ok().map(|s| s.trim_matches('"').to_string())
                        } else if let redis::Value::SimpleString(s) = item {
                            Some(s.clone())
                        } else {
                            None
                        }
                    }).collect::<Vec<String>>())
                } else {
                    None
                }
            }).unwrap_or_default();
            
            let client_ip = items.get(4).and_then(|v| {
                if let redis::Value::BulkString(bytes) = v {
                    std::str::from_utf8(bytes).ok().map(|s| s.trim_matches('"').to_string())
                } else if let redis::Value::SimpleString(s) = v {
                    Some(s.clone())
                } else {
                    None
                }
            }).unwrap_or_default();
            
            let client_name = items.get(5).and_then(|v| {
                if let redis::Value::BulkString(bytes) = v {
                    std::str::from_utf8(bytes).ok().map(|s| s.trim_matches('"').to_string())
                } else if let redis::Value::SimpleString(s) = v {
                    Some(s.clone())
                } else {
                    None
                }
            }).unwrap_or_default();
            
            json!({
                "id": id,
                "timestamp": timestamp,
                "duration": duration,
                "command": command,
                "client_ip": client_ip,
                "client_name": client_name
            })
        } else {
            json!(null)
        }
    }).collect();

    serde_json::to_string(&formatted_logs)
        .map_err(|e| format!("Failed to serialize slowlog: {}", e))
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

#[tauri::command]
pub async fn get_redis_monitor_data(conn_id: String) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    // 获取 INFO 命令结果
    let info: String = redis::cmd("INFO")
        .query(conn)
        .map_err(|e| format!("Failed to get INFO: {}", e))?;

    // 解析 INFO 数据
    let mut uptime_seconds: f64 = 0.0;
    let mut connected_clients: f64 = 0.0;
    let mut total_commands_processed: f64 = 0.0;
    let mut total_connections_received: f64 = 0.0;
    let mut used_memory: f64 = 0.0;
    let mut used_memory_peak: f64 = 0.0;
    let mut total_keys: f64 = 0.0;
    let mut expired_keys: f64 = 0.0;
    let mut evicted_keys: f64 = 0.0;
    let mut hit_rate: f64 = 0.0;

    for line in info.lines() {
        if line.starts_with('#') || line.is_empty() {
            continue;
        }

        if let Some((key, value)) = line.split_once(':') {
            match key.trim() {
                "uptime_in_seconds" => {
                    uptime_seconds = value.parse().unwrap_or(0.0);
                }
                "connected_clients" => {
                    connected_clients = value.parse().unwrap_or(0.0);
                }
                "total_commands_processed" => {
                    total_commands_processed = value.parse().unwrap_or(0.0);
                }
                "total_connections_received" => {
                    total_connections_received = value.parse().unwrap_or(0.0);
                }
                "used_memory" => {
                    used_memory = value.parse().unwrap_or(0.0);
                }
                "used_memory_peak" => {
                    used_memory_peak = value.parse().unwrap_or(0.0);
                }
                "db0" => {
                    // 解析 db0 中的 keys 数量
                    if let Some(keys_str) = value.split("keys=").nth(1) {
                        if let Some(keys_num) = keys_str.split(',').next() {
                            total_keys = keys_num.parse().unwrap_or(0.0);
                        }
                    }
                }
                "expired_keys" => {
                    expired_keys = value.parse().unwrap_or(0.0);
                }
                "evicted_keys" => {
                    evicted_keys = value.parse().unwrap_or(0.0);
                }
                "keyspace_hits" => {
                    let hits: f64 = value.parse().unwrap_or(0.0);
                    if total_commands_processed > 0.0 {
                        hit_rate = (hits / total_commands_processed) * 100.0;
                    }
                }
                _ => {}
            }
        }
    }

    // 计算 QPS
    let qps = if uptime_seconds > 0.0 {
        total_commands_processed / uptime_seconds
    } else {
        0.0
    };

    let result = serde_json::json!({
        "timestamp": chrono::Utc::now().timestamp_millis(),
        "qps": qps,
        "connections": connected_clients,
        "total_keys": total_keys,
        "expired_keys": expired_keys,
        "evicted_keys": evicted_keys,
        "cpu_usage": 0.0,
        "memory_usage": used_memory,
        "uptime": uptime_seconds,
        "total_commands": total_commands_processed,
        "total_connections": total_connections_received,
        "memory_peak": used_memory_peak,
        "hit_rate": hit_rate
    });

    serde_json::to_string(&result)
        .map_err(|e| format!("Failed to serialize data: {}", e))
}

fn create_client(
    host: &str,
    port: u16,
    username: &Option<String>,
    password: &Option<String>,
    _db: i64,
) -> Result<Client, String> {
    // 构建 Redis URL
    let url = if let Some(user) = username {
        if !user.is_empty() {
            // 有用户名：redis://username:password@host:port
            if let Some(pwd) = password {
                if !pwd.is_empty() {
                    format!("redis://{}:{}@{}:{}", user, pwd, host, port)
                } else {
                    format!("redis://{}@{}:{}", user, host, port)
                }
            } else {
                format!("redis://{}@{}:{}", user, host, port)
            }
        } else {
            // 用户名为空：redis://host:port
            format!("redis://{}:{}", host, port)
        }
    } else {
        // 无用户名：redis://host:port
        format!("redis://{}:{}", host, port)
    };

    let client = Client::open(url)
        .map_err(|e| format!("Failed to create client: {}", e))?;

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

#[tauri::command]
pub async fn search_redis_keys_exact(
    conn_id: String,
    pattern: String,
    key_type: Option<String>,
) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| {
            format!("Connection ID '{}' does not exist", conn_id)
        })?;

    // 使用 KEYS 命令精确搜索（注意：大量 key 时性能较差）
    let keys: Vec<String> = redis::cmd("KEYS")
        .arg(&pattern)
        .query(conn)
        .map_err(|e| {
            format!("Failed to search keys: {}", e)
        })?;

    // 如果指定了类型过滤，则过滤类型
    let filtered_keys: Vec<String> = match key_type {
        Some(ref filter_type) if !filter_type.is_empty() => {
            // 使用 Pipeline 批量获取类型
            let mut pipe = redis::pipe();
            for key in keys.iter().take(1000) { // 限制最多处理 1000 个 keys
                pipe.cmd("TYPE").arg(key);
            }

            let results: Vec<String> = pipe
                .query(conn)
                .map_err(|e| {
                    format!("Failed to execute pipeline TYPE commands: {}", e)
                })?;

            let matching_keys: Vec<String> = keys.iter()
                .take(1000) // 限制最多处理 1000 个 keys
                .zip(results.iter())
                .filter_map(|(key, ktype)| {
                    if ktype == filter_type {
                        Some(key.clone())
                    } else {
                        None
                    }
                })
                .collect();

            matching_keys
        }
        _ => keys.iter().take(1000).cloned().collect(), // 限制最多返回 1000 个 keys
    };

    let response = json!({
        "keys": filtered_keys,
        "total_matched": keys.len()
    });

    serde_json::to_string(&response)
        .map_err(|e| {
            format!("Serialization failed: {}", e)
        })
}

#[tauri::command]
pub async fn get_redis_keys_by_type(
    conn_id: String,
    pattern: String,
    key_type: Option<String>,
    limit: Option<usize>,
    cursor: Option<usize>,
) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;

    let conn = connections
        .get_mut(&conn_id)
        .ok_or_else(|| {
            format!("Connection ID '{}' does not exist", conn_id)
        })?;

    let limit = limit.unwrap_or(100);
    let cursor = cursor.unwrap_or(0);

    // 判断是否需要完整扫描（有搜索或类型筛选）
    let need_full_scan = pattern != "*" || key_type.as_ref().map(|t| !t.is_empty()).unwrap_or(false);

    let (next_cursor, keys) = if need_full_scan {
        // 完整 SCAN 扫描，获取所有匹配的 keys
        let mut all_keys: Vec<String> = Vec::new();
        let mut scan_cursor = 0;

        loop {
            let result: (usize, Vec<String>) = redis::cmd("SCAN")
                .arg(scan_cursor)
                .arg("MATCH")
                .arg(&pattern)
                .arg("COUNT")
                .arg(1000)
                .query(conn)
                .map_err(|e| {
                    format!("Failed to scan keys: {}", e)
                })?;

            let (next, batch_keys) = result;

            all_keys.extend(batch_keys);

            scan_cursor = next;
            if scan_cursor == 0 {
                break;  // 扫描完成
            }
        }

        (0, all_keys)  // cursor 设为 0 表示完整扫描
    } else {
        // 分页 SCAN，只获取一批 keys
        let result: (usize, Vec<String>) = redis::cmd("SCAN")
            .arg(cursor)
            .arg("MATCH")
            .arg(&pattern)
            .arg("COUNT")
            .arg(limit * 2) // 获取更多以确保有足够的结果
            .query(conn)
            .map_err(|e| {
                format!("Failed to scan keys: {}", e)
            })?;

        result
    };

    // 如果指定了类型过滤，则批量获取每个 key 的类型并进行过滤
    let filtered_keys: Vec<String> = match key_type {
        Some(ref filter_type) if !filter_type.is_empty() => {
            // 使用 Pipeline 批量获取类型（性能优化：减少网络往返）
            let mut pipe = redis::pipe();
            for key in &keys {
                pipe.cmd("TYPE").arg(key);
            }

            // 一次性执行所有 TYPE 命令，返回 Vec<String>
            let results: Vec<String> = pipe
                .query(conn)
                .map_err(|e| {
                    format!("Failed to execute pipeline TYPE commands: {}", e)
                })?;

            // 过滤匹配的类型
            let matching_keys: Vec<String> = keys.iter()
                .zip(results.iter())
                .filter_map(|(key, ktype)| {
                    if ktype == filter_type {
                        Some(key.clone())
                    } else {
                        None
                    }
                })
                .collect();

            matching_keys
        }
        Some(_) => {
            keys.clone()
        }
        None => {
            keys.clone()
        }
    };

    // 限制返回的数量
    let filtered_count = filtered_keys.len();
    let result_keys = if need_full_scan {
        // 完整扫描时，最多返回 1000 个 keys（避免太多数据导致卡死）
        let max_result = 1000;
        if filtered_count > max_result {
            filtered_keys[..max_result].to_vec()
        } else {
            filtered_keys
        }
    } else {
        // 分页扫描时，返回 limit 个 keys
        if filtered_count > limit {
            filtered_keys[..limit].to_vec()
        } else {
            filtered_keys
        }
    };

    let response = if need_full_scan {
        // 完整扫描：一次性返回所有结果
        json!({
            "keys": result_keys,
            "cursor": 0,
            "has_more": false,
            "total_matched": filtered_count
        })
    } else {
        // 分页扫描：返回分页信息
        json!({
            "keys": result_keys,
            "cursor": next_cursor,
            "has_more": next_cursor != 0 || filtered_count > limit
        })
    };


    serde_json::to_string(&response)
        .map_err(|e| {
            format!("Serialization failed: {}", e)
        })
}

#[tauri::command]
pub async fn get_hash_fields_paginated(
    conn_id: String,
    key: String,
    offset: usize,
    limit: usize,
    search: Option<String>,
) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;
    let conn = connections.get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let all_fields: Vec<String> = conn.hkeys(&key)
        .map_err(|e| format!("Failed to get hash fields: {}", e))?;

    let filtered_fields: Vec<String> = if let Some(search_term) = search {
        if search_term.is_empty() {
            all_fields
        } else {
            all_fields.into_iter()
                .filter(|f| f.to_lowercase().contains(&search_term.to_lowercase()))
                .collect()
        }
    } else {
        all_fields
    };

    let total = filtered_fields.len();
    let fields_page: Vec<String> = filtered_fields.into_iter()
        .skip(offset)
        .take(limit)
        .collect();

    let mut result: Vec<(String, String)> = Vec::new();
    for field in &fields_page {
        if let Ok(value) = conn.hget(&key, field) {
            result.push((field.clone(), value));
        }
    }

    serde_json::to_string(&json!({
        "data": result,
        "total": total,
        "has_more": offset + limit < total
    })).map_err(|e| format!("Serialization failed: {}", e))
}

#[tauri::command]
pub async fn get_zset_members_paginated(
    conn_id: String,
    key: String,
    offset: usize,
    limit: usize,
    search: Option<String>,
) -> Result<String, String> {
    let mut connections = CONNECTIONS.lock().await;
    let conn = connections.get_mut(&conn_id)
        .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

    let all_members: Vec<(String, i64)> = conn.zrange_withscores(&key, 0, -1)
        .map_err(|e| format!("Failed to get zset members: {}", e))?;

    let filtered_members: Vec<(String, i64)> = if let Some(search_term) = search {
        if search_term.is_empty() {
            all_members
        } else {
            all_members.into_iter()
                .filter(|(m, _)| m.to_lowercase().contains(&search_term.to_lowercase()))
                .collect()
        }
    } else {
        all_members
    };

    let total = filtered_members.len();
    let members_page: Vec<(String, i64)> = filtered_members.into_iter()
        .skip(offset)
        .take(limit)
        .collect();

    serde_json::to_string(&json!({
        "data": members_page,
        "total": total,
        "has_more": offset + limit < total
    })).map_err(|e| format!("Serialization failed: {}", e))
}

