# 문서화(Documentation) 리뷰 — guide-identifier-existence (4차 라운드, `15_24_12` 이후)

## 검증 방법

`git diff --stat origin/main...HEAD`(base `ce454e046`)로 실제 소스 델타(`CHANGELOG.md` ·
`PROJECT.md` · `guide-error-code-{existence.test,scan}.ts`(삭제) ·
`guide-identifier-{existence.test,scan}.ts`(신규) ·
`guide-sanitized-message-parity.test.ts`(주석 1줄) · `plan/in-progress/*.md` 2개, 나머지는
`review/code/**`·`review/consistency/**` 산출물)를 확인하고, 라운드 3(`15_24_12`) 이후 실제로
추가된 유일한 코드 커밋(`b75fe0ace`, "주석에만 있던 설계 결정을 뮤턴트로 고정한다")을
`git show`로 단독 확인했다. 세 파일(`guide-identifier-scan.ts`·
`guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts`)과
`CHANGELOG.md`·`PROJECT.md`·`plan/in-progress/guide-identifier-existence.md`·
`plan/in-progress/spec-draft-nullable-notation-followups.md`를 `Read`로 직접 열어 이전
세 라운드(`14_41_14`·`15_03_06`·`15_24_12`)의 documentation 지적사항이 실제로 해소된
상태로 유지되고 있는지 재대조했다. 저장소는 뮤테이션하지 않았다.

## 이전 라운드 지적사항 — 재확인 결과 전부 해소 유지

- **[해소 확인]** `guide-sanitized-message-parity.test.ts:16-17`의 자매 파일 참조가
  `guide-identifier-existence.test.ts`(`#1330` 당시 이름 병기)로 유지되고 있다. 저장소 전수
  `grep -rn "guide-error-code" codebase/ spec/ CHANGELOG.md PROJECT.md` 결과 남은 참조는
  `guide-identifier-scan.ts:9`(의도적 역사 서술)·`CHANGELOG.md:77`(의도적 역사 서술)·
  `plan/in-progress/*.md` 내 계보 설명뿐이고, 댕글링(존재하지 않는 파일을 가리키는) 참조는
  0건이다.
- **[해소 확인]** `guide-identifier-scan.ts:53-76`의 "존재 검사 ≠ 방출 검사" 한계 절과
  "이 주석을 지우지 말 것" 지시가 env 축까지 일반화된 채로 남아 있고, 자신이 삭제됐다가
  복원된 경위(72-76행)까지 자기참조로 기록돼 있다.
- **[해소 확인]** `guide-identifier-existence.test.ts:55-58`의 `composeTexts` 필터가
  `/^docker-compose.*\.ya?ml$/`로 좁혀진 채 유지되고, 종전 판이 루트의 모든 `.yml`/`.yaml`
  (`pnpm-lock.yaml` 784KB 포함)을 읽었다는 실측 경위가 인접 주석에 남아 있다.
- **[해소 확인]** `CHANGELOG.md:69-81`·`PROJECT.md:300`이 파일명(`guide-identifier-existence`)·
  허용목록(`GUIDE_EXTERNAL_VOCABULARY`)·"두 PR 에 걸쳐 두 번 바뀌었다"는 번복 경위·"넷을
  강제한다"(실제 테스트 4개: 시스템명 의무·상한·인용 여부·기준집합 배제, 코드와 대조 확인)까지
  실제 구현과 일치한다.
