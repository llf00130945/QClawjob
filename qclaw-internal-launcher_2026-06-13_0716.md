# QClaw 内部启动方案

## 背景
用户反馈双击 `start.bat` 无法启动后端服务（QClaw 重启后）。

## 根因
`start.bat` 中 `netstat` 解析 PID 的逻辑有 bug（`tokens=5` 取到的是地址而非 PID），导致旧进程未被清理，端口冲突。

## 解决方案
改为在 QClaw 内部启动，提供两种启动方式：

### 1. PowerShell 脚本（推荐）
文件：`F:\Qclawjob\start-server.ps1`

```powershell
cd F:\Qclawjob
.\start-server.ps1 start    # 启动
.\start-server.ps1 stop     # 停止
.\start-server.ps1 restart  # 重启
.\start-server.ps1 status   # 状态
```

特点：
- 自动检测并清理端口 3000 上的旧进程
- 显示彩色状态信息
- 健康检查自动验证服务启动
- 支持 PID 文件追踪

### 2. Node.js Launcher
文件：`F:\Qclawjob\launcher.js`

```bash
cd F:\Qclawjob
node launcher.js start   # 启动
node launcher.js stop    # 停止
node launcher.js status  # 状态
```

特点：
- 跨平台（Windows/Linux/Mac）
- 后台运行（detached mode）
- 自动健康检查

## 验证结果
- 服务器启动成功，PID 5024
- Gateway 端口 50233 自动检测
- `/api/agents` 返回两个智能体：
  - 🏗 企业工程管理总监（agent-168feb0f）
  - 🏆 工程创优专家（agent-2e63987e）
- 前端地址：http://localhost:3000

## 新增/修改文件
- `F:\Qclawjob\start-server.ps1` — 新建，PowerShell 启动脚本
- `F:\Qclawjob\launcher.js` — 新建，Node.js 启动器
- `F:\Qclawjob\README.md` — 新建，使用说明
- `F:\Qclawjob\start.bat` — 保留但不再推荐使用
