import cloudbaseSDK from '@cloudbase/js-sdk'
import adapter from '@cloudbase/adapter-uni-app'

const CLOUDBASE_ENV = 'cloud1-d1g59kb63451bc898'
const CLOUDBASE_REGION = 'ap-shanghai'
const CLOUDBASE_ACCESS_KEY = import.meta.env.VITE_CLOUDBASE_ACCESS_KEY || ''

const adapterOptions = typeof uni !== 'undefined' ? { uni } : {}

cloudbaseSDK.useAdapters(adapter, adapterOptions)

const accessKey = String(CLOUDBASE_ACCESS_KEY || '').trim()
const cloudbase = cloudbaseSDK.init({
  env: CLOUDBASE_ENV,
  region: CLOUDBASE_REGION,
  ...(accessKey ? { accessKey } : {}),
})
let authReadyPromise = null

export function getCloudbase() {
  return cloudbase
}

export async function ensureCloudbaseAuth() {
  const app = cloudbase
  const auth = app.auth()

  if (!authReadyPromise) {
    authReadyPromise = (async () => {
      const loginState = await auth.getLoginState()
      if (!loginState) {
        await auth.signInAnonymously()
      }
      return app
    })()
  }

  try {
    return await authReadyPromise
  } catch (error) {
    authReadyPromise = null
    throw error
  }
}

export { cloudbase }

export default cloudbase
