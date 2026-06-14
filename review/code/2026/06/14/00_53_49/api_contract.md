# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] `ChatChannelConfig.botIdentity.publicKey` 신규 필드 추가 — 하위 호환성 유지됨
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` L52–L727
- 상세: `botIdentity` 에 옵셔널 `publicKey?: string` 필드 추가. 기존 클라이언트가 이 필드를 모르더라도 optional 이므로 직렬화·역직렬화 모두 breaking change 없음. `setupChannel` 반환 `configUpdates.botIdentity.publicKey` 도 `verify_key` 가 없을 경우 spread omit 처리(`...(application.verify_key ? { publicKey: ... } : {})`)되어 기존 shape 유지.
- 제안: 현재 처리 적절. 별도 조치 불필요.

### [INFO] `FormModalField.minLength / maxLength` 신규 필드 추가 — 하위 호환성 유지됨
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` L220–L227
- 상세: `FormModalField` 에 `minLength?: number`, `maxLength?: number` 옵셔널 추가. 기존 form flow 와 역직렬화에 영향 없음. Discord `TEXT_INPUT` 의 `min_length`/`max_length` 는 Discord API 공식 필드이므로 Discord API 계약 준수.
- 제안: 현재 처리 적절.

### [INFO] `OpenFormModalParams.title` 신규 파라미터 추가 — 하위 호환성 유지됨
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` L236
- 상세: `title?: string` 옵셔널 파라미터 추가. 미설정 시 어댑터가 `languageHints.formModalTitle → '양식'`으로 fallback 하므로 기존 호출자(HooksService 등)가 파라미터를 넘기지 않아도 동작. Breaking change 없음.
- 제안: 현재 처리 적절.

### [INFO] `ChannelConversationState.pendingFormModal.title` 신규 필드 추가 — DB 스키마 영향 확인 권장
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` L560–L571
- 상세: `pendingFormModal` 에 `title?: string` 추가. `ChannelConversationState` 가 DB 에 JSON 형태로 저장되는 경우, 기존 row 에 `title` 없이 읽혀도 옵셔널이므로 런타임 에러 없이 `undefined` 처리됨. 마이그레이션 불필요(additive).
- 제안: DB JSON column 에 저장되는 객체라면 기존 row 역직렬화 경로를 확인하는 것이 좋으나, optional 구조상 자동 하위 호환됨.

### [INFO] Discord modal `title` 45자 truncate — Discord API 제약 준수
- 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` L307–L317
- 상세: Discord Interactions API의 modal `title` 최대 45자 제약을 `rawTitle.slice(0, 45)` 로 클라이언트 측에서 강제 적용. 서버가 reject 하기 전에 선제 truncate 하여 Discord API 에러 방지. reply modal 의 `title` (`replyModalTitle`)은 languageHints 에서만 오고 truncate 없이 넘어가는 점에 유의.
- 제안: reply modal 제목도 45자 초과 가능성이 있으므로 동일한 truncate 적용 고려.

### [INFO] Discord `TEXT_INPUT` min_length/max_length 상한 4000 cap — Discord API 제약 준수
- 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` L327–L341
- 상세: Discord TEXT_INPUT 최대 4000자 제약을 `Math.min(..., 4000)` 으로 cap 처리. minLength 는 `>= 0` (0 허용), maxLength 는 `>= 1` (0 제외) 조건을 올바르게 구분하여 적용.
- 제안: 현재 처리 적절.

### [INFO] `extractFormTitle` — 요청 입력 검증 충분
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L474–L488
- 상세: null/비객체/빈 문자열/공백만 있는 문자열 모두 `undefined` 반환. 비문자열(`number` 등)도 undefined 처리. 두 shape(`{ title }` / `{ config: { title } }`)을 동일 로직으로 수용하여 upstream shape 변화에 방어적.
- 제안: 현재 처리 적절.

### [INFO] `pendingFormModal` title 전파 — IIFE 패턴 사용
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` L313–L318
- 상세: `...(() => { const title = extractFormTitle(modalFormConfig); return title ? { title } : {}; })()` IIFE 패턴으로 title 조건부 spread. 함수 추출 없이 인라인 처리되어 가독성이 다소 낮으나, API 계약 관점에서 `pendingFormModal.title` 에 값이 없을 경우 키 자체를 생략(`{}`)하여 선택적 포함이 올바르게 구현됨.
- 제안: API 계약 관점에서 문제없음. 코드 가독성 개선을 원한다면 헬퍼 함수로 추출 고려(선택사항).

## 요약

이번 변경은 Discord chat-channel 어댑터에 form modal 제목(`title`)과 TEXT_INPUT 길이 제약(`minLength`/`maxLength`) 지원을 추가하는 순수 additive 확장이다. 모든 신규 필드는 옵셔널로 설계되었고, 기존 API 호출자에 대한 breaking change가 없으며, Discord Interactions API의 modal title 45자/TEXT_INPUT 4000자 제약도 클라이언트 측에서 선제 처리되어 API 계약을 준수한다. reply modal title의 truncate 누락과 IIFE 인라인 패턴의 가독성 정도가 참고 수준의 사항이며, 계약 위반이나 위험한 변경은 없다.

## 위험도

NONE
