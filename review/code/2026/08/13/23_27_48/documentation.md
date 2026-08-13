# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** `admitExecutionOrDefer` 안에 남은 두 번째 stale 주석 — "위 제네릭은" 이 가리키는 제네릭이 이번 diff 로 사라졌다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2931` (`// \`EntityManager.query\` 의 선언 타입은 \`Promise<any>\` 라 위 제네릭은 **주장이지 검증이 아니다.**`) — 새로 추가된 주석은 같은 파일 `:2916-2919`
  - 상세: 직전 라운드 RESOLUTION(`review/code/2026/08/13/20_36_35/RESOLUTION.md` CRITICAL 2)은 정확히 이 함수 안에서 "이번 결함의 근본 원인이 된 바로 그 믿음"이었던 옛 주석(`RETURNING id 이므로 실제 shape 은 행 배열이다`)을 삭제하고 새 주석으로 통합했다고 조치 완료를 선언했다. 그런데 그 몇 줄 아래(옛 `assertRowArray(...)` 호출부 바로 위, 이번 diff 대상 두 hunk 사이의 미변경 context)에 있던 **또 다른** 옛 주석 — "위 제네릭은 주장이지 검증이 아니다" — 은 그대로 남았다. 이 문장은 코드가 `m.query<{ id: string }[]>(...)` 처럼 명시 제네릭을 달고 있던 시절에 쓰인 것인데, 이번 diff 가 바로 그 제네릭을 지우고 `const rows: unknown = await m.query(...)` 로 바꿔 놓았다(`:2920`). 그 결과 "위 제네릭" 이 실제로는 더 이상 존재하지 않는 것을 가리키는 죽은 참조가 됐고, 새로 추가된 `:2916-2919` 주석("제네릭을 **달지 않는다**...")과 사실상 같은 내용을 반대 결론(제네릭이 있다는 전제)으로 두 번 말하는 셈이라 다음 독자가 혼란스럽다. 이 파일의 다른 주석(`:2944-2945`)이 스스로 "지식이 지점에 갇히면 그 옆에서 같은 실수가 난다"고 경고하는데, 정확히 그 패턴이 같은 함수 안에서 한 단계 더 재발했다.
  - 제안: `:2931-2933` 세 줄(`위 제네릭은 **주장이지 검증이 아니다.**` 부분)을 삭제하거나 `:2916-2919` 로 통합한다. 뒤이어 나오는 "**던지는 것 자체는 유지한다**" 이하 설계 근거(`:2934-2939`)는 여전히 유효하므로 그대로 둔다.

- **[WARNING]** `EXPECTED` 배열 위 주석이 실제 2-tuple 타입과 맞지 않는다 (3항목을 예고하지만 실제로는 2항목)
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:52` (`// (파일, UPDATE/DELETE 를 소비하는 지점 수, 그중 헬퍼/구조분해로 처리된 수)`), `:53` (`const EXPECTED: Array<[string, number]> = [`)
  - 상세: 주석은 "(파일, 소비 지점 수, 그중 헬퍼로 처리된 수)"라고 3개 정보를 담은 튜플을 예고하지만, 바로 아래 실제 타입은 `Array<[string, number]>` — 파일명과 숫자 하나(헬퍼 호출 횟수)만 담는 2-tuple이다. "소비 지점 총수"는 이 배열이 아니라 별도의 `it('소비 지점 자체의 수가 늘면 알려준다', …)` 테스트가 `CONSUMING` 정규식으로 따로 센다. 이 불일치는 직전 라운드(`review/code/2026/08/13/22_45_24/maintainability.md` INFO 2)에서 이미 "자매 헬퍼 `assertRowArray.spec.ts`의 `{rel, queries, guards}` 객체 배열과 형태가 다르다"는 맥락으로 지적됐지만, 정정되지 않고 이번 최종 diff까지 그대로 남았다.
  - 제안: 주석을 `// (파일, 그중 updateReturningRows 를 거치는 호출 수)` 처럼 실제 2-tuple에 맞게 정정한다.

