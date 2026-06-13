# 보안(Security) Review

## 발견사항

### 인젝션 취약점

- **[INFO]** `extractFormTitle` 반환값이 Discord modal `title` 에 그대로 삽입됨
  - 위치: `/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` L1911–1916 (`openFormModal`)
  - 상세: `rawTitle = params.title ?? ...` → `rawTitle.slice(0, 45)` → Discord REST payload `data.title`. Discord API 는 JSON body 를 받으므로 XSS 직접 위험은 없으나, 제목에 개행·제어문자 등이 포함될 경우 Discord 측에서 reject 되거나 UI 오작동 가능. 현재 45자 truncate 외에 문자셋 정규화 없음.
  - 제안: `title.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 45)` 와 같이 제어문자를 strip 하거나, Discord API 가 허용하는 printable unicode 범위로 명시적 검증 추가.

- **[INFO]** `field.name` 을 Discord TEXT_INPUT `custom_id` 로 직접 사용
  - 위치: `/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` L1924 (`custom_id: f.name`)
  - 상세: `extractFormFields` 에서 이미 `FIELD_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/` 로 name 을 검증하므로 경로 탐색·인젝션은 차단됨. 다만 `openFormModal` 파라미터로 들어오는 `fields` 가 `extractFormFields` 를 경유하지 않고 `HooksService` 에서 직접 `pendingFormModal.fields` 를 전달하는 경로에서는 해당 정규식 보장이 런타임에 재확인되지 않음.
  - 제안: `openFormModal` 내부에서 `custom_id` 대입 전 `FIELD_NAME_RE` 재검증을 한 번 더 수행하거나, 타입 수준에서 validated name 을 별도 branded type 으로 보장.

### 하드코딩된 시크릿

- **[INFO]** 테스트 파일의 mock 값 (`'bot-token-discord'`, `'pk'`, `'secret://triggers/t1/bot-token'`)
  - 위치: `/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.spec.ts` L1148, 1161
  - 상세: 테스트 전용 mock 값이므로 실제 시크릿이 아님. 프로덕션 코드에 하드코딩된 시크릿은 없음. `DISCORD_CONFIG.botTokenRef = 'secret://triggers/t1/bot-token'` 은 SecretStore 참조 경로이며 plaintext 토큰이 아님.
  - 제안: 현재 패턴 유지 (무해).

### 인증/인가

- **[WARNING]** `setupChannel` cross-verify 는 두 값 모두 존재할 때만 동작
  - 위치: `/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` L1683–1695
  - 상세: `if (config.inboundSigningRef)` + `if (expectedPublicKey && application.verify_key && ...)` — 두 조건 중 하나라도 없으면 불일치 검증 자체가 skip 됨. `inboundSigningRef` 가 설정돼 있어도 `expectedPublicKey` 가 빈 문자열이면 조건 `expectedPublicKey &&` 에서 falsy 로 통과. 설정 누락 또는 SecretStore 에 빈 값이 저장된 경우 잘못된 앱 등록을 detect 하지 못할 수 있음.
  - 제안: `expectedPublicKey` 가 빈 문자열이면 별도 경고 로그 또는 명시적 에러를 추가. `inboundSigningRef` 가 있는데 resolve 결과가 빈 문자열인 경우를 비정상 상태로 간주하는 것이 보안상 안전.

- **[INFO]** `pendingFormModal.title` 이 사용자 제출 데이터(formConfig)에서 유래하여 Redis 에 저장됨
  - 위치: `/codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` L308–315, `/codebase/backend/src/modules/hooks/hooks.service.ts` L386–360
  - 상세: `extractFormTitle(modalFormConfig)` 로 추출된 title 이 `pendingFormModal.title` 로 conversation state(Redis)에 저장되고, 이후 `openFormModal` 호출 시 Discord modal 제목으로 사용됨. formConfig 는 execution payload 에서 유래하므로 워크플로우 설계자가 임의 문자열을 주입할 수 있음. 그러나 `extractFormTitle` 이 빈 문자열 및 비문자열을 걸러내고 Discord adapter 가 45자 truncate 를 적용하므로 영향은 제한적. 권한이 있는 워크플로우 설계자가 설정 가능한 범위 내.
  - 제안: 현재 수준의 방어는 충분하나, 향후 title 을 UI 에 표시하는 경로가 추가될 경우 XSS sanitize 를 추가할 것.

### 입력 검증

- **[INFO]** `minLength` / `maxLength` 는 Discord API 에 전달되지만 서버 측 재검증 경로가 명확하지 않음
  - 위치: `/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` L1929–1934
  - 상세: `min_length` / `max_length` 는 Discord modal UI 에서 클라이언트 측 검증을 유도하지만, Discord API 가 길이 위반 submit 을 서버에서 차단하는지는 Discord 정책에 의존. `validateFormSubmission` 함수가 `minLength`/`maxLength` 기준 서버 측 검증을 수행하는지는 본 diff 범위에서 확인되지 않음(`validateFormSubmission` 코드 상 minLength/maxLength 분기 없음).
  - 제안: `validateFormSubmission` 에 `minLength`/`maxLength` 검증 분기를 추가하여 Discord UI bypass(직접 API 호출 등) 에도 서버 측에서 입력 길이를 검증.

