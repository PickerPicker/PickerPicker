import { QueryClient } from '@tanstack/react-query'

/**
 * 앱 전역 QueryClient 인스턴스.
 *
 * 이번 작업에서는 Provider 기반만 깔아둔다 — 실제 서버 함수 호출을
 * useQuery/useInfiniteQuery로 교체하는 마이그레이션은 별도 이슈에서 진행한다.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 1분간 신선 — 화면 전환마다 재요청 폭주 방지
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
