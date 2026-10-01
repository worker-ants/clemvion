# 정식 규약 준수 검토 (convention_compliance) — `.claude/docs` (--impl-done, diff-base=origin/main)

## 검토 범위와 전제

- scope `.claude/docs` 의 이 브랜치(`claude/nerv-cutover-1-69b98d`) 델타는 0개 파일이다. 델타 0 은 정상이고 이것만으로 지적하지 않았다.
- 구현 diff 5개 파일(155줄)은 전부 `codebase/frontend/src/lib/docs/__tests__/` 아래다. `spec-links.ts`(`inNervMirror` 신설), `spec-link-integrity.test.ts`, `spec-area-index.test.ts`, `stray-tool-tags.test.ts`, `tree-walk.test.ts`.
- `.claude/docs` 를 실제로 고치는 쪽은 짝 planner 브랜치 `claude/nerv-cutover-1-docs-c46df0`(`plan-lifecycle.md` +1줄, `worktree-policy.md` +8줄)이다. 프롬프트 말미의 짝 diff 와 `git diff origin/main...claude/nerv-cutover-1-docs-c46df0 -- .claude/docs` 로 확인했다. 이 브랜치는 `origin/main` 에 병합되지 않았다.
- 대조한 규약은 `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md`(§1·§4·§4.2·R-9), 미러 `spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md` R-12 다. 문서 구조 3섹션 규칙은 `spec/` 문서 대상이라 `.claude/docs` 에는 적용하지 않았다.

### 직접 확인한 사실 (워킹트리 절대경로 기준)

- `inNervMirror` 정규식 `NERV_MIRROR` 를 `git ls-files spec` 566개 경로에 돌렸다. 일치 170개(미러 169 + `README.md`)이고, 이름에 `/CLE-` 가 들어가면서 안 걸린 경로는 0개다. 새 테스트의 양성 4건·음성 5건 기대값도 모두 맞는다.
- `python3 .claude/tools/nerv-mirror/pull.py --check` → `미러 169편 · 문제 0`. R-12 의 「169편」과 일치한다.
- 세 곳의 미러 판정이 같은 모양인지 봤다. `pull.py` 의 `KEY_RE`, 오케스트레이터 `_NERV_MIRROR_REL`, `spec-links.ts` `NERV_MIRROR`. `.claude/tests/test_nerv_mirror_pull.py` 에 `MirrorPredicateParityTest` 가 실재하고, `.github/workflows/harness-checks.yml` 에 `spec-links.ts` 가 등재됐다.
- 짝 docs diff 가 인용한 대상이 모두 실재한다. `guard_nerv_owned_paths.py`(PreToolUse `Write|Edit|MultiEdit|NotebookEdit`, 표지 파일 `.claude/tools/nerv-mirror/pull.py`), `BYPASS_NERV_OWNED_PATHS`, CI 잡 `spec-mirror-integrity`, `test_guard_nerv_owned_paths.py` 의 `bash -c` 배선 테스트(238행). 단계 1(`spec/`)·2(`review/`)·3(`plan/`) 순서도 훅 docstring 과 같다.
- `worktree-policy.md` 신규 링크 `plan-lifecycle.md#3-이동-규칙` 은 헤딩 `## 3. 이동 규칙` 의 slug 와 맞는다. 거버넌스 링크 가드(spec-impl-evidence §4.2 (3))에 걸리지 않는다.
- `review-citations.md` §2·§3: diff 의 `+` 줄 전체에서 bare `hh_mm_ss` 는 0건이다. 리뷰 산출물 인용(`review/…`)도 새로 들어오지 않았다. `.github/` 신규 주석에도 리뷰 인용은 없다.

## 발견사항

