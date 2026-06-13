# QClaw Agent Frontend

## 启动方式（推荐：在 QClaw 中启动）

### 方法 1：PowerShell 脚本（推荐）

在 QClaw 中执行以下命令：

```powershell
cd F:\Qclawjob
.\start-server.ps1 start    # 启动服务
.\start-server.ps1 stop     # 停止服务
.\start-server.ps1 restart  # 重启服务
.\start-server.ps1 status   # 查看状态
```

### 方法 2：Node.js Launcher

```bash
cd F:\Qclawjob
node launcher.js start   # 启动
node launcher.js stop    # 停止
node launcher.js status  # 状态
```

### 方法 3：直接启动（调试）

```bash
cd F:\Qclawjob\backend
node server.js
```

## 访问地址

启动成功后，打开浏览器访问：
- **http://localhost:3000**

## 功能

- 多智能体切换（企业工程管理总监 / 工程创优专家）
- SSE 流式对话
- 文件上传（支持 txt/pdf/doc/xlsx 等格式）
- 自动检测 QClaw Gateway 端口

## 文件说明

| 文件 | 说明 |
|------|------|
| `start-server.ps1` | PowerShell 启动脚本（推荐） |
| `launcher.js` | Node.js 启动器 |
| `backend/server.js` | 后端服务 |
| `public/index.html` | 前端页面 |
| `start.bat` | 旧版批处理启动脚本（可能因系统安全策略无法正常工作） |
