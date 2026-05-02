import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const client = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60_000,
})

export const simulateSimah = async () => {
  const { data } = await client.post('/simulate-simah')
  return data
}

export const assess = async (payload) => {
  const { data } = await client.post('/assess', payload)
  return data
}

export const checkHealth = async () => {
  const { data } = await client.get('/health')
  return data
}

export const fetchModelPerformance = async () => {
  const { data } = await client.get('/model-performance')
  return data
}
