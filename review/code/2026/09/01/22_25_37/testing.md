# 테스트(Testing) 리뷰 — easy-a-harness-hygiene

## 리뷰 범위 확정

프롬프트에 나열된 68개 파일 중 실제로 테스트 관점 분석 대상이 되는 "코드" 변경은 4건뿐이다:

- `.claude/hooks/_lib/plan_guard.py` — `_CHECKBOX` 정규식 확장 (blockquote 앵커 허용)
- `.claude/tests/test_plan_guard.py` — 위 변경에 대한 신규 테스트 3건
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 멀티라인 ANCHOR fixture + line 전달 회귀 테스트 추가
- `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` — 신규 가드 테스트 파일 (10 tests)

나머지(`plan/**`, `review/**`, `spec/conventions/error-codes.md`, `.claude/docs/plan-lifecycle.md`)는 plan 트래킹 문서·consistency-check 세션 산출물·spec 규약 본문으로, 실행 가능한 코드가 아니라 테스트 관점 발견사항의 대상이 아니다(테스트 존재/커버리지 판단이 적용되지 않음).

## 실측 방법

- `.claude/tests/test_plan_guard.py`: `python3 -m pytest` 로 직접 실행 — 36 passed, 15 subtests passed.
- `codebase/frontend/.../spec-links.test.ts`, `stray-tool-tags.test.ts`: `npx vitest run` 로 직접 실행 — 각각 23 passed / 10 passed.
- `_CHECKBOX` 정규식 신구 버전을 스크래치에서 직접 비교해 신규 테스트 2건(`test_open_checkbox_inside_blockquote_counts`, `test_nested_blockquote_open_checkbox_counts`)이 **구 정규식에서는 실제로 RED** 임을 확인(discriminating mutation 검증 완료) — 대조군(`test_narrative_bracket_mention_is_not_a_checkbox`)은 신구 양쪽에서 매치되지 않음도 함께 확인.
- `stray-tool-tags.test.ts` 의 `skipDir: (name) => name === "archive"` 조건을 스크래치 사본에서 `"__never__"` 로 치환(사실상 archive 스킵을 무력화)해 재실행 — **10/10 그대로 GREEN**. 저장소 실측(`grep`)으로 `plan/complete/archive/`·`spec/` 어디에도 현재 스트레이 태그가 0건임을 확인했고, 그래서 이 스킵 로직 자체는 현재 어떤 fixture 로도 검증되지 않는다(아래 발견사항 1). 뮤테이션 원복은 `cp` 로 즉시 수행, `git status --short` 로 결과물 잔여 없음 확인(저장소 트리는 손대지 않고 mutated 파일은 실제 파일에 썼다가 즉시 원복 — 원본과 diff 0 확인).

## 발견사항

