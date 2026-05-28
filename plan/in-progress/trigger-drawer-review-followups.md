---
worktree: (미정 — 신규 worktree 생성 필요)
started: 2026-05-29
owner: developer
source: ai-review / review/code/2026/05/29/08_26_13/SUMMARY.md
---

# trigger-detail-drawer — ai-review 보류 항목 (기존 이슈 / 범위 밖)

## 배경

`trigger-drawer-{copy-hook,refactor-async,tests}` 3개 plan 의 ai-review(`review/code/2026/05/29/08_26_13`)
에서 WARNING/INFO 가 다수 나왔으나, 대부분은 본 3개 plan 이 건드리지 않은 **기존 코드**(주로
`ChatChannelCard`·`getWebhookUrl`) 의 선존 이슈다. scope reviewer 가 변경 범위는 NONE(준수)으로
판정했으므로, 범위 밖 항목은 리팩토링 PR 에 끼워 넣지 않고 본 followup 으로 분리한다.

## 작업 범위 (체크박스 = 개별 항목)

### 보안 (WARNING)

- [ ] rotate/revoke 결과 시크릿·토큰 평문 DOM 렌더 → 일정 시간 후 state 자동 null 초기화 또는 마스킹 + 클릭-노출 UX (`ExternalInteractionCard` rotateResult/revokeResult)
- [ ] `err.message` 원문 toast 노출 → i18n 문자열만 사용 (`ExternalInteractionCard` rotate/revoke catch, `ChatChannelCard.handleSave` catch). `OverviewCard.onError` 패턴 일관 적용

### 유지보수성 (WARNING)

- [ ] `ChatChannelCard` (~200줄) read/edit/rotate-modal/handleSave/handleRotate 책임 분리 — edit 폼·rotate modal 별 컴포넌트 추출
- [ ] `rateLimitPerMinute` 기본값 `60` 상수화(`DEFAULT_RATE_LIMIT_PER_MINUTE`) 후 2곳 참조
- [ ] `ExternalInteractionCard` 편집 폼 native `<input>/<label>/<select>` → 디자인 시스템 `Input`/`Label` 교체
- [ ] `ExternalInteractionCard` cancel 시 미저장 입력값(`urlValue`·`eventsValue`·`interactionEnabled`·`strategy`) 원래 값으로 리셋 (carried-over 기존 동작)

### 일관성 / spec (INFO)

- [ ] `ChatChannelCard.handleSave` 도 `useMutation` 으로 전환 — W3(EIA 전환)의 잔여 절반
- [ ] `getWebhookUrl` 의 `:3011` 포트 하드코딩 → `NEXT_PUBLIC_WEBHOOK_BASE_URL` 등 환경변수 (spec §2.4 base_url "SaaS 는 서비스 도메인" 정의와 불일치). spec 해석 필요 시 project-planner 확인
- [ ] notification URL 입력 클라이언트 검증 추가 — `https://`/`http://` 만 허용 (SSRF 방어)

### 테스트 (INFO)

- [ ] `viewer` 역할에서 Edit 버튼 미노출 검증 케이스
- [ ] `manual` 타입 트리거 카드 미렌더 검증 케이스
- [ ] `navigator.clipboard` 미존재 환경 error 경로 테스트 (`use-copy-to-clipboard`)
- [ ] 테스트 `useLocaleStore`/`navigator.clipboard` 전역 변조 teardown(`afterEach`) 보완 — 단, 기존 `trigger-history-dialog.test.tsx` 와 동일 패턴이라 repo 전반 컨벤션 조정 차원에서 검토

## 완료 기준

- 각 항목 처리 또는 (spec/제품 결정 필요 시) project-planner 위임 후 close
- lint + unit + build + e2e 통과

## 관련

- source: `review/code/2026/05/29/08_26_13/SUMMARY.md` (위험도 MEDIUM, Critical 0)
- 선행: `trigger-drawer-copy-hook` · `trigger-drawer-refactor-async` · `trigger-drawer-tests`
