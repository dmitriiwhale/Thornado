import './polyfills.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import App from './App'
import { NadoLinkedSignerProvider } from './context/NadoLinkedSignerContext.jsx'
import { NadoNetworkProvider } from './context/NadoNetworkContext.jsx'
import { wagmiConfig } from './wagmi.config.js'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <NadoNetworkProvider>
          <NadoLinkedSignerProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </NadoLinkedSignerProvider>
        </NadoNetworkProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
