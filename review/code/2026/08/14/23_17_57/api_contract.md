# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `execution.failed` 종결 이벤트의 `error` wire 형태가 string → `{code, message, nodeId, details?}` object 로 바뀌는 실질 breaking change이며, 이 저장소는 URL 버전 세그먼트를 쓰지 않는 단일 버전 운영 정책이라 기계로 감지 가능한 버전 신호가 없다. 다만 이번 diff 에서 `CHANGELOG.md`에 breaking 명시가 추가돼 이전 라운드(`22_55_51` api_contract WARNING)의 미문서화 지적은 해소됐다.
  - 위치: `CHANGELOG.md`(신규 `## Unreleased` 절, "수신자 영향 (breaking)" 문단), `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts` (`toTerminalErrorPayload` — `code`가 없으면 `null`), `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:134`(직접 확인 — `payload: event.payload` 를 가공 없이 webhook 큐에 그대로 실음)
  - 상세: `execution-engine.service.ts`/`retry-turn.service.ts` 의 `EXECUTION_FAILED` emit 4곳이 전부 `toTerminalErrorPayload` 를 거치도록 통일됐고, `chat-channel.dispatcher.ts` 는 문자열을 감쌀 때 지어내던 `'INTERNAL_ERROR'` 를 `null` 로 바꿨다. `notification-fanout.service.ts:134`(직접 read 로 확인)는 `event.payload` 를 어떤 정규화도 없이 webhook enqueue body 에 그대로 싣는다 — 즉 `execution.failed` 를 구독하는 실제 외부 webhook/SSE 수신자는 이번 배포로 `error` 의 런타임 타입이 조용히 바뀐다. 프로젝트는 `spec/5-system/2-api-convention.md` 정책상 URL 경로 버전 세그먼트를 쓰지 않으므로(Accept 헤더 또는 단일 버전 운영), 이런 shape 변경을 걸러낼 기계적 게이트가 원천적으로 없다 — CHANGELOG 문서화가 유일한 통지 수단이다. 이는 이 저장소 전역 정책이라 이 PR 만의 결함은 아니며, spec §6.4 가 이미 이 object 형태를 목표 계약으로 선언해 뒀던 점(#1169)을 감안하면 "의도된 계약 완성" 이라는 근거도 있다.
  - 제안: PR 본문/릴리스 노트에도 동일 문구를 반영해 실제 외부 통합자에게 전달되도록 할 것. (코드·CHANGELOG 조치는 이미 완료 — 잔여는 배포 커뮤니케이션 영역.)

- **[INFO]** `execution.cancelled` 의 `error`(`EiaCancelledEvent.error`)는 이번 정규화 대상에서 여전히 제외돼 있어, 같은 spec §6 필드 표 행이 규정하는 `failed`/`cancelled` 공용 목표 형태(`{code, message, nodeId, details?}`, `code`·`nodeId` nullable)와 실제로 어긋난다 — 다만 이번 라운드에서는 그 사실이 code·spec 양쪽에 정합하게 문서화됐다.
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:413-424`(`EiaCancelledEvent.error?: { code: string; message?: string }` — 이번 diff 미포함, 직접 확인), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1079-1104`(`emitCancellationEvent` — 이번 diff 미포함, 직접 확인), 대조: `spec/5-system/14-external-interaction-api.md`(§6 필드 표 `error` 행 — 이번 diff 에서 갱신)
  - 상세: 직접 코드를 읽어 확인한 결과 `emitCancellationEvent`(및 5개 호출부)는 여전히 `code` non-nullable·`nodeId`/`details` 부재인 `{code, message}` 를 손으로 만들어 emit 하고, `toTerminalErrorPayload` 를 거치지 않는다. 이전 라운드(`22_55_51`)의 architecture/documentation/maintainability 리뷰가 지적했던 "JSDoc 이 cancelled 커버리지를 과대 주장" 문제는 이번 diff 에서 `terminal-error-payload.ts` JSDoc 과 spec §6 필드 표 양쪽이 "cancelled 는 아직 손으로 만든다"로 일치하게 좁혀져 해소됐다(실측: `emitCancellationEvent` 코드는 diff 밖에서도 여전히 옛 shape 그대로임을 직접 확인). 즉 스키마 불일치 자체는 남아 있지만(같은 이벤트 패밀리의 공용 파서 작성에는 여전히 방해), 더 이상 "숨겨진 갭"이 아니라 code 주석 + spec 표 + plan(`durationMs`와 같은 비용 그룹으로 명시 분리) 3곳에서 일관되게 추적되는 상태다.
  - 제안: 현 상태 유지 가능(문서화 충분). 후속 PR 에서 `emitCancellationEvent` 도 `toTerminalErrorPayload`(또는 그 대응 헬퍼)로 통일할 계획이면 plan 항목으로 이미 등재돼 있는지만 재확인.

- **[INFO]** spec §6 필드 표의 `error` 행 stale caveat("현행 일부 경로는 string") 은 이번 diff 로 해소됐다 — 실측(`grep -rln ExecutionEventType.EXECUTION_FAILED` 두 파일뿐)과 일치.
  - 위치: `spec/5-system/14-external-interaction-api.md`(§6 필드 표 `error` 행, 이번 diff 반영분)
  - 상세: 이전 라운드(`22_55_51` api_contract WARNING)에서 지적된 stale 서술이 "`failed` 는 전 경로 object 다(2026-08-14, `toTerminalErrorPayload` 로 일원화)"로 갱신됐고, `cancelled` 캐비엇만 남겼다 — 코드 실측과 정합한다. 긍정 확인 사항으로 등재.

## 요약

이 라운드는 이전 `22_55_51` api_contract 리뷰가 지적한 3건(버전 신호 없는 breaking change 미문서화, `cancelled` 스키마 이탈에 대한 JSDoc 과대 주장, spec 필드 표 stale caveat)을 대부분 코드·문서 양쪽에서 닫았다 — CHANGELOG 에 breaking 명시 추가, `terminal-error-payload.ts` JSDoc 을 실제 호출 범위(`execution.failed` 4곳)로 좁히고 `cancelled` 는 별도 비용 그룹임을 명시, spec §6 필드 표를 실측과 일치하도록 갱신. 직접 코드를 읽어 재검증한 결과 `notification-fanout.service.ts` 가 `event.payload` 를 가공 없이 webhook 으로 내보내는 것을 확인했으므로 `error` string→object 전환은 실제 외부 수신자에게 영향을 미치는 진짜 breaking change 이며, 프로젝트가 URL 버전 세그먼트를 쓰지 않는 정책이라 CHANGELOG 문서화가 이 저장소에서 가능한 최선의 통지 수단이라는 점도 확인했다(이는 이 PR 이 아니라 저장소 전역 정책의 한계). `execution.cancelled` 쪽 스키마 이탈은 여전히 남아 있으나 더 이상 은폐되지 않고 code·spec·plan 3곳에서 일관되게 "별도 비용 그룹으로 후속" 이라 추적된다. 요청 검증·URL/경로 설계·페이지네이션·인증/인가는 이번 diff 범위 밖(신규/변경 엔드포인트 없음)이라 해당 없음.

## 위험도

LOW
