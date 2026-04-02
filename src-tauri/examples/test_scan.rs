use redis::Client;

fn main() {
    println!("开始测试 Redis SCAN 命令...");
    println!("连接到: 175.27.157.212:6379\n");

    let client = match Client::open("redis://175.27.157.212:6379") {
        Ok(c) => {
            println!("✓ Client 创建成功\n");
            c
        }
        Err(e) => {
            println!("✗ Client 创建失败: {}\n", e);
            return;
        }
    };

    let mut conn = match client.get_connection() {
        Ok(c) => {
            println!("✓ 连接成功\n");
            c
        }
        Err(e) => {
            println!("✗ 连接失败: {}\n", e);
            return;
        }
    };

    // 测试 SCAN 命令
    println!("步骤 1: 测试 SCAN 命令...");
    let cursor: usize = 0;
    let limit: usize = 100;
    
    let result: (usize, Vec<String>) = match redis::cmd("SCAN")
        .arg(cursor)
        .arg("MATCH")
        .arg("*")
        .arg("COUNT")
        .arg(limit * 2)
        .query(&mut conn) {
            Ok(r) => {
                println!("✓ SCAN 成功\n");
                r
            }
            Err(e) => {
                println!("✗ SCAN 失败: {}\n", e);
                return;
            }
        };

    let (next_cursor, keys) = result;
    println!("结果:");
    println!("  next_cursor: {}", next_cursor);
    println!("  keys 数量: {}", keys.len());
    println!("  keys 类型: {:?}", std::any::type_name_of_val(&keys));
    
    if !keys.is_empty() {
        println!("  keys[0]: '{}'", keys[0]);
    }

    println!("\n测试完成！");
}