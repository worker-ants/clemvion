# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `remove()` 의 삭제 판별자를 `remove(entity)` → 원자적 `delete({ id, workspaceId })` 로 바꾸면서 TypeORM 라이프사이클(`@BeforeRemove`/subscriber)을 우회하지만, 저장소 전체에 해당 훅이 0건이고 `Integration` 엔티티에 `cascade: true` 관계·`@OneToMany`·`@DeleteDateColumn`(soft-delete) 도 없음을 독립적으로 재확인했다(엔티티 정의·`grep -rn "BeforeRemove\|AfterRemove\|EventSubscriber"` 실측). 이번 라운드에서 새로 생긴 위험은 아니며, 이전 라운드(`review/code/2026/09/21/10_54_47` INFO #8)에서 같은 결론으로 이미 처분됨 — 재확인만 하고 조치 불요로 유지.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `remove()` 메서드 (게이트 799-803), 대조: `codebase/backend/src/modules/integrations/entities/integration.entity.ts` 전체
  - 제안: 없음(기존 처분 유지)

- **[INFO]** `remove()` 의 진 쪽(동시 DELETE 패자) 경로는 이제 감사 기록(`auditLogsService.record`)과 `broadcastCredentialChange` → `integrationCacheBus.publish` 콜백을 아예 건너뛴다 — 기존에는 두 요청 모두 이 콜백을 두 번 발생시켰다. 이는 이번 diff 가 의도한 정확한 수정 방향(중복 이벤트 제거)이며 새로운 부작용이 아니라 부작용의 축소다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:803`(`if (affected === 0) this.throwIntegrationNotFound();`)의 앞뒤 — `auditLogsService.record` 호출과 `broadcastCredentialChange(id)` 호출이 이 분기 뒤로 이동
  - 제안: 없음(의도된 개선)

- **[INFO]** `throwIntegrationNotFound(): never` 헬퍼 추출(7곳 통합)은 `private` 메서드이며 외부 호출자·공개 시그니처에 영향이 없다. 7개 호출 지점(`findById`, `update`, `remove` 2곳, `rotate` 2곳, `requireEntity`)을 전부 직접 열어 대조한 결과 원래의 인라인 `throw new NotFoundException({...})` 와 던지는 예외 형태(`code`/`message`)가 동일하고, `rotate()` 내부의 두 호출은 `dataSource.transaction()` 콜백 안에서 발생하는데 이 또한 리팩터 전과 동일한 위치·동일한 롤백 유발 방식이라 트랜잭션 부작용에 변화가 없다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:613-618`(헬퍼 정의), 호출부 게이트 602, 740, 769, 803, 1191, 1219, 1480
  - 제안: 없음

- **[INFO]** 테스트 mock 객체(`integrationRepo`, `integrationCacheBus` 등)는 `beforeEach` 안에서 매번 새로 생성됨을 확인했다(`integrations.service.spec.ts:119-134`, `:170`) — `mockResolvedValueOnce`/`mockClear()` 를 쓰는 신규 테스트(대조군 등)가 다른 `it` 블록의 mock 상태를 오염시키지 않는다. `git status --short` 로 확인한 현재 작업 트리에는 이 세션이 만든 리뷰 산출물(`review/code/2026/09/21/11_32_06/`) 외 잔여 변경이 없다 — 이번 리뷰는 저장소에 어떤 뮤테이션도 가하지 않았다(모두 `Read`/`grep` 으로만 검증).
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:119`, `:170`
  - 제안: 없음

- **[INFO]** 신규 e2e (`integration-delete-concurrency.e2e-spec.ts`)는 실제 DB 커넥션 2개(`db`, `locker`)를 열고 `SELECT ... FOR UPDATE` 로 행 락을 걸어 두 HTTP DELETE 요청의 경합을 강제한다 — 실제 네트워크 호출(HTTP to `backend-e2e`)과 실제 DB 부작용(행 삽입·삭제·락)을 일으키지만, 이는 형제 4개 e2e(`workflow-`/`workspace-`/`trigger-`/`schedule-delete-concurrency.e2e-spec.ts`)와 동일한 기존 패턴이며 `E2E_BASE_URL` 환경변수도 읽기 전용으로 fallback 값과 함께 기존 관례를 따른다. `finally` 블록에서 COMMIT 이 이미 성공한 뒤에도 `ROLLBACK` 을 무조건 호출하지만 `.catch(() => undefined)` 로 감싸여 있어 실질적 부작용(에러 전파)은 없다.
  - 위치: `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` (게이트 79-107, `finally` 블록 104-107)
  - 제안: 없음(형제 패턴과 일관)

새로 발견된 CRITICAL/WARNING 급 부작용은 없다.

## 요약

이번 diff 의 핵심 변경은 `IntegrationsService.remove()` 의 삭제 판별 방식을 `remove(entity)` 에서 원자적 `delete(criteria)` 의 `affected` 카운트로 바꾸고, 동시 DELETE 패자 경로에서 감사 기록·캐시 무효화 브로드캐스트를 건너뛰게 한 것이다. ORM 라이프사이클 훅 우회는 실측(그레핑)으로 영향 없음을 재확인했고, 이벤트/콜백(감사·캐시 버스) 발생 변화는 중복 제거라는 의도된 방향이며 신규 전역 상태·환경 변수·네트워크 호출·공개 시그니처 변경은 없다. `throwIntegrationNotFound()` 헬퍼 추출은 7개 호출부 전부에서 예외 형태와 트랜잭션 내 던짐 위치가 원본과 동일함을 대조 확인했다. 테스트 mock 은 `beforeEach` 로 매번 재생성되어 상태 누수가 없고, 신규 e2e 는 형제 파일과 동일한 실제 DB/HTTP 부작용 패턴을 재사용한다. 이번 리뷰 세션은 저장소에 어떤 파일도 뮤테이션하지 않았다(읽기 전용 검증만 수행, `git status --short` 클린 확인).

## 위험도

NONE
