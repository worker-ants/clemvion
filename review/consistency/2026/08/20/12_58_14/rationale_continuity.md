### 발견사항

- **[CRITICAL] `status: implemented` 5개 문서가 아직 구현되지 않은 마스킹/가드를 "이미 완료" 로 단정 — `spec-impl-evidence.md` §R-5 invariant 위반**
  - target 위치:
    - `spec/1-data-model.md:471` (`Execution.input_data` — "**응답·emit 시 자격증명 값-패턴 마스킹**"), `:550` (`NodeExecution.input_data` — "상위와 **같은 규칙**")
    - `spec/5-system/12-webhook.md` §5.3 caveat — "**2026-08-20 부터** 그 갭을 덮는 후속 층이 생겼다 — `inputData` 도 … egress 값-마스킹 대상이다"
    - `spec/4-nodes/1-logic/12-background.md:246` — "여기 `inputData` 는 마스킹 대상이다 … **지금은 두 레벨 모두** 마스킹한다"
    - `spec/5-system/13-replay-rerun.md` §10.2 caveat — "**전환 (2026-08-20)**: 프리필 값이 마스킹 마커면 프리필하지 않고 … **그 필드가 비어 있는 동안 Re-run 제출을 막는다**"
    - `spec/3-workflow-editor/3-execution.md` §2.2 기능표 — "히스토리 로드 | **구현** | … 마스킹 마커(`***` 등)가 남아 있으면 Run 이 비활성된다 …"
    - 그리고 이 다섯 문서를 갈무리하는 `spec/5-system/14-external-interaction-api.md` §R17 잔여② — "**닫는 조건은 충족됐다 (2026-08-20)**" + 비교표 "`Execution.inputData` (REST) | **함** (2026-08-20~)"
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md` `## Rationale > ### R-5. status: partial 의 pending_plans: 의무화`(및 본문 `## 3. status 라이프사이클` 표 — `implemented` = *"모든 약속 구현 완료"*, `partial` = *"일부 구현됨 → pending_plans 의무"*). 같은 번들 안에서 `spec/5-system/6-websocket-protocol.md` 가 이 규약을 정확히 쓰고 있다 — 아직 안 된 서버발신 ping/`auth.token_expired` 를 "**미구현 (Planned)**" 으로 명시하고 `status: partial` + `pending_plans:` 로 추적한다. target 의 다섯 문서는 같은 패턴을 적용하지 않았다.
  - 상세: 이번 커밋(`7da315c10`, `docs(spec): …`)은 **spec 만** 바꾸는 planner 턴 단독 커밋이다 — `codebase/` diff 가 0줄이고, 커밋 메시지 자체가 *"`MASKED_INPUT_DATA_REASON` 인용 삭제(§10.2) — **developer 턴이** 코드 6곳을 전수 삭제한다"* 라고 **구현이 아직 안 됐음을 스스로 인정**한다. 실측으로 확인했다:
    - `codebase/backend/src/modules/executions/executions.service.ts:1044-1045` — `toExecutionDto` 는 여전히 `inputData: execution.inputData ?? null` (마스킹 미적용) 이고 바로 위 주석이 *"`inputData` 는 의도적으로 마스킹하지 않는다 — `{@link MASKED_INPUT_DATA_REASON}`"* 다.
    - `toResponseExecution`(§R17 이 "표면 6곳" 의 공유 관문으로 지목한 바로 그 함수, `:1108-1114`) 도 `outputData`/`error` 만 마스킹하고 `inputData` 는 명시적으로 **제외**한다 (`MASKED_INPUT_DATA_REASON` 상수·주석 그대로 존재).
    - `codebase/frontend/src/components/executions/rerun-modal.tsx` — `isMaskedMarker` 등 마커 감지 로직이 코드에 없다. 프리필은 여전히 무조건 `extractParameters(original.inputData)` 이고 제출 차단 로직도 없다.
    - `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — 히스토리 로드 경로에도 마커 감지·Run 비활성 로직이 없다.
    - developer 소유 plan `plan/in-progress/eia-inputdata-marker-guard.md` 의 `## 범위` 체크리스트 자신도 "Re-run 모달 마커 가드", "에디터 히스토리 로드 마커 가드", "backend — egress 마스킹으로 전환" 을 전부 **`[ ]` 미완료**로 정직하게 적어 두고 있다 — 즉 이 사실은 이미 저장소 안에 알려져 있는데, 5개 spec 파일의 frontmatter/본문 라벨에는 반영되지 않았다.
    즉 target 5개 문서는 `status: implemented`(약속=구현 완료를 뜻하는 값) 를 유지한 채, 아직 코드에 없는 동작을 현재형·완료형("한다"/"막는다"/"충족됐다"/"구현")으로 서술한다. 이는 `spec-impl-evidence.md` 가 정확히 막으려 한 문제(§37줄 *"spec 가 약속한 surface 가 지금 구현됐는가 는 어떤 검사도 묻지 않음"*)를 그대로 재현한다 — 다만 자동 가드(`spec-status-lifecycle.test.ts`)는 `status: partial` 문서의 `pending_plans` 존재 여부만 검사하므로 `status: implemented` 문서가 사실과 다른 이 케이스는 **가드가 잡지 못한다**. 사용자 메모리에 기록된 반복 실패 패턴("문서한 보장이 구현보다 넓으면 안 된다" — 이 저장소에서 이미 3회 반증됨)과 형태가 같다: 독자가 이 spec 만 읽으면 `Execution.inputData` egress 마스킹·Re-run 제출 차단이 **이미 라이브**라고 오판해, 이 PR 이 원래 막으려던 "마스킹 마커가 실제 입력으로 재제출되는" 위험이 아직 열려 있다는 사실을 놓칠 수 있다.
  - 제안: 코드가 실제로 병합되기 전까지 다섯 문서(`1-data-model.md`·`12-webhook.md`·`4-nodes/1-logic/12-background.md`·`13-replay-rerun.md`·`3-workflow-editor/3-execution.md`) 중 이 변경을 반영한 부분에 한해 (a) `status: partial` + `pending_plans: [plan/in-progress/eia-inputdata-marker-guard.md]` 로 전환하거나, (b) `6-websocket-protocol.md` 의 기존 관행대로 새 문장에 "(2026-08-20, **미구현·Planned** — `eia-inputdata-marker-guard.md` 참조)" 캐비엇을 명시적으로 붙인다. `14-external-interaction-api.md` §R17 의 "닫는 조건은 충족됐다" 도 동일하게 "충족될 예정(가드 3종 중 폼 프리필만 기 구현, 나머지 둘은 `eia-inputdata-marker-guard.md` 진행 중)" 으로 조건부화하고, `pending_plans:` 목록에도 해당 plan 을 추가한다. developer 턴이 실제 코드를 병합하는 커밋에서 다시 현재형으로 되돌리면(그 시점엔 사실과 일치하므로) 정상이다.

