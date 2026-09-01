# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능적 결함(CRITICAL)은 없으나, harness 위생 수정 4건과 성격이 다른 spec 내용 결정
(`error-codes.md` 두 surface 병기 + 6라운드 `--spec` consistency-check 라이프사이클 전체)이
같은 커밋에 번들돼 project-planner/developer 역할 경계를 넘고(scope, MEDIUM), 완료 처리된 plan
문서의 self-claim 이 실제 diff 와 어긋나며(requirement), 신규 가드 테스트의 한 분기가 검증되지
않은 채(testing) SoT 문서에도 미등재(documentation)된 상태다. **forced(router_safety) 7개
reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing)
전원 결과 확보됨** — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | harness hygiene 브랜드의 커밋에 성격이 다른 **spec 내용 결정**(`EngineErrorCode`/`ErrorCode` 두 surface 병기) 전체 라이프사이클이 번들됨 — CLAUDE.md 의 `spec/`(project-planner) vs `codebase/`·harness(developer) 역할 경계를 한 커밋에서 동시에 넘고, diff 68파일 중 54파일(≈80%)이 이 항목의 부산물이라 harness 수정 본체(14파일)의 독립 검토·revert 를 어렵게 만듦 | 커밋 `b5d2e6972`; `spec/conventions/error-codes.md`, `plan/complete/spec-draft-error-code-two-surfaces.md`, `plan/in-progress/spec-conventions-engine-error-code-surface.md`, `review/consistency/2026/09/01/{21_30_10,21_36_28,21_39_47,21_46_05,21_49_21,21_56_30}/**` | `error-codes.md` 두 surface 병기 항목(+그 plan·consistency 아티팩트)을 별도 커밋 또는 별도 PR 로 분리. 부득이 합치면 PR 설명에 두 축의 리뷰 책임자가 다름을 명시 |
| 2 | requirement | 완료 처리된 spec draft plan 이 "§Overview 도입부 '대표 surface'(단수) 표현도 병기에 맞춰 복수로 조정한다"고 **했다**고 기록했으나, 실제 `error-codes.md` diff 는 그 원문(단수 표현)을 건드리지 않고 뒤에 새 문단만 추가함 — 6라운드 consistency-check 도 이 self-claim vs 실제 diff 불일치를 재검증하지 못함 | `plan/complete/spec-draft-error-code-two-surfaces.md:106-107` vs `spec/conventions/error-codes.md:26` | (a) `error-codes.md:26` 의 "대표 surface"(단수) 문구를 실제로 조정하거나, (b) plan 문서의 "복수로 조정한다" 서술을 "새 문단만 추가, 원 문장은 그대로(문제 없음)"로 정정 |
| 3 | requirement | 이 changeset 이 실제로 구현·해소한 결정 항목(`_CHECKBOX` 정규식이 `>` 접두를 넘도록 넓힐지 판정)의 원 트래커 체크박스가 여전히 미체크 상태로 남음 — 프로젝트 관례(plan 체크박스=실제 상태) 위반, 다른 6개 plan 파일은 유사 정리를 정확히 수행했는데 이 항목만 누락 | `plan/in-progress/harness-review-gate-followups.md:904` | `[x]` 로 체크하고 "구현 완료(2026-09-01, `plan_guard.py:87` + 회귀 테스트) — (a) 채택" 주석 추가 |
| 4 | testing | 신규 가드 `stray-tool-tags.test.ts` 의 `skipDir("archive")` 분기가 어떤 fixture 로도 검증되지 않음 — 이 파일 스스로가 경계하는 "위반 0건은 검사가 도는 증거가 아니다" 원칙의 재발. 직접 뮤테이션(스킵 조건을 `"__never__"` 로 치환)으로 확인해도 10/10 그대로 GREEN, 즉 이 분기가 오타로 무력화돼도 어떤 테스트도 못 잡음 | `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` (`findStrayTags` 의 `skipDir` 조건, 62~66행 부근) | `mkdtempSync` 임시 디렉터리에 `plan/complete/archive/x.md` + `</content>` 를 심고 결과에서 **제외**됨을 단언하는 fixture 테스트 추가(기존 `it.each` 패턴과 동일 형태로 확장 가능) |
| 5 | documentation | 신규 build-blocking 가드(`stray-tool-tags.test.ts`)가 그 가드 family 의 SoT 문서(`spec/conventions/spec-impl-evidence.md §4.2`, "build 차단 4건" 표 + frontmatter `code:` 리스트)에 등재되지 않음 — 이 changeset 의 어떤 파일도 그 표/frontmatter 를 갱신하지 않아 "규약 SoT" 문서가 새 가드의 존재를 모르는 상태로 남음 | `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규 파일); `spec/conventions/spec-impl-evidence.md:4-18`(frontmatter `code:`), `:126-128`(§4.2 표) | §4.2 표에 `stray-tool-tags.test.ts` 행 추가, "build 차단 4건"→"5건" 갱신, frontmatter `code:` 리스트에 파일 경로 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `_CHECKBOX` 정규식(blockquote 접두 허용) 확장은 모듈 전역 상수라 모든 in-progress plan 에 소급 적용되나, 사용처가 `_all_checkboxes_done()` 한 곳뿐이고 push 하드블록에는 영향 없이 Stop-gate 소프트 넛지로만 blast radius 가 제한됨. 향후 이 정규식을 blockquote 예시로 문서화하면 서술적 예시가 오탐될 여지는 구조적으로 남아 있음 | `.claude/hooks/_lib/plan_guard.py:87`(정의), `:259`(사용처) | 조치 불요(설계상 수용된 트레이드오프, blast radius 낮음). 향후 문서화 시 오탐 가능성만 유의 |
| 2 | testing | blockquote 안의 **닫힌**(`[x]`) 체크박스가 `done_count` 에 반영되는 대칭 케이스가 신규 테스트 3건 중 어디에도 명시적으로 고정되지 않음(정규식 대칭성상 실패 가능성은 낮음) | `.claude/tests/test_plan_guard.py`(`FilesystemHelpersTest`) | `body="> - [x] 인용문 안의 완료 항목\n"` 케이스에 대해 의도된 값을 고정하는 테스트 1건 추가 |
| 3 | requirement | blockquote 확장이 fenced code block 내부의 인용 예시까지 열린 체크박스로 오검출할 수 있음 — 다만 이는 이번 diff 가 새로 만든 결함이 아니라(구 정규식도 코드펜스를 구분하지 않았음) 안전한 방향(거짓 음성→거짓 양성)의 트레이드오프 | `.claude/hooks/_lib/plan_guard.py:87`, `_all_checkboxes_done`(`:237-268`) | 조치 불요, 기록만 |
| 4 | maintainability | 신규 sanity-check 임계값 `100`(`files.length > 100`)이 이름 없는 매직 넘버 — 저장소 문서 수가 자연 감소하면 설명 없이 가드가 깨질 수 있음 | `stray-tool-tags.test.ts`(전제 테스트 블록) | `MIN_EXPECTED_MD_FILE_COUNT` 등으로 상수화 + 현재 실측치·여유분 근거 한 줄 추가 |
| 5 | maintainability | `TOOL_TAGS` 배열 순서가 알파벳도 빈도도 아닌 임의 순서(기능엔 영향 없음) | `stray-tool-tags.test.ts:37-43` | 정렬 기준(알파벳/빈도) 하나를 정해 짧은 주석으로 남기면 향후 태그 추가 위치 판단이 쉬워짐(낮은 우선순위) |
| 6 | side_effect | `stray-tool-tags.test.ts` 는 `plan/**`·`spec/**` 만 스캔하고 `review/**` 는 문서화된 의도적 설계로 범위 밖 — 이 changeset 이 정리하지 않은 `review/**` 잔존 태그는 이 가드로 감지되지 않음 | `stray-tool-tags.test.ts`(`findStrayTags`, `walkTree(root, ["plan","spec"], …)`) | 조치 불요(의도된 스코핑, 문서 주석에 근거 명시됨) |
| 7 | scope | harness 관련 4항목(스트레이 태그 가드/blockquote 정규식/링크 line 전파/plan 이동 절차)만 놓고 보면 diff 가 각 문제 서술과 1:1 대응, 무관한 리팩토링·포맷팅 잡음 없음 | `plan_guard.py`, `test_plan_guard.py`, `plan-lifecycle.md`, `spec-links.test.ts`, `stray-tool-tags.test.ts`, plan 태그 정리 5파일 | 조치 불요(확인용) |
| 8 | side_effect | 도구 아티팩트 태그(`</content>`,`</invoke>`) 제거 5파일 6건은 저장소 전체에 이 문자열을 파싱하는 코드 의존성이 없음을 확인 | `plan/complete/{agent-memory-model-config,agent-memory-model-select,fix-model-select-label,webchat-session-apibase-binding}.md`, `plan/in-progress/webchat-usewidget-extraction.md` | 조치 불요(확인용) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 코드 5개 중 유일한 코드 변경(정규식 확장)은 저장소 로컬 문서 전용 선형 패턴. 인젝션·ReDoS·하드코딩 시크릿 없음 |
| requirement | LOW | 완료 plan 의 self-claim 이 실제 diff 미반영(WARNING #2), 해소한 결정 항목의 원 트래커 체크박스 미갱신(WARNING #3). 핵심 코드/spec diff 는 전부 실측 근거로 뒷받침, 관련 테스트 전량 GREEN |
| scope | MEDIUM | harness hygiene 커밋에 무관한 spec 내용 결정(error-codes.md 두 surface 병기) 전체 라이프사이클(54개 산출물 파일)이 번들됨 — 역할 경계 침범 + 독립 검토 저해(WARNING #1) |
| side_effect | LOW | `_CHECKBOX` 전역 상수 소급 적용이나 사용처 1곳·push 하드블록 무영향으로 blast radius 좁음. 시그니처/공개 인터페이스/전역 상태 변경 없음 |
| maintainability | NONE | 매직 넘버·배열 순서·주석 비중 비대칭 등 사소한 INFO 3건만. 함수 짧고 얕은 중첩, 공유 헬퍼 재사용 |
| testing | LOW | `skipDir("archive")` 분기 vacuous coverage — 직접 뮤테이션으로 실증(WARNING #4). 핵심 정규식 변경 2건은 discriminating mutation 검증 통과 |
| documentation | LOW | 신규 build-blocking 가드가 SoT 문서(`spec-impl-evidence.md §4.2`)에 미등재(WARNING #5). 나머지 문서 변경은 근거 대조 전부 일치 |
| user_guide_sync | NONE | 매트릭스 20행 중 매칭 1행(spec-major-change)도 frontmatter 정합 실측 확인, 갭 없음. 해당 없음 |

## 발견 없는 에이전트

security, maintainability, user_guide_sync — Critical/Warning 없음(INFO 또는 NONE 만).

## 권장 조치사항

1. `error-codes.md` 두 surface 병기 항목(+plan·consistency 아티팩트)을 harness hygiene 수정과 분리해 별도 커밋/PR 로 재구성한다 (scope WARNING #1).
2. `plan/complete/spec-draft-error-code-two-surfaces.md` 의 self-claim 과 실제 `error-codes.md:26` diff 를 일치시킨다 — 문구를 실제로 조정하거나 plan 서술을 정정한다 (requirement WARNING #2).
3. `harness-review-gate-followups.md:904` 체크박스를 `[x]` 로 갱신한다 (requirement WARNING #3).
4. `stray-tool-tags.test.ts` 에 `skipDir("archive")` 를 실제로 검증하는 fixture 테스트를 추가한다 (testing WARNING #4).
5. `spec/conventions/spec-impl-evidence.md §4.2` 표 + frontmatter `code:` 리스트에 `stray-tool-tags.test.ts` 를 등재한다 (documentation WARNING #5).
6. (선택, 낮은 우선순위) INFO 항목 중 매직 넘버 상수화(#4)·blockquote 닫힌 체크박스 대칭 테스트(#2) 는 여유 있을 때 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **forced 전원 결과 확보됨(누락 없음)**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(개별 사유 미제공) |
  | architecture | router 판단(개별 사유 미제공) |
  | dependency | router 판단(개별 사유 미제공) |
  | database | router 판단(개별 사유 미제공) |
  | concurrency | router 판단(개별 사유 미제공) |
  | api_contract | router 판단(개별 사유 미제공) |