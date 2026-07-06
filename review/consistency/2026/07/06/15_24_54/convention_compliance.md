# 정식 규약 준수 검토 — spec/data-flow/8-notifications.md

## 발견사항

- **[WARNING]** WS emit payload 에 `timestamp` 필드가 추가됐으나 spec §4.4 표·target 문서 어디에도 반영되지 않음
  - target 위치: `spec/data-flow/8-notifications.md` §2.2 (`Redis / WebSocket / SMTP`), Rationale "WebSocket emit 표기" 절
  - 위반 규약: 직접적인 "정식 규약" 항목 위반은 아니나, `spec/5-system/6-websocket-protocol.md §4.4` (권위 정의처, target 문서가 그 표기를 그대로 따른다고 명시)와의 payload shape 불일치
  - 상세: 구현 diff(`websocket.service.ts`)의 `emitNotificationEvent`는 broadcast payload 에 `id, type, title, message, resourceType, resourceId` 외에 `timestamp: new Date().toISOString()` 를 추가한다. 그러나 §4.4 표는 `notification.new` payload 를 `{ id, type, title, message, resourceType, resourceId }` (timestamp 없음) 로 정의하고, target 문서 Rationale 도 "본 표기를 그대로 사용한다"고 서술한다. `timestamp` 첨부 자체는 `emitExecutionEvent`/`emitKbEvent` 등 기존 WS 이벤트 관례(§1 "서버발신 이벤트 wire = `{...payload, seq, timestamp}` 평면")와 일치하는 정상 패턴이라 코드 쪽이 틀린 것은 아니다. 다만 §4.4 payload 정의와 target 문서가 그 필드를 반영하지 않아 문서-코드 shape 가 어긋난 상태로 남는다.
  - 제안: `spec/5-system/6-websocket-protocol.md §4.4` 의 `notification.new` payload 표기에 `timestamp` 를 추가하고, `spec/data-flow/8-notifications.md` §2.2/Rationale 도 동일하게 갱신한다 (본 target 문서 단독 수정이 아니라 §4.4 권위 문서와 동시 갱신 필요 — 두 문서가 "동일 표기 유지"를 상호 참조하는 구조이므로 한쪽만 고치면 재차 불일치).

