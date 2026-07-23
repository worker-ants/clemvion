# 보안(Security) 리뷰

## 발견사항

- **[INFO]** hand-rolled YAML 파서가 pnpm workspace 의 negation glob(`!pattern`)을 지원하지 않음
  - 위치: `.claude/tests/test_dependabot_npm_coverage.py` 의 `_workspace_globs()` (게이트 50~65행)
  - 상세: `packages:` 블록의 각 라인을 그대로 `globs` 리스트에 담아 이후 `fnmatch.fnmatch(pkg_dir, g)` 로 비교한다(`_independent_trees()`, 게이트 83~94행). pnpm 은 `packages:` 항목에 `!codebase/**/fixtures` 같은 negation(제외) 패턴을 지원하는데, 이 파서는 `!` 접두 문자열을 그냥 하나의 glob 으로 취급해 `fnmatch` 에 넘긴다. `pkg_dir` 값이 `!` 로 시작할 일이 없으므로 이 항목은 절대 매치되지 않는다 — 즉 negation 이 "제외" 로 동작하지 않고 그냥 무시된다. 현재 `pnpm-workspace.yaml` 에는 negation 패턴이 없어 지금 당장 오탐/누락은 없지만(직접 확인: `packages:` 는 4개 단순 glob 뿐), 이 테스트 자체의 존재 목적이 "dependabot 커버리지 누락을 잡는 보안 가드"이기 때문에, 향후 negation 패턴이 도입되면 이 가드가 스스로 만들려는 것과 같은 종류의 조용한 사각지대(silent blind spot)를 재현할 수 있다.
  - 제안: 현재는 실사용 사례가 없어 차단 사유는 아니지만, negation 패턴 미지원을 코드 주석으로 명시하거나(예: "packages: 에 `!` 접두 negation 이 있으면 이 파서는 무시한다" 경고), `_workspace_globs()`/`ParserSanityTest` 에 negation 라인 존재 시 명시적으로 실패(또는 warning)하는 방어적 assertion 을 추가하면 좋다.

- **[INFO]** `.github/**` 를 e2e paths-ignore 에 추가하면서 CI 정의 파일 변경이 자동 검증 없이 머지될 여지가 생김 (의도된 트레이드오프, 완화책 존재)
  - 위치: `.github/workflows/e2e.yml` 게이트 21행(push), 29행(pull_request), 34행(`workflow_dispatch:` 추가)
  - 상세: `.github/**` 전체가 e2e paths-ignore 에 들어가면서, `.github/workflows/e2e.yml` 자신을 포함한 CI 정의 변경 PR 은 더 이상 자동으로 e2e 를 트리거하지 않는다. CI/CD 파이프라인 정의 파일은 공급망 보안 관점에서 민감한 대상(워크플로 인젝션, 악성 스텝 삽입 등)인데, 이 변경으로 "그 정의를 수정하는 PR 자체가 e2e 로 검증되지 않는" 창이 생긴다. 다만 코드 주석과 `plan/in-progress/harness-guard-followups.md`(I3 항목, 게이트 243~247행)에 이 트레이드오프가 명시돼 있고, `workflow_dispatch` 를 보완책으로 함께 추가했으며, `harness-checks.yml` 은 여전히 `.github/workflows/harness-checks.yml` 자신의 변경엔 반응한다(다만 `e2e.yml` 자체 변경은 harness-checks.yml paths 목록에도 없어 두 워크플로 어느 쪽도 자동 트리거되지 않는 조합이 존재함).
  - 제안: 이미 문서화된 수용 리스크이므로 차단 사유는 아니나, 브랜치 보호 규칙(required status checks)에 `e2e`/`e2e-frontend` 가 걸려 있다면 "필수 체크가 애초에 실행되지 않아 머지 차단이 안 되는" GitHub 특유의 동작(required-but-not-triggered=neutral)을 인지하고 있는지 확인 권장. 원한다면 `.github/workflows/*.yml` 자신은 paths-ignore 예외로 남기는(즉 `.github/**` 대신 `.github/dependabot.yml`, `.github/CODEOWNERS` 등 개별 비-workflow 경로만 ignore) 더 좁은 화이트리스트도 고려 가능.

