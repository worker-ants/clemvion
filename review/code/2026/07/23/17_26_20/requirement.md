# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** 신규 가드가 자기 자신의 감시 대상 파일(`.github/workflows/e2e.yml`) 변경만으로는 CI 에서 트리거되지 않는다 — 회귀 재발의 가장 직접적인 경로가 커버되지 않음.
  - 위치: `.github/workflows/harness-checks.yml:9-40` (`on.pull_request.paths` 목록 — 이번 diff 밖 파일이라 실제 소스 줄번호로 기재. `Read` 로 직접 확인함)
  - 상세: `.claude/tests/` 스위트(`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`)를 돌리는 CI 워크플로는 `harness-checks.yml` 하나뿐이며, 이는 `pull_request` 이벤트의 `paths:` 목록에 매칭될 때만 실행된다. 그 목록에는 `.claude/tests/**`·`PROJECT.md`·`.github/dependabot.yml`·`pnpm-workspace.yaml` 등은 있지만 **`.github/workflows/e2e.yml` 자체는 없다**. 즉 이 신규 가드(`test_e2e_exemption_paths_sync.py`)가 지키려는 바로 그 파일 — `paths-ignore` 목록 — 을 단독으로 편집하는 PR 은 `harness-checks.yml` 을 아예 트리거하지 않아 이 가드가 실행되지 않는다. 이는 plan 본문(`plan/in-progress/harness-guard-followups.md`)이 **바로 두 줄 아래(W5 항목)** 에서 명시한, 저장소가 반복해서 겪은 바로 그 실패 클래스다: "harness-checks.yml paths 에 `dependabot.yml`·`pnpm-workspace.yaml` 동반 등재 — 없으면 그 파일만 고친 PR 에서 가드가 안 돈다". W5 는 그 교훈을 실제로 반영했으나(35-36행에 두 경로 추가), 같은 PR/세션에서 완료 처리된 W3 는 상응 조치(`e2e.yml` 자체를 `harness-checks.yml` paths 에 추가)를 하지 않았다. `test_no_paths_ignore_entry_escapes_the_whitelist`/`test_every_whitelist_entry_is_mirrored_or_explained` 로직 자체는 실측 검증 결과 정확하지만(현재 e2e.yml·PROJECT.md 상태로 16/16 통과), "회귀 가드 완료"라는 plan 상 완료 표시(`- [x] W3 ... ✅ 완료`)는 CI 배선이 빠진 채로는 그 표시가 약속하는 보장(자동 재발 탐지)을 실제로 주지 못한다.
  - 제안: `harness-checks.yml` 의 `paths:` 목록에 `.github/workflows/e2e.yml` 을 추가한다(주석으로 이유 명시 — 다른 항목들과 동일 패턴). 추가 전까지는 plan 의 W3 완료 표시에 "CI 트리거 미배선" 을 명시적으로 남기는 것이 최소한 정직하다.

## 검증한 사항 (문제 없음)

- `parse_paths_ignore_blocks`/`parse_exemption_whitelist`/`_yaml_scalar` 를 실제 `.github/workflows/e2e.yml`·`PROJECT.md` 내용에 대입해 수동 추적한 결과와, `python3 -m unittest discover -s .claude/tests -p 'test_e2e_exemption_paths_sync.py'` 실행 결과(16/16 pass)가 일치함. `push`/`pull_request` 두 `paths-ignore` 블록이 `['.claude/**', '.github/**', 'spec/**', 'plan/**', 'review/**', '*.md']` 로 동일하고, PROJECT.md 화이트리스트의 부분집합이며, `UNMIRRORED_WHITELIST_ENTRIES` 7건이 PROJECT.md 화이트리스트의 미러 안 된 항목과 정확히 1:1 대응함을 직접 확인했다.
- 방향 비대칭(넓은 쪽 hard fail / 좁은 쪽 사유 기재 허용) 이 코드·docstring·PROJECT.md 정책과 line-level 로 일치.
- `codebase/frontend/src/content/docs/**` 예외 사유("guide pages feed the Next build e2e boots")와 실제 `*.mdx` 파일 99개 전부가 그 서브트리 밑에 있다는 주장도 `git ls-files '*.mdx'` 로 실측 확인해 정확함.
- `.claude/tests/README.md` 신규 카탈로그 행은 `test_tests_readme_catalog.py` 가 요구하는 조건(모든 실제 파일이 표에 등재, dangling 행 없음)을 충족 — 표는 set 기반 검사라 삽입 위치(알파벳 순서 아님)는 가드와 무관.
- 전체 하네스 스위트(`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`) 483건 전부 통과, 신규 파일이 기존 테스트를 깨지 않음.
- TODO/FIXME/HACK/XXX 주석 없음. 반환값 누락·에러 시나리오 미정의 없음(`ValueError` 로 loud failure, silent-empty 방지 sanity test 존재).
- `plan/in-progress/harness-guard-followups.md` 의 W3 완료 서술·E 항목 사용자 결정 기재는 diff 상 실제로 반영된 코드 상태(현재는 결정만 기록, 구현은 미착수 `[ ]`)와 일치 — 체크박스 허위 없음.
- `spec/` 디렉토리에는 이 하네스 테스트 계약을 규정하는 문서가 없음(PROJECT.md·`.claude/tests/README.md` 가 SoT) — spec 누락이 아니라 애초에 스코프가 harness convention 문서이므로 INFO 조차 해당 없음.

## 요약

신규 가드(`test_e2e_exemption_paths_sync.py`)의 파싱·판정 로직은 실제 `.github/workflows/e2e.yml`/`PROJECT.md` 내용을 정확히 반영하고 16개 테스트 전부 통과하며, README 카탈로그·plan 체크박스도 정직하게 갱신됐다. 다만 이 가드가 막으려는 회귀(`e2e.yml` 의 `paths-ignore` 가 PROJECT.md 화이트리스트에서 벗어나는 재발)의 가장 직접적인 트리거 — `e2e.yml` 자체의 단독 편집 — 이 `harness-checks.yml` 의 `paths:` 목록에서 빠져 있어 CI 상 가드가 실행되지 않는다. 같은 plan 문서가 두 줄 아래에서 동일 실패 클래스(W5, dependabot.yml/pnpm-workspace.yaml)를 정확히 처리한 것과 대조적이라, "완료" 로 표시된 W3 의 회귀 방지 보장이 실질적으로 불완전하다.

## 위험도

MEDIUM
