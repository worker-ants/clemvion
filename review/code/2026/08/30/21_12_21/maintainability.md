# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `updateExecutionStatus` JSDoc 안에서 "9" 가 서로 다른 두 모집단(호출부 개수 vs 트랜잭션 블록 개수)을 가리키는 문제가 두 라운드째 방치돼 있고, 이번 개정으로 오히려 더 붙어 앉았다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8571`-`8572`
  - 상세: 현재 문장은 "호출부 **20곳**(이 파일 직접 11 + `EngineDriver` 경유 **9**) 과 backend `.transaction(` 블록 **36개**(모듈 안 **9** + 밖 27)" 다. `EngineDriver` 경유 호출부 개수(9)와 이 모듈 안 `.transaction(` 블록 개수(9)는 우연히 같은 값을 가진 서로 무관한 집합인데, 같은 두 줄짜리 문장 안에 나란히 등장한다. 이 문제는 직전 라운드(`20_21_06`) maintainability 리뷰가 이미 INFO 로 지적하며 "(위 20곳/9곳과는 별개의 집합)" 식의 명시를 제안했었다. 이번 diff 는 그 사이 JSDoc 을 전면 재작성해 서사 누적(49줄→30줄) 문제와 forward-looking 지시문 삭제 문제는 성실히 해소했지만, 이 특정 INFO 는 반영되지 않았고 구조상 두 "9" 가 이전 판(8행 간격, 서로 다른 단락)보다 오히려 더 가까이(같은 문장 안)붙어 혼동 여지가 살짝 늘었다.
  - 제안: "밖 27" 뒤나 "모듈 안 9" 옆에 "(위 20곳의 9와는 별개 집합)" 정도의 짧은 괄호 하나만 추가하면 해소된다. 사소하지만 세 판째 같은 JSDoc 을 스치면서 반복적으로 놓치고 있다는 점은 기록해 둘 만하다.

## 확인 사실 (조치 불요, 참고용)

이번 diff 는 직전 두 라운드(`20_21_06`, `20_46_48`)의 maintainability WARNING/INFO 를 대부분 반영했다. 직접 대조한 결과:

- **가드 테스트 파일명 리네임(`test_workflow_shared_block.py` → `test_workflow_scripts.py`)이 이제 완전하다.** `grep -rln "test_workflow_shared_block" --include="*.js" --include="*.mjs" --include="*.py" --include="*.ts" .` 실행 결과 저장소 소스 전체에서 유일한 매치는 `.claude/tests/test_workflow_scripts.py:119` 인데, 이는 실제 참조가 아니라 그 리네임 사건 자체를 설명하는 docstring 문장이다. `.claude/workflows/ai-review.js`(:109 지역 헤더 / :113 마커), `consistency-check.js`(:48/:52), `merge-coordinate.js`(:58/:62) 모두 두 위치가 일치한다 — 직전 라운드가 지적했던 "같은 파일 안 두 곳이 서로 다른 이름을 가리키는 자기모순"은 해소됐다.
- **4개 파일(`_lib/agent-return.mjs` + 3개 워크플로 미러)의 `SHARED-BLOCK` 구간이 여전히 바이트 단위로 완전히 동일**하다(`awk` 로 마커 구간을 각각 추출해 `diff` — 3건 모두 차이 없음). verbatim 미러링 관례가 유지되고 있다.
- **`updateExecutionStatus` JSDoc 이 30줄로 줄었다**(`8553`-`8582`). 직전 라운드가 "다음에 이 영역을 손댈 때 세대별 서사를 plan 으로 이관" 하기로 유예했던 조건이 이번에 충족됐고, 실제로 개정 이력 표는 `plan/in-progress/backend-lint-gate-broken-on-main.md` 로 옮겨졌다 — JSDoc 에는 "현재 스냅샷 + 남는 한계 + 재확인 트리거" 만 남았다.
- **삭제됐던 forward-looking 지시문("새 호출부를 추가할 때는 그 축도 함께 볼 것")이 복원**됐고, 오히려 원래보다 구체적이다("세는 패턴은 제네릭 인자 포함·주석 줄 제외해야 한다 — 그러지 않으면 각각 35 와 부풀린 수가 나온다") — 세 판에 걸쳐 실제로 반복된 두 가지 계측 실수(제네릭 누락, 자기참조 grep 오염)를 구체적으로 못박아 다음 사람이 같은 함정에 빠질 확률을 줄인다.
- plan 문서에 새로 추가된 "세 판에 걸친 수치 정정 이력" 표(판/주장/무엇이 틀렸나)는 이 저장소의 다른 RESOLUTION.md 류 문서와 형식이 일관되고, 각 행이 근거(리뷰 세션 ID)를 명시해 추적 가능하다.
- `plan/complete/spec-draft-raw-query-results.md` 의 날짜 정정(`2026-08-31` → `2026-08-30`)은 단순 오타 수정으로 문제없다.
- `.claude/tests/test_agent_return.mjs` 의 신규 테스트 2건(`step 1 tells the agent…`, `steps 2 and 3 are scoped…`)은 헬퍼 없이 `indexOf('1)')`/`indexOf('2)')` 문자열 리터럴로 계약 문구를 슬라이스하는 결합이 있다 — 이는 `20_46_48` maintainability 라운드가 이미 INFO 로 지적하고 "당장 조치 불요, 향후 `REPORT_RETURN_CONTRACT` 를 다시 만질 때 배열 인덱스/명명 상수로 리팩터 고려"로 유예한 항목이다. 코드가 변경되지 않았으므로 이번 라운드에서 다시 올릴 근거는 없다.

review/code/2026/08/30/20_21_06/**, review/code/2026/08/30/20_46_48/** 하위에 새로 추가된 파일들(RESOLUTION.md, SUMMARY.md, meta.json, 각 관점별 `*.md`)은 이전 리뷰 라운드의 산출물이 이번 커밋에 함께 포함된 것으로, 그 시점의 기록이라 편집 대상이 아니다 — 내용 자체에 대한 유지보수성 평가는 이미 그 라운드들에서 수행됐으므로 본 라운드에서 재평가하지 않았다.

## 요약

이 diff 는 유지보수성 관점에서 이미 두 라운드에 걸쳐 촘촘히 검토된 변경의 세 번째 판이며, 그 사이 지적됐던 실질적 문제(가드 파일명 부분 반영 드리프트, JSDoc 서사 무한 누적, forward-looking 지시문 삭제)를 모두 실측으로 확인 가능하게 해소했다. 저장소 전수 재확인으로 잔여 드리프트 0건, SHARED-BLOCK 4곳 verbatim 일치, JSDoc 49→30줄 축소 및 이력을 plan 문서로 정확히 이관한 것을 직접 검증했다. 유일하게 남은 흠은 사소한 것으로, 같은 JSDoc 문장 안에서 우연히 같은 값(9)을 갖는 두 개의 무관한 모집단이 나란히 언급돼 빠르게 훑는 독자를 혼동시킬 수 있다는 점이며, 이는 직전 라운드가 이미 지적했으나 이번에도 반영되지 않았다(기능 영향 없는 순수 주석 명확성 문제). 그 외 새 회귀 테스트 2건은 뮤테이션으로 vacuous 아님이 확인됐고, 워크플로 3개 파일의 verbatim 미러링도 유지되고 있어 전반적으로 양호하다.

## 위험도

LOW
