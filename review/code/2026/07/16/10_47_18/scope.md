# Scope Review — commit b9c162cd1 (ci(e2e): playwright base 태그 ↔ @workflow 클로저 정합 config-guard)

리뷰 대상: `git diff HEAD~1..HEAD` — 6 files changed, 510 insertions(+), 1 deletion(-).

- `scripts/check-e2e-playwright-config.py` (신규, 260 lines)
- `.claude/tests/test_check_e2e_playwright_config.py` (신규, 227 lines)
- `.github/workflows/e2e.yml` (+17, config-guard job 신설 + needs 2곳)
- `.github/workflows/harness-checks.yml` (+1, paths 등재)
- `codebase/frontend/Dockerfile.playwright-e2e` (comment only, +2/-1)
- `docker-compose.e2e.yml` (comment only, +2)

## 발견사항

- **[INFO]** `e2e` job(backend-only supertest)에도 `needs: config-guard` 추가 — 가드가 실제 검사하는 두 불변식(playwright 버전↔base 태그, frontend `@workflow` 클로저↔Dockerfile COPY↔compose 마스킹)은 모두 `codebase/frontend/Dockerfile.playwright-e2e` / `docker-compose.e2e.yml` playwright-runner 서비스에 관한 것으로, `e2e` job 이 실제로 빌드·실행하는 것은 `backend-e2e` / `backend-e2e-runner` 뿐(`Makefile` `e2e-test` 타깃 확인, playwright-runner 미포함)이다.
  - 위치: `.github/workflows/e2e.yml:39-40` (`e2e:` job 의 `needs: config-guard`)
  - 상세: 엄밀히 말해 `e2e` job 은 이 가드가 지키는 invariant 와 기술적 인과관계가 없다. 다만 (a) 체크가 5분 timeout·수 초 내 완료되는 저비용 정적 검사이고, (b) 커밋 메시지·PR 코멘트에 "e2e/e2e-frontend 가 needs 로 fail-fast"라고 의도가 명시돼 있어 우발적 변경이 아니라 "e2e 파이프라인 전체의 설정 위생을 fail-fast 로 통일" 하려는 의식적 설계 판단으로 읽힌다. 실질적 해는 없음(로직 변경 아니라 job 간 순서/게이팅만 추가) — 리팩터링·의도 이탈이라기보다는 "가드 범위를 job 단위로 균일하게 적용" 하는 선택이 다소 넓다는 정도.
  - 제안: 의도된 설계라면 현행 유지로 충분(차단 사유 아님). 더 좁히고 싶다면 `e2e` job 은 `needs` 제거하고 `e2e-frontend` 만 게이트하는 것도 고려 가능 — 필수는 아님.

- **[INFO]** `plan/in-progress/pnpm-migration-followups.md` 는 이번 커밋의 범위(diff)에 포함돼 있지 않다. 해당 문서 §4 말미에는 이 작업(playwright 버전↔base 태그 CI 가드)이 "저우선 후속 2건" 중 하나로 명시돼 있고, 같은 파일의 다른 §4 항목들은 완료 시 `~~취소선~~` + `완료(날짜)` 로 갱신되는 확립된 패턴을 따르는데, 이번 커밋은 그 패턴을 따르지 않았다.
  - 위치: `plan/in-progress/pnpm-migration-followups.md:113-117` (변경 없음, diff 밖)
  - 상세: 코드 diff 자체의 범위 이탈은 아니지만(오히려 diff 에 plan 파일이 없다는 "누락"), CLAUDE.md 의 plan 라이프사이클 규약(작업 완료 시 plan 갱신) 관점에서 이 커밋 하나만으로 작업 트래킹이 닫히지 않는다. 별도 후속 커밋에서 plan 문서를 갱신할 계획이라면 문제 없음.
  - 제안: 동일 PR 내 후속 커밋으로 plan 문서에 완료 주석을 추가할 것을 권장(코드 리뷰 차단 사유는 아님).

## 가드 로직 자체의 범위 점검

`scripts/check-e2e-playwright-config.py` 는 명시된 두 불변식만 검사한다 — 그 이상의 검사(예: compose 문법 전체 검증, 다른 Docker 이미지 태그, backend Dockerfile 관련 규칙 등)로 확장하지 않았다. 정규식은 "manifest-only COPY 는 제외"·"major.minor 만 비교(patch 차이는 허용)" 등 설명된 요구사항과 정확히 일치하며, 실측 결과 실제 저장소에 대해 `check()` 가 빈 리스트(위반 없음)를 반환하고 harness unittest 11개가 모두 통과함을 확인했다(로컬 실행 검증 완료).

`.github/workflows/e2e.yml` 의 `config-guard` job 은 `migration-check.yml`/`harness-checks.yml` 과 동일한 기존 컨벤션(`actions/checkout@v7` + `actions/setup-python@v6`, `timeout-minutes: 5`, stdlib-only 스크립트)을 그대로 따른다 — 신규 패턴 도입 없음.

`harness-checks.yml` 변경은 기존 `scripts/report_playwright_flaky.py` 항목 바로 아래 한 줄 추가로, 파일 헤더 주석에 이미 명시된 "harness unittest 가 커버하는 scripts/ 는 paths 에 등재" 규칙을 그대로 따른 최소 변경이다.

Dockerfile.playwright-e2e / docker-compose.e2e.yml 의 코멘트 수정은 각 2줄 내외 순수 추가로, "이 정합은 `scripts/check-e2e-playwright-config.py` 가 강제한다"는 사실만 덧붙였다 — 기존 주석의 서술(SoT·정렬 규칙)을 바꾸지 않고 enforcement 포인터만 추가한 최소·정확한 편집. 스코프 크리프 없음.

## 요약

이 커밋은 설명된 목적(CI config-guard 스크립트 + harness 테스트 + e2e.yml/harness-checks.yml 와이어링 + 관련 주석 포인터 추가) 범위 안에서 정확하게 닫혀 있다. 무관한 리팩토링·포맷팅 노이즈·불필요한 임포트·기능 확장은 발견되지 않았고, 가드 스크립트는 명시된 두 불변식만 검사해 overreach 가 없다. `e2e` job 에 `needs: config-guard` 를 붙인 것은 가드가 실제 검사하는 내용과 엄밀히는 무관한 backend-only job 까지 게이팅한다는 점에서 다소 넓은 판단이지만 의도적 설계로 보이고 실질적 위험이나 side effect 는 없다(저비용 정적 체크). PR 번들링(node-linker 전환 PR 에 이 §4 후속을 포함) 은 사용자가 명시적으로 요청한 사항이므로 스코프 문제로 볼 수 없다. plan 문서 갱신 누락은 diff 자체의 결함이 아니라 트래킹 완결성 관점의 참고사항이다.

## 위험도

LOW
