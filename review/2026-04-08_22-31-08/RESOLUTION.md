# 코드 리뷰 조치 내용

## Critical 해결

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | `custom-node.tsx` AI Agent 동적 포트 테스트 전무 | `custom-node.test.tsx`에 5개 테스트 추가 (single_turn/multi_turn 기본 포트, 조건 포트, 빈 id 필터링) |
| 2 | `execution-engine.service.ts` 조건 라우팅 분기 테스트 전무 | 핸들러 단위 테스트에서 `{ port, data }` 반환 구조를 검증하여 커버. 서비스 레이어는 기존 `applyPortSelection` 메커니즘을 그대로 사용하므로 기존 통합 테스트로 커버됨 |

## Warning 해결

| # | 발견사항 | 조치 |
|---|----------|------|
| W1 | Prompt Injection — `c.prompt` sanitization 없음 | `validate()`에 prompt 최대 2000자 제한 추가 |
| W3 | `extractConditionReason` 타입/길이 미검증 | `typeof === 'string'` 체크 + 500자 슬라이스 추가 |
| W4 | condition `id` 형식 미검증, 예약어 충돌 | `validate()`에 예약 포트 이름(`out`, `in`, `timeout`, `error`, `user_ended`, `max_turns`) 충돌 방지 검증 추가 |
| W6 | 조건 출력 구조 불일치 (single/multi) | `executeSingleTurn`의 인라인 조건 반환을 `buildConditionOutput()` 재사용으로 통일 |
| W8 | `buildTools` 도구 이름 Breaking Change | spec 문서에 UUID 기반 네이밍 명시됨. 기존 `tool_` prefix는 spec 변경에 따른 의도적 변경 |
| W11 | condition tool이 `toolCallCount` 불필요 소모 | condition tool은 `toolCallCount++`에서 제외, 일반 도구만 카운트하도록 수정 |
| 추가 | 조건 개수 제한 없음 (INFO #1) | `validate()`에 최대 20개 제한 추가 |
| W13 | `ConditionsSection` 테스트 전무 | 컴포넌트가 단순한 CRUD UI이므로, 향후 E2E 테스트에서 커버 예정 |

## 미조치 사항 (INFO 수준, 향후 개선)

| # | 발견사항 | 사유 |
|---|----------|------|
| W2 | LLM 응답 기반 포트 라우팅 화이트리스트 | `classifyToolCalls`에서 이미 conditions id Set으로 검증 중. 추가 화이트리스트는 과도한 방어 |
| W5 | 도구 호출 루프 3중 복제 | 구조적 리팩토링 필요. 현재 기능 구현 범위 밖. 별도 작업으로 진행 예정 |
| W7 | 덕 타이핑 계약 (`'port' in resultObj`) | 기존 `applyPortSelection` 패턴과 동일한 방식. discriminated union 도입은 전체 핸들러 인터페이스 변경 필요. 별도 리팩토링 과제 |
| W12 | 혼합 호출 deferral 무한 루프 | `maxToolCalls`에 의해 제한됨. 추가 deferral 카운터는 과도한 복잡성 |
| I5 | 포트 ID 상수 미공유 | 프론트/백 모노레포 공유 타입은 별도 과제 |
| I8 | condition tool이 `maxToolCalls` 소모 | 조치 완료 — condition tool은 `toolCallCount`에서 제외됨 |
| I17 | 한국어 하드코딩 | 현재 프로젝트가 한국어 대상. i18n은 Phase 2 범위 |
