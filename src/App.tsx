import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Admin } from './pages/Admin'
import { OverlayBoard } from './pages/OverlayBoard'
import { OverlayReveal } from './pages/OverlayReveal'
import { OverlayScore } from './pages/OverlayScore'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin"           element={<Admin />} />
        <Route path="/overlay"         element={<Navigate to="/overlay/board" replace />} />
        <Route path="/overlay/board"   element={<OverlayBoard />} />
        <Route path="/overlay/reveal"  element={<OverlayReveal />} />
        <Route path="/overlay/score"   element={<OverlayScore />} />
        <Route path="*"                element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
