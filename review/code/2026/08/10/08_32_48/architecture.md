# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** `spec-plan-completion.test.ts` 가 production 판정 로직(`isGateCEnforced`/`hasValidSpecImpact`/`claimsUnfinished`)을 별도 모듈로 분리하지 않고 `.test.ts` 파일 안에 직접 정의·export 한다 — 같은 디렉터리·같은 커밋의 자매 파일들이 보여주는 확립된 경계와 어긋난다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:38` (`export function isGateCEnforced`), `:43` (`export function hasValidSpecImpact`), `:88` (`export function claimsUnfinished`)
  - 상세: 같은 디렉터리에는 "로직은 `.ts`, 검증은 `.test.ts`" 패턴이 이미 확립돼 있다 — `spec-frontmatter-parse.ts`/`spec-frontmatter-parse.test.ts`, `impl-anchor-parse.ts`/`impl-anchor-existence.test.ts`, 그리고 이번 변경분 자체인 `spec-links.ts`(로직) / `plan-link-integrity.test.ts`(소비자)가 그 예다. 반면 `spec-plan-completion.test.ts` 는 게이트 판정 로직 3개를 별도 `.ts` 파일 없이 테스트 파일 안에서 정의하고 같은 파일 안의 `describe` 블록에서 소비한다. 재사용성이 떨어지고(다른 스크립트나 lint 규칙이 이 판정 로직을 쓰려면 `.test.ts` 를 import 해야 하며, 이는 vitest 외 번들러/tsconfig 가 테스트 파일을 빌드·타입체크 대상에서 제외하는 설정과 충돌할 수 있다), 같은 PR 안에서 두 개의 서로 다른 module-boundary 관례가 공존하게 된다.
  - 제안: `isGateCEnforced`/`hasValidSpecImpact`/`claimsUnfinished` 를 `spec-plan-completion.ts` (또는 유사 이름)로 분리하고 `.test.ts` 에서 import 하도록 자매 파일들과 동일한 패턴으로 맞춘다.

- **[WARNING]** `spec-links.ts` 안에 구조적으로 동일한 재귀 디렉터리 워커가 세 번 복제되어 있다 (`collectSpecMarkdown` / `collectPlanMarkdown` / `collectCodebaseSources`).
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:130`(`collectSpecMarkdown`), `:268`(`collectPlanMarkdown`), `:333`(`collectCodebaseSources`)
  - 상세: 세 함수 모두 "stack 에 push/pop 하며 `fs.readdirSync(cur, {withFileTypes:true})` 로 순회 → 확장자 필터 → `relPath` 계산 → `localeCompare` 정렬"이라는 동일한 알고리즘을 각자 손으로 다시 구현한다. 차이는 스킵 조건(하나는 스킵 없음, 하나는 `archive` 하드코딩, 하나는 `CODEBASE_SKIP_DIRS` set)과 확장자 필터뿐이다. 이 PR 의 Python 쪽(`git_probe.py`)이 정확히 이 "복제된 코드가 조용히 갈라진다"는 결함 클래스를 없애려고 5~6개 함수를 `_shared` 로 추출한 사례를 문서화하고 있는데, 같은 PR 의 TS 쪽에서 동일한 패턴의 3중 복제를 새로 들여왔다 — 스킵 조건 하나(예: dotfile/hidden dir 처리)가 세 곳 중 한 곳에서만 고쳐지고 나머지는 못 따라가는 형태로 재발할 여지가 있다.
  - 제안: 공통 워커 `walkFiles(roots, { isSkipDir, isMatch })` 형태로 추출하고 세 함수를 그 위의 얇은 wrapper 로 재작성한다. (`findBrokenLinksInFiles` 가 스캔 로직을 `LinkScanOptions` 로 파라미터화해 잘 재사용하는 것과 대칭되는 개선이다.)

- **[INFO]** `consistency_orchestrator.py::collect_context` 가 CLI 모드 분기(4개)·코퍼스 랭킹·diff 조립·포맷팅을 하나의 긴 함수(약 225줄)에 모두 담고 있다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 `collect_context` 함수 (`def collect_context(args, root):` 부터 `return {...}` 까지)
  - 상세: 단명 CLI 스크립트라는 성격과 각 결정에 대한 풍부한 인라인 근거(rationale) 주석을 감안하면 지금 형태가 "테스트 가능성"을 해치진 않지만, 4개 모드(`--spec`/`--plan`/`--impl-prep`/`--impl-done`) 분기와 랭킹 클로저(`_prioritized`, `_n_on_topic`)가 한 함수 스코프에 섞여 있어 향후 다섯 번째 모드를 추가하거나 랭킹 정책을 바꿀 때 영향 범위를 가늠하기 어렵다.
  - 제안: 당장 리팩터링이 필요한 수준은 아니나, 모드별 처리를 `_collect_spec_mode`/`_collect_impl_done_mode` 등으로 쪼개는 안을 백로그에 남겨둘 만하다.

## 요약

`_shared/git_probe.py` 추출은 이 리뷰에서 가장 눈에 띄는 긍정적 변화다 — `review_guard`/`plan_guard`/`branch_guard`·두 orchestrator 사이에 반복적으로 갈라지던 git 프로브 6종을 단일 구현으로 통합했고, 넓은 예외 처리(broad catch)를 원시 함수가 아니라 각자의 신뢰성 계약이 다른 소비자(fail-closed 가드 vs fail-empty 오케스트레이터) 쪽으로 정확히 위임했으며, `_shared → hooks/_lib` 역참조까지 제거해 레이어 경계를 개선했다. `test_plan_guard.py` 의 AST/identity 기반 파생 검증은 "손으로 쓴 목록"이라는 반복 결함 클래스를 구조적으로 봉쇄하는 좋은 패턴이다. `session.py::create_session_dir` 의 원자적 재시도 로직, `spec-links.ts` 의 `LinkScanOptions` 기반 strategy 패턴(단일 스캔 엔진을 세 코퍼스가 공유)도 확장성이 좋다. 다만 TS 쪽에서 디렉터리 워커가 새로 3중 복제되었고, `spec-plan-completion.test.ts` 는 같은 디렉터리의 확립된 "로직/테스트 분리" 관례를 따르지 않아 module-boundary 일관성이 흔들린다. 순환 의존은 발견되지 않았다.

## 위험도

LOW
