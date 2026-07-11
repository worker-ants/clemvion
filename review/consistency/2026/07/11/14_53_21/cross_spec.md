# Cross-Spec 일관성 검토 — spec/5-system/14-external-interaction-api.md (impl-done)

## 검토 개요

diff 는 `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` 단일 파일을
`dto/responses/execution-status-response.dto.ts` / `interact-ack-response.dto.ts` /
`refresh-token-response.dto.ts` 3개로 분리하는 **순수 파일 재구성**이다. `InteractAckDto` ·
`RefreshTokenResponseDto` · `ExecutionStatusDto` · `WaitingContextBaseDto` · `CurrentNodeDto` ·
`NodeOutputContextDto` 의 필드·타입·enum·OpenAPI 데코레이터는 diff 전후 동일하며, 변경된 것은
(a) import 경로, (b) 파일 분리에 따른 JSDoc 상대경로(`../../../../../../` →
`../../../../../../../`) 뿐이다. 확인 결과 상대경로는 실제 디렉토리 구조(`dto/responses/` 로 1 depth
증가)와 정확히 일치한다.

오히려 이 분리는 `spec/conventions/swagger.md §5-1` 의 기존 규약(`dto/responses/*-response.dto.ts`
위치, `dto/responses/workflow-response.dto.ts` 예시)에 맞춘 것으로, 종전의 단일
`dto/responses.dto.ts` 가 그 규약을 따르지 않던 상태를 정합화한다 — 이 관점에서는 오히려 cross-spec
정합성이 **개선**됐다.

## 발견사항

- **[INFO]** `interaction-type-registry.md` 의 SoT 파일 경로가 리네임 대상과 불일치
  - target 위치: (코드) `codebase/backend/src/modules/external-interaction/dto/` 리네임/분리 diff 전체
  - 충돌 대상: `spec/conventions/interaction-type-registry.md:40` — "이 4→3 통합은 `chat-channel.dispatcher` 및 EIA 응답 DTO(`external-interaction/dto/responses.dto.ts`) 계층의 책임이다" (cross-cutting enum 매트릭스 문서의 SoT 각주)
  - 상세: 이 각주가 가리키는 `external-interaction/dto/responses.dto.ts` 파일은 본 diff 로 더 이상 존재하지 않는다 (`dto/responses/execution-status-response.dto.ts` 로 이동). 실제로 4→3 통합 로직(`interactionType: 'form' | 'buttons' | 'ai_conversation'`)은 새 파일에 그대로 남아 있어 **책임 서술 자체는 여전히 맞지만, 인용된 파일명이 stale** 하다 — 이 각주를 SoT 로 따라가는 독자가 잘못된 경로를 찾게 된다. 동일한 stale 참조가 target 문서 자신의 `spec/5-system/14-external-interaction-api.md:861` §10 "구현 파일 구조" 트리(`responses.dto.ts`)에도 남아 있다 — 이번 diff 가 코드만 변경하고 두 spec 문서 어느 쪽도 갱신하지 않았기 때문에 발생한 drift 다.
  - 제안: `spec/5-system/14-external-interaction-api.md §10` 파일 구조 목록을 `dto/responses/execution-status-response.dto.ts` · `interact-ack-response.dto.ts` · `refresh-token-response.dto.ts` 3줄로 갱신하고, `spec/conventions/interaction-type-registry.md:40` 의 인용 경로도 `external-interaction/dto/responses/execution-status-response.dto.ts` 로 동기화. 두 문서 모두 코드 소유 spec 이 아니라 `project-planner` 가 함께 갱신해야 하는 대상.

## 요약

이번 변경은 `spec/5-system/14-external-interaction-api.md` 가 규정하는 DTO 의 필드·shape·enum·오너십에 어떤 실질적 변화도 주지 않는 순수 파일 재구성이며, 오히려 `spec/conventions/swagger.md §5-1` 의 기존 응답 DTO 배치 규약(`dto/responses/*-response.dto.ts`)에 뒤늦게 부합시키는 방향이라 cross-spec 정합성을 해치지 않는다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 CRITICAL/WARNING 급 충돌은 없다. 유일한 잔여 이슈는 파일 리네임을 반영하지 못한 두 spec 문서(대상 문서 자신의 §10 파일 구조 목록, 그리고 `conventions/interaction-type-registry.md` 의 SoT 각주)의 stale 경로 인용으로, 의미 서술 자체는 정확하지만 파일명 동기화가 필요하다.

## 위험도
LOW
