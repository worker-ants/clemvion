# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — 보안 영역에서 시크릿 평문 노출 및 에러 메시지 원문 전달 패턴이 발견됨. 기능 동작을 차단하는 CRITICAL 이슈는 없으며, 대부분은 WARNING/INFO 수준의 개선 사항.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | rotate/revoke 결과 시크릿·토큰이 DOM에 평문으로 렌더됨. XSS, 화면 녹화, 악성 확장 프로그램에 의한 탈취 위험 | `trigger-detail-drawer.tsx` — `ExternalInteractionCard` rotateResult/revokeResult 렌더 블록 | 일정 시간(예: 30초) 후 state 자동 null 초기화 또는 마스킹 + "클릭해서 전체 보기" UX 적용 |
| 2 | 보안 | `err.message`를 toast에 원문 노출. 서버 내부 정보(DB 스키마, 경로, 스택 트레이스 등) 유출 가능 | `trigger-detail-drawer.tsx` — `ExternalInteractionCard.onError`, `handleRotateSecret` catch, `handleRevokeToken` catch, `ChatChannelCard.handleSave` catch 등 | 에러 toast에 사전 정의된 i18n 문자열만 사용. `OverviewCard.onError` 패턴(`t("triggers.detail.saveFailed")`)을 전체에 일관 적용 |
| 3 | 유지보수성 | `ChatChannelCard` 컴포넌트가 약 200줄 이상, read 표시·edit 폼·rotate modal·handleSave·handleRotate 다수 책임 혼재 | `trigger-detail-drawer.tsx` — `ChatChannelCard` 전체 | 중장기적으로 edit 폼 및 rotate modal을 별도 컴포넌트로 분리 |
| 4 | 유지보수성 | `rateLimitPerMinute` 기본값 `60`이 두 곳에 하드코딩 | `trigger-detail-drawer.tsx` — `ChatChannelCard` `useState` 초기화 및 read-mode 표시 | `const DEFAULT_RATE_LIMIT_PER_MINUTE = 60` 상수로 추출해 두 곳에서 참조 |
| 5 | 유지보수성 | `ExternalInteractionCard` cancel 버튼이 `setEditing(false)`만 호출하고 미저장 입력값(`urlValue`, `eventsValue` 등)을 원래 값으로 리셋하지 않음. 취소 후 재진입 시 이전 입력이 남음 | `trigger-detail-drawer.tsx` — `ExternalInteractionCard` cancel 버튼 onClick | `cancelEdit` 함수를 추가해 취소 시 `urlValue`, `eventsValue`, `interactionEnabled`, `strategy`를 현재 트리거 값으로 리셋 |
| 6 | 유지보수성 | `ExternalInteractionCard` 편집 폼이 native `<input>`/`<label>`/`<select>`를 직접 사용. 나머지 카드(`WebhookConfigCard`, `OverviewCard`, `ChatChannelCard`)는 디자인 시스템 `Input`/`Label` 컴포넌트 사용 | `trigger-detail-drawer.tsx` — `ExternalInteractionCard` 편집 폼 섹션 | 편집 폼의 native HTML 요소를 `Input`, `Label` UI 컴포넌트로 교체 |
| 7 | 테스팅 | `webhookTitle.parentElement!` non-null assertion으로 CardHeader를 가정. DOM 구조 변경 시 버튼을 찾지 못해 false negative 유발 가능 | `trigger-detail-drawer.test.tsx` 라인 494 | Edit 버튼에 `data-testid` 또는 `aria-label`을 부여해 안정적으로 접근 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `getWebhookUrl`이 `window.location.origin`의 포트를 `:3011`로 하드코딩 교체. 프로덕션에서 잘못된 webhook URL 노출 위험 | `trigger-detail-drawer.tsx` — `getWebhookUrl` 함수 | `NEXT_PUBLIC_WEBHOOK_BASE_URL` 환경 변수로 교체, 하드코딩 포트 치환 로직 제거 |
| 2 | 보안 | notification URL 입력 필드(`type="text"`)에 클라이언트 검증 없음. `javascript:`, `file://` 등 비정상 프로토콜 입력 시 SSRF 유발 가능 | `trigger-detail-drawer.tsx` — `ExternalInteractionCard` 편집 폼 `urlValue` 입력 | `type="url"` 변경 또는 `URL` 생성자로 `https://`/`http://`만 허용하는 클라이언트 검증 추가 |
| 3 | 보안 | `languageHintsJson` 파싱 시 키 개수·키/값 길이 상한 없음. 매우 큰 입력이 서버로 전달될 수 있음 | `trigger-detail-drawer.tsx` — `ChatChannelCard.handleSave` 내 `languageHintsJson` 파싱 블록 | 키 최대 50개, 값 최대 500자 등 클라이언트 검증 상한 추가 고려 |
| 4 | 요구사항 | `ChatChannelCard.handleSave`가 수동 `saving` state 패턴을 유지. 이번 W3(EIA useMutation 전환)의 의도와 파일 내 불일치 | `trigger-detail-drawer.tsx` — `ChatChannelCard` | 후속 PR에서 `ChatChannelCard.handleSave`도 `useMutation`으로 전환해 파일 전체 패턴 통일 |
| 5 | 요구사항 | spec `2-trigger-list.md §2.4`는 base_url을 "SaaS는 서비스 도메인"으로 명시하나 구현은 개발 포트 `:3011`을 하드코딩 | `trigger-detail-drawer.tsx` — `getWebhookUrl` 함수 | 환경 변수 또는 백엔드 응답에서 base_url을 주입하는 방식으로 교체 |
| 6 | 요구사항 | `viewer` 역할에서 Edit 버튼이 노출되지 않음을 검증하는 테스트 케이스 없음 | `trigger-detail-drawer.test.tsx` | `setRole("viewer")` 후 Edit 버튼이 없음을 검증하는 케이스 추가 |
| 7 | 요구사항 | i18n 번역값에 의존하는 `/Partner HMAC · HMAC/` 정규식 — 번역 변경 시 테스트 깨질 수 있음 | `trigger-detail-drawer.test.tsx` 230-232행, 262-264행 | i18n 사전의 실제 키 값을 확인하고 정규식 고정 또는 i18n mock으로 번역 결과 제어 |
| 8 | 요구사항 | `useCopyToClipboard` — `navigator.clipboard` 미존재 환경 시 TypeError 발생 가능. try/catch에서 잡히나 의도성 불명확 | `use-copy-to-clipboard.ts` | `if (!navigator.clipboard)` guard를 명시적으로 추가하고 관련 테스트 케이스 추가 |
| 9 | 부작용 | 테스트에서 `useLocaleStore.setState({ locale: "en" })` 후 명시적 teardown 없음. 파일 순서 의존 시 오염 가능성 | `trigger-detail-drawer.test.tsx` `beforeEach` 블록 | `afterEach`에서 `useLocaleStore`를 기본값으로 복원하거나 `reset()` 활용 |
| 10 | 부작용 | `Object.assign(navigator, { clipboard: { writeText } })`로 전역 `navigator.clipboard`를 패치하나 원본 복구 없음 | `use-copy-to-clipboard.test.tsx` `beforeEach` | `beforeAll`에서 원본 저장 후 `afterAll`에서 복원하는 패턴 추가 |
| 11 | 부작용 | `ExternalInteractionCard` Cancel 버튼에 `saveMutation.reset()` 미호출. 저장 실패 후 취소 시 `isError` stale 상태 잔류 | `trigger-detail-drawer.tsx` — `ExternalInteractionCard` cancel 버튼 onClick | `onClick={() => { saveMutation.reset(); setEditing(false); }}`로 수정 |
| 12 | 범위 | `void copyText(...)` 구문이 함수 반환 타입이 `void`로 바뀐 후에도 유지되어 의미상 불필요한 void 캐스팅 | `trigger-detail-drawer.tsx` — rotateResult/revokeResult 복사 버튼 onClick | `onClick={() => copyText(rotateResult)}`로 단순화 (비차단) |
| 13 | 유지보수성 | `trigger.type === "webhook"` 조건이 3개 카드에 개별적으로 반복됨. 조건 변경 시 3곳 모두 수정 필요 | `trigger-detail-drawer.tsx` — `TriggerDetailDrawer` JSX | 3개 카드를 단일 `{trigger.type === "webhook" && (<>...</>)}` 블록으로 묶어 조건 중복 제거 |
| 14 | 유지보수성 | `ChatChannelCard.handleSave` 내부에 JSON 파싱용 try-catch가 외부 try-catch 안에 중첩 | `trigger-detail-drawer.tsx` — `ChatChannelCard.handleSave` | `parseLanguageHints` 별도 함수로 분리해 중첩 제거 |
| 15 | 유지보수성 | `beforeEach`에서 `cleanup()` 수동 호출 — vitest 환경에서 자동 cleanup과 이중 실행됨 | `trigger-detail-drawer.test.tsx` 148-149행 | 다른 테스트 파일 패턴 확인 후 불필요한 경우 제거 |
| 16 | 테스팅 | `navigator.clipboard` 자체가 `undefined`인 환경 테스트 케이스 없음 | `use-copy-to-clipboard.test.tsx` | clipboard API 없을 때 `false` 반환 및 error toast 표시를 검증하는 케이스 추가 |
| 17 | 테스팅 | `beforeEach`가 `describe` 블록 바깥에 선언됨. 향후 `describe` 추가 시 의도치 않은 공유 setup 위험 | `use-copy-to-clipboard.test.tsx` 30-35행 | `beforeEach`를 `describe` 블록 내부로 이동 |
| 18 | 테스팅 | `manual` 타입 트리거 렌더 테스트 없음. 향후 `manual` 타입에 카드 추가 시 회귀 감지 어려움 | `trigger-detail-drawer.test.tsx` | `type: "manual"` 트리거 mock 후 카드가 렌더되지 않음을 확인하는 테스트 추가 |
| 19 | 테스팅 | `ExternalInteractionCard` 저장 성공/실패 경로 테스트 없음. 이번 변경의 핵심 W3(useMutation 교체)가 테스트로 검증되지 않음 | `trigger-detail-drawer.test.tsx` | Edit 클릭 → 저장 클릭 → API 성공/실패 각각을 검증하는 시나리오 테스트 추가 |
| 20 | 테스팅 | `open=false → open=true` 전환 후 쿼리 재실행 검증 없음 | `trigger-detail-drawer.test.tsx` | `open`을 `false → true`로 업데이트 시 API가 재실행되는지 확인하는 테스트 추가(optional) |
| 21 | 테스팅 | `ChatChannelCard` 저장 로직이 수동 `saving` 패턴을 유지하며 단위 테스트도 존재하지 않음 | `trigger-detail-drawer.tsx` — `ChatChannelCard`, `trigger-detail-drawer.test.tsx` | `ChatChannelCard`도 `useMutation`으로 리팩토링 후 저장 경로 테스트 추가(별도 PR 가능) |
| 22 | 테스팅 | `window.confirm` 직접 호출 경로에 대한 테스트 없음. JSDOM에서 기본 `false` 반환 | `trigger-detail-drawer.tsx` — `WebhookConfigCard.handleSaveClick`, `ExternalInteractionCard.handleRotateSecret`, `handleRevokeToken` | 해당 경로 테스트 시 `vi.spyOn(window, 'confirm').mockReturnValue(true/false)` 활용 가이드 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | 시크릿/토큰 평문 DOM 노출, 서버 에러 원문 toast 전달, webhook URL 포트 하드코딩 |
| requirement | LOW | 모든 발견이 INFO 수준. ChatChannelCard useMutation 미전환, viewer 역할 테스트 누락, getWebhookUrl spec 불일치 |
| scope | NONE | 명시된 커밋 범위(EIA useMutation, useCopyToClipboard 추출, 단위 테스트) 잘 준수 |
| side_effect | LOW | 테스트 내 Zustand store·navigator.clipboard 전역 변조 teardown 미흡, saveMutation.reset() 미호출 |
| maintainability | LOW | ChatChannelCard useMutation 미전환, EIA 편집 폼 native HTML 사용, 매직 넘버, cancel 시 상태 미초기화 |
| testing | LOW | viewer 역할·manual 타입·EIA 저장 경로 테스트 공백, DOM 접근 취약 셀렉터 |

