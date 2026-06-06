# Code Review 통합 보고서

> 대상: webchat eager start (§R6 — 패널 open 시 execution 시작, firstMessage 폐기)
> 세션: `review/code/2026/06/06/12_47_01`
> 생성일: 2026-06-06

---

## 전체 위험도

**LOW** — Critical 발견 없음. 두 개의 WARNING(아키텍처 God Hook 누적·부작용 미문서화)과 다수의 INFO(기능 결함 포함 1건: `newChat` 시 `pendingSendRef` 미초기화). 이전 라운드(12_14_27)의 Critical(C1 텍스트 유실)·Warning들(W3/W5/W6/W7/W8/W9)은 모두 해소됐으며, `startedRef` 가드·`pendingSendRef` 큐·`newChat` 정리 확장이 안정적으로 구현됐다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 아키텍처 | `useWidget` God Hook — 8개 관심사 단일 집중, 이번 변경으로 누적 심화. `startedRef`, `pendingSendRef`, C1 useEffect, `newChat` 확장 등이 추가되며 경계 수준에 도달 | `use-widget.ts` 전체 (~330줄) | 즉각 리팩터 불필요. `scheduleRefresh`·`refreshTimerRef`를 `useTokenRefresh` 훅으로 분리하는 것이 가장 독립성 높은 후보 — backlog(W4) 유지 권장 |
| W2 | 아키텍처 | `newChat` — 7단계 순서 의존 부작용이 단일 콜백에 집중. `sessionRef.current=null`이 `start()` 가드에 영향하는 등 순서가 중요하지만 새 경로 추가 시 리셋 누락 위험 | `use-widget.ts` `newChat` useCallback | 현재 주석 수준 양호. 향후 세 번째 재시작 경로 추가 시 `resetAndStart()` 헬퍼로 캡슐화 고려 |
| W3 | 부작용 | `open()` 함수가 네트워크 호출(`POST /api/hooks`)을 암묵적으로 수행하게 됐으나, 함수 정의부에 JSDoc/주석이 없어 외부 소비자가 예상치 못한 네트워크 부작용을 경험할 수 있음 | `use-widget.ts` `open` useCallback | `open` 콜백 정의부에 "패널 open 시 execution 시작(POST /api/hooks) — eager §R6" 수준 주석 추가 |
| W4 | 동시성 | `start()` check-then-set 비원자 가드 — `newChat()` 리셋 직후 외부 `open()`이 함께 실행될 경우 두 `start()`가 모두 체크를 통과하는 이론적 간극 잔존. JSDoc 문서화는 됐으나 구조적 보호 장치 미변경 | `use-widget.ts` `start()` 함수 | 현재 단일 스레드 모델에서 실용적으로 안전. 향후 `start()` 내 첫 `await` 이전에 비동기 분기가 생기면 즉시 경쟁 조건 발생 — 코드 리뷰 시 이 위치 주의 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 기능 결함 | `newChat()` 시 `pendingSendRef` 미초기화 — booting 중 입력 후 `newChat()` 호출 시, 새 대화 `awaiting_user_message` 진입 때 이전 대화 텍스트가 flush될 수 있음 (requirement·side_effect 두 reviewer 모두 독립적으로 발견) | `use-widget.ts` `newChat` 콜백 (`sessionRef.current = null` 직후) | `pendingSendRef.current = null` 추가 — 1줄 수정으로 완전 해소 가능 |
| I2 | 아키텍처 | `start()` 공개 노출 — eager 시작 이후 `open()` 내부에서만 호출되어야 하나 `actions` 객체에 여전히 공개됨. 주석(I3)으로 의도 명시 완료 | `use-widget.ts` 반환 객체 `actions.start` | 하위 호환 깨지 않는다면 향후 `actions`에서 제거 또는 `deprecated` 주석 추가 검토 |
| I3 | 아키텍처 | `panel.tsx` Composer disabled 조건 — `"buttons"`, `"form"` blocklist 방식. 새 `ExternalInteractionType` 추가 시 조건 수정 누락 위험 (OCP) | `panel.tsx` L104–114 | 타입이 5개 이상으로 늘면 allowlist 방식(`pending?.type !== "ai_conversation"`) 전환 검토. 현재 3개 고정이므로 즉각 변경 불필요 |
| I4 | 아키텍처 | `widget-state.ts` 파일 상단 주석이 `panel` transient 단계를 생략해 `WidgetPhase` union 실제와 미묘하게 불일치 | `widget-state.ts` 파일 상단 주석 | `"collapsed → (open) panel(transient) → booting(eager, §R6) → ..."` 형태로 `panel` 명시 권장 |
| I5 | 보안 | `configFromQuery()` — `apiBase` URL 쿼리 파라미터 수용으로 임의 서버 지정 가능한 SSRF-유사 경로 존재. 정상 iframe 내장 환경에서는 host `BootMessage`가 덮어써 완화됨 | `use-widget.ts` `configFromQuery` (라인 81–88) | allowlist 또는 same-origin 제한 보강, 또는 프로덕션 직접 URL 접근 차단 정책 문서화 |
| I6 | 보안 | `startConversation` payload에 open index signature `[k: string]: unknown` 잔존 — 호출자가 임의 필드를 서버로 전송 가능한 escape hatch | `eia-client.ts` `startConversation` payload 타입 (라인 58) | index signature 제거 후 허용 필드 명시적 열거 권장 |
| I7 | 부작용 | `newChat()` — 복수 부작용(스트림/타이머/스토리지/ref/상태/네트워크) 범위가 JSDoc에 미명시 | `use-widget.ts` `newChat` useCallback | JSDoc에 부작용 범위(스트림/스토리지/네트워크) 명시 |
| I8 | 유지보수 | `submitMessage`와 `panel.tsx` Composer `disabled`의 이중 guard 간 상호 참조 없음 — 한쪽 조건 완화 시 다른쪽 의도 파괴 위험 | `use-widget.ts` `submitMessage`, `panel.tsx` Composer disabled | 양쪽에 "UI guard와 logic guard가 함께 동작 — 양쪽 모두 변경 시 주의" 상호 참조 주석 추가 |
| I9 | 유지보수 | `NO_EXTRA_CALL_WAIT_MS = 20` 상수 추출됐으나 20ms인 이유(jsdom 비동기 flush 확인 최소 대기) 미기재 | `use-widget-eager-start.test.ts` | 상수 선언 옆 주석에 목적 설명 추가. 장기적으로 fake timer + `waitFor` 역-assertion 패턴 전환 권장 |
| I10 | 테스트 | `panel.test.tsx` `BASE_ACTIONS` — 모듈 최상위 생성으로 테스트 간 호출 횟수 누적 위험. 현재는 상태 단언만 해 실질 문제 없음 | `panel.test.tsx` `BASE_ACTIONS` 정의 | `beforeEach(() => vi.clearAllMocks())` 추가 또는 `beforeEach` 내 재생성 |
| I11 | 테스트 | C1 flush effect — `buttons`/`form` 첫 표면 시 큐 폐기 경로 미검증 | `use-widget-eager-start.test.ts` | "open → submitMessage → buttons 표면 도착 → interact 미호출(큐 폐기)" 케이스 추가 — 백로그 수준 |
| I12 | 테스트 | `ended` 상태 재-open 동작 테스트 미존재 — `startedRef=true` 유지로 no-op인지, `newChat`으로만 새 execution 가능한지 미명시 | `use-widget-eager-start.test.ts` | `ended + open() → no-op` 또는 `ended + newChat → 새 POST` 의도 케이스 추가 — 백로그 수준 |
| I13 | SPEC-DRIFT | [SPEC-DRIFT] `1-widget-app.md` `awaiting_user_input` → `awaiting_user_message` 표기 수정 — 이전 리뷰(12_14_27) I2 SPEC-DRIFT 지적이 이미 spec에 반영된 것으로 확인됨. `plan/in-progress/spec-update-webchat-eager-start.md` I2 항목 closed 처리 필요 | `spec/7-channel-web-chat/1-widget-app.md` §3 다이어그램 | plan 항목 closed 처리 후 완료 확인 |
| I14 | 문서화 | plan 체크리스트 잔여 2항목(`consistency-check --impl-done`, `plan complete 이동`) 미완료 — 실제 진행 상태와 일치하는 정상 상태 | `plan/in-progress/webchat-eager-start.md` | `consistency-check --impl-done` 완료 후 plan 이동 절차 이행 필요 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | INFO 6건(SSE 쿼리 토큰·fail-open embed·configFromQuery apiBase·pendingSendRef 조용한 폐기·errMessage 노출·index signature). 모두 알려진 트레이드오프 또는 기존 패턴 |
| architecture | LOW | WARNING 2건(God Hook 누적·newChat 순서 의존). INFO 6건 |
| requirement | LOW | INFO 3건. 핵심: `newChat()` 시 `pendingSendRef` 미초기화로 이전 대화 텍스트 유출 가능 경로 |
| scope | NONE | 변경 파일 전부 §R6 범위 내. nav 링크 추가 1건은 오류 수정 성격으로 수용 가능 |
| side_effect | LOW | WARNING 2건(`open()` 네트워크 부작용 미문서화·`newChat` 다단계 부작용 미명시). INFO 5건(핵심: `pendingSendRef` 미초기화 상태 오염 경로) |
| maintainability | LOW | INFO 8건. 핵심: `startedRef` 리셋 책임 분산·이중 guard 상호 참조 부재·테스트 시간 의존 패턴 |
| testing | LOW | INFO 6건. 핵심: negative assertion 시간 대기 패턴·C1 flush buttons/form 폐기 경로 미검증·ended 재-open 미명시 |
| documentation | LOW | INFO 10건. 이전 리뷰(I11/I12/I3/I8/I9/W3/W10) 지적사항 모두 처리 완료 확인. SPEC-DRIFT I2도 이미 반영됨 |
| concurrency | LOW | WARNING 1건(`start()` check-then-set 비원자 가드 구조 미변경). INFO 4건. W9(refreshTimerRef 미정리) 완전 해소 확인 |
| api_contract | NONE | `firstMessage` 제거는 클라이언트 TypeScript 타입만 변경, 서버 계약 파손 없음 |

