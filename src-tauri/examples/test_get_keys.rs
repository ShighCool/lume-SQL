use redis::Client;
use serde_json::json;

fn main() {
    println!("=== 测试 get_redis_keys 函数 ===\n");

    let client = match Client::open("redis://175.27.157.212:6379") {
        Ok(c) => c,
        Err(e) => {
            println!("✗ Client 创建失败: {}", e);
            return;
        }
    };

    let mut conn = match client.get_connection() {
        Ok(c) => c,
        Err(e) => {
            println!("✗ 连接失败: {}", e);
            return;
        }
    };

    println!("✓ 连接成功\n");

    // 模拟 get_redis_keys 函数
    let conn_id = "test_connection".to_string();
    let pattern = "*".to_string();
    let limit = Some(100);
    let cursor = Some(0);

    println!("输入参数:");
    println!("  conn_id: {}", conn_id);
    println!("  pattern: {}", pattern);
    println!("  limit: {:?}", limit);
    println!("  cursor: {:?}", cursor);

    println!("\n步骤 1: 执行 SCAN 命令...");
    let limit_val = limit.unwrap_or(100);
    let cursor_val = cursor.unwrap_or(0);

    let result: (usize, Vec<String>) = match redis::cmd("SCAN")
        .arg(cursor_val)
        .arg("MATCH")
        .arg(&pattern)
        .arg("COUNT")
        .arg(limit_val * 2)
        .query(&mut conn) {
            Ok(r) => r,
            Err(e) => {
                println!("✗ SCAN 失败: {}", e);
                return;
            }
        };

    let (next_cursor, mut keys) = result;

    if keys.len() > limit_val {
        keys.truncate(limit_val);
    }

    println!("✓ SCAN 成功");
    println!("  找到 {} 个 keys", keys.len());
    println!("  下一个 cursor: {}", next_cursor);

    println!("\n步骤 2: 构建响应...");
    let response = json!({
        "keys": keys,
        "cursor": next_cursor,
        "has_more": next_cursor != 0
    });

    println!("响应 JSON: {}", response);

    println!("\n步骤 3: 序列化...");
    let json_string = match serde_json::to_string(&response) {
        Ok(s) => s,
        Err(e) => {
            println!("✗ 序列化失败: {}", e);
            return;
        }
    };

    println!("✓ 序列化成功");
    println!("JSON 字符串长度: {}", json_string.len());

    println!("\n步骤 4: 反序列化（模拟前端）...");
    let parsed: serde_json::Value = match serde_json::from_str(&json_string) {
        Ok(v) => v,
        Err(e) => {
            println!("✗ 反序列化失败: {}", e);
            return;
        }
    };

    println!("✓ 反序列化成功");

    // 检查 keys 字段
    if let Some(keys_value) = parsed.get("keys") {
        println!("\n检查 keys 字段:");
        println!("  类型: {}", keys_value);
        if let Some(keys_array) = keys_value.as_array() {
            println!("  ✓ 是数组");
            println!("  长度: {}", keys_array.len());
        } else {
            println!("  ✗ 不是数组！");
        }
    } else {
        println!("\n✗ keys 字段不存在！");
    }

    // 测试访问 length
    println!("\n步骤 5: 测试访问 keys.length...");
    if let Some(keys_value) = parsed.get("keys") {
        if let Some(keys_array) = keys_value.as_array() {
            let length = keys_array.len();
            println!("✓ 成功获取 keys.length: {}", length);
        } else {
            println!("✗ keys 不是数组，无法获取 length");
        }
    }

    println!("\n=== 测试完成 ===");
}
