# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `ChannelConversationState.pendingFormModal` 에 `title` 필드 추가 — 기존 역직렬화 호환성
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` L570–575 (`pendingFormModal.title?: string`)
- 상세: `pendingFormModal` 는 Redis 에 JSON 직렬화되어 저장된다. 기존에 `title` 없이 저장된 레코드를 읽을 때 `title` 이 `undefined` 로 처리되며, 이는 `if (state.pendingFormModal.title)` 분기(hooks.service.ts 패치)가 falsy 로 평가해 정상적으로 전달하지 않는다. optional 필드이므로 기존 레코드와 역방향 호환된다.
- 제안: 별도 조치 불필요. 단, Redis TTL 내 기존 세션 사용자가 title 없는 modal 을 경험할 수 있음(기본값 `'양식'` fallback 동작)은 의도된 동작.

### [INFO] `FormModalField` 인터페이스에 `minLength`/`maxLength` 추가 — 직렬화 영향
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` L234–236
- 상세: `pendingFormModal.fields` 에 직렬화되는 `FormModalField[]` 에 새 optional 필드가 추가된다. 기존 저장 레코드에는 이 필드가 없으므로 읽을 때 `undefined`로 처리된다. Discord `openFormModal` 에서 `typeof f.minLength === 'number'` 조건부 spread 이므로 기존 레코드에도 안전하다.
- 제안: 별도 조치 불필요.

### [INFO] `ChatChannelConfig.botIdentity` 에 `publicKey?` 필드 추가 — DB 저장 영향
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` L720–726, `discord.adapter.ts` L130–138
- 상세: `botIdentity` 는 `Trigger.config` JSONB 컬럼에 저장된다. `setupChannel` 성공 시 `publicKey: application.verify_key` 가 `configUpdates.botIdentity` 에 추가되어 DB 에 merge 저장된다. `verify_key` 는 Discord ed25519 공개 키(비민감)이므로 비밀 노출 위험 없음. 기존 row 는 `publicKey` 미설정으로 유지되며 읽기 시 `undefined` 처리.
- 제안: 별도 조치 불필요.

### [INFO] `extractFormTitle` — 신규 export 함수, 기존 consumer 없음
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L477–487
- 상세: `extractFormTitle` 는 순수 함수(pure)로 부수 효과 없음. 기존 `extractFormFields` 와 동일한 입력 패턴으로 두 shape(`{ title }` / `{ config: { title } }`)를 처리한다. 신규 export 이므로 기존 코드에 영향 없음.
- 제안: 없음.

### [INFO] `chat-channel.dispatcher.ts` — `pendingFormModal` 에 `title` 조건부 spread
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` L303–315
- 상세: IIFE `(() => { const title = extractFormTitle(modalFormConfig); return title ? { title } : {}; })()` 패턴을 사용해 title 이 있을 때만 속성을 추가한다. `state` 는 `conversationService.lookup` 으로 획득한 공유 상태 객체이며, 이후 `conversationService.upsert` 로 영속화된다. 상태 변경은 의도된 것(형식 수락 시 pendingFormModal 갱신)이며, 새 `title` 필드는 기존 `nodeId`/`fields` 변경 없이 추가된다.
- 제안: 없음.

### [INFO] `OpenFormModalParams` 에 `title?` 추가 — 공개 인터페이스 변경
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` L244–245
- 상세: optional 필드 추가이므로 기존 `openFormModal` 구현체(Slack 어댑터 포함)는 `params.title` 을 단순히 무시하면 된다. Slack 어댑터가 `title` 을 처리하지 않아도 기능적으로 문제 없음.
- 제안: Slack 어댑터가 `params.title` 을 무시하는지 확인 권장(본 PR 범위 밖).

### [INFO] `hooks.service.ts` — `openFormModal` 파라미터에 `title` 조건부 추가
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L385–360
- 상세: `state.pendingFormModal.title` 이 truthy 일 때만 `{ title }` 을 spread 한다. 기존 동작(title 없는 경우)은 변경 없음. Slack 어댑터의 `openFormModal` 이 `params.title` 을 무시하더라도 부수 효과 없음.
- 제안: 없음.

### [INFO] 테스트 파일 — 전역 상태 spy 처리
- 위치: `discord-message.renderer.spec.ts`, `discord.adapter.spec.ts`
- 상세: `discord-message.renderer.spec.ts` 의 신규 테스트(`ai_message reply 버튼`)는 spy 사용 없이 순수 함수 호출. `discord.adapter.spec.ts` 의 기존 `unknown code warn log` 테스트는 `Logger.prototype.warn` 을 spy 후 `mockRestore()` 로 정리한다. 신규 추가 테스트들은 spy 를 사용하지 않아 전역 상태 누출 없음.
- 제안: 없음.

## 요약

이번 변경은 Discord chat-channel 어댑터에 §3.1(setupChannel publicKey 캐시), §3.3(modal title 동적화 + TEXT_INPUT 길이 제약), §5.1(b)(AI reply 버튼 테스트 보강) 기능을 추가한다. 모든 신규 필드는 optional로 추가되어 기존 Redis 직렬화 레코드·DB JSONB 레코드와의 역방향 호환이 유지된다. `extractFormTitle` 은 순수 함수이며, dispatcher 의 `pendingFormModal` 갱신은 기존 의도된 상태 변경 흐름 위에 title 필드만 추가한다. `OpenFormModalParams.title` optional 추가로 인한 Slack 어댑터 등 기존 구현체의 영향은 없다(무시하면 됨). 전역 변수 신규 도입, 환경 변수 읽기/쓰기, 파일시스템 부작용, 의도치 않은 네트워크 호출은 발견되지 않았다.

## 위험도

NONE
