# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 동시 DELETE 두 번째 요청이 이제 (기존과 동일한 코드로) 404 를 반환하는 동작 변경이 `spec/2-navigation/4-integration.md` §9.1/§9.4 에 서술돼 있지 않다
  - 위치: `spec/2-navigation/4-integration.md:814` (§9.1 `DELETE /api/integrations/:id` 행) — 서술 없음 확인은 `Read`/`grep` 으로 §9 전체 대조
  - 상세: 이번 변경 전에도 존재하지 않는 리소스에 대한 `DELETE` 는 동일한 `{ code: 'RESOURCE_NOT_FOUND' }` 404 를 반환했다(`codebase/backend/src/modules/integrations/integrations.service.ts` 의 `remove()` 앞부분 `findOne` 실패 분기, 기존 코드). 이번 diff 는 그 **동일한 에러 코드·상태 코드**를 "동시 삭제의 진 쪽"이라는 새 트리거 경로에도 적용한 것이라, wire 포맷 자체는 전혀 바뀌지 않는다 — 클라이언트가 관측하는 응답 스키마·상태 코드에 새 분기가 생기는 것은 아니다. 다만 "동시 삭제 시 두 번째 요청은 404" 라는 **동작 계약**은 형제 엔드포인트(트리거 `2-trigger-list.md` §4.4)에는 이미 문서화돼 있고 워크플로/스케줄/통합은 침묵 상태다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` L4813 트래커 항목과 이번 세션의 `/consistency-check --impl-prep` (`review/consistency/2026/09/21/10_27_27`, WARNING #3/INFO #5)에 낮은 우선순위·비차단으로 등재돼 있음을 확인했다. 새 조치 불요 — 등재 상태 유지로 충분.

- **[INFO]** 삭제 후 브로드캐스트 관련 주석이 이제는 적용되지 않는 옛 API(`remove(entity)`)를 근거로 남아 있다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `remove()` 메서드의 `broadcastCredentialChange(id)` 호출 직전 주석 ("TypeORM remove 후 entity.id 는 unset 될 수 있어 param `id` 를 쓴다")
  - 상세: 이번 diff 로 삭제 호출이 `this.integrationRepository.remove(entity)` 에서 `this.integrationRepository.delete({ id, workspaceId })` 로 바뀌어, `entity.id` 가 mutate 될 가능성 자체가 없어졌다(criteria 기반 delete 는 entity 인스턴스를 건드리지 않는다). 주석의 결론(param `id` 사용)은 여전히 맞지만 근거 문구가 더 이상 성립하지 않는 옛 API 를 가리킨다. API 계약(응답·에러 형식)에는 영향 없는 순수 문서 정확성 이슈.
  - 제안: 사소하므로 이번 PR 을 막을 사유는 아니며, 다음 근접 편집 때 주석을 "delete(criteria) 는 entity 를 건드리지 않지만 명시적으로 param id 를 쓴다" 정도로 정리해도 좋다.

## 요약

이번 변경은 `IntegrationsService.remove()` 의 삭제 오퍼레이션을 `remove(entity)` 에서 원자적 `delete({ id, workspaceId })` 로 바꾸고 그 `affected` 를 판별자로 삼아, 동시 DELETE 요청 중 진 쪽이 (기존과 동일한 `RESOURCE_NOT_FOUND` 404 포맷으로) 명확히 실패하도록 고쳤다. `DELETE /api/integrations/:id` 의 URL·HTTP 메서드·204 성공 응답·409(`INTEGRATION_IN_USE`)·404(`RESOURCE_NOT_FOUND`) 에러 포맷·`@Roles('editor')` 인가·`ParseUUIDPipe` 검증은 모두 그대로이며, 컨트롤러(`integrations.controller.ts`)는 변경되지 않았다. 새 404 분기는 기존 코드베이스 전반에서 이미 쓰이는 `{ code: 'RESOURCE_NOT_FOUND', message }` 규약을 그대로 재사용하므로 에러 응답 형식의 일관성도 유지된다. 형제 리소스(workflows/triggers/schedules, #1369~#1371)와 동일한 결함 클래스·유사한 처방 패턴을 따르되, 이 경로엔 락이 없다는 점을 원자적 단일 `DELETE` 문으로 대신한 점도 합리적이다. 응답 스키마·페이지네이션·버전 관리에 영향을 주는 변경은 없고, 클라이언트가 관측 가능한 유일한 차이는 "동시 삭제 경합에서 정상적으로 한쪽만 성공하고 다른 쪽은 404 를 받는다"는 버그 수정뿐이며 이는 breaking change 가 아니다. 관련 spec 문서(§9.1)에 이 동시성 계약이 아직 서술되지 않은 점은 이미 낮은 우선순위·비차단으로 트래커에 등재돼 있음을 확인했다.

## 위험도
LOW
