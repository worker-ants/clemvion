# Cross-Spec 일관성 검토 — spec/2-navigation (impl-done)

## 검토 방법

`spec/2-navigation/**` 자체의 diff 는 `origin/main` 대비 0개 파일 — "target 문서" 로 볼 신규·변경
spec 이 없다 (코드 전용 PR 이므로 정상). 프롬프트 번들의 diff 블록·`spec/2-navigation/*` 본문
대부분은 예산 절단으로 미표시였으므로, 실제 판단은 워킹트리를 절대경로/`git -C`로 직접 열어
수행했다.

- `git diff origin/main...HEAD --stat` (290 files) 로 실제 변경분을 확인.
- `spec/**` 변경은 정확히 2개: `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md` — 둘 다 `spec/2-navigation/**` 이 아니라 리뷰 인용 convention 자기 정정.
- `spec/2-navigation/*.md` 가 인용하는 코드 표면과 실제로 겹치는 지점을 골라 대조:
  - `codebase/backend/src/modules/triggers/triggers.service.ts` + `common/db/pg-error.ts` (`TRIGGER_ENDPOINT_PATH_CONFLICT` 구현)
  - `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`WorkspaceMemberDto.joinedAt` 신규)
  - `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`creator` 투영 좁힘, `ProjectedCreator`/`CREATOR_PROJECTION`)
  - e2e: `workspace-rbac.e2e-spec.ts` / `workflow-crud.e2e-spec.ts` / `audit-logs.e2e-spec.ts` (`User` 비밀 컬럼 부재 검증 추가)
- 최신 커밋(`8bbae332a`, 이번 검토 직전 커밋)은 PG 에러 fixture 통합·`CHANGELOG.md` 서술 정정·orphan JSDoc 빈 줄 제거뿐이며 위 표면·계약을 바꾸지 않는다 — 직전 컨텍스트(15:53:00 cross_spec 결과)와 실질적으로 동일한 델타.
- 나머지(다수)는 `User` 엔티티 전 컬럼 노출 방지 가드/픽스처(`repo-guards/__tests__/*-guard.ts`, `shared/testing/user-secret-absence.ts`, `pg-error-fixtures.ts` 등)로, spec/2-navigation 이 인용하는 어떤 표면도 건드리지 않는다 — grep 결과 이 가드 파일들은 `spec/` 인용 자체가 없다(순수 코드 방어층).

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** `TRIGGER_ENDPOINT_PATH_CONFLICT` 구현이 기존 spec 문서한 계약과 정합
  - target 위치: (spec 변경 없음) — `triggers.service.ts` `rethrowEndpointPathConflict` / `isEndpointPathUniqueViolation`
  - 대조 대상: `spec/2-navigation/2-trigger-list.md §3`("409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)") · `codebase/backend/migrations/V002__indexes.sql`(`idx_trigger_workspace_endpoint`, partial unique)
  - 상세: 이번 diff 는 spec 이 이미 선언해 둔 계약을 실제로 던지도록 구현을 좁혔다. 인덱스명이 실제 마이그레이션과 일치하고, 불일치 시 `false` 로 안전 폴백(전역 `RESOURCE_CONFLICT` 로 흡수)하는 구조라 다른 UNIQUE 위반과 충돌하지 않는다. **spec-코드 갭이 줄어든 사례**.
  - 제안: 없음 — 기록용 확인.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 신규 필드는 데이터 모델과 형식상 일치, `9-user-profile.md` 는 필드 표가 없어 대조 대상 자체가 없음
  - target 위치: (spec 변경 없음) — `workspace-response.dto.ts` `WorkspaceMemberDto.joinedAt: string | null`
  - 대조 대상: `spec/1-data-model.md §2.3 WorkspaceMember`(`joined_at | Timestamp?`)
  - 상세: DTO 의 `nullable: true` 는 DB 스키마의 nullable 성격을 반영한 것이고(코드 주석도 "실측상 4개 생성 경로가 전부 즉시 채운다"고 명시해 스키마-실측 간극을 스스로 인지), `2-navigation/9-user-profile.md` 는 이 응답의 필드 목록을 표로 명세하지 않으므로 충돌할 서술이 없다.
  - 제안: 조치 불요.

