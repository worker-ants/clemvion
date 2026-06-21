# 요구사항(Requirement) 리뷰 결과

## 발견사항

### **[WARNING]** `KbChannelAuthorizer` — `kb:` 채널 UUID 검증 누락
- 위치: `codebase/backend/src/modules/knowledge-base/kb-channel-authorizer.ts` (전체), `kb-channel-authorizer.spec.ts`
- 상세: `execution:`/`workflow:`/`background:run:` authorizer 는 `isValidUuid` 로 비-UUID 입력을 DB 쿼리 전에 차단(W-6 정책)하지만, `KbChannelAuthorizer.authorize` 는 UUID 형식 검증 없이 `documentId` 를 `verifyDocumentOwnership` 에 그대로 전달한다. `kb:{documentId}` 의 documentId 가 UUID 임을 다른 authorizer 들과 달리 명시적으로 보장하지 않는다. `verifyDocumentOwnership` 자체는 `!documentId` empty-string 가드는 있으나 임의 SQL-safe 문자열이 파라미터 바인딩으로 DB 쿼리를 실행하는 것을 막지 않는다. spec §3.3 테이블의 `kb:{documentId}` 행에는 "비-UUID 선차단" 언급이 없어 spec 은 침묵하지만, 동일 PR 의 다른 authorizer 4개가 모두 UUID 가드를 적용하고 있어 의도적 불일치인지 모호하다. 테스트에서도 비-UUID `documentId` 를 전달하는 케이스가 없다.
- 제안: `kb:` 채널의 `documentId` 가 UUID 임이 설계상 전제라면 `isValidUuid(documentId)` 가드를 `execution:` / `background:run:` 와 동일하게 추가하고 spec §3.3 `kb:` 행에 "(비-UUID 선차단)" 을 명기한다. spec 이 UUID 를 전제하지 않는 채널이라면 INFO 수준 — 그러나 현재 KB 엔티티의 `document.id` 가 UUID v4 임을 감안하면 UUID 가드는 방어적으로 추가하는 것이 자연스럽다.

---

