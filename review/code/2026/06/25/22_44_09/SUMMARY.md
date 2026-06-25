# Code Review 통합 보고서

대상: refactor 03 m-3 — integrations/new/page.tsx 1444→448줄 분할 (커밋 `174bd906`)

## 전체 위험도
**MEDIUM** — behavior-preserving 리팩터링으로 신규 기능 회귀는 없으나, `useOauthPopupReturn` 의 타이밍 민감 OAuth 상태기계에 대한 단위 테스트가 없어 회귀 탐지 능력에 공백이 있다. 아키텍처·보안·요구사항 측면의 발견사항은 모두 후속 PR 수준의 경고이며 현재 릴리스를 차단할 Critical 은 없다.

## Critical 발견사항
Critical 발견사항 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `useOauthPopupReturn` 훅 단위 테스트 부재 — 5분 타임아웃·popup.closed 폴링·postMessage 수신 등 회귀 민감 타이밍 로직 162줄에 테스트 없음 | `use-oauth-popup-return.ts` | `use-oauth-popup-return.test.tsx` 신설(renderHook + vi.useFakeTimers, 6케이스) |
| 2 | Testing | `useUnsavedChangesWarning` 훅 단위 테스트 부재 | `use-unsaved-changes-warning.ts` | `use-unsaved-changes-warning.test.ts` 신설(3케이스) |
| 3 | Security | postMessage 핸들러에서 `event.source` 미검증 — 동일 오리진 타 발신자 previewToken 주입 가능 | `use-oauth-popup-return.ts` | origin 검증 직후 `event.source !== popupRef.current` 체크 |
| 4 | Security | 폴링 에러 메시지(`lastErrorMessage`) 백엔드 원문 그대로 UI 노출 | `cafe24-private-pending-step.tsx`, `makeshop-pending-step.tsx` | i18n 매핑/제네릭 대체 |
| 5 | Security | `TestStep` API `result.message` 백엔드 원문 UI 직접 표시 | `test-step.tsx` | 코드 매핑 계층 적용 |
| 6 | Architecture | `useOauthPopupReturn` 이 lib 레이어임에도 toast·i18n UI 부수효과 직접 처리 — 레이어 책임 | `use-oauth-popup-return.ts` | 훅은 콜백만 노출, 번역·알림 호출자 위임(후속 PR) |
| 7 | Architecture | `AuthStep` props 21개 — 인터페이스 비대 | `auth-step.tsx` | 연관 props 객체 묶기(후속 PR) |
| 8 | Architecture | `Cafe24PrivatePendingStep`·`MakeshopPendingStep` 98% 중복 | 두 pending step | `PendingInstallStep` 공통 추출(후속 PR) |
| 9 | Maintainability | 매직 넘버 3개 인라인(`5*60*1000`,`1500`,`500`) | `use-oauth-popup-return.ts` | 상수 선언 |
| 10 | Maintainability | pending step `"Copy"` 하드코딩 — i18n 누락 | 두 pending step | `t("common.copy")` 교체 |

## 참고 (INFO)
- I1~I3 (security): client_secret state 평문(직렬화 경로 미발견)·integrationId URL 세그먼트(App Router 정규화)·mall_id pattern 클라이언트 전용(backend backstop) — 전부 현 설계 적정.
- I4~I6 (requirement): useCafe24PendingPolling 타입 캐스트·encodeURIComponent 불일치·TestStep queryKey credentials 미포함 — 현 PR 범위 밖.
- I7~I9 (architecture): TestStep previewTest 직접 호출·onConnect/validate 중복·_components export 가시성 — 라우트-로컬로 노출 제한, 필수 아님.
- I10~I14 (maintainability/testing): clearOAuthTimeout useCallback·conflictDescKey 삼항·TestStep 타입 캐스트 중복·AuthStep coerce effect·TestStep skipProbe 테스트.
- I15 (scope): 포맷팅 변경 4건은 자동 포매터 잡음, 범위 이탈 아님.

## 에이전트별 위험도

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | useOauthPopupReturn 단위 테스트 부재 |
| security | LOW | event.source 미검증, 백엔드 에러 메시지 UI 노출(3 WARNING, 전부 사전존재) |
| architecture | LOW | 레이어 책임·props 비대·pending 중복(전부 후속 PR) |
| maintainability | LOW | pending 중복·props 21개·매직 넘버·i18n 누락 |
| requirement | LOW | spec 요구사항 충족. 캐스트·encode 불일치(INFO) |
| side_effect | NONE | 신규 부작용 없음. 기존 동작 100% 보존 |
| scope | NONE | behavior-preserving 범위 준수 |

## 처분 (RESOLUTION 상세는 RESOLUTION.md)

- **반영(이 PR)**: W1·W2(신규 훅 단위 테스트 추가), W9(매직 넘버 상수화).
- **보류(사전존재·behavior 변경·후속 PR)**: W3·W4·W5(보안 — 원본 동작 verbatim 보존, e2e 위임 상태라 미검증 변경 회피), W6·W7·W8(아키텍처 — 리뷰어 후속 PR 명시), W10(i18n 사전존재).

## 라우터 결정
routing_status=done. 실행: security·architecture·requirement·scope·side_effect·maintainability·testing 외. 강제 포함: maintainability·requirement·scope·security·side_effect·testing.
