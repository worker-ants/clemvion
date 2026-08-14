STATUS=success requirement review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[INFO]** `execution.cancelled` 의 `error` 는 이번 §6.4 object 일원화 대상에서 여전히 제외돼 있다
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` `EiaCancelledEvent.error?: { code: string; message?: string }` (게이트 없음 — diff 밖 기존 코드, 직접 Read 로 확인), `codebase/backend/src/shared/utils/terminal-error-payload.ts:4-9`(JSDoc 이 범위를 `execution.failed` 4곳으로 명시적으로 좁힘)
  - 상세: spec `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표(`error` 행)는 `failed`/`cancelled` 를 같은 목표 형태(`{code, message, nodeId, details?}`, `code`·`nodeId` nullable)로 규정하지만, `cancelled` 쪽은 여전히 `emitCancellationEvent`(`execution-engine.service.ts`, 이번 diff 미포함)가 손으로 `{code, message}` 만 채워 `nodeId`/`details` 가 없다. 다만 이번 PR 은 이 갭을 은폐하지 않는다 — 헬퍼 JSDoc, spec §6 표(`cancelled` 는 아직 `{code, message}` 만), `spec-draft-eia-notification-payload-contract.md` 체크리스트 3곳에서 일관되게 "비용이 다른 후속 작업" 으로 명시 추적되고 있어(재판정 ③-c), 회색지대 침묵이 아니라 spec 이 명시적으로 범위를 좁힌 상태다. 기능 결함이 아니라 남은 스코프에 대한 참고 사항.
  - 제안: 조치 불요(이미 plan/spec 3계층에 일관 기록). 후속 PR 착수 시 `spec-draft-eia-notification-payload-contract.md` 체크리스트 항목을 그대로 사용.

- **[INFO]** `notification-fanout.service.ts` 가 `event.payload` 를 가공 없이 webhook enqueue body 에 그대로 실어, `execution.failed` 의 `error` string→object 전환이 실제 외부 webhook/SSE 구독자에게도 영향을 미치는 breaking change 임을 직접 코드로 확인
  - 위치: `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:128-136`(diff 밖, 직접 Read 로 확인)
  - 상세: 이 저장소는 URL 버전 세그먼트를 쓰지 않아(`spec/5-system/2-api-convention.md`) 이 shape 변경을 거를 기계적 게이트가 없다. `CHANGELOG.md` 에 "수신자 영향 (breaking)" 문단이 이미 추가돼 있어 문서화 자체는 완료됐고, 이는 이 PR 의 결함이 아니라 저장소 전역 정책의 한계를 재확인하는 참고 사항이다.
  - 제안: 조치 불요(이미 CHANGELOG 로 통지). PR 본문에도 동일 문구 반영 권장.

### 요약
핵심 변경 — `terminal-error-payload.ts` 신설(`toTerminalErrorPayload`)로 `execution.failed` 의 `error` 를 EIA §6.4 wire 형태(`{code: string|null, message, nodeId: string|null, details?}`)로 정규화하고, `execution-engine.service.ts`/`retry-turn.service.ts` 의 emit 4곳(`failFirstSegmentSetup`·`finalizeStalledExhausted`·`finalizeFailedExecution`·`failRetryExecution`)을 모두 이 헬퍼로 일원화했으며, `chat-channel.dispatcher.ts` 의 레거시 문자열 흡수 경로도 같은 헬퍼로 교체하고, 프런트엔드 `use-execution-events.ts` 의 `handleExecutionFailed` 를 object/string 양쪽을 받도록 companion fix 한 것 — 을 소스 파일 전체를 직접 Read 하여 대조 검증했다. 모든 emit 지점·타입 정의(`EiaFailedEvent.error`)·dispatcher 분기·프런트 핸들러가 spec §6.4 본문(코드 블록·`code` nullable 근거 blockquote·§6 필드 집합 표)과 line-level 로 정합하며, spec 문서(§6.4, §6 표, `chat-channel-adapter.md`)도 실제 구현(전 경로 object화, `WORKER_HEARTBEAT_TIMEOUT`/`RESUME_*` 등 실재 code 목록)과 일치하도록 함께 갱신됐다 — 앞선 라운드에서 지적된 stale caveat·자기모순 blockquote·죽은 plan 참조는 모두 소스로 실측 후 해소됨을 확인했다. 타겟 테스트(`terminal-error-payload.spec.ts` 128줄 전체, `chat-channel.dispatcher.spec.ts` 53건, `use-execution-events.test.ts` 84건, `execution-engine.service.spec.ts`/`retry-turn.service.spec.ts` 해당 케이스)를 직접 실행해 전부 GREEN 임을 확인했고, 값-단언(뮤테이션으로 판별력 확보된 부분)이 실제 emit 문구·DB 문구와 일치함도 재확인했다. TODO/FIXME/HACK/XXX 잔존 없음, `tsc --noEmit` 에서 이번 변경 파일 관련 신규 타입 에러 없음(사전 존재 에러만 잔존). 반환값 경로(early return, null 처리, fallback)·엣지 케이스(빈 문자열/스칼라/symbol/undefined/키 생략)가 헬퍼·테스트 양쪽에서 대칭적으로 커버돼 있다. 남은 두 관찰(`execution.cancelled` 미통일, 전역 breaking-change 통지 한계)은 이미 spec·plan·CHANGELOG 3계층에 명시 추적되는 의도된 범위 밖 항목이라 INFO 로만 기록한다.

### 위험도
NONE
