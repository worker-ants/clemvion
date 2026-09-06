# 변경 범위(Scope) 리뷰

## 개요

`git diff origin/main...HEAD` 는 267개 파일·25,571줄 삽입 규모이고, 그중 프롬프트가 리뷰
대상으로 지정한 것은 실제 코드/문서 25개 파일(`.claude/hooks`·`CHANGELOG.md`·
`codebase/backend/**`·`plan/in-progress/**`)과 이번 브랜치가 스스로 남긴 `review/code/**`
과거 라운드 산출물(9라운드 분)이다. `review/code/**` 산출물은 CLAUDE.md 가 지정한 정식
저장 위치(`코드 리뷰 산출물 → review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)이며 이 저장소의
표준 develop-review-fix 루프의 정상적 부산물이라 그 자체는 범위 이탈로 보지 않는다.
문제는 **실제 코드 25개 파일 쪽**에 있다.

## 발견사항

- **[WARNING]** 브랜치 이름·CHANGELOG 표제가 가리키는 과제("`User` 엔티티 컬럼 수준 방어")
  범위를 넘어, 서로 독립적인 4개 관심사가 하나의 브랜치/diff 에 누적됐다
  - 위치(관심사별 대표 위치):
    - (a) 핵심 과제 — `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`(신규 전체)·`.../user-entity-exposure.spec.ts`(신규 전체)·`codebase/backend/src/shared/testing/user-secret-absence.ts:24-79`·`codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`(creator 투영 수정) — **과제와 직접 일치**, 문제 없음.
    - (b) DTO JSDoc 인용 검출 가드 — `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`(신규 전체)·`.../dto-jsdoc-citation.spec.ts`(신규 전체)·`.../fixtures/dto/responses/jsdoc-citation.fixture.ts`(신규 전체)·`plan/in-progress/spec-draft-review-citations-enforcement.md`(신규 전체, 138줄) — `User` 비밀 컬럼 노출과 무관한 별개 관심사(내부 리뷰 서사가 공개 OpenAPI `description` 으로 새는 것을 막는 문서 규율).
    - (c) 하네스 gate 파서 버그 수정 — `.claude/hooks/_lib/review_guard.py:600-696`(`_parse_frontmatter_code`/`_strip_comment` 신설)·`.claude/tests/test_review_guard.py`(전체) — 애플리케이션 코드가 아니라 CI/리뷰 게이트 인프라 자체의 YAML 파싱 버그 수정.
    - (d) 트리거 엔드포인트 충돌 상세 코드 추가 — `codebase/backend/src/modules/triggers/triggers.service.ts:213-226,423-427,509-513,1592-1631`(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`·`isEndpointPathUniqueViolation`·`rethrowEndpointPathConflict` 신설)·`codebase/backend/src/common/db/pg-error.ts:10-11,31-46`(`pgErrorConstraint` 신설)·`.../triggers.service.spec.ts` — `User` 엔티티와 무관한 `2-trigger-list.md §3` 준수 갭 수정.
  - 상세: CHANGELOG.md·`plan/in-progress/spec-draft-nullable-notation-followups.md` 를 직접
    읽으면 이 네 관심사가 **하나가 다음을 발견하는 연쇄**로 이어진 것은 사실이다 — (b)를
    구현하며 그 규약의 spec Rationale("이 규약에는 시행 코드가 없다")이 반증돼 planner
    턴이 열렸고(별개 신규 plan 파일 (b)), (b)의 `code:` frontmatter 등재 과정에서 (c)의
    파서 버그가 드러났으며, (c)의 수정으로 gate 범위가 넓어지면서 `spec/2-navigation/`
    이 처음 spec-linked 로 잡혀 `--impl-done` 이 (d)의 Critical(문서한 에러 상세 코드가
    구현에 없음)을 새로 냈다. 각 단계는 CHANGELOG·plan 노트에 실측과 함께 투명하게
    disclose 돼 있어 "은폐된" 확장은 아니다.
    다만 순수 **범위(scope) 관점**에서는: (b)~(d) 는 "User 엔티티 컬럼 노출 방어"라는
    과제명·표제와 직접적 인과관계가 없는 세 개의 별도 산출물이며, 그중 (b)는 이미
    developer 스스로 별도 신규 plan 파일을 만들어 독립 추적 대상으로 인정하고 있고, (c)는
    애플리케이션 코드가 아닌 리뷰 하네스 자체이며, (d)는 트리거 도메인의 별개 스펙 준수
    문제다. 이 넷을 한 브랜치·한 diff 로 묶으면 (i) 되돌리기/bisect 단위가 커지고, (ii)
    "핵심 보안 가드 신설"이라는 리뷰 우선순위가 "트리거 에러 상세 코드"·"하네스 YAML 파서"
    같은 다른 위험 프로파일의 변경과 섞여 리뷰어의 주의가 분산된다.
  - 제안: 연쇄 발견 자체는 이 저장소의 정상적 관례이므로 막을 필요는 없으나, (c)·(d)는
    독립적으로 되돌리기/검증 가능하므로 향후에는 별도 커밋(가능하면 별도 plan 항목·별도
    PR)으로 분리해 "User 엔티티 방어" 검토와 "트리거 충돌 코드"·"하네스 파서" 검토를
    독립적으로 승인/롤백할 수 있게 하는 편을 권한다. 이번 건은 이미 문서화가 충실하므로
    소급 분리는 불필요.

