# 신규 식별자 충돌 검토

대상 브랜치(`user-entity-column-defense`)는 scope `spec/2-navigation/` 를 이번 라운드도 변경하지
않는다 (델타 0개 파일 — `--impl-done` 게이트가 `workspace-response.dto.ts` 를 spec-linked 로 새로
집계하면서 `spec/2-navigation/`(→ `6-config.md` 계열)이 범위에 들어온 것일 뿐, 코드 전용 변경이라
정상이다). 신규 식별자는 전부 구현 diff에서 도입되며, 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`)를 절대경로로
직접 열어 `git diff origin/main...HEAD -- codebase/ spec/ .claude/` 전수 대조했다. 이전 다수 라운드
(`review/consistency/2026/09/06/{11_55_37,12_28_03,12_53_29,13_39_25,13_52_23,14_26_32}/naming_collision.md`)
의 결론을 현재 HEAD(`a185846a5`)로 재검증했고, 그 이후(14:26:32 라운드 이후) 새로 추가된 커밋
`a185846a5`("문서한 에러 계약이 구현보다 넓었다")의 신규 식별자를 별도로 확인했다.

## 발견사항

이번 라운드에서 새로 도입된 식별자 — `isEndpointPathUniqueViolation` / `rethrowEndpointPathConflict`
/ `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`(`triggers.service.ts`) — 를 포함해 CRITICAL/WARNING 등급의
신규 충돌은 발견되지 않았다.

- **[INFO]** 백엔드/프론트엔드 동명 `WorkflowVersionDetail` — 이전 라운드부터 JSDoc 상호 참조로
  처분된 상태가 이번 커밋(`a185846a5`)에서도 유지됨 (재확인, 신규 이슈 아님)
  - target 신규 식별자: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
    의 `export type WorkflowVersionDetail = Omit<WorkflowVersion, 'creator' | UnloadedRelations> & { creator: ProjectedCreator }`
  - 기존 사용처: `codebase/frontend/src/lib/api/workflows.ts:109` 의
    `export interface WorkflowVersionDetail extends WorkflowVersionSummary { snapshot: VersionSnapshot }`
    — 이 브랜치가 건드리지 않은 `origin/main` 기존 파일.
  - 상세: 같은 endpoint(`GET /api/workflows/:wfId/versions/:versionId`)의 같은 개념을 가리켜
    "다른 의미의 충돌"은 아니지만, 완전히 동일한 이름이 공유 타입 패키지 없이 두 레이어에 독립
    선언돼 있고 필드 optionality 도 갈려 있다(프론트 `creator?: {...} | null` 옵셔널 vs 백엔드
    `creator: ProjectedCreator` = `Pick<User,'id'|'name'|'email'>` 전부 필수). 백엔드 선언 바로 위
    JSDoc 에 "프런트엔드에 같은 이름의 별도 선언이 있다 — `codebase/frontend/src/lib/api/workflows.ts`
    의 `WorkflowVersionDetail`" 로 시작하는 블록이 이번 커밋에서도 그대로 남아 있음을 재확인했다
    (경로·optionality 차이·"개명·공유 패키지화는 이 PR 범위 밖" 명시 포함). 이번 커밋이 이 파일에
    가한 변경은 `findByWorkflow` 헤더 주석 정리(INFO#2, 타입 선언을 SoT 로 가리키게 변경)뿐이라
    해당 JSDoc 블록 자체는 영향받지 않았다.
  - 제안: 추가 조치 불요 — 두 자리 모두에서 "이름이 같은 별도 선언" 임이 grep 없이도 드러나므로
    "유일 정의" 오판 위험은 낮다. 다음에 둘 중 하나를 만질 때 이 JSDoc 이 여전히 살아 있는지만
    확인할 것.

## 조사했으나 충돌 없음으로 판정한 항목

- **`isEndpointPathUniqueViolation` / `rethrowEndpointPathConflict` / `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`
  (신규, `triggers.service.ts`, 커밋 `a185846a5`)** — 저장소 전역 grep 0건(이 파일 외 정의 없음).
  상수값 `'idx_trigger_workspace_endpoint'` 는 `migrations/V002__indexes.sql:26`
  (`CREATE UNIQUE INDEX idx_trigger_workspace_endpoint ON trigger (workspace_id, endpoint_path)`)의
  실제 인덱스명과 정확히 일치 — 새로 지어낸 이름이 아니라 기존 DB 객체를 문자열로 참조.
- **`RESOURCE_CONFLICT` / `TRIGGER_ENDPOINT_PATH_CONFLICT`(subCode)** — 신규 도입이 아니라
  `spec/2-navigation/2-trigger-list.md §2.3.1`·`§3`(라인 146·216, 이번 프롬프트 번들에 실제 본문
  포함됨)이 이미 문서화해 둔 계약 문자열을 코드가 뒤늦게 구현한 것 — target 이 새로 붙인 이름이
  아니라 기존 spec 표기와 정확히 일치. `RESOURCE_CONFLICT` 는 다른 리소스의 409 에도 이미 쓰이는
  전역 관용 코드([Spec 에러 처리](../5-system/3-error-handling.md) 계열)라 재사용이며 충돌 아님.
- `WorkspaceMemberDto.joinedAt`(신규 API 응답 필드) — DB 컬럼 `joined_at`·엔티티
  `WorkspaceMember.joinedAt`·`workspaces.service.ts`/`workspace-invitations.service.ts` 의 기존
  `joinedAt` 과 이름·의미 정확히 일치. 신규 wire 노출이지만 식별자 충돌 아님.
- `ProjectedCreator` / `CREATOR_PROJECTION` / `UnloadedRelations` — 저장소 전체(프론트 포함) grep
  0건(이 파일 외 정의 없음). `WorkflowVersionCreatorDto`(기존)와 필드 집합이 spec 테스트로 대조돼
  의미 충돌 없음.
- `USER_SECRET_KEYS` / `findUserSecretLeaks` / `expectNoUserSecrets`
  (`shared/testing/user-secret-absence.ts`) — 전역에서 이 파일 외 정의 없음. 값 목록은
  `user.entity.ts` 실제 컬럼명·`spec/5-system/1-auth.md` 기존 표기와 정확히 일치.
- `UserRelationLoad` / `findEagerUserRelations` / `collectUserRelationNames` /
  `findUserRelationLoads` / `SRC_ROOT`(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`) —
  전역 grep 0건. `SRC_ROOT` 는 `nullable-type-lie-cast-guard.ts` 에도 동명 export const 가 있으나
  각 파일이 독립 모듈이고 `repo-guards/__tests__/<name>-guard.ts` + `<name>.spec.ts` 기존 관례라
  실질 충돌 없음. `isResponseDtoFile` 은 재수출만(로컬 재구현 없음, 이전 라운드 W4 해소 재확인).
