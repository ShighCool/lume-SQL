// 测试表右键菜单功能
// 注意：这只是一个测试脚本，需要修改 src-tauri/src/lib.rs 来添加测试命令

#[tauri::command]
async fn test_table_menu_functions(conn_id: String, database: String) -> Result<String, String> {
    let mut results = String::new();

    // 1. 创建测试表
    let create_table_sql = r#"
        CREATE TABLE IF NOT EXISTS `test_menu_table` (
            `id` INT NOT NULL AUTO_INCREMENT,
            `name` VARCHAR(100) NOT NULL,
            `email` VARCHAR(255),
            `age` INT,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            `status` ENUM('active', 'inactive') DEFAULT 'active',
            `score` DECIMAL(10, 2) DEFAULT 0.00,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    "#;

    results.push_str("=== 测试表右键菜单功能 ===\\n\\n");

    // 2. 测试查看表 DDL
    match crate::commands::mysql::get_table_ddl(conn_id.clone(), database.clone(), "test_menu_table".to_string()) {
        Ok(ddl) => {
            results.push_str("✅ 查看表 DDL - 成功\\n");
            results.push_str(&format!("DDL: {}\\n\\n", ddl));
        }
        Err(e) => {
            results.push_str(&format!("❌ 查看表 DDL - 失败: {}\\n\\n", e));
        }
    }

    // 3. 测试导出表结构
    match crate::commands::mysql::export_table_structure(conn_id.clone(), database.clone(), "test_menu_table".to_string()) {
        Ok(sql) => {
            results.push_str("✅ 导出表结构 - 成功\\n");
            results.push_str(&format!("SQL: {}\\n\\n", sql));
        }
        Err(e) => {
            results.push_str(&format!("❌ 导出表结构 - 失败: {}\\n\\n", e));
        }
    }

    // 4. 测试生成随机数据
    match crate::commands::mysql::generate_random_data(conn_id.clone(), database.clone(), "test_menu_table".to_string(), 5) {
        Ok(count) => {
            results.push_str(&format!("✅ 生成随机数据 - 成功，生成 {} 条\\n\\n", count));
        }
        Err(e) => {
            results.push_str(&format!("❌ 生成随机数据 - 失败: {}\\n\\n", e));
        }
    }

    // 5. 测试导出表结构和数据
    match crate::commands::mysql::export_table_data(conn_id.clone(), database.clone(), "test_menu_table".to_string()) {
        Ok(sql) => {
            results.push_str("✅ 导出表结构和数据 - 成功\\n");
            results.push_str(&format!("SQL 长度: {} 字符\\n\\n", sql.len()));
        }
        Err(e) => {
            results.push_str(&format!("❌ 导出表结构和数据 - 失败: {}\\n\\n", e));
        }
    }

    // 6. 测试复制表
    match crate::commands::mysql::copy_table(conn_id.clone(), database.clone(), "test_menu_table".to_string(), "test_menu_table_copy".to_string()) {
        Ok(_) => {
            results.push_str("✅ 复制表 - 成功\\n\\n");
        }
        Err(e) => {
            results.push_str(&format!("❌ 复制表 - 失败: {}\\n\\n", e));
        }
    }

    // 7. 测试修改字段
    match crate::commands::mysql::modify_column(conn_id.clone(), database.clone(), "test_menu_table_copy".to_string(), "name".to_string(), "VARCHAR(200) NOT NULL".to_string()) {
        Ok(_) => {
            results.push_str("✅ 修改字段 - 成功\\n\\n");
        }
        Err(e) => {
            results.push_str(&format!("❌ 修改字段 - 失败: {}\\n\\n", e));
        }
    }

    // 8. 测试添加字段
    match crate::commands::mysql::add_column(conn_id.clone(), database.clone(), "test_menu_table_copy".to_string(), "phone".to_string(), "VARCHAR(20)".to_string()) {
        Ok(_) => {
            results.push_str("✅ 添加字段 - 成功\\n\\n");
        }
        Err(e) => {
            results.push_str(&format!("❌ 添加字段 - 失败: {}\\n\\n", e));
        }
    }

    // 9. 测试删除字段
    match crate::commands::mysql::drop_column(conn_id.clone(), database.clone(), "test_menu_table_copy".to_string(), "phone".to_string()) {
        Ok(_) => {
            results.push_str("✅ 删除字段 - 成功\\n\\n");
        }
        Err(e) => {
            results.push_str(&format!("❌ 删除字段 - 失败: {}\\n\\n", e));
        }
    }

    // 10. 测试删除表
    match crate::commands::mysql::drop_table(conn_id.clone(), database.clone(), "test_menu_table_copy".to_string()) {
        Ok(_) => {
            results.push_str("✅ 删除表 - 成功\\n\\n");
        }
        Err(e) => {
            results.push_str(&format!("❌ 删除表 - 失败: {}\\n\\n", e));
        }
    }

    // 11. 测试获取表数据
    match crate::commands::mysql::get_mysql_table_data(conn_id.clone(), database.clone(), "test_menu_table".to_string(), 1, 10, None) {
        Ok(data) => {
            results.push_str(&format!("✅ 获取表数据 - 成功，共 {} 条记录，当前页 {} 列 {} 行\\n\\n", data.total, data.columns.len(), data.rows.len()));
        }
        Err(e) => {
            results.push_str(&format!("❌ 获取表数据 - 失败: {}\\n\\n", e));
        }
    }

    // 12. 测试获取表结构
    match crate::commands::mysql::get_mysql_table_schema(conn_id.clone(), database.clone(), "test_menu_table".to_string()) {
        Ok(schema) => {
            results.push_str(&format!("✅ 获取表结构 - 成功，共 {} 个字段\\n\\n", schema.len()));
        }
        Err(e) => {
            results.push_str(&format!("❌ 获取表结构 - 失败: {}\\n\\n", e));
        }
    }

    results.push_str("=== 测试完成 ===\\n");

    Ok(results)
}