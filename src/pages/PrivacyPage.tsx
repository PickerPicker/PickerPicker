import { useNavigate } from 'react-router-dom'

/**
 * 개인정보처리방침 페이지 (/privacy).
 * Google AdSense 심사 필수 요건. 독립 URL로 접근 가능해야 한다.
 */
export function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-base-100 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <button className="btn btn-ghost btn-sm mb-6" onClick={() => navigate('/')}>
          ← 홈으로
        </button>

        <h1 className="mb-2 text-3xl font-bold text-primary">개인정보처리방침</h1>
        <p className="mb-8 text-sm opacity-60">최종 수정일: 2026년 8월 1일</p>

        <div className="prose prose-sm max-w-none space-y-6 leading-relaxed">
          <section>
            <p>
              PickerPicker(이하 &lsquo;서비스&rsquo;)는 이용자의 개인정보를 중요하게 생각하며,
              「개인정보 보호법」 등 관련 법령을 준수합니다. 본 방침은 서비스가 어떤 정보를 수집하고
              어떻게 이용·보호하는지 설명합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">1. 수집하는 개인정보 항목</h2>
            <ul className="list-disc pl-6">
              <li>닉네임 — 게임 기록 식별 및 랭킹 표시용</li>
              <li>PIN(비밀번호) — 본인 기록 보호용. 암호화되어 저장됩니다.</li>
              <li>게임 기록 — 점수, 도달 스테이지, 플레이 횟수, 판정 통계</li>
              <li>
                자동 수집 정보 — 브라우저 로컬 저장소(localStorage)에 닉네임·환경설정(싱크 보정,
                음량 등)을 저장합니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. 개인정보의 이용 목적</h2>
            <ul className="list-disc pl-6">
              <li>게임 기록 저장 및 랭킹·통계 제공</li>
              <li>본인 기록 조회 및 통계 공개 설정 관리</li>
              <li>서비스 품질 개선 및 통계 분석</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. 개인정보의 보유 및 이용 기간</h2>
            <p>
              수집된 정보는 서비스 제공 목적이 달성될 때까지 보유하며, 이용자가 삭제를 요청하면 지체
              없이 파기합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. 쿠키 및 광고</h2>
            <p>
              서비스는 향후 Google AdSense 등 제3자 광고를 게재할 수 있습니다. 이 경우 광고 제공
              업체는 쿠키 및 광고 식별자를 사용하여 이용자의 관심사에 기반한 광고를 제공할 수
              있습니다. 이용자는 브라우저 설정에서 쿠키를 차단하거나
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="link link-primary"
              >
                {' '}
                Google 광고 설정
              </a>
              에서 맞춤 광고를 비활성화할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. 이용자의 권리</h2>
            <p>
              이용자는 언제든지 본인의 개인정보 조회·수정·삭제를 요청할 수 있으며, 서비스는 이에
              지체 없이 응합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. 문의</h2>
            <p>
              개인정보 관련 문의는 운영자 이메일(
              <a href="mailto:chan4760@gmail.com" className="link link-primary">
                chan4760@gmail.com
              </a>
              )로 연락해 주시기 바랍니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
