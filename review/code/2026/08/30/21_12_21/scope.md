# 변경 범위(Scope) 리뷰

## 배경

이 diff(`origin/main`(`5edf68888`)..HEAD(`ca260d87e`))는 세 커밋으로 구성된다:

- `7d6854cb9` — report-return 계약의 file/return sink 분리(+3 워크플로 미러 +신규 테스트) **+**
  `updateExecutionStatus` self-deadlock 호출 스택 감사(JSDoc, 순수 주석)
- `5a33656f9` — 그 다음 리뷰 라운드(`20_21_06`, WARNING 4건)의 반영 + 해당 라운드 산출물 커밋
- `ca260d87e` — 그 다음 리뷰 라운드(`20_46_48`, WARNING 5건)의 반영 + 해당 라운드 산출물 커밋

이번 라운드(`21_12_21`)가 보는 diff 는 위 세 커밋 전부의 누적이며, 앞 두 커밋에 대한 scope 판단은
이미 `review/code/2026/08/30/20_21_06/scope.md`, `review/code/2026/08/30/20_46_48/scope.md` 에
기록돼 있다. 아래는 그 판단을 승계하고 `ca260d87e`(신규분)에 국한해 새로 검증한 결과다.

## 발견사항

- **[INFO]** 커밋 `7d6854cb9`가 서로 무관한 두 결함 수정(계약 sink 분리 · self-deadlock 호출
  스택 감사)을 한 커밋에 담은 상태가 이번 diff 에도 여전히 남아 있다 — **이미 세 번 지적되고
  처분이 끝난 기결 사안**이다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`updateExecutionStatus` 상단 JSDoc 블록) · `plan/in-progress/backend-lint-gate-broken-on-main.md`
    ("커밋 분리에 대한 판단 기록" 단락)
  - 상세: `20_21_06` 라운드 scope 리뷰어가 WARNING #4 로 지적했고, 개발자는 "되돌리지 않되 plan 에
    판단을 기록"하는 방식으로 처분했다(`plan/in-progress/backend-lint-gate-broken-on-main.md` 의
    "이 세션에서 같은 지적을 세 번째 받았다" 자기 진단 포함). `20_46_48` 라운드 scope 리뷰어도 같은
    결론(INFO, 조치 불요)을 냈다. 이번 라운드가 새로 발견한 사실이 아니라 같은 커밋이 diff 표면에
    계속 보이는 것뿐이다.
  - 제안: 조치 불요(4번째 재-revert 요구 안 함). plan 이 이미 "다음엔 커밋을 주제별로 가른다"는
    습관 교정 의도를 기록해 뒀으므로 추가 조치 없음.

- **[INFO]** 신규 커밋 `ca260d87e`(이번 라운드의 실질 신규분)는 겉보기엔 여러 파일에 걸쳐 있지만
  ("2026-08-31" 오탈자 5곳 verbatim 미러 정정 + JSDoc 재구조화 + 신규 드리프트 가드 테스트 +
  `20_46_48` 라운드 산출물 커밋), 전부 **`20_46_48` 라운드가 낸 WARNING 1·3·4·5 및 그 산출물**을
  일괄 반영하는 단일 활동이다 — 서로 독립적으로 착상된 신규 작업의 결합이 아니라 "그 리뷰 라운드의
  RESOLUTION" 이라는 하나의 일관된 활동. `git diff 5a33656f9 ca260d87e --stat` 로 직접 대조해
  20개 파일 변경 전부가 그 라운드의 5건 WARNING 처분(날짜 정정·가드 사각지대 폐쇄·JSDoc 축약·
  plan 이관)과 그 산출물 커밋으로 설명됨을 확인했다.
  - 위치: 전체 diff(`ca260d87e`)
  - 제안: 조치 불요 — scope 위반 아님.

- **[INFO]** `.claude/tests/test_workflow_scripts.py` 의 신규 서브테스트
  (`test_guard_filename_references_point_at_this_file`)는 `20_46_48` W1(드리프트 가드의 구조적
  사각지대)을 직접 닫는 신규 회귀 가드다 — 이번 diff 의 주제(계약 sink 분리 + 그 가드 무결성)와
  일치하며 무관한 기능 확장이 아니다.
  - 위치: `.claude/tests/test_workflow_scripts.py`
  - 제안: 조치 불요.