- **[WARNING]** 훅은 이 브랜치에 있고 그 훅을 설명하는 `.claude/docs` 는 병합 전인 짝 브랜치에만 있다
  - target 위치: `.claude/docs/plan-lifecycle.md` §3 「인입 참조」, `.claude/docs/worktree-policy.md` §5(Enforcement). 이 브랜치 HEAD 기준이다.
  - 위반 규약: `.claude/hooks/guard_nerv_owned_paths.py` docstring 의 도입 원칙(「거버넌스 문서가 그 경로의 쓰기를 더는 안내하지 않을 때 더한다. 먼저 막으면 문서가 시키는 일을 훅이 막는다」). 이 원칙과 짝으로 `spec/conventions/spec-impl-evidence.md` §3.1·§4 `spec-status-lifecycle` (c)(plan 이동 때 `status` 승격·`pending_plans` 정리를 가드가 요구) 가 걸려 있다.
  - 상세: 이 브랜치 HEAD 에서 `git grep guard_nerv_owned_paths\|BYPASS_NERV_OWNED_PATHS` 를 `.claude/docs`·`CLAUDE.md`·`.claude/skills` 에 돌리면 0건이다(`PROJECT.md` 에만 있다). 그런데 훅은 `.claude/settings.json` 에 이미 등록돼 있다. 이 브랜치가 먼저 병합되면 plan 을 `complete/` 로 옮기는 PR 이 옛 `spec/<영역>/` 문서의 plan 링크·`status` 를 고쳐야 하는데(`plan-lifecycle.md` §3, docs 가드가 요구) 훅이 그 편집을 막고, 우회 변수 `BYPASS_NERV_OWNED_PATHS=1` 을 안내하는 문서는 아직 `main` 에 없다. 훅이 스스로 경계한 순서 역전이 병합 순서에 따라 그대로 생긴다.
  - 제안: 짝 planner 브랜치를 먼저(또는 같은 시점에) 병합한다. 두 PR 본문에 「`claude/nerv-cutover-1-docs-c46df0` 가 먼저」를 적는다. 병합 순서를 강제하기 어렵다면 이 브랜치의 병합 전 점검 항목에 `.claude/docs` 의 훅 안내 존재를 넣는다. 거버넌스 문서는 `project-planner` 소유라 developer 가 이 브랜치에서 `.claude/docs` 를 직접 고치지 않는다.