- **[INFO]** `extractFormFields` 의 `validation` 객체에 `minLength >= 0` 조건
  - 위치: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L2589
  - 상세: `minLength >= 0` 이므로 0도 허용됨. Discord API 는 `min_length` 가 0인 경우 "최소 0자" 이므로 실질적으로 무의미하지만 API 스펙상 허용 범위. 의도가 "최소 1자"라면 `> 0` 으로 제한하는 것이 정합성에 맞음. 보안 취약점 아님.
  - 제안: 의도에 따라 조건을 `> 0` 으로 변경 검토.

### OWASP Top 10

- **[INFO]** `formConfig` 를 `unknown` 타입으로 수신 후 `as Record<string, unknown>` 캐스팅
  - 위치: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L2555, 2479
  - 상세: TypeScript 타입 가드(`typeof ... === 'object'` 확인)를 선행하고 캐스팅하므로 런타임 오류는 없음. `formConfig` 가 외부 실행 엔진 payload 에서 유래하므로 런타임 shape 이 예측 불가능할 수 있으나, 방어적 분기(null/비객체 → 빈 배열/undefined 반환)가 충분히 구현되어 있음.
  - 제안: 현재 패턴 유지.

### 암호화

- **[INFO]** `hashStringToInt` 함수가 snowflake → botId 변환에 사용됨
  - 위치: `/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` L1973–1978
  - 상세: `h = ((h << 5) - h + charCodeAt) | 0` — Java hashCode 계열의 비암호학적 해시. botId 는 내부 식별자 캐시 목적이므로 암호학적 강도가 불필요. 충돌 가능성은 있으나 auth/authz 에 사용되지 않음. `publicKey` (ed25519) 는 SecretStore 에서 관리되며 이 함수와 무관.
  - 제안: 현재 용도에 적합 (비보안 식별자). 보안 목적 사용 시 교체 필요.

- **[INFO]** `verify_key` (ed25519 public key) 를 `botIdentity.publicKey` 로 config 에 저장
  - 위치: `/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` L1736–1738, `/codebase/backend/src/modules/chat-channel/types.ts` L2821
  - 상세: public key 는 공개 값이므로 DB/config 저장 자체는 보안 문제가 없음. 코멘트(`비민감 public key`) 에서도 명시. inbound 서명 검증의 실제 SoT 는 SecretStore(`inboundSigningRef`)이며 본 캐시는 편의/재검증용.
  - 제안: 현재 설계 적절.

### 에러 처리

- **[INFO]** `wrapSendResult` 에서 Discord API 에러 메시지 전달
  - 위치: `/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` L2012–2016
  - 상세: `throw new Error(\`Discord ${context} failed: ${res.message ?? 'unknown'}\`)` — Discord API 에러 메시지가 exception 에 포함됨. 이 exception 은 `ChatChannelDispatcher.markDegraded` 에서 `.slice(0, 1024)` 로 잘라 DB 에 저장. `validationError.message` 가 사용자에게 Discord ephemeral 메시지로 노출되는 경로(`buildFormSubmissionResponse`)는 워크플로우 검증 로직에서 생성한 메시지이므로 제어 범위 내.
  - 제안: `chatChannelLastError` 에 저장되는 외부 API 에러 메시지가 어드민 UI 에 그대로 노출되는지 확인. 외부 API 에러에 내부 endpoint 경로 등 민감 정보가 포함될 경우 sanitize 필요.

- **[INFO]** `setupChannel` 에서 `getApplicationMe` 실패 시 `app.message` 를 exception 에 포함
  - 위치: `/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` L1668–1670
  - 상세: `Discord getApplicationMe failed: ${app.message ?? 'unknown'}` — Discord API 에러 응답의 `message` 필드가 exception 메시지에 포함. 이 exception 이 최종적으로 어디까지 전파되어 어떤 사용자에게 노출되는지는 본 diff 범위 밖.
  - 제안: 호출 스택 상위에서 이 exception 을 사용자 facing API 응답에 포함할 경우 generic message 로 대체 검토.

### 의존성 보안

- **[INFO]** 본 diff 에서 신규 npm 패키지 추가 없음
  - 상세: 변경 파일이 모두 내부 TypeScript 소스이며 `package.json` / `package-lock.json` 변경 없음. 의존성 보안 감사 불필요.

---

## 요약

이번 변경(Discord §3.1 publicKey 캐시, §3.3 modal title 동적화 + TEXT_INPUT 길이 제약, §5.1(b) Reply 버튼 확인)은 전반적으로 보안 설계가 양호하다. 외부 입력(`formConfig`)에 대한 방어적 파싱(`null`/비객체 guard, `FIELD_NAME_RE` 정규식, 빈 문자열 필터, 45자 truncate)이 다층으로 구현되어 있고, 실제 인증 자료(bot token, ed25519 private key)는 SecretStore 참조(ref)로만 다뤄져 코드에 노출되지 않는다. 주요 주의 사항은 두 가지다: (1) `setupChannel` cross-verify 가 `inboundSigningRef` 또는 `expectedPublicKey` 중 하나가 빈/미설정이면 skip 되므로 잘못된 설정이 silent 통과할 수 있고, (2) `validateFormSubmission` 이 `minLength`/`maxLength` 기준 서버 측 검증을 수행하지 않아 Discord UI bypass 시 길이 제약이 적용되지 않을 수 있다. 두 항목 모두 WARNING/INFO 수준이며 현재 설계 범위 내에서 추가 완화가 권장된다.

---

## 위험도

LOW
