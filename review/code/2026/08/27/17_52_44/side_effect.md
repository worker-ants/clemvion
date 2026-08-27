# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** CI 트리거 스코프가 `.claude/**` 전체(비-md 포함)로 넓어져 거의 모든 harness 작업 PR 에서 `spec-link-integrity` 잡이 부수적으로 함께 돈다
  - 위치: `.github/workflows/spec-link-checks.yml:57-61` (`changes` job 의 `pathspecs:` 블록, 게이트 라인 57~61)
  - 상세: 신규 등재 항목은 `:(glob)*.md`(루트 md 한정, 정확)와 `.claude/**`(확장자 제한 없음) 두 개다. 실제로 `spec-link-integrity` 가드가 스캔하는 대상은 `collectGovernanceMarkdown()`(`codebase/frontend/src/lib/docs/__tests__/spec-links.ts`)이 만드는 `.claude/**.md` 뿐인데, 트리거 pathspec 은 `.claude/**` 로 `.py`/`.sh`/`.json`/훅 등 md 가 아닌 파일 변경까지 전부 이 job 을 깨운다. 이 저장소는 `.claude/**` 를 만지는 작업이 사실상 표준(하네스 자체 작업 다수)이라, "CI 갭을 메운다"는 원래 목적과 무관하게 `pnpm --filter frontend test` (vitest 1개 실행이지만 pnpm-workspace 셋업 액션까지 포함) 가 이전보다 훨씬 자주 도는 부수 효과가 생긴다.
  - 제안: 의도된 conservative-over-broad 선택(같은 파일 헤더 주석·`test_harness_checks_paths_coverage.py` 의 "strict-covered implies git-covered" 원칙과 결이 같음)으로 보이며 버그는 아니다. 다만 CI 비용 증가가 눈에 띄면 `.claude/**/*.md` 로 좁히는 것도 고려할 수 있다는 점만 기록.

- **[INFO]** 신규 vitest 스위트가 `os.tmpdir()` 아래 실제 디렉터리를 만들고 지운다 (파일시스템 부작용, 정리 로직 포함)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` (게이트 135~152, `describe("governance scope — 제외 규칙")` 의 `beforeAll`/`afterAll`)
  - 상세: `fs.mkdtempSync(path.join(os.tmpdir(), "gov-scope-"))` 로 테스트 픽스처 트리를 만들고 `afterAll` 의 `fs.rmSync(fixture, { recursive: true, force: true })` 로 지운다. 커밋된 fixture 대신 런타임 mkdtemp 를 쓴 이유가 주석에 실측(`.git/info/exclude` 가 `.claude/worktrees/` 를 모든 깊이에서 매치)으로 명시돼 있어 근거가 있는 선택이다. `fixture` 변수 대입이 `mkdtempSync` 직후 최초 statement 라 이후 write 실패 시에도 `afterAll` 이 정리를 시도할 수 있는 순서라 리크 위험은 낮다.
  - 제안: 조치 불필요 — 표준적인 vitest 임시 픽스처 패턴이고 정리가 동반돼 있음. 참고로만 기록.

- **[INFO]** `scripts/check-doc-links.py` 삭제 — 실측: 잔존 참조 없음 (인터페이스 변경 영향 확인 완료)
  - 위치: `scripts/check-doc-links.py` (파일 전체 삭제)
  - 상세: 삭제가 다른 소비처를 깨뜨리는지 저장소 전체를 grep 으로 확인했다 — `.github/**`, `.githooks/**`, `Makefile`, `.claude/skills|agents|tools|docs|tests/**` 어디에도 이 스크립트를 호출하는 코드가 없다(활성 참조는 `PROJECT.md` 의 삭제 안내 문장과 `spec-link-integrity.test.ts`/`spec-links.ts` 의 대체 사유 주석뿐이고, 나머지는 전부 `review/**`·`plan/complete/**` 의 과거 기록이라 side effect 없음). PR 자신의 주장("아무 CI·hook 도 호출하지 않았다")과 실측이 일치한다.
  - 제안: 없음 — 안전한 삭제로 확인됨.

- **[INFO]** `test_harness_checks_paths_coverage.py::filter_covers_file` 의 동작 변경 — 시그니처는 동일, `:(glob)` 접두 처리 추가
  - 위치: `.claude/tests/test_harness_checks_paths_coverage.py` (게이트 199~224, `_GIT_GLOB_MAGIC` 상수 + `filter_covers_file` 본문)
  - 상세: `filter_covers_file(filt: str, path: str) -> bool` 시그니처·반환형은 그대로지만, 이제 `filt` 가 `:(glob)` 로 시작하면 이를 벗겨내고 매칭한다. 이전에는 `:(glob)*.md` 같은 필터가 항상 매칭 실패(리터럴 `":(glob)"` 접두를 요구하는 정규식이 됐으므로)했는데, 이번 변경으로 정상 매칭된다. 이 함수는 해당 테스트 모듈 내부에서만 쓰이는 테스트 헬퍼라 외부 호출자에 대한 영향은 없다.
  - 제안: 없음 — 테스트 전용 헬퍼의 의도된 동작 확장.

- **[INFO]** 신규 module-level 상수(`GOVERNANCE_SKIP_DIRS`, `_GIT_GLOB_MAGIC`) — 불변 값이라 전역 상태 변경 리스크 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:291` (`GOVERNANCE_SKIP_DIRS`), `.claude/tests/test_harness_checks_paths_coverage.py:209` (`_GIT_GLOB_MAGIC`)
  - 상세: 둘 다 모듈 스코프의 `const`(Set/string literal)로, 런타임에 재할당되거나 외부에서 mutate 되는 경로가 없다. "전역 변수 도입" 관점에서 형식적으로는 신규 모듈 상수이지만 mutable shared state 가 아니므로 부작용 리스크는 없음.
  - 제안: 조치 불필요.

## 요약

이번 변경 집합은 문서 링크 무결성 가드의 스코프를 거버넌스 문서(`CLAUDE.md`/`PROJECT.md`/`.claude/**.md`)로 확장하고, 배선되지 않던 구식 파이썬 스크립트(`scripts/check-doc-links.py`)를 삭제해 단일 가드로 통합한 리팩터다. 삭제된 스크립트의 잔존 참조는 저장소 전체 grep 으로 재확인했고 활성 참조가 전혀 없어 안전하다. 신규 도입된 파일시스템 부작용(`os.tmpdir()` mkdtemp/rmSync)은 표준 테스트 픽스처 패턴으로 정리 로직이 동반돼 있고, CI 트리거 pathspec 확장(`.claude/**`)은 의도된 conservative 선택이지만 확장자 무관 트리거라 이 job 이 이전보다 훨씬 자주 실행되는 부수 효과가 있다(버그는 아님). 시그니처·공개 인터페이스 파괴, 예상치 못한 전역 상태 변경, 환경변수·네트워크 호출 관련 문제는 발견되지 않았다.

## 위험도

NONE
