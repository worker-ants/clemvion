# 부작용(Side Effect) 리뷰

## 검증 방법

`review/code/**` 아래 조립 프롬프트에는 336개 파일(대부분 과거 리뷰/일관성 라운드 산출물)이
포함돼 있었으나, 실질 변경은 `git diff --stat origin/main...HEAD -- codebase .claude spec
CHANGELOG.md plan` 기준 31개 파일(`review/`, `plan/complete` 제외)이다. 이 리뷰는 그 31개
파일의 실제 diff 를 저장소에서 직접 열어 분석했다. 저장소에 어떤 수정·뮤테이션도 가하지
않았다 — 모든 검증은 `Read`/`Bash grep`/`git diff` 읽기 전용으로 수행. 종료 시점
`git status --short` 결과 이 리뷰 세션 자신의 출력 디렉터리(`review/code/2026/09/06/19_31_04/`,
`review/consistency/2026/09/06/19_31_06/`) 외 잔여물 없음.

## 발견사항

- **[INFO]** `TriggersService.create`/`update` 의 에러 전파 경로가 바뀐다 — 기존 호출자 관점에서 관측 가능한 변경
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:426`(`create` 내 `.save().catch(...)`), `:512`(`update` 내 동일 패턴), `:1607`(`private rethrowEndpointPathConflict`)
  - 상세: 종전엔 `triggerRepository.save()` 가 unique violation 으로 reject 하면 원본 `QueryFailedError` 가 그대로 컨트롤러까지 올라가 전역 `GlobalExceptionFilter` 의 `isUniqueViolation` 분기가 처리했다. 이제 `create`/`update` 두 지점에서 `.catch()` 로 가로채, `(workspace_id, endpoint_path)` 인덱스(`idx_trigger_workspace_endpoint`) 위반이면 `ConflictException`(`details: { field, code }` 포함)으로 **직접** 던지고, 그 외 모든 에러(다른 UNIQUE 위반 포함)는 `throw err`로 원본 그대로 재던진다. 응답 상태 코드(409)·top-level `code`(`RESOURCE_CONFLICT`)는 기존과 동일하고 `details` 필드만 추가되므로 additive 하다고 주석에 명시돼 있고, 테스트(`triggers.service.spec.ts`)가 "다른 UNIQUE 위반은 그대로 흘려보낸다"/"unique 위반이 아닌 오류도 그대로 흘려보낸다" 두 반대 방향 대조군을 갖추고 있어 실제로 좁게 구현됐다. 다만 이 서비스의 다른 `triggerRepository.save()` 호출 지점(예: `:832`, `:1163`, `:1211`, `:1445`, `:1476`, `:1527` — schedule/secret/chatChannel 설정 등)은 이번 `.catch()` 래핑 대상이 아니다. 이 지점들이 `endpointPath` 를 바꾸지 않는 한 안전하지만, 향후 그 경로로 `endpointPath` 변경이 흘러들면 같은 unique violation 이 다시 미가공 500 으로 노출될 수 있다는 점은 이 diff 가 새로 만든 비대칭이다.
  - 제안: 조치 불요(현재 범위엔 안전) — 다만 향후 `endpointPath` 를 다루는 새 `save()` 호출을 추가할 때 이 `.catch()` 패턴을 누락하지 않도록 팀 관례로 남길 것을 권장.

- **[INFO]** `WorkflowVersionsService.findOne` 반환 타입이 `Promise<WorkflowVersion>` → `Promise<WorkflowVersionDetail>` 로 좁혀졌다 — 공개 메서드 시그니처 변경
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:141-144`(`async findOne(...): Promise<WorkflowVersionDetail>`), 타입 정의는 `:61`(`WorkflowVersionDetail`)
  - 상세: 이 메서드의 유일한 프로덕션 호출자 두 곳을 확인했다 — `workflow-versions.controller.ts:81`(그대로 반환, DTO 계약과 일치하도록 이번에 좁아진 것이 오히려 맞다)과 `workflows.service.ts:666`(`restoreVersion` 내부, `target.snapshot`/`target.version` 만 사용 — 둘 다 새 타입에 그대로 존재). `creator`(3필드로 투영)와 `workflow`(애초에 로드 안 됨) 두 필드를 타입에서 제외했는데, 두 호출자 모두 이 필드들을 참조하지 않아 컴파일·런타임 영향 없음을 확인했다. 실제로는 보안 수정(`User` 전 컬럼 유출 차단)의 부산물로 타입이 정확해진 것이라 위험한 변경이 아니지만, "공개 메서드 시그니처 변경"이라는 항목 자체는 사실이므로 기록한다.
  - 제안: 조치 불요.

- **[INFO]** `.claude/hooks/_lib/review_guard.py`의 `_parse_frontmatter_code` 파서 수정은 이 저장소 전역 게이트 판정에 영향을 미치는 공유 상태(spec `code:` 해석)를 바꾼다
  - 위치: `.claude/hooks/_lib/review_guard.py` — `_strip_comment` 신설, 블록 리스트 루프의 `break`→(빈 줄/`#` 주석 skip) 변경 (함수 `_parse_frontmatter_code`)
  - 상세: 함수 자체는 순수 파서(인자→반환값, 전역 변수 갱신 없음)이지만, 이 함수의 반환값은 `review_guard`(커밋/푸시 훅)의 spec-linked 판정 입력이다. PR 설명대로 저장소 spec 387개 중 7개 파일에서 41개 `code:` entry 가 이 수정으로 새로 인식되며, 그중 하나(`spec/2-navigation/9-user-profile.md`)가 이번에 새로 게이트에 걸려 `2-trigger-list.md §3` 관련 Critical 을 촉발했다고 CHANGELOG 에 스스로 기록돼 있다. 즉 이 diff 는 "이 PR 자신"뿐 아니라 향후 다른 브랜치들의 `--impl-done` 게이트 판정 범위도 넓힌다 — 의도된 버그 수정이고 회귀 테스트(`.claude/tests/test_review_guard.py`, 대조군 포함 신규 11개 케이스)가 정방향·반대 방향을 모두 커버하지만, "전역 훅의 판정 범위가 넓어진다"는 넓은 블라스트 radius 자체는 side-effect 관점에서 명시할 가치가 있다. 함수 시그니처는 그대로다.
  - 제안: 조치 불요(의도된 변경, 테스트로 커버). 팀이 이 hook 변경을 머지한 뒤 기존 in-flight PR 들의 게이트 판정이 바뀔 수 있다는 점만 인지.

