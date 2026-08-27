# 변경 범위(Scope) Review

## 발견사항

없음.

검토 근거:

- 전체 diff(`a17e1a0da`(origin/main)..HEAD, 22 파일)를 `git diff --stat`/`git diff` 로 프롬프트와
  대조해 파일별 hunk 수가 정확히 일치함을 확인함 (숨겨진 추가 변경 없음).
- PR 의 단일 목적은 "`spec-link-integrity` 가드의 스코프를 거버넌스 문서(루트 `*.md` 비재귀 +
  `.claude/**.md`)로 확장"이며, 모든 파일 변경이 그 목적에 직접 연결된다.
  - `spec-links.ts`/`spec-link-integrity.test.ts`: 신규 스코프 3 구현 + 회귀 테스트
    (`collectGovernanceMarkdown`/`findBrokenGovernanceLinks`, `MIN_CLAUDE_DOCS`,
    `worktrees`/`node_modules` 제외 fixture, 양성 검출 케이스). `beforeAll/afterAll`·`os`
    import 추가도 새 fixture 가 요구하는 최소 임포트로 범위 안.
  - `scripts/check-doc-links.py` 삭제: plan 문서에 "고유 기능 0(뮤테이션으로 확인)" 근거가
    명시돼 있고, 신규 가드가 그 역할을 대체 — 동일 스코프를 보는 가드가 둘이던 상태를 정리.
  - `.github/workflows/spec-link-checks.yml`: 넓힌 스코프를 CI 가 실제로 트리거하도록
    `pathspecs` 에 `:(glob)*.md`·`.claude/**` 추가. 스코프 확장의 직접 필수 후속.
  - `.claude/tests/test_harness_checks_paths_coverage.py`,
    `.claude/tests/test_ci_paths_changed.py`: 위 `:(glob)` pathspec 매직을 판정 함수(`filter_covers_file`)와
    실행 계층(`ci-paths-changed.sh`→`git diff`) 양쪽에서 pin. `git diff` 로 hunk 를 재대조해
    프롬프트에 실린 diff 와 100% 일치함을 확인 — 무관한 리팩토링 없음.
  - `PROJECT.md`(3곳), `.claude/docs/test-wrapper.md`, `.claude/skills/spec-coverage/SKILL.md`:
    넓힌 스코프로 새로 검출된 깨진 링크 4건 수정 + "문서 링크 검증" 절을 신규 가드 기준으로
    재서술. plan 문서의 실측 표(4건)와 파일·줄이 1:1 대응.
  - `spec/conventions/spec-impl-evidence.md` §4.2: 신규 스코프 (3)을 SoT 표에 반영 — 직전
    리뷰 라운드(`17_52_44`)의 WARNING(SPEC-DRIFT) 지적에 대한 수정이며 plan 체크리스트 (f)로도
    등재돼 있어 "요청 밖 spec 수정"이 아니라 이 PR 자체가 만든 결함의 시정.
  - `plan/in-progress/spec-sync-external-interaction-api-gaps.md`: 완료 체크박스 전환 +
    실측·결정 근거 기록. 작업 대상 항목("doc-link 검사기가 `CLAUDE.md`·`.claude/**` 를 안
    훑는다")과 정확히 일치.
  - `review/code/2026/08/27/17_52_44/**`(RESOLUTION/SUMMARY/각 리뷰어 결과/meta/`_retry_state`):
    같은 PR 안에서 먼저 돈 `/ai-review` 라운드의 산출물 — 이 저장소 컨벤션상 `review/` 는
    git 추적 대상이고, 이 PR 이 그 라운드의 WARNING 3건(W1 SPEC-DRIFT, W2/W3 회귀 테스트 부재)을
    바로 이어서 수정했으므로 같은 diff 에 포함되는 것이 이 프로젝트의 표준 fix-after-review
    흐름과 일치한다. 신규 기능·무관 리팩토링 아님.
- 포맷팅 전용 변경, 미사용 import 정리, 관련 없는 주석 수정, 요청 밖 설정 변경은 관찰되지 않음.
- 기능 확장(over-engineering) 징후 없음 — 스코프 정의를 `walkTree` 기존 유틸(`skipDir`/`includeFile`)
  재사용으로 구현해 신규 기반 코드를 늘리지 않음.

## 요약

diff 22개 파일 전부가 "governance 문서를 doc-link 가드 스코프에 편입"이라는 단일 plan 항목으로
수렴하며, CI 트리거 배선·`:(glob)` 매직 회귀 테스트·중복 스크립트 삭제·spec SoT 갱신·직전
리뷰 라운드의 WARNING 수정까지 모두 그 목적의 직접 필수 후속이거나 이 PR 자신이 발견한 결함의
시정이다. `git diff` 로 원본과 대조해 프롬프트에 없는 숨은 변경도 없음을 확인했다. 요청 이상의
변경, 무관한 리팩토링, 기능 확장, 포맷팅/주석/임포트 잡음은 발견되지 않았다.

## 위험도

NONE
