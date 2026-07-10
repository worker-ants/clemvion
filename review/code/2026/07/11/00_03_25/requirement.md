# 요구사항(Requirement) 리뷰 — EIA/WS continuation 명령 ↔ 대기 노드 표면 매트릭스 가드

대상: `plan/in-progress/eia-command-waiting-surface-guard.md` 구현분(파일 1~9). 파일 10~17(plan·consistency-check 산출물)은 impl-prep 단계의 사전 검토 기록으로, 본 리뷰의 1차 대상이 아니라 spec-sync 잔여 항목 확인용 참고 컨텍스트로만 사용했다.

## 핵심 질문에 대한 결론 (먼저 요약)

- **AI 표면 4종 허용이 §10.9 graceful re-park invariant + render_form(form_submitted) 응답을 보존하는가 — 예, 보존한다.** `spec/4-nodes/6-presentation/0-common.md` §10.9 를 직접 읽어 확인: `processAiResumeTurn` dispatch 표(라인 396-412)가 이미 `ai_end_conversation`/`ai_message`/`form_submitted` 3케이스를 정상 처리로, `button_click` 미도달을 "도달 시 `else` 분기 graceful degradation" invariant 로 명시하고 있다. `waiting-surface-guard.ts` 의 `SURFACE_ALLOWED_COMMANDS.ai_conversation = [4종 전부]` 는 이 기존 계약을 정확히 반영한다 — 새로 넓힌 게 아니라 기존에 이미 통과하던 범위를 그대로 유지한 것.
- **form/buttons 엄격화가 깨뜨리는 정상 시나리오는 없는 것으로 확인됨.**
  - **chat-channel multi_step form**: `spec/conventions/chat-channel-adapter.md` §4.2 를 확인한 결과, 다단계 시퀀스는 필드별 응답을 `hooks.service.ts` 의 `handleFormStep`(중간 필드는 EIA 호출 자체를 안 하고 버퍼링, 마지막 필드에서만 `submit_form` 호출)이 처리한다 — `forwardToInteractionService`(generic `text_message→submit_message` 매핑, 신규 게이트 적용 대상)와는 **다른 코드 경로**(`hooks.service.ts:607-613` 의 `state?.formState` 분기)라 다단계 폼 정상 흐름은 신규 게이트의 영향을 받지 않는다. `handleFormStep` 자체도 기존에 이미 자체 try/catch(라인 857-888)를 가지고 있어 회귀 위험이 낮다.
  - **web-chat 위젯**: `spec/7-channel-web-chat/1-widget-app.md` R7(라인 168)을 확인 — 위젯은 이미 "명령이 실패/거부(410 Gone·**409 STATE_MISMATCH**·네트워크)해도 로컬은 이미 종료 상태를 유지한다"고 명시해, 이번에 신설되는 409 응답을 **사전에 예상하고 설계**돼 있다. 또한 위젯은 대기 표면이 `ai_conversation`+nodeId 확정일 때만 `end_conversation`, 그 외는 `cancel`(표면 무관, 게이트 대상 아님)을 쓰므로 정상 사용에서 신규 게이트에 걸릴 일이 없다.
  - **에디터 UI**: `POST /executions/:id/continue` 는 form 전용(body `{formData?}`)이고, 신규 게이트는 buttons/ai 대기 노드에 대한 오발행만 막는다 — 에디터의 정상 form 제출 흐름(대기 노드=form)은 영향 없음.
- 따라서 4개 spec 문서(EIA-IN-13/§5.1, 4-execution-engine §7.5.1/§7.5.2, 0-common §10.9, ai-agent §6.2 step 2.c)와 `interaction-type-registry.md` 의 실제 본문을 대조한 결과 **핵심 설계는 spec 과 line-level 로 정합**한다. 다만 spec 문서 자체의 갱신(§7.5.1 표 3번째 행 등)은 plan 에 이미 "project-planner 위임" 으로 명시적으로 미룬 상태이며 아직 반영되지 않았다 — 아래 SPEC-DRIFT 항목 참조.

## 발견사항

