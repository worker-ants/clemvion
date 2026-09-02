# 유지보수성(Maintainability) 코드 리뷰

## 범위에 대한 메모

이번 changeset 68개 파일 중 60개(파일 14~67)는 `review/consistency/2026/09/01/**` 아래의
**자동 생성 consistency-checker 세션 산출물**(`SUMMARY.md`/`_retry_state.json`/`meta.json`/
`_target/*.md`/각 checker 리포트)이고, 7개(파일 6~13)는 `plan/**` 트래킹 문서 갱신,
1개(파일 68)는 `spec/conventions/error-codes.md` 본문 갱신이다. 이들은 사람이 계속 손으로
유지보수하는 소스 코드가 아니라 **한 세션의 기록**(1개 파일 6~13)이거나 **harness 가 그 세션에
써 넣은 로그**(14~67)라, 함수 길이·중첩·매직 넘버 같은 코드 품질 기준을 적용할 대상이 아니다.
실제 "코드"에 해당하는 변경은 4개 파일(2·3·4·5)뿐이며, 아래 발견사항은 그 4개에 집중했다.
나머지 markdown/JSON 파일은 훑어봤으나 구조적 결함(예: 헤더 배치 불일치)은 이미 그 세션 안의
checker 들이 스스로 찾아 다음 라운드에서 고친 이력이 보여(예: `21_39_47`→`21_46_05` 라운드에서
"Rationale 뒤 섹션" WARNING → `spec/conventions/error-codes.md` 최종 반영본은 그 구조를 갖지
않음), 별도로 재지적할 실익이 없다.

## 발견사항

- **[INFO]** 새 sanity-check 임계값 `100` 이 이름 없는 리터럴로 박혀 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` — `it("[전제] 스캔이 실제로 파일을 봤다…")` 블록의 `expect(files.length).toBeGreaterThan(100);`
  - 상세: 이 값은 "스캔이 실제로 파일을 훑었다" 는 전제를 검증하는 하한선이다. 의도(주석의 "158 tests GREEN 인데 위반 수집 분기가 한 번도 실행되지 않았던 이력")는 명확하지만, `100` 자체가 왜 이 숫자인지(현재 `plan/`+`spec/` md 파일 수의 대략적 하한이라는 것)는 주석에 없다. 저장소 문서 수가 자연 증가/정리로 100 언저리까지 줄어들면 이 가드가 아무 설명 없이 깨진다.
  - 제안: `MIN_EXPECTED_MD_FILE_COUNT` 같은 이름의 상수로 빼고 "현재 실측치는 N, 여유를 두고 100 으로 잡음" 정도의 한 줄 근거를 붙이면 향후 이 값이 실패할 때 원인 파악이 빨라진다. 차단 사유는 아님.

- **[INFO]** `TOOL_TAGS` 배열 순서가 알파벳도, 발견 빈도도 아닌 임의 순서
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts:37-43` (`const TOOL_TAGS = [...]`)
  - 상세: `["content", "invoke", "parameter", "function_calls", "antml"]` 순서에 특별한 의미가 없어 보인다(실측 근거 주석은 "6건" 발견 개수만 언급). 기능에는 영향 없음(정규식 alternation 순서 무관) — 다음에 태그를 추가/삭제할 때 순서 규칙이 없어 어디에 끼워 넣을지 판단 기준이 없다는 정도의 사소한 지점.
  - 제안: 알파벳 순 또는 "발견 빈도 내림차순" 등 한 가지 기준으로 정렬하고 그 기준을 짧은 주석으로 남기면 다음 추가 시 위치 선정 고민이 준다. 매우 낮은 우선순위.

- **[INFO]** `plan_guard.py` 의 정규식 한 줄 확장에 12줄 근거 주석 — 저장소 관례와는 부합하나 이 파일 자체의 다른 정규식과는 비대칭
  - 위치: `.claude/hooks/_lib/plan_guard.py:76-87` (`_CHECKBOX` 재정의 앞 주석 블록)
  - 상세: 같은 파일의 다른 정규식(`_BRANCH_ANNOT`, `_PLACEHOLDER_WORKTREE` 등)은 한 줄 주석이거나 무주석인데 `_CHECKBOX` 만 실측 근거·반례 검증까지 담은 12줄 주석을 갖는다. 저장소 전반(`tree-walk.ts` 등)에 이런 "왜" 주석 관례가 있어 스타일 자체는 문제없지만, 같은 파일 안에서 비중이 크게 갈리면 다음 사람이 "이 정규식만 유독 위험한가?" 라고 오해할 여지가 아주 약간 있다. 실질적 유지보수 비용은 없음 — 정보 자체는 정확하고 유용하다.
  - 제안: 조치 불필요. 참고 사항으로만 기록.

## 요약

실질적인 코드 변경은 `plan_guard.py` 의 정규식 확장(체크박스 앵커가 blockquote `>` 를 넘도록)과 그에 대응하는 `test_plan_guard.py` 신규 테스트 3건, 그리고 `codebase/frontend/src/lib/docs/__tests__/` 아래 `spec-links.test.ts` 보강 + `stray-tool-tags.test.ts` 신규 파일 하나로 매우 좁다. 모두 함수가 짧고(최대 30줄 내외) 중첩이 얕으며(2단 이하), 기존 공유 헬퍼(`tree-walk.ts`의 `walkTree`, `_shared/git_probe.py`)를 재사용해 중복을 만들지 않았고, 왜 이 형태인지를 설명하는 근거 주석(실측 수치·반례 테스트 포함)이 이 저장소의 기존 관례와 일치한다. 위에 남긴 세 항목은 전부 INFO 수준의 사소한 지점(매직 넘버 상수화, 배열 순서 근거, 주석 비중 비대칭)이며 어느 것도 가독성·복잡도·중복 면에서 실질적 유지보수 부담을 만들지 않는다. 나머지 60여 개 파일은 사람이 유지보수하는 소스가 아니라 세션 산출물/plan 문서라 이 관점의 채점 대상에서 사실상 제외했다.

## 위험도

NONE
