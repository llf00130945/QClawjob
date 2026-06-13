const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { execSync, spawnSync } = require('child_process');



const app = express();
const PORT = 3000;

// Gateway config - port is auto-detected
const GATEWAY_HOST = '127.0.0.1';
const AUTH_TOKEN = 'ce90499e2aab6f33c08a1612a0b1e76dda99974501693a0d';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ========== Auto-detect Gateway Port ==========
function detectGatewayPort() {
    // Method 1: Read QClaw config file (fastest, most reliable)
    try {
        var homeDir = process.env.USERPROFILE;
        var configPath = homeDir + '\\.qclaw\\openclaw.json';
        var raw = fs.readFileSync(configPath, 'utf-8');
        var config = JSON.parse(raw);
        if (config.gateway && config.gateway.port) {
            var port = parseInt(config.gateway.port);
            if (port > 1000 && port < 65535) return port;
        }
    } catch(e) {}

    // Method 2: Parse 'openclaw gateway status' output (backup, slow)
    try {
        var proc = spawnSync('cmd.exe', ['/c', 'openclaw gateway status'], { encoding: 'utf-8', timeout: 15000 });
        var combined = (proc.stdout || '') + (proc.stderr || '');
        var m = combined.match(/port=(\d+)/);
        if (m) {
            var port = parseInt(m[1]);
            if (port > 1000 && port < 65535) return port;
        }
    } catch(e) {}

    // Method 3: Find any QClaw.exe listening port
    try {
        var netResult = spawnSync('cmd.exe', ['/c', 'netstat -ano | findstr LISTENING'], { encoding: 'utf-8', timeout: 3000 });
        var taskResult = spawnSync('cmd.exe', ['/c', 'tasklist /fi "imagename eq QClaw.exe" /fo csv'], { encoding: 'utf-8', timeout: 3000 });
        var netOut = netResult.stdout || '';
        var taskOut = taskResult.stdout || '';

        var pids = [];
        (taskOut.split('\n')).forEach(function(line) {
            var cl = line.replace(/"/g, '').trim();
            if (cl && cl.indexOf('Image Name') !== 0) {
                var parts = cl.split(',');
                if (parts.length >= 2 && /^\d+$/.test(parts[1])) pids.push(parts[1]);
            }
        });

        var found = null;
        (netOut.split('\n')).forEach(function(line) {
            if (line.indexOf('LISTENING') === -1) return;
            var parts = line.trim().split(/\s+/);
            if (parts.length < 5) return;
            var addr = parts[1];
            var portMatch = addr.match(/:(\d+)$/);
            var pid = parts[parts.length - 1].trim();
            if (portMatch && pids.indexOf(pid) !== -1) {
                var p = parseInt(portMatch[1]);
                if (p > 10000 && p < 65000) found = p;
            }
        });
        if (found) return found;
    } catch(e) {}

    return null;
}

let GATEWAY_PORT = detectGatewayPort() || 60063;
console.log('  Gateway detected on port: ' + GATEWAY_PORT);

// If port is the fallback (60063), try to confirm it responds
function checkPort(port) {
    return new Promise((resolve) => {
        const net = require('net');
        const sock = new net.Socket();
        sock.setTimeout(2000);
        sock.on('connect', () => { sock.destroy(); resolve(true); });
        sock.on('error', () => { sock.destroy(); resolve(false); });
        sock.on('timeout', () => { sock.destroy(); resolve(false); });
        sock.connect(port, GATEWAY_HOST);
    });
}

setTimeout(async () => {
    if (!await checkPort(GATEWAY_PORT)) {
        const newPort = detectGatewayPort();
        if (newPort && newPort !== GATEWAY_PORT) {
            console.log('  Gateway port corrected: ' + GATEWAY_PORT + ' -> ' + newPort);
            GATEWAY_PORT = newPort;
        }
    }
}, 2000);

// ========== Agent Config ==========
const AGENTS = {
    'agent-168feb0f': {
        name: '企业工程管理总监',
        avatar: '🏗'
    },
    'agent-2e63987e': {
        name: '工程创优专家',
        avatar: '🏆'
    }
};

const DEFAULT_AGENT = 'agent-168feb0f';

// Read system prompt from SOUL.md
function getSystemPrompt(agentId) {
    const workspaceDir = path.join('C:\\Users\\Administrator\\.qclaw', `workspace-${agentId}`);
    const soulPath = path.join(workspaceDir, 'SOUL.md');
    if (fs.existsSync(soulPath)) {
        let content = fs.readFileSync(soulPath, 'utf-8').trim();
        content = content.replace(/^#\s+.*\n/, '').trim();
        content = content.replace(/^---+\s*$/gm, '').trim();
        content = content.replace(/## 永久知识库[\s\S]*$/, '').trim();
        return content;
    }
    return `You are ${agentId}, a professional assistant.`;
}

// Pre-load prompts
const AGENT_PROMPTS = {};
for (const id of Object.keys(AGENTS)) {
    AGENT_PROMPTS[id] = getSystemPrompt(id);
}

// Get agent info
function getAgentInfo(id) {
    const a = AGENTS[id] || AGENTS[DEFAULT_AGENT];
    return { id, name: a.name, avatar: a.avatar, systemPrompt: AGENT_PROMPTS[id] || '' };
}

// ========== File Upload Config ==========
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Buffer.from(file.originalname, 'latin1').toString('utf8')}`)
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowed = ['.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.json', '.md', '.xml', '.log', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
        if (allowed.includes(ext)) return cb(null, true);
        cb(new Error('Unsupported file type: ' + ext));
    }
});

app.use(express.json());

// Serve static files
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
}

// ========== Extract file text content ==========
function extractFileContent(filePath, ext) {
    try {
        const extLower = ext.toLowerCase();
        if (['.txt', '.md', '.json', '.xml', '.log', '.csv'].includes(extLower)) {
            return fs.readFileSync(filePath, 'utf-8');
        }
        if (['.doc', '.docx', '.pdf'].includes(extLower)) {
            const buf = fs.readFileSync(filePath);
            return buf.toString('utf-8').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '').trim().substring(0, 50000);
        }
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(extLower)) {
            const buf = fs.readFileSync(filePath);
            return '[Image file, base64 length: ' + buf.length + ' bytes]';
        }
        return '[Cannot extract text content]';
    } catch (e) {
        return '[File read failed: ' + e.message + ']';
    }
}

function getFileSummary(ext, filePath) {
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    return '\u{1F4C4} ' + path.basename(filePath) + ' (' + sizeKB + ' KB)';
}

// ========== Gateway Status ==========
app.get('/api/status', (req, res) => {
    var gw = GATEWAY_PORT ? GATEWAY_HOST + ':' + GATEWAY_PORT : 'unknown';
    if (!GATEWAY_PORT) {
        return res.json({ status: 'disconnected', gateway: gw, error: 'no gateway port detected' });
    }
    var url = 'http://' + GATEWAY_HOST + ':' + GATEWAY_PORT + '/';
    fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
        .then(function() { res.json({ status: 'connected', gateway: gw, defaultAgent: DEFAULT_AGENT }); })
        .catch(function(e) { res.json({ status: 'disconnected', gateway: gw, error: e.message }); });
});

// ========== Agent List ==========
app.get('/api/agents', function(req, res) {
    const list = Object.entries(AGENTS).map(function(entry) {
        const id = entry[0], info = entry[1];
        return { id: id, name: info.name, avatar: info.avatar, systemPrompt: AGENT_PROMPTS[id] };
    });
    res.json({ agents: list, default: DEFAULT_AGENT });
});

// ========== SSE Streaming Helper ==========
async function streamChat(res, messages, agentId) {
    const model = 'openclaw/' + (agentId || DEFAULT_AGENT);
    const apiUrl = `http://${GATEWAY_HOST}:${GATEWAY_PORT}/v1/chat/completions`;
    
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + AUTH_TOKEN
            },
            body: JSON.stringify({ model: model, messages: messages, stream: true })
        });

        if (!response.ok) {
            const errText = await response.text();
            res.write('data: ' + JSON.stringify({ error: 'Gateway ' + response.status + ': ' + errText }) + '\n\n');
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        var buffer = '';

        while (true) {
            var result = await reader.read();
            if (result.done) break;
            buffer += decoder.decode(result.value, { stream: true });
            while (buffer.indexOf('\n') !== -1) {
                var nlIdx = buffer.indexOf('\n');
                var line = buffer.slice(0, nlIdx).trim();
                buffer = buffer.slice(nlIdx + 1);
                if (!line || line.charAt(0) === ':') continue;
                if (line.indexOf('data: ') === 0) {
                    var payload = line.slice(6).trim();
                    if (payload === '[DONE]') continue;
                    try {
                        var json = JSON.parse(payload);
                        var delta = (json.choices && json.choices[0] && (json.choices[0].delta ? json.choices[0].delta.content : (json.choices[0].message ? json.choices[0].message.content : null))) || '';
                        if (delta) res.write('data: ' + JSON.stringify({ content: delta }) + '\n\n');
                    } catch (e) { /* skip */ }
                }
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (err) {
        console.error('[PROXY ERROR]', err.message);
        if (!res.writableEnded) {
            res.write('data: ' + JSON.stringify({ error: err.message }) + '\n\n');
            res.write('data: [DONE]\n\n');
            res.end();
        }
    }
}

// ========== Chat with file upload ==========
app.post('/api/chat-with-file', upload.array('files', 10), async function(req, res) {
    var userMessage = req.body.message || '';
    var agentId = req.body.agentId || DEFAULT_AGENT;
    var files = req.files || [];

    if (!userMessage && files.length === 0) {
        return res.status(400).json({ error: 'message or files required' });
    }

    var agentInfo = getAgentInfo(agentId);

    var fileContext = '';
    if (files.length > 0) {
        fileContext = '[User uploaded files]:\n\n';
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var ext = path.extname(file.originalname).toLowerCase();
            var summary = getFileSummary(ext, file.path);
            var content = extractFileContent(file.path, ext);
            fileContext += '--- ' + summary + ' ---\n' + content + '\n\n';
            try { fs.unlinkSync(file.path); } catch(e) {}
        }
        fileContext = fileContext.trim();
    }

    var messages = [
        { role: 'system', content: agentInfo.systemPrompt }
    ];

    if (fileContext) {
        messages.push({
            role: 'user',
            content: '[File content]\n' + fileContext + '\n\n[User question]\n' + (userMessage || 'Please analyze the above file content and provide professional advice')
        });
    } else {
        messages.push({ role: 'user', content: userMessage });
    }

    await streamChat(res, messages, agentId);
});

// ========== Regular chat ==========
app.post('/api/chat', async function(req, res) {
    var messages = req.body.messages;
    var agentId = req.body.agentId || DEFAULT_AGENT;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages array required' });
    }
    await streamChat(res, messages, agentId);
});

app.listen(PORT, '0.0.0.0', function() {
    console.log('');
    console.log('  ========================================');
    console.log('     QClaw Agent Frontend Started');
    console.log('  ========================================');
    console.log('');
    console.log('  URL:   http://localhost:' + PORT);
    console.log('  Gateway Port: ' + GATEWAY_PORT + ' (auto-detected)');
    for (var id in AGENTS) {
        if (AGENTS.hasOwnProperty(id)) {
            console.log('  ' + AGENTS[id].avatar + ' ' + AGENTS[id].name + ' (' + id + ')');
        }
    }
    console.log('');
});
