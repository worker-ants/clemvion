# 보안(Security) 리뷰

## 범위 확인

`meta.json` 기준 실제 코드 변경 파일(25개: `.claude/hooks/_lib/review_guard.py`,
`.claude/tests/test_review_guard.py`, `CHANGELOG.md`, `codebase/backend/**`,
`codebase/frontend/src/lib/api/workflows.ts`)과 `plan/**` 문서를
`git diff origin/main...HEAD -- .claude codebase` 로 직접 대조해 검토했다.
`review/code/**`·`review/consistency/**` 하위 산출물은 과거 리뷰 라운드의 기록
파일이라 보안 관점의 코드 검토 대상이 아니다(내용도 확인했으나 하드코딩된 값·
새 실행 경로 없음).

## 발견사항

이번 diff 는 성격상 **보안 강화 PR**이다 — 새 취약점을 만들지 않았고, 오히려
과거 라운드에서 발견된 실유출(`WorkflowVersionsService.findOne` 이 `User` 전
컬럼을 투영 없이 반환하던 Critical)을 닫는 수정과, 향후 같은 유형의 유출을
잡는 정적/런타임 검출기 2축(`user-entity-exposure-guard.ts` 구조 축,
`user-secret-absence.ts` 값 축)을 신설했다. 아래는 Critical/Warning 이 아니라
확인 과정에서 남기는 참고 사항이다.

- **[INFO]** `WorkflowVersionsService.findOne` 의 `User` 전체 컬럼 유출 수정이 실제로 닫혔음을 직접 확인
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `findOne` 메서드의 `select` 옵션(`CREATOR_PROJECTION` 사용), 파일 상단 `CREATOR_PROJECTION` 상수 선언
  - 상세: diff 는 `relations: ['creator']` 만 있던 `findOne` 에 `select: { ..., creator: CREATOR_PROJECTION }` 을 추가해 `id`/`name`/`email` 3필드로 좁혔다. `findByWorkflow`(목록 조회)와 동일한 투영을 공유 상수로 묶어 두 메서드가 다시 갈리지 않게 했고, `workflow-versions.service.spec.ts` 가 이 상수의 키를 `WorkflowVersionCreatorDto` 의 OpenAPI 스키마 프로퍼티와 대조하는 테스트를 갖고 있어 한쪽만 넓어져도 실패하도록 되어 있다. 저장소 전체에서 `User` 타입 관계(`creator`/`executor`/`owner`/`user`)를 투영 없이 싣는 다른 자리가 남아 있는지 별도로 grep 했고(`auth.service.ts#logout/refresh`, `workspaces.service.ts#listMembers`, `executions.service.ts`/`dashboard.service.ts` 의 `executor` — 전부 `leftJoin+addSelect` 또는 응답에 넣지 않는 형태), 새로 추가된 래칫 테스트(`user-entity-exposure.spec.ts`)의 `EXPECTED_USER_RELATION_LOADS` 목록과 일치함을 확인했다. 새 결함 아님 — 수정이 올바르게 적용됐음을 확인한 기록.
  - 제안: 조치 불요.

- **[INFO]** `TriggersService.rethrowEndpointPathConflict` 는 대상 외 에러를 삼키지 않고 그대로 재던진다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rethrowEndpointPathConflict` 함수, `isEndpointPathUniqueViolation` 함수
  - 상세: `(workspace_id, endpoint_path)` UNIQUE 위반만 인덱스 이름(`idx_trigger_workspace_endpoint`)으로 좁혀 409 로 변환하고, 그 외 에러는 `throw err` 로 그대로 흘려보내 전역 예외 필터가 처리하게 한다. 응답 메시지(`같은 워크스페이스에 그 엔드포인트 경로를 쓰는 트리거가 이미 있어요.`)도 내부 구현(SQL 제약명, 스택 등)을 노출하지 않는 일반화된 문구다. 하드코딩된 자격증명·SQL 조립 없음. 새 결함 아님 — 안전한 패턴임을 확인한 기록.
  - 제안: 조치 불요.

- **[INFO]** `.claude/hooks/_lib/review_guard.py` frontmatter 파서 변경은 신뢰 경계 밖 입력을 다루지 않는다
  - 위치: `.claude/hooks/_lib/review_guard.py` — `_parse_frontmatter_code`, `_strip_comment`
  - 상세: 저장소 내부 `spec/*.md` 를 읽어 YAML 유사 `code:` 필드를 파싱하는 CI/hook 전용 로직으로, 외부 사용자 입력이나 네트워크 요청을 받지 않는다. 정규식(`re.split(r"\s+#", …)`, `re.match(r"^\s*-\s*(.+)$", …)`)은 중첩 정량자가 없어 ReDoS 형태가 아니며, 새 로직이 값을 지어내지 않고 실제 파일 내용만 반영하므로 인젝션 표면이 없다. 새 결함 아님.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음 (전수 grep 확인)
  - 위치: 전체 diff(`.claude`, `codebase`)
  - 상세: AWS 키 패턴, PEM 헤더, `sk-` 형 API 키, `password=`/`secret=` 리터럴 대입 패턴으로 diff 전체를 grep 했고, `USER_SECRET_KEYS`(컬럼 **이름** 목록, 값 아님) 외에는 매치가 없었다. 새 e2e(`workflow-crud.e2e-spec.ts`, `workspace-rbac.e2e-spec.ts`, `audit-logs.e2e-spec.ts`)의 `Authorization: Bearer ${...}` 는 모두 `registerAndLogin` 등 런타임 로그인 헬퍼가 발급한 토큰 변수를 참조하며 리터럴 토큰 값이 아니다.
  - 제안: 조치 불요.

## 요약

이번 변경 세트는 `User` 엔티티 민감 컬럼(비밀번호 해시·2FA 시크릿·복구 코드·계정 탈취용 토큰) 노출을 막기 위한 방어 강화 작업으로, 새로운 인젝션·인증 우회·하드코딩된 시크릿·안전하지 않은 암호화·민감 정보 에러 노출 중 어느 것도 도입하지 않았다. 오히려 과거 라운드가 찾은 실유출(`WorkflowVersionsService.findOne`)을 `select` 투영으로 닫았고, 그 투영이 실제로 적용됐는지·같은 유형의 유출이 다른 자리(`auth.service.ts`, `workspaces.service.ts`, `executions.service.ts`, `dashboard.service.ts`)에 남아 있지 않은지를 직접 grep 으로 대조해 새로 추가된 정적 가드(`user-entity-exposure-guard.ts`)·값 가드(`user-secret-absence.ts`)의 커버리지 주장과 일치함을 확인했다. `.claude/hooks/_lib/review_guard.py`(YAML frontmatter 파서 수정)와 `dto-jsdoc-citation-guard.ts`(공개 API 문서로 나가는 JSDoc 내부 서사 검출)도 각각 dev-tool·문서 위생 목적으로 외부 입력을 처리하지 않아 별도 취약점 표면을 만들지 않는다. 저장소 뮤테이션 없이 읽기 전용으로만 검토했으며, `git status --short` 로 확인 결과 이 리뷰 세션이 만든 산출물 외 잔여물 없음.

## 위험도

NONE