- **[INFO]** `WorkflowVersionDetail`/`ProjectedCreator` 타입 좁힘은 `spec/3-workflow-editor/5-version-history.md` §7.1/§7.2 의 "creator relation 포함" 서술과 모순 없음
  - target 위치: `workflow-versions.service.ts` 신규 `ProjectedCreator = Pick<User, 'id'|'name'|'email'>`, `CREATOR_PROJECTION`
  - 대조 대상: `spec/3-workflow-editor/5-version-history.md §7.1/§7.2`(필드 표는 "creator" 를 포함이라고만 하고 하위 필드 집합을 명세하지 않음), `WorkflowVersionCreatorDto`(OpenAPI 스키마)
  - 상세: spec 은 creator 의 세부 필드 집합을 규정하지 않으므로 `{id, name, email}` 로 좁혀도 spec 위반이 아니다. 새 e2e(`workflow-crud.e2e-spec.ts` H)가 `Object.keys(creator).sort() === ['email','id','name']` 로 실제 wire 형태를 고정했고 `WorkflowVersionCreatorDto` 스키마와 대조하는 단위 테스트도 있어 코드-계약 정합이 실측으로 뒷받침된다. 프런트엔드에 동명·다른 필드 집합(optional)의 손-미러 타입이 있으나 이는 naming-collision/코드리뷰 관점이지 spec 충돌 대상이 없다(양쪽 다 문서화되지 않은 내부 타입).
  - 제안: cross-spec 관점 조치 불요.

- **[INFO]** `review-citations.md`/`spec-impl-evidence.md` 상호 정정은 자기 완결적이며 다른 spec 영역과 충돌 없음
  - target 위치: (spec/2-navigation 비대상) `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md`
  - 대조 대상: 두 문서 상호 참조 및 `spec/2-navigation/9-user-profile.md` (예시로만 인용됨 — 실제 내용 미변경)
  - 상세: `code:` frontmatter 의 "준수 예시 vs 시행 코드" 구분을 축 단위로 정정한 것으로, 두 convention 문서가 서로를 일관되게 갱신했다. `review_guard._parse_frontmatter_code` 파서 버그(블록 리스트가 `#` 주석에서 break)로 41개 entry 가 유실됐던 사실도 `spec-impl-evidence.md` 안에 정정 기록으로 남겨 SoT 가 한쪽만 아는 상태를 피했다. `spec/2-navigation/9-user-profile.md` 자체는 이 diff 로 변경되지 않았다(인용된 사례일 뿐).
  - 제안: 조치 불요.

## 요약

이번 PR(`user-entity-column-defense`)의 실제 코드 변경은 `User` 엔티티 비밀 컬럼의 우발적 노출을
막는 백엔드 방어 계층(가드·픽스처·e2e 3축 — 이름 기반 부재/선언 대조/참조 필드 양성)이며,
`spec/2-navigation/**` 은 diff 0개로 전혀 수정되지 않았다. `spec/2-navigation` 이 인용하는 코드
표면과 실제로 겹치는 세 지점 — (1) 트리거 `endpoint_path` UNIQUE 충돌 응답
(`TRIGGER_ENDPOINT_PATH_CONFLICT`), (2) 워크스페이스 멤버 DTO 의 `joinedAt` 필드 추가,
(3) 워크플로 버전 `creator` 투영 좁힘 — 을 `spec/1-data-model.md`, `spec/2-navigation/2-trigger-list.md §3`,
`spec/3-workflow-editor/5-version-history.md §7`, 두 convention 문서와 대조한 결과 데이터 모델·
API 계약·상태 전이·RBAC·계층 책임 모순은 발견되지 않았다. (1)은 오히려 spec 이 이미 선언한
계약을 구현이 뒤늦게 따라잡은 사례다. 직전 검토(15:53:00, 위험도 NONE) 이후의 유일한 신규
커밋은 테스트 fixture 통합·문서 서술 정정뿐이라 판정은 변하지 않는다. CRITICAL/WARNING 없음.

## 위험도

NONE
