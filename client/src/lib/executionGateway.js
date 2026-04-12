import { createNadoClient } from '@nadohq/client'

const EXECUTION_ENGINE_ENDPOINT = '/api/execution'

function ensureBaseClient(baseClient) {
  if (!baseClient?.context) {
    throw new Error('Nado client unavailable')
  }
  if (!baseClient.context.publicClient || !baseClient.context.walletClient) {
    throw new Error('Wallet client unavailable')
  }
  return baseClient
}

export function createExecutionGatewayClient(baseClient) {
  const client = ensureBaseClient(baseClient)
  const { context } = client

  return createNadoClient(
    {
      contractAddresses: context.contractAddresses,
      engineEndpoint: EXECUTION_ENGINE_ENDPOINT,
      indexerEndpoint: context.indexerClient.opts.url,
      triggerEndpoint: context.triggerClient.opts.url,
    },
    {
      publicClient: context.publicClient,
      walletClient: context.walletClient,
      linkedSignerWalletClient: context.linkedSignerWalletClient,
    },
  )
}

export async function fetchExecutionCapabilities(signal) {
  const response = await fetch('/api/execution/capabilities', {
    method: 'GET',
    credentials: 'include',
    signal,
  })

  if (!response.ok) {
    const message = response.status === 401 ? 'Sign in required' : `Execution gateway error (${response.status})`
    throw new Error(message)
  }

  return response.json()
}

