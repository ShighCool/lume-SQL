use lazy_static::lazy_static;
use mysql::prelude::*;
use mysql::{Pool, Row};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

lazy_static! {
    static ref CONNECTIONS: Mutex<HashMap<String, Pool>> = Mutex::new(HashMap::new());
}

#[derive(Serialize, Deserialize)]
pub struct TableData {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub total: u64,
}

#[derive(Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub r#type: String,
    pub nullable: String,
    pub key: String,
    pub default: String,
    pub extra: String,
}

#[tauri::command]
pub fn test_mysql_connection(
    host: String,
    port: u16,
    user: String,
    password: String,
    database: String,
) -> Result<bool, String> {
    let url = format!(
        "mysql://{}:{}@{}:{}/{}",
        user, password, host, port, database
    );

    match Pool::new(url.as_str()) {
        Ok(pool) => {
            match pool.get_conn() {
                Ok(_) => Ok(true),
                Err(e) => Err(format!("连接测试失败: {}", e)),
            }
        }
        Err(e) => Err(format!("创建连接池失败: {}", e)),
    }
}

#[tauri::command]
pub fn connect_mysql(
    conn_id: String,
    host: String,
    port: u16,
    user: String,
    password: String,
    database: String,
) -> Result<bool, String> {
    let url = format!(
        "mysql://{}:{}@{}:{}/{}",
        user, password, host, port, database
    );

    match Pool::new(url.as_str()) {
        Ok(pool) => {
            // 测试连接是否可用
            match pool.get_conn() {
                Ok(_) => {
                    let mut connections = CONNECTIONS.lock().map_err(|e| {
                        format!("获取连接池锁失败: {}", e)
                    })?;
                    connections.insert(conn_id, pool);
                    Ok(true)
                }
                Err(e) => Err(format!("连接测试失败: {}", e)),
            }
        }
        Err(e) => Err(format!("创建连接池失败: {}", e)),
    }
}

#[tauri::command]
pub fn disconnect_mysql(conn_id: String) -> Result<bool, String> {
    let mut connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    match connections.remove(&conn_id) {
        Some(_) => Ok(true),
        None => Err(format!("连接 ID '{}' 不存在", conn_id)),
    }
}

#[tauri::command]
pub fn execute_mysql_query(
    conn_id: String,
    sql: String,
) -> Result<Vec<Vec<String>>, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    // 先获取列信息
    let result: Vec<Row> = conn
        .query(&sql)
        .map_err(|e| format!("执行查询失败: {}", e))?;

    let mut rows: Vec<Vec<String>> = Vec::new();

    for row in result {
        let row_data: Vec<String> = row
            .unwrap()
            .into_iter()
            .map(|value| match value {
                mysql::Value::NULL => String::from("NULL"),
                mysql::Value::Bytes(bytes) => String::from_utf8_lossy(&bytes).to_string(),
                mysql::Value::Int(i) => i.to_string(),
                mysql::Value::UInt(u) => u.to_string(),
                mysql::Value::Float(f) => f.to_string(),
                mysql::Value::Double(d) => d.to_string(),
                mysql::Value::Date(year, month, day, hour, minute, second, micros) => {
                    format!("{}-{:02}-{:02} {:02}:{:02}:{:02}.{:06}",
                        year, month, day, hour, minute, second, micros)
                }
                mysql::Value::Time(sign, days, hours, minutes, seconds, micros) => {
                    let sign_str = if sign { "-" } else { "" };
                    format!("{}{}d {:02}:{:02}:{:02}.{:06}",
                        sign_str, days, hours, minutes, seconds, micros)
                }
            })
            .collect();
        rows.push(row_data);
    }

    Ok(rows)
}

#[tauri::command]
pub fn get_mysql_tables(conn_id: String, database: String) -> Result<Vec<String>, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    let tables: Vec<String> = conn
        .query("SHOW TABLES")
        .map_err(|e| format!("查询表列表失败: {}", e))?;

    Ok(tables)
}

#[tauri::command]
pub fn get_mysql_databases(conn_id: String) -> Result<Vec<String>, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    let databases: Vec<String> = conn
        .query("SHOW DATABASES")
        .map_err(|e| format!("查询数据库列表失败: {}", e))?;

    Ok(databases)
}

#[tauri::command]
pub fn get_mysql_table_data(
    conn_id: String,
    database: String,
    table: String,
    page: u32,
    page_size: u32,
    sort_field: Option<String>,
) -> Result<TableData, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 获取总数
    let total: u64 = conn
        .query_first(format!("SELECT COUNT(*) FROM `{}`", table))
        .map_err(|e| format!("查询总数失败: {}", e))?
        .ok_or_else(|| format!("查询总数失败"))?;

    // 获取列名
    let columns_result: Vec<Row> = conn
        .query(format!("SHOW COLUMNS FROM `{}`", table))
        .map_err(|e| format!("查询列信息失败: {}", e))?;

    let columns: Vec<String> = columns_result
        .iter()
        .map(|row| {
            row.clone()
                .unwrap()
                .into_iter()
                .next()
                .and_then(|v| {
                    if let mysql::Value::Bytes(bytes) = v {
                        Some(String::from_utf8_lossy(&bytes).to_string())
                    } else {
                        None
                    }
                })
                .unwrap_or_else(|| String::from("unknown"))
        })
        .collect();

    // 获取数据（分页）
    let offset = (page - 1) * page_size;
    let order_by = sort_field
        .map(|f| format!(" ORDER BY `{}` DESC", f))
        .unwrap_or_default();
    let query = format!(
        "SELECT * FROM `{}`{} LIMIT {} OFFSET {}",
        table, order_by, page_size, offset
    );
    let result: Vec<Row> = conn
        .query(&query)
        .map_err(|e| format!("查询数据失败: {}", e))?;

    let mut rows: Vec<Vec<String>> = Vec::new();
    for row in result {
        let row_data: Vec<String> = row
            .unwrap()
            .into_iter()
            .map(|value| match value {
                mysql::Value::NULL => String::from("NULL"),
                mysql::Value::Bytes(bytes) => String::from_utf8_lossy(&bytes).to_string(),
                mysql::Value::Int(i) => i.to_string(),
                mysql::Value::UInt(u) => u.to_string(),
                mysql::Value::Float(f) => f.to_string(),
                mysql::Value::Double(d) => d.to_string(),
                mysql::Value::Date(year, month, day, hour, minute, second, micros) => {
                    format!("{}-{:02}-{:02} {:02}:{:02}:{:02}.{:06}",
                        year, month, day, hour, minute, second, micros)
                }
                mysql::Value::Time(sign, days, hours, minutes, seconds, micros) => {
                    let sign_str = if sign { "-" } else { "" };
                    format!("{}{}d {:02}:{:02}:{:02}.{:06}",
                        sign_str, days, hours, minutes, seconds, micros)
                }
            })
            .collect();
        rows.push(row_data);
    }

    Ok(TableData { columns, rows, total })
}

#[tauri::command]
pub fn get_mysql_table_schema(
    conn_id: String,
    database: String,
    table: String,
) -> Result<Vec<ColumnInfo>, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    let result: Vec<Row> = conn
        .query(format!("SHOW COLUMNS FROM `{}`", table))
        .map_err(|e| format!("查询表结构失败: {}", e))?;

    let columns: Vec<ColumnInfo> = result
        .iter()
        .map(|row| {
            let values = row.clone().unwrap();
            let mut iter = values.into_iter();

            ColumnInfo {
                name: iter
                    .next()
                    .and_then(|v| {
                        if let mysql::Value::Bytes(bytes) = v {
                            Some(String::from_utf8_lossy(&bytes).to_string())
                        } else {
                            None
                        }
                    })
                    .unwrap_or_else(|| String::from("")),
                r#type: iter
                    .next()
                    .and_then(|v| {
                        if let mysql::Value::Bytes(bytes) = v {
                            Some(String::from_utf8_lossy(&bytes).to_string())
                        } else {
                            None
                        }
                    })
                    .unwrap_or_else(|| String::from("")),
                nullable: iter
                    .next()
                    .and_then(|v| {
                        if let mysql::Value::Bytes(bytes) = v {
                            Some(String::from_utf8_lossy(&bytes).to_string())
                        } else {
                            None
                        }
                    })
                    .unwrap_or_else(|| String::from("")),
                key: iter
                    .next()
                    .and_then(|v| {
                        if let mysql::Value::Bytes(bytes) = v {
                            Some(String::from_utf8_lossy(&bytes).to_string())
                        } else {
                            None
                        }
                    })
                    .unwrap_or_else(|| String::from("")),
                default: iter
                    .next()
                    .and_then(|v| {
                        if let mysql::Value::Bytes(bytes) = v {
                            Some(String::from_utf8_lossy(&bytes).to_string())
                        } else if let mysql::Value::NULL = v {
                            Some(String::from("NULL"))
                        } else {
                            None
                        }
                    })
                    .unwrap_or_else(|| String::from("")),
                extra: iter
                    .next()
                    .and_then(|v| {
                        if let mysql::Value::Bytes(bytes) = v {
                            Some(String::from_utf8_lossy(&bytes).to_string())
                        } else {
                            None
                        }
                    })
                    .unwrap_or_else(|| String::from("")),
            }
        })
        .collect();

    Ok(columns)
}

