# Cross-Spec 일관성 검토 — spec-draft-waiting-surface-guard

- target: `plan/in-progress/spec-draft-waiting-surface-guard.md`
- 검토 모드: spec draft 검토 (--spec)
- 대조 대상: `spec/5-system/4-execution-engine.md` §7.5.1, `spec/5-system/14-external-interaction-api.md` §5.1/§6.2,
  `spec/4-nodes/6-presentation/0-common.md` §10.9, `spec/3-workflow-editor/3-execution.md` §9,
  `spec/conventions/interaction-type-registry.md` §1.1, 및 실제 구현 코드
  (`codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts`,
  `execution-engine.service.ts` `resolveWaitingNodeExecutionId`/`assertCommandMatchesWaitingSurface`,
  `resume-turn-dispatch.ts`)

## 검토 방법

1. 5개 target 절의 **현재 spec 본문**을 직접 읽어 draft 가 서술하는 "before" 상태(표 2행, L1041/L334/L412/L575-583 근방 문구)가 실제와 일치하는지 대조.
2. draft 가 서술하는 코드 동작(`resolveWaitingSurface`/`SURFACE_ALLOWED_COMMANDS`/`assertCommandMatchesWaitingSurface`/fail-closed 판정 불가 행 처리/`RESUME_CHECKPOINT_MISSING` 연계)을 실제 코드와 라인 단위로 대조.
3. draft 가 참조하는 요구사항 ID(`EIA-IN-13`)·에러 코드(`INVALID_EXECUTION_STATE`/`STATE_MISMATCH`/`INVALID_STATE`)가 다른 영역에서 다른 의미로 쓰이지 않는지 전역 grep.
4. `plan/in-progress/eia-command-waiting-surface-guard.md` 의 S-1 체크리스트 및 선행 `review/consistency/2026/07/11/01_35_17/cross_spec.md`(BLOCK:NO) 와 본 draft 의 범위 일치 여부 확인.

## 발견사항

- **[INFO]** 변경 1b 의 위치 인용(`L1041`)이 실제 인용 문구 위치와 어긋남
  - target 위치: draft `## 변경 1 — §7.5.1` → `### 1b`
  - 충돌 대상: `spec/5-system/4-execution-engine.md` L1041(§7.4 receiver 도입 문장) vs L1054(`resolveWaitingNodeExecutionId` 는 invalid lookup (0건 / 다중 row) 시 … 블록쿼트)
  - 상세: draft 는 "0건 또는 다중 row … nodeId 미일치" 문구를 L1041 근방에 있다고 서술하지만, 그 문구가 실제로 근접하게 등장하는 곳은 L1054 의 블록쿼트다(L1041 은 receiver 단계를 소개하는 다른 문장). 값 자체의 모순은 아니고 순수 위치 인용 오차이지만, project-planner 가 draft 를 그대로 라인 번호로 실행하면 잘못된 자리에 "또는 대기 표면과 명령 불일치" 를 삽입하거나 중복 문구를 만들 위험이 있다. 다른 4개 위치(§7.5.1 표=L1043-1046, EIA §6.2 note=L575-583, Presentation §10.9=L412, workflow-editor §9=L334)의 라인 인용은 모두 실측과 정확히 일치했다 — 이 항목만 예외.
  - 제안: project-planner 가 실제 적용 시 라인 번호 대신 인용 문구("0건 또는 다중 row" 또는 L1054 블록쿼트 원문)로 삽입 위치를 재확인. 내용 자체(0건/다중 row/표면 불일치 3분류)는 코드(`resolveWaitingNodeExecutionId` 주석, execution-engine.service.ts:5170-5175)와 정확히 일치하므로 서술 내용은 그대로 채택 가능.

