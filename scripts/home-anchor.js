#!/usr/bin/env node

const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')

const ROOT = process.cwd()
const ANCHOR_DIR = path.join(ROOT, '.home-anchor')
const SNAPSHOT_DIR = path.join(ANCHOR_DIR, 'snapshot')
const MANIFEST_PATH = path.join(ANCHOR_DIR, 'manifest.json')

const HOME_FILES = [
  'client/src/pages/Landing.jsx',
  'client/src/components/LiveBtcChart.jsx',
  'client/src/components/ScrollReveal.jsx',
  'client/src/components/SplitTextScroll.jsx',
  'client/src/styles.css',
]

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function toPosix(relPath) {
  return relPath.split(path.sep).join('/')
}

async function readFileOrNull(absPath) {
  try {
    return await fs.readFile(absPath)
  } catch (err) {
    if (err && err.code === 'ENOENT') return null
    throw err
  }
}

async function seal() {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true })

  const manifest = {
    createdAt: new Date().toISOString(),
    files: [],
  }

  for (const rel of HOME_FILES) {
    const abs = path.join(ROOT, rel)
    const content = await readFileOrNull(abs)
    if (!content) {
      throw new Error(`Cannot anchor missing file: ${rel}`)
    }

    const snapshotPath = path.join(SNAPSHOT_DIR, rel)
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true })
    await fs.writeFile(snapshotPath, content)

    manifest.files.push({
      path: toPosix(rel),
      sha256: sha256(content),
      bytes: content.length,
    })
  }

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  console.log(`Home anchor created: ${toPosix(path.relative(ROOT, MANIFEST_PATH))}`)
  console.log(`Tracked files: ${manifest.files.length}`)
}

async function loadManifest() {
  const raw = await readFileOrNull(MANIFEST_PATH)
  if (!raw) {
    throw new Error('Home anchor not found. Run: npm run home:anchor')
  }
  const manifest = JSON.parse(raw.toString('utf8'))
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('Home anchor manifest is invalid.')
  }
  return manifest
}

async function check() {
  const manifest = await loadManifest()
  const drift = []

  for (const entry of manifest.files) {
    const rel = entry.path
    const abs = path.join(ROOT, rel)
    const content = await readFileOrNull(abs)
    if (!content) {
      drift.push({ path: rel, reason: 'missing' })
      continue
    }
    const currentHash = sha256(content)
    if (currentHash !== entry.sha256) {
      drift.push({ path: rel, reason: 'modified' })
    }
  }

  if (drift.length === 0) {
    console.log('Home anchor check passed. No drift detected.')
    return
  }

  console.error('Home anchor drift detected:')
  for (const item of drift) {
    console.error(`- ${item.reason}: ${item.path}`)
  }
  process.exitCode = 1
}

async function restore() {
  const manifest = await loadManifest()
  let restored = 0

  for (const entry of manifest.files) {
    const rel = entry.path
    const snapshotPath = path.join(SNAPSHOT_DIR, rel)
    const snapshotContent = await readFileOrNull(snapshotPath)
    if (!snapshotContent) {
      throw new Error(`Missing snapshot file: ${toPosix(path.relative(ROOT, snapshotPath))}`)
    }
    const targetPath = path.join(ROOT, rel)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, snapshotContent)
    restored += 1
  }

  console.log(`Home files restored from anchor: ${restored}`)
}

async function main() {
  const mode = process.argv[2]
  if (!mode || !['seal', 'check', 'restore'].includes(mode)) {
    console.log('Usage: node scripts/home-anchor.js <seal|check|restore>')
    process.exitCode = 1
    return
  }

  if (mode === 'seal') {
    await seal()
    return
  }
  if (mode === 'check') {
    await check()
    return
  }
  await restore()
}

main().catch((err) => {
  console.error(`home-anchor error: ${err.message}`)
  process.exitCode = 1
})