#[tauri::command]
pub fn get_table_ddl(
    conn_id: String,
    database: String,
    table: String,
) -> Result<String, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // SHOW CREATE TABLE 返回两列：表名和 CREATE TABLE 语句
    let result: Option<(String, String)> = conn
        .query_first(format!("SHOW CREATE TABLE `{}`", table))
        .map_err(|e| format!("查询表结构失败: {}", e))?;

    match result {
        Some((_, ddl)) => Ok(ddl),
        None => Err(format!("获取表 DDL 失败")),
    }
}

#[tauri::command]
pub fn export_table_structure(
    conn_id: String,
    database: String,
    table: String,
) -> Result<String, String> {
    get_table_ddl(conn_id, database, table)
}

#[tauri::command]
pub fn export_table_data(
    conn_id: String,
    database: String,
    table: String,
) -> Result<String, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 获取 CREATE TABLE 语句
    let result: Option<(String, String)> = conn
        .query_first(format!("SHOW CREATE TABLE `{}`", table))
        .map_err(|e| format!("查询表结构失败: {}", e))?;

    let create_table = match result {
        Some((_, ddl)) => ddl,
        None => return Err(format!("获取表 DDL 失败")),
    };

    // 获取列信息
    let columns_result: Vec<Row> = conn
        .query(format!("SHOW COLUMNS FROM `{}`", table))
        .map_err(|e| format!("查询列信息失败: {}", e))?;

    let column_names: Vec<String> = columns_result

            .iter()

            .map(|row| {

                row.clone()

                    .unwrap()

                    .into_iter()

                    .next()

                    .and_then(|v| {

                        if let mysql::Value::Bytes(bytes) = v {

                            Some(String::from_utf8_lossy(&bytes).to_string())

                        } else {

                            None

                        }

                    })

                    .unwrap_or_else(|| String::from("unknown"))

            })

            .collect();

    

        // 获取所有数据

        let result: Vec<Row> = conn

            .query(format!("SELECT * FROM `{}`", table))

            .map_err(|e| format!("查询数据失败: {}", e))?;

    

        let mut insert_statements = String::new();

    

        for row in result {

            let row_values = row.unwrap();

            let values: Vec<String> = row_values

                .into_iter()

                .map(|value| match value {

                    mysql::Value::NULL => String::from("NULL"),

                    mysql::Value::Bytes(bytes) => {

                        let s = String::from_utf8_lossy(&bytes).to_string();

                        format!("'{}'", s.replace("\\", "\\\\").replace("'", "\\'"))

                    }

                    mysql::Value::Int(i) => i.to_string(),

                    mysql::Value::UInt(u) => u.to_string(),

                    mysql::Value::Float(f) => f.to_string(),

                    mysql::Value::Double(d) => d.to_string(),

                    mysql::Value::Date(year, month, day, hour, minute, second, micros) => {

                        format!("'{}-{:02}-{:02} {:02}:{:02}:{:02}.{:06}'",

                            year, month, day, hour, minute, second, micros)

                    }

                    mysql::Value::Time(sign, days, hours, minutes, seconds, micros) => {

                        let sign_str = if sign { "-" } else { "" };

                        format!("'{}{}d {:02}:{:02}:{:02}.{:06}'",

                            sign_str, days, hours, minutes, seconds, micros)

                    }

                })

                .collect();

    

            insert_statements.push_str(&format!(

                "INSERT INTO `{}` ({}) VALUES ({});\n",

                table,

                column_names.iter().map(|c| format!("`{}`", c)).collect::<Vec<_>>().join(", "),

                values.join(", ")

            ));

        }

    Ok(format!("{}\n{}", create_table, insert_statements))
}

#[tauri::command]
pub fn generate_random_data(
    conn_id: String,
    database: String,
    table: String,
    row_count: u32,
) -> Result<u64, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 获取列信息
    let columns_result: Vec<Row> = conn
        .query(format!("SHOW COLUMNS FROM `{}`", table))
        .map_err(|e| format!("查询列信息失败: {}", e))?;

    let mut column_info: Vec<(String, String, bool)> = Vec::new();

    for row in &columns_result {
        let values = row.clone().unwrap();
        let mut iter = values.into_iter();

        let name = iter
            .next()
            .and_then(|v| {
                if let mysql::Value::Bytes(bytes) = v {
                    Some(String::from_utf8_lossy(&bytes).to_string())
                } else {
                    None
                }
            })
            .unwrap_or_else(|| String::from(""));

        let type_str = iter
            .next()
            .and_then(|v| {
                if let mysql::Value::Bytes(bytes) = v {
                    Some(String::from_utf8_lossy(&bytes).to_string())
                } else {
                    None
                }
            })
            .unwrap_or_else(|| String::from(""));

        let nullable = iter
            .next()
            .and_then(|v| {
                if let mysql::Value::Bytes(bytes) = v {
                    Some(String::from_utf8_lossy(&bytes).to_string())
                } else {
                    None
                }
            })
            .unwrap_or_else(|| String::from(""));

        let can_be_null = nullable == "YES";
        column_info.push((name, type_str, can_be_null));
    }

    // 生成随机数据
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut total_inserted: u64 = 0;

    for i in 0..row_count {
        let mut values: Vec<String> = Vec::new();
        let mut hasher = DefaultHasher::new();
        i.hash(&mut hasher);
        let seed = hasher.finish();

        for (idx, (_, type_str, can_be_null)) in column_info.iter().enumerate() {
            let value = if *can_be_null && (seed % 10) < 1 {
                // 10% 概率为 NULL
                String::from("NULL")
            } else {
                generate_random_value(type_str, seed, idx as u64)
            };
            values.push(value);
        }

        let insert_sql = format!(
            "INSERT INTO `{}` ({}) VALUES ({});",
            table,
            column_info.iter().map(|(name, _, _)| format!("`{}`", name)).collect::<Vec<_>>().join(", "),
            values.join(", ")
        );

        conn.query_drop(&insert_sql)
            .map_err(|e| format!("插入数据失败: {}", e))?;

        total_inserted += 1;
    }

    Ok(total_inserted)
}

fn generate_random_value(type_str: &str, seed: u64, column_index: u64) -> String {
    let type_lower = type_str.to_lowercase();

    // 解析类型和长度
    let (base_type, length) = parse_mysql_type(&type_lower);

    match base_type.as_str() {
        "int" | "integer" | "tinyint" | "smallint" | "mediumint" | "bigint" => {
            let max = 10_u64.pow(length.min(18)) - 1;
            let value = (seed % max) + 1;
            value.to_string()
        }
        "float" | "double" | "decimal" | "numeric" => {
            let int_part = (seed % 1000) as f64;
            let dec_part = ((seed * 1000) % 100) as f64;
            format!("{:.2}", int_part + dec_part / 100.0)
        }
        "varchar" | "char" | "text" | "tinytext" | "mediumtext" | "longtext" => {
            generate_random_string(length.min(50) as usize, seed)
        }
        "date" => {
            let year = 2000 + (seed % 25) as u32;
            let month = ((seed / 25) % 12 + 1) as u32;
            let day = ((seed / 300) % 28 + 1) as u32;
            format!("'{}-{:02}-{:02}'", year, month, day)
        }
        "datetime" | "timestamp" => {
            let year = 2000 + (seed % 25) as u32;
            let month = ((seed / 25) % 12 + 1) as u32;
            let day = ((seed / 300) % 28 + 1) as u32;
            let hour = ((seed / 8400) % 24) as u32;
            let minute = ((seed / 201600) % 60) as u32;
            let second = ((seed / 12096000) % 60) as u32;
            format!("'{}-{:02}-{:02} {:02}:{:02}:{:02}'", year, month, day, hour, minute, second)
        }
        "time" => {
            let hour = (seed % 24) as u32;
            let minute = ((seed / 24) % 60) as u32;
            let second = ((seed / 1440) % 60) as u32;
            format!("'{:02}:{:02}:{:02}'", hour, minute, second)
        }
        "boolean" | "bool" => {
            if seed % 2 == 0 {
                "1".to_string()
            } else {
                "0".to_string()
            }
        }
        "enum" => {
            // 提取枚举值
            let values = extract_enum_values(type_str);
            if values.is_empty() {
                "'unknown'".to_string()
            } else {
                let index = (seed % values.len() as u64) as usize;
                format!("'{}'", values[index])
            }
        }
        _ => {
            // 默认生成字符串
            format!("'test_{}_{}'", seed, column_index)
        }
    }
}

