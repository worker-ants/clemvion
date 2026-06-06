# Code Review 통합 보고서

> 세션: `review/code/2026/06/06/12_58_00`
> 대상: webchat eager start §R6 — resolution 커밋 6a4af359 (12_14_27 리뷰 후속 수정)
> 생성일: 2026-06-06

---

## 전체 위험도

**LOW** — Critical 발견 없음. 기능·API 계약·변경 범위는 정상. Warning 7건(테스트 타이밍, 코드 중복, 상태 전이 누락 등)이 있으나 즉각 서비스 장애를 유발하는 수준은 아님. 전반적으로 이전 리뷰(12_14_27)의 Critical·Warning 해소가 충실하게 이루어진 resolution 커밋이다.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `start()` 의 신규 catch 블록에서 `errMessage(e)` 가 서버 에러 메시지(예: DB 호스트·스택 정보)를 위젯 UI 에 직접 노출할 수 있는 정보 유출 경로 | `use-widget.ts` — `start` catch 블록 | `errMessage` 가 서버 응답 body 를 그대로 노출하는지 확인 후 사용자에게는 일반화 메시지, 상세는 `console.error` 로만 출력 |
| 2 | 보안 | `pendingSendRef` 단일 항목 큐 제약이 코드에 명시되지 않아 향후 배열 확장 시 DoS(대량 메시지) 가능성 | `use-widget.ts` — `submitMessage` / C1 flush effect | 현재 "최신 1건" 제약과 향후 배열 전환 시 상한 강제 요건을 코드 주석으로 명시 |
| 3 | 아키텍처 | `useWidget` God Hook 이 C1 큐 추가로 관심사 9개로 증가. `pendingSendRef` + flush effect 가 `submitMessage` 와 분산 | `use-widget.ts` 전체 | `usePendingMessageQueue` 전용 훅 추출을 backlog 등록 |
| 4 | 부작용 | `open()` 이 순수 UI 이벤트에서 네트워크 부작용 함수로 의미 변경됐으나 `open` 콜백 자체의 주석이 불충분 — host SDK 통합 코드가 오해할 수 있음 | `use-widget.ts` — `open` 콜백 | `open` JSDoc 에 "네트워크 부작용 포함 — webhook POST 트리거" 명시 보강 |
| 5 | 유지보수성 | `pending.type !== "buttons" && pending.type !== "form"` 조건이 `submitMessage`, C1 flush effect, `panel.tsx` Composer disabled 3곳에 완전 중복 — 타입 확장 시 silent regression 위험 | `use-widget.ts` 약 246-250행, 271행; `panel.tsx` 110-114행 | `isTextInputSurface(pending)` 헬퍼 추출 후 3곳에서 공유 |
| 6 | 테스트 | `panel.test.tsx` 에 `ended` phase 에서 Composer 미렌더(`!isEnded` 조건) 케이스 없음 — 조건 제거 회귀를 잡지 못함 | `panel.test.tsx` | `phase=ended → queryByLabelText("메시지 입력")` 가 DOM 에 없음을 단언하는 케이스 1개 추가 |
| 7 | 테스트 | "추가 POST 없음" 검증에 wall-clock `setTimeout(r, 20ms)` 사용 — CI 환경 부하에 따라 false negative 또는 타이밍 취약 | `use-widget-eager-start.test.ts` 라인 481-482, 497-498, 575-576 | `vi.useFakeTimers()` + `vi.runAllTimersAsync()` 또는 `waitFor` polling 으로 대체 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `cfg.profile` 에 대한 클라이언트 측 sanitize/validation 없음 — 악의적 호스트가 대용량 페이로드 전달 가능 | `use-widget.ts` — `start()` 내 `startConversation` | 서버 측 검증(화이트리스트 키·크기 제한) 확인; 클라이언트 측 JSON 직렬화 길이 제한 고려 |
| 2 | 보안 | `[k: string]: unknown` 인덱스 시그니처로 임의 키-값 서버 전달 escape hatch 유지 | `eia-client.ts` — `startConversation` payload 타입 | 의도적 확장성임을 주석 명시; 동적 사용자 입력을 이 경로로 전달하지 않도록 가이드라인 추가 |
| 3 | 보안 | `localStorage` 에 per_execution 토큰 평문 저장 — eager 시작으로 세션 스코프가 넓어짐 | `use-widget-eager-start.test.ts` L487-489 | 단기 위험 제한적(만료 90분, per-execution). 중장기 `sessionStorage` 전환 또는 httpOnly cookie 방식 검토 |
| 4 | SPEC-DRIFT | [SPEC-DRIFT] `spec/7-channel-web-chat/3-auth-session.md §3` step 1 — 워크트리 spec 이미 `POST /api/hooks/:path { profile }` 으로 갱신 완료. main 브랜치 머지 시 PR 내에서 처리됨 | `spec/7-channel-web-chat/3-auth-session.md` 40행 | 코드 유지. 별도 조치 불필요 |
| 5 | SPEC-DRIFT | [SPEC-DRIFT] `spec/7-channel-web-chat/1-widget-app.md §3` 상태기계 다이어그램 — 워크트리 spec 이미 `panel(transient)──eager start──▶ booting`, `awaiting_user_message` 로 갱신 완료 | `spec/7-channel-web-chat/1-widget-app.md` 55행 | 코드 및 spec 유지 |
| 6 | 요구사항 | `actions.start` 외부 공개 — 하위 호환 주석은 있으나 실제 외부 호출 경로 존재 여부 미확인 | `use-widget.ts` L826 반환 객체 | 코드베이스 전체 `actions.start` 직접 호출 grep 확인; 사용 경로 없으면 반환 객체에서 제거 검토 |
| 7 | 부작용 | `newChat()` — 상태 리셋과 `start()` 사이 단일 tick 창에서 외부 `open()` 과 경합 가능성(이론적) | `use-widget.ts` — `newChat` 콜백 | 현 구현 실용적으로 충분. W9 조치로 가장 위험한 경로 해소됨 |
| 8 | 부작용 | `start()` 실패 후 `ended` 상태에서 재open 시 `ended → booting` 직접 전이 — reducer 에서 명시적 정의·테스트 없음 | `use-widget.ts` — `start` catch 블록 | W8 테스트가 부분 커버. `ended` 상태의 `OPEN` + `START` 처리 명시적 검증 추가 권장 |
| 9 | 유지보수성 | `newChat` 콜백의 8단계 순서 의존성이 단일 함수에 집중 — 주석과 코드 단계 목록 불완전 일치 | `use-widget.ts` — `newChat` 313-327행 | `teardownSession()` 헬퍼 추출 backlog 등록; 주석·코드 단계 동기화 |
| 10 | 유지보수성 | C1 테스트의 58줄짜리 `fetchMock` 인라인 정의 — `installFetch` 와 POST 분기 로직 사실상 복사-변형 | `use-widget-eager-start.test.ts` 505-559행 | `installFetch(overrides)` 에 `interactStatus?`, `webhookResponses?` 옵션 추가해 공유 |
| 11 | 테스트 | `widget-state.test.ts` 에 `ERROR` 액션 → `phase === "ended"` 단언 케이스 없음 — W8 테스트가 암묵적으로 가정 | `use-widget-eager-start.test.ts` L615 | `widget-state.test.ts` 에 `ERROR` action → `phase=ended` 케이스 추가 또는 주석으로 참조 명시 |
| 12 | 테스트 | `panel.test.tsx` `BASE_ACTIONS` `vi.fn()` 이 `beforeEach` clearMock 없이 공유 — 향후 호출 횟수 단언 추가 시 누적 오염 | `panel.test.tsx` 14-20행 | `beforeEach(() => vi.clearAllMocks())` 추가 |
| 13 | 문서화 | `spec/7-channel-web-chat/1-widget-app.md` 다이어그램에 `awaiting_user_input` 오타 — 실제 코드는 `awaiting_user_message` | `spec/7-channel-web-chat/1-widget-app.md` §3 | 다이어그램 수정 (이미 SPEC-DRIFT W2/I2 로 draft 위임 중) |
| 14 | 문서화 | `actions.start` 에 `@deprecated` 태그 미부재 — 하위 호환 목적 노출이나 소비자가 타입만 보면 인지 불가 | `use-widget.ts` 반환 `actions` | `/** @deprecated open() 이 자동 호출 — 직접 호출 불필요 */` 추가 (선택) |
| 15 | 동시성 | C1 flush effect `state.pending?.nodeId` 가 클로저에서 캡처 — 빠른 SSE 연속 이벤트 시 stale nodeId 전송 가능성 | `use-widget.ts` — C1 flush useEffect | effect deps 에 `state.pending?.nodeId` 추가 고려 (실용적 위험 낮음) |
| 16 | API 계약 | `firstMessage` 제거 후 `[k: string]: unknown` 시그니처로 타입 레벨 강제 불완전 — 호출자가 `firstMessage` 를 넘겨도 TypeScript 에러 미발생 | `eia-client.ts` | 실질 위험 없음. 더 강한 보장 필요 시 인덱스 시그니처 제거 또는 `Omit` 고려 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `start()` catch 블록 에러 메시지 UI 노출(W), `pendingSendRef` 큐 제약 미명시(W) |
| architecture | LOW | `useWidget` God Hook 관심사 9개로 증가(W), 나머지 INFO |
| requirement | LOW | `actions.start` 외부 공개(W), 핵심 요구사항·spec 갱신 완료 확인 |
| scope | NONE | 모든 변경이 이전 리뷰 지시 사항 이행. 범위 일탈 없음 |
| side_effect | LOW | `open()` 의미 변경(네트워크 부작용, W), `newChat` tick 창 경합(W), `ended` 재open 전이 미정의(W) |
| maintainability | LOW | `pending.type` 조건 3중 중복(W), `newChat` 8단계 순서 의존(W) |
| testing | LOW | `ended` Composer 미렌더 케이스 없음(W), wall-clock 타이밍 의존(W), `ERROR→ended` 암묵적 가정(W) |
| documentation | LOW | `awaiting_user_input` 오타(INFO, 위임 중), 나머지 긍정 확인 |
| concurrency | LOW | check-then-set 패턴 구조적 취약성(W, 현재 안전), `pendingSendRef` 덮어쓰기 정책 미명시(W) |
| api_contract | NONE | 하위 호환성 파손 없음. 엔드포인트·응답 스키마·인증 변경 없음 |

