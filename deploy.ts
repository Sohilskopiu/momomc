import { readKey, writeKey } from './site'

// Deploy from the admin panel: a Vercel "Deploy Hook" starts a new deployment of the latest code on GitHub,
// and (optionally) a Vercel token + project ID lets the panel show whether the deployment is building, ready or failed.
// Values come from Admin Panel > Deploy (saved in the database) or, as a fallback, from these env vars:
// DEPLOY_HOOK_URL, VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID.
export type DeployConfig = { hookUrl: string; token: string; projectId: string; teamId: string }
export type DeployItem = { id: string; state: string; url: string; createdAt: number; target: string; message: string; sha: string }
export type DeployStatus = { at: number; items: DeployItem[] }

const HOOK_RE = /^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/[\w/-]+$/

export async function getDeployConfig(): Promise<DeployConfig & { hookFromEnv: boolean; tokenFromEnv: boolean }> {
  const saved = await readKey<Partial<DeployConfig>>('deploy', {})
  return {
    hookUrl: saved.hookUrl || process.env.DEPLOY_HOOK_URL || '',
    token: saved.token || process.env.VERCEL_TOKEN || '',
    projectId: saved.projectId || process.env.VERCEL_PROJECT_ID || '',
    teamId: saved.teamId || process.env.VERCEL_TEAM_ID || '',
    hookFromEnv: !saved.hookUrl && !!process.env.DEPLOY_HOOK_URL,
    tokenFromEnv: !saved.token && !!process.env.VERCEL_TOKEN,
  }
}

export async function saveDeployConfig(p: Partial<DeployConfig>) {
  const cur = await readKey<Partial<DeployConfig>>('deploy', {})
  const next = { ...cur }
  if (p.hookUrl) {
    if (!HOOK_RE.test(p.hookUrl)) throw new Error('That does not look like a Vercel Deploy Hook URL (it starts with https://api.vercel.com/v1/integrations/deploy/)')
    next.hookUrl = p.hookUrl
  }
  if (p.token) next.token = p.token.slice(0, 200)
  if (p.projectId !== undefined) next.projectId = p.projectId.replace(/[^\w-]/g, '').slice(0, 80)
  if (p.teamId !== undefined) next.teamId = p.teamId.replace(/[^\w-]/g, '').slice(0, 80)
  await writeKey('deploy', next)
}
export const clearDeployConfig = () => writeKey('deploy', {})

let lastTrigger = 0
export async function deployNow() {
  const c = await getDeployConfig()
  if (!c.hookUrl) throw new Error('Add your Vercel Deploy Hook URL first (Admin Panel > Deploy).')
  if (!HOOK_RE.test(c.hookUrl)) throw new Error('The saved Deploy Hook URL is not valid.')
  if (Date.now() - lastTrigger < 20_000) throw new Error('A deploy was just started. Wait a few seconds.')
  lastTrigger = Date.now()
  const res = await fetch(c.hookUrl, { method: 'POST', signal: AbortSignal.timeout(15_000) })
  if (!res.ok) {
    lastTrigger = 0
    throw new Error(`Vercel did not accept the deploy (${res.status}). Check the hook URL.`)
  }
  await refreshDeployStatus().catch(() => {}) // status is optional
}

export async function refreshDeployStatus(): Promise<DeployStatus> {
  const c = await getDeployConfig()
  if (!c.token || !c.projectId) throw new Error('Add a Vercel token and project ID to see deploy status.')
  const q = new URLSearchParams({ projectId: c.projectId, limit: '6' })
  if (c.teamId) q.set('teamId', c.teamId)
  const res = await fetch(`https://api.vercel.com/v6/deployments?${q}`, { headers: { Authorization: `Bearer ${c.token}` }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Vercel status check failed (${res.status}). Check the token, project ID and team ID.`)
  const d = (await res.json()) as { deployments?: { uid: string; state?: string; readyState?: string; url?: string; created?: number; target?: string | null; meta?: Record<string, string> }[] }
  const status: DeployStatus = {
    at: Date.now(),
    items: (d.deployments ?? []).map((x) => ({
      id: x.uid, state: (x.readyState || x.state || 'UNKNOWN').toUpperCase(), url: x.url ? `https://${x.url}` : '',
      createdAt: x.created ?? 0, target: x.target || 'preview',
      message: (x.meta?.githubCommitMessage || '').slice(0, 120), sha: (x.meta?.githubCommitSha || '').slice(0, 7),
    })),
  }
  await writeKey('deploy_status', status)
  return status
}
