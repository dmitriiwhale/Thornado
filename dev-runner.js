const { spawn } = require('node:child_process')
const path = require('node:path')

const isWindows = process.platform === 'win32'
const npmCmd = isWindows ? 'npm.cmd' : 'npm'
const gatewayDir = path.join(__dirname, 'gateway')
const executionDir = path.join(__dirname, 'gateway', 'execution')
const chartDir = path.join(__dirname, 'gateway', 'chart')

const children = []
let shuttingDown = false

function stopChild(child) {
  if (!child || child.killed || child.exitCode !== null) return

  if (isWindows) {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
    return
  }

  child.kill('SIGTERM')
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) stopChild(child)
  setTimeout(() => process.exit(exitCode), 150)
}

function run(name, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
    shell: isWindows,
    ...options,
  })

  child.on('error', (error) => {
    console.error(`[${name}] failed to start:`, error.message)
    shutdown(1)
  })

  child.on('exit', (code) => {
    if (shuttingDown) return
    const exitCode = typeof code === 'number' ? code : 1
    console.error(`[${name}] exited with code ${exitCode}`)
    shutdown(exitCode)
  })

  children.push(child)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

run('execution', 'cargo', ['run'], { cwd: executionDir })
run('chart', 'cargo', ['run'], { cwd: chartDir })
run('gateway', 'go', ['run', '.'], { cwd: gatewayDir })
run('client', npmCmd, ['run', 'dev', '--prefix', 'client'])
