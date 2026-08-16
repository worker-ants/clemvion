# Plan 정합성 검토 — spec/5-system/ (impl-done, 철회 반영본 재검토)

## 검토 범위
- Target: `spec/5-system/14-external-interaction-api.md` · `6-websocket-protocol.md` · `12-webhook.md` (diff-base `origin/main`, HEAD 워크트리 `eia-masking-followups-3cd512`, 최신 커밋 `b05756d9e` "inputData 마스킹 철회")
- 대조: `plan/in-progress/**` 전수(번들 + 관련 파일 직접 Read/git log)
- 참고: 직전 라운드 `review/consistency/2026/08/16/23_49_05/plan_coherence.md` (`b05756d9e` **이전** 시점 — "draft plan 대 실제 spec diff... 사실상 동일" 로 LOW 판정). 그 판정이 이번 라운드에도 유효한지 재검증했다.

## 발견사항

- **[WARNING]** `spec-draft-eia-fanout-masking.md` 가 `inputData` 철회(최신 결정)를 반영하지 못한 채 반대 내용을 여전히 "적용 대상"으로 서술한다
  - target 위치:
    - `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ②" — *"`outputData` 해소, `inputData` 는 의도적 비대상(2026-08-16)"* (커밋 `b05756d9e`)
    - `spec/5-system/12-webhook.md` §5.3 캐비엇 — *"`inputData` 에는 그 갭을 덮는 후속 층이 없다 … 즉 이 ingestion 층이 `inputData` 의 유일한 방어다"* (같은 커밋)
  - 관련 plan: `plan/in-progress/spec-draft-eia-fanout-masking.md` (owner: project-planner, `status: draft`, 이 worktree 소속)
    - §1-b (`:55-56`): *"~~잔여 ②~~ 해소(2026-08-16): `inputData`/`outputData` — 아래 … 표면 목록에 두 컬럼이 포함됐다."*
    - §1-c (`:64-68`): *"`redactStoredDataForResponse`(`inputData`/`outputData`)를 읽기 표면 여섯 곳에 적용한다"*
    - 변경 3 (`:126-129`): *"body/params 의 자유 텍스트에 박힌 자격증명은 … 읽기 표면의 egress 값-마스킹([EIA §R17])이 담당한다"* — `inputData` 를 명시 배제하지 않음
  - 상세: 이 draft 는 `1b8fd5cc7`·`fe6a54c80` (inputData+outputData 둘 다 마스킹하던 **철회 이전** 구현)를 근거로 2026-08-16 커밋 `e5a63abff` 에서 작성됐다. 그 뒤 `b05756d9e` 가 "`inputData` 는 Re-run 재제출 경로에서 읽혀 그대로 재사용되는 값이라 마스킹하면 `'***'` 가 실제 입력이 된다"는 CRITICAL 데이터 무결성 결함(게이트 2건이 독립 검출)을 근거로 `inputData` 마스킹을 **철회**했고, `spec/5-system/14-external-interaction-api.md`·`12-webhook.md`·`eia-fanout-and-internal-data-masking.md`·`spec-sync-external-interaction-api-gaps.md` 를 동반 갱신했다. 그러나 같은 결정을 서술하는 **또 다른** plan 문서인 `spec-draft-eia-fanout-masking.md` 는 이 커밋에서 손대지 않아, 지금도 "`inputData`/`outputData` 둘 다 마스킹 대상" 이라는 **이미 폐기된 결정**을 여전히 유효한 것처럼 담고 있다. 이 draft 는 자기 자신을 *"구현이 만든 새 보안 불변식을 spec 에 등재하는 것"*(아직 spec 에 안 실렸다는 전제)이라고 규정하므로, 향후 누군가 이 문서를 그대로 집행하면 이미 target 이 바로잡은 CRITICAL 결함(Re-run 입력 오염)을 **다시** 만들어낼 수 있다. (직전 라운드 `23_49_05` 의 "draft ≈ 실제 diff" 판정은 `b05756d9e` **이전** 시점 기준으로는 참이었으나, 그 이후 target 만 갱신되고 draft 는 갱신되지 않아 지금은 거짓이다.)
  - 제안: `spec-draft-eia-fanout-masking.md` §1-b·§1-c·변경 3 을 `inputData` 비대상으로 정정한다(문구는 이미 실제 target 및 `eia-fanout-and-internal-data-masking.md` §철회 절에 있으므로 옮겨 적으면 된다). 이 draft 의 제안 내용은 이제 전부 target 에 반영·완료됐으므로, 정정 후 `status: draft` → 종료 상태로 바꾸고 `spec_impact` frontmatter 를 채워 `plan/complete/` 로 이동(또는 developer plan 의 §철회 절이 이미 같은 내용을 정본으로 담고 있으므로, 중복 근거를 없애기 위해 이 draft 를 삭제하고 사유를 commit message 에 남기는 것도 가능 — 다만 `worktree` 가 이미 배정돼 "미착수" 삭제 예외([plan-lifecycle §3](.claude/docs/plan-lifecycle.md#3-이동-규칙))에는 해당하지 않으므로 정정+이동을 권장).

## 대조 확인 (충돌 없음 — 근거만 남김)

- **미해결 결정 우회 여부**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(정본 트래커)는 §R17 잔여 항목을 ①·②·③으로 구분하고, target 은 ①·②만 flip 하고 ③(workflow-assistant LLM 도구, `****9876` 접미 힌트 vs `***` 우선순위 미결)은 "범위 밖 유지" 로 명시적으로 열어 둔 채 그대로 두었다 — 이 축은 이번 라운드에도 변함없이 정상.
- **`eia-fanout-and-internal-data-masking.md` 체크리스트 대 diff 정합**: 코드/spec 항목은 전부 `[x]`이며 철회 반영본(`b05756d9e`)까지 실제 diff 와 정합한다. 남은 미체크 2건(`--impl-done` 재실행 · push 게이트)은 본 검토가 그 단계이므로 정상.
- **선행 plan**: `plan/complete/eia-internal-rest-error-masking.md`(내부 REST `Execution.error` 마스킹 결정)는 이미 완료 상태이며 target 이 전제하는 선행 조건이 충족돼 있다. `spec-sync-websocket-protocol-gaps.md`·`ws-event-types-extract.md` 는 `nodeName`/`nodeLabel` 용어를 참조하지 않아 이번 4행 정정과 충돌 없음.
- **인입 참조**: `grep -rn "spec-draft-eia-fanout-masking" plan/ spec/` 결과 0건 — 다른 살아있는 문서가 이 draft 를 가리키고 있지 않으므로, 당장 이 stale 내용이 다른 문서로 전파될 경로는 없다(단, 문서 자체가 plan/in-progress/ 에 남아 있는 한 향후 턴이 직접 열어 집행할 위험은 남는다).

## 요약
Target(`b05756d9e` 포함 HEAD)은 자신이 명시한 정본 트래커의 열린 항목을 우회하지 않고, `inputData` 마스킹을 철회한 최신 결정을 spec·webhook 문서 양쪽에 정확히 반영했다. 다만 같은 결정을 별도로 서술하던 project-planner draft(`spec-draft-eia-fanout-masking.md`)는 이 철회 이전 시점(`e5a63abff`)에 멈춰 있어, 지금은 target 이 명시적으로 폐기한 "`inputData`도 마스킹" 문구를 여전히 유효한 미래 작업처럼 담고 있다. 코드·target spec 자체는 안전하지만, 이 stale draft 가 plan/in-progress/ 에 방치되면 향후 누군가 그대로 집행해 이번에 막 고친 Re-run 데이터 오염 CRITICAL 결함을 재도입할 위험이 있으므로 plan 갱신이 필요하다.

## 위험도
MEDIUM
