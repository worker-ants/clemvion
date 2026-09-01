# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, (1) code-review fix(developer/resolution-applier) 단계가 CLAUDE.md 의 좁은 예외 조건을 충족하지 못한 채 `spec/conventions/error-codes.md` 를 직접 수정한 절차 위반(scope), (2) `_CHECKBOX` 정규식의 반대 방향 오탐이 저장소 실사용 문서 구조와 실제로 겹친다는 신규 근거(testing) 가 재상정할 가치가 있는 WARNING 으로 남는다. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 7명 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | 서로 다른 역할(developer/harness ↔ project-planner/spec)의 작업이 같은 커밋 2개에 계속 함께 묶인다 — 1라운드에서 이미 지적됐고 사용자 지시(RESOLUTION W1: "PR 본문에 두 축 리뷰 책임자 명시")로 처리된 사안의 재확인. `spec-conventions-engine-error-code-surface.md` 는 스스로 "분리 등재" 라 적어 두고도 `worktree:` 가 harness 작업과 동일(`easy-a-harness-hygiene`)하고 최종적으로 같은 두 커밋(`b5d2e6972`, `9c0028371`)에 합쳐짐 | `plan/in-progress/spec-conventions-engine-error-code-surface.md:3,17`, `review/code/2026/09/01/22_25_37/RESOLUTION.md:8-19` | 새 조치 불요(이미 채택된 트레이드오프). PR 생성 시 RESOLUTION W1 이 약속한 "harness축/spec축 리뷰 책임자 분리" 서술이 실제 PR 본문에 들어갔는지 확인 |
| 2 | scope | code-review fix(resolution-applier/developer 역할) 단계가 `spec/conventions/error-codes.md` 의 기존 문장("대표 surface")을 직접 편집 — CLAUDE.md 자기-반증형 소정정 예외의 5조건 중 1번("developer 자신이 그 문장을 썼다")과 게이트(`--impl-done` 을 그 spec 파일 포함 scope 로 재실행)를 모두 미충족. 문장 자체는 2025년 이전부터 있던 기존 규약 서술이며, `RESOLUTION.md:79-83` 검증 목록에 이 파일 대상 `--impl-done`/`--spec` 재실행 없음 | `spec/conventions/error-codes.md:26`, `review/code/2026/09/01/22_25_37/RESOLUTION.md:21-28`(W2), `CLAUDE.md:64,70,73` | 이 편집을 포함하는 `--impl-done`(대상에 `spec/conventions/error-codes.md` 포함)을 사후 실행하거나, 이 편집이 어느 트랙(planner 연속 턴 vs developer 예외)이었는지 커밋 메시지/plan 에 명시 |
| 3 | testing | `_CHECKBOX` 정규식 확장(`^\s*`→`^[\s>]*`)의 반대 방향 오탐(인용문 안 **닫힌** 체크박스만으로 top-level 체크박스 없는 문서가 허위 "완료" 판정)이 테스트되지 않음. 직접 재현(scratch 스크립트, `done=1,open=0`→`_all_checkboxes_done()==True`)했고, 저장소 자체 역사(`plan/complete/auth-config-webhook-followups.md` 가 in-progress 였을 때 정확히 이 구조: 인용 blockquote 안 닫힌 체크박스 9줄 + 프로즈 불릿 작업 추적)에 실제 선례가 있음. 1라운드에서 "정규식 대칭성상 실패 가능성 낮음"으로 미조치됐으나 그 근거가 이 실측과 배치됨 | `.claude/hooks/_lib/plan_guard.py:87,237-268`, 회귀 테스트 `.claude/tests/test_plan_guard.py:265-301` | `test_narrative_bracket_mention_is_not_a_checkbox` 옆에 미러 테스트 추가 — top-level 체크박스 없이 인용문 안 닫힌 체크박스만 있는 본문이 `_all_checkboxes_done()==False` 를 유지하는지 확인(현재는 `True` 로 RED 예상). 의도적으로 `True` 여야 한다면 주석/커밋에 명시, 아니면 로직을 비대칭화 |
| 4 | testing | `stray-tool-tags.test.ts` 의 "전제" 테스트 임계값(`MIN_EXPECTED_MD_FILES=100`) 이 두 스캔 루트(`plan`, `spec`) 중 하나가 조용히 빠지는 부분 실패를 못 잡음 — 실측 `plan/` 505개·`spec/` 386개, 각 루트 단독으로도 100 초과라 한 루트가 완전히 빠져도 전제 테스트가 여전히 통과 | `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts:58,83-90,109-111` | 두 루트를 개별 호출로 분리해 각각 개별 하한(예: 각 200개) 단언, 또는 최소 "각 루트 1개 이상" 개별 하한 추가 |
| 5 | testing | `_CHECKBOX` 확장과 같은 목적의 독립 사본이 `.claude/tools/plan-stale-audit.sh` 에 있는데 이번 PR 이 갱신하지 않았고 drift 를 잡는 테스트/가드도 없음 — `plan_guard.py` docstring 이 "이 페어가 두 번 drift 했다"고 스스로 적었는데 같은 클래스의 새 drift 발생(다른 파일이라 기존 AST 동일 함수 검출 테스트 사정권 밖) | `.claude/tools/plan-stale-audit.sh:123-125` | 스크립트 자체 수정은 불요(informational only, 하드 게이트 아님). `_CHECKBOX` 주석 또는 `harness-review-gate-followups.md` 후속 항목에 drift 사실 한 줄 기록 |
| 6 | maintainability | 신규 문장의 markdown `**` 자기중첩이 렌더링 시 의도한 강조("자신의")를 깨뜨림 — 실측 렌더(Python-Markdown) 결과 무관한 두 구간이 따로 굵게 표시되고 정작 강조하려던 단어는 굵게 안 됨 | `.claude/docs/plan-lifecycle.md:45` | 안쪽 강조를 `*...*` 로 바꾸거나(다른 델리미터는 중첩 가능) 안쪽 강조를 제거해 단순화 |
| 7 | SPEC-DRIFT | `[SPEC-DRIFT]` 신규 build-blocking 가드 `stray-tool-tags.test.ts` 가 그 가드 family 의 SoT 로 자처하는 `spec/conventions/spec-impl-evidence.md §4.2` 에 등재되지 않은 채 커밋됨(코드는 올바르고 의도적, spec 쪽 카탈로그 개수·표만 낡음) — 이미 1라운드에서 지적되고 `RESOLUTION.md`(W5)가 "이번 PR 범위 제외, 다음 harness 가드 추가 시 함께 처리"로 근거와 재개 조건을 남겨 명시적으로 유예·추적 중(묵살 아님) | `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규 파일), `spec/conventions/spec-impl-evidence.md:4-18,128,132-134`("build 차단 4건", 표에 5번째 행 없음), `plan/in-progress/harness-review-gate-followups.md:174-182` | 이번 PR 조치 불요(유예 근거 타당, 재개 신호 명확). 다음 harness 가드 추가 PR 에서 `spec-impl-evidence.md §4.2` 표에 행 추가 + "4건"→"5건" + frontmatter `code:` 리스트 갱신을 함께 반영 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `_CHECKBOX` 정규식 확장이 모듈 전역 상수라 소급 적용되지만, `_all_checkboxes_done()` 반환값은 Stop-gate 소프트 넛지(`complete_but_in_progress`)에만 쓰이고 push 하드블록(`untouched`)은 `handled` 로만 결정돼 영향 없음(코드 추적으로 확인). 역방향 오탐 부재도 현재 스냅샷에서는 실측됐으나 향후 blockquote 로 체크박스 문법을 예시하는 서술이 추가되면 재발 가능(fenced code block 미구분은 pre-existing 특성) | `.claude/hooks/_lib/plan_guard.py:87,259,271-330` | 조치 불요, 참고용 기록 |
| 2 | maintainability | `error-codes.md` 신규 문단의 괄호 안에 완결 문장 + 다음 문단으로의 전방 참조가 함께 들어 있어 정보가 두 곳에 흩어지고 첫 읽기에서 괄호 범위를 놓치기 쉬움 | `spec/conventions/error-codes.md:25-31` | 괄호 안은 파일 경로 인용만 남기고 전방 참조 문구는 삭제하거나 다음 문단 앞으로 이동. 차단 사유 아님(우선순위 낮음) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음 — 실행 코드 변경 4건 모두 저장소 로컬 파일에만 적용되는 선형 패턴, 시크릿 전수 스캔 0건 |
| requirement | LOW | 실행 검증(unittest 36/36, vitest 34/34) 전부 통과, spec 본문도 소스와 line-level 대조 일치. 유일 발견은 SPEC-DRIFT(SoT 미등재, 이미 유예 추적됨) |
| scope | MEDIUM | 역할 혼재 재발(사용자 승인된 트레이드오프) + spec/ 직접수정 절차 위반(CLAUDE.md 예외 조건 미충족, 신규) |
| side_effect | LOW | `_CHECKBOX` 소급 적용의 blast radius 를 코드 추적으로 확인(Stop 소프트 넛지 국한, push 하드블록 무관) — 조치 불요 |
| maintainability | LOW | 실질 코드 품질 결함 없음. markdown 중첩 강조 렌더링 결함 1건 + 문서 가독성 INFO 1건 |
| testing | MEDIUM | `_CHECKBOX` 반대 방향(닫힌 인용 체크박스) 오탐 미테스트가 저장소 실사용 패턴과 실제로 겹침(재상정) + 전제 테스트 부분실패 미검출 + 독립 사본(`plan-stale-audit.sh`) drift |
| documentation | LOW | 주석·독스트링·plan 기록이 실측/코드와 일치. 유일 잔존 결함은 SoT 미등재(유예 상태 재확인) |

## 발견 없는 에이전트

- security — 코드/문서 전 범위에서 CRITICAL/WARNING/INFO 어느 등급도 발견되지 않음(NONE)

## 권장 조치사항

1. (최우선, testing) `_CHECKBOX` 정규식의 반대 방향(인용문 안 **닫힌** 체크박스만으로 허위 "완료" 판정)에 대한 미러 회귀 테스트를 `test_plan_guard.py` 에 추가 — 저장소 자체가 실제로 썼던 문서 구조와 겹치므로 "낮은 확률"로 재유예하지 말 것.
2. (scope) `spec/conventions/error-codes.md:26` 편집이 CLAUDE.md 자기-반증형 소정정 예외를 충족하지 못했으므로, 이 파일을 포함하는 `--impl-done` 을 사후 실행하거나 편집 트랙(planner 연속 턴 vs developer 예외)을 커밋 메시지/plan 에 명시.
3. (testing) `stray-tool-tags.test.ts` 의 "전제" 테스트를 `plan`/`spec` 두 스캔 루트 각각의 개별 하한으로 강화해 부분 스캔 실패를 검출 가능하게 함.
4. (testing) `.claude/tools/plan-stale-audit.sh` 의 독립 체크박스 카운팅 로직과 `plan_guard.py` 의 이번 확장 사이 drift 를 `harness-review-gate-followups.md` 후속 항목에 한 줄 기록.
5. (maintainability) `.claude/docs/plan-lifecycle.md:45` 의 markdown `**` 자기중첩을 수정해 의도한 강조가 렌더링되도록 함.
6. (SPEC-DRIFT, 낮은 우선순위·이미 추적 중) 다음 harness 가드 추가 PR 에서 `spec/conventions/spec-impl-evidence.md §4.2` 에 `stray-tool-tags.test.ts` 행 추가 + "4건"→"5건" 갱신.
7. (scope, 확인용) PR 생성 시 본문에 RESOLUTION W1 이 약속한 "harness축/spec축 리뷰 책임자 분리" 서술이 실제로 포함됐는지 확인.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 forced 이며 결과 전원 확보됨(미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 개별 사유 미제공(prompt 에 skipped 목록만 전달됨). diff 가 harness/plan/spec 문서 중심이라 성능 표면과 낮은 관련도로 추정 |
  | architecture | 상동 |
  | dependency | 상동 |
  | database | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동 |