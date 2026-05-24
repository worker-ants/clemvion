# 문서화(Documentation) 리뷰

**대상 PR**: fix-chat-channel-dispatcher-and-cafe24-warn  
**리뷰 일시**: 2026-05-25  
**검토 파일 수**: 10개 (ts 7, md 2, json 1)

---

## 발견사항

### [INFO] ExecutionRoutingContext 인터페이스의 chatChannel 타입이 과도하게 느슨함
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — `ExecutionRoutingContext` 인터페이스 `chatChannel` 필드
- 상세: `chatChannel?: Record<string, unknown>` 으로 선언되어 있어 실제 담겨야 하는 필드(`provider`, `conversationKey`, `channelUserKey`)가 JSDoc 상으로만 언급될 뿐, 타입 정의에 명시되지 않는다. `attachRoutingContext` 의 JSDoc 에 "sanitize 한 사본을 첨부" 라고 설명하지만, 어떤 키가 credential-shaped 로 판단되는지(`api_key`, `token` 등의 패턴)는 해당 JSDoc 이나 `sanitizePayloadForWs` 연결 문서에 언급이 없다. `extractChatChannelFromInput` 의 주석은 이 sanitize 패턴을 "WebsocketService 측에서 적용" 이라 위임하지만, 수신 측(`attachRoutingContext`) JSDoc 에도 그 패턴 설명이 없다.
- 제안: `chatChannel` 을 `{provider: string; conversationKey: string; channelUserKey?: string; [key: string]: unknown}` 형태의 명명 인터페이스로 분리하거나, JSDoc 에 "credential-shaped key 판단 기준은 `sanitizePayloadForWs` 의 키 패턴 정의 참조" 라는 cross-reference 를 추가한다.

### [INFO] `attachRoutingContext` private 메서드에 JSDoc 이 있지만 "allocation 없음" 최적화 의도 언급 불충분
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — `attachRoutingContext` JSDoc
- 상세: "context 미등록이면 wire envelope 동일 참조 반환 (allocation 없음)" 이라고 언급하나, `Object.keys(additions).length === 0` 분기(ctx 가 있어도 triggerId/chatChannel 모두 falsy 인 경우)에서도 원본 참조를 반환한다는 사실이 JSDoc 에서 누락되어 있다. 이 분기는 빈 `ExecutionRoutingContext` 가 register 된 경우에 발생할 수 있는 edge case 이다.
- 제안: JSDoc 에 "ctx 가 존재하더라도 additions 가 비면 wireEnvelope 동일 참조 반환" 한 줄을 보완한다.

### [INFO] `extractChatChannelFromInput` 함수 — `channelUserKey` 미검증 이유가 JSDoc 에만 있고 함수 시그니처 상으로 불명확
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `extractChatChannelFromInput` 함수
- 상세: `provider` 와 `conversationKey` 는 비어있으면 `undefined` 반환하지만 `channelUserKey` 는 검증하지 않는다. 이 비대칭 설계 이유("raw 전체를 그대로 통과 — channelUserKey 외 추가 provider-specific 필드도 dispatcher 가 필요로 할 수 있다")는 인라인 주석으로 설명되어 있어 좋다. 그러나 함수 JSDoc 에는 "sub-property 가 모두 string 인 경우만 통과시킨다"고 표현되어 있어 실제 동작(provider + conversationKey만 검증)과 불일치한다.
- 제안: JSDoc 을 "provider 와 conversationKey 가 비어있지 않은 string 인 경우만 통과. channelUserKey 및 추가 필드는 검증 없이 통과 (dispatcher 가 필요로 하는 provider-specific 필드 보존 목적)" 으로 수정한다.

### [INFO] plan 문서의 "진행 체크" 항목과 구현 결과가 일부 불일치
- 위치: `plan/in-progress/fix-chat-channel-dispatcher-and-cafe24-warn.md` — 진행 체크 섹션
- 상세: 항목 8(TEST WORKFLOW)과 9(REVIEW WORKFLOW)가 `[ ]` (미완료)로 표시되어 있으나, 구현 결과 섹션에는 commit hash 3개가 이미 기재되어 있다. 이는 plan 이 live 문서로 관리되고 있음을 보여주지만, 체크리스트 상태가 실제 진행 상황을 반영하지 못한다. 특히 `/ai-review` 가 현재 실행 중인데 plan 은 미완료로 남아 있다.
- 제안: 리뷰 완료 및 PR 생성 시 해당 체크박스를 갱신하는 절차를 강제하거나, plan 문서에 "리뷰 진행 중" 상태를 표시하는 관례를 추가한다. (INFO 수준 — 구현 품질에 영향 없음)

### [INFO] 테스트 파일 내 `describe` 블록 헤더 주석이 spec 참조를 포함하나 링크 형식 불통일
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 및 `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — 각 `describe` 블록 주석
- 상세: 일부 주석은 `[Spec Chat Channel §3.1 CCH-AD-05]` 형식으로 참조하고, 일부는 `[chat-channel.md §3.1 CCH-AD-05]` 형식, 또 다른 부분은 `spec/5-system/15-chat-channel.md §3.1` 형식을 혼용한다. 동일 PR 내에서도 일관성이 없다.
- 제안: 테스트 내 spec 참조 형식을 `[Spec <파일명> §섹션 <식별자>]` 로 통일하거나, 프로젝트 규약으로 정의한다.

### [INFO] `McpToolProvider` openServer/materializeServer 변경 — null sentinel 패턴의 공개 API 문서 부재
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` — `openServer` 메서드 JSDoc (추가된 반환 null 설명)
- 상세: JSDoc 에 `반환 null = "본 provider 가 처리할 대상이 아닌 ref"` 설명이 추가된 것은 적절하다. 그러나 `inflight` Map 의 타입이 `Promise<ServerEntry | null>` 로 변경된 것에 대한 설명이 기존 field-level 주석("loser. Once openServer resolves...")에 반영되지 않았다. 기존 주석은 `null` 반환 가능성을 언급하지 않아 이 field 를 처음 읽는 사람이 혼동할 수 있다.
- 제안: `inflight` field 주석에 "null = not_capable (silent skip, sessions 에 미등록)" 케이스를 추가한다.

---

## 요약

이번 변경은 backend 내부 회귀 수정(chat-channel 라우팅 컨텍스트 누락 + MCP WARN 노이즈)으로, frontend 가시 API나 사용자 대면 동작 변경이 없다. 공개 함수와 새로운 인터페이스(`ExecutionRoutingContext`)에 대한 JSDoc 이 전반적으로 잘 작성되어 있으며, spec 참조(`CCH-AD-05`, `§3.1`, `§3.2`)가 코드·테스트·plan 문서 전반에 일관되게 달려 있다. README, CHANGELOG, 환경변수 문서, API 문서 갱신이 불필요한 순수 backend 내부 수정으로 해당 항목은 모두 적절히 생략되었다. 발견된 사항은 모두 INFO 수준으로 `extractChatChannelFromInput` JSDoc 와 실제 검증 로직 간의 표현 불일치, `inflight` Map 주석의 null 반환 케이스 미반영, spec 참조 형식 불통일 등 향후 유지보수 시 혼동을 줄이기 위한 개선 권고 사항이다.

---

## 위험도

LOW