- **[WARNING] `hooks.service.ts` 신규 warn 로그가 실제로는 진단 정보를 담지 못한다 (NestJS `ConflictException` 객체 body 의 `.message` 는 고정 제네릭 문자열)**
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `forwardToInteractionService` 의 신규 catch 블록 (diff 라인 ~1377-1385, `` `...거부됨 (execution=${executionId} trigger=${trigger.id}): ${err.message}` ``)
  - 상세: `interactionService.interact()` 가 표면 불일치 시 던지는 예외는 `interaction.service.ts:415-417` 의 `new ConflictException({ error: { code: 'STATE_MISMATCH', message: err.message } })` — **객체를 response body 로 넘기는 형태**다. NestJS 의 `HttpException`은 이 경우 `.message` 를 그 객체가 아니라 고정 문자열 `"Conflict Exception"` 으로 설정한다 (실제 상세는 `.getResponse().error.message` 에만 있음). 직접 검증:
    ```
    $ node -e "const {ConflictException}=require('@nestjs/common'); const e=new ConflictException({error:{code:'STATE_MISMATCH',message:'surface mismatch'}}); console.log(e.message)"
    Conflict Exception
    ```
    즉 프로덕션에서 이 catch 가 발동할 때마다 로그는 항상 `...: Conflict Exception` 으로 찍히고, "왜"(예: "form 대기 중 end_conversation") 라는 실제 진단 정보는 유실된다. 이는 이 warn 로그가 존재하는 이유(§10.9 "silent skip 금지" 원칙 + `/consistency-check --impl-prep` rationale_continuity WARNING "graceful catch 는 로그 없이 완전 silent 하면 안 됨" 반영)를 부분적으로만 충족한다 — 로그 라인 자체는 있으나(완전 silent 아님) 값어치가 낮다.
  - 신규 unit 테스트(`hooks.service.spec.ts` "표면 불일치(409 STATE_MISMATCH) forwarding 은 warn 후 삼킴")도 `expect.stringContaining('현재 대기 표면과 맞지 않아 거부됨')` 만 검증해 이 문제를 잡지 못한다.
  - 제안: `err instanceof ConflictException` 분기에서 `err.getResponse()` 를 통해 구조화된 `error.message`/`error.code` 를 추출해 로그에 싣는다 (예: `(err.getResponse() as { error？: { message?: string } })?.error?.message ?? err.message`).

- **[WARNING] `assertCommandMatchesWaitingSurface` JSDoc 이 `dispatchResumeTurn` 과의 "완전 미러링"을 주장하지만 실제로는 `ai_conversation` 분기의 두 추가 조건을 재현하지 않는다**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 신규 `assertCommandMatchesWaitingSurface` JSDoc ("표면 판정은 `dispatchResumeTurn` / `dispatchParkEntry` 의 selects 술어를 그대로 미러링한다") vs 실제 `resumeTurnRegistry` 정의 (같은 파일 라인 1876-1888)
  - 상세: `resumeTurnRegistry` 의 `ai_conversation` 엔트리는 `sel.isAiConversation && sel.hasResumeCheckpoint && this.isCheckpointEligibleNodeType(sel.node.type)` 세 조건의 AND 다. 반면 `waiting-surface-guard.ts` 의 `resolveWaitingSurface` 는 `interactionType === 'ai_conversation' | 'ai_form_render'` 한 조건만 본다 — `hasResumeCheckpoint`(영속 `_resumeCheckpoint` 존재 여부)와 `isCheckpointEligibleNodeType`(`node.type ∈ {ai_agent, information_extractor}`)는 재현하지 않는다. 실제로는 `buildParkEntryRegistry` 의 (더 단순한) selects 와만 정확히 일치하고, 신규 `waiting-surface-guard.spec.ts` 의 "registry 대칭" 테스트(불변식 (1))도 **`buildParkEntryRegistry` 만** 대조하며 `resumeTurnRegistry` 와는 대조하지 않는다.
  - 실제 리스크는 낮다 — `outputData.meta.interactionType='ai_conversation'` 을 영속하는 노드는 `waitForAiConversation`(체크포인트 저장이 항상 동반)을 거친 checkpoint-eligible 노드 타입뿐이므로, 현재 코드베이스에서 이 세 조건이 어긋나는 실제 경로는 없어 보인다. 또한 설령 어긋나더라도 `dispatchResumeTurn` 자체가 fail-closed(`RESUME_CHECKPOINT_MISSING`)라 데이터가 잘못 처리되지는 않는다 — 다만 신규 게이트가 "predict exactly what worker will do" 라는 자기 주장(및 §7.5.1 dispatch 예측 정확성이라는 설계 목적)을 완전히 지키지 못하는 지점이다.
  - 제안: JSDoc 을 `dispatchParkEntry`(정확히 미러링)로 한정하거나, `resumeTurnRegistry` 의 `ai_conversation` selects 대칭 테스트를 추가(서비스 인스턴스 바인딩이 필요하면 `isCheckpointEligibleNodeType`/`hasResumeCheckpoint` 를 주입 가능한 형태로 분리)해 주장을 코드로 뒷받침할 것.

