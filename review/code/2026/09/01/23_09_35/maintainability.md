# 유지보수성(Maintainability) 코드 리뷰

## 범위에 대한 메모

이번 changeset(68개 파일)의 대부분은 `review/consistency/2026/09/01/**` · `review/code/2026/09/01/22_25_37,22_44_29/**` 아래의 **세션 산출물**(SUMMARY/RESOLUTION/`_retry_state.json`/`meta.json`/각 checker 리포트, `_target/*.md` 스냅샷)과 `plan/**` 트래킹 문서 갱신, `spec/conventions/error-codes.md` 문단 1개다. 이들은 사람이 계속 손으로 다듬는 소스가 아니라 harness 가 그 세션에 써 넣은 기록이라 함수 길이·중첩·매직 넘버 같은 코드 품질 기준을 적용할 대상이 아니다. 실제 "코드" 변경은 4개 파일뿐이다 — `.claude/hooks/_lib/plan_guard.py`, `.claude/tests/test_plan_guard.py`, `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`, `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규). 아래 발견사항은 이 4개 + `plan-lifecycle.md` 문서 편집에 집중했다. (참고: 프롬프트에서 diff 가 생략된 `stray-tool-tags.test.ts` 는 `Read` 로 저장소의 현재 전체 내용을 직접 열어 확인했다 — 아래 위치의 줄 번호는 그 실제 파일 줄 번호다.)

## 발견사항

- **[INFO]** `ScanRoot` 타입이 선언보다 먼저 사용된다 — top-to-bottom 가독성 순서 위반
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts:65` (`const MIN_EXPECTED_MD_FILES: Record<ScanRoot, number> = {`) vs `:93-94` (`const SCAN_ROOTS = [...] as const;` / `type ScanRoot = (typeof SCAN_ROOTS)[number];`)
  - 상세: `MIN_EXPECTED_MD_FILES` 의 타입 어노테이션이 `ScanRoot` 를 참조하는데, 그 타입 별칭은 파일을 30줄 가까이 내려간 뒤에야 정의된다. TypeScript 는 타입 레벨 전방 참조를 허용하므로 컴파일에는 문제가 없지만, 파일을 위에서 아래로 읽는 사람은 `MIN_EXPECTED_MD_FILES` 를 만나는 시점에 `ScanRoot` 가 무엇인지 알 수 없어 아래로 스크롤해 정의를 찾아야 한다. `SCAN_ROOTS`/`ScanRoot` 는 원래 `collectScanTargets` 바로 위에 "스캔 대상 수집 — **한 곳**에만 둔다" 라는 의도적 배치 주석과 함께 있어, 그 배치 의도(스캔 로직 근처에 두기)와 `MIN_EXPECTED_MD_FILES` 의 타입 의존 순서가 서로 어긋난다.
  - 제안: `SCAN_ROOTS`/`type ScanRoot` 선언을 파일 상단(`TOOL_TAGS` 다음, `MIN_EXPECTED_MD_FILES` 이전)으로 옮기거나, `MIN_EXPECTED_MD_FILES` 를 `collectScanTargets` 근처로 옮겨 선언 순서와 사용 순서를 맞춘다. 차단 사유는 아님.

- **[INFO]** 회귀 테스트 두 건의 본문이 거의 동일 — 의도된 캐너리이지만 유사 중복
  - 위치: `.claude/tests/test_plan_guard.py:265-278` (`test_open_checkbox_inside_blockquote_counts`) vs `:328-338` (`test_quoted_open_still_vetoes_alongside_own_done`)
  - 상세: 두 테스트 모두 `body="## tasks\n- [x] <라벨>\n> - [ ] <라벨>\n"` 형태의 fixture 를 만들고 `assertFalse(pg._all_checkboxes_done(...))` 로 끝난다 — 실질적으로 라벨 문자열만 다르고 구조·단언이 동일하다. docstring 을 보면 의도가 다르다는 것은 확인된다(전자는 결함 발견 당시 회귀 고정, 후자는 "비대칭 카운팅이 열린 쪽 거부권을 약화시키지 않았다" 는 캐너리) — 즉 지어낸 중복이 아니라 각각 다른 리뷰 라운드에서 다른 목적으로 추가된 것이다. 다만 결과적으로 같은 입력 형태를 두 번 검증하고 있어, 다음에 이 로직을 또 건드릴 때 "이 두 테스트가 왜 따로 있는가" 를 다시 docstring 을 읽어야만 알 수 있다.
  - 제안: 차단 사유 아님. 병합하면 캐너리로서의 독립적 의도가 흐려지므로 유지가 더 나을 수도 있다 — 다만 향후 세 번째 유사 테스트가 추가된다면 그때는 파라미터화(`it.each`)를 고려할 것.

## 확인했으나 문제 없음 (근거 기록)

- `plan_guard.py` 의 `_CHECKBOX`/`_QUOTED` 비대칭 카운팅 로직(`:75-98`, `:270-278`)은 분기 2단만 추가됐고 중첩·순환 복잡도 증가가 미미하다. 정규식 앞 주석이 12줄로 길지만(이전 리뷰 라운드에서 이미 INFO 로 지적·"조치 불요"로 확인된 사안) 코드 자체의 가독성을 해치지 않으며, 저장소의 "왜" 주석 관례(`tree-walk.ts` 등)와 일치한다.
- `test_plan_guard.py` 신규 테스트 5건은 기존 `FilesystemHelpersTest` 클래스의 스타일(`_make_plan` 헬퍼 재사용, `tempfile.TemporaryDirectory`, 단문 docstring)을 그대로 따른다 — 새 패턴을 도입하지 않았다.
- `spec-links.test.ts` 보강분(멀티라인 ANCHOR fixture + 통합 line 전달 테스트, `:49-56`, `:91-110`)은 라인 번호 단언(`4`/`5`/`7`)이 바로 위 fixture 내용과 1:1 대응해 self-documenting 하다 — 의미 불명 매직 넘버가 아니다.
- `stray-tool-tags.test.ts` 는 `walkTree`/`repoRoot` 등 기존 공유 헬퍼를 재사용하고(`collectScanTargets` 로 스캔 호출을 한 곳에 모음, 헤더 주석에 그 이유 명시), 함수는 모두 30줄 이하이며 중첩은 최대 2단(`for` 안 `forEach`)이다. `MIN_EXPECTED_MD_FILES`(250/190) 는 근거 주석(실측 505/386, "실측의 절반")이 딸려 있어 이유 없는 매직 넘버가 아니다.
- `plan-lifecycle.md`(`:45-46`) 에 추가된 마크다운은 이전 리뷰 라운드(`22_44_29` W6)가 지적한 `**...**` 자기중첩 문제가 이미 `*자신의*`(이탤릭)로 정정된 상태로 반영돼 있음을 직접 확인했다 — 재지적 대상 아님.

## 요약

실질 코드 변경은 4개 파일로 매우 좁고, 두 차례 앞선 리뷰 라운드(`22_25_37`, `22_44_29`)가 이미 실질 결함(전제 테스트 vacuous, 비대칭 카운팅 누락 등)을 뮤테이션으로 검증하며 정리해 이번 시점의 코드는 함수 길이·중첩·중복·매직 넘버 어느 축에서도 심각한 문제가 없다. 남은 두 항목은 모두 INFO 수준의 사소한 가독성 지점(타입 전방 참조 순서, 의도된 캐너리 테스트의 유사 중복)이며 차단 사유가 아니다.

## 위험도

NONE