---

## 발견 없는 에이전트

없음 (모든 실행된 reviewer에서 발견사항 존재).

---

## 권장 조치사항

1. **[즉시 / MEDIUM]** `ExternalInteractionCard`의 rotate/revoke 결과 시크릿·토큰에 자동 만료(30초 후 state null화) 또는 마스킹 UX 적용 — 보안 평문 노출 차단
2. **[즉시 / MEDIUM]** 에러 toast를 i18n 문자열로 일원화. `OverviewCard.onError` 패턴(`t("triggers.detail.saveFailed")`)을 `ExternalInteractionCard`, `ChatChannelCard`, `handleRotateSecret`, `handleRevokeToken` 등 전체에 적용
3. **[단기 / WARNING]** `ExternalInteractionCard` cancel 버튼에 미저장 입력값 리셋 로직 추가 (`urlValue`, `eventsValue` 등) 및 `saveMutation.reset()` 호출
4. **[단기 / WARNING]** `ExternalInteractionCard` 편집 폼의 native HTML 요소를 디자인 시스템 `Input`/`Label` 컴포넌트로 교체
5. **[단기 / WARNING]** `rateLimitPerMinute` 기본값 `60` 상수화 및 테스트에서 `webhookTitle.parentElement!` 셀렉터를 `data-testid` 기반으로 교체
6. **[단기]** `getWebhookUrl`의 `:3011` 하드코딩 포트를 `NEXT_PUBLIC_WEBHOOK_BASE_URL` 환경 변수로 교체 (보안 + spec 준수 동시 해결)
7. **[단기]** `ExternalInteractionCard` 저장 성공/실패 및 `viewer` 역할 분기 테스트 케이스 추가 (W3 핵심 변경 검증 공백 보완)
8. **[중기]** `ChatChannelCard.handleSave`를 `useMutation`으로 전환하여 파일 전체 패턴 통일 (별도 PR)
9. **[중기]** notification URL 입력 필드에 클라이언트 측 URL 프로토콜 검증 추가 (`https://`/`http://`만 허용)
10. **[선택]** `manual` 타입 트리거 렌더 테스트, `navigator.clipboard` 미존재 환경 테스트, `useLocaleStore` teardown 보완

---

## 라우터 결정

`routing_status=done` (router가 선별):

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing` (6명) — 모두 router_safety 규칙에 의한 강제 포함(소스 코드 변경 시 의무 검토)
- **강제 포함(router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외**: 8명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 반복문/I·O/데이터 구조 변경 없음 |
| architecture | 모듈 경계/DI 변경 없음, 기존 컴포넌트 내부 단순 리팩토링 |
| documentation | 공개 API 변경 없음, JSDoc/README 미수정 |
| dependency | package.json 변경 없음 |
| database | DB 마이그레이션/쿼리/ORM 변경 없음 |
| concurrency | async/Lock/Queue 패턴 신규 도입 없음 |
| api_contract | API route/contract 변경 없음 |
| user_guide_sync | 내부 컴포넌트 리팩토링, 신규 UI 문자열/API/노드 변경 없음 |
