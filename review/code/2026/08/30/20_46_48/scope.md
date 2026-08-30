# 변경 범위(Scope) 리뷰 — scope.md

## 배경

이 diff(`origin/main`..HEAD)는 두 커밋으로 구성된다: `7d6854cb9`(report-return 계약 file/return sink 분리 + `updateExecutionStatus` self-deadlock 호출 스택 감사)와 `5a33656f9`(그 다음 리뷰 라운드 `20_21_06`의 WARNING 4건 반영 + 해당 라운드 산출물 커밋). 아래 발견은 이 결합 상태를 대상으로 한다.

## 발견사항

- **[INFO]** 커밋 `7d6854cb9`가 서로 무관한 두 결함 수정을 한 커밋에 담은 상태가 이번 diff 에도 그대로 남아 있다 — 다만 **이미 처분이 끝난 항목**이다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8574-8601`(self-deadlock JSDoc 블록), `plan/in-progress/backend-lint-gate-broken-on-main.md:289-306`(판단 기록 블록)
  - 상세: 파일 1~5(`.claude/tests/test_agent_return.mjs`, `.claude/workflows/_lib/agent-return.mjs` + 3개 워크플로 미러)의 `REPORT_RETURN_CONTRACT` file/return sink 분리와, 파일 6(`execution-engine.service.ts`)의 self-deadlock 호출 스택 축 JSDoc 감사는 서로 다른 주제인데 한 커밋(`7d6854cb9`)에 섞여 있다. 이 사실은 직전 리뷰 라운드(`20_21_06`)의 scope 리뷰어가 이미 WARNING으로 지적했고(본 diff 안의 `review/code/2026/08/30/20_21_06/scope.md`, `SUMMARY.md` WARNING #4 참조), 개발자는 그 지적을 **되돌리지 않되 plan에 판단을 기록**하는 방식으로 처분했다(`plan/in-progress/backend-lint-gate-broken-on-main.md:302-306` — "이 세션에서 같은 지적을 세 번째 받았다"고 스스로 인정). 즉 이번 라운드가 재발견한 새로운 사실이 아니라, 이미 사람이 판단하고 근거를 남긴 기결 사안이 diff 표면에 계속 보이는 것뿐이다.
  - 제안: 조치 불요(재-revert 요구 안 함). 다만 "같은 세션에서 세 번째"라는 자기 진단이 정확하므로, 다음 PR부터는 실제로 주제별 커밋 분리를 실천해 이 패턴이 네 번째로 반복되지 않도록 습관 교정을 권고한다(이는 코드 fix가 아니라 프로세스 권고).

- **[INFO]** 두 번째 커밋(`5a33656f9`)은 워크플로 3개 파일의 로컬 헤더 주석 정정("harness") + 엔진 JSDoc 수치 재검증("engine") + plan 갱신 + `review/code/2026/08/30/20_21_06/**` 산출물 커밋을 한 커밋(`fix(harness,engine):`)에 담았지만, 위 항목과는 성격이 다르다 — 이 넷 전부가 **단일 리뷰 라운드(`20_21_06`)가 낸 WARNING 1·2·4 및 그 산출물**을 일괄 반영하는 것으로, 서로 독립적으로 착상된 신규 작업을 묶은 게 아니라 "그 리뷰 라운드의 RESOLUTION"이라는 하나의 일관된 활동이다. CLAUDE.md의 "구현 완료 후 자동 review/fix는 상시 승인된 강제 의무" 조항과도 부합한다.
  - 위치: 전체 diff(`5a33656f9`) — `.claude/workflows/ai-review.js`, `consistency-check.js`, `merge-coordinate.js`(로컬 헤더 주석 1줄씩), `execution-engine.service.ts`(JSDoc 수치 재검증), `plan/in-progress/backend-lint-gate-broken-on-main.md`, `review/code/2026/08/30/20_21_06/**`
  - 제안: 조치 불요 — scope 위반 아님.

- **[INFO]** `review/code/2026/08/30/20_21_06/**` 전체(RESOLUTION.md·SUMMARY.md·11개 개별 reviewer 산출물·`_retry_state.json`·`meta.json`)를 신규 파일로 커밋한 것은 CLAUDE.md 저장 위치 규약("코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`")과 이 저장소의 기존 관행(예: `review/code/2026/08/29/17_32_16/`, `19_17_28/` 등 동일 패턴으로 개별 reviewer 파일 전부가 커밋된 선례 다수) 모두에 부합한다.
  - 위치: `review/code/2026/08/30/20_21_06/*`
  - 제안: 조치 불요.

- **[INFO]** 파일 1~5(정본 `_lib/agent-return.mjs` + 3개 워크플로 verbatim 미러 + 신규 테스트 2건)는 워크플로 샌드박스가 `import`를 지원하지 않아(`_lib/agent-return.mjs` 파일 헤더에 명시) 정본을 각 워크플로에 그대로 복사하는 것이 기존 관례다. `git diff origin/main -- codebase/backend/.../execution-engine.service.ts`로 직접 대조한 결과 파일 6의 diff는 JSDoc 주석 블록 한 hunk에 한정돼 있고 로직 변경은 없다 — 순수 문서화 갱신이 실제 코드 동작을 바꾸지 않았음을 확인했다.
  - 위치: `.claude/workflows/_lib/agent-return.mjs`, `ai-review.js`, `consistency-check.js`, `merge-coordinate.js`, `.claude/tests/test_agent_return.mjs`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  - 제안: 조치 불요.

- **[INFO]** `git diff origin/main --name-only`로 diff 전체 18개 파일을 프롬프트의 파일 목록과 전수 대조했다 — 누락·불일치 없음. `plan/in-progress/backend-lint-gate-broken-on-main.md`의 diff(`git diff` 직접 확인)도 이번 changeset이 실제로 작업한 두 체크리스트 항목(self-deadlock 호출 스택 축, 헤더 누출 발생원)에만 국한돼 있고 다른 무관한 항목을 건드리지 않았다.

## 요약

이번 changeset은 두 커밋으로 이뤄져 있다. 첫 번째(`7d6854cb9`)는 서로 무관한 두 결함 수정을 한 커밋에 담은 명백한 scope 위반 패턴을 여전히 담고 있지만, 이는 직전 리뷰 라운드가 이미 WARNING으로 지적했고 개발자가 "되돌리지 않되 판단을 기록한다"는 방식으로 명시적으로 처분을 완료한 기결 사안이다(같은 세션 세 번째 지적이라고 스스로 인정). 두 번째 커밋(`5a33656f9`)은 그 리뷰 라운드의 WARNING 4건과 산출물을 일괄 반영하는 단일 활동이라 겉보기엔 여러 파일을 넘나들지만 실질적으로는 하나의 "리뷰 수정" 작업이며 scope 위반이 아니다. 리뷰 산출물 전체를 커밋하는 것, verbatim 미러 5파일 반복 diff, 파일 6의 순수 JSDoc 수정 모두 기존 관례·규약과 일치한다. 새로 발견된 scope 위반은 없다.

## 위험도

LOW
