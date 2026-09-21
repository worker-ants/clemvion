# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `remove(entity)` → `delete(criteria)` 전환은 TypeORM 엔티티 라이프사이클 훅/구독자를 더 이상 통과시키지 않는다 — 현재는 무해함을 직접 재검증했으나, 향후 훅이 추가되면 조용히 우회하는 잠재 드리프트가 남는다.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` `remove()` — `const { affected } = await this.authConfigRepository.delete({ id, workspaceId });` 문장 (게이트 라인 323)
  - 상세: `Repository.remove(entity)` 는 TypeORM 엔티티 라이프사이클(`@BeforeRemove`/`@AfterRemove`/`EventSubscriber`)을 통과시키지만 `Repository.delete(criteria)` 는 순수 쿼리라 이를 우회한다. 직접 재검증했다 — `AuthConfig` 엔티티(`entities/auth-config.entity.ts`)에 `@OneToMany`/`cascade: true`/라이프사이클 데코레이터가 없고, `grep -rln "EventSubscriber\|BeforeRemove\|AfterRemove" codebase/backend/src codebase/backend/test` 매치 0건이다. `trigger.auth_config_id → auth_config(id)` 의 `ON DELETE SET NULL` 은 DB 레벨 FK 라 두 방식 모두 동일하게 발화한다. 즉 **지금 시점엔 주장대로 부작용이 없다.** 다만 이 우회는 일반적인 TypeORM 함정이고, PR 코드 주석이 이미 이 트레이드오프를 설명하고 있어 인지된 리스크다.
  - 제안: 조치 불요(이미 주석으로 문서화됨). 후속으로 `AuthConfig` 에 라이프사이클 훅/subscriber 가 추가될 경우 이 `delete()` 호출부도 함께 재검토하도록 엔티티 파일에 짧은 상호 참조를 남기면 향후 드리프트를 줄일 수 있다.

