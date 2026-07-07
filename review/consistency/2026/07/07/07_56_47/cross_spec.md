### 발견사항

없음.

target 작업(`spec/5-system/4-execution-engine.md §4.4` 문서화 추가 + `finalizeFailedExecution` 헬퍼 추출)을
검토한 결과, 다른 spec 영역과 충돌하는 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 항목을
찾지 못했다.

근거:

1. **항목 1 (finalizeFailedExecution 헬퍼 추출)** — `spec/data-flow/8-notifications.md §1.1` 의
   `execution_failed` 행이 이미 "초기 세그먼트 `runExecution` catch **및** 재개(rehydration) 세그먼트
   `finalizeResumedExecutionOutcome` 양쪽에서 발사" 를 명시하고 있고, 코드
   (`codebase/backend/src/modules/execution-engine/execution-engine.service.ts`)도 두 지점에서 동일한
   FAILED 종결 블록(status/error/save/`EXECUTION_FAILED` emit/`execution_failed` dispatch)이 중복 구현돼
   있음을 확인했다(라인 543·2503·3073·4438 부근). 헬퍼 추출은 behavior-preserving 리팩터이며 spec 이 이미
   기술한 "양쪽에서 발사" 계약을 그대로 보존한다 — data-flow spec 과 충돌 없음.

2. **항목 2 (§4.4 ModuleRef 문서화)** — `spec/` 전체에 `ModuleRef` 언급이 현재 전무함을 확인했고
   (`grep -rn "ModuleRef" spec/` 무결과), 코드에는 이미 `getNotificationsService()`
   (ModuleRef strict:false 지연 해석, `execution-engine.service.ts:696-700`)와 `NotificationsService.getWebsocket()`
   (동형 패턴, `notifications.service.ts:35`)가 구현돼 있다. 이는 `plan/in-progress/spec-update-notifications-background-run-id.md`
   의 "후속" 항목(§4.4 순환 DI 해법 정리, rationale_continuity WARNING 유래)과
   `plan/in-progress/notif-followup-refactor.md` 의 작업 항목이 정확히 지시하는 후속 문서화로,
   PR #841(`d97ac6520`)에서 이미 구현된 사실을 spec 에 뒤늦게 반영하는 순수 drift-closing 작업이다.
   §4.4 의 기존 "순환 의존 처리 = `forwardRef`" 서술은 `ExecutionEngineService↔WebsocketService` /
   `↔AiTurnOrchestrator` / `↔FormInteractionService` 등 **일반 생성자 주입 순환**에 대한 해법이고,
   `ExecutionEngineService↔NotificationsService` 는 `@Optional` 생성자 주입이 인스턴스화 순서로 `undefined`
   로 굳는 **별도 실패 모드**에 대한 해법(ModuleRef 지연 해석)이라 서로 대체 관계가 아니라 병존 관계다 —
   기존 서술을 부정하지 않고 새 케이스를 추가하는 것이므로 모순이 없다.

3. **§4.4 "WebsocketService 단일 sink" 정책과의 관계** — 이 정책은 엔진의 **외부 이벤트 발행**
   (`NODE_STARTED`/`EXECUTION_*`/`AI_MESSAGE` 등, WebSocket/SSE/webhook consumer 대상)에 한정된 결정이며
   `spec/5-system/14-external-interaction-api.md §R10` 이 "엔진은 여전히 `WebsocketService.emitToExecution`
   한 곳만 호출" 로 범위를 재확인한다. `ExecutionEngineService → NotificationsService` 직접 호출(인앱 알림
   생성)은 이미 `background_failed`(§3.3, 본 문서)·`execution_failed`(data-flow spec) 양쪽에 선재하는
   기존 계약이라 target 작업이 새로 도입하는 종속이 아니며, "단일 sink" 정책이 규율하는 외부 이벤트 채널과는
   범주가 다르다 — 두 정책 사이에 충돌 여지가 없다.

4. 데이터 모델(`spec/1-data-model.md`)·API 계약·요구사항 ID·RBAC 어느 것도 target 변경으로 새로 정의되거나
   수정되지 않는다(순수 내부 구현 정리 + spec 문서화 보강). 따라서 이 네 관점에서는 검토 대상 자체가 없다.

### 요약

target 은 이미 병합된 PR #841 의 rationale-continuity 후속 항목(§4.4 ModuleRef 문서화)과 알려진 코드 중복
(FAILED 종결 블록)을 정리하는 behavior-preserving 작업이며, `spec/data-flow/8-notifications.md` ·
`spec/1-data-model.md` · `spec/5-system/14-external-interaction-api.md` 등 인접 spec 영역과 데이터 모델·
API·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 모순을 일으키지 않는다. 오히려 코드에 이미 존재하는
사실(ModuleRef 지연 해석, 양쪽 세그먼트 발사)을 spec 이 뒤늦게 따라잡는 drift-closing 성격이 강해 cross-spec
일관성을 개선하는 방향이다.

### 위험도
NONE
