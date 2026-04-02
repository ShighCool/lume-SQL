use redis::Client;

fn main() {
    println!("开始测试 Redis 连接...");
    println!("连接到: 175.27.157.212:6379\n");

    // 创建 Redis 客户端
    println!("步骤 1: 创建 Client...");
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

    // 获取连接
    println!("步骤 2: 获取连接...");
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

    // 测试 PING
    println!("步骤 3: 测试 PING...");
    match redis::cmd("PING").query::<String>(&mut conn) {
        Ok(pong) => println!("✓ PING 成功: {}\n", pong),
        Err(e) => println!("✗ PING 失败: {}\n", e),
    }

    // 获取所有 keys
    println!("步骤 4: 获取所有 keys (pattern: *)...");
    let keys: Vec<String> = match redis::cmd("KEYS").arg("*").query::<Vec<String>>(&mut conn) {
        Ok(k) => {
            println!("✓ 找到 {} 个 keys\n", k.len());
            k
        }
        Err(e) => {
            println!("✗ 获取 keys 失败: {}\n", e);
            return;
        }
    };

    if keys.is_empty() {
        println!("数据库是空的，没有找到任何 keys");
    } else {
        println!("Keys 列表:");
        for (i, key) in keys.iter().enumerate() {
            println!("  [{}]: '{}'", i, key);
        }
    }

    println!("\n测试完成！");
}