---

## 발견 없는 에이전트

- **api_contract**: 서버 API 계약 변경 없음 — 위험도 NONE
- **scope**: 변경 범위 이전 리뷰 지시 사항과 완전 일치 — 위험도 NONE

---

## 권장 조치사항

1. **(W-가장 시급) 에러 메시지 UI 노출 차단**: `start()` catch 블록의 `errMessage(e)` 가 서버 응답 body 를 그대로 노출하는지 검토 후, 사용자 노출 메시지는 일반화하고 상세 내용은 `console.error` 로만 출력. (`use-widget.ts`)
2. **(W) `pending.type` 조건 헬퍼 추출**: `isTextInputSurface(pending)` 를 `widget-state.ts` 또는 유틸에 추출해 `submitMessage` / C1 flush effect / `panel.tsx` 3곳 공유. 타입 확장 시 누락 방지.
3. **(W) `panel.test.tsx` `ended` phase Composer 미렌더 케이스 추가**: `queryByLabelText("메시지 입력").not.toBeInTheDocument()` 단언으로 `!isEnded` 조건 회귀 잡기.
4. **(W) 테스트 타이밍 의존 해소**: `setTimeout(r, 20ms)` → `vi.useFakeTimers()` + `vi.runAllTimersAsync()` 또는 `waitFor` polling 으로 대체.
5. **(W) `open()` JSDoc 네트워크 부작용 명시 보강**: `open` 콜백 자체에 "webhook POST 트리거" 명시 추가.
6. **(INFO backlog) `usePendingMessageQueue` 훅 추출**: `useWidget` 관심사 집중 완화. 중장기 리팩터 대상.
7. **(INFO backlog) `widget-state.test.ts` `ERROR` → `ended` 케이스 추가**: W8 테스트의 암묵적 가정을 reducer 단위 테스트로 명시.
8. **(INFO backlog) `actions.start` 제거 또는 `@deprecated` 처리**: 외부 호출 경로 grep 확인 후 경로 없으면 제거, 있으면 `@deprecated` 태그.
9. **(INFO backlog) `teardownSession()` 헬퍼 추출**: `newChat` 8단계 teardown 을 별도 함수로 캡슐화.
10. **(INFO backlog) `spec/1-widget-app.md` `awaiting_user_input` → `awaiting_user_message` 오타 수정**: project-planner 위임 경로로 처리 중.

---

## 라우터 결정

라우터가 reviewer 를 선별 실행함 (`routing_status=done`).

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`, `api_contract` (10명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외**: 4명

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |