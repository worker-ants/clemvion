# 정식 규약 준수 검토 — convention_compliance

대상: `forbidden-desc-codes` 브랜치의 코드 diff(32파일/2407줄) — `origin/main` 대비. spec 델타는
`spec/conventions/swagger.md` 1개 파일(§5-4 확장 + 새 Rationale 절)이며, 이 PR 자체가 그 규약 절을
쓴 주체다. 검토는 실제 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/forbidden-desc-codes`)를
절대경로/`git -C`로 직접 읽어 수행했다(프롬프트 diff 섹션은 예산 초과로 절단됨).

## 발견사항

- **[WARNING] 신규 공용 헬퍼를 거치지 않는 기존 403 설명 2곳이 남아 있다**
  - target 위치: `codebase/backend/src/modules/auth/auth.controller.ts:431,446`
    (`switchWorkspace` — `@ApiOperation.description`·`@ApiForbiddenResponse.description`),
    `codebase/backend/src/modules/executions/executions.controller.ts:284,313`
    (재실행 라우트 2곳)
  - 위반 규약: `spec/conventions/swagger.md` §5-4 "문장은 공용 헬퍼 `FORBIDDEN_NOT_A_MEMBER` ·
    `forbiddenForRole(role)`(`common/swagger`)로 만들고" + 같은 절 Rationale "기존 라우트까지
    소급한다"
  - 상세: 두 라우트 모두 `` `...(${NOT_A_MEMBER.code})` `` 형태로 상수를 직접 보간한다 — 코드
    문자열(`NOT_A_MEMBER`/`EDITOR_REQUIRED`)은 실려 있어 신규 저장소 가드
    `forbidden-response-codes`(부분 문자열 포함 검사)는 통과하지만, 이번 PR이 129곳에 일괄 적용한
    "문장은 헬퍼로 만든다"는 구성 규칙 자체는 지키지 않는다. 두 라우트는 이번 PR 이전
    (`2026-09-25` PR)에 이미 코드가 정확히 실려 있었기 때문에 129곳 수정 대상에서 빠졌고, 그 결과
    저장소에 "헬퍼 경유" 문장과 "손 보간" 문장 두 스타일이 공존하게 됐다. 이미
    `review/code/2026/09/26/12_20_03/SUMMARY.md` INFO #4가 `auth.controller.ts` 지점을 독립적으로
    짚었고 "필수 아님(후속 정리 고려)"로 유예했다 — 동일 결함군의 두 번째 사례
    (`executions.controller.ts`)까지 함께 정리 대상에 넣을 필요가 있다.
  - 제안: 후속 정리 PR에서 두 지점을 `FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole('editor')` 로
    치환하거나, §5-4에 "가드가 셀 수 있는 코드가 이미 있는 자리는 헬퍼 치환이 강제가 아니다"라는
    범위를 `§1-7` 처럼 명시해 규약 문구와 실제 적용 범위(129곳 한정) 사이 오독을 막을 것.

- **[INFO] 서비스 판정을 덧붙이는 합성 문구의 구두점이 갈린다 (이미 code-review에서 추적)**
  - target 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:67,392`,
    `codebase/backend/src/modules/integrations/integrations.controller.ts:95-97,241`,
    `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts:39`
  - 위반 규약: `spec/conventions/swagger.md` §5-4 (문장 형식 통일 취지)
  - 상세: `forbiddenForRole()` 자체는 "또는"으로 절을 잇는데, 서비스 거부를 뒤에 붙이는 5곳은
    `, 또는`으로 쉼표를 추가해 표기가 엇갈린다. 저장소 가드는 부분 문자열만 보므로 통과하지만,
    §5-4가 표방하는 "문구 형식 통일"의 예외로 남는다. `review/code/2026/09/26/12_20_03/SUMMARY.md`
    API Contract #15에서 이미 같은 지점을 지적·유예("급하지 않음")했으므로 신규 이슈는 아니다.
  - 제안: 조치 불필요(이미 트리아지됨). 유사 합성 지점이 하나 더 생기면
    `forbiddenForRole(role, { suffix })` 형태로 흡수 고려.

