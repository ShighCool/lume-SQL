## 任务
生成 `src/types/database.ts`

## 要求
定义以下 TypeScript 类型：
- ConnectionConfig：数据库连接配置（支持 mysql/redis/mongodb）
- Connection：连接对象（包含 id、name、type、config、status）
- QueryResult：SQL 查询结果（columns、rows、affectedRows、executionTime）
- RedisKeyInfo：Redis Key 信息（key、type、ttl、size）
- MongoDocument：MongoDB 文档（_id 和任意其他字段）

## 输出
只输出完整的代码文件内容，不要额外解释。