- **[INFO]** `execution-engine.service.ts` 의 JSDoc 재구조화(세대별 개정 서사를 plan 으로 이관,
  현재 스냅샷 + 재대조 지시만 남김)는 `git diff origin/main` 으로 직접 대조한 결과 해당 hunk 하나에
  한정돼 있고 로직 변경은 0(순수 주석)이다. `20_21_06`·`20_46_48` 두 라운드 모두 같은 확인을
  반복했고 이번에도 동일하게 재확인됐다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`updateExecutionStatus` 상단 JSDoc)
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/08/30/20_46_48/**` 전체(RESOLUTION.md·SUMMARY.md·개별 reviewer
  산출물·`_retry_state.json`·`meta.json`)를 신규 파일로 커밋한 것은 CLAUDE.md 저장 위치 규약과
  이 저장소의 기존 관행에 부합한다(`20_21_06/**` 커밋에 대해서도 앞선 두 라운드가 동일하게 확인).
  - 위치: `review/code/2026/08/30/20_46_48/*`
  - 제안: 조치 불요.

- **[INFO]** 검증 중 워킹트리에서 일시적 변칙을 관측했다: `awk` 로 `.claude/workflows/ai-review.js`
  의 SHARED-BLOCK 을 뜬 시점에는 로컬 헤더 주석이 옛 가드 파일명(`test_workflow_shared_block.py`)을
  가리키고 있었는데, 곧이어 `git status --short` 를 돌리자 clean 이었고 `git show HEAD:...`
  대조 결과 커밋된 내용은 정정된 이름(`test_workflow_scripts.py`)이었다. 이는 이 파일에 아무것도
  쓰지 않았음에도 관측된 것으로, `RESOLUTION.md`(`20_46_48`)가 기록한 "마커 밖 헤더 하나만 옛
  이름으로 되돌리니 RED" 뮤테이션 검증과 정확히 같은 조작이다 — **동시에 같은 워킹트리를 읽는
  다른 리뷰어(testing/documentation 계열)의 뮤테이션 테스트가 지나간 흔적**으로 판단된다. 내가
  만든 변경이 아니며, 확인 시점엔 이미 원복돼 있었다(`git status --short` clean, HEAD 내용 일치).
  이 diff 자체의 결함이 아니므로 조치는 불요하나, 병렬 오염 패턴이 이번 라운드에서도 재현됐다는
  사실은 harness 운영상 기록해 둘 가치가 있다.
  - 위치: (워킹트리 일시 상태, 커밋되지 않음) `.claude/workflows/ai-review.js`
  - 제안: 조치 불요(diff 문제 아님). 참고 기록.

## 요약

이번 changeset 은 세 커밋 누적이며, 실질 신규분(`ca260d87e`)은 직전 리뷰 라운드(`20_46_48`)의
WARNING 5건을 반영하는 단일하고 일관된 "리뷰 수정" 활동이다 — 날짜 오탈자 정정, 드리프트 가드의
구조적 사각지대를 닫는 신규 회귀 테스트, JSDoc 서사를 plan 으로 이관하는 축약, 그리고 그 라운드
자신의 산출물 커밋까지 전부 하나의 주제(직전 라운드 WARNING 처분)로 설명된다. 새로 발견된 scope
위반은 없다. 유일하게 남은 사안은 최초 커밋(`7d6854cb9`)이 두 무관한 결함 수정을 한 커밋에 담은
패턴인데, 이는 이미 두 라운드 전에 WARNING 으로 지적되고 개발자가 plan 에 판단을 명시적으로
기록하며 처분을 끝낸 기결 사안이라 이번에도 조치를 요구하지 않는다. 검증 중 관측된 워킹트리의
일시적 변칙(옛 가드 파일명이 순간적으로 보인 것)은 병렬 리뷰어의 뮤테이션 테스트 흔적으로 판단되며
이 diff 의 결함이 아니고, 확인 시점엔 이미 원복돼 있었다.

## 위험도

LOW
