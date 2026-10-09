import { createServerFn } from '@tanstack/react-start'
import { getPublicSite } from './site'
import { maybeSync } from './discord'

export const fetchSite = createServerFn({ method: 'GET' }).handler(async () => {
  await maybeSync()
  return getPublicSite()
})