---

## 발견 없는 에이전트

- **scope**: 범위 이탈 없음 (nav 링크 추가는 오류 수정 성격으로 허용 범위)
- **api_contract**: 서버 API 계약 변경 없음

---

## 권장 조치사항

1. **[즉시] `newChat()` 에 `pendingSendRef.current = null` 추가** — `sessionRef.current = null` 직후 1줄 수정. 이전 대화 큐 텍스트의 새 대화 유출 경로 완전 차단 (I1, requirement·side_effect 두 reviewer 독립 발견)
2. **[단기] `open()` 콜백 정의부에 네트워크 부작용 주석 추가** — "패널 open 시 execution 시작(POST /api/hooks) — eager §R6" (W3)
3. **[단기] `widget-state.ts` 파일 상단 주석에 `panel(transient)` 명시** — `"collapsed → (open) panel(transient) → booting(eager §R6) → ..."` (I4)
4. **[단기] `submitMessage`·`panel.tsx` 이중 guard 상호 참조 주석 추가** — 양쪽에 "UI guard와 logic guard 연동" 명시 (I8)
5. **[후속] plan 체크리스트 완료** — `consistency-check --impl-done` 후 `plan complete` 이동 (I14)
6. **[백로그] `useTokenRefresh` 훅 분리** — `useWidget` God Hook의 토큰 갱신 로직(`scheduleRefresh`, `refreshTimerRef`) 독립 훅으로 추출 (W1)
7. **[백로그] `resetAndStart()` 헬퍼 캡슐화** — 세 번째 재시작 경로 추가 전 `startedRef 리셋 + start()` 단위화 (W2)
8. **[백로그] C1 flush buttons/form 폐기 경로 테스트 추가** — "booting 중 submitMessage → buttons 표면 → 큐 폐기 확인" (I11)
9. **[백로그] `ended + open()` 동작 테스트 명시** — no-op 또는 newChat-only 정책 테스트로 고착 (I12)
10. **[백로그] `configFromQuery` apiBase allowlist 보강** — SSRF-유사 경로 완화. 또는 프로덕션 직접 URL 접근 차단 정책 문서화 (I5)

---

## 라우터 결정

라우터가 reviewer를 선별하여 실행했습니다 (`routing_status=done`).

- **실행**: `architecture`, `api_contract`, `concurrency`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (10명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외**: 4명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |