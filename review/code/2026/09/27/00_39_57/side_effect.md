# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 워크플로 버전 응답 DTO 의 공개 OpenAPI 계약 변경 — `creator`/`changeSummary` 가 optional(+nullable) → required(참조는 non-null, `changeSummary` 는 required+nullable)로 광고된다.
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` — `WorkflowVersionListItemDto.changeSummary`(게이트 36-40) · `WorkflowVersionListItemDto.creator`(게이트 46-50) · `WorkflowVersionDto.changeSummary`(게이트 70-74) · `WorkflowVersionDto.creator`(게이트 84-88)
  - 상세: 이 DTO 는 `WorkflowVersionsController`(`@ApiOkWrappedArrayResponse`/`@ApiOkWrappedResponse`)를 통해 OpenAPI 스펙 생성에만 쓰이고, 전역 `ClassSerializerInterceptor`·`@Exclude`/`@Expose` 가 이 저장소에 없음을 직접 확인했다(`repo-guards/__tests__/user-entity-exposure.spec.ts` 주석, grep 0건) — 즉 응답 바이트는 서비스가 반환하는 raw 쿼리 결과로 결정되고 이 DTO 는 런타임 직렬화에 관여하지 않는다. 따라서 optional→required 전환은 **문서·생성 클라이언트 타입만 좁히는** 변경이며 실제 wire 포맷 변화는 없다. `creator` 가 항상 존재한다는 전제도 직접 검증했다: `workflow_version.created_by UUID NOT NULL REFERENCES "user"(id)`(`ON DELETE` 절 없음 = NO ACTION)가 `V001__initial_schema.sql`(유일한 관련 마이그레이션, 후속 스키마 변경 없음)에 처음부터 있었고, `users.service.ts` 등 코드베이스 전체에 사용자 hard-delete 경로가 없다(`grep '.delete(' … | grep user` → S3 파일 삭제 1건뿐, 사용자 로우 삭제 아님). 다만 엔티티(`WorkflowVersion.creator`)의 `@ManyToOne(() => User)` 는 `{ nullable: false }` 를 명시하지 않아 TypeORM 은 여전히 LEFT JOIN 을 생성한다 — DB 제약이 아니라 애플리케이션 코드만 보면 "항상 존재" 는 ORM 타입 수준에서 강제되지 않는 약속이다(이 PR 이 건드린 자리는 아니며, DB 제약이 실질적으로 이를 대신 보장한다).
  - 제안: 조치 불필요. CHANGELOG·plan(`plan/in-progress/workflow-version-creator.md`)에 이미 명시됐고 e2e·뮤테이션(M1~M3, M5)으로 뒷받침됨. 참고로만 남긴다.

- **[NONE]** `VERSION_METADATA_SELECT` 신규 모듈 레벨 상수 — `Object.freeze({...} as const)` 로 불변이고, 두 조회(`findByWorkflow`/`findOne`)에서 오직 스프레드(`{ ...VERSION_METADATA_SELECT, ... }`)로만 소비되어 매 호출 새 객체가 만들어진다. 공유 가변 상태·전역 변수 오염 위험 없음.
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — 정의부(게이트 103-116), `findByWorkflow` 사용(게이트 158), `findOne` 사용(게이트 174-180)

- **[NONE]** 시그니처 변경 없음 — `WorkflowVersionsService.findByWorkflow`/`findOne` 의 파라미터·반환 타입은 그대로다. `select` 로 실제 실리는 키 집합도 리팩터 전후 동일함을 단위 테스트(`workflow-versions.service.spec.ts` 게이트 169-190 신규 대칭 단언 + 기존 리터럴 단언)가 고정한다. 이 DTO 클래스들을 수동으로 인스턴스화(`new WorkflowVersionDto()`/`plainToInstance`)하는 다른 소비 코드도 없음을 확인했다(`grep` 결과 컨트롤러의 데코레이터 참조뿐).

- **[NONE]** 파일시스템·환경 변수·네트워크 호출·이벤트/콜백 관련 변경 없음. `plan/`·`review/`·`CHANGELOG.md` 에 추가된 신규 파일들은 이 저장소의 workflow 규약(plan 작성, 코드 리뷰/일관성 검토 산출물 보존)에 따른 의도된 산출물이며, 애플리케이션 코드가 일으키는 예측 불가 파일시스템 부작용이 아니다. 이번 리뷰 세션도 저장소 파일을 뮤테이션하지 않았다(`git status --short` 로 확인 — 본 세션 출력 디렉터리만 untracked).

- **[NONE]** `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 래칫에서 4행 제거는 허용 폭을 좁히는 의도된 강화이고, 같은 커밋(`f35fedaac`)에서 DTO 변경과 동기화되어 순서 문제(래칫이 DTO보다 먼저 좁아져 허위 실패)가 없음을 확인했다.

## 요약

이번 변경은 §5.4 금지 조합(optional+nullable) DTO 선언을 런타임 보장에 맞춰 좁히는 계약 정정과, 두 조회의 중복 `select` 리터럴을 불변 상수로 추출하는 순수 리팩터다. 전역 가변 상태 도입, 함수 시그니처 파괴, 예기치 않은 파일시스템·환경변수·네트워크·이벤트 부작용은 발견되지 않았다. 유일하게 기록할 만한 항목은 OpenAPI 스키마상 `creator`/`changeSummary` 가 optional에서 required로 바뀌는 공개 인터페이스 변경인데, DTO 가 런타임 직렬화에 관여하지 않는 순수 문서화 계층임을 직접 확인했고(`ClassSerializerInterceptor` 부재), "항상 존재" 전제도 유일한 스키마 마이그레이션·사용자 hard-delete 부재 조사로 직접 재검증했다 — 다만 이 보장이 DB 제약에 의한 것이지 TypeORM 엔티티 관계(`@ManyToOne` 에 `nullable: false` 미명시)가 타입 수준에서 강제하는 것은 아니라는 점은 참고 사항으로 남긴다. 이 PR 자체가 만든 새 위험은 없다.

## 위험도

LOW
