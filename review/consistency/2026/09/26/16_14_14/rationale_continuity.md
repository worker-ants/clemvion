# Rationale 연속성 검토 — assistant-e2e-contract-gaps (--impl-prep)

## 대상

plan `plan/in-progress/assistant-e2e-contract-gaps.md` — `codebase/backend/test/workflow-assistant.e2e-spec.ts` 의
테스트 F(`sessions/latest`) · 테스트 H(도구 호출 선택 키 생략) 세 칸을 메우는 **테스트 전용** 변경
(`spec_impact: none`, 제품 코드·spec 변경 없음).

## 발견사항

없음. 세 항목 모두 기존에 이미 확정·구현된 계약을 그대로 노출하는 커버리지 보강이며, 기각된 대안의
재도입·원칙 위반·무근거 번복·invariant 우회 어느 것에도 해당하지 않는다.

### 대조 근거 (교차 확인)

1. **`sessions/latest` → `{ data: null }` (200)**
   - `workflow-assistant.controller.ts` `latest()` 는 `ApiOkWrappedNullableResponse(AssistantSessionDto)` 로 선언돼 있고
     `findLatestActive()` 가 못 찾으면 `null` 을 그대로 반환 — 컨트롤러가 `NotFoundException` 을 던지지 않는다.
   - `spec/conventions/swagger.md` §5-2 는 `ApiOkWrappedNullableResponse` 를 정확히 "없으면 `null` 인 «최근 항목» 조회"
     용도로 문서화한다 — `sessions/latest` 가 바로 그 예시 패턴.
   - `spec/5-system/2-api-convention.md` §5.4 "부재 표현" 은 **상시 존재하는 필드의 부재는 `null` 이 기본**이라고
     명시하고, §6 상태 코드표는 200 을 "조회 성공" 으로 규정 — 리소스가 아직 없는 조회에 404 를 쓰라는 규칙이 없다.
   - `spec/3-workflow-editor/4-ai-assistant.md` §6.1 "세션 자동 선택 규칙" 도 "없으면 패널은 빈 상태" 라고 적어
     부재를 정상 200 경로로 다룬다.
   - 따라서 plan 처방 1(`{data: null}` 검증 추가)은 새 결정이 아니라 **이미 세 문서가 합의한 계약**을 e2e 로
     고정하는 것.

2. **테스트 F — `toBe(200)` 로 좁히기**
   - 현재 테스트는 `expect([200, 204, 404]).toContain(latest.status)` 로 과관용하지만, 컨트롤러 코드 경로에는
     204·404 를 낼 분기가 없다(§1 근거와 동일 소스).
   - `git log -p` 로 이 컨트롤러 이력을 확인한 결과 `sessions/latest` 가 204/404 를 낸 시점은 없다 — "과거에
     204/404 였다가 200 으로 바뀐" 번복이 아니라, 애초에 과관용했던 테스트를 실제 계약에 맞추는 정정이다.
   - 이 항목은 이미 `review/consistency/2026/09/26/13_17_19` 계열 검토에서 INFO 로 지목되고 트래커
     (`plan/in-progress/spec-draft-nullable-notation-followups.md`) 에 등재된 후속 조치 — 새로 발명한 처방이 아니라
     기존 검토 이력을 그대로 잇는다.

3. **테스트 H — 선택 키(`result`/`planStepId`/`planStepIds`/`signature`) 전부 생략한 도구 호출 추가**
   - `AssistantToolCallDto` 의 네 필드는 모두 `@ApiPropertyOptional()` 이고 JSDoc 이 각각 "결과가 기록되기 전에는
     키가 없다" / "공급자가 다음 호출에 되돌려 받아야 하는 불투명 서명 … 없으면 키가 없다" 로 **키 생략**을
     명시적으로 문서화한다.
   - `spec/5-system/2-api-convention.md` §5.4 의 "키 생략" 표현 기준 (a)/(b) 대비 이 필드들의 JSDoc 사유가 이미
     존재하므로, 새 필드·새 결정이 아니라 **이미 문서화된 optional 계약의 반대쪽 끝(전부 생략)을 검증에 추가**하는
     것 — 반대쪽 끝(전부 채움)은 이미 같은 테스트에 존재해 비대칭이 있었을 뿐이다.

## 요약

세 항목 모두 제품 코드·spec 변경이 없는 순수 테스트 보강이며, 검토 결과 어느 것도 과거 spec Rationale 이
기각한 대안을 되살리거나, 합의된 설계 원칙(부재 표현 `null`-우선 규칙, nullable 래퍼 헬퍼의 의도된 용도,
optional 필드의 키-생략 계약)을 벗어나지 않는다. 오히려 세 항목 모두 `spec/conventions/swagger.md` §5-2,
`spec/5-system/2-api-convention.md` §5.4, `spec/3-workflow-editor/4-ai-assistant.md` §6.1 이 이미 합의해 둔 계약을
정확히 반영하며, 테스트 F 의 처방은 선행 리뷰(`13_17_19`)·트래커 항목의 연속선상에 있다. Rationale 연속성
관점에서 차단할 사유가 없다.

## 위험도

NONE
