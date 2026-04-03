use lazy_static::lazy_static;
use mongodb::{Client, IndexModel};
use mongodb::bson::{Document, doc};
use futures_util::TryStreamExt;
use std::collections::HashMap;
use std::sync::Mutex;

lazy_static! {
    static ref CONNECTIONS: Mutex<HashMap<String, (Client, String)>> = Mutex::new(HashMap::new());
}

#[tauri::command]
pub async fn test_mongodb_connection(
    host: String,
    port: u16,
    username: Option<String>,
    password: Option<String>,
    database: String,
) -> Result<bool, String> {
    let connection_string = build_connection_string(&host, port, &username, &password, &database);

    let client = Client::with_uri_str(&connection_string)
        .await
        .map_err(|e| format!("Failed to create MongoDB client: {}", e))?;

    client
        .list_database_names()
        .await
        .map_err(|e| format!("Connection test failed: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn connect_mongodb(
    conn_id: String,
    host: String,
    port: u16,
    username: Option<String>,
    password: Option<String>,
    database: String,
) -> Result<bool, String> {
    let connection_string = build_connection_string(&host, port, &username, &password, &database);

    let client = Client::with_uri_str(&connection_string)
        .await
        .map_err(|e| format!("Failed to create MongoDB client: {}", e))?;

    client
        .list_database_names()
        .await
        .map_err(|e| format!("Connection test failed: {}", e))?;

    let mut connections = CONNECTIONS.lock().map_err(|e| {
        format!("Failed to get connection lock: {}", e)
    })?;

    connections.insert(conn_id, (client, database));
    Ok(true)
}

#[tauri::command]
pub fn disconnect_mongodb(conn_id: String) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().map_err(|e| {
        format!("Failed to get connection lock: {}", e)
    })?;

    match connections.remove(&conn_id) {
        Some(_) => Ok(true),
        None => Err(format!("Connection ID '{}' does not exist", conn_id)),
    }
}

#[tauri::command]
pub async fn get_mongodb_collections(conn_id: String) -> Result<Vec<String>, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let db = client.database(&database_name);

    let mut collections: Vec<String> = db
        .list_collection_names()
        .await
        .map_err(|e| format!("Failed to get collection list: {}", e))?;

    // 按名称排序，与 MySQL 的行为一致
    collections.sort();

    Ok(collections)
}

#[tauri::command]
pub async fn find_mongodb_documents(
    conn_id: String,
    collection: String,
    filter: String,
    page: u32,
    page_size: u32,
) -> Result<String, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let db = client.database(&database_name);
    let coll = db.collection::<Document>(&collection);

    let filter_doc = if filter.is_empty() {
        Document::new()
    } else {
        serde_json::from_str(&filter)
            .map_err(|e| format!("Failed to parse filter: {}", e))?
    };

    let skip = (page as u64) * (page_size as u64);
    let limit = page_size as i64;

    let cursor = coll
        .find(filter_doc)
        .with_options(mongodb::options::FindOptions::builder()
            .skip(skip)
            .limit(limit)
            .build())
        .await
        .map_err(|e| format!("Failed to query documents: {}", e))?;

    let documents: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| format!("Failed to collect documents: {}", e))?;

    serde_json::to_string_pretty(&documents)
        .map_err(|e| format!("Failed to serialize documents: {}", e))
}

#[tauri::command]
pub async fn get_mongodb_databases(conn_id: String) -> Result<Vec<String>, String> {
    let (client, _) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, _) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), String::new())
    };

    let mut databases: Vec<String> = client
        .list_database_names()
        .await
        .map_err(|e| format!("Failed to get database list: {}", e))?;

    // 按名称排序，与 MySQL 的行为一致
    databases.sort();

    Ok(databases)
}

#[tauri::command]
pub async fn get_mongodb_database_stats(conn_id: String, database: String) -> Result<String, String> {
    let (client, _) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, _) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), String::new())
    };

    let db = client.database(&database);
    let stats = db.run_command(doc! { "dbStats": 1, "scale": 1024 })
        .await
        .map_err(|e| format!("Failed to get database stats: {}", e))?;

    serde_json::to_string_pretty(&stats)
        .map_err(|e| format!("Failed to serialize stats: {}", e))
}

