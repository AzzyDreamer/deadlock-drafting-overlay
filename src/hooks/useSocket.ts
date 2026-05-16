import { useEffect, useRef, useState, useCallback } from 'react'
import type { DraftState, ClientMessage } from '../types'

function getWsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  // In Vite dev mode (:5173) connect directly to the backend port,
  // bypassing Vite's proxy which conflicts with HMR websocket.
  const host = window.location.port === '5173'
    ? `${window.location.hostname}:3001`
    : window.location.host
  return `${proto}//${host}/ws`
}

const initialState: DraftState = {
  status: 'idle',
  config: null,
  entries: [],
  currentPhase: 0,
  pendingHero: null,
  score: { a: 0, b: 0 },
  laneAssignA: null,
  laneAssignB: null,
  audioEnabled: true,
  audioVolume: 0.7,
  heroSfxEnabled: true,
  heroSfxVolume: 0.8,
}

export function useSocket() {
  const [state, setState] = useState<DraftState>(initialState)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Tracks whether this hook instance is still mounted — prevents
  // a stale onclose from a Strict Mode double-invoke from scheduling
  // a phantom reconnect after the first WS is intentionally closed.
  const activeRef = useRef(true)

  const connect = useCallback(() => {
    if (!activeRef.current) return
    const ws = new WebSocket(getWsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      if (wsRef.current === ws) setConnected(true)
    }
    ws.onclose = () => {
      if (wsRef.current !== ws) return   // stale socket — ignore
      setConnected(false)
      if (activeRef.current) {
        reconnectTimer.current = setTimeout(connect, 2000)
      }
    }
    ws.onerror = () => ws.close()
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'state') setState(msg.state)
      } catch {}
    }
  }, [])

  useEffect(() => {
    activeRef.current = true
    connect()
    return () => {
      activeRef.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  return { state, connected, send }
}