- **[INFO]** 코드 주석의 「SoT」 포인터가 미러 면제를 담지 않은 동결 문서를 가리킨다
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` 머리 주석(「SoT: spec/conventions/spec-impl-evidence.md §4.2」), `spec-links.ts` 의 `NERV_MIRROR` 주석.
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §4.2 표(`spec-area-index.test.ts` 예외 칸 = 「`spec/conventions/`, 카탈로그」, `spec-link-integrity.test.ts` 예외 칸 = 「생성형 `*-api-catalog/` 트리」). 그 절은 스스로 「본 절이 규약 SoT」라고 한다.
  - 상세: 코드는 이제 NERV 미러도 면제한다. 이 면제를 적은 곳은 미러 `spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md` R-12 와 표 176·177행이다. 옛 `spec/conventions/spec-impl-evidence.md` 는 단계 1 부터 동결이라 갱신할 수 없고, 이 불일치는 설계상 단계 5 까지 간다. 다만 `spec-area-index.test.ts` 주석은 면제 문장 바로 다음 줄에서 여전히 옛 문서를 SoT 로 가리키고, `spec-links.ts` 주석도 R-12 를 인용하지 않는다. 읽는 사람이 옛 SoT 를 열면 면제 근거를 못 찾는다. 참고로 미러 frontmatter 는 `status: "draft"`, `read_as: "approved_fallback"` 이다. R-12 가 NERV 에서 승인된 상태인지는 이 검토에서 확인하지 못했다.
  - 제안: 두 주석에 `spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md` R-12 를 한 줄 더한다(코드 주석이라 developer 범위). 옛 `spec-impl-evidence.md` 는 고치지 않는다.

- **[INFO]** `plan-lifecycle.md` 짝 추가 문장의 「이 두 가지」가 가리키는 수가 모호하다
  - target 위치: 짝 브랜치 `plan-lifecycle.md` §3 신규 인용문 둘째·셋째 문장.
  - 위반 규약: 해당 없음(서술 명료성). 형식 일관성 제안이다.
  - 상세: 「plan 링크」와 「`pending_plans` 정리 · `status` 승격」을 나열한 뒤 「이 두 가지는 그 줄만 우회로 고친다」고 쓴다. 항목이 둘(링크, 정리·승격)인지 셋(링크, 정리, 승격)인지 읽는 사람이 센다. 우회 범위가 좁게 허용되는 문장이라 모호함이 곧 범위 확대로 읽힐 수 있다.
  - 제안: 「이 둘」 대신 「plan 링크 줄과 frontmatter 의 `pending_plans` · `status` 줄만」처럼 대상을 직접 적는다.

- **[INFO]** `.claude/docs/README.md` 인덱스 행이 새 §5.1 을 반영하지 않는다
  - target 위치: `.claude/docs/README.md` 의 `worktree-policy.md` 행(9행). 짝 브랜치가 `worktree-policy.md` 에 §5.1 을 추가하지만 README 는 안 건드린다.
  - 위반 규약: 해당 없음. README 의 「각 문서가 자기 주제의 SSOT」라는 자체 관행이다.
  - 상세: 행 설명은 「Worktree-based work rule, naming, the 4-layer default-branch guard, `worktree-*`→`claude/*` normalization」이다. NERV 소유 경로 가드는 4-layer 와 별개라고 §5.1 이 스스로 밝히므로 이 설명으로는 찾을 수 없다.
  - 제안: 행에 「NERV-owned path guard」를 한 구절 더한다. 같은 짝 PR 에서 처리한다.

- **[INFO]** `stray-tool-tags.test.ts` 의 하한 상수와 「실측」 주석이 미러 편입으로 낡았고 단계 5 에서 깨진다
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` `MIN_EXPECTED_MD_FILES.spec = 190`, 「2026-09-01 실측 … spec 386」 주석. 이 diff 는 미러를 일부러 스캔하도록 주석만 고쳤다.
  - 위반 규약: 해당 없음(규약 항목이 아님). 「주석의 실측도 실측이어야 한다」는 파일 자신의 원칙이다.
  - 상세: 지금 `spec/` 의 `.md` 는 557개(옛 트리 387 + 미러 170)다. 스캔 대상이 늘어 386 은 더 이상 현재 값이 아니다. 하한 190 은 지금은 통과하지만, 단계 5(Task `CLE-T-7M4C4X`)에서 옛 트리를 지우면 미러 170개만 남아 190 아래로 내려가 가드가 RED 가 된다. 이 가드는 미러 도입으로 구조가 바뀐 것을 코멘트로 알리면서 하한은 그대로 뒀다.
  - 제안: 규약 위반은 아니므로 지금 수정을 강제하지 않는다. 단계 5 작업 목록에 이 상수 재조정을 넣는다. 원하면 이 주석에 「단계 5 에서 재조정」이라고 적는다.

## 문제 없음으로 확인한 항목

- 명명: 신규 식별자 `inNervMirror`·`NERV_MIRROR` 는 같은 파일의 `inGeneratedCatalog`(함수)·상수 명명과 일관되고 `pull.py`(`MIRROR_FIELDS` 등)·오케스트레이터(`is_nerv_mirror`·`_NERV_MIRROR_REL`)와 이름 맥락이 같다. 테스트 이름은 각 파일의 기존 언어를 따른다(`spec-link-integrity.test.ts` 영어, `tree-walk.test.ts` 한국어).
- 출력·API·swagger 규약: 이 diff 에 해당 표면이 없다.
- 금지 항목: bare 리뷰 시각 인용 0건, 옛 `spec/<영역>/` 링크를 새로 늘리는 주석 0건. 새 링크는 짝 docs 의 `plan-lifecycle.md#3-이동-규칙` 하나이고 유효하다.
- 문서 구조: `.claude/docs` 문서는 `## N.` / `### N.M` 번호 구조이고 짝 diff 의 `### 5.1`, 인용문 들여쓰기(`  > `)는 같은 파일의 기존 패턴(`### 2.1`, 「가드가 안 잡는다」 인용문)과 일치한다.
- CHANGELOG: 가드를 줄이는 변경(옛 트리 가드의 미러 제외)이 `CHANGELOG.md` 에 항목으로 있다(「옛 트리 가드 … 미러를 대상에서 뺀다」, 실측 49건 RED 포함).

## 요약

이 브랜치는 `.claude/docs` 를 바꾸지 않고, 구현 diff 는 docs 가드 테스트 5개 파일이다. 직접 돌려 본 결과 미러 판정 정규식은 실제 `spec/` 566개 경로에서 정확히 170개(미러 169 + README)만 고르고, `pull.py --check` 도 문제 0이다. 코드·테스트·주석에는 정식 규약(`review-citations.md`, `spec-impl-evidence.md`)의 직접 위반이 없다. 짝 planner 브랜치의 `.claude/docs` 추가분도 인용한 훅·테스트·CI 잡·링크 앵커가 모두 실재해 사실 오류가 없다. 다만 규약 준수 관점의 실질 위험은 병합 순서 하나다. 편집 가드는 이 브랜치에 있는데 그것을 안내하는 거버넌스 문서는 병합 전 짝 브랜치에만 있어, 순서가 뒤집히면 `plan-lifecycle.md` 가 시키는 plan 이동 작업을 훅이 막는다(WARNING). 나머지 넷은 INFO 다. 면제의 SoT 포인터가 미러 면제를 담지 않은 동결 문서를 가리키는 점, 우회 범위 문장의 수 표현, README 인덱스 행, 단계 5 에서 깨질 하한 상수다.

## 위험도

LOW

STATUS=success ISSUES=5 PATH=/Volumes/project/private/clemvion/.claude/worktrees/nerv-cutover-1-69b98d/review/consistency/2026/10/01/09_05_51/convention_compliance.md
