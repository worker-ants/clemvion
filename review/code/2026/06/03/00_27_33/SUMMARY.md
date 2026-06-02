# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 버그 수정(user 발화 버블 중복 표시 회귀)이 올바르게 구현됐으며, Critical 발견은 없고 WARNING 1건(통합 테스트 시나리오 갭)과 INFO 수준 개선 제안 다수가 있다.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | Testing | `use-execution-events.test.ts` 에 "optimisticPending 버블 존재 상태 + handleUserMessage echo 도달" 통합 시나리오 테스트 누락 — 버그의 실제 발생 경로이나 이벤트 핸들러 레이어에서 검증되지 않음 | `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` "user_message early surface" 섹션 | `handleUserMessage` 호출 전 store 에 `optimisticPending: true` 버블을 사전 삽입하는 통합 테스트 케이스 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | Security | 서버 에러 메시지(내부 실행 ID 포함)가 `toast.error()`로 UI에 그대로 노출 | `use-execution-interaction-commands.ts` — `emitWithAck` 콜백 | 서버에서 `{ userMessage, debugInfo }` 분리 또는 프론트엔드에서 에러 코드→i18n 매핑 |
| I-2 | Security | content 문자열 단독 기반 reconcile 매칭 — 단일 세션 내 이론적 엣지 케이스 | `execution-store.ts` `appendOptimisticUserMessage` `pendingIdx` 탐색 | 향후 멀티탭/멀티세션 확장 시 `executionId` + 메시지 고유 ID를 dedup 키로 추가 |
| I-3 | Security | `requestPayload`/`responsePayload` 필드가 `ConversationItem`에 존재 — 민감 데이터 마스킹 정책 미문서화 | `execution-store.ts` `ConversationItem` 인터페이스 | WS 이벤트 핸들러에서 채워지는 경로에서 마스킹 정책 확인 및 문서화 |
| I-4 | Requirement | spec §9.7 `user_message` 행이 내부 reconcile 분기를 명문화하지 않음 — plan 에서 "spec 변경 불필요" 명시했으나 미세 spec-impl 회색지대 | `spec/conventions/conversation-thread.md` §9.7 | project-planner 위임 판단; 현 PR 범위에서 수정 의무 없음 |
| I-5 | Requirement | `receivedAt`가 빈 문자열일 때 optimistic bubble reconcile 경로의 동작 미검증 | `execution-store.ts` `appendOptimisticUserMessage` dedup/reconcile 블록 | `receivedAt=""` + optimisticPending 버블 조합 방어 테스트 추가 또는 plan에 known-edge-case 노트 |
| I-6 | Requirement | 동일 content의 다중 optimistic bubble 처리 시나리오 테스트 커버리지 없음 | `execution-store.ts` 라인 605–610 | INFO 수준; 테스트 추가 권장이나 필수 아님 |
| I-7 | Maintainability | `appendOptimisticUserMessage` reconcile 분기가 단일 클로저 약 55줄 — 추후 복잡도 증가 위험 | `execution-store.ts` `appendOptimisticUserMessage` | reconcile 로직(`findOptimisticPendingIdx` 등)을 순수 헬퍼 함수로 분리 권장 |
| I-8 | Maintainability | content 기반 매칭의 "동일 발화 연속 전송 시 첫 번째 pending 버블 흡수" trade-off가 코드에 명시 안 됨 | `execution-store.ts` pendingIdx findIndex 조건 | 인라인 주석에 "동일 content 중복 발화 시 첫 번째 pending 버블 흡수됨 — ai_message REPLACE가 최종 보정" 한 줄 추가 |
| I-9 | Maintainability | reconcile 시 `optimisticPending: undefined` 할당(vs `delete`)의 이유 미명시 | `execution-store.ts` reconcile 분기 map | 주석에 "spread 불변 패턴 — `delete` 대신 `undefined` 할당" 한 줄 추가 |
| I-10 | Maintainability | 테스트와 구현 양쪽에 reconcile 버그 배경 설명 주석 중복 | `execution-store.test.ts` / `execution-store.ts` | 테스트 주석은 관찰 가능 계약(reconcile 후 버블 1개)만 서술, 구현 세부사항 주석은 구현 쪽에 집중 |
| I-11 | Maintainability | `pendingIdx` 변수명 — 의도 불명확 | `execution-store.ts` reconcile 분기 | `optimisticPendingIdx`로 변경 권장 |
| I-12 | Testing | reconcile 후 `turnIndex` 값 보존 여부 미검증 | `execution-store.test.ts` reconcile 테스트 | `expect(items[0].turnIndex).toBe(1)` 한 줄 추가 |
| I-13 | Testing | `receivedAt=""` + optimisticPending 버블 존재 엣지 케이스 테스트 없음 | `execution-store.ts` `appendOptimisticUserMessage` | 옛 backend 호환 엣지 케이스 테스트 추가 (발생 드물어 INFO 수준) |
| I-14 | Documentation | `appendOptimisticUserMessage` 액션 JSDoc이 새로 추가된 reconcile 분기를 언급하지 않음 | `execution-store.ts` JSDoc | JSDoc에 "로컬 `optimisticPending` 버블이 있으면 APPEND 대신 reconcile" 설명 절 추가 |
| I-15 | Documentation | spec §9.7 `user_message` 행이 내부 reconcile 분기를 기술하지 않음 — spec-impl 미세 설명 차이 | `spec/conventions/conversation-thread.md` §9.7 | project-planner 위임 필요; 현 PR 범위에서 필수 아님 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 서버 에러 문자열 toast 직접 노출(내부 실행 ID), content 기반 reconcile 매칭 이론적 엣지 케이스, requestPayload/responsePayload 마스킹 정책 미문서화 |
| requirement | LOW | spec §9.7 reconcile 분기 명문화 부재(plan의 의도적 판단으로 허용), receivedAt 빈 문자열 + optimisticPending 조합 경계 케이스, 동일 content 다중 버블 처리 테스트 부재 |
| scope | NONE | 범위 이탈 없음; 4개 코드 파일·1개 plan 파일 모두 단일 목적에 집중 |
| side_effect | LOW | (재시도 후 success) |
| maintainability | LOW | reconcile 분기 인라인 집중(~55줄), content 매칭 trade-off 미명시, 테스트·구현 주석 중복, pendingIdx 변수명 불명확 |
| testing | LOW | 신규 3건 테스트 적절; use-execution-events.test.ts 통합 시나리오 미커버(W-1), turnIndex 보존 미검증, receivedAt="" 엣지 케이스 미커버 |
| documentation | LOW | ConversationItem.optimisticPending JSDoc 완비; appendOptimisticUserMessage 액션 JSDoc reconcile 분기 누락(INFO), spec §9.7 설명 차이(INFO) |

