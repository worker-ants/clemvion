# 문서화(Documentation) 리뷰

## 발견사항

- **[CRITICAL]** 신규 회귀 가드(`test_e2e_exemption_paths_sync.py`)가 정작 자신이 보호하는 파일(`.github/workflows/e2e.yml`) 단독 수정에는 CI 에서 트리거되지 않음 — `harness-checks.yml` 의 `paths:` 동반 등재 누락
  - 위치: `.github/workflows/harness-checks.yml:9-40` (`paths:` 목록, `.github/workflows/e2e.yml` 미등재) / 근거가 되는 완료 주장: `plan/in-progress/harness-guard-followups.md:276`
  - 상세: 새 가드는 `.github/workflows/e2e.yml` 의 `paths-ignore` 와 `PROJECT.md` §e2e 면제 화이트리스트 를 비교한다. `PROJECT.md` 는 `harness-checks.yml` paths 목록에 이미 있지만(29행), `.github/workflows/e2e.yml` 자체는 그 목록에 없다. 즉 앞으로 누군가 `e2e.yml` 의 `paths-ignore` 만 단독으로 고치면(이번 가드가 원래 잡으려던 바로 그 드리프트 패턴 — I3 사고가 실제로 그랬듯 `.github/**` 를 워크플로에서 빠뜨리는 식) `harness-checks.yml` 자체가 트리거되지 않아 새로 만든 `test_e2e_exemption_paths_sync.py` 가 전혀 실행되지 않는다. 같은 파일(`harness-checks.yml`) 안에 이 정확히 같은 실패 클래스에 대한 인라인 주석이 이미 3곳(`.githooks/**`, `.claude/_shared/**`, `.github/dependabot.yml`+`pnpm-workspace.yaml`)에 존재하고, `plan/in-progress/harness-guard-followups.md` 의 W5 항목도 "harness-checks.yml paths 에 동반 등재 — 없으면 그 파일만 고친 PR 에서 가드가 안 돈다" 는 교훈을 명시적으로 남겼는데, 이번 W3 완료(같은 plan 파일, 같은 커밋)에서는 그 교훈이 반영되지 않았다. plan 은 W3 를 "✅ 완료" 로 표기하지만 CI 트리거 등록이 빠진 채로는 가드가 부분적으로만 유효하다.
  - 제안: `harness-checks.yml` 의 `paths:` 에 `.github/workflows/e2e.yml` 항목을 추가하고(다른 단일 파일 항목들과 같은 패턴 — 사유 인라인 주석 포함), plan 의 W3 완료 서술에도 이 등재를 포함하거나 별도 잔여 항목으로 재오픈할 것.

## 요약

이번 diff 는 코드 자체가 아니라 해네스 테스트 카탈로그·신규 회귀 가드·plan 문서 갱신으로 구성되어 있어 "문서화 품질"이 곧 변경의 본체다. `test_e2e_exemption_paths_sync.py` 의 모듈/함수/테스트 독스트링은 이례적으로 충실하다 — 파싱 경계 조건, 두 방향(wider/narrower)의 비대칭 위험, `UNMIRRORED_WHITELIST_ENTRIES` 각 항목의 근거를 모두 코드와 대조해 실측 검증했으며 전부 정확했다(`.mdx` 파일 위치, 화이트리스트 파싱 결과, `e2e.yml` 의 실제 `paths-ignore` 값 모두 주석 서술과 일치). `.claude/tests/README.md` 신규 행도 테스트 파일의 서술과 내용이 일치하고 `test_tests_readme_catalog.py` 가 요구하는 카탈로그 동기화도 충족한다. `plan/in-progress/harness-guard-followups.md` 의 체크박스(본문 + 하단 체크리스트) 갱신도 실제 완료 상태와 일치하게 잘 동기화되어 있다. 다만 유일하지만 실질적인 문제로, 이 PR 이 추가한 신규 가드가 자신이 보호 대상으로 삼는 `.github/workflows/e2e.yml` 파일의 단독 수정에는 CI 상에서 아예 실행되지 않는 설정 갭이 있다 — 이 저장소가 반복적으로 겪고 명문화까지 한 실패 클래스(가드 대상 파일이 `harness-checks.yml` paths 에 동반 등재되지 않음)의 재발이다.

## 위험도

MEDIUM
