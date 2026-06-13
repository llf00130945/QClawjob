# 最终状态：企业工程管理总监前端服务

## 目录结构

```
F:\Qclawjob\
├── start.bat                 ← 一键启动脚本（双击启动）
├── public\
│   └── index.html            ← 前端聊天界面（深色主题，SSE 流式）
├── backend\
│   ├── server.js             ← Express 服务（端口 3000，SSE 流式代理）
│   └── package.json          ← 依赖配置
├── debug_*.js                ← 调试文件（可手动删除）
└── task-summary_*.md         ← 任务记录
```

## 技术方案

前端通过 SSE（text/event-stream）与后端通信，后端使用 Node.js fetch 实时转发 Gateway 的流式响应。每次对话自动注入系统提示词（30 年工程管理专业身份）。

## 使用方式

**双击 `F:\Qclawjob\start.bat`**
1. 自动检测/启动 QClaw Gateway（54373）
2. 安装 Express 依赖
3. 启动前端服务（3000）
4. 浏览器自动打开 http://localhost:3000

## 连接链路

浏览器 → localhost:3000（server.js）→ 127.0.0.1:54373（Gateway）→ modelroute → 大模型

## 已验证

- ✅ SSE 流式对话（6.8s 响应，逐字推送）
- ✅ 深色主题前端页面
- ✅ 网关状态检测 API
- ✅ 服务端错误返回