#[tauri::command]
pub async fn drop_mongodb_database(conn_id: String, database: String) -> Result<bool, String> {
    let (client, _) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, _) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), String::new())
    };

    client
        .database(&database)
        .drop()
        .await
        .map_err(|e| format!("Failed to drop database: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn create_mongodb_collection(
    conn_id: String,
    name: String,
) -> Result<bool, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    client
        .database(&database_name)
        .create_collection(&name)
        .await
        .map_err(|e| format!("Failed to create collection: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn drop_mongodb_collection(
    conn_id: String,
    collection: String,
) -> Result<bool, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    client
        .database(&database_name)
        .collection::<Document>(&collection)
        .drop()
        .await
        .map_err(|e| format!("Failed to drop collection: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn rename_mongodb_collection(
    _conn_id: String,
    _old_name: String,
    _new_name: String,
) -> Result<bool, String> {
    Err(String::from("Rename collection not implemented"))
}

#[tauri::command]
pub async fn get_mongodb_collection_stats(
    conn_id: String,
    collection: String,
) -> Result<String, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let db = client.database(&database_name);
    let stats = db.run_command(doc! { "collStats": &collection, "scale": 1024 })
        .await
        .map_err(|e| format!("Failed to get collection stats: {}", e))?;

    serde_json::to_string_pretty(&stats)
        .map_err(|e| format!("Failed to serialize stats: {}", e))
}

#[tauri::command]
pub async fn count_mongodb_documents(
    conn_id: String,
    collection: String,
) -> Result<u64, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let db = client.database(&database_name);
    let count = db.collection::<Document>(&collection)
        .count_documents(doc! {})
        .await
        .map_err(|e| format!("Failed to count documents: {}", e))?;

    Ok(count)
}

#[tauri::command]
pub async fn insert_mongodb_document(
    conn_id: String,
    collection: String,
    document: String,
) -> Result<bool, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let db = client.database(&database_name);
    let doc: Document = serde_json::from_str(&document)
        .map_err(|e| format!("Failed to parse document: {}", e))?;

    db.collection::<Document>(&collection)
        .insert_one(doc)
        .await
        .map_err(|e| format!("Failed to insert document: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn update_mongodb_document(
    conn_id: String,
    collection: String,
    filter: String,
    update: String,
) -> Result<bool, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let db = client.database(&database_name);
    let filter_doc: Document = serde_json::from_str(&filter)
        .map_err(|e| format!("Failed to parse filter: {}", e))?;
    let update_doc: Document = serde_json::from_str(&update)
        .map_err(|e| format!("Failed to parse update: {}", e))?;

    db.collection::<Document>(&collection)
        .update_one(filter_doc, update_doc)
        .await
        .map_err(|e| format!("Failed to update document: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn delete_mongodb_document(
    conn_id: String,
    collection: String,
    filter: String,
) -> Result<bool, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let db = client.database(&database_name);
    let filter_doc: Document = serde_json::from_str(&filter)
        .map_err(|e| format!("Failed to parse filter: {}", e))?;

    db.collection::<Document>(&collection)
        .delete_one(filter_doc)
        .await
        .map_err(|e| format!("Failed to delete document: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn find_mongodb_documents_paginated(
    conn_id: String,
    collection: String,
    filter: String,
    sort: String,
    page: u32,
    page_size: u32,
) -> Result<String, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let db = client.database(&database_name);
    let coll = db.collection::<Document>(&collection);

    let filter_doc = if filter.is_empty() {
        Document::new()
    } else {
        serde_json::from_str(&filter)
            .map_err(|e| format!("Failed to parse filter: {}", e))?
    };

    let sort_doc = if sort.is_empty() {
        Document::new()
    } else {
        serde_json::from_str(&sort)
            .map_err(|e| format!("Failed to parse sort: {}", e))?
    };

    let skip = (page as u64) * (page_size as u64);
    let limit = page_size as i64;

    let cursor = coll
        .find(filter_doc)
        .with_options(mongodb::options::FindOptions::builder()
            .skip(skip)
            .limit(limit)
            .sort(sort_doc)
            .build())
        .await
        .map_err(|e| format!("Failed to query documents: {}", e))?;

    let documents: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| format!("Failed to collect documents: {}", e))?;

    serde_json::to_string_pretty(&documents)
        .map_err(|e| format!("Failed to serialize documents: {}", e))
}

#[tauri::command]
pub async fn get_mongodb_indexes(
    conn_id: String,
    collection: String,
) -> Result<String, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let db = client.database(&database_name);
    let coll = db.collection::<Document>(&collection);

    let cursor = coll.list_indexes()
        .await
        .map_err(|e| format!("Failed to list indexes: {}", e))?;

    let indexes: Vec<IndexModel> = cursor
        .try_collect()
        .await
        .map_err(|e| format!("Failed to collect indexes: {}", e))?;

    serde_json::to_string_pretty(&indexes)
        .map_err(|e| format!("Failed to serialize indexes: {}", e))
}

#[tauri::command]
pub async fn create_mongodb_index(
    _conn_id: String,
    _collection: String,
    _keys: String,
    _options: Option<String>,
) -> Result<bool, String> {
    Err(String::from("Create index not implemented"))
}

#[tauri::command]
pub async fn drop_mongodb_index(
    conn_id: String,
    collection: String,
    name: String,
) -> Result<bool, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let db = client.database(&database_name);
    let coll = db.collection::<Document>(&collection);

    coll.drop_index(&name)
        .await
        .map_err(|e| format!("Failed to drop index: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn export_mongodb_collection(
    conn_id: String,
    collection: String,
) -> Result<String, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let db = client.database(&database_name);
    let coll = db.collection::<Document>(&collection);

    let cursor = coll.find(doc! {})
        .await
        .map_err(|e| format!("Failed to query documents: {}", e))?;

    let documents: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| format!("Failed to collect documents: {}", e))?;

    serde_json::to_string_pretty(&documents)
        .map_err(|e| format!("Failed to serialize documents: {}", e))
}

