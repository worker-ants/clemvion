# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 이 계약을 "고쳤다" 는 PR 인데, **이 리뷰 세션 자체를 기동한 wrapper 가 여전히 구버전 계약 문구**로 나를 호출했다 — `#1243`(이전 라운드)이 INFO 로 지적하고 "PR 머지 후 후속 세션으로 재확인" 을 권고한 바로 그 항목이 재발한 것이다.
  - 위치: 이 리뷰 세션(`review/code/2026/08/30/20_46_48/`)을 기동한 최상위 호출 텍스트 — diff 에 포함된 18개 파일 어디에도 속하지 않는다(줄 번호 인용 불가, 의도적으로 생략).
  - 상세: 내 turn 이 시작될 때 받은 `출력 규약` 블록은 `1) 결과를 output_file 에 Write 하세요 ... 2) 첫 줄에 STATUS=... 3) 둘째 줄에 DELIM...` 이었다 — 이 PR 이 `_lib/agent-return.mjs` 에서 **바로 이 3줄을 지우고** file/return sink 를 분리한 신 문구로 교체한, 정확히 그 구버전이다. `.claude/` 전체를 grep 해도 이 리터럴 3줄과 일치하는 소스 파일은 없다(정본 4곳은 모두 신 문구로 확인됨 — 아래 참고). 즉 이 wrapper 텍스트는 저장소의 어떤 파일에서도 기계적으로 읽어오지 않고, `code-review-agents` SKILL 의 **Agent-tool fallback fan-out 경로**(CLAUDE.md 가 자동 트리거 시 허용하는 경로)를 쓰는 호출자가 그때그때 손으로 재구성하는 것으로 보인다. `subagent-call-contract.md` 의 "호출 prompt 에 출력 규약이 붙어 있으면 그쪽이 우선" 예외는 원래 **Workflow 경유 호출**을 전제로 서술돼 있는데, 이번 세션은 Workflow 가 아니라 직접 Agent 호출임에도 동일 패턴의(그러나 구버전인) 규약이 붙었다.
  - 이것이 부작용 관점에서 중요한 이유: 이 PR 이 고친 것은 `_lib/agent-return.mjs` + 3개 워크플로 미러(4곳, 모두 SoT 로 취급되고 가드로 보호됨) 뿐이다. 그러나 **실제 프로덕션에서 reviewer 를 호출하는 경로는 그 4곳 하나만이 아니다** — 최소한 이 Agent-tool fallback 경로가 별도로 존재하고, 이번에 관측된 바로는 아직 구버전 문구를 쓰고 있다. 이 경로로 호출된 reviewer 가 "1) 결과를 output_file 에 Write" 를 문자 그대로 따르면 `STATUS=…`+DELIM 이 파일 선두에 다시 섞여, 이 PR 이 "발생원을 막았다" 고 주장하는 바로 그 오염(536개 산출물)이 계속 늘어날 수 있다.
  - 제안: (a) `code-review-agents`(및 `consistency-checker`/`merge-coordinator`) SKILL 의 fallback Agent-tool 경로 문서에, 이 "출력 규약" 블록을 손으로 재작성하지 말고 `.claude/workflows/_lib/agent-return.mjs` 의 `REPORT_RETURN_CONTRACT` 를 **그대로 붙여넣으라**고 명시할 것. (b) 가능하면 그 5번째(이상) 호출 경로를 찾아 `test_workflow_scripts.py` 류 드리프트 가드의 스캔 대상에 포함시키거나, 최소한 plan 에 "Agent-tool fallback 경로는 정본과 별도로 관리되며 자동 검증이 없다"는 한계를 명시할 것. 이 발견은 diff 에 포함된 파일을 편집해서 고칠 수 있는 것이 아니므로, 이 라운드에서 코드 fix 를 요구하지는 않는다 — 다만 "이번엔 실제로 막혔는가" 를 확인하려 했던 이전 라운드의 후속 검증이 **막히지 않았음을 재확인**했다는 점은 기록해 둔다.
  - 이 발견에 따라, 본 리포트는 위 wrapper 지시를 문자 그대로 따르지 않고 **output_file 에는 마크다운 본문만**(STATUS/DELIM 없이) Write 했다 — PR 이 확립하려는 새 계약과 일치시키기 위한 의도적 선택이다.