- **[INFO]** 유닛 테스트 mock 의 `delete()` 가 `workspaceId` 를 무시하고 `id` 만으로 삭제 여부를 시뮬레이션한다 — 실제 TypeORM 스코프보다 관대하다.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` `makeAuthConfigRepo()` 내 `delete: jest.fn(async ({ id }: { id: string }): Promise<DeleteResult> => { ... })` (게이트 라인 48)
  - 상세: 프로덕션 `authConfigRepository.delete({ id, workspaceId })` 는 `WHERE id = $1 AND workspace_id = $2` 로 스코프되지만, 이 mock 은 구조분해에서 `workspaceId` 를 아예 받지 않고 `store.delete(id)` 만 수행한다. `'워크스페이스로 스코프한 원자적 DELETE 를 친다'` 테스트가 `expect(repo.delete).toHaveBeenCalledWith({ id, workspaceId: WS })` 로 호출 인자 형태는 단언하므로 인자 누락은 잡히지만, "다른 워크스페이스의 같은 id 면 실제로 안 지워진다"는 동작적 보장 자체는 이 mock 이 검증해 주지 못한다. 실제 cross-tenant 격리 보장은 e2e/DB 레벨(`workspace_id` 인덱스+조건절)에 위임돼 있다.
  - 제안: 차단 사유 아님(형제 PR 들의 기존 mock 관례와 동일한 수준, 직전 라운드 리뷰에서도 이미 지적되고 "무조치" 로 처분됨). 여유 있으면 `store` 를 `(workspaceId, id)` 복합 키로 관리하는 강화를 고려.

## 시그니처·인터페이스 확인

- `AuthConfigsService.remove(id, workspaceId, userId, ipAddress?): Promise<void>` 공개 시그니처 변경 없음(호출자: 컨트롤러 diff 밖, 이번 변경에 영향 없음). 신규 `private throwAuthConfigNotFound(): never` 는 클래스 내부 전용이라 외부 호출자 영향 없음 — 직접 grep 으로 `findById`(라인 133)·`remove`(라인 306/327 부근)의 두 호출부만 있음을 확인했다.
- 컨트롤러(204 성공, 404 `RESOURCE_NOT_FOUND`)는 이번 diff 에 포함되지 않았고 e2e 테스트가 실측한 상태 코드/에러 코드와 서비스가 던지는 값이 일치함을 확인 — 외부 계약 드리프트 없음.
- `recordAudit` 의 시그니처·payload shape·best-effort 계약은 변경 없음(코드 확인). "진 쪽"에서 감사가 더 이상 남지 않는 것은 이 PR 의 **의도된** 수정 목표이지 의도치 않은 부작용이 아니다.

## 전역 상태·파일시스템·환경변수·네트워크·이벤트

- 전역 변수/모듈 스코프 상태 변경 없음. 테스트 mock 의 `store`(`Map`)는 로컬 스코프이고 `beforeEach` 로 재생성돼 테스트 간 누수 없음.
- 파일시스템: 신규 파일은 소스 코드 3개(`auth-configs.service.ts`/`.spec.ts`/e2e), `plan/in-progress/authconfig-dup-delete.md`, 기존 트래커 편집(`spec-draft-nullable-notation-followups.md`), `CHANGELOG.md` backfill, 그리고 직전 리뷰 라운드(`15_18_16`)의 산출물 세트다 — 전부 프로젝트 컨벤션이 지정한 위치에 대응하며, 코드 실행 경로가 만드는 예상치 못한 파일 생성·수정·삭제는 없다.
- 환경변수: e2e 테스트가 `process.env.E2E_BASE_URL` 을 읽기만 한다(폴백 기본값 포함, 형제 e2e 들과 동일 관례). 신규 쓰기는 없음.
- 네트워크: e2e 테스트가 실제 backend HTTP 엔드포인트에 요청하고 DB 에 직접 연결하는 것은 e2e 목적상 의도된 것. 그 외 의도치 않은 외부 서비스 호출 없음.
- 이벤트/콜백: 신규 EventEmitter/pub-sub 발화 지점 없음. 위 "라이프사이클 훅 우회" 항목이 유일하게 관련된 관찰이다.
- e2e 테스트의 DB 커넥션(`db`, `locker`)은 `beforeAll`/`afterAll` 로 명시적으로 열고 닫으며, `locker` 트랜잭션은 `try/finally` 로 `ROLLBACK`(또는 `COMMIT` 후)이 보장돼 커넥션·트랜잭션 유실이 없다.
- 저장소 뮤테이션 없음: 본 리뷰는 정적 분석(Read/Grep/`git status`)만 수행했고 워킹트리에 어떤 파일도 쓰지 않았다. 리뷰 종료 시점 `git status --short` 결과 이 세션의 출력 디렉터리(`review/code/2026/09/21/15_45_04/`) 외 변경 없음을 확인했다.

## 요약

핵심 변경(`AuthConfigsService.remove()` 를 `remove(entity)` + 무락 존재 확인에서 원자적 `delete({id, workspaceId})` + `affected === 0` 명시 비교로 교체)은 공개 시그니처·전역 상태·파일시스템·환경변수·네트워크 어느 축에서도 의도치 않은 부작용을 만들지 않는다. `remove(entity)` → `delete(criteria)` 전환이 TypeORM 라이프사이클 훅/구독자를 우회한다는 일반적 위험은 실재하지만, `AuthConfig` 엔티티와 저장소 전체에 해당 훅이 0건임을 독립적으로 재검증했다 — 현재는 부작용이 없고, 향후 훅 추가 시의 드리프트 가능성만 인지 사항으로 남는다(INFO, 코드 주석으로 이미 문서화됨). 유닛 테스트 mock 의 `delete()` 가 `workspaceId` 스코프를 시뮬레이션에 반영하지 않는 점은 직전 리뷰 라운드에서도 지적됐고 차단 사유 없이 "무조치" 로 처분된 경미한 테스트 충실도 관찰이다. `CHANGELOG.md`/plan/review 산출물 편집은 모두 프로젝트가 지정한 위치에 대응하는 문서 변경으로 부작용 표면이 아니다. Critical/Warning 급 부작용은 발견하지 못했다.

## 위험도

LOW
