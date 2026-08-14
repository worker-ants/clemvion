STATUS=success ISSUES=1
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** `execution.failed` 종결 이벤트의 `error` wire 형태가 `string` → `{code, message, nodeId, details?}` object 로 바뀌는 실질 breaking change이며, 이 저장소는 URL 버전 세그먼트를 쓰지 않는 단일 버전 운영 정책이라 기계로 감지 가능한 버전 신호가 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`toTerminalErrorPayload` 호출부, `emitExecution(... EXECUTION_FAILED ...)` 3곳), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`(`failRetryExecution` 부근 emit), `codebase/backend/src/shared/utils/terminal-error-payload.ts`(신규 헬퍼), `CHANGELOG.md:9`("수신자 영향 (breaking)")
  - 상세: `execution-engine.service.ts`/`retry-turn.service.ts` 의 `EXECUTION_FAILED` emit 4곳이 전부 `toTerminalErrorPayload` 로 통일돼 `error` 를 object 로 실었다. `notification-fanout.service.ts:134`(`payload: event.payload`)를 직접 Read 로 확인한 결과 webhook enqueue 는 emit payload 를 가공 없이 그대로 큐에 싣는다 — 즉 `execution.failed` 를 구독하는 실제 외부 webhook/SSE 수신자(제3자 서버로 HMAC 서명 push 되는 `spec/5-system/14-external-interaction-api.md` §3.1 화이트리스트 이벤트)에게도 이번 배포로 `error` 의 런타임 타입이 조용히 바뀐다. `spec/5-system/2-api-convention.md` 정책상 URL 경로 버전 세그먼트를 쓰지 않으므로, dual-shape 과도기·`Accept` 헤더 협상·per-trigger opt-in 같은 하위호환 마이그레이션 경로가 코드상 전혀 없다 — 무조건 object 로 전환된다. 완화 요인: (1) 새 object 형태는 spec §6.4 가 이 PR 이전부터 이미 "목표" 로 선언해 온 형태라, spec 을 보고 짠 통합자는 원래도 object 를 기대했어야 한다. (2) `CHANGELOG.md` 에 breaking 문구가 명시돼 있다. (3) 저장소가 통제하는 내부 소비자(chat-channel dispatcher, 에디터 프런트엔드 `use-execution-events.ts`, telegram renderer)는 이 changeset 안에서 전부 새 shape 에 맞춰 동반 수정됐다. 다만 이 저장소 밖의 실제 활성 webhook 구독자 유무는 코드로 답할 수 없는 질문이라(워크스페이스별 DB 데이터) 그 리스크는 남아 있다.
  - 제안: 조치 자체는 CHANGELOG 문서화로 최소 요건을 충족했다. 실제 활성 외부 webhook 구독자가 있는지 운영 측에서 확인하고, 있다면 PR 본문/릴리스 노트에도 동일 breaking 문구를 반영해 배포 전 통지되도록 할 것. 신규 코드 변경 자체를 막을 사유는 아니다.

- **[INFO]** `execution.cancelled` 의 `error` 는 `{code: string; message?: string}` 로 남아 `execution.failed` 와 형태가 어긋난다(같은 §6 표가 목표는 동일 형태로 규정)
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` `EiaCancelledEvent.error?: { code: string; message?: string }` (diff 밖, 직접 Read 로 확인)
  - 상세: `code` 가 non-nullable string 이고 `nodeId`/`details` 가 없어 `EiaFailedEvent.error` 와 대칭이 아니다. 다만 이번 PR 의 헬퍼 JSDoc(`terminal-error-payload.ts:4-9`)·spec §6 표(`cancelled` 는 "아직 `{code, message}` 만")·`spec-draft-eia-notification-payload-contract.md` 체크리스트가 일관되게 "비용이 다른 후속 작업" 으로 명시 추적하고 있어 은폐된 갭이 아니라 spec 이 명시적으로 좁힌 범위다.
  - 제안: 조치 불요. 후속 PR 착수 시 등재된 체크리스트를 그대로 사용.

- **[INFO]** (positive) `null` vs 키 생략 표현·에러 코드 nullable 처리가 `spec/5-system/2-api-convention.md` §5.4 규약과 정합하고, spec 필드 집합 표·`chat-channel-adapter.md` 유니온 타입·런타임 타입(`EiaFailedEvent`)이 같은 changeset 안에서 3-way 로 동기화돼 있다.
  - 위치: `spec/5-system/14-external-interaction-api.md`(§6 표·§6.4 blockquote), `spec/conventions/chat-channel-adapter.md:150,161-163`, `codebase/backend/src/modules/chat-channel/types.ts`
  - 상세: 직접 Read 로 spec 파일 최종 상태를 확인한 결과 §6 필드 집합 표와 §6.4 blockquote 가 더 이상 자기모순 없이 "전 경로 object + 레거시 흡수 경로 의도적 유지" 로 일치하게 서술돼 있다. 이는 앞선 리뷰 라운드(`23_17_57` 등)가 지적한 stale caveat 이 이번 최종 상태에서 실제로 해소됐음을 확인한 것이다.
  - 제안: 조치 불요.

### 요약
이번 changeset 의 핵심 API 계약 변경은 `execution.failed` 종결 이벤트의 `error` 필드를 문자열에서 EIA §6.4 가 이미 목표로 선언해 둔 `{code, message, nodeId, details?}` object 로 4개 emit 지점 전부에서 통일한 것이다. `null` vs 키 생략 표현 규약, `EiaFailedEvent` 타입, spec 필드 집합 표, 관련 convention 문서가 한 changeset 안에서 동기화돼 있고(직접 Read 로 최종 상태 재확인, 자기모순 없음), 저장소가 통제하는 하류 소비자(chat-channel dispatcher, 에디터 프런트엔드, telegram renderer)도 함께 갱신돼 있다. 유일한 실질 API 계약 리스크는 이 이벤트가 제3자에게 HMAC 서명 push 되는 진짜 외부 webhook 계약(`notification-fanout.service.ts` 가 payload 를 가공 없이 그대로 enqueue)인데, 이 저장소가 URL 버전을 쓰지 않는 단일 버전 운영이라 CHANGELOG 문서화 외에는 하위 호환 마이그레이션 경로가 없다는 점이다 — 새 형태가 spec 이 원래 약속했던 목표 형태와 일치하고 이미 CHANGELOG 에 breaking 명시가 있다는 점이 리스크를 완화하므로 WARNING 으로 유지한다(신규 CRITICAL 없음). 요청 검증·URL/경로 설계·페이지네이션·인증/인가 관점에서는 이번 diff 에 해당 표면이 없다(REST 엔드포인트가 아니라 이벤트/webhook payload 형태 변경).

### 위험도
LOW
