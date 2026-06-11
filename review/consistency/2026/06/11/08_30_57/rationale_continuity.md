# Rationale 연속성 검토 결과

검토 범위: V-16/V-17 코드측 문서 문자열 정정 (diff-base=origin/main)
검토 일시: 2026-06-11

---

## 발견사항

발견된 Rationale 연속성 위반 없음.

각 변경 항목에 대한 확인 결과는 아래와 같다.

### [INFO] `cross_encoder_llm` Swagger 설명 정정 — 기존 spec 결정과 완전 정합

- **target 위치**: `codebase/backend/src/modules/knowledge-base/dto/create-knowledge-base.dto.ts` 및 `update-knowledge-base.dto.ts` 의 Swagger 설명 문자열
- **과거 결정 출처**: `spec/5-system/9-rag-search.md §3.3.1·§3.3.2` 및 `## Rationale "왜 D2 conditional escalate 를 지금 도입하나"` 항
- **상세**: 기존 Swagger 주석의 `'cross_encoder_llm 은 추가 LLM grading(후속 구현)'` 및 `'(cross_encoder_llm 은 후속 구현)'` 표기는 spec 이 2026-06-06 에 이미 번복·현행화(`cross_encoder` 와 `cross_encoder_llm` 두 모드 모두 구현됨, V081/V082 마이그레이션 완료)한 상태를 반영하지 못한 stale 문자열이었다. 이번 정정은 spec §3.3.1 의 "상태: 구현됨" + §3.3.2 의 conditional escalate 흐름에 DTO 설명을 맞춘 것이다. 기각된 대안의 재도입이나 합의 원칙 위반이 아니며, 정정 전이 spec 미반영 stale 코드였던 것을 spec 쪽으로 당기는 방향이다.
- **제안**: 해당 없음 (이미 올바른 방향).

### [INFO] `RagSearchDto.topK` `default:5` 제거 — 기존 spec 결정과 완전 정합

- **target 위치**: `codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` 의 `@ApiPropertyOptional({ default: 5, ... })`
- **과거 결정 출처**: `spec/5-system/9-rag-search.md §3.4` (D1 동적 점수 컷 도입), `## Rationale "왜 동적 점수 컷인가 (D1)"` — "D1 이전의 `LIMIT topK=5` 고정 COUNT 선차단 폐기" 명시, 그리고 spec §3.4 본문 "미지정 시 §3.4 동적 점수 컷이 주입 청크 수를 결정 (고정 default 없음)"
- **상세**: spec 이 `topK default=5` 고정 COUNT 선차단을 명시 폐기하고, 미지정 시 token-budget + inject-cap 동적 결정을 채택했다. `default: 5` Swagger 필드는 그 폐기된 결정을 코드 문서에서 여전히 노출하는 stale 이었다. 이번 정정은 spec D1 결정에 코드 문서를 맞춘 것이다.
- **제안**: 해당 없음.

### [INFO] `byo-ui-headless.ts` + `web-chat-sdk README` `firstMessage` → `submit_message` 전환 — 기존 spec §R6 결정과 완전 정합

- **target 위치**: `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts`, `codebase/packages/web-chat-sdk/README.md`
- **과거 결정 출처**: `spec/7-channel-web-chat/1-widget-app.md §R6` — "`firstMessage` 메커니즘은 폐기한다" 명시 (2026-06-06 전환 결정). spec §R6 은 기각된 대안(lazy + firstMessage 동봉)의 양대 결함(AI-아닌 첫 노드 표시 불가, firstMessage 유실)과 채택된 대안(eager-start + submit_message)의 근거를 함께 기록하고 있다.
- **상세**: 기존 SDK 예제 코드는 spec 이 폐기한 `firstMessage` 패턴을 그대로 노출하고 있었다. 이번 정정은 webhook payload 를 `profile` 만으로 한정하고, 첫 사용자 텍스트를 `submit_message` 로 보내는 spec 채택 패턴으로 예제를 교체한 것이다. `startHeadlessChat` 함수 시그니처에서 `firstMessage: string` 파라미터 제거도 같은 맥락이다. 이는 기각된 대안을 복원하는 것이 아니라 spec 결정을 예제 코드에 반영하는 것이다.
- **제안**: 해당 없음.

---

## 요약

이번 diff 의 세 변경 그룹(cross_encoder_llm Swagger stale 정정, topK default:5 제거, firstMessage → submit_message 예제 교체) 모두 spec 의 기존 Rationale 에 명시된 결정(D1 동적 점수 컷, §R6 eager-start, cross_encoder_llm 구현 완료 갱신)을 코드 문서/예제에 반영하는 방향이다. 어느 변경도 spec Rationale 에서 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하지 않는다. 오히려 stale 코드 문서가 spec 을 따르지 못하던 상태를 해소하는 것이다.

---

## 위험도

NONE