- **[INFO]** draft 범위가 plan S-1 체크리스트와 정확히 일치 — `spec/data-flow/15-external-interaction.md` §1.2 는 의도적으로 제외됨
  - target 위치: draft 전체(변경 1~5)
  - 충돌 대상: `spec/data-flow/15-external-interaction.md` L95 (`waiting_for_input 아니면 409 STATE_MISMATCH` 시퀀스 다이어그램 주석)
  - 상세: 선행 리뷰(`review/consistency/2026/07/11/01_35_17/cross_spec.md`)는 이 문서를 "완전성을 높이는 옵션 추가" 로 명시하며 "plan 목록에 없는 항목이라 별도 추가 권장, 차단 사유는 아님" 이라 결론 냈고, 실제 `plan/in-progress/eia-command-waiting-surface-guard.md` 의 S-1 체크리스트도 5항목(§7.5.1/EIA §5.1·§6.2/§10.9/§9/registry cross-ref)만 등재하고 data-flow §1.2 는 포함하지 않는다. 본 draft 는 그 5항목을 정확히 커버해 **plan 체크리스트와 완전히 일치**한다 — 누락이 아니라 의도된 범위. 다만 이 draft 가 반영되면 5개 문서는 "표면 불일치도 waiting_for_input 유지 중에 거부될 수 있다" 는 3번째 케이스를 명시하는 반면, data-flow §1.2 는 여전히 "waiting_for_input 아니면 409" 라는 이분법적 문구만 남아 상대적으로 더 뒤처지게 된다(코드와 모순은 아니고 여전히 비완전 열거 수준).
  - 제안: 이번 draft 범위를 넓힐 필요는 없음(S-1 완결). 다만 project-planner 가 이 draft 적용 후 data-flow §1.2 보강을 별도 후속 항목(비차단)으로 등재할지 결정하면 완전성이 높아진다 — 새로 발견된 문제가 아니라 기존에 이미 non-blocking 으로 분류된 항목의 잔존 확인.

## 교차 검증 결과 (충돌 없음 확인)

