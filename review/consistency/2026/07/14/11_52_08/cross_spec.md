# Cross-Spec 일관성 검토 결과

대상: `spec/5-system/15-chat-channel.md` 구현 완료 검토 (--impl-done). 실제 diff 는
`spec/5-system/{14-external-interaction-api,15-chat-channel,4-execution-engine,6-websocket-protocol}.md`
+ 해당 코드(`execution-engine.service.ts` / `interaction.service.ts` / `hooks.service.ts` /
`websocket.gateway.ts` / `chat-channel-config.dto.ts` / `language-hint-defaults.ts` / `markdown-v2.ts`)
를 포괄한다 (F-1~F-6, plan `eia-command-waiting-surface-guard`).

## 발견사항

- **[WARNING]** `4-execution-engine.md` §7.4 요약 표가 §7.5.1 의 새 nodeId 검증 모델과 모순
  - target 위치: 이번 diff 자체는 아니지만 같은 파일 `spec/5-system/4-execution-engine.md` §7.5.1 (신규 F-1 서술)
  - 충돌 대상: 같은 파일 §7.4 "Continuation Bus" 표 — `입력 receiver → enqueuer` 행 (`spec/5-system/4-execution-engine.md:896`, 최종 수정 2026-06-05, 이번 PR 미갱신)
  - 상세: §7.4 는 "controller / WS gateway 는 클라이언트 payload 의 `nodeId` 로 현재 `WAITING_FOR_INPUT` 상태의 NodeExecution row 를 DB lookup (`execution_id + node_id + status='waiting_for_input'`) 해 `nodeExecutionId` 를 채운다" 고 기술한다 — 즉 nodeId 가 **DB 쿼리 조건**이라는 서술이다. 반면 이번 PR 로 갱신된 §7.5.1 은 "`resolveWaitingNodeExecutionId` 가 `execution_id + status='waiting_for_input'` 로 단일 대기 행을 찾은 뒤(정상 1건), 도착 명령의 nodeId 와 표면을 그 행에 대해 검증한다" 고 명시하며, 실제 구현(`execution-engine.service.ts` `resolveWaitingNodeExecutionId` 의 쿼리, `.where('ne.execution_id = :executionId').andWhere('ne.status = :status', ...)`)도 nodeId 를 WHERE 절에 넣지 않고 조회 후 별도로 `rows[0].nodeId !== expectedNodeId` 비교한다. §7.4 서술대로라면 (a) nodeId 가 잘못 지정된 경우 매칭 row 0건(=`INVALID_EXECUTION_STATE`, "Execution 이 다른 상태" 사유)으로 오귀속되고, (b) chat-channel `in_process_trusted` 처럼 nodeId 를 아예 보내지 않는 caller 의 exemption 이 애초에 불가능해 보이는 등 §7.5.1·실제 코드와 읽는 방식이 달라진다.
  - 제안: §7.4 표의 해당 행을 §7.5.1 의 정확한 메커니즘(조회 키는 `execution_id + status` 뿐, nodeId 는 조회 후 검증 — caller 가 지정할 때만)에 맞춰 정정. 이번 PR 이 §7.5.1 을 상세화하면서 §7.4 요약을 갱신하지 않아 같은 문서 안에서 "SoT 가 두 개"가 된 상태.

- **[WARNING]** F-5 에러 응답 모양(`details.code`) 서술이 같은 파일의 기존 `UNKNOWN_PLACEHOLDER` 서술과 상충
  - target 위치: `spec/5-system/15-chat-channel.md` §4.1.1, "control-plane raw-send 키의 등록 시점 검증 (F-5)" 문단 (line 265): "에러 표면은 기존 `UNKNOWN_PLACEHOLDER` placeholder validator 와 **동형** — `message` 에 `UNSAFE_TELEGRAM_MARKDOWN:<field>:<char>` 를 colon-encoding 하고 top-level `code` 는 `VALIDATION_ERROR`(**details 는 `INVALID_FIELD`**)"
  - 충돌 대상: 같은 파일 §3.5 (line 658, 2026-05-25 기존 서술): "미허용 placeholder 가 발견되면 `400 VALIDATION_ERROR (details.field='languageHints.executionFailed*', code='UNKNOWN_PLACEHOLDER')`" — 즉 `details[].code` 가 `'UNKNOWN_PLACEHOLDER'` 리터럴이라고 명시.
  - 상세: 두 문단은 같은 검증 메커니즘(`ValidatorConstraint.defaultMessage()` 로 `"<CODE>:<field>:<value>"` 형태 문자열 반환 → 전역 `CustomValidationPipe` 가 처리)을 "동형" 이라 서로 참조하는데, `details[].code` 값을 다르게 주장한다. 실제 코드(`codebase/backend/src/common/pipes/validation.pipe.ts` `flattenErrors`)는 모든 constraint 위반에 대해 `code: 'INVALID_FIELD'` 를 하드코딩하고, validator 가 반환한 `"UNKNOWN_PLACEHOLDER:...":"UNSAFE_TELEGRAM_MARKDOWN:..."` 문자열은 파싱 없이 `message` 필드에 원문 그대로 들어간다 — 즉 F-5 새 문단(line 265) 쪽 서술이 실제 코드와 일치하고, 기존 §3.5(line 658)의 `code='UNKNOWN_PLACEHOLDER'` 주장은 (이 PR 이전부터의) 오기로 보인다. F-5 문단이 "동형" 이라며 오래된 오기를 재확산시키는 형태.
  - 제안: 둘 중 하나로 통일. 실제 파이프 동작(`code` 는 항상 `INVALID_FIELD`, 세부 코드는 `message` 문자열 접두사로만 존재)이 SoT 라면 §3.5(line 658)의 `code='UNKNOWN_PLACEHOLDER'` 표기를 수정하고, F-5 문단의 "동형" 표현은 유지. 코드가 spec 의도(details.code 로 세분화)와 다르다면 별도 코드 수정 필요(이번 PR 범위 밖일 수 있음 — `project-planner`/`developer` 조율 필요).