- **[INFO(긍정)]** 이번 변경은 실제 의존성 보안 스캔 사각지대(A06:2021 Vulnerable and Outdated Components)를 닫는 개선
  - 위치: `.claude/tests/test_dependabot_npm_coverage.py` 전체, `.github/workflows/harness-checks.yml` 게이트 31~36행
  - 상세: pnpm workspace 밖 독립 npm 트리(`.claude/tools/mermaid-lint`)가 `pnpm audit`/Dependabot 어느 쪽에도 커버되지 않아 CVE(undici HIGH, dompurify moderate)가 영구 무신호였던 실사고를 계기로, 향후 동일 유형의 트리가 생겨도 dependabot.yml 등록을 빠뜨리면 CI 가 실패하도록 만드는 회귀 가드다. 파서 sanity 테스트(빈 결과 항진명제 차단) 설계도 적절하다.
  - `subprocess.run(["git", "ls-files", "--", "*package.json"], cwd=REPO_ROOT, capture_output=True, text=True, check=True)` — 인자가 리스트 형태이고 `shell=True` 를 쓰지 않으므로 커맨드 인젝션 경로 없음. 인자 자체도 정적 리터럴(사용자 입력 없음).

## 검토했으나 이슈 없음

- 하드코딩된 시크릿: 4개 파일 전체에서 API 키/비밀번호/토큰/인증서 문자열 없음.
- 인젝션: `subprocess.run` 은 리스트 인자 + `shell=True` 미사용. YAML/워크플로 파일은 정적 정규식 파싱이며 신뢰된 리포지토리 내부 설정 파일(사용자 입력 아님) 대상. ReDoS 가능한 중첩 quantifier/모호한 alternation 패턴 없음(모두 선형 시간).
- 인증/인가: 해당 파일들에 인증/인가 로직 없음(CI 설정·테스트·plan 문서).
- 암호화: 해당 없음.
- 에러 처리: 테스트 실패 메시지가 파일 경로·트리명 등 비민감 정보만 노출.
- GitHub Actions 자체(액션 버전 등)는 diff 에서 신규 추가되지 않음(`actions/checkout@v7` 등은 기존 값 유지, 변경분은 path 필터·트리거·주석뿐).

## 요약

이번 diff 는 근본적으로 CI/테스트 인프라 변경이다 — pnpm workspace 밖 npm 트리(mermaid-lint)의 의존성 취약점이 영구히 스캔되지 않던 실제 보안 사각지대를 Dependabot 등록 + 회귀 가드 테스트로 닫는 개선이며, 새로운 인젝션·시크릿 노출·인증 우회 등의 취약점은 발견되지 않았다. `subprocess` 호출은 안전한 리스트 인자 형태이고, 손수 짠 YAML 파서는 신뢰된 리포지토리 설정 파일만 다뤄 인젝션 표면이 아니다. 다만 두 가지 경미한 사항을 기록해 둔다: (1) 워크스페이스 glob 파서가 pnpm 의 negation(`!`) 패턴을 지원하지 않아 향후 그런 패턴이 도입되면 이 보안 가드 자체가 조용한 사각지대를 재현할 잠재적 위험이 있고(현재는 미사용이라 실질 위험 없음), (2) `.github/**` 를 e2e paths-ignore 에 추가해 CI 정의 변경이 자동 e2e 검증 없이 머지될 수 있는 창이 생겼으나 이는 문서화된 트레이드오프이며 `workflow_dispatch` 보완책이 함께 도입됐다. 둘 다 차단 사유가 아닌 참고 수준이다.

## 위험도

LOW