- **[WARNING]** `retry-turn-terminal-guard.md` 소급 정정 배너가 "각주 갱신은 planner 위임 항목에 등재돼 있다"고 단언하지만, 실제로 그런 항목은 어디에도 없다
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md:42-43` (`> \`spec/conventions/node-cancellation.md:198\` §2.4 의 "✓ mutation 13/13 검증" 서술도 이 mock 경계 안쪽만 반영한다 — 각주 갱신은 planner 위임 항목에 등재돼 있다.`)
  - 상세: 직접 확인했다 — (1) 같은 파일의 `### project-planner 위임 (developer 권한 밖)` 절(`:335-344`)은 spec 자기모순 정정 항목 1건뿐이고 `node-cancellation.md` §6 표에 `retry-turn.service.ts` 행을 추가하라는 내용만 있다(2026-07-28 작성, 이번 소급 정정과 무관). (2) `### spec — project-planner 위임` 절(`:377-386`)은 `spec-update-node-cancellation-shutdown-classification.md` #8/#10 을 가리키는데, 그 파일을 `grep -n "mutation 13/13\|mock 경계\|persisted"` 로 확인해도 매치 0건이다. (3) 근본 원인 문서로 링크된 `plan/in-progress/update-returning-tuple-shape.md`의 `[planner 위임]` 절(`:193-208`)도 소급 각주 대상을 4개 spec 문서(`4-execution-engine.md` §1.1·`8-embedding-pipeline.md` §7.3·`10-graph-rag.md`·`data-flow/2-auth.md`)로 명시하는데 `node-cancellation.md` 는 그 목록에 없다. 즉 "각주 갱신은 planner 위임 항목에 등재돼 있다"는 문장이 가리키는 실체가 어느 문서에도 존재하지 않는다 — 바로 이 PR의 RESOLUTION(`review/code/2026/08/13/23_07_11/RESOLUTION.md`)이 스스로 "완료 선언이 사실보다 앞선 네 번째 사례"라고 명명한 것과 동일한 패턴(검증 없이 "이미 되어 있다"고 적음)이 이번엔 plan 배너 문구 안에서 다섯 번째로 나타난 것으로 보인다.
  - 제안: 이 문장이 가리키는 실제 항목이 없다면, `retry-turn-terminal-guard.md` 자체의 `### project-planner 위임` 절(또는 `spec-update-node-cancellation-shutdown-classification.md`)에 "node-cancellation.md:198 §2.4 mutation 13/13 표기에 mock-경계-한정 캐벗 추가" 항목을 새로 등재하고, 배너 문구를 "등재돼 있다"에서 "등재 필요"로 정정한다.

- **[INFO]** `assertRowArray` JSDoc이 새 자매 헬퍼 `updateReturningRows`를 역참조하지 않는다 (단방향 참조)
  - 위치: `codebase/backend/src/common/utils/assert-row-array.ts:1-14` (JSDoc) vs `codebase/backend/src/common/utils/update-returning-rows.ts:39-42` (`자매 헬퍼 \`assertRowArray\` 와 같은 계약이고…`)
  - 상세: `updateReturningRows` 쪽 JSDoc은 `assertRowArray`를 "자매 헬퍼"로 명시 언급하지만, `assertRowArray.ts` JSDoc은 반대로 `updateReturningRows`를 언급하지 않는다. 두 헬퍼의 SELECT/UPDATE·DELETE 분담은 `assert-row-array.spec.ts:76-81`의 테스트 주석에 기록돼 있어 정보 자체는 어딘가에 있지만, 정작 `assertRowArray` 함수 정의 바로 옆(가장 먼저 읽힐 자리)에는 없다. 향후 SELECT 자리에 `updateReturningRows`를 잘못 적용하거나 그 반대 오용을 막는 데는 크게 중요하지 않지만, 대칭성 관점에서 사소하다.
  - 제안: 필수 아님. 여유가 있으면 `assertRowArray.ts` JSDoc 끝에 "UPDATE/DELETE RETURNING 소비는 `updateReturningRows` 를 쓴다" 한 줄만 추가.

## 요약

핵심 신규 코드(`update-returning-rows.ts`)의 JSDoc은 실측 근거·실패 모드·타 관용구 대비표까지 갖춰 이 리뷰가 본 diff 중 가장 우수한 문서 사례이고, `plan/in-progress/update-returning-tuple-shape.md`도 Overview/실측/소급 영향/체크리스트/후속/Rationale 구조를 충실히 갖췄다. 다만 세 가지가 실질적으로 남아 있다: (1) 이번 PR이 한 번 고쳤다고 선언한 "정반대 옛 주석" 결함이 같은 함수 안에 형태를 바꿔 한 번 더 남아 있고(`execution-engine.service.ts:2931`, "위 제네릭"이 가리키는 대상이 이미 삭제됨), (2) 신규 스펙 파일의 `EXPECTED` 주석이 실제 타입(2-tuple)과 어긋난 채 두 라운드째 방치돼 있으며(`update-returning-rows.spec.ts:52`), (3) `retry-turn-terminal-guard.md`의 소급 정정 배너가 "각주 갱신이 이미 등재돼 있다"고 단언하지만 grep·직접 대조 결과 그 등재 항목이 실제로 존재하지 않는다(`:42-43`) — 이 세션이 스스로 4번 반복했다고 기록한 "검증 없는 완료 선언" 패턴의 재발로 보인다. 셋 다 기능에는 영향이 없는 문서 정확성 문제이나, (3)은 후속 작업이 실제로 누락될 위험을 남긴다는 점에서 우선 정정을 권한다. README·CHANGELOG·API 문서·설정 문서 관점에서는 이 diff가 순수 내부 버그 수정이라 갱신 대상이 없고, CHANGELOG 보류는 plan에 근거와 함께 명시적으로 기록돼 있어 문제 없다.

## 위험도

LOW
