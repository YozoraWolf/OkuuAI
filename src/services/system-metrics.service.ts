import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Core } from '../core';

const execFileAsync = promisify(execFile);

type CpuSnapshot = { idle: number; total: number };
let previousCpu = readCpuSnapshot();

function readCpuSnapshot(): CpuSnapshot {
  return os.cpus().reduce((snapshot, cpu) => {
    const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
    snapshot.idle += cpu.times.idle;
    snapshot.total += total;
    return snapshot;
  }, { idle: 0, total: 0 });
}

function getCpuUsage() {
  const current = readCpuSnapshot();
  const idleDelta = current.idle - previousCpu.idle;
  const totalDelta = current.total - previousCpu.total;
  previousCpu = current;
  return totalDelta > 0 ? Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100)) : 0;
}

async function getGpuMetrics() {
  try {
    const { stdout } = await execFileAsync('nvidia-smi', [
      '--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu',
      '--format=csv,noheader,nounits',
    ], { timeout: 2500 });
    const [name, utilization, memoryUsed, memoryTotal, temperature] = stdout.trim().split('\n')[0].split(',').map(value => value.trim());
    return {
      available: true,
      name,
      usagePercent: Number(utilization),
      memoryUsedMb: Number(memoryUsed),
      memoryTotalMb: Number(memoryTotal),
      temperatureC: Number(temperature),
    };
  } catch {
    return { available: false };
  }
}

async function checkService(name: string, url?: string) {
  if (!url) return { name, status: 'unconfigured', detail: 'No health URL configured' };
  const started = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return {
      name,
      status: response.ok ? 'online' : 'degraded',
      detail: `HTTP ${response.status}`,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      name,
      status: 'offline',
      detail: error instanceof Error ? error.message : 'Health check failed',
      latencyMs: Date.now() - started,
    };
  }
}

export async function getAdminOverview() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const gpu = await getGpuMetrics();
  const okuuClaw = await checkService('OkuuClaw', process.env.OKUUCLAW_HEALTH_URL);

  return {
    timestamp: Date.now(),
    host: {
      hostname: os.hostname(),
      platform: `${os.platform()} ${os.release()}`,
      uptimeSeconds: os.uptime(),
    },
    metrics: {
      cpu: {
        usagePercent: getCpuUsage(),
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown CPU',
      },
      memory: {
        usagePercent: ((totalMemory - freeMemory) / totalMemory) * 100,
        usedBytes: totalMemory - freeMemory,
        totalBytes: totalMemory,
      },
      gpu,
    },
    services: [
      { name: 'Frontend', status: 'online', detail: 'Dashboard connected' },
      { name: 'Backend', status: Core.status === 'active' ? 'online' : Core.status, detail: `Uptime ${Math.floor(process.uptime())}s` },
      okuuClaw,
    ],
  };
}
