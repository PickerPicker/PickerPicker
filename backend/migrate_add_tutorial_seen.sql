-- #96: players 테이블에 tutorial_seen 컬럼 추가
-- 기존 플레이어 전원 false로 초기화됨 (튜토리얼 1회 재노출 발생)
ALTER TABLE players
    ADD COLUMN IF NOT EXISTS tutorial_seen BOOLEAN NOT NULL DEFAULT FALSE;