### **[WARNING]** `NotificationsChannelAuthorizer` 등록 시 `workspaceId` 선행 가드 통과 가능성
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` lines 2017–2022 (전체 파일 컨텍스트 기준)
- 상세: `handleSubscribe` 에서 `authorizer` 를 찾은 후 `!workspaceId` 이면 `Not authenticated` 를 반환한다. `notifications:` 채널은 `workspaceId` 가 아닌 `userId` 만 검증한다. 코드 주석("인증된 소켓은 JWT 에 workspaceId 를 함께 담으므로 본 가드는 정상 경로를 막지 않는다")은 JWT 에 항상 `workspaceId` 가 존재한다는 것을 전제한다. 그러나 JWT payload 타입이 `{ sub: string; workspaceId?: string }` (optional) 이므로, workspaceId 가 없는 JWT 로 인증된 소켓이 `notifications:` 채널을 구독하면 `!workspaceId` 가드에서 `Not authenticated` 로 거부된다. `notifications:` 는 userId 만 검증해야 하는 채널이므로, workspace-free 사용자(또는 미래에 workspace-less JWT 를 사용하는 시나리오)에서의 동작이 의도와 다를 수 있다. 현재 운영 시나리오에서 인증된 소켓은 workspaceId 가 있다고 가정되므로 실제 버그는 아니지만, 의도를 코드로 더 명확히 표현할 필요가 있다.
- 제안: `notifications:` 채널에 대해서는 `workspaceId` 대신 `userId` 존재 여부로 인증 가드를 분기하거나, `workspaceId` 가드를 `notifications:` 를 제외한 채널에만 적용하는 것을 검토. 또는 현재 JWT 스펙에서 workspaceId 가 항상 존재함을 보장하는 문서/타입을 강화.

---

### **[INFO]** [SPEC-DRIFT] spec §3.3 `channelAuthorizers` 표기가 기존 인라인 배열 구조를 암시
- 위치: `spec/5-system/6-websocket-protocol.md` §3.3 line 143
- 상세: spec 본문에 "채널별 인가 전략(`channelAuthorizers`, OCP 구조)" 라고 명시되어 있는데, 이는 `WebsocketGateway` 의 인라인 `channelAuthorizers` 배열을 가리킨다. M-7 구현 후 `channelAuthorizers` 는 더 이상 gateway 인라인 배열이 아니라 `CHANNEL_AUTHORIZER` 토큰으로 주입되는 `ChannelAuthorizer[]` 이며, 각 authorizer 는 개별 도메인 모듈에 분산되어 있다. spec 의 `channelAuthorizers` 표기와 OCP 설명은 구현 변경 이후에도 의미상 옳으나, 구체적인 메커니즘(인라인 배열 vs DI 주입 배열)은 코드와 불일치한다.
- 제안: 코드 유지 + spec 갱신. `spec/5-system/6-websocket-protocol.md §3.3` 의 `channelAuthorizers` 참조를 "각 도메인 모듈이 `CHANNEL_AUTHORIZER` 토큰으로 등록한 `ChannelAuthorizer[]` 를 gateway 가 주입받는 구조(OCP)" 로 갱신 (project-planner 위임). 기능 동작(채널별 인가 검증, 결과 ack)은 변경 없으므로 spec 갱신 범위는 메커니즘 설명 1절.

---

### **[INFO]** `BackgroundRunChannelAuthorizer` — `userId` 미사용 (정상, 확인용)
- 위치: `background-run-channel-authorizer.ts`, `background-run-channel-authorizer.spec.ts`
- 상세: `authorize` 메서드에서 `ChannelAuthorizerContext` 의 `userId` 를 구조 분해하지 않고 `workspaceId` 만 사용한다. `background:run:` 채널은 workspace-scoped 채널이므로 이는 올바른 동작이다. 테스트에서도 `userId: 'u-1'` 을 전달하지만 authorizer 가 무시하는 것이 명확히 검증된다. 문제 없음.

---

### **[INFO]** `ExecutionChannelAuthorizer` — `userId` 미사용 + `verifyOwnership` throw 처리 일관성
- 위치: `execution-channel-authorizer.ts`
- 상세: `verifyOwnership` 이 throw 하면 `catch(() => false)` 로 `false` 로 평탄화하여 `Not authorized` 를 반환한다. 이는 IDOR 차단 의도와 일치하며, 테스트(`rejects when ownership throws`)에서 확인된다. 정상.

---

### **[INFO]** `uuid.ts` — UUID v6/v7/v8 미지원
- 위치: `codebase/backend/src/common/utils/uuid.ts` line 67-68
- 상세: 정규식이 UUID v1–v5 만 허용한다(`[1-5]` 버전 비트). UUID v6/v7/v8 은 거부된다. 현재 앱이 UUID v4 를 기준으로 운영되고 v6+ 는 사용하지 않으므로 실 문제는 없다. 파일 주석도 "UUID v1–v5 형식 검증"으로 명시하고 있어 의도적이다.

---

### **[INFO]** `WorkflowChannelAuthorizer` — `verifyOwnership` 이 아닌 `findById` 호출
- 위치: `workflow-channel-authorizer.ts`
- 상세: `execution:` 채널은 `verifyOwnership`(throw 계약)을 쓰는 반면 `workflow:` 채널은 `findById(workflowId, workspaceId)`(throw 시 NotFound → boolean 평탄화)를 쓴다. 이는 기존 gateway 인라인 authorizer 의 동작을 그대로 이전한 것이며, `findById` 도 미소유/부재 시 throw 하므로 기능적으로 동등하다. 정상.

---

## 요약

M-7 refactor 의 핵심 요구사항인 "gateway 서비스-레벨 forwardRef 3개 제거 + channel authorizer 도메인 역전 + OCP 달성"은 완전히 구현되었다. `ChannelAuthorizer` 인터페이스/토큰 신설, 5개 authorizer 분리(4개 도메인 소유 + 1개 WS-local), `useFactory` 명시 집계, gateway `@Inject(CHANNEL_AUTHORIZER)` 주입, `handleSubscribe` 로직/구독 실패 ack 계약(spec §3) 무변경 — 모두 spec 요구사항을 충족한다. 단, `KbChannelAuthorizer` 에 다른 authorizer 4개가 공통으로 적용하는 UUID 형식 검증이 누락되어 있어 W-6 방어 정책의 일관성이 깨진다(WARNING). `notifications:` 채널의 `workspaceId` 선행 가드는 현재 JWT 설계에서 문제없으나 타입 수준에서 의도가 불명확하다(WARNING). spec §3.3 의 `channelAuthorizers` 참조 표현은 구현 메커니즘 변경을 반영하지 못하고 있어 spec 갱신이 필요하다(SPEC-DRIFT).

## 위험도

LOW