- **[SPEC-DRIFT][WARNING] `spec/5-system/4-execution-engine.md §7.5.1` 표·`spec/5-system/14-external-interaction-api.md §5.1` STATE_MISMATCH 행이 신규 3번째 거부 케이스를 아직 반영하지 않음**
  - 위치: `spec/5-system/4-execution-engine.md:1043-1046`(§7.5.1 표 — "매칭 row 0건" / "동일 매칭 row 2건 이상" 2-case 만 존재), `spec/5-system/14-external-interaction-api.md:341`(§5.1 `409 STATE_MISMATCH` 행 — 예시가 "completed 상태에서 submit_message, 또는 다른 nodeId" 뿐, interactionType 불일치 예시 없음)
  - 상세: 실제로 구현된 코드(`assertCommandMatchesWaitingSurface`)는 (a) 표면 판정 불가, (b) 표면-명령 불일치 두 신규 거부 사유를 `INVALID_EXECUTION_STATE`/`STATE_MISMATCH` 로 표기하지만, 위 두 spec 문서 어디에도 아직 열거되지 않는다. 이는 코드 버그가 아니다 — `plan/in-progress/eia-command-waiting-surface-guard.md` 의 "spec 동기 (project-planner 위임 대상)" 절이 정확히 이 세 위치(§7.5.1, EIA §5.1, `0-common.md §10.9`)를 갱신 대상으로 이미 못박아 두었고, `--impl-done` 이전 체크리스트 항목("spec 동기")이 아직 미완(`[ ]`)으로 정직하게 표시돼 있다. 즉 **의도된, 이미 추적 중인 갭**이며 코드가 spec 을 앞서간 정상적인 SPEC-DRIFT 상태다.
  - 제안: 코드 변경 불필요. `project-planner` 가 (1) `4-execution-engine.md §7.5.1` 표에 "표면(interactionType) 불일치" 행 추가 + `## Rationale` 신설(왜 form/buttons 엄격·ai 관대·fail-closed 인지), (2) `14-external-interaction-api.md §5.1` STATE_MISMATCH 예시에 표면 불일치 케이스 추가, (3) `0-common.md §10.9` 에 "buttons 대기 중 비-`button_click` 은 이제 publisher 단계에서 거부되며 `resolveButtonInteraction` (d) fallback 은 도달 불가"를 명시 — 이 세 가지를 plan 체크리스트대로 마무리할 것. (plan 은 `3-workflow-editor/3-execution.md §9` `/continue` 422 조건 확장 서술도 함께 목록화해 뒀다.)

