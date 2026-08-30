# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `20_46_48` side_effect 라운드가 관측한 "이 리뷰 세션을 기동한 wrapper 가 여전히
  구버전 계약 문구를 쓴다" 는 현상을, 이번 라운드도 겪었다 — 그리고 이번엔 **원인을 직접
  measured 로 확정**했다. `plan/in-progress/backend-lint-gate-broken-on-main.md:317-329` 의
  아직 열려 있는 항목("새 계약이 실제 실행 경로에 붙는지 다음 세션에서 확인")이 제시한 확인
  절차(`grep -c "마크다운 본문만" <persisted script>`)를 이번 라운드에서 실제로 실행했다.
  - 위치: diff 에 포함된 파일이 아니다(harness 세션 상태). 재현 경로:
    `/Users/gehrig/.claude/projects/-Users-gehrig-orca-workspaces-clemvion-doliolid--claude-worktrees-raw-update-guard-scope-0e154c/b8e8a7f1-7877-46e4-8615-c7e5ad8d99a8/workflows/scripts/ai-review-wf_8aded75e-ea5.js`
    (mtime 21:12 — 이 리뷰 라운드 `21_12_21` 과 일치하는, 이 세션의 가장 최근 `ai-review-wf_*.js`).
    관련 plan 항목: `plan/in-progress/backend-lint-gate-broken-on-main.md:317-329`.
  - 상세: `grep -c "마크다운 본문만" <persisted script>` → **0**. `wc -l` → **325**(저장소 현재
    `.claude/workflows/ai-review.js` 는 **333**). `grep -n "SHARED-BLOCK\|결과를 output_file"`
    결과, persisted 스크립트는 `1) 결과를 output_file 에 Write 하세요 (best-effort — 실패해도
    아래 2·3 은 반드시 수행).` 구버전 3줄과, 심지어 **이 브랜치의 첫 커밋(`7d6854cb9`)에서 이미
    개명된** `test_workflow_shared_block.py` 가드 파일명까지 그대로 담고 있다 — 이 세션(및 그
    안의 세 커밋) 시작보다 앞선 스냅샷이라는 뜻이다. 실제로 `ls -la .../workflows/scripts/` 로
    이 세션의 `ai-review-wf_*.js` 18개를 전수 확인하니 **Aug 29 17:32 ~ Aug 30 21:12 사이 18개
    전부 정확히 17300 바이트로 동일**하다 — 세션 시작 시점 한 번 캐시된 뒤, 그 사이 일어난
    `.claude/workflows/ai-review.js` 의 세 차례 커밋 편집이 **한 번도 반영되지 않았다.**
    plan 의 "이 세션이 시작 시점 스냅샷" 가설을, 간접 diff 비교가 아니라 persisted 파일을
    직접 읽어 **확정**하는 결과다. 부작용 관점에서 중요한 것은: 이 세션 안에서 진행된 3개
    라운드(`20_21_06`·`20_46_48`·이번 `21_12_21`) **전부**가, 이 PR 이 고치는 그 계약 버그를
    실제로는 재현하는 스냅샷으로 sub-agent 를 호출해 왔다는 뜻이다 — "다음 라운드에서
    검증하면 된다" 가 **이 세션 안에서는 성립하지 않는다.**
  - 이 diff 로 고칠 수 있는 결함은 아니다(harness/세션 캐싱, repo 파일 아님) — 코드 fix
    요구는 없다. 다만 plan 의 "확인 방법" 서술이 "새 세션에서 `/ai-review` 를 한 번 돌린 뒤"
    라고만 적어 두어, **"같은 세션의 새 라운드"와 "새 top-level 세션"이 구분되지 않는다.**
    이번 실측은 전자로는 절대 닫히지 않음을 보여준다.
  - 제안: plan 항목의 "확인 방법"에 "여기서 '새 세션' 은 현재 세션(`b8e8a7f1-…`)이 아닌
    **새로운 top-level Claude Code 세션**을 뜻한다 — 같은 세션의 새 리뷰 라운드는 persisted
    스크립트가 세션 시작 시점에 캐시된 채 갱신되지 않아 검증에 쓸 수 없다(실측: 18개
    `ai-review-wf_*.js` 가 세션 전체에서 17300 바이트로 불변)" 를 덧붙일 것.