- **[INFO] §3 DTO 길이 표가 `@ApiForbiddenResponse` 같은 응답 데코레이터 `description` 을
  분류하지 않는 문제가 이번 PR로 더 커졌다 (이미 백로그 등재)**
  - target 위치: `spec/conventions/swagger.md` §3 "길이 — 강제되는 것과 지향하는 것을 가른다" 표
  - 위반 규약: 같은 문서 §3 자체 — 표가 `@ApiOperation.summary`/`description`·DTO 필드
    `description` 세 갈래만 다루고 `@ApiForbiddenResponse` 등 응답 데코레이터의 `description` 은
    분류하지 않는다
  - 상세: 이번 PR이 `forbiddenForRole()` 로 채운 문장은 기본형만 40~50자, 서비스 판정을 덧붙인
    합성형은 100자를 넘는 경우도 있다(`removeMember` 등). §3 표에 이 범주가 없어 "이 길이가
    강제인지 지향인지"가 §3만 읽어서는 판정되지 않는다. 이 갭은 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-26 등재,
    `review/consistency/2026/09/26/11_12_24` W2 → `11_28_17` W1 재지적)에 planner 소관·`--spec`
    필요 항목으로 걸려 있어 신규 발견이 아니다.
  - 제안: 조치 불필요(이미 추적됨) — 별도 planner 턴에서 §3 표에 "응답 데코레이터 `description`:
    지향(무제한)" 행을 추가하거나 범위 각주를 달 때 이번 PR의 실측(40~120자대 분포)을 함께 인용할
    수 있다.

- **[INFO] 신규 가드의 swagger 메타데이터 키 상수명이 형제 가드와 다르다**
  - target 위치: `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts:26`
    (`SWAGGER_API_RESPONSE`) vs `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts:37`
    (`SWAGGER_API_RESPONSE_METADATA`) — 둘 다 `'swagger/apiResponse'` 값을 옮겨 적은 같은 의미의
    상수
  - 위반 규약: 명시적 규약 위반은 아니다(swagger.md는 이 상수명을 규정하지 않음) — 저장소 내부
    일관성 관점의 사소한 표기 차이
  - 상세: 두 가드 파일이 같은 목적의 상수를 다른 이름으로 선언해, 다음에 세 번째 가드를 추가하는
    사람이 grep 으로 기존 값을 찾기 어렵다.
  - 제안: 급하지 않음. 다음에 같은 상수를 세 번째로 옮겨 적을 일이 생기면 그때 공용 상수로 추출.

## 요약

이번 diff는 `spec/conventions/swagger.md` §5-4/§2-4 Rationale이 같은 PR 안에서 규정한 내용(공용
헬퍼 `FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole`, `lowestRequiredRole` 공유 함수, reflection 기반
저장소 가드, 대조군을 가드 spec 안에 두는 것, `code:` frontmatter 갱신)을 코드 24개 컨트롤러에
걸쳐 매우 일관되게 구현했고, CHANGELOG·plan frontmatter(`worktree`·`spec_impact` 리스트)도 프로젝트
관례를 그대로 따른다. CRITICAL 급 위반은 발견되지 않았다. 유일하게 실질적인 결함은 이번 PR이
손대지 않은 기존 2개 라우트(`auth.controller.ts` `switchWorkspace`, `executions.controller.ts` 재실행
2곳)가 새 공용 헬퍼를 쓰지 않고 예전 방식(상수 직접 보간)을 유지해 규약이 말하는 "문장은 헬퍼로
만든다"는 구성 규칙과 어긋난다는 점이며, 이는 이미 같은 라운드의 code-review에서 부분적으로
포착돼 비차단으로 유예된 사안이다. 그 외 지적(쉼표 표기·§3 길이 표 미분류·상수명 불일치)은 모두
이미 다른 산출물에 등재됐거나 영향이 없는 INFO 수준이다.

## 위험도

LOW
