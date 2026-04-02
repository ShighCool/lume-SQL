use redis::Client;
use serde_json::json;

fn main() {
    println!("=== 完整数据流测试 ===\n");
    println!("连接到: 175.27.157.212:6379\n");

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

    // 测试 SCAN 命令（模拟后端代码）
    println!("步骤 1: 执行 SCAN 命令...");
    let cursor: usize = 0;
    let limit: usize = 100;
    let pattern = "*";

    let result: (usize, Vec<String>) = match redis::cmd("SCAN")
        .arg(cursor)
        .arg("MATCH")
        .arg(pattern)
        .arg("COUNT")
        .arg(limit * 2)
        .query(&mut conn) {
            Ok(r) => r,
            Err(e) => {
                println!("✗ SCAN 失败: {}", e);
                return;
            }
        };

    let (next_cursor, mut keys) = result;

    // 限制返回数量
    if keys.len() > limit {
        keys.truncate(limit);
    }

    println!("✓ SCAN 成功");
    println!("  next_cursor: {}", next_cursor);
    println!("  keys 数量: {}", keys.len());

    // 构建响应（模拟后端代码）
    println!("\n步骤 2: 构建 JSON 响应...");
    let response = json!({
        "keys": keys,
        "cursor": next_cursor,
        "has_more": next_cursor != 0
    });

    println!("✓ JSON 构建成功");
    println!("  响应 JSON: {}", response);

    // 序列化
    println!("\n步骤 3: 序列化 JSON...");
    let json_string = match serde_json::to_string(&response) {
        Ok(s) => s,
        Err(e) => {
            println!("✗ 序列化失败: {}", e);
            return;
        }
    };

    println!("✓ 序列化成功");
    println!("  JSON 字符串长度: {}", json_string.len());
    println!("  JSON 字符串（前 200 字符）: {}...", &json_string[..json_string.len().min(200)]);

    // 反序列化（模拟前端接收）
    println!("\n步骤 4: 反序列化 JSON...");
    let parsed: serde_json::Value = match serde_json::from_str(&json_string) {
        Ok(v) => v,
        Err(e) => {
            println!("✗ 反序列化失败: {}", e);
            return;
        }
    };

    println!("✓ 反序列化成功");
    println!("  类型: {}", parsed);

    // 检查结构
    if let Some(obj) = parsed.as_object() {
        println!("\n步骤 5: 检查响应结构...");
        if let Some(keys) = obj.get("keys") {
            println!("  ✓ keys 字段存在");
            println!("    keys 类型: {}", keys);
            if let Some(keys_array) = keys.as_array() {
                println!("    keys 是数组，长度: {}", keys_array.len());
            } else {
                println!("    ✗ keys 不是数组！");
            }
        } else {
            println!("  ✗ keys 字段不存在！");
        }

        if let Some(cursor) = obj.get("cursor") {
            println!("  ✓ cursor 字段存在: {}", cursor);
        } else {
            println!("  ✗ cursor 字段不存在！");
        }

        if let Some(has_more) = obj.get("has_more") {
            println!("  ✓ has_more 字段存在: {}", has_more);
        } else {
            println!("  ✗ has_more 字段不存在！");
        }
    }

    println!("\n=== 测试完成 ===");
}