- `JsDocCitation` / `findDtoJsDocCitations` / `ViolationClassCitationDto` /
  `ViolationFieldCitationDto` / `CompliantPlainDto` / `CompliantLineCommentDto` /
  `EagerFixtureEntity` — 신규 가드/fixture 파일 안에서만 쓰이는 test-only 선언, 프로덕션 스캔
  범위 밖이라 충돌 여지 없음.
- 신규 e2e 테스트 라벨 `H`(`workflow-crud.e2e-spec.ts`)·`J`(`workspace-rbac.e2e-spec.ts`) — 각
  파일 내 다음 순차 문자와 일치, 중복 없음.
- 신규 e2e 가 때리는 endpoint — 전부 기존 엔드포인트에 대한 추가 단언, 신규 endpoint·webhook·큐·
  SSE 이벤트·ENV var·config key 는 이 diff 전체에서 도입되지 않았다.
- `.claude/hooks/_lib/review_guard.py` 의 `_strip_comment` 헬퍼(신규, 커밋 `a185846a5`)·
  `.claude/tests/test_review_guard.py` 의 신규 테스트 케이스명(`test_parse_block_list_starting_with_comment`
  등) — 내부 파서/테스트 식별자, 저장소 전역 검색 범위(spec ID·엔티티·endpoint·이벤트·ENV·config
  key·spec 파일 경로) 밖이라 이 checker 의 판정 대상이 아니며 다른 정의와 충돌하지 않는다.
- `spec/conventions/review-citations.md` / `spec-impl-evidence.md` 편집 — 신규 spec `id` 도입 없음
  (기존 두 문서 본문 정정 + frontmatter 보정). 신규 파일 경로 없음, 기존 명명 컨벤션과 충돌 없음.

## 요약

이번 브랜치가 도입하는 신규 식별자(가드 파일명·함수명·타입명·DTO 필드명·상수·e2e 라벨)는 기존
`repo-guards/__tests__/<name>-guard.ts` + `<name>.spec.ts` 명명 컨벤션, spec 이 이미 쓰는 컬럼명
표기, 그리고 `spec/2-navigation/2-trigger-list.md` 가 사전에 문서화해 둔 에러 계약 문자열
(`RESOURCE_CONFLICT`/`TRIGGER_ENDPOINT_PATH_CONFLICT`/인덱스명)과 정확히 일치하며, 다른 의미로
이미 쓰이던 이름과 충돌하는 CRITICAL/WARNING 사례는 새로 발견되지 않았다. 유일한 완전 동명 사례
(`WorkflowVersionDetail`, 백엔드 vs 프론트엔드)는 여러 라운드 전부터 알려진 계층 간 수렴이며
JSDoc 상호 참조로 이미 처분됐고, 이번 커밋(`a185846a5`)도 그 처분을 건드리지 않아 INFO 로 유지한다.
scope(`spec/2-navigation/`)에는 실제 파일 변경이 없어 해당 영역 요구사항 ID·엔티티명·API
endpoint·이벤트명·파일 경로 축에서 볼 신규 충돌 후보 자체가 없으며, 이번 커밋이 구현한
`TRIGGER_ENDPOINT_PATH_CONFLICT` 는 이미 그 spec 문서에 있던 문구를 코드가 뒤늦게 따라잡은
것이라 "신규 식별자"가 아니다.

## 위험도

NONE