- **[WARNING] plan 의 F-2 후속 항목 범위가 실제 코드 동작보다 좁다 — buttons 표면 무응답 UX 갭이 추적되지 않음**
  - 위치: `plan/in-progress/eia-command-waiting-surface-guard.md` "F-2. 채팅 채널 native form modal 대기 중 텍스트 입력의 graceful 안내" (제목·본문 모두 "form" 만 언급)
  - 상세: `hooks.service.ts` 의 신규 graceful catch 는 `forwardToInteractionService` 를 지나는 **모든** 표면 불일치를 동일하게 삼킨다 — form 대기 중 자유 텍스트뿐 아니라 **buttons(carousel/table/chart/template) 대기 중 자유 텍스트/`button_callback` 외 명령**도 동일 경로로 409 → warn-only 삼킴이 된다. 개선 전(이 PR 이전)엔 buttons 대기 중 비-버튼 명령이 `resolveButtonInteraction` (d) fallback 으로 **엉뚱한 `continue` 포트로 조용히 분기**됐고(데이터 무결성 버그), 개선 후엔 **완전히 무시**된다(무결성은 지켜지나 사용자에게 피드백 없음) — form 사례와 완전히 동형의 UX 클래스인데, F-2 는 오직 form 만 명시해 buttons 케이스가 어떤 plan/spec 에도 등재되지 않는다. (impl-prep 단계 `cross_spec.md` 발견사항 #3/#5 가 이미 이 buttons 클래스를 지적했으나, 구현된 plan 의 후속 항목에는 반영되지 않았다.)
  - 제안: F-2 제목/본문을 "form/buttons 대기 중 표면 불일치 입력의 graceful 안내"로 넓히거나 별도 F-3 항목을 신설해, 향후 착수 시 buttons 케이스도 함께 다루도록 명시할 것. 지금 이 PR 을 막을 사유는 아님(F-2 자체가 "본 PR 범위 밖" 후속으로 이미 defer 됨).

- **[INFO] `err instanceof ConflictException` 로 넓게 catch — 현재는 안전하나 결합이 느슨함**
  - 위치: `hooks.service.ts` 신규 catch 블록
  - 상세: in-process trusted 호출 경로(`scope: 'in_process_trusted'`)는 `IDEMPOTENCY_KEY_CONFLICT`(HTTP 인터셉터 전용, `idempotency.interceptor.ts`)를 절대 거치지 않으므로, 현재 `interactionService.interact()` 가 이 경로에서 던지는 `ConflictException` 은 실질적으로 언제나 `STATE_MISMATCH` 다 — 오늘은 버그 아님. 다만 클래스 기반 catch 라 향후 `interact()` 에 다른 사유의 `ConflictException` 이 추가되면 의도치 않게 함께 삼켜질 수 있다.
  - 제안: 필수는 아니나, `err.getResponse()?.error?.code === 'STATE_MISMATCH'` 로 좁히면 (위 첫 WARNING 의 수정과 자연스럽게 합쳐져) 더 안전.

## 검증한 정합성 (발견 아님, 참고)

- `SURFACE_ALLOWED_COMMANDS`(form=submit_form 만 / buttons=click_button 만 / ai_conversation=4종)는 `spec/4-nodes/6-presentation/0-common.md §10.9` dispatch 표·"button_click 미도달 invariant" 문구와 line-level 로 일치.
- `resolveWaitingSurface` 의 `blockingInteraction==='form'` 우선순위·`buttons`/`ai_conversation`/`ai_form_render` 판정은 `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts` 의 `buildParkEntryRegistry` selects 와 실제로 동일 — 신규 unit 테스트가 이 대칭을 코드로 검증한다.
- `waitForButtonInteraction`(`button-interaction.service.ts:381-399`) 확인 결과 `nodeExec.outputData` 의 `meta.interactionType='buttons'` 기록과 상태 `WAITING_FOR_INPUT` 전이가 **같은 트랜잭션**(`updateExecutionStatus`)으로 원자적이라, "표면 판정 불가(outputData null)인데 실제로는 buttons 대기 중" 인 race 는 없다.
- 4종 continuation 메서드(`continueExecution`/`continueButtonClick`/`continueAiConversation`/`endAiConversation`) 모두 정확한 `expectedCommand` 리터럴로 `resolveWaitingNodeExecutionId` 를 호출하며, 이 함수가 WS gateway/REST `/continue`/EIA 세 진입점 전부에서 재사용되므로 "동일 chokepoint → 자동 정합" 주장은 실제 호출 그래프(`grep`)로 확인됨.
- `resolveWaitingNodeExecutionId` 의 새 파라미터가 필수(`expectedCommand: WaitingSurfaceCommand`)로 바뀌었음에도 호출부 4곳 전부가 diff 안에서 갱신돼 orphan 호출 없음(빌드 통과와 일치).
- e2e 테스트(`execution-park-resume.e2e-spec.ts`)는 실제 HTTP 계층(409 STATE_MISMATCH·client-safe 메시지·waiting 유지·후속 정상 재개)까지 검증해 unit 레벨 mock 만으로 발생 가능한 오탐 위험을 낮춘다.
- TODO/FIXME/HACK/XXX 등 미완성 마커는 신규 코드에 없음(F-1/F-2 는 inline TODO 가 아니라 plan 문서에 정식 등재).

## 요약

핵심 요구사항(대기 노드 표면과 도착 명령이 어긋나면 publish 전에 동기 거부하고 execution 을 waiting 으로 보존)은 정확히 구현됐고, 가장 우려되는 지점이었던 "AI 표면 4종 허용이 §10.9/render_form 계약을 깨뜨리지 않는가"·"form/buttons 엄격화가 chat-channel 다단계 폼/웹챗 위젯/에디터의 정상 흐름을 깨뜨리는가"는 spec 본문·코드 호출 그래프를 직접 대조해 **깨뜨리지 않음을 확인**했다. 다만 (1) 신규 warn 로그가 NestJS `ConflictException` 객체 body 의 `.message` 를 잘못 읽어 실제로는 진단 정보를 못 싣는 구현 결함, (2) `assertCommandMatchesWaitingSurface` 의 "resumeTurnRegistry 완전 미러링" 주장이 `ai_conversation` 분기에서 부분적으로만 맞고 테스트도 그 갭을 검증하지 않는 점, (3) `spec/5-system/4-execution-engine.md §7.5.1`/`14-external-interaction-api.md §5.1` 이 아직 신규 3번째 거부 케이스를 반영하지 않은 SPEC-DRIFT(단, plan 에 이미 project-planner 위임으로 정직하게 추적 중), (4) buttons 표면의 동형 UX 갭이 F-2 후속 항목 범위에서 누락된 점을 발견했다. 모두 병합을 막을 CRITICAL 은 아니지만, (1)은 실제 기능 결함이라 코드 수정을, (3)은 plan 체크리스트가 이미 요구하는 project-planner spec 동기화를, (2)(4)는 문서/테스트 보강을 권고한다.

## 위험도

MEDIUM — CRITICAL 없음. 핵심 매트릭스 로직·spec 정합은 검증됨. WARNING 4건 중 1건(warn 로그 진단정보 유실)은 실제 코드 결함으로 수정 권고, 1건(spec 3번째 케이스 미반영)은 이미 plan 에 추적 중인 SPEC-DRIFT, 나머지 2건은 테스트/문서 보강 성격.