- **[WARNING]** `stray-tool-tags.test.ts` 의 `skipDir("archive")` 분기가 어떤 fixture 로도 검증되지 않는다 — 이 파일이 스스로 경계하는 "vacuous coverage" 패턴 재발
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` (`findStrayTags` 함수의 `skipDir: (name) => name === "archive"`, 62~66번째 줄 부근)
  - 상세: 이 파일의 헤더 주석(§"왜 코드펜스를 예외로 두지 않나" 아래 실행 근거·`plan-scan.ts` 인용 부분)과 90~99번째 줄 부근 주석이 명시적으로 "위반 0건은 검사가 도는 증거가 아니다" 라고 경고하고, 실제로 `it.each` 로 탐지 정규식(`STRAY_TAG_LINE`)의 true/false-positive 양방향을 fixture 로 고정해 그 교훈을 실천하고 있다. 그런데 정확히 같은 위험이 있는 다른 분기 — `skipDir("archive")` — 는 그 원칙에서 빠졌다. 현재 저장소에 `plan/complete/archive/`·`spec/` 어디에도 스트레이 태그가 없어(실측), 이 스킵 로직을 완전히 무력화해도 "잔재 태그가 없다" 테스트는 **여전히 GREEN** 이다(직접 뮤테이션으로 확인) — 즉 이 스킵이 실제로 동작하는지, 아니면 조건식에 오타가 나 있어도(`"archive"` → `"archives"` 등) 아무 테스트도 못 잡는다.
  - 제안: `findStrayTags` (또는 `walkTree` 직접 호출)를 사용해 `mkdtempSync` 로 만든 합성 임시 디렉터리에 `plan/complete/archive/x.md` 안에 `</content>` 한 줄을 심고, 그 파일이 결과에서 **제외**됨을 단언하는 fixture 테스트를 추가한다. 이는 이미 이 파일이 쓰고 있는 패턴(`it.each` 의 정규식 fixture)과 동일한 형태로 자연스럽게 확장 가능하다.

- **[INFO]** `plan_guard.py` — blockquote 안의 **완료(`[x]`)** 체크박스가 `done_count` 에 반영되는지의 대칭 케이스가 명시적으로 테스트되지 않음
  - 위치: `.claude/tests/test_plan_guard.py` `FilesystemHelpersTest` 클래스 (`test_open_checkbox_inside_blockquote_counts`/`test_nested_blockquote_open_checkbox_counts`/`test_narrative_bracket_mention_is_not_a_checkbox` 세 신규 테스트 주변)
  - 상세: 이번 정규식 확장(`_CHECKBOX = re.compile(r"^[\s>]*[-*]\s+\[(?P<mark>[ xX])\]")`)은 열림(`[ ]`)·닫힘(`[x]`/`[X]`) 양쪽 마크를 대칭으로 처리한다. 신규 테스트 3건은 모두 "열린 체크박스가 blockquote 안에 있을 때 열림으로 잡히는가"(2건)와 "narrative 인용은 안 잡히는가"(1건)만 다루고, "blockquote 안의 **닫힌** 체크박스가 `done_count` 에 정확히 반영되는가"는 다루지 않는다. 정규식 대칭성상 실패 가능성은 낮지만, `_all_checkboxes_done` 은 `done_count > 0 and open_count == 0` 조합 로직이라 — 예를 들어 최상위엔 체크박스가 전혀 없고 blockquote 안에만 `[x]` 가 있는 문서(예: "> - [x] 인용 안의 완료 항목" 하나뿐인 본문)가 `done_count` 를 blockquote 경로로만 채우는 케이스는 이 정규식 변경 이전에는 아예 카운트되지 않다가 이번 변경으로 새로 카운트되기 시작한 회귀 표면인데, 어떤 테스트도 이 조합을 명시적으로 고정하지 않는다.
  - 제안: `body="> - [x] 인용문 안의 완료 항목\n"` (최상위 체크박스 없이 blockquote 완료 항목만 있는 케이스)에 대해 `assertTrue`(또는 저장소 실사용 패턴에 맞춰 의도된 값)를 고정하는 테스트 1건 추가.

## 잘된 점 (참고)

- `.claude/tests/test_plan_guard.py` 신규 테스트 3건은 이 프로젝트가 반복 강조하는 "뮤테이션 검증" 원칙을 정확히 실천한다 — 구 정규식으로 실제 RED 가 나는 것을 직접 확인했고(본 리뷰에서 재검증 완료), narrative 대조군으로 "넓히는 변경이 반대 방향 오탐을 만들지 않는가"까지 같은 커밋에서 함께 고정했다. Mock 없이 실제 정규식·실제 임시 파일로 구동해 실제 동작과의 괴리가 없다.
- `stray-tool-tags.test.ts` 는 "premise" 테스트(`files.length > 100`)로 스캔 자체가 무의미한 빈 실행이 아님을 먼저 보장한 뒤 본 단언을 검증하는 구조이고, 탐지 정규식의 true-positive/false-positive 를 `it.each` 로 각각 4건씩 명시적으로 고정한다. `review/**` 를 의도적으로 제외한 이유, 코드펜스를 예외로 두지 않은 이유가 모두 주석에 근거와 함께 남아 있어 가독성이 높다.
- `spec-links.test.ts` 의 멀티라인 ANCHOR 추가 케이스는 "전제(premise)" 단언(`[...byTarget.keys()].sort()` 로 세 위반이 모두 잡혔는지 먼저 확인)을 앞세운 뒤 line 번호를 개별 검증하는 구조라 vacuous 위험이 낮다. 본 리뷰에서 fixture 라인 번호(4/5/7)를 직접 재계산해 실제 소스 라인과 일치함을 확인했다.
- 세 파일 모두 mock/stub 없이 실제 파일시스템(`tempfile.TemporaryDirectory`/`mkdtempSync`)과 실제 정규식/실제 스캐너 함수로 구동돼, 실동작과의 괴리 위험이 낮다. 테스트 간 격리도 각자 독립 temp 디렉터리를 사용해 문제없다(단, `stray-tool-tags.test.ts`/`spec-link-integrity.test.ts` 류의 "라이브 저장소 스캔" 테스트는 그 성격상 저장소 상태에 의존하는 설계이며, 이는 이 코드베이스에 이미 확립된 패턴이다).

## 요약

핵심 변경(정규식 확장 2건 — Python `plan_guard._CHECKBOX`, TS `spec-links` 멀티라인 line 전달)은 실제로 실행·재현했고, 신규 테스트가 실질적인 discriminating mutation 을 통과함을 직접 검증했다. 새 가드 파일(`stray-tool-tags.test.ts`)도 vacuous-test 방지 패턴(premise 테스트 + 양방향 fixture)을 잘 따른다. 다만 그 파일 자신이 강조하는 "위반 0건이 검사가 도는 증거는 아니다" 원칙이 `skipDir("archive")` 분기 자체에는 적용되지 않아, 그 분기는 현재 어떤 테스트로도 검증되지 않는 사각지대다(직접 뮤테이션으로 확인). `plan_guard.py` 는 blockquote-only 완료 케이스라는 대칭 엣지케이스 하나가 비어 있다. 둘 다 CRITICAL 은 아니며 실제 동작을 당장 위협하지도 않지만, 전자는 이 저장소가 반복적으로 겪어온 "158 tests GREEN 인데 위반 수집 분기가 한 번도 실행되지 않았다" 류 결함과 정확히 같은 모양이라 WARNING 으로 표시한다.

## 위험도

LOW
