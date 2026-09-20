# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** DELETE 응답 멱등성 비대칭은 의도된 제품 계약 — 결함 아님
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (게이트 1090-1094)
  - 상세: 동시 DELETE 두 건이 겹치면 승자는 `204`, 패자는 `404 RESOURCE_NOT_FOUND` 를 받는다. 일반적 REST 관행(재삭제도 `204`로 멱등)과는 다른 선택이지만, `spec/2-navigation/2-trigger-list.md §4.4` 가 이미 이 쌍을 계약으로 명시했고, 형제 엔드포인트(워크플로/워크스페이스 삭제, 커밋 `4a9828afe`/`ae4fbc374`)도 같은 패턴이다. 이번 변경은 그 문서화된 계약을 코드로 실제로 만족시킨 것 — 새 breaking change 가 아니라 spec-vs-구현 gap 을 닫은 것이다(같은 결론이 `review/consistency/2026/09/20/21_43_47/SUMMARY.md` INFO#1 에도 있음).
  - 제안: 조치 불필요. 클라이언트가 "동시 삭제 시 둘 다 204" 를 가정하고 있었다면 이 수정으로 한쪽이 404 로 바뀌지만, 이는 이미 spec 에 명시된 목표 동작이라 하위 호환성 이슈로 보지 않는다.

- **[INFO]** 신규 에러 케이스가 기존 에러 스키마·Swagger 문서를 재사용 — 문서·구현 drift 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `throwTriggerNotFound()` (게이트 412-416, 이번 diff 는 이 기존 헬퍼를 재조회 실패 시에도 호출하도록 확장, 게이트 1094)
  - 상세: 새로 추가된 락-안-재조회 실패 경로는 `{ code: 'RESOURCE_NOT_FOUND', message: 'Trigger not found' }` 형태의 기존 404 를 그대로 던진다. 별도의 에러 코드·페이로드 모양을 새로 만들지 않았고, 컨트롤러의 `@ApiNotFoundResponse({ description: '해당 트리거를 찾을 수 없음' })`(`codebase/backend/src/modules/triggers/triggers.controller.ts` `@Delete(':id')`, 기존/미변경)가 이 케이스를 이미 포괄한다.
  - 제안: 조치 불필요.

- **[INFO]** 인가 경계(workspace 스코프) 재확인 유지
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 게이트 1090-1093
  - 상세: 락 안 재조회가 `where: { id, workspaceId }` 로 원래 `findById` 조회와 동일한 workspace 스코프를 유지한다. 재조회 시 스코프를 빠뜨렸다면 다른 워크스페이스의 동일 id 존재 여부를 노출하는 authz 누수가 될 수 있었는데, 그런 문제는 없다.
  - 제안: 조치 불필요 (확인 목적으로 기록).

WARNING/CRITICAL 없음.

## 요약

이번 변경은 신규 엔드포인트·요청/응답 스키마·API 버전 변경이 전혀 없는 순수 동시성 버그 수정이다. `DELETE /api/triggers/:id` 가 동시 요청 시 둘 다 `204` 를 반환하고 `trigger.deleted` 감사 행을 중복 기록하던 것을, advisory lock 안에서 행 재존재를 재확인해 패자 요청에 기존 `RESOURCE_NOT_FOUND`(`404`) 에러 포맷을 그대로 재사용해 반환하도록 고쳤다. 이 상태 코드·에러 스키마는 컨트롤러 Swagger 문서(`@ApiNotFoundResponse`)에 이미 반영돼 있어 문서-구현 drift 가 없고, 재조회도 원 조회와 동일한 `workspaceId` 스코프를 지켜 인가 경계를 훼손하지 않는다. 워크플로/워크스페이스 삭제의 선행 동일 패턴 수정과 일관된 형태이며, e2e 테스트(`codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts`)가 `[204, 404]` 쌍과 감사 1건을 직접 검증한다. 유일하게 API 계약 관점에서 눈에 띄는 지점은 동시 삭제 패자가 `204` 대신 `404` 를 받아 RESTful DELETE 멱등성 원칙과 다르다는 점인데, 이는 이미 `spec/2-navigation/2-trigger-list.md §4.4` 로 명시된 제품 결정이자 이번 PR 이 그 계약을 실제 코드로 충족시킨 것이므로 결함이 아니다. 하위 호환성·페이지네이션·인증/인가·URL 설계 관점에서 이번 diff 로 인해 새로 발생한 문제는 없다.

## 위험도

NONE