- **[WARNING]** 구현 완료된 알림 emit 파이프라인에 대해 target 문서가 여전히 "미구현 (Planned)"으로 서술 — spec-impl 상태 stale
  - target 위치: `spec/data-flow/8-notifications.md` Overview "구현 현황 주의" 블록, §1 다이어그램·표, §2.2, §4.6, Rationale "WebSocket emit 표기" 절 전체
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 라이프사이클 전이 규칙("최초 코드 머지 시점에 승격") — 단, §1 에 의해 `spec/data-flow/**` 는 frontmatter(`status`) 의무 자체가 명시적으로 면제되어 있어 **본 파일에는 이 가드가 직접 적용되지 않는다**. 그러나 정합성 문제(코드가 이미 `notify()`/`createMany` 를 통해 `emitNotificationEvent` 를 emit 하는데도 문서가 "Svc-->>WS: 미구현 (Planned)"로 남아있는 것)는 다른 권위 문서인 `spec/5-system/6-websocket-protocol.md §4.4`(frontmatter 대상, 현재 `status: partial`로 이 gap 을 `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 로 추적 중)에도 영향을 미친다.
  - 상세: diff 상 `NotificationsService.notify()`/`createMany()` 가 `emitNew()` 를 통해 `WebsocketService.emitNotificationEvent()` 를 실제로 호출하도록 구현됐고(회귀 테스트까지 추가됨), `WebsocketService.emitNotificationEvent` 자체도 신규 구현됐다. 그럼에도 target 문서는 다이어그램 주석("Note over Svc,WS: 미구현 (Planned)"), §1 표("`notification.new` WS emit | 미구현 (Planned)"), §2.2("본 emit 은 follow-up phase 작업 — 현재 `WebsocketService` 에 해당 메서드 미구현"), Rationale("코드 측은 현재 emit 미구현") 을 그대로 유지하고 있어 코드-문서 불일치가 크다. `6-websocket-protocol.md §4.4` 도 동일하게 "계획·미구현" 헤딩과 안내문을 유지하고 있다.
  - 제안: (a) `spec/5-system/6-websocket-protocol.md §4.4` 를 "구현됨" 으로 갱신(헤딩의 `_계획·미구현_` 제거, 안내 문구 정정, `notification.new` 표의 `_(계획·미구현)_` 태그 제거 + payload 에 `timestamp` 반영), (b) `spec/data-flow/8-notifications.md` 의 관련 서술(다이어그램 Note, §1 표, §2.2, Rationale) 을 구현됨으로 정합화하고 `notify()` 단일 표면 도입 여부도 함께 재확인(diff 에 `notify()` 신규 메서드가 추가됐으므로 Overview 상단 "적재 진입점이 단일 `notify()` 표면이 아니라 …" 서술도 stale 가능성 높음), (c) `6-websocket-protocol.md` frontmatter 의 `pending_plans`/관련 plan 문서(`spec-sync-websocket-protocol-gaps.md`) 도 이 항목 해소를 반영해 갱신.

- **[INFO]** `ModuleRef(strict:false)` 지연 해석 패턴에 대한 정식 규약 부재 — 향후 유사 순환참조 회피 시 참고할 SoT 없음
  - target 위치: 코드 diff `notifications.service.ts` (`getWebsocket()`), `notifications.module.ts` 상단 주석
  - 위반 규약: 없음 (금지 패턴 아님, 단지 컨벤션 문서화 공백)
  - 상세: `NotificationsModule` → `WebsocketModule` file-level import 시 `nodes` 배럴 초기화 경로에서 require 순환이 발생해 `ModuleRef.get(WebsocketService, {strict:false})` 로 지연 해석하는 패턴을 채택했다. 이 패턴 자체는 target 문서·구현 모두에서 합리적으로 설명되고 있으나, `spec/conventions/` 어디에도 "모듈 간 순환참조 시 `ModuleRef(strict:false)` 지연 해석" 이 표준 해법으로 등재돼 있지 않다. 유사 사례(WebsocketModule 을 참조해야 하는 다른 모듈)가 향후 재발할 가능성이 있다.
  - 제안: 필수는 아니나, 재발 방지 차원에서 `spec/conventions/` 에 "모듈 순환참조 회피 패턴" 소절을 신설하거나 기존 아키텍처 문서(`spec/0-overview.md` 등)의 모듈 의존성 절에 각주로 추가하는 것을 고려. 규약 갱신이 적절한 케이스로 판단됨(target 문서 수정 사항 아님).

- **[INFO]** best-effort emit 실패 처리(`logger.warn` + 삼킴)가 여러 계층(Service/Gateway)에 이중으로 존재
  - target 위치: 코드 diff `notifications.service.ts` `emitNew()` (try/catch + warn), `websocket.service.ts` `emitNotificationEvent` (자체 try/catch + warn)
  - 위반 규약: 없음. `spec/data-flow/8-notifications.md` Rationale "Email 실패는 warn 만, 재시도 없음" 과 동일 기조("경로의 어떤 실패도 호출자에게 전파되면 안 된다")를 emit 경로에도 일관 적용한 것으로, 오히려 프로젝트 conventions 의 fail-safe 철학과 정합적이다.
  - 상세: `NotificationsService.emitNew` 가 `getWebsocket()`(ModuleRef 해석 실패)과 `emitNotificationEvent()` 호출(그 내부에서도 broadcast 실패를 자체 삼킴) 모두를 다시 한번 감싸는 이중 방어라 다소 방어적이나, 코드 주석이 "해석 실패든 broadcast 실패든" 을 명시적으로 정당화하고 있어 의도적 설계로 판단됨.
  - 제안: 조치 불필요. 참고 사항으로만 기록.

## 요약

`spec/data-flow/8-notifications.md` 자체의 명명 규약(`notification.new` 점 표기, `notifications:<userId>` 채널, dismiss endpoint 의 HTTP 동사 선택 등)은 `spec/conventions/swagger.md`·`6-websocket-protocol.md` 의 기존 패턴과 정확히 일치하며 CRITICAL 급 명명·출력 포맷 위반은 발견되지 않았다. `spec/data-flow/**` 는 `spec-impl-evidence.md §1` 에 의해 frontmatter 의무 자체가 명시적으로 면제되므로 그 자체는 문제가 아니다. 다만 이번 구현(diff)이 target 문서와 그 권위 참조처인 `6-websocket-protocol.md §4.4` 가 "미구현 (Planned)" 이라고 선언한 알림 WS emit 파이프라인을 실제로 구현·테스트까지 완료했음에도, 두 문서 모두 여전히 Planned 서술을 유지하고 있어 spec-code 정합성 갭이 발생했다 (WARNING 2건: emit 자체의 구현완료 미반영, 그리고 신규 `timestamp` 필드가 §4.4 payload 정의에 없는 점). 이는 "정식 규약을 어긴 코드"라기보다 "구현 완료 후 두 spec 문서(target + 권위 문서)의 상태·payload 표기 동기화가 누락된" 문제로, 다음 spec 갱신 라운드에서 §4.4 헤딩/표와 target 문서의 다이어그램·표·Rationale 를 함께 구현됨으로 승격 정정할 필요가 있다.

## 위험도
LOW