#[tauri::command]
pub async fn import_mongodb_collection(
    conn_id: String,
    collection: String,
    data: String,
) -> Result<bool, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let db = client.database(&database_name);
    let coll = db.collection::<Document>(&collection);

    let documents: Vec<Document> = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse documents: {}", e))?;

    for doc in documents {
        coll.insert_one(doc)
            .await
            .map_err(|e| format!("Failed to import document: {}", e))?;
    }

    Ok(true)
}

#[tauri::command]
pub async fn get_mongodb_monitor_data(conn_id: String) -> Result<String, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let admin = client.database("admin");

    // 获取服务器状态
    let server_status = admin.run_command(doc! { "serverStatus": 1 })
        .await
        .map_err(|e| format!("Failed to get server status: {}", e))?;

    // 获取数据库状态
    let db_status = client.database(&database_name).run_command(doc! { "dbStats": 1, "scale": 1024 })
        .await
        .map_err(|e| format!("Failed to get database stats: {}", e))?;

    // 提取关键指标
    let connections = server_status
        .get_document("connections")
        .and_then(|c| c.get_i32("current"))
        .unwrap_or(0) as f64;

    let uptime = server_status
        .get_i32("uptime")
        .unwrap_or(0) as f64;

    let opcounters = server_status
        .get_document("opcounters")
        .map_err(|e| format!("Failed to get opcounters: {}", e))?;

    let total_ops: i64 = opcounters.iter()
        .filter_map(|(k, v)| {
            if k != "command" && k != "getmore" {
                v.as_i64()
            } else {
                None
            }
        })
        .sum();

    let qps = if uptime > 0.0 { total_ops as f64 / uptime } else { 0.0 };

    // 获取集合数量
    let collections = db_status
        .get_i32("collections")
        .unwrap_or(0) as f64;

    // 获取数据大小
    let data_size = db_status
        .get_i64("dataSize")
        .unwrap_or(0) as f64;

    // 获取索引大小
    let index_size = db_status
        .get_i64("indexSize")
        .unwrap_or(0) as f64;

    // 获取文档数量
    let objects = db_status
        .get_i64("objects")
        .unwrap_or(0) as f64;

    let result = serde_json::json!({
        "timestamp": chrono::Utc::now().timestamp_millis(),
        "qps": qps,
        "connections": connections,
        "slow_queries": 0,
        "cpu_usage": 0.0,
        "memory_usage": 0.0,
        "uptime": uptime,
        "collections": collections,
        "data_size": data_size,
        "index_size": index_size,
        "documents": objects
    });

    serde_json::to_string(&result)
        .map_err(|e| format!("Failed to serialize data: {}", e))
}