- **[INFO]** `pg-error.ts` 의 신규 `pgErrorConstraint()` 는 "User 엔티티 컬럼 방어" 축의
  어떤 파일에서도 소비되지 않는다 — 위 (d) 가 순수하게 별개 관심사임을 뒷받침하는 근거
  - 위치: `codebase/backend/src/common/db/pg-error.ts:43-46`(정의) · 소비자는
    `codebase/backend/src/modules/triggers/triggers.service.ts:18,226` 단 한 곳
  - 상세: `grep -rn "pgErrorConstraint" codebase/backend/src/repo-guards codebase/backend/src/shared/testing codebase/backend/src/modules/workspaces codebase/backend/test/{workspace-rbac,audit-logs}.e2e-spec.ts` 결과 0건 — user-entity-exposure-guard·user-secret-absence·workspace 관련 e2e 어디에도 이 헬퍼가 쓰이지 않는다. 이 함수는 오직 트리거 엔드포인트 충돌 판정(`isEndpointPathUniqueViolation`)을 위해 신설됐다.
  - 제안: 조치 불요 — 위 WARNING 과 같은 근거로 기록.

- **[INFO]** `.claude/hooks/_lib/review_guard.py`/`.claude/tests/test_review_guard.py` 편집이
  `CLAUDE.md` 가 명시한 쓰기 권한 표(`developer` → `codebase/**`, `plan/**`, `review/**`)
  범위 밖 경로다
  - 위치: `.claude/hooks/_lib/review_guard.py` 전체, `.claude/tests/test_review_guard.py` 전체
  - 상세: `CLAUDE.md` 의 Skill 체계 표는 개발자 역할의 쓰기 권한을 `codebase/**`,
    `plan/**`, `review/**` 로 한정하고 `spec/` 은 read-only(좁은 예외 제외)라고 명시한다.
    `.claude/hooks/**` 는 이 셋 중 어디에도 속하지 않는다. `.claude/docs/worktree-policy.md`·
    `.claude/docs/plan-lifecycle.md` 를 grep 해도 "하네스 gate 파서 유지보수"를 특정 역할에
    허용하는 별도 예외 조항은 찾지 못했다. 다만 프로젝트 메모리(과거 세션 교훈)에는
    review-guard 관련 하네스 버그를 발견 즉시 인라인으로 고친 선례가 다수 있어, 이 저장소가
    실무적으로는 이런 자기참조적(harness 가 자기 자신의 게이트 버그를 드러내는) 수정을
    허용/기대하는 것으로 보인다 — 그래서 CRITICAL 이 아니라 확인 필요 사항으로 남긴다.
  - 제안: 이 브랜치의 작업자 역할이 `developer` 였다면, 하네스 코드 수정에 대한 명시적
    예외 조항이 `CLAUDE.md`/`worktree-policy.md` 에 없다는 점을 planner 에게 알려 문서화
    여부를 확인하는 편이 이후 동일 패턴의 재발 시 판단 비용을 줄인다.

- **[INFO]** 나머지 핵심 파일(10, 11, 15~21, 23~24)은 과제명과 1:1 대응하며 무관한
  포맷팅·주석·임포트 정리는 발견되지 않음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:78-93`(joinedAt, 새 e2e 가 드러낸 파생 갭으로 3곳에 disclose)·`codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1-4,1119-1192`(신규 테스트 + 필요한 import 1건)·`codebase/backend/test/audit-logs.e2e-spec.ts:17,93-96`·`codebase/backend/test/workspace-rbac.e2e-spec.ts:12-19,589-639`
  - 상세: 각 diff 를 직접 열어 확인한 결과 추가된 import 는 전부 그 파일 안에서 실제로
    소비되고, 주석은 "왜 이 형태인가"류의 설계 근거만 담고 있으며, 공백/줄바꿈만 바뀐
    구간은 없었다.
  - 제안: 조치 불요.

## 요약

핵심 25개 대상 파일 중 "User 엔티티 컬럼 노출 방어"라는 과제명에 직접 대응하는 부분
(구조 축·이름 축 가드, `workflow-versions.service.ts` creator 투영 수정, 관련 e2e·plan
갱신)은 무관한 포맷팅·주석·임포트 잡음 없이 깔끔하다. 그러나 diff 전체를 보면 서로 다른
위험 프로파일을 가진 세 개의 부가 산출물 — DTO JSDoc 인용 가드(+ 별도 신규 plan 문서),
리뷰 게이트 자체의 YAML 파서 버그 수정(`.claude/hooks/_lib/review_guard.py`), 트리거
엔드포인트 충돌 상세 코드 구현(`triggers.service.ts` + `pg-error.ts` 확장) — 이 같은
브랜치에 누적됐다. 각 단계는 CHANGELOG·plan 노트에 인과관계와 실측이 투명하게 기록돼
있어 "숨겨진" 확장은 아니지만, 과제명이 좁게 가리키는 범위를 상당히 벗어난 것은 사실이며
그중 하나(리뷰 하네스 코드)는 CLAUDE.md 가 명시한 쓰기 권한 범위 밖이다. 되돌리기·리뷰
단위를 좁게 유지하려면 향후 이런 연쇄 발견은 별도 커밋/브랜치로 분리하는 편이 낫다.

## 위험도

MEDIUM