## 권장 조치사항

1. **(W-1 대응)** `use-execution-events.test.ts` "user_message early surface" 섹션에 "optimisticPending 버블 사전 존재 + echo 도달 → 버블 1개 유지" 통합 테스트 추가 — 버그 실제 발생 경로의 회귀 방어 강화
2. **(I-14 대응)** `appendOptimisticUserMessage` JSDoc에 reconcile 분기 설명 추가
3. **(I-8 대응)** content 기반 매칭의 "동일 발화 연속 전송 시 첫 번째 pending 버블 흡수" trade-off 인라인 주석 추가
4. **(I-11 대응)** `pendingIdx` → `optimisticPendingIdx` 변수명 변경
5. **(I-5/I-13 대응)** `receivedAt=""` + optimisticPending 버블 조합 방어 테스트 추가
6. **(I-1 대응, 중장기)** 서버 에러 메시지에서 내부 실행 ID 노출 분리

## 라우터 결정

라우터가 선별 실행함 (`routing=done`).

- **실행 (강제 포함 7명)**: security, requirement, scope, side_effect, maintainability, testing, documentation
- **제외 (7명)**: performance, architecture, dependency, database, concurrency, api_contract, user_guide_sync — 변경 성격상 무관(동기 store 상태 업데이트, 모듈 경계/의존성/DB/async/API 계약 변경 없음)
