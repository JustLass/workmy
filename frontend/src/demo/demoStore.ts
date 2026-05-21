import type { DemoStore } from './seed'
import { createInitialDemoStore } from './seed'

const STORAGE_KEY = 'workmy_demo_session_v1'

export function loadDemoStore(): DemoStore {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return createInitialDemoStore()
  try {
    return JSON.parse(raw) as DemoStore
  } catch {
    return createInitialDemoStore()
  }
}

export function saveDemoStore(store: DemoStore) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function resetDemoStore(): DemoStore {
  const fresh = createInitialDemoStore()
  saveDemoStore(fresh)
  return fresh
}
