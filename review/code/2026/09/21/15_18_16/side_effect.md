# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `remove(entity)` → `delete(criteria)` 전환은 TypeORM 엔티티 라이프사이클 훅/구독자를 더 이상 발화시키지 않는다 — 현재는 해당 없음(직접 검증), 다만 향후 회귀 소지가 있다
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` `remove()` 메서드 (`const { affected } = await this.authConfigRepository.delete({ id, workspaceId })` 문장)
  - 상세: PR 코멘트가 "저장소 전체에 ORM 라이프사이클 훅이 0건" 이라고 주장하는데, 이를 독립적으로 재검증했다 — `AuthConfig` 엔티티(`codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts`)에는 `@BeforeRemove`/`@AfterRemove` 등 훅이 없고, `grep -rln "EventSubscriber\|BeforeRemove\|AfterRemove..."`가 저장소 전체에서 매치한 파일은 `bcrypt-format.ts`·`workflows.service(.spec).ts`·`user.entity(.spec).ts` 뿐으로 `AuthConfig` 와 무관하다. `trigger.auth_config_id → auth_config(id) ON DELETE SET NULL` 도 `codebase/backend/migrations/V001__initial_schema.sql:210`에서 확인했다(DB 레벨이라 `remove()`/`delete()` 둘 다 동일하게 발화). 즉 **지금 시점엔 부작용이 없다는 주장이 사실**이다. 다만 `Repository.remove(entity)` 는 TypeORM 엔티티 라이프사이클(구독자/훅)을 통과시키고 `Repository.delete(criteria)` 는 순수 쿼리라 이를 우회한다는 것은 일반적인 TypeORM 함정이다 — 이번 커밋 이후 누군가 `AuthConfig` 에 `@BeforeRemove`/subscriber 를 추가해도 이 `delete()` 경로는 그것을 조용히 건너뛴다. 코드에 이미 이 트레이드오프를 설명하는 주석이 있어 인지된 위험이지만, 재검증 결과를 리뷰 기록에 남긴다.
  - 제안: 조치 불요(주석으로 이미 문서화됨). 후속으로 `AuthConfig` 에 라이프사이클 훅이 추가될 경우 이 `delete()` 호출부도 함께 검토하도록 엔티티 파일에 짧은 상호 참조 주석을 남기면 향후 드리프트를 줄일 수 있다.

- **[INFO]** 유닛 테스트 mock 의 `delete()` 가 `workspaceId` 를 무시하고 `id` 로만 실제 삭제를 시뮬레이션한다 — 실제 TypeORM 동작보다 관대하다
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` `makeAuthConfigRepo()` 내 `delete: jest.fn(async ({ id }: { id: string }): Promise<DeleteResult> => { ... })`
  - 상세: 프로덕션 `Repository.delete({ id, workspaceId })` 는 `WHERE id = $1 AND workspace_id = $2` 로 스코프되지만, 이 mock 은 구조분해에서 `workspaceId` 를 아예 받지 않고 `store.delete(id)` 만 수행한다 — mock 의 "삭제 성공 여부" 시뮬레이션 자체는 workspace 스코프를 검증하지 않는다. `'워크스페이스로 스코프한 원자적 DELETE 를 친다'` 테스트가 `expect(repo.delete).toHaveBeenCalledWith({ id, workspaceId: WS })` 로 호출 인자 형태를 단언하므로 워크스페이스 인자 누락/오기입 자체는 이 단언이 잡지만, "다른 워크스페이스의 같은 id 라면 실제로 안 지워져야 한다"는 동작적 보장은 mock 이 대신 검증해 주지 못한다.
  - 제안: 현재로선 차단 사유 아님(형제 PR 들의 기존 mock 관례와 동일한 수준). 필요하면 후속 PR 에서 `store` 를 `(workspaceId, id)` 복합 키로 관리하거나 mock 이 `workspaceId` 불일치 시 `affected: 0` 을 반환하도록 강화할 수 있다.