- **[INFO]** `REPORT_RETURN_CONTRACT` 변경(file/반환-메시지 sink 분리)이 정본
  `.claude/workflows/_lib/agent-return.mjs` 와 3개 미러(`ai-review.js`/`consistency-check.js`/
  `merge-coordinate.js`) 전체에 걸쳐 **byte-identical** 하게 반영됐음을 직접 확인했다 — 4개
  파일에서 `SHARED-BLOCK ... <<< SHARED-BLOCK` 구간을 각각 추출해 비교한 결과 완전 일치(길이
  3201자, 차이 0). 이는 향후 세 워크플로가 기동하는 **모든** fan-out sub-agent 호출에 영향을
  주는 광범위한 인터페이스 변경이지만, 드리프트 없이 의도대로 적용됐다.
  - 위치: `.claude/workflows/_lib/agent-return.mjs`(게이트 48~69) / `.claude/workflows/ai-review.js`
    (게이트 113~134) / `.claude/workflows/consistency-check.js`(게이트 52~73) /
    `.claude/workflows/merge-coordinate.js`(게이트 62~83)

- **[INFO]** `execution-engine.service.ts` 의 diff는 `updateExecutionStatus` 상단 JSDoc
  블록 안에서만 발생한다. 추가·수정된 라인을 전수 확인한 결과 공백 또는 `*`(JSDoc 프로즈)로
  시작하지 않는 라인이 0건이다 — 함수 시그니처(`public async updateExecutionStatus(`)·바디·
  호출부 전부 불변. 이 파일에서 유발되는 런타임 부작용은 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (JSDoc 게이트 8568~8582, 시그니처는 게이트 8583~8587 로 불변)

- **[INFO]** `.claude/tests/test_workflow_scripts.py` 의 신규 테스트
  `test_guard_filename_references_point_at_this_file` 는 `LIB`+`FAN_OUT` 대상 파일을
  `Path.read_text()` 로 읽기만 한다 — 파일 생성·수정·삭제, 전역 상태 변경, 네트워크 호출
  없음. 기존 `_extract_block()` 이 `SHARED-BLOCK` 마커 **안쪽만** 비교해 마커 **밖** 로컬
  헤더 주석의 파일명 참조 드리프트를 못 잡던 구조적 사각지대를, 대상 파일 자신의 이름과
  대조하는 방식(하드코딩 없음)으로 닫았다 — 부작용 표면을 넓히지 않으면서 감시 범위만
  넓힌 순수 추가다.
  - 위치: `.claude/tests/test_workflow_scripts.py` 게이트 114~140

- **[INFO]** 이번 커밋 묶음이 새로 추가한 `review/code/2026/08/30/{20_21_06,20_46_48}/*`
  22개 파일(RESOLUTION/SUMMARY/개별 reviewer .md/`meta.json`/`_retry_state.json`)은
  CLAUDE.md 규약(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)대로 이전 리뷰 세션의
  산출물을 커밋한 것으로, 예상치 못한 파일시스템 부작용이 아니다. 다만 `_retry_state.json`·
  `meta.json` 두 종류 파일에는 `/Users/gehrig/orca/workspaces/clemvion/doliolid/...` 형태의
  로컬 절대경로가 그대로 박혀 있다 — 기능적 부작용은 아니지만(다른 머신에서 읽을 때 그
  경로가 존재하지 않을 뿐 파싱 실패로 이어지진 않음), 다른 사용자 환경에서는 참조 불가능한
  경로가 이력으로 고정된다는 점만 기록해 둔다.
  - 위치: 예) `review/code/2026/08/30/20_21_06/_retry_state.json` 게이트 2~7,
    `review/code/2026/08/30/20_21_06/meta.json`(파일 경로만, 로컬 절대경로 없음 — 문제 없음)

## 요약

이 PR 의 핵심 부작용은 의도된 것이다 — `REPORT_RETURN_CONTRACT` 를 file/반환-메시지 두
sink 로 분리해 세 워크플로 전체의 향후 sub-agent 호출 방식을 바꾼다. 정본과 3개 미러의
byte-identical 정합성을 직접 확인했고, `execution-engine.service.ts` 변경은 순수 JSDoc 이라
부작용 표면이 없으며, 신규 가드 테스트는 읽기 전용이다. 유일한 주목할 발견은 harness 쪽
관측이다: 이 세션의 persisted `ai-review` 워크플로 스크립트가 세션 시작 시점에 캐시된 채
그 안의 세 커밋 편집을 한 번도 반영하지 않았음을 직접 측정으로 확정했다 — plan 에 이미
열려 있는 "다음 세션에서 확인" 항목이 왜 **이번 라운드로는 닫히지 않는지**에 대한 구체적
근거이며, 그 항목의 "새 세션" 문구를 top-level 세션 단위로 명확히 할 필요가 있음을 보여준다.
이 diff 안의 코드 자체에 대한 회귀는 발견하지 못했다.

## 위험도

LOW
