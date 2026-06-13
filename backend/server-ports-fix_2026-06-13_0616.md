# Gateway 端口自动检测修复总结

## 问题
QClaw Gateway 端口每次重启都会动态分配（61299/60063/其他），server.js 硬编码端口导致频繁失效。

## 根因
1. `openclaw gateway status` 退出码为 1，`execSync` 直接抛出异常，try-catch 静默吞掉错误
2. 改用 `spawnSync` 后，命令执行超时（5s）只捕获 131 字节片段，不包含 `port=` 字段
3. 独立运行时同样命令能捕获 424 字节（CPU 竞争少），说明是资源竞争导致的速度差异

## 最终方案
三层检测（按优先级）：
1. **读配置文件** `~/.qclaw/openclaw.json` → `gateway.port` 字段（最快，O(1)）
2. **`openclaw gateway status`**（超时 15s，慢但可靠）
3. **netstat + tasklist** 找 QClaw.exe 监听端口（终极 fallback）

## 结果
- 端口正确检测：61299 ✓
- `/api/status` 返回 connected ✓
- `/api/agents` 返回两个智能体列表 ✓
- `/api/chat` SSE 流式对话 ✓
- 每 30s 自动重检端口变化
