# 보안(Security) 코드 리뷰

## 리뷰 대상 요약

이번 diff 는 33개 파일로 구성되지만 전부 다음 두 범주 중 하나다:

1. **실제 변경분** (파일 1~6): `.claude/tests/README.md`(카탈로그 문서 갱신), `.claude/tests/test_spec_link_checks_scope.py`(신규 pytest 회귀 테스트), `.github/workflows/spec-link-checks.yml`(CI 워크플로 pathspec/실행범위 확장), `CHANGELOG.md`, `PROJECT.md`, `plan/in-progress/docs-guard-trigger.md`(신규 plan 문서).
2. **직전 리뷰 라운드의 산출물을 저장소에 커밋한 것** (파일 7~33): `review/code/2026/09/24/21_16_58/**`, `review/consistency/2026/09/24/{20_34_01,21_04_26}/**` — 모두 markdown 리포트 / JSON 상태 파일이며, 애플리케이션 코드가 아니다.

애플리케이션 런타임 코드(컨트롤러·서비스·DB 쿼리·인증/인가 로직·프론트엔드 컴포넌트)는 이번 변경 어디에도 없다.

## 발견사항

없음.

점검한 항목과 근거:

1. **인젝션 취약점** — 해당 없음. `.github/workflows/spec-link-checks.yml` 의 diff 는 `pathspecs:` 블록에 정적 리터럴 `plan/**` 을 추가하고, `run:` 커맨드를 `pnpm --filter frontend test src/lib/docs/__tests__/spec-link-integrity.test.ts` → `pnpm --filter frontend test src/lib/docs/__tests__/` 로 바꾼 것뿐이다. 두 값 모두 정적 문자열이며, PR 제목·브랜치명·이슈 본문 등 사용자 제어 입력을 `run:` 에 직접 보간하는 `${{ github.event.* }}` 류 패턴은 diff 안에 없다(워크플로 전체를 확인해도 `run:` 블록에 그런 보간이 없다). `permissions: contents: read` 와 `on: pull_request / push(main)` 트리거도 이번 diff 에서 변경되지 않았다. 신규 파이썬 테스트(`test_spec_link_checks_scope.py`)는 `yaml.safe_load` 로만 워크플로 YAML 을 읽고, `subprocess`/`os.system`/`eval` 등 외부 입력을 실행하는 코드가 없다. 커맨드 인젝션·YAML 역직렬화 인젝션·경로 탐색 벡터 없음.
2. **하드코딩된 시크릿** — 없음. 실제 소스 변경분에는 주석·문서 서술·정적 pathspec 문자열만 있고 API 키/비밀번호/토큰/인증서 패턴이 없음(`grep -iE "password|secret|api[_-]?key|token|BEGIN (RSA|PRIVATE)"` 확인). 커밋되는 리뷰 산출물(`meta.json`, `_retry_state.json`)에는 세션 시각·체커 목록·로컬 작업 디렉터리의 **절대 파일 경로**(예: `/Volumes/project/private/clemvion/.claude/worktrees/docs-guard-trigger/...`)가 포함되지만, 이는 자격 증명이 아니라 로컬 개발 머신의 저장소 내부 경로이며 본 프로젝트 컨벤션상 리뷰 산출물은 저장소에 커밋되는 것이 정상 흐름이다(민감정보 노출 아님). `review/code/2026/09/24/21_16_58/RESOLUTION.md` 가 기록하듯, 직전 라운드에서 지적됐던 `meta.json` 의 세션 전용 scratch 절대경로 문제(WARNING #1, `side_effect` 카테고리 — 정보 유출이 아니라 "기록의 재현 불가능성" 문제였다)는 이번 diff 에서 저장소 상대경로(`spec/conventions/spec-impl-evidence.md`)로 정정되어 있음을 확인했다(파일 30 `review/consistency/2026/09/24/21_04_26/meta.json`).
3. **인증/인가** — 해당 없음. `spec-link-checks.yml` 의 `permissions: contents: read` 블록은 변경되지 않았고 여전히 최소 권한(read-only)이다. `pull_request_target` 같은 위험한 트리거로의 전환이나 신규 write 권한 부여는 없다. `needs.changes` 결과와 무관하게 잡이 항상 도는 `if: ${{ !cancelled() }}` 구조도 이번 diff 이전부터 있던 기존 설계이며, no-op 분기(`relevant == 'false'`)는 단순 `echo` 뿐 권한 우회와 무관하다.
4. **입력 검증** — 해당 없음. 사용자 입력을 받아 처리하는 코드가 이번 diff 에 없다.
5. **OWASP Top 10 기타** — 해당 없음. CI 잡의 트리거 범위(`plan/**` 추가)와 실행 범위(단일 파일 → 디렉터리 전체)를 넓히는 이번 변경은 오히려 plan/spec 전용 PR 에서 문서 무결성 가드(`plan-frontmatter`·`spec-pending-plan-existence` 등)가 누락 없이 돌게 하는 방향이라, 보안 통제를 약화시키지 않고 CI 검증 사각지대를 줄인다.
6. **암호화** — 해당 없음. 해시/암호화 알고리즘이나 평문 전송과 관련된 코드가 없다.
7. **에러 처리** — 해당 없음. 리뷰/컨시스턴시 산출 markdown·JSON 에 스택트레이스나 내부 시스템 상세가 노출되는 내용은 없다. 노출되는 것은 프로젝트 내부 파일 경로·plan/spec 문서 참조 정도로 민감정보가 아니다.
8. **의존성 보안** — 해당 없음. `package.json`/lockfile/`pnpm-workspace.yaml` 등 의존성 매니페스트는 이번 diff 에 포함되지 않는다.

참고(비차단, INFO): `actions/checkout@v7` 는 이번 diff 이전부터 이미 태그 핀이었고 새로 도입된 것이 아니므로 리뷰 스코프 밖이다.

## 요약

이번 변경 집합은 CI 워크플로(`spec-link-checks.yml`)의 트리거 pathspec 확장(`plan/**` 추가)과 실행 범위 확장(단일 테스트 파일 → 디렉터리 전체), 그에 대응하는 신규 회귀 테스트·문서·plan 갱신, 그리고 직전 리뷰 라운드 산출물의 저장소 커밋으로 구성되며, 애플리케이션 코드나 사용자 입력 처리 경로를 전혀 건드리지 않는다. 워크플로의 `permissions`(`contents: read`)와 트리거는 변경되지 않아 권한 확대·위험한 트리거 전환이 없고, `run:` 커맨드는 항상 정적 문자열이라 인젝션 벡터가 없다. 직전 라운드에서 지적됐던 리뷰 산출물의 scratch 절대경로 기록 문제도 상대경로로 정정된 상태를 확인했다. 인젝션·시크릿 노출·인증 우회·암호화·에러 처리·의존성 보안 어느 카테고리에서도 문제가 발견되지 않았다.

## 위험도

NONE