- **[INFO]** 신규 export 다수 — 전부 additive, 기존 시그니처 파괴 없음
  - 위치: `codebase/backend/src/common/db/pg-error.ts:43`(`pgErrorConstraint`), `codebase/backend/src/modules/triggers/triggers.service.ts:222`(`isEndpointPathUniqueViolation`), `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:37`(`CREATOR_PROJECTION`, `Object.freeze` 로 동결), `codebase/backend/src/shared/testing/user-secret-absence.ts:24,45,72`(`USER_SECRET_KEYS`, `findUserSecretLeaks`, `expectNoUserSecrets`), `codebase/backend/src/shared/testing/pg-error-fixtures.ts:30,38`(`makePgUniqueViolation`, `makePgError`)
  - 상세: `pg-error.ts`의 기존 함수(`pgErrorCode`, `isPostgresUniqueViolation`)는 본문이 그대로이고, 새로 추가된 `PgLikeError.constraint`/`driverError.constraint` 필드도 옵셔널이라 이 헬퍼를 이미 쓰던 유일한 다른 호출자(`integration-oauth.service.ts:1274,1833`, `isPostgresUniqueViolation`만 사용)에 영향 없음을 확인했다. `CREATOR_PROJECTION`은 `Object.freeze`로 동결되어 `findByWorkflow`/`findOne` 두 호출부가 같은 참조를 공유해도 한쪽이 실수로 뮤테이트해 다른 쪽 쿼리 옵션이 오염되는 경로가 없다.
  - 제안: 조치 불요.

- **[INFO]** 신규 repo-guard/테스트 헬퍼 파일들은 파일시스템 읽기만 하고 쓰기·네트워크·env 접근이 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`(`fs.readFileSync` 2곳), `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`(`fs.readFileSync` 1곳)
  - 상세: `grep -n "process.env|writeFileSync|fs\.(write|unlink|rm|mkdir)|execSync|spawn|http|fetch("` 로 이 파일들과 `codebase/backend/src/shared/testing/*.ts` 전부를 스캔했고 매치 0건. 프로덕션 스캔 대상 디렉터리(`src/modules`)는 형제 가드와 동일 패턴을 따르며, 신규 fixture 파일들은 프로덕션 스캔 경로 밖(`__tests__/fixtures/**`)에 있어 베이스라인을 오염시키지 않는다는 각 파일 JSDoc 주석과 실제 배치가 일치한다.
  - 제안: 조치 불요.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 기존 런타임 동작을 바꾸지 않는 선언 보정
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`joinedAt: string | null` 필드, `WorkspaceMemberDto` 클래스)
  - 상세: `WorkspacesService.listMembers`(diff 밖, 기존 코드)가 이미 `joinedAt: m.joinedAt` 을 실어 보내고 있었음을 `codebase/backend/src/modules/workspaces/workspaces.service.ts:199-221` 에서 확인했다. 즉 이번 변경은 wire 형태를 바꾸는 것이 아니라 OpenAPI 선언을 실측 동작에 맞추는 것이며, DTO 자체가 응답 직렬화 로직에 관여하지 않으므로 (컨트롤러가 서비스 반환값을 그대로 내보내는 구조) 부작용 없음.
  - 제안: 조치 불요.

## 요약

이번 diff(User 엔티티 컬럼 노출 방어 2축 + 트리거 endpoint_path 충돌 계약 구현 + workflow-versions creator 유출 수정 + review_guard 파서 버그 수정)에서 전역 변수 신설·부적절한 뮤테이션·예상치 못한 파일시스템 쓰기·환경변수 접근·의도치 않은 네트워크 호출은 발견되지 않았다. 신규 export 는 전부 additive 이고, 기존 함수(`pgErrorCode`, `isPostgresUniqueViolation`)의 본문·시그니처는 그대로다. 유일하게 관측 가능한 동작 변경 두 가지 — (1) `TriggersService.create`/`update` 의 unique-violation 에러가 이제 구조화된 `ConflictException`으로 직접 던져지고 다른 `.save()` 호출 지점은 이 처리 밖에 남아 있다는 점, (2) `WorkflowVersionsService.findOne` 반환 타입이 좁혀졌다는 점 — 은 둘 다 기존 호출자 전수를 확인했고 실제 영향이 없음을 검증했다. `.claude/hooks/_lib/review_guard.py` 파서 수정은 함수 자체는 순수하지만 그 반환값이 저장소 전역 게이트(향후 다른 PR의 spec-linked 판정 범위)에 영향을 준다는 점은 side-effect 관점에서 명시적으로 기록해 둘 가치가 있으며, 이는 의도된 버그 수정이고 정방향/반대방향 회귀 테스트로 커버돼 있다. 전반적으로 위험도는 낮다.

## 위험도

LOW