- **[해소 확인]** 라운드 3 WARNING#1(`UPPER_SNAKE`가 "밑줄 최소 1개"를 요구한다고 주석에만
  적혀 있고 그 결정을 겨누는 테스트가 없던 문제)이 `guide-identifier-existence.test.ts:299-309`
  (`it("[비대상] 밑줄 없는 대문자 약어는 안 집는다", …)`)에 판별 fixture(`` `LLM` ``·
  `` `HTTP` `` 는 배제, `` `LLM_TIMEOUT` `` 은 포함)와 함께 추가돼 있다. 주석이 리뷰 라운드
  출처(`review/code/2026/09/13/15_24_12` testing WARNING#1)를 전체 경로로 정확히 인용한다 —
  라운드 2 CRITICAL(bare `hh_mm_ss` 인용)이 지적한 형태로 재발하지 않았다.
- **[해소 확인]** 라운드 3 WARNING#2(`guide-identifier-scan.ts.bak` 방치 지적)는
  `RESOLUTION.md`가 "실측: 워크트리 전체 `.bak` 0건"으로 처분했고, 이번 세션에서도
  `find . -name "*.bak*"` 결과 0건이다.
- **[해소 확인]** `plan/in-progress/guide-identifier-existence.md` §체크리스트 마지막 두 항목
  (`run-test-all.sh`·`/ai-review` + `--impl-done`)이 라운드 3 INFO#6 지적대로 `[x]`로 갱신되고
  라운드별 표(R1~R3)까지 채워져 있다.

이번 라운드에서 diff 자체(`b75fe0ace`의 실 코드 변경분, `guide-identifier-existence.test.ts`
299-309행)에 새로운 CRITICAL/WARNING 급 문서화 결함은 발견되지 않았다.

## 발견사항

- **[INFO]** 리뷰 도중 병렬 세션으로 추정되는 일시적 뮤테이션을 관측 — 이미 자체 원복됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (`CODE_FIELD` 정의,
    102행 부근)
  - 상세: 초기 `Read`로 파일을 열었을 때는 `` const CODE_FIELD = new RegExp(`"?code"?\s*:\s*"(${UPPER_SNAKE})"`, "g"); ``
    (커밋 상태와 일치)였다. 이후 `git status --short`를 실행하니 이 파일이
    `M`(modified)으로 표시됐고, `git diff`로 대조하니 `` (?<![A-Za-z])"?code"? `` 형태로
    negative lookbehind 가 추가돼 있었다 — 아마도 다른 reviewer 세션이 이 축의 오탐 가능성을
    검증하던 순간으로 보인다. 곧이어 다시 `git status --short`를 실행하니 원복되어 있었다
    (현재 clean). 나는 이 파일에 어떠한 쓰기도 하지 않았다 — 프롬프트가 경고한 "다른
    reviewer 들이 같은 워킹트리를 동시에 읽고 있다"는 상황의 실제 발현이며, 라운드 3
    RESOLUTION.md WARNING#2("`.bak` 관측"), 이전 라운드 dependency.md INFO("`envLine` 정규식
    실험 관측")와 같은 클래스다. 커밋된 diff 에는 영향이 없다.
  - 제안: 조치 불요(이미 원복 확인). 다음 라운드 리뷰어가 이 파일에서 유사한 순간적 diff 를
    보더라도 이 PR 의 결함으로 오인하지 않도록 이 관측을 남긴다.

- **[INFO]** 설계 근거(`#1330`→`#1331` 축 변경표·"허용목록 없음" 번복 서사)가 소스 헤더
  주석·테스트 JSDoc·plan 문서(§A~D) 세 곳에 거의 축약 없이 반복되는 상태가 이번 라운드에도
  그대로 유지됨 — 새 지적 아님
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:1-52`(헤더),
    `guide-identifier-existence.test.ts:18-27`(JSDoc), `plan/in-progress/guide-identifier-existence.md` §A-B
  - 상세: 라운드 1·3 maintainability 리뷰가 이미 지적·"조치 불요(다음 설계 변경 때 코드 헤더
    단일화 고려)"로 처분한 항목과 동일 지점이다. 이번 라운드에서 상태 변화가 없어 재차
    CRITICAL/WARNING으로 올리지 않는다.
  - 제안: 없음(재확인만).

- **[INFO]** SPEC-DRIFT — `spec/conventions/user-guide-evidence.md §2`가 이 가드 가족을
  아직 3건(리네임 전 이름 기준)으로 세고 있고, `guide-identifier-existence`/
  `guide-sanitized-message-parity`를 포함한 5건 갱신이 미반영 — 이번 PR 범위 밖, 이미 등재됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3247-3274`
  - 상세: `developer`는 `spec/` 쓰기 권한이 없고 자기-반증형 소정정 예외(그 예외는 *developer
    자신이 쓴 예고 문장*에만 열린다 — 이 관계표는 그것이 아니라 `#1330`이 쓴 것이다)에도
    해당하지 않는다. planner 백로그 항목에 새 파일명·표·frontmatter `code:` 목록·Rationale
    초안까지 이미 실려 있어(§명명 갱신 지시 포함) 처분이 완결된 형태로 위임돼 있다. 이 PR의
    `plan/in-progress/guide-identifier-existence.md` 상단 배너도 이 사실을 명시적으로 밝힌다.
    문서화 관점에서 "SoT가 구현을 아직 못 따라간다"는 사실 자체는 실재하지만, 이번 diff가
    새로 만든 갭이 아니라 `#1330`부터의 선재 갭이고 반복 확인(통산 7회 독립 확인, 라운드
    1~3의 documentation/consistency 리뷰가 매번 재확인)된 상태다.
  - 제안: 조치 불요(developer 권한 밖, 이미 등재). 다음 planner 턴에서 한 번에 반영될 때까지
    같은 지적이 반복 등장하는 것은 기록의 일관성이지 새 결함이 아니다.

## 요약

라운드 3 이후 유일한 실 코드 변경(`b75fe0ace`)은 라운드 3 WARNING#1이 지적한 "주석에만
있고 아무도 겨누지 않은 설계 결정"(`UPPER_SNAKE`의 밑줄 최소 1개 요구)을 판별 fixture와
함께 테스트로 고정한 것으로, 코드 주석이 리뷰 라운드 경로를 전체 경로로 정확히 인용하는 등
문서화 관례를 그대로 따른다. 이전 세 라운드가 지적·처분한 모든 문서화 결함(자매 파일 죽은
참조, 한계 주석 소실, `composeTexts` 스코프 drift, CHANGELOG/PROJECT.md drift, plan
체크리스트 지연, `.bak` 잔존)이 소스를 직접 열어 재확인한 결과 전부 해소된 채 유지되고
있다. 리뷰 도중 다른 병렬 세션이 `guide-identifier-scan.ts`의 `CODE_FIELD` 정규식을 일시
수정했다가 원복하는 것을 관측했으나(커밋 diff와 무관, 현재 clean) 절차상 보고 의무에 따라
기록한다. 유일하게 남은 것은 `spec/conventions/user-guide-evidence.md §2`의 가드 가족
카탈로그 갱신인데, 이는 developer 권한 밖이고 이미 planner 백로그에 완결된 형태로 등재돼
반복 확인된 선재 갭이다. 이번 diff 자체에 새로운 CRITICAL/WARNING 급 문서화 결함은 없다.

## 위험도

LOW — diff 자체의 문서화 상태는 건실하며 블로킹 사유가 없다. 남은 항목(SoT 카탈로그 갱신)은
developer 권한 밖으로 이미 위임 완료됐고, 관측된 병렬 세션 뮤테이션은 이미 원복돼 조치가
불필요하다.
