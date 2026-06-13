/**
 * QClaw Internal Launcher
 * 从 QClaw 内部启动后端服务
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const BACKEND_DIR = path.join(__dirname, 'backend');
const LOG_FILE = path.join(BACKEND_DIR, 'server.log');
const PID_FILE = path.join(__dirname, '.server.pid');

function log(msg) {
    const time = new Date().toISOString();
    console.log(`[${time}] ${msg}`);
}

function isRunning() {
    if (!fs.existsSync(PID_FILE)) return false;
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function start() {
    if (isRunning()) {
        log('Server is already running');
        return;
    }

    log('Starting backend server...');

    // Clean old log
    fs.writeFileSync(LOG_FILE, `Server started at ${new Date().toISOString()}\n`);

    const child = spawn('node', ['server.js'], {
        cwd: BACKEND_DIR,
        detached: true,
        stdio: ['ignore', fs.openSync(LOG_FILE, 'a'), fs.openSync(LOG_FILE, 'a')]
    });

    child.unref();
    fs.writeFileSync(PID_FILE, child.pid.toString());

    log(`Server started with PID ${child.pid}`);

    // Wait and verify
    setTimeout(() => {
        const http = require('http');
        const req = http.get('http://localhost:3000/api/status', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                log(`Status: ${data}`);
            });
        });
        req.on('error', (err) => {
            log(`Health check failed: ${err.message}`);
        });
        req.setTimeout(5000);
    }, 3000);
}

function stop() {
    if (!isRunning()) {
        log('Server is not running');
        return;
    }

    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
    log(`Stopping server (PID ${pid})...`);

    try {
        process.kill(pid, 'SIGTERM');
        setTimeout(() => {
            try {
                process.kill(pid, 0);
                process.kill(pid, 'SIGKILL');
                log('Force killed');
            } catch {
                log('Server stopped gracefully');
            }
            fs.unlinkSync(PID_FILE);
        }, 3000);
    } catch (err) {
        log(`Error stopping: ${err.message}`);
        fs.unlinkSync(PID_FILE);
    }
}

function status() {
    if (isRunning()) {
        const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
        log(`Server is running (PID ${pid})`);
    } else {
        log('Server is not running');
    }
}

// CLI
const cmd = process.argv[2] || 'start';
switch (cmd) {
    case 'start': start(); break;
    case 'stop': stop(); break;
    case 'status': status(); break;
    case 'restart': stop(); setTimeout(start, 1000); break;
    default:
        console.log('Usage: node launcher.js [start|stop|status|restart]');
}
