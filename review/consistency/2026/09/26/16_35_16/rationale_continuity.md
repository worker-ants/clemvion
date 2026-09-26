# Rationale 연속성 검토 — assistant-e2e-contract-gaps (--impl-prep)

## 범위 확인

plan(`plan/in-progress/assistant-e2e-contract-gaps.md`, `spec_impact: none`)은 `codebase/backend/test/workflow-assistant.e2e-spec.ts`
세 칸(F 의 상태 코드 단언 좁히기, `sessions/latest` 의 `data: null` 케이스 추가, H 의 도구 호출에 선택 키 전부 생략한 항목 추가)만
바꾼다. **제품 코드·spec 문서 변경이 없다.** 번들된 target 은 이 e2e 가 대조하는 영역인 `spec/3-workflow-editor/4-ai-assistant.md`
전문 + 관련 spec(`5-system/2-api-convention.md`, `conventions/swagger.md`)의 `## Rationale` 발췌다. 아래는 그 Rationale 들과
plan 의 세 처방을 대조한 결과다.

## 발견사항

- **[INFO]** `sessions/latest` 상태-코드 단언 좁히기는 과거 결정 번복이 아니라 미확정 방어 코드의 정합화
  - target 위치: plan §처방 2 (`codebase/backend/test/workflow-assistant.e2e-spec.ts` 테스트 F, `expect([200, 204, 404]).toContain(...)` → `toBe(200)`)
  - 과거 결정 출처: 해당 tri-state 단언을 도입한 커밋(`ac61e64d1`, 2026-05-12)에는 `## Rationale` 근거가 없다 — 구현 행동을 확인하지 않은 채 남겨둔 방어적 작성으로 보인다. `spec/conventions/swagger.md#5-2` 는 "없으면 `null` 인 «최근 항목» 조회"를 `ApiOkWrappedNullableResponse` (200 고정)로 명문화하고 있어, 실제 계약은 처음부터 200-only 였다
  - 상세: 한 번도 "204/404 도 유효하다"는 명시적 Rationale 이 기록된 적이 없으므로, 이번 좁히기는 기각된 대안의 재도입도 아니고 합의된 결정의 무근거 번복도 아니다 — 미검증 상태였던 테스트를 실제 계약(§5-2)에 맞추는 정합화다
  - 제안: 없음(정보성). 다만 plan 본문이 이미 "이 컨트롤러는 200 만 낸다"는 실측을 적어 두었으므로 향후 재론 방지를 위해 근거 인용을 유지할 것

- **[INFO]** `sessions/latest` 가 §6 REST API 표에 없는 것은 이번 plan 이 만든 갭이 아니라 선행 리뷰가 이미 포착한 기존 갭
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §6 (REST API 목록에 `GET .../sessions/latest` 누락)
  - 과거 결정 출처: 직전 커밋 `0186bea98` 커밋 메시지 자체가 "`sessions/latest` 가 ai-assistant API 표에 없음"을 실측으로 이미 기록했다
  - 상세: 이번 plan 은 spec 을 건드리지 않으므로(spec_impact: none) 이 갭을 메우지도, 악화시키지도 않는다. Rationale 연속성 관점에서 새로 생긴 충돌이 아니라 이미 인지된 채 별도 트랙에 남아있는 항목이다
  - 제안: 이 plan 의 처방과 무관 — 별도 spec 갱신 plan 에서 처리할 사안(참고용 기록)

- **[INFO]** §5.3.1 `tool_call.data` 표가 실제 DTO 대비 좁다 — `signature` 필드 미기재, `result` 의 optional(`?`) 표기 누락
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §5.3.1 필드 표
  - 과거 결정 출처: 이 문서 자체의 Rationale "§5.3 에 `410` 기본 코드를 만들지 않은 이유" 절이 세운 원칙 — "표는 규범이 아니라 구현을 옮긴 서술이며, 문서가 구현에 없는 동작을 약속하면 다음 사람이 그 약속을 믿고 실수한다"
  - 상세: 실제 `AssistantToolCallDto`(`assistant-session-response.dto.ts`)는 `result`·`planStepId`·`planStepIds`·`signature` 넷 모두 `@ApiPropertyOptional`이지만, 문서 표는 `result` 를 필수처럼(물음표 없이) 적고 `signature` 는 아예 없다. plan 의 H 케이스(선택 키 4개를 명시)는 코드 기준으로는 정확하지만, 이 표만 읽으면 `signature` 가 계약에 존재한다는 사실 자체를 알 수 없다. 대칭적 갭(문서가 구현보다 좁음)이라 위 §5.3 Rationale 이 경계한 실패 모드(문서가 없는 동작을 "약속"하는 것)와는 반대 방향이지만, 원칙의 취지("표는 실제 매핑을 반영해야 한다")는 동일하게 적용된다
  - 제안: 이번 plan 의 스코프(테스트 전용, spec 불변)에서는 조치 불필요. 향후 spec 을 건드리는 작업에서 `signature`·`result?` 를 표에 반영할 때 참고

## 요약

이번 impl-prep 대상은 순수 e2e 테스트 보강(제품 코드·spec 변경 없음)이며, 세 처방 모두 `spec/3-workflow-editor/4-ai-assistant.md`
및 `spec/conventions/swagger.md`(`ApiOkWrappedNullableResponse`, optional 필드 규약)에 이미 기록된 계약을 그대로 따른다. 과거
Rationale 에서 명시적으로 기각된 대안을 재도입하거나, 합의된 설계 원칙을 위반하거나, 근거 없이 결정을 뒤집는 지점은 발견되지 않았다.
발견한 세 항목은 모두 INFO 등급으로, 이번 plan 이 새로 만든 문제가 아니라 이미 다른 트랙(선행 리뷰·spec 갱신 백로그)에서 인지된
사전 상태를 참고 기록한 것이다.

## 위험도

NONE
