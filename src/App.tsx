import { Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { HomePage } from './pages/HomePage'
import { RankingPage } from './pages/RankingPage'
import { StatsPage } from './pages/StatsPage'
import { PracticePage } from './pages/PracticePage'
import { TutorialPage } from './pages/TutorialPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { AdminApp } from './features/admin/AdminApp'
import { RequireAuth } from './components/common/RequireAuth'
import { RequirePlayed } from './components/common/RequirePlayed'
import { ToastContainer } from './components/common/ToastContainer'

/**
 * 라우트 정의 (설계 A안).
 *
 * URL은 공유·북마크·새로고침이 필요한 화면에만 부여한다.
 * 게임 내부 플로우(start ↔ tutorial ↔ game)는 HomePage가 상태로 렌더한다.
 *
 * Provider 래핑(BrowserRouter/QueryClient/Audio)은 main.tsx에서 처리한다.
 */
export default function App() {
  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route
          path="/stats"
          element={
            <RequireAuth>
              <StatsPage />
            </RequireAuth>
          }
        />
        <Route path="/tutorial" element={<TutorialPage />} />
        <Route
          path="/practice"
          element={
            <RequirePlayed>
              <PracticePage />
            </RequirePlayed>
          }
        />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