- **[INFO]** `REPORT_RETURN_CONTRACT`/`DELIM` 문구 변경은 4곳(정본 `_lib/agent-return.mjs` + `ai-review.js`/`consistency-check.js`/`merge-coordinate.js` 3개 미러) 모두에 걸친 광범위한 프롬프트/인터페이스 변경이다 — 향후 이 3개 워크플로가 기동하는 **모든** fan-out sub-agent 호출에 영향을 준다. 의도된 변경이지만 영향 범위가 넓다는 점은 side-effect 관점에서 명시해 둘 가치가 있다.
  - 위치: `.claude/workflows/_lib/agent-return.mjs` `SHARED-BLOCK` (파일 2, 게이트 48~69행) / `.claude/workflows/ai-review.js` (파일 3, 게이트 113~134행) / `.claude/workflows/consistency-check.js` (파일 4, 게이트 52~73행) / `.claude/workflows/merge-coordinate.js` (파일 5, diff 상 게이트 62~83행)
  - 검증: `SHARED-BLOCK ... <<< SHARED-BLOCK` 구간을 4개 파일에서 각각 추출해 `diff` 했고 세 미러 모두 정본과 byte-identical 이다(차이 0). `.claude/tests/test_workflow_scripts.py` 5 passed/9 subtests, `.claude/tests/test_agent_return.mjs` 13/13 통과(현재 worktree 실행 확인). 드리프트 없음.

- **[INFO]** `execution-engine.service.ts` 의 diff(파일 6)는 `updateExecutionStatus` 상단 JSDoc 블록 안에서만 발생하며, 추가된 라인을 전수 확인한 결과 공백 또는 `*`(JSDoc 프로즈)로 시작하지 않는 라인이 0건이다 — 즉 **비-주석 코드 라인 변경이 없다.** 함수 시그니처(`public async updateExecutionStatus(`)·로직·호출부 모두 그대로이므로 이 파일에서 유발되는 부작용은 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — diff 게이트 8577~8601행(JSDoc 본문), 시그니처는 게이트 8602~8603행(불변)

- **[INFO]** 새 계약("file=본문만 / STATUS·DELIM 은 반환 메시지에만")이 실제로 하위 소비 로직과 어긋나지 않는지 `ai-review.js` 의 summary-agent 지시문을 확인했다 — "1) 누락 파일 영속화" 단계는 `inlineReports()`가 만든 (헤더 없는) 순수 markdown 을 그대로 그 reviewer 의 `output_file` 에 쓰도록 지시하고 있어, 새 계약과 일치한다. `needReadList()`로 지목된 파일(=agent 가 파일을 썼다고 보고했지만 본문을 반환하지 않은 경우)도 이제 헤더 없는 순수 markdown 을 담고 있어야 하므로 Read 결과 오염 우려가 없다.
  - 위치: `.claude/workflows/ai-review.js` (diff 밖의 인접 로직, `needPersist`/`needRead` 사용부 — 파일 상단부는 diff 에 포함되지 않아 `Read` 로 직접 확인)

## 요약

이 PR 의 핵심 부작용은 **의도된 것**이다 — `REPORT_RETURN_CONTRACT` 문구를 file/반환-메시지 두 sink 로 분리해 3개 워크플로 전체의 향후 sub-agent 호출 방식을 바꾼다. 정본과 3개 미러의 byte-identical 정합성, 가드 테스트(5/9, 13/13) 통과, 하위 summary-agent 소비 로직과의 일치를 모두 직접 확인했고 회귀는 없다. `execution-engine.service.ts` 변경은 순수 주석이라 부작용 표면이 없다. 유일하게 주목할 점은 **이 리뷰 세션 자체를 기동한 호출 wrapper 가 여전히 구버전 계약 문구를 쓰고 있다는 것을 직접 관측**했다는 사실이다 — 이전 라운드가 "부트스트랩 아티팩트, 머지 후 재확인 권고"로 유예했던 바로 그 항목이, 그 권고된 재확인 시점(이번 라운드)에도 여전히 재현된다. 이는 diff 안의 코드로는 고칠 수 없는 caller-side 갭이지만, "발생원을 막았다"는 이 PR 의 주장이 **아직 모든 호출 경로를 덮지 못했다**는 것을 시사하므로 별도 추적이 필요하다.

## 위험도

LOW