- **[WARNING]** F-5 텍스트가 chat-channel `languageHints` 카탈로그에 없는 키(`formValidationFailed`/`formNextField`)를 참조
  - target 위치: `spec/5-system/15-chat-channel.md` §4.1.1, F-5 문단(line 263): "control-plane 키 — `help` · `groupChatRefusal` · `unsupportedMessageKind` · `executionStillRunning` · `surfaceMismatch` · `formValidationFailed` · `formNextField`"
  - 충돌 대상: 같은 파일의 `languageHints` 설정 예시(JSONC, §4.1 근처)·default 문구 표(§4.1.1 본문 표, line 220~257)·`TELEGRAM_RAW_SEND_HINT_KEYS`(코드, `chat-channel-config.dto.ts`) — `formValidationFailed`/`formNextField` 는 이 어디에도 정의(default 문구·용도 설명)가 없다.
  - 상세: 두 키는 `HooksService.handleFormStep`(`hooks.service.ts` L901/L917, 이번 diff 밖 — pre-existing)가 이미 사용 중인 실 런타임 키(default: `'입력값을 다시 확인해주세요\.'` / `'다음 항목을 입력해주세요\. (...)'`, 텔레그램 escape 가 inline 으로 baked-in)이지만, `spec/` 전체를 통틀어 이번 F-5 문장 한 줄에만 이름이 등장하고 자체 카탈로그 행(용도·KO/EN default·lookup 경로)이 없다. 이번 PR 이 F-5 검증 대상 키 목록에 이 둘을 포함시키면서 처음으로 spec 에 이름을 노출시켰지만, 정작 그 키들 자체는 여전히 미문서 상태로 남았다 — target 문서 내부에서 "검증 대상"과 "카탈로그 정의"가 어긋난다.
  - 제안: `formValidationFailed`/`formNextField` 를 §4.1.1 default 문구 표·설정 예시에 `surfaceMismatch` 와 같은 방식으로 정식 등재(용도, KO/EN default, lookup 경로, native form-mode 전용이라는 제약 명시). 범위가 이번 plan 밖이면 최소한 "기존에 존재하나 카탈로그 미등재 — 별도 후속" 정도의 각주라도 필요.

## 요약

이번 diff(F-1~F-6, EIA nodeId 검증 강화 + chat-channel surfaceMismatch 안내 + telegram MarkdownV2 raw-send 검증)는 EIA(`14-`)·실행 엔진(`4-`)·WebSocket 프로토콜(`6-`)·chat-channel(`15-`) 4개 spec 문서를 함께 갱신했고, 상호 cross-link·표면별 코드 매핑(`STATE_MISMATCH`/`INVALID_EXECUTION_STATE`/`INVALID_STATE`)·진입점별 nodeId 커버리지 표는 실제 코드(쿼리·assertNodeId·frontend WS 커맨드)와 대조해 정확했다. 다만 (1) `4-execution-engine.md` §7.4 의 오래된 nodeId-lookup-key 서술이 이번에 상세화된 §7.5.1 과 같은 문서 안에서 모순되고, (2) F-5 가 재사용한 "UNKNOWN_PLACEHOLDER 와 동형" 에러 응답 서술이 기존 §3.5 서술과 `details.code` 값을 다르게 주장하며, (3) F-5 가 참조하는 `formValidationFailed`/`formNextField` 키가 카탈로그에 미등재다. 셋 모두 기능을 깨뜨리는 직접 모순은 아니고(§1 은 순수 문서 drift, §2·§3 은 pre-existing 갭을 이번 PR 이 노출), 다른 spec 영역과의 API 계약·상태 코드 매핑 자체는 견고하다.

## 위험도

MEDIUM
