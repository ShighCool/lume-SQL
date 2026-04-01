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

    let collections: Vec<String> = db
        .list_collection_names()
        .await
        .map_err(|e| format!("Failed to get collection list: {}", e))?;

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
            .skip(skip as u64)
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

    let databases: Vec<String> = client
        .list_database_names()
        .await
        .map_err(|e| format!("Failed to get database list: {}", e))?;

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

fn build_connection_string(
    host: &str,
    port: u16,
    username: &Option<String>,
    password: &Option<String>,
    _database: &str,
) -> String {
    let auth_part = if let (Some(user), Some(pass)) = (username, password) {
        format!("{}:{}@", user, pass)
    } else {
        String::new()
    };

    format!("mongodb://{}{}/{}", auth_part, host, port)
}