- **§7.5.1 표 3행 추가**: 현재 표는 실측 2행(L1043-1046)이며 draft 가 서술한 "before" 와 정확히 일치. 추가되는 3번째 케이스("표면 불일치 → `INVALID_EXECUTION_STATE`")는 `assertCommandMatchesWaitingSurface`(execution-engine.service.ts:5273-5303)가 `InvalidExecutionStateError` 를 throw 하는 코드와 100% 일치 — 응답 코드·거부 대상 모두 모순 없음.
- **`form`=`submit_form`만 / `buttons`=`click_button`만 / `ai_conversation`·`ai_form_render`=4종 허용**: `SURFACE_ALLOWED_COMMANDS`(waiting-surface-guard.ts:42-53) 와 정확히 일치.
- **fail-closed(표면 판정 불가 행 거부)**: `assertCommandMatchesWaitingSurface` 의 `if (!surface) throw ...` 분기(L5287-5294)와 draft 1a/1c 서술이 정확히 일치. "form 은 정적 metadata 로 항상 판정되므로 여기 도달 안 함" 문구도 코드 주석(L5264-5266)과 동일.
- **EIA §5.1 `STATE_MISMATCH` 행**: 실측 L341 텍스트 "(예: completed 상태에서 submit_message, 또는 다른 nodeId)" 와 draft 의 before/after 서술이 정확히 일치. `EIA-IN-13`(L83, 필수)이 이미 이 동작을 약속했다는 draft 주장도 실제 요구사항 표와 일치하며, 해당 ID 는 spec 전역에서 유일하게 이 자리에서만 정의됨(다른 영역에서 재사용/충돌 없음).
- **EIA §6.2 `expectedCommands`**: 실측 L560-563 payload 예시(`["submit_form"]` / `["click_button"]` / `["submit_message","end_conversation"]`)가 draft 의 "권장 명령만 나열, ai_conversation 은 서버가 4종 모두 수용" 서술과 모순 없이 정합. 코드 전역 grep 결과 `expectedCommands` 필드는 어디에도 구현돼 있지 않아 draft 의 "(현재 미구현 문서 필드)" 각주도 정확.
- **Presentation §10.9 L412**: 실측 문단이 "AI conversation 내 `button_click` 미도달 invariant" 를 다루며, draft 가 추가하려는 "buttons 대기 중 비-`button_click` 은 publisher 단계에서 거부" 문장은 반대 방향(표면=buttons)의 대칭 서술로 겹치지 않음. `resolveButtonInteraction` 함수명·"(d) fallback" 표현은 `button-interaction.service.ts` 실제 함수명과 waiting-surface-guard.ts 코드 주석(L32) 문구를 그대로 재현 — 모순 없음.
- **workflow-editor §9 (L334)**: `POST /api/executions/:id/continue` 실측 문구와 draft 의 "before" 가 일치. 코드 확인 결과 `executions.controller.ts` → `continueExecution` 은 항상 `expectedCommand='form_submitted'` 로 `resolveWaitingNodeExecutionId` 를 호출(execution-engine.service.ts:4620-4630)하므로 "Form 표면이 아니면 422" 라는 draft 의 신규 서술이 실제 REST 엔드포인트 동작과 정확히 일치.
- **interaction-type-registry.md §1.1**: 실측 "내부 4값 ↔ EIA 외부 3값 매핑" note 와 draft 의 추가 cross-ref 가 충돌 없이 병존. `resolveWaitingSurface`(waiting-surface-guard.ts:79-91)가 `ai_form_render` 를 `ai_conversation` 으로 흡수하는 동작이 registry 가 이미 선언한 4→3 통합 정책의 실제 소비처라는 draft 주장도 코드와 일치.
- **RBAC/데이터 모델/상태 전이/계층 책임**: 5개 변경 모두 새 엔티티·필드·엔드포인트·상태값을 도입하지 않으며, `NodeExecution.status='waiting_for_input'` 은 거부 시에도 그대로 보존된다(요청이 publish 전에 거부되므로 상태 전이 자체가 발생하지 않음) — 기존 §1.1 Execution/NodeExecution 상태 머신과 상충 없음. publisher(controller/WS gateway/EIA `interaction.service`) 계층이 사전 검증을 담당한다는 책임 분할도 §7.4/§7.5.1 기존 서술과 동일선상.
- **다른 문서로의 파급 확인**: `spec/5-system/6-websocket-protocol.md` §4.2(`INVALID_EXECUTION_STATE` 설명), `spec/5-system/3-error-handling.md`(`INVALID_STATE`/`STATE_MISMATCH` cross-ref), `spec/data-flow/3-execution.md` 는 모두 "기대 상태가 아님" 수준의 일반화된 서술만 가지고 있어 draft 의 3번째 케이스 추가와 상충하지 않는다(값의 모순이 아니라 이미 비완전 열거로 설계됨 — 별도 갱신 불요, 선행 리뷰와 동일 결론).

## 요약

draft 는 이미 BLOCK:NO 로 검증된 구현(`waiting-surface-guard.ts` + `assertCommandMatchesWaitingSurface`)을 대상 5개 spec 절에 반영하는 순수 "열거 완결화" 작업이며, 직접 코드·spec 실측 대조 결과 draft 가 서술하는 "before"/"after" 텍스트가 실제 파일 상태·코드 동작과 라인 단위로 정확히 일치한다. 새 요구사항 ID·에러 코드·엔티티·상태값을 도입하지 않고 기존 `EIA-IN-13`/`INVALID_EXECUTION_STATE`/`STATE_MISMATCH`/`INVALID_STATE` 매핑만 재사용하므로 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 실질 충돌이 발견되지 않았다. 유일한 지적 사항은 (1) 변경 1b 의 라인 인용이 실제 인용 문구 위치(L1054)와 다른 편집 위치(L1041)를 가리키는 사소한 정밀도 문제, (2) 선행 리뷰가 이미 non-blocking 으로 분류한 `data-flow/15-external-interaction.md` §1.2 보강이 이번 draft 범위 밖으로 남아있다는 점(계획된 배제, plan S-1 과 정확히 일치)이며 둘 다 CRITICAL/WARNING 급이 아니다.

## 위험도

NONE