- **[INFO]** mock 팩토리의 `remove: jest.fn(async () => undefined)` 가 이번 변경 이후 죽은 코드가 됐다
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` `makeAuthConfigRepo()` 44번째 필드
  - 상세: 프로덕션 `remove()` 메서드가 더 이상 `authConfigRepository.remove()` 를 호출하지 않으므로(신규 `delete()` 경로로 교체) 이 mock 필드는 어떤 테스트에서도 호출되지 않는다(`grep` 확인, `repo.remove` 를 참조하는 assertion 없음). 기능상 문제는 없다.
  - 제안: 조치 불요 — 다음에 이 파일을 만질 때 정리하면 된다.

## 시그니처·인터페이스 확인

- `AuthConfigsService.remove(id, workspaceId, userId, ipAddress?): Promise<void>` 공개 시그니처는 변경 없음. 새로 추가된 `private throwAuthConfigNotFound(): never` 는 클래스 내부 전용이라 호출자 영향 없음.
- 컨트롤러(`@HttpCode(HttpStatus.NO_CONTENT)`, 404 코드 `RESOURCE_NOT_FOUND`)는 이번 diff 에 포함되지 않았고 e2e 테스트가 실측한 값(204/404)과 서비스 코드의 `throwAuthConfigNotFound()` 가 던지는 코드가 일치함을 확인했다 — 계약 드리프트 없음.
- `recordAudit` 호출 시점·페이로드 shape 는 변경 없음. 다만 "패자" 쪽에서 감사가 더 이상 남지 않는 것은 이 PR 의 **의도된** 수정 대상이다(중복 감사 버그의 처방) — 부작용이 아니라 목표.

## 전역 상태·파일시스템·환경변수·네트워크

- 전역 변수/모듈 스코프 상태 변경 없음. `store`(테스트 mock)는 `beforeEach` 마다 새로 생성되는 로컬 `Map` 이라 테스트 간 누수 없음.
- 파일시스템: 이번 PR 이 만든 신규 파일은 소스 코드 3개(`.service.ts`/`.spec.ts`/e2e), plan 문서 1개(`plan/in-progress/authconfig-dup-delete.md`), consistency 리뷰 산출물 세트(`review/consistency/2026/09/21/14_41_01/**`) 뿐이며 전부 프로젝트 컨벤션이 지정한 위치(`plan/in-progress/`, `review/consistency/**`)에 정확히 대응한다. 예상 밖의 파일 생성·수정·삭제는 없음.
- 환경변수: e2e 테스트가 `process.env.E2E_BASE_URL` 을 읽지만(fallback 기본값 포함) 기존 형제 e2e 테스트들과 동일한 관례이고 신규 쓰기는 없음.
- 네트워크: e2e 테스트가 실제 backend HTTP 엔드포인트에 요청을 보내고 DB 에 직접 연결하는 것은 e2e 테스트의 목적상 의도된 것이며, 의도치 않은 외부 서비스 호출은 없음.
- 이벤트/콜백: 신규 `EventEmitter`/pub-sub 발화 지점 없음. 위 "라이프사이클 훅" 항목이 유일하게 관련된 관찰이다.

## 요약

핵심 변경(`AuthConfigsService.remove()` 를 `remove(entity)` + 무락 존재 확인에서 원자적 `delete(criteria)` + `affected === 0` 판정으로 교체)은 공개 시그니처·전역 상태·파일시스템·환경변수·네트워크 어느 축에서도 의도치 않은 부작용을 만들지 않는다. `remove(entity)`→`delete(criteria)` 전환이 TypeORM 라이프사이클 훅/구독자를 우회한다는 일반적 위험은 실재하지만, `AuthConfig` 엔티티와 저장소 전체에 해당 훅이 없다는 개발자의 주장을 독립적으로 재검증했고 사실과 일치했다 — 현재는 부작용이 없으나 향후 훅이 추가될 경우의 드리프트 가능성은 인지해 둘 필요가 있다(INFO). 유닛 테스트 mock 의 `delete()` 가 `workspaceId` 를 시뮬레이션에 반영하지 않는 점과 `remove` mock 필드가 죽은 코드가 된 점도 부작용이라기보다 테스트 충실도 관점의 경미한 관찰이다. Critical/Warning 급 부작용은 발견하지 못했다.

## 위험도

LOW