- **[INFO] `spec-sync-external-interaction-api-gaps.md` 의 `inputData` 카브아웃 항목이 이번 결정 번복을 반영하지 않아 stale**
  - target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]`
  - 과거 결정 출처: 해당 tracker 파일 L281-301 ("`inputData` egress 마스킹 — 프런트 마커 가드가 선행돼야 한다", "카브아웃은 `Execution` 레벨 한정이다")
  - 상세: 이 tracker 는 여전히 "카브아웃이 살아있다" 는 옛 서술(캐너리 표 포함)을 그대로 갖고 있어, target 의 새 §R17 서술("잔여② 해소")과 같은 순간에 모순된다. 다만 developer plan(`eia-inputdata-marker-guard.md`) 자신의 체크리스트 마지막 항목이 "트래커 항목 종결" 로 이미 이를 인지·계획하고 있어 실질 리스크는 낮다.
  - 제안: 코드 구현이 끝나는 시점에 이 tracker 항목에 취소선(해당 저장소 관행)을 긋고 "해소(날짜)" 로 갱신.

### 요약
target 은 `Execution.inputData` egress 마스킹 카브아웃을 폐지하는 결정이며, §R17 이 스스로 예약해 둔 "닫는 조건"(마커 가드 선행)의 충족을 근거로 삼고 기각 이력·2축 판단 기준 재정의·6개 문서 미러까지 상세히 새 Rationale 을 갖춰 작성됐다 — 이전 라운드(`12_41_29`)가 지적한 "판단 기준 문단 누락"·"Re-run 모달 강제 문언 미충족" 두 WARNING 은 이번 커밋에서 실측 확인상 모두 해소됐다(§R17 "두 사례가 정확히 그 두 갈래다" 문장이 2축 재정의로 교체됐고, Re-run 모달은 "비어 있는 동안 제출을 막는다" 로 강화됨). 다만 이 커밋은 **spec-only 커밋**(코드 diff 0)인데도 다섯 위성 문서(`1-data-model.md`·`12-webhook.md`·`4-nodes/1-logic/12-background.md`·`13-replay-rerun.md`·`3-workflow-editor/3-execution.md`)가 `status: implemented` 를 유지한 채 아직 코드에 없는 마스킹·가드 동작을 현재형으로 단정한다 — 커밋 메시지 스스로 "developer 턴이 코드를 나중에 삭제/구현한다" 고 적어 이 갭을 알고 있음에도, `spec/conventions/spec-impl-evidence.md` §R-5 가 요구하는 `partial`+`pending_plans`(또는 같은 번들의 `6-websocket-protocol.md` 가 실제로 쓰는 "(Planned)" 표기) 를 어느 문서에도 적용하지 않았다. 이는 결정 자체의 정당성 문제가 아니라, "spec 이 약속한 surface 가 지금 구현됐는가" 를 자동 가드가 놓치는 정확히 그 사각지대이자 이 저장소가 이미 반복 경험한 실패 패턴(문서한 보장이 구현보다 넓다)이라 명시적으로 표시해 둘 가치가 크다.

### 위험도
HIGH