fn parse_mysql_type(type_str: &str) -> (String, u32) {
    let type_str = type_str.trim();
    
    // 检查是否有括号
    if let Some(paren_pos) = type_str.find('(') {
        let base_type = type_str[..paren_pos].to_string();
        let rest = &type_str[paren_pos + 1..];
        
        if let Some(end_pos) = rest.find(')') {
            let length_str = rest[..end_pos].trim();
            let length: u32 = length_str.parse().unwrap_or(255);
            return (base_type, length);
        }
    }
    
    // 没有括号，返回默认长度
    let default_length = match type_str {
        "tinyint" => 4,
        "smallint" => 6,
        "mediumint" => 9,
        "int" | "integer" => 11,
        "bigint" => 20,
        "char" => 1,
        "varchar" => 255,
        _ => 255,
    };
    
    (type_str.to_string(), default_length)
}

fn generate_random_string(length: usize, seed: u64) -> String {
    const CHARS: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut result = String::new();
    let mut current_seed = seed;
    
    for _ in 0..length {
        let idx = (current_seed % CHARS.len() as u64) as usize;
        result.push(CHARS[idx] as char);
        current_seed = current_seed.wrapping_mul(1103515245).wrapping_add(12345);
    }
    
    format!("'{}'", result)
}

fn extract_enum_values(type_str: &str) -> Vec<String> {
    if let Some(start) = type_str.find('(') {
        if let Some(end) = type_str.rfind(')') {
            let values_str = &type_str[start + 1..end];
            let mut values = Vec::new();
            
            // 分割枚举值
            let mut current = String::new();
            let mut in_quote = false;
            
            for c in values_str.chars() {
                match c {
                    '\'' => {
                        in_quote = !in_quote;
                    }
                    ',' if !in_quote => {
                        if !current.is_empty() {
                            values.push(current.clone());
                            current.clear();
                        }
                    }
                    _ if in_quote => {
                        current.push(c);
                    }
                    _ => {}
                }
            }
            
            if !current.is_empty() {
                values.push(current);
            }
            
            return values;
        }
    }
    
    Vec::new()
}

