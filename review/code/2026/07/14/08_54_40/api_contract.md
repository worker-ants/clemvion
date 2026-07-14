# API 계약(API Contract) 리뷰

## 대상
- `codebase/backend/src/modules/external-interaction/interaction.controller.ts`
  — `POST /api/external/executions/:executionId/interact` 의 `@ApiConflictResponse` swagger 설명 문구 동기화 (nodeId 불일치 사유 추가)

## 발견사항

- **[INFO]** Swagger 설명 문구만 갱신, 실제 응답 스키마·상태 코드·엔드포인트 동작 변경 없음
  - 위치: `interaction.controller.ts:128-131` (`@ApiConflictResponse` description)
  - 상세: 변경 전/후 모두 HTTP 409 (`STATE_MISMATCH` / `IDEMPOTENCY_KEY_CONFLICT`) 하나로 매핑되는 동일 에러 코드 집합이며, 이번 변경은 `STATE_MISMATCH` 사유 목록에 "명령의 nodeId 가 실제 대기 노드와 불일치" 케이스를 문서에 추가한 것뿐이다. `interaction.service.ts` 를 확인한 결과 nodeId 불일치가 이미 `STATE_MISMATCH` 로 409 매핑되는 기존 동작(`expectedNodeId`/`assertWaiting` 경로, service.ts:117-121, 460-507)이 존재하므로, 문서가 기존에 누락됐던 실제 동작을 뒤늦게 정확히 기술하도록 보정한 것 — 즉 코드 동작과 문서의 drift 를 해소하는 방향의 변경이다.
  - 제안: 없음. 문서-구현 정합성 관점에서 바람직한 변경.

## 요약
이번 델타는 `interact` 엔드포인트의 `@ApiConflictResponse` swagger description 텍스트에 nodeId 불일치도 `STATE_MISMATCH` 사유에 포함된다는 설명을 추가한 순수 문서 동기화이며, 응답 스키마·HTTP 상태 코드·에러 코드 enum·URL·인증/인가·페이지네이션 등 API 계약의 실질 요소는 전혀 변경되지 않았다. `interaction.service.ts` 교차 확인 결과 nodeId 불일치가 이미 코드상 `STATE_MISMATCH`(409)로 처리되고 있어 문서가 실제 동작을 정확히 반영하도록 보정됐으므로 breaking change 소지가 없다.

## 위험도
NONE