#[tauri::command]
pub async fn get_mongodb_slow_queries(conn_id: String, database: String) -> Result<String, String> {
    let (client, _) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, _) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), String::new())
    };

    let admin = client.database("admin");

    // 获取慢查询
    let result = admin.run_command(doc! {
        "profile": 2,
        "slowms": 100
    }).await;

    match result {
        Ok(_) => {
            // 查询慢查询记录
            let db = client.database(&database);
            let coll = db.collection::<Document>("system.profile");

            let cursor = coll.find(doc! {})
                .with_options(mongodb::options::FindOptions::builder()
                    .limit(10)
                    .sort(doc! { "ts": -1 })
                    .build())
                .await
                .map_err(|e| format!("Failed to query slow queries: {}", e))?;

            let queries: Vec<Document> = cursor
                .try_collect()
                .await
                .map_err(|e| format!("Failed to collect slow queries: {}", e))?;

            serde_json::to_string_pretty(&queries)
                .map_err(|e| format!("Failed to serialize slow queries: {}", e))
        }
        Err(e) => Err(format!("Failed to enable profiling: {}", e))
    }
}

#[tauri::command]
pub async fn explain_mongodb_query(
    conn_id: String,
    collection: String,
    filter: String,
    sort: Option<String>,
) -> Result<String, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let db = client.database(&database_name);

    let filter_doc = if filter.is_empty() {
        Document::new()
    } else {
        serde_json::from_str(&filter)
            .map_err(|e| format!("Failed to parse filter: {}", e))?
    };

    let explain_cmd = if let Some(sort_str) = sort {
        if !sort_str.is_empty() {
            let sort_value: serde_json::Value = serde_json::from_str(&sort_str)
                .map_err(|e| format!("Failed to parse sort: {}", e))?;
            let sort_doc: Document = serde_json::from_value(sort_value)
                .map_err(|e| format!("Failed to convert sort to Document: {}", e))?;
            doc! {
                "explain": {
                    "find": &collection,
                    "filter": filter_doc,
                    "sort": sort_doc
                }
            }
        } else {
            doc! {
                "explain": {
                    "find": &collection,
                    "filter": filter_doc
                }
            }
        }
    } else {
        doc! {
            "explain": {
                "find": &collection,
                "filter": filter_doc
            }
        }
    };

    let result = db.run_command(explain_cmd)
        .await
        .map_err(|e| format!("Failed to explain query: {}", e))?;

    serde_json::to_string_pretty(&result)
        .map_err(|e| format!("Failed to serialize explain result: {}", e))
}

#[tauri::command]
pub async fn get_mongodb_index_stats(conn_id: String, collection: String) -> Result<String, String> {
    let (client, database_name) = {
        let connections = CONNECTIONS.lock().map_err(|e| {
            format!("Failed to get connection lock: {}", e)
        })?;

        let (client, database_name) = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection ID '{}' does not exist", conn_id))?;

        (client.clone(), database_name.clone())
    };

    let db = client.database(&database_name);
    let coll = db.collection::<Document>(&collection);

    // 获取所有索引
    let cursor = coll.list_indexes()
        .await
        .map_err(|e| format!("Failed to list indexes: {}", e))?;

    let indexes: Vec<IndexModel> = cursor
        .try_collect()
        .await
        .map_err(|e| format!("Failed to collect indexes: {}", e))?;

    // 获取集合统计信息
    let stats = db.run_command(doc! { "collStats": &collection, "scale": 1024 })
        .await
        .map_err(|e| format!("Failed to get collection stats: {}", e))?;

    // 获取索引使用统计
    let mut index_stats = Vec::new();

    for index in indexes {
        let index_name = index.keys.keys().next().unwrap_or(&"_id".to_string()).clone();
        
        let usage_result = db.run_command(doc! {
            "aggregate": 1,
            "pipeline": [
                { "$indexStats": {} },
                { "$match": { "name": &index_name } }
            ]
        }).await;

        let usage = match usage_result {
            Ok(u) => u,
            Err(_) => continue,
        };

        index_stats.push(serde_json::json!({
            "name": index_name,
            "keys": index.keys,
            "options": index.options,
            "usage": usage
        }));
    }

    let result = serde_json::json!({
        "stats": stats,
        "indexes": index_stats
    });

    serde_json::to_string_pretty(&result)
        .map_err(|e| format!("Failed to serialize index stats: {}", e))
}

fn build_connection_string(
    host: &str,
    port: u16,
    username: &Option<String>,
    password: &Option<String>,
    database: &str,
) -> String {
    let auth_part = if let (Some(user), Some(pass)) = (username, password) {
        format!("{}:{}@", user, pass)
    } else {
        String::new()
    };

    // Add authSource=admin for authentication, as MongoDB users are typically created in admin database
    format!("mongodb://{}{}:{}/{}?authSource=admin", auth_part, host, port, database)
}