#[tauri::command]
pub fn drop_table(
    conn_id: String,
    database: String,
    table: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    conn.query_drop(format!("DROP TABLE `{}`", table))
        .map_err(|e| format!("删除表失败: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub fn copy_table(
    conn_id: String,
    database: String,
    table: String,
    new_table_name: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 创建新表（复制结构）
    conn.query_drop(format!("CREATE TABLE `{}` LIKE `{}`", new_table_name, table))
        .map_err(|e| format!("创建表失败: {}", e))?;

    // 复制数据
    conn.query_drop(format!("INSERT INTO `{}` SELECT * FROM `{}`", new_table_name, table))
        .map_err(|e| format!("复制数据失败: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub fn modify_column(
    conn_id: String,
    database: String,
    table: String,
    column_name: String,
    new_definition: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    let sql = format!("ALTER TABLE `{}` MODIFY COLUMN `{}` {}", table, column_name, new_definition);
    conn.query_drop(&sql)
        .map_err(|e| format!("修改字段失败: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub fn add_column(
    conn_id: String,
    database: String,
    table: String,
    column_name: String,
    column_definition: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    let sql = format!("ALTER TABLE `{}` ADD COLUMN `{}` {}", table, column_name, column_definition);
    conn.query_drop(&sql)
        .map_err(|e| format!("添加字段失败: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub fn drop_column(
    conn_id: String,
    database: String,
    table: String,
    column_name: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    let sql = format!("ALTER TABLE `{}` DROP COLUMN `{}`", table, column_name);
    conn.query_drop(&sql)
        .map_err(|e| format!("删除字段失败: {}", e))?;

    Ok(true)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableStructure {
    pub table_name: String,
    pub comment: String,
    pub engine: String,
    pub charset: String,
    pub update_time: Option<String>,
    pub columns: Vec<ColumnDetail>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ColumnDetail {
    pub name: String,
    pub type_info: String,
    pub length: Option<String>,
    pub comment: Option<String>,
    pub default: Option<String>,
    pub is_nullable: bool,
    pub is_primary: bool,
    pub is_unique: bool,
    pub is_auto_increment: bool,
    pub is_unsigned: bool,
    pub is_zerofill: bool,
}

#[tauri::command]
pub async fn get_table_structure(
    conn_id: String,
    database: String,
    table: String,
) -> Result<TableStructure, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 获取表状态信息
    let table_status: Option<Row> = conn
        .query_first(format!(
            "SHOW TABLE STATUS FROM `{}` WHERE Name = '{}'",
            database, table
        ))
        .map_err(|e| format!("查询表状态失败: {}", e))?;

    let (comment, engine, charset, update_time) = if let Some(row) = table_status {
        let values = row.unwrap();
        let mut iter = values.into_iter();
        
        // Name, Engine, Version, Row_format, Rows, Avg_row_length, Data_length, Max_data_length, Index_length, Data_free, Auto_increment, Create_time, Update_time, Check_time, Collation, Checksum, Create_options, Comment
        let _name: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let engine_val: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_else(|| "InnoDB".to_string());
        let _version: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _row_format: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _rows: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _avg_row_length: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _data_length: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _max_data_length: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _index_length: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _data_free: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _auto_increment: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _create_time: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let update_time_val: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _check_time: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let collation: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _checksum: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _create_options: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let comment_val: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        
        // 从 collation 提取字符集 (例如: utf8mb4_general_ci -> utf8mb4)
        let charset_val = collation.split('_').next().unwrap_or("utf8mb4").to_string();
        
        (comment_val, engine_val, charset_val, if update_time_val.is_empty() { None } else { Some(update_time_val) })
    } else {
        (String::new(), "InnoDB".to_string(), "utf8mb4".to_string(), None)
    };

    // 获取列信息
    let columns_result: Vec<Row> = conn
        .query(format!("SHOW FULL COLUMNS FROM `{}`", table))
        .map_err(|e| format!("查询列信息失败: {}", e))?;

    let mut columns: Vec<ColumnDetail> = Vec::new();
    
    for row in columns_result {
        let values = row.unwrap();
        let mut iter = values.into_iter();
        
        let name: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let type_info_raw: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _collation_val: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let nullable_val: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let key_val: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let default_val: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let extra_val: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _privileges: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let comment_val: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        
        // 解析类型和长度
        let (base_type, length) = parse_column_type(&type_info_raw);
        
        // 检查属性
        let type_lower = type_info_raw.to_lowercase();
        let is_unsigned = type_lower.contains("unsigned");
        let is_zerofill = type_lower.contains("zerofill");
        let is_auto_increment = extra_val.to_lowercase().contains("auto_increment");
        let is_primary = key_val == "PRI";
        let is_unique = key_val == "UNI";
        let is_nullable = nullable_val == "YES";
        
        columns.push(ColumnDetail {
            name,
            type_info: base_type,
            length: Some(length),
            comment: if comment_val.is_empty() { None } else { Some(comment_val) },
            default: if default_val == "NULL" || default_val.is_empty() { None } else { Some(default_val) },
            is_nullable,
            is_primary,
            is_unique,
            is_auto_increment,
            is_unsigned,
            is_zerofill,
        });
    }

    Ok(TableStructure {
        table_name: table,
        comment,
        engine,
        charset,
        update_time,
        columns,
    })
}

#[tauri::command]
pub async fn save_table_structure(
    conn_id: String,
    database: String,
    table: String,
    columns: Vec<ColumnDetail>,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 获取现有列
    let existing_columns_result: Vec<Row> = conn
        .query(format!("SHOW COLUMNS FROM `{}`", table))
        .map_err(|e| format!("查询现有列失败: {}", e))?;

    let mut existing_columns: Vec<String> = Vec::new();
    for row in existing_columns_result {
        let values = row.unwrap();
        existing_columns.push(
            values
                .into_iter()
                .next()
                .and_then(|v| extract_string(v))
                .unwrap_or_default()
        );
    }

    // 构建修改语句
    let mut alter_statements: Vec<String> = Vec::new();
    
    // 处理列：修改现有列，添加新列，删除不存在的列
    let new_column_names: Vec<String> = columns.iter().map(|c| c.name.clone()).collect();
    
    // 先删除不存在的列
    for existing_col in &existing_columns {
        if !new_column_names.contains(existing_col) {
            alter_statements.push(format!("DROP COLUMN `{}`", existing_col));
        }
    }
    
    // 修改或添加列
    for column in &columns {
        let column_def = build_column_definition(column);
        
        if existing_columns.contains(&column.name) {
            // 修改列
            alter_statements.push(format!("MODIFY COLUMN `{}` {}", column.name, column_def));
        } else {
            // 添加列
            alter_statements.push(format!("ADD COLUMN `{}` {}", column.name, column_def));
        }
    }
    
    // 处理主键（先删除所有主键约束，然后添加新的）
    let primary_key_columns: Vec<String> = columns.iter()
        .filter(|c| c.is_primary)
        .map(|c| format!("`{}`", c.name))
        .collect();
    
    // 执行 ALTER TABLE 语句
    for stmt in alter_statements {
        let sql = format!("ALTER TABLE `{}` {}", table, stmt);
        conn.query_drop(&sql)
            .map_err(|e| format!("执行 ALTER TABLE 失败: {}\nSQL: {}", e, sql))?;
    }
    
    // 重建主键（如果有的话）
    if !primary_key_columns.is_empty() {
        // 先删除旧的主键
        let _ = conn.query_drop(format!("ALTER TABLE `{}` DROP PRIMARY KEY", table));
        
        // 添加新主键
        let pk_sql = format!("ALTER TABLE `{}` ADD PRIMARY KEY ({})", table, primary_key_columns.join(", "));
        conn.query_drop(&pk_sql)
            .map_err(|e| format!("添加主键失败: {}", e))?;
    }
    
    // 处理唯一约束
    for column in &columns {
        if column.is_unique && !column.is_primary {
            let constraint_name = format!("uniq_{}", column.name);
            // 先删除旧的唯一约束
            let _ = conn.query_drop(format!("ALTER TABLE `{}` DROP INDEX `{}`", table, constraint_name));
            // 添加新的唯一约束
            let unique_sql = format!("ALTER TABLE `{}` ADD UNIQUE INDEX `{}` (`{}`)", table, constraint_name, column.name);
            conn.query_drop(&unique_sql)
                .map_err(|e| format!("添加唯一约束失败: {}", e))?;
        }
    }

    Ok(true)
}

fn extract_string(value: mysql::Value) -> Option<String> {
    match value {
        mysql::Value::NULL => None,
        mysql::Value::Bytes(bytes) => Some(String::from_utf8_lossy(&bytes).to_string()),
        mysql::Value::Int(i) => Some(i.to_string()),
        mysql::Value::UInt(u) => Some(u.to_string()),
        mysql::Value::Float(f) => Some(f.to_string()),
        mysql::Value::Double(d) => Some(d.to_string()),
        mysql::Value::Date(year, month, day, hour, minute, second, micros) => {
            Some(format!("{}-{:02}-{:02} {:02}:{:02}:{:02}.{:06}",
                year, month, day, hour, minute, second, micros))
        }
        mysql::Value::Time(sign, days, hours, minutes, seconds, micros) => {
            let sign_str = if sign { "-" } else { "" };
            Some(format!("{}{}d {:02}:{:02}:{:02}.{:06}",
                sign_str, days, hours, minutes, seconds, micros))
        }
    }
}

fn parse_column_type(type_info: &str) -> (String, String) {
    let type_lower = type_info.to_lowercase();
    
    // 检查是否有括号
    if let Some(paren_pos) = type_lower.find('(') {
        let base_type = type_lower[..paren_pos].to_string();
        let rest = &type_lower[paren_pos + 1..];
        
        if let Some(end_pos) = rest.find(')') {
            let length_str = rest[..end_pos].trim();
            return (base_type, length_str.to_string());
        }
    }
    
    // 没有括号，返回默认长度
    let (base_type, default_length) = match type_lower.as_str() {
        "tinyint" => ("tinyint".to_string(), "4"),
        "smallint" => ("smallint".to_string(), "6"),
        "mediumint" => ("mediumint".to_string(), "9"),
        "int" | "integer" => ("int".to_string(), "11"),
        "bigint" => ("bigint".to_string(), "20"),
        "char" => ("char".to_string(), "1"),
        "varchar" => ("varchar".to_string(), "255"),
        _ => (type_lower.clone(), ""),
    };
    
    (base_type, default_length.to_string())
}

fn build_column_definition(column: &ColumnDetail) -> String {
    let mut parts = Vec::new();
    
    // 类型
    let type_def = if let Some(ref length) = column.length {
        if !length.is_empty() {
            format!("{}({})", column.type_info, length)
        } else {
            column.type_info.clone()
        }
    } else {
        column.type_info.clone()
    };
    parts.push(type_def);
    
    // UNSIGNED
    if column.is_unsigned {
        parts.push("UNSIGNED".to_string());
    }
    
    // ZEROFILL
    if column.is_zerofill {
        parts.push("ZEROFILL".to_string());
    }
    
    // NOT NULL
    if !column.is_nullable {
        parts.push("NOT NULL".to_string());
    }
    
    // AUTO_INCREMENT
    if column.is_auto_increment {
        parts.push("AUTO_INCREMENT".to_string());
    }
    
    // DEFAULT
    if let Some(ref default) = column.default {
        if !default.is_empty() && default.to_uppercase() != "NULL" {
            // 判断是否需要引号
            let needs_quotes = !is_numeric_value(default);
            if needs_quotes {
                parts.push(format!("DEFAULT '{}'", escape_sql_string(default)));
            } else {
                parts.push(format!("DEFAULT {}", default));
            }
        }
    }
    
    // COMMENT
    if let Some(ref comment) = column.comment {
        if !comment.is_empty() {
            parts.push(format!("COMMENT '{}'", escape_sql_string(comment)));
        }
    }
    
    parts.join(" ")
}

fn is_numeric_value(value: &str) -> bool {
    let value = value.trim();
    if value.is_empty() {
        return false;
    }
    
    // 检查是否为数字（包括小数和负数）
    value.chars().all(|c| c.is_ascii_digit() || c == '.' || c == '-')
}

fn escape_sql_string(s: &str) -> String {
    s.replace('\\', "\\\\").replace("'", "\\'").replace('"', "\\\"")
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexDetail {
    pub name: String,
    pub columns: Vec<String>,
    pub is_unique: bool,
    pub is_primary: bool,
    pub index_type: String,
}

#[tauri::command]
pub async fn get_table_indexes(
    conn_id: String,
    database: String,
    table: String,
) -> Result<Vec<IndexDetail>, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 获取索引信息
    let result: Vec<Row> = conn
        .query(format!("SHOW INDEX FROM `{}`", table))
        .map_err(|e| format!("查询索引信息失败: {}", e))?;

    let mut indexes: std::collections::HashMap<String, IndexDetail> = std::collections::HashMap::new();

    for row in result {
        let values = row.unwrap();
        let mut iter = values.into_iter();
        
        let table_name: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let non_unique: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let key_name: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _seq_in_index: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let column_name: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _collation: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _cardinality: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _sub_part: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _packed: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _null: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _index_type: String = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();

        let is_primary = key_name == "PRIMARY";
        let is_unique = non_unique == "0";

        indexes
            .entry(key_name.clone())
            .and_modify(|idx| {
                idx.columns.push(column_name.clone());
            })
            .or_insert(IndexDetail {
                name: key_name,
                columns: vec![column_name],
                is_unique,
                is_primary,
                index_type: "BTREE".to_string(),
            });
    }

    Ok(indexes.into_values().collect())
}

#[tauri::command]
pub async fn add_index(
    conn_id: String,
    database: String,
    table: String,
    index_name: String,
    columns: Vec<String>,
    is_unique: bool,
    _index_type: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 构建 CREATE INDEX 语句
    let unique_keyword = if is_unique { "UNIQUE " } else { "" };
    let columns_str = columns.iter().map(|c| format!("`{}`", c)).collect::<Vec<_>>().join(", ");
    
    let sql = format!(
        "CREATE {}INDEX `{}` ON `{}` ({})",
        unique_keyword, index_name, table, columns_str
    );

    conn.query_drop(&sql)
        .map_err(|e| format!("创建索引失败: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn drop_index(
    conn_id: String,
    database: String,
    table: String,
    index_name: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 构建 DROP INDEX 语句
    let sql = format!("DROP INDEX `{}` ON `{}`", index_name, table);

    conn.query_drop(&sql)
        .map_err(|e| format!("删除索引失败: {}", e))?;

    Ok(true)
}

// 外键相关结构体和命令
#[derive(Debug, Serialize, Deserialize)]
pub struct ForeignKeyDetail {
    pub name: String,
    pub column: String,
    pub referenced_table: String,
    pub referenced_column: String,
    pub on_delete: String,
    pub on_update: String,
}

#[tauri::command]
pub async fn get_table_foreign_keys(
    conn_id: String,
    database: String,
    table: String,
) -> Result<Vec<ForeignKeyDetail>, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 查询外键信息
    let sql = format!(
        "SELECT 
            CONSTRAINT_NAME,
            COLUMN_NAME,
            REFERENCED_TABLE_NAME,
            REFERENCED_COLUMN_NAME,
            DELETE_RULE,
            UPDATE_RULE
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = '{}' AND TABLE_NAME = '{}' AND REFERENCED_TABLE_NAME IS NOT NULL",
        database, table
    );

    let result: Vec<Row> = conn
        .query(&sql)
        .map_err(|e| format!("查询外键失败: {}", e))?;

    let mut foreign_keys: Vec<ForeignKeyDetail> = Vec::new();

    for row in result {
        let values = row.unwrap();
        let mut iter = values.into_iter();

        let name = iter
            .next()
            .and_then(|v| extract_string(v))
            .unwrap_or_default();
        let column = iter
            .next()
            .and_then(|v| extract_string(v))
            .unwrap_or_default();
        let referenced_table = iter
            .next()
            .and_then(|v| extract_string(v))
            .unwrap_or_default();
        let referenced_column = iter
            .next()
            .and_then(|v| extract_string(v))
            .unwrap_or_default();
        let on_delete = iter
            .next()
            .and_then(|v| extract_string(v))
            .unwrap_or_else(|| "RESTRICT".to_string());
        let on_update = iter
            .next()
            .and_then(|v| extract_string(v))
            .unwrap_or_else(|| "RESTRICT".to_string());

        foreign_keys.push(ForeignKeyDetail {
            name,
            column,
            referenced_table,
            referenced_column,
            on_delete,
            on_update,
        });
    }

    Ok(foreign_keys)
}

#[tauri::command]
pub async fn add_foreign_key(
    conn_id: String,
    database: String,
    table: String,
    name: String,
    column: String,
    referenced_table: String,
    referenced_column: String,
    on_delete: String,
    on_update: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 构建 ADD FOREIGN KEY 语句
    let sql = format!(
        "ALTER TABLE `{}` ADD CONSTRAINT `{}` FOREIGN KEY (`{}`) REFERENCES `{}` (`{}`) ON DELETE {} ON UPDATE {}",
        table, name, column, referenced_table, referenced_column, on_delete, on_update
    );

    conn.query_drop(&sql)
        .map_err(|e| format!("添加外键失败: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn drop_foreign_key(
    conn_id: String,
    database: String,
    table: String,
    name: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 构建 DROP FOREIGN KEY 语句
    let sql = format!("ALTER TABLE `{}` DROP FOREIGN KEY `{}`", table, name);

    conn.query_drop(&sql)
        .map_err(|e| format!("删除外键失败: {}", e))?;

    Ok(true)
}

// 视图相关命令
#[tauri::command]
pub async fn get_views(
    conn_id: String,
    database: String,
) -> Result<Vec<String>, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    // 查询所有视图
    let sql = format!(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA = '{}'",
        database
    );

    let result: Vec<Row> = conn
        .query(&sql)
        .map_err(|e| format!("查询视图列表失败: {}", e))?;

    let views: Vec<String> = result
        .iter()
        .map(|row| {
            row.clone()
                .unwrap()
                .into_iter()
                .next()
                .and_then(|v| {
                    if let mysql::Value::Bytes(bytes) = v {
                        Some(String::from_utf8_lossy(&bytes).to_string())
                    } else {
                        None
                    }
                })
                .unwrap_or_else(|| String::from(""))
        })
        .collect();

    Ok(views)
}

#[tauri::command]
pub async fn get_view_definition(
    conn_id: String,
    database: String,
    view: String,
) -> Result<String, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 获取视图定义
    let result: Option<(String, String)> = conn
        .query_first(format!("SHOW CREATE VIEW `{}`", view))
        .map_err(|e| format!("查询视图定义失败: {}", e))?;

    match result {
        Some((_, definition)) => Ok(definition),
        None => Err(format!("获取视图定义失败")),
    }
}

#[tauri::command]
pub async fn create_view(
    conn_id: String,
    database: String,
    view: String,
    definition: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    let sql = format!("CREATE VIEW `{}` AS {}", view, definition);

    conn.query_drop(&sql)
        .map_err(|e| format!("创建视图失败: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn drop_view(
    conn_id: String,
    database: String,
    view: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    let sql = format!("DROP VIEW `{}`", view);

    conn.query_drop(&sql)
        .map_err(|e| format!("删除视图失败: {}", e))?;

    Ok(true)
}

// 存储过程和函数相关命令
#[derive(Debug, Serialize, Deserialize)]
pub struct RoutineInfo {
    pub name: String;
    pub routine_type: String; // PROCEDURE 或 FUNCTION
    pub definer: String,
    pub created: String,
    pub modified: String,
}

#[tauri::command]
pub async fn get_routines(
    conn_id: String,
    database: String,
) -> Result<Vec<RoutineInfo>, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    // 查询存储过程和函数
    let sql = format!(
        "SELECT ROUTINE_NAME, ROUTINE_TYPE, DEFINER, CREATED, MODIFIED 
         FROM INFORMATION_SCHEMA.ROUTINES 
         WHERE ROUTINE_SCHEMA = '{}'",
        database
    );

    let result: Vec<Row> = conn
        .query(&sql)
        .map_err(|e| format!("查询存储过程/函数列表失败: {}", e))?;

    let routines: Vec<RoutineInfo> = result
        .iter()
        .map(|row| {
            let values = row.clone().unwrap();
            let mut iter = values.into_iter();

            RoutineInfo {
                name: iter
                    .next()
                    .and_then(|v| extract_string(v))
                    .unwrap_or_default(),
                routine_type: iter
                    .next()
                    .and_then(|v| extract_string(v))
                    .unwrap_or_default(),
                definer: iter
                    .next()
                    .and_then(|v| extract_string(v))
                    .unwrap_or_default(),
                created: iter
                    .next()
                    .and_then(|v| extract_string(v))
                    .unwrap_or_default(),
                modified: iter
                    .next()
                    .and_then(|v| extract_string(v))
                    .unwrap_or_default(),
            }
        })
        .collect();

    Ok(routines)
}

#[tauri::command]
pub async fn get_routine_definition(
    conn_id: String,
    database: String,
    routine_name: String,
    routine_type: String,
) -> Result<String, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 获取存储过程或函数的定义
    let sql = format!("SHOW CREATE {} `{}`", routine_type, routine_name);

    let result: Option<(String, String)> = conn
        .query_first(&sql)
        .map_err(|e| format!("查询{}定义失败: {}", routine_type, e))?;

    match result {
        Some((_, definition)) => Ok(definition),
        None => Err(format!("获取{}定义失败", routine_type)),
    }
}

#[tauri::command]
pub async fn create_routine(
    conn_id: String,
    database: String,
    routine_type: String,
    routine_name: String,
    definition: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    let sql = format!("CREATE {} `{}` {}", routine_type, routine_name, definition);

    conn.query_drop(&sql)
        .map_err(|e| format!("创建{}失败: {}", routine_type, e))?;

    Ok(true)
}

#[tauri::command]
pub async fn drop_routine(
    conn_id: String,
    database: String,
    routine_name: String,
    routine_type: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE `{}`", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    let sql = format!("DROP {} IF EXISTS `{}`", routine_type, routine_name);

    conn.query_drop(&sql)
        .map_err(|e| format!("删除{}失败: {}", routine_type, e))?;

    Ok(true)
}

// EXPLAIN 相关命令
#[tauri::command]
pub async fn explain_query(
    conn_id: String,
    sql: String,
) -> Result<Vec<Vec<String>>, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    // 构建 EXPLAIN 语句
    let explain_sql = format!("EXPLAIN {}", sql);

    let result: Vec<Row> = conn
        .query(&explain_sql)
        .map_err(|e| format!("执行 EXPLAIN 失败: {}", e))?;

    let mut rows: Vec<Vec<String>> = Vec::new();

    for row in result {
        let row_data: Vec<String> = row
            .unwrap()
            .into_iter()
            .map(|value| match value {
                mysql::Value::NULL => String::from("NULL"),
                mysql::Value::Bytes(bytes) => String::from_utf8_lossy(&bytes).to_string(),
                mysql::Value::Int(i) => i.to_string(),
                mysql::Value::UInt(u) => u.to_string(),
                mysql::Value::Float(f) => f.to_string(),
                mysql::Value::Double(d) => d.to_string(),
                mysql::Value::Date(year, month, day, hour, minute, second, micros) => {
                    format!("{}-{:02}-{:02} {:02}:{:02}:{:02}.{:06}",
                        year, month, day, hour, minute, second, micros)
                }
                mysql::Value::Time(sign, days, hours, minutes, seconds, micros) => {
                    let sign_str = if sign { "-" } else { "" };
                    format!("{}{}d {:02}:{:02}:{:02}.{:06}",
                        sign_str, days, hours, minutes, seconds, micros)
                }
            })
            .collect();
        rows.push(row_data);
    }

    Ok(rows)
}

// 慢查询相关命令
#[tauri::command]
pub async fn get_slow_queries(
    conn_id: String,
) -> Result<Vec<Vec<String>>, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    // 查询慢查询日志状态
    let result: Vec<Row> = conn
        .query("SHOW VARIABLES LIKE 'slow_query_log%'")
        .map_err(|e| format!("查询慢查询配置失败: {}", e))?;

    let mut rows: Vec<Vec<String>> = Vec::new();

    for row in result {
        let row_data: Vec<String> = row
            .unwrap()
            .into_iter()
            .map(|value| match value {
                mysql::Value::NULL => String::from("NULL"),
                mysql::Value::Bytes(bytes) => String::from_utf8_lossy(&bytes).to_string(),
                mysql::Value::Int(i) => i.to_string(),
                mysql::Value::UInt(u) => u.to_string(),
                mysql::Value::Float(f) => f.to_string(),
                mysql::Value::Double(d) => d.to_string(),
                mysql::Value::Date(year, month, day, hour, minute, second, micros) => {
                    format!("{}-{:02}-{:02} {:02}:{:02}:{:02}.{:06}",
                        year, month, day, hour, minute, second, micros)
                }
                mysql::Value::Time(sign, days, hours, minutes, seconds, micros) => {
                    let sign_str = if sign { "-" } else { "" };
                    format!("{}{}d {:02}:{:02}:{:02}.{:06}",
                        sign_str, days, hours, minutes, seconds, micros)
                }
            })
            .collect();
        rows.push(row_data);
    }

    Ok(rows)
}

// �û�Ȩ�޹�������
#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfo {
    pub user: String,
    pub host: String,
}

#[tauri::command]
pub async fn get_users(
    conn_id: String,
) -> Result<Vec<UserInfo>, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("��ȡ���ӳ���ʧ��: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("���� ID '{}' ������", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("��ȡ���ݿ�����ʧ��: {}", e))?;

    let result: Vec<Row> = conn
        .query("SELECT user, host FROM mysql.user")
        .map_err(|e| format!("��ѯ�û��б�ʧ��: {}", e))?;

    let users: Vec<UserInfo> = result
        .iter()
        .map(|row| {
            let values = row.clone().unwrap();
            let mut iter = values.into_iter();

            UserInfo {
                user: iter
                    .next()
                    .and_then(|v| extract_string(v))
                    .unwrap_or_default(),
                host: iter
                    .next()
                    .and_then(|v| extract_string(v))
                    .unwrap_or_default(),
            }
        })
        .collect();

    Ok(users)
}

#[tauri::command]
pub async fn create_user(
    conn_id: String,
    username: String,
    host: String,
    password: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("��ȡ���ӳ���ʧ��: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("���� ID '{}' ������", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("��ȡ���ݿ�����ʧ��: {}", e))?;

    let sql = format!("CREATE USER '{}'@'{}' IDENTIFIED BY '{}'", username, host, password);

    conn.query_drop(&sql)
        .map_err(|e| format!("�����û�ʧ��: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn drop_user(
    conn_id: String,
    username: String,
    host: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("��ȡ���ӳ���ʧ��: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("���� ID '{}' ������", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("��ȡ���ݿ�����ʧ��: {}", e))?;

    let sql = format!("DROP USER '{}'@'{}'", username, host);

    conn.query_drop(&sql)
        .map_err(|e| format!("ɾ���û�ʧ��: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn grant_privilege(
    conn_id: String,
    username: String,
    host: String,
    database: String,
    privileges: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("��ȡ���ӳ���ʧ��: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("���� ID '{}' ������", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("��ȡ���ݿ�����ʧ��: {}", e))?;

    let sql = format!(
        "GRANT {} ON {}.* TO '{}'@'{}' WITH GRANT OPTION",
        privileges, database, username, host
    );

    conn.query_drop(&sql)
        .map_err(|e| format!("����Ȩ��ʧ��: {}", e))?;

    conn.query_drop("FLUSH PRIVILEGES")
        .map_err(|e| format!("ˢ��Ȩ��ʧ��: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn revoke_privilege(
    conn_id: String,
    username: String,
    host: String,
    database: String,
    privileges: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("��ȡ���ӳ���ʧ��: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("���� ID '{}' ������", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("��ȡ���ݿ�����ʧ��: {}", e))?;

    let sql = format!(
        "REVOKE {} ON {}.* FROM '{}'@'{}'",
        privileges, database, username, host
    );

    conn.query_drop(&sql)
        .map_err(|e| format!("����Ȩ��ʧ��: {}", e))?;

    conn.query_drop("FLUSH PRIVILEGES")
        .map_err(|e| format!("ˢ��Ȩ��ʧ��: {}", e))?;

    Ok(true)
}
// ���ݱ����������
#[tauri::command]
pub async fn backup_database(
    conn_id: String,
    database: String,
) -> Result<String, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("��ȡ���ӳ���ʧ��: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("���� ID '{}' ������", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("��ȡ���ݿ�����ʧ��: {}", e))?;

    // ��ȡ���б�
    let tables: Vec<String> = conn
        .query(format!("SHOW TABLES FROM {}", database))
        .map_err(|e| format!("��ѯ���б�ʧ��: {}", e))?;

    let mut backup_sql = format!("-- Database: {}\n-- Backup Date: {}\n\n", database, chrono::Local::now().format("%Y-%m-%d %H:%M:%S"));
    
    // ��Ӵ������ݿ����
    backup_sql.push_str(&format!("CREATE DATABASE IF NOT EXISTS {};\nUSE {};\n\n", database, database));

    // ����ÿ����
    for table in tables {
        backup_sql.push_str(&format!("-- Table: {}\n", table));
        
        // ��ȡ��ṹ
        let create_table: Option<(String, String)> = conn
            .query_first(format!("SHOW CREATE TABLE {}.{}", database, table))
            .map_err(|e| format!("��ȡ��ṹʧ��: {}", e))?;

        if let Some((_, ddl)) = create_table {
            backup_sql.push_str(&format!("DROP TABLE IF EXISTS {};\n", table));
            backup_sql.push_str(&format!("{};\n\n", ddl));
        }

        // ��ȡ������
        let data_rows: Vec<Row> = conn
            .query(format!("SELECT * FROM {}.{}", database, table))
            .map_err(|e| format!("��ѯ������ʧ��: {}", e))?;

        if data_rows.is_empty() {
            continue;
        }

        // ���� INSERT ���
        let columns: Vec<String> = data_rows[0].clone().unwrap()
            .into_iter()
            .map(|v| {
                if let mysql::Value::Bytes(bytes) = v {
                    String::from_utf8_lossy(&bytes).to_string()
                } else {
                    "unknown".to_string()
                }
            })
            .collect();

        for row in data_rows {
            let values: Vec<String> = row.unwrap().into_iter().map(|value| {
                match value {
                    mysql::Value::NULL => String::from("NULL"),
                    mysql::Value::Bytes(bytes) => {
                        let s = String::from_utf8_lossy(&bytes).to_string();
                        format!("'{}'", s.replace("\\", "\\\\").replace("'", "\\'"))
                    }
                    mysql::Value::Int(i) => i.to_string(),
                    mysql::Value::UInt(u) => u.to_string(),
                    mysql::Value::Float(f) => f.to_string(),
                    mysql::Value::Double(d) => d.to_string(),
                    mysql::Value::Date(year, month, day, hour, minute, second, micros) => {
                        format!("'{}-{:02}-{:02} {:02}:{:02}:{:02}.{:06}'",
                            year, month, day, hour, minute, second, micros)
                    }
                    mysql::Value::Time(sign, days, hours, minutes, seconds, micros) => {
                        let sign_str = if sign { "-" } else { "" };
                        format!("'{}{}d {:02}:{:02}:{:02}.{:06}'",
                            sign_str, days, hours, minutes, seconds, micros)
                    }
                }
            }).collect();

            backup_sql.push_str(&format!(
                "INSERT INTO {} ({}) VALUES ({});\n",
                table,
                columns.iter().map(|c| format!("{}", c)).collect::<Vec<_>>().join(", "),
                values.join(", ")
            ));
        }

        backup_sql.push_str("\n");
    }

    Ok(backup_sql)
}

#[tauri::command]
pub async fn restore_database(
    conn_id: String,
    sql: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("��ȡ���ӳ���ʧ��: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("���� ID '{}' ������", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("��ȡ���ݿ�����ʧ��: {}", e))?;

    // �ָ� SQL ��䲢ִ��
    let statements: Vec<&str> = sql.split(';')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && !s.starts_with("--"))
        .collect();

    for statement in statements {
        if statement.trim().is_empty() {
            continue;
        }
        
        conn.query_drop(statement)
            .map_err(|e| format!("ִ�� SQL ʧ��: {}\nSQL: {}", e, statement))?;
    }

    Ok(true)
}
// �����������
#[tauri::command]
pub async fn begin_transaction(
    conn_id: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("��ȡ���ӳ���ʧ��: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("���� ID '{}' ������", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("��ȡ���ݿ�����ʧ��: {}", e))?;

    conn.query_drop("BEGIN TRANSACTION")
        .map_err(|e| format!("��ʼ����ʧ��: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn commit_transaction(
    conn_id: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("��ȡ���ӳ���ʧ��: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("���� ID '{}' ������", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("��ȡ���ݿ�����ʧ��: {}", e))?;

    conn.query_drop("COMMIT")
        .map_err(|e| format!("�ύ����ʧ��: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn rollback_transaction(
    conn_id: String,
) -> Result<bool, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("��ȡ���ӳ���ʧ��: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("���� ID '{}' ������", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("��ȡ���ݿ�����ʧ��: {}", e))?;

    conn.query_drop("ROLLBACK")
        .map_err(|e| format!("�ع�����ʧ��: {}", e))?;

    Ok(true)
}
// ERͼ�������
#[derive(Debug, Serialize, Deserialize)]
pub struct ERTable {
    pub name: String,
    pub columns: Vec<ERColumn>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ERColumn {
    pub name: String,
    pub r#type: String,
    pub is_primary: bool,
    pub is_foreign: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ERRelation {
    pub from_table: String,
    pub from_column: String,
    pub to_table: String,
    pub to_column: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ERDiagram {
    pub database: String,
    pub tables: Vec<ERTable>,
    pub relations: Vec<ERRelation>,
}

#[tauri::command]
pub async fn get_er_diagram(
    conn_id: String,
    database: String,
) -> Result<ERDiagram, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("��ȡ���ӳ���ʧ��: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("���� ID '{}' ������", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("��ȡ���ݿ�����ʧ��: {}", e))?;

    // ��ȡ���б�
    let table_names: Vec<String> = conn
        .query(format!("SHOW TABLES FROM {}", database))
        .map_err(|e| format!("��ѯ���б�ʧ��: {}", e))?;

    let mut tables: Vec<ERTable> = Vec::new();

    // ��ȡÿ���������Ϣ
    for table in &table_names {
        let columns_result: Vec<Row> = conn
            .query(format!("SHOW COLUMNS FROM {}.{}", database, table))
            .map_err(|e| format!("��ѯ��ṹʧ��: {}", e))?;

        let mut columns: Vec<ERColumn> = Vec::new();

        for row in &columns_result {
            let values = row.clone().unwrap();
            let mut iter = values.into_iter();

            let name = iter
                .next()
                .and_then(|v| extract_string(v))
                .unwrap_or_default();
            let _type = iter
                .next()
                .and_then(|v| extract_string(v))
                .unwrap_or_default();
            let _nullable = iter
                .next()
                .and_then(|v| extract_string(v))
                .unwrap_or_default();
            let key = iter
                .next()
                .and_then(|v| extract_string(v))
                .unwrap_or_default();

            columns.push(ERColumn {
                name,
                r#type: _type,
                is_primary: key == "PRI",
                is_foreign: key == "MUL",
            });
        }

        tables.push(ERTable {
            name: table.clone(),
            columns,
        });
    }

    // ��ȡ���������ϵ
    let sql = format!(
        "SELECT 
            TABLE_NAME,
            COLUMN_NAME,
            REFERENCED_TABLE_NAME,
            REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = '{}' AND REFERENCED_TABLE_NAME IS NOT NULL",
        database
    );

    let result: Vec<Row> = conn
        .query(&sql)
        .map_err(|e| format!("��ѯ�����ϵʧ��: {}", e))?;

    let mut relations: Vec<ERRelation> = Vec::new();

    for row in result {
        let values = row.unwrap();
        let mut iter = values.into_iter();

        let from_table = iter
            .next()
            .and_then(|v| extract_string(v))
            .unwrap_or_default();
        let from_column = iter
            .next()
            .and_then(|v| extract_string(v))
            .unwrap_or_default();
        let to_table = iter
            .next()
            .and_then(|v| extract_string(v))
            .unwrap_or_default();
        let to_column = iter
            .next()
            .and_then(|v| extract_string(v))
            .unwrap_or_default();

        relations.push(ERRelation {
            from_table,
            from_column,
            to_table,
            to_column,
        });
    }

    Ok(ERDiagram {
        database,
        tables,
        relations,
    })
}
// ����ͬ���������
#[derive(Debug, Serialize, Deserialize)]
pub struct ReplicationStatus {
    pub master_status: ReplicationMasterStatus,
    pub slave_status: ReplicationSlaveStatus,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplicationMasterStatus {
    pub file: String,
    pub position: String,
    pub binlog_do_db: String,
    pub binlog_ignore_db: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplicationSlaveStatus {
    pub slave_io_state: String,
    pub slave_io_running: bool,
    pub slave_sql_running: bool,
    pub last_error: String,
    pub seconds_behind_master: i64,
    pub master_host: String,
    pub master_port: u16,
    pub master_log_file: String,
    pub master_log_pos: String,
}

#[tauri::command]
pub async fn get_replication_status(
    conn_id: String,
) -> Result<ReplicationStatus, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("��ȡ���ӳ���ʧ��: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("���� ID '{}' ������", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("��ȡ���ݿ�����ʧ��: {}", e))?;

    // ��ȡ����״̬
    let master_result: Option<(String, String, String, String)> = conn
        .query_first("SHOW MASTER STATUS")
        .map_err(|e| format!("��ѯ����״̬ʧ��: {}", e))?;

    let master_status = if let Some((file, position, binlog_do_db, binlog_ignore_db)) = master_result {
        ReplicationMasterStatus {
            file,
            position,
            binlog_do_db,
            binlog_ignore_db,
        }
    } else {
        ReplicationMasterStatus {
            file: String::new(),
            position: String::new(),
            binlog_do_db: String::new(),
            binlog_ignore_db: String::new(),
        }
    };

    // ��ȡ�ӿ�״̬
    let slave_result: Option<Row> = conn
        .query_first("SHOW SLAVE STATUS")
        .map_err(|e| format!("��ѯ�ӿ�״̬ʧ��: {}", e))?;

    let slave_status = if let Some(row) = slave_result {
        let values = row.unwrap();
        let mut iter = values.into_iter();
        
        // �� SHOW SLAVE STATUS ��12���ֶ�����ȡ�ؼ���Ϣ
        // �ֶ�˳��Slave_IO_State, Slave_IO_Running, Slave_SQL_Running, Last_Errno, Last_Error, Skip_Counter, Exec_Master_Log_Pos, Relay_Log_Pos, Relay_Master_Log_File, Relay_Log_Pos, Seconds_Behind_Master, Master_Log_File, Read_Master_Log_Pos, Relay_Log_Space, Until_Condition, Until_Log_File, Until_Log_Pos
        let _ = iter.next(); // Slave_IO_State
        let slave_io_running = iter.next().and_then(|v| extract_string(v)).unwrap_or_else(|| "No") == "Yes";
        let _ = iter.next(); // Slave_SQL_Running
        let slave_sql_running = iter.next().and_then(|v| extract_string(v)).unwrap_or_else(|| "No") == "Yes";
        let _ = iter.next(); // Last_Errno
        let last_error = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _ = iter.next(); // Skip_Counter
        let _ = iter.next(); // Exec_Master_Log_Pos
        let _ = iter.next(); // Relay_Log_Pos
        let _ = iter.next(); // Relay_Master_Log_File
        let _ = iter.next(); // Relay_Log_Pos
        let seconds_behind_master = iter.next().and_then(|v| {
            if let mysql::Value::ULong(n) = v {
                Some(n as i64)
            } else {
                None
            }
        }).unwrap_or(0);
        let _ = iter.next(); // Master_Log_File
        let _ = iter.next(); // Read_Master_Log_Pos
        
        ReplicationSlaveStatus {
            slave_io_state: "Running".to_string(),
            slave_io_running,
            slave_sql_running,
            last_error,
            seconds_behind_master,
            master_host: String::new(),
            master_port: 3306,
            master_log_file: String::new(),
            master_log_pos: String::new(),
        }
    } else {
        ReplicationSlaveStatus {
            slave_io_state: "Not configured".to_string(),
            slave_io_running: false,
            slave_sql_running: false,
            last_error: String::new(),
            seconds_behind_master: 0,
            master_host: String::new(),
            master_port: 3306,
            master_log_file: String::new(),
            master_log_pos: String::new(),
        }
    };

    Ok(ReplicationStatus {
        master_status,
        slave_status,
    })
// 数据对比相关命令
#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnDiff {
    pub column_name: String,
    pub change_type: String, // added, removed, modified, same
    pub old_value: Option<String>,
    pub new_value: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableStructureDiff {
    pub table_name: String,
    pub column_diffs: Vec<ColumnDiff>,
    pub summary: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DataRowDiff {
    pub primary_key: String,
    pub column_name: String,
    pub change_type: String,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableDataDiff {
    pub table_name: String,
    pub row_diffs: Vec<DataRowDiff>,
    pub summary: String,
}

#[tauri::command]
pub async fn compare_table_structure(
    conn_id: String,
    database: String,
    table1: String,
    table2: String,
) -> Result<TableStructureDiff, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE {}", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 获取两个表的列信息
    let columns1: Vec<Row> = conn
        .query(format!("SHOW COLUMNS FROM {}", table1))
        .map_err(|e| format!("查询表 {} 列信息失败: {}", table1, e))?;

    let columns2: Vec<Row> = conn
        .query(format!("SHOW COLUMNS FROM {}", table2))
        .map_err(|e| format!("查询表 {} 列信息失败: {}", table2, e))?;

    let mut column_map1: HashMap<String, Vec<String>> = HashMap::new();
    let mut column_map2: HashMap<String, Vec<String>> = HashMap::new();

    for row in &columns1 {
        let values = row.clone().unwrap();
        let mut iter = values.into_iter();
        let name = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _type = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let nullable = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let key = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _default = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _extra = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        column_map1.insert(name.clone(), vec![name, _type, nullable, key, _default, _extra]);
    }

    for row in &columns2 {
        let values = row.clone().unwrap();
        let mut iter = values.into_iter();
        let name = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _type = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let nullable = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let key = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _default = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        let _extra = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
        column_map2.insert(name.clone(), vec![name, _type, nullable, key, _default, _extra]);
    }

    let mut diffs: Vec<ColumnDiff> = Vec::new();
    let mut columns1_set: HashSet<String> = column_map1.keys().cloned().collect();
    let mut columns2_set: HashSet<String> = column_map2.keys().cloned().collect();

    // 检查新增的列（在表2中但不在表1中）
    for col in &columns2_set {
        if !columns1_set.contains(col) {
            diffs.push(ColumnDiff {
                column_name: col.clone(),
                change_type: "added".to_string(),
                old_value: None,
                new_value: Some(column_map2.get(col).map(|v| v.join(", ")).unwrap_or_default()),
            });
        }
    }

    // 检查删除的列（在表1中但不在表2中）
    for col in &columns1_set {
        if !columns2_set.contains(col) {
            diffs.push(ColumnDiff {
                column_name: col.clone(),
                change_type: "removed".to_string(),
                old_value: Some(column_map1.get(col).map(|v| v.join(", ")).unwrap_or_default()),
                new_value: None,
            });
        }
    }

    // 检查修改的列
    for col in &columns1_set {
        if columns2_set.contains(col) {
            let info1 = column_map1.get(col).unwrap();
            let info2 = column_map2.get(col).unwrap();
            
            if info1[1] != info2[1] || info1[2] != info2[2] {
                diffs.push(ColumnDiff {
                    column_name: col.clone(),
                    change_type: "modified".to_string(),
                    old_value: Some(info1.join(", ")),
                    new_value: Some(info2.join(", ")),
                });
            }
        }
    }

    let summary = format!(
        "对比完成: {} 个差异 (新增: {}, 删除: {}, 修改: {})",
        diffs.len(),
        diffs.iter().filter(|d| d.change_type == "added").count(),
        diffs.iter().filter(|d| d.change_type == "removed").count(),
        diffs.iter().filter(|d| d.change_type == "modified").count()
    );

    Ok(TableStructureDiff {
        table_name: format!("{} vs {}", table1, table2),
        column_diffs: diffs,
        summary,
    })
}

#[tauri::command]
pub async fn compare_table_data(
    conn_id: String,
    database: String,
    table1: String,
    table2: String,
) -> Result<TableDataDiff, String> {
    let connections = CONNECTIONS.lock().map_err(|e| {
        format!("获取连接池锁失败: {}", e)
    })?;

    let pool = connections
        .get(&conn_id)
        .ok_or_else(|| format!("连接 ID '{}' 不存在", conn_id))?;

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.query_drop(format!("USE {}", database))
        .map_err(|e| format!("切换数据库失败: {}", e))?;

    // 获取两个表的主键列
    let pk1: Vec<Row> = conn
        .query(format!("SHOW KEYS FROM {} WHERE Key_name = 'PRIMARY'", table1))
        .map_err(|e| format!("查询表 {} 主键失败: {}", table1, e))?;

    let pk2: Vec<Row> = conn
        .query(format!("SHOW KEYS FROM {} WHERE Key_name = 'PRIMARY'", table2))
        .map_err(|e| format!("查询表 {} 主键失败: {}", table2, e))?;

    let get_primary_key_column = |result: Vec<Row>| -> String| {
        for row in result {
            let values = row.unwrap();
            let mut iter = values.into_iter();
            let _table = iter.next();
            let _non_unique = iter.next();
            let key_name = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
            let column_name = iter.next().and_then(|v| extract_string(v)).unwrap_or_default();
            if key_name == "PRIMARY" {
                return column_name;
            }
        }
        "id".to_string()
    };

    let pk_col1 = get_primary_key_column(pk1);
    let pk_col2 = get_primary_key_column(pk2);

    // 获取两个表的数据
    let rows1: Vec<Row> = conn
        .query(format!("SELECT * FROM {} ORDER BY {} LIMIT 100", table1, pk_col1))
        .map_err(|e| format!("查询表 {} 数据失败: {}", table1, e))?;

    let rows2: Vec<Row> = conn
        .query(format!("SELECT * FROM {} ORDER BY {} LIMIT 100", table2, pk_col2))
        .map_err(|e| format!("查询表 {} 数据失败: {}", table2, e))?;

    let mut diffs: Vec<DataRowDiff> = Vec::new();

    // 简单的数据对比：比较行数
    let count1 = rows1.len();
    let count2 = rows2.len();

    if count1 != count2 {
        diffs.push(DataRowDiff {
            primary_key: "-".to_string(),
            column_name: "行数".to_string(),
            change_type: "row_count_diff".to_string(),
            old_value: Some(count1.to_string()),
            new_value: Some(count2.to_string()),
        });
    }

    // 比较数据内容（基于主键）
    let mut data1: HashMap<String, Vec<String>> = HashMap::new();
    let mut data2: HashMap<String, Vec<String>> = HashMap::new();

    for row in rows1 {
        let values = row.unwrap();
        let key = values[0].and_then(|v| extract_string(v)).unwrap_or_default();
        let row_data: Vec<String> = values.into_iter().map(|v| extract_string(v).unwrap_or_default()).collect();
        data1.insert(key, row_data);
    }

    for row in rows2 {
        let values = row.unwrap();
        let key = values[0].and_then(|v| extract_string(v)).unwrap_or_default();
        let row_data: Vec<String> = values.into_iter().map(|v| extract_string(v).unwrap_or_default()).collect();
        data2.insert(key, row_data);
    }

    // 找出只在表1中存在的数据
    for key in data1.keys() {
        if !data2.contains_key(&key) {
            diffs.push(DataRowDiff {
                primary_key: key.clone(),
                column_name: "行".to_string(),
                change_type: "removed".to_string(),
                old_value: Some(data1.get(&key).unwrap().join(", ")),
                new_value: None,
            });
        }
    }

    // 找出只在表2中存在的数据
    for key in data2.keys() {
        if !data1.contains_key(&key) {
            diffs.push(DataRowDiff {
                primary_key: key.clone(),
                column_name: "行".to_string(),
                change_type: "added".to_string(),
                old_value: None,
                new_value: Some(data2.get(&key).unwrap().join(", ")),
            });
        }
    }

    let summary = format!(
        "数据对比完成: {} 个差异 (总差异行数: {})",
        diffs.len(),
        diffs.len()
    );

    Ok(TableDataDiff {
        table_name: format!("{} vs {}", table1, table2),
        row_diffs: diffs,
        summary,
    })
}
