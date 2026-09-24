# 보안(Security) 코드 리뷰

## 리뷰 대상 요약

- `.github/workflows/spec-link-checks.yml` — `changes` job pathspec 에 `plan/**` 추가, `spec-link-integrity` job 이 단일 테스트 파일 대신 `src/lib/docs/__tests__/` 디렉터리 전체를 실행하도록 확장 (job 이름은 `spec-link-integrity` 로 유지)
- `PROJECT.md` — 위 워크플로 변경을 반영한 문서 서술 갱신
- `plan/in-progress/docs-guard-trigger.md` — 신규 plan 문서 (작업 배경·실측 근거)
- `review/consistency/2026/09/24/21_04_26/*` — `/consistency-check --impl-prep` 산출 리포트 6종 (SUMMARY, meta, `_retry_state.json`, 4개 checker 리포트)

모든 변경이 CI 워크플로 설정과 마크다운/JSON 문서에 국한되며, 애플리케이션 런타임 코드(백엔드 컨트롤러/서비스, 프론트엔드 컴포넌트, DB 쿼리, 인증/인가 로직 등)는 전혀 포함되지 않는다.

## 발견사항

없음.

점검한 항목과 근거:

1. **인젝션 취약점** — 해당 없음. 워크플로 diff 는 `pathspecs:` 리터럴 문자열 추가와 `run:` 커맨드를 정적 문자열(`pnpm --filter frontend test src/lib/docs/__tests__/`)로 바꾼 것뿐이며, PR 제목·브랜치명·이슈 본문 등 사용자 제어 입력을 셸 커맨드에 보간하는 패턴(`${{ github.event.* }}` 등)이 diff 안에 없다. 커맨드 인젝션·경로 탐색 벡터 없음.
2. **하드코딩된 시크릿** — 없음. 추가된 내용은 주석·문서 서술·정적 경로(`plan/**`, `src/lib/docs/__tests__/`)뿐이며 API 키·비밀번호·토큰·인증서 패턴 없음(`grep` 확인).
3. **인증/인가** — 해당 없음. `permissions: contents: read` 블록은 이번 diff 에서 변경되지 않았고, 여전히 최소 권한이다. `on:` 트리거도 `pull_request` / `push(main)` 로 변경 없음 — `pull_request_target` 같은 위험한 트리거로의 전환이나 신규 write 권한 부여는 없다.
4. **입력 검증** — 해당 없음(사용자 입력을 받는 코드가 없음).
5. **OWASP Top 10 기타** — 해당 없음. CI job 이 테스트 실행 범위를 한 파일에서 디렉터리 전체로 넓히는 변경은 보안 통제를 약화시키지 않고 오히려 plan/spec 전용 PR 에서 문서 무결성 가드(`plan-frontmatter`·`spec-pending-plan-existence` 등)가 누락 없이 돌게 하여 사각지대를 줄이는 방향이다.
6. **암호화** — 해당 없음.
7. **에러 처리** — 해당 없음. 리뷰/컨시스턴시 산출 마크다운에 스택트레이스·내부 시스템 상세가 노출되는 내용은 없고, 노출되는 것은 프로젝트 내부 파일 경로·plan/spec 문서 참조로 민감정보가 아니다.
8. **의존성 보안** — 해당 없음. 이번 diff 는 lockfile·`package.json`·`pnpm-workspace.yaml` 을 건드리지 않는다.

참고(비차단, INFO): `actions/checkout@v7` 는 이번 diff 이전부터 이미 태그 핀이었고 이번 변경으로 새로 도입된 것이 아니라 리뷰 스코프 밖이다. 별도로 다룰 필요는 없다.

## 요약

이번 변경 집합은 CI 워크플로의 pathspec/실행 범위 확장과 그에 따른 문서·plan·consistency-check 리포트 갱신으로 구성되며, 애플리케이션 코드나 사용자 입력 처리 경로를 전혀 건드리지 않는다. 워크플로의 `permissions`(`contents: read`)와 트리거(`pull_request`/`push`)는 변경되지 않아 권한 확대나 위험한 트리거 전환이 없고, 새로 추가된 내용은 정적 pathspec 리터럴과 문서 서술뿐이라 인젝션·시크릿 노출·인증 우회 등 어떤 카테고리에서도 문제가 발견되지 않았다.

## 위험도

NONE
