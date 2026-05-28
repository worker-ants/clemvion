# 보안(Security) 리뷰 — chat-channel-form-native-modal

리뷰 대상: §4.1 native modal 게이팅 구현 (파일 1~27)
리뷰 일시: 2026-05-29

---

## 발견사항

### 인젝션 취약점

- **[INFO]** Discord `custom_id` 값 직접 사용
  - 위치: `discord-update.parser.ts` — `if (i.data?.custom_id === '__open_form__')`, `if (modalId === 'clemvion_form')`
  - 상세: `custom_id` 를 상수 비교로만 사용하며, 값을 SQL/명령어/경로로 전달하지 않는다. 인젝션 위험 없음.
  - 제안: 현행 유지.

- **[INFO]** Slack `view.private_metadata` 를 `conversationKey` 로 신뢰
  - 위치: `slack-update.parser.ts` — `const conversationKey = typeof view.private_metadata === 'string' ? view.private_metadata : '';`
  - 상세: `private_metadata` 는 Slack 이 modal open 시 서버가 직접 set 한 값 (`params.conversationKey`) 을 그대로 돌려주는 슬롯이다. Slack HMAC 서명 검증이 upstream 에서 수행된다고 가정하면(기존 hooks 인증 레이어) 이 값은 위조가 어렵다. 그러나 서명 검증 없이 이 값을 DB key 로 그대로 사용하면 경로 조작 위험이 존재한다.
  - 제안: `conversationKey` 가 예상 채널 형식(예: Slack DM/채널 ID 패턴)에 맞는지 별도 정규식 또는 whitelist 검증을 추가하는 것이 방어 깊이를 높인다.

- **[WARNING]** `form_submission.fields` 값이 workflow 엔진으로 비검증 전달
  - 위치: `hooks.service.ts` — `await this.interactionService.interact(ctx, { command: 'submit_form', nodeId, data: update.command.fields })`
  - 상세: Discord MODAL_SUBMIT 과 Slack view_submission 에서 파싱된 `fields` (`Record<string, string>`) 는 순수 string map 이다. 이 값은 EIA `submit_form` 의 `data` 필드로 그대로 전달된다. 워크플로 노드(Form node) 가 필드 타입별 서버 측 검증(이메일 형식, 숫자 범위 등)을 수행하지 않으면, 악의적 사용자가 임의 문자열을 `data` 에 주입해 다운스트림 처리 로직에 영향을 줄 수 있다. 현재 코드 범위에서는 Form 노드의 서버 검증 여부를 확인할 수 없다.
  - 제안: `interactionService.interact` 또는 Form 노드 내부에서 필드별 타입 검증을 반드시 수행해야 한다. `hooks.service.ts` 레이어에서도 필드 key 가 `pendingFormModal.fields[].name` 집합에 속하는지 허용 목록(allowlist) 검사를 추가하면 노드 ID를 알아도 임의 필드 주입을 방지할 수 있다.

### 하드코딩된 시크릿

- **[INFO]** 시크릿 직접 포함 없음
  - 위치: 변경된 전체 파일
  - 상세: 신규 코드에 API 키, 토큰, 비밀번호 등의 하드코딩된 시크릿이 없다. 테스트 코드의 `'xoxb-test-token'` 은 테스트 픽스처 내부에서만 사용되며 실 운영 환경에 노출되지 않는다.

### 인증/인가

- **[CRITICAL]** `open_form_modal` 처리 시 `channelUserKey` 검증 누락
  - 위치: `hooks.service.ts` — `if (update.command.kind === 'open_form_modal') { if (state?.pendingFormModal && adapter.openFormModal) { ... } }`
  - 상세: `open_form_modal` 명령 처리 경로에서 `state.channelUserKey` 와 `update.channelUserKey` 의 일치 여부를 확인하지 않는다. 즉, 동일 채널(`conversationKey`)에 접근 가능한 다른 사용자가 `__open_form__` 버튼을 클릭해 `open_form_modal` 이벤트를 발생시키면, 원래 사용자의 `pendingFormModal` (nodeId + fields) 에 접근해 modal 을 열 수 있다. 그룹 채널 시나리오에서는 다른 멤버가 다른 사람의 폼 양식을 가로채 열거나 제출하는 것이 가능하다.
  - 제안: `state.channelUserKey !== update.channelUserKey` 이면 `open_form_modal` 및 `form_submission` 처리를 거부하고 경고 로그를 남겨야 한다. 기존 `text_message` / `button_callback` 경로에도 동일 user guard 가 적용되는지 확인하고 일관되게 적용할 것.

- **[CRITICAL]** `form_submission` 처리 시 `channelUserKey` 검증 누락
  - 위치: `hooks.service.ts` — `if (update.command.kind === 'form_submission') { const nodeId = state?.pendingFormModal?.nodeId; if (hasActiveExecution && nodeId) { ... interact ... } }`
  - 상세: 위와 동일 구조. `form_submission` 시 `state.channelUserKey` 검증 없이 `submit_form` 이 호출된다. 공유 채널에서 다른 사용자가 clemvion_form MODAL_SUBMIT 을 위조하면 타인의 실행 흐름에 폼 데이터를 제출할 수 있다.
  - 제안: `open_form_modal` 과 동일하게 `channelUserKey` 일치 검사 추가.

- **[WARNING]** `pendingFormModal` 의 부재 시 silent 무시 — DoS 잠재성
  - 위치: `hooks.service.ts` — `if (state?.pendingFormModal && adapter.openFormModal)` 없으면 `return { executionId: ... }`
  - 상세: `pendingFormModal` 이 없는데 `open_form_modal` 이 들어오면 단순 무시한다. 이는 기능 안전성 면에서 올바르지만, 반복 클릭/폼 요청이 쏟아지면 DB lookup(conversationService.lookup) 이 계속 발생한다. 별도 rate limiting 이 없다면 경미한 DoS 경로가 될 수 있다.
  - 제안: 이 경로에 대한 rate limiting 을 hooks 레이어 또는 API gateway 에서 적용할 것.

- **[INFO]** Discord interaction token 15분 만료 처리 없음
  - 위치: `discord-update.parser.ts`, `discord.adapter.ts`
  - 상세: Discord `interactionToken` 은 15분 유효하며, Slack `trigger_id` 는 3초 유효하다. 만료 후 `openFormModal` 호출 시 Discord/Slack API 가 오류를 반환하지만, 현재 코드에서 이를 별도 처리하지 않고 `markDegraded` 없이 일반 오류로 흐른다. 보안 관점보다는 UX 이슈이나, 만료된 토큰에 대한 오류 메시지가 사용자에게 노출되지 않도록 에러 처리가 필요하다.
  - 제안: `openFormModal` 실패 시 사용자에게 재시도 안내 응답을 보내고 내부 로그를 남기는 핸들러를 추가할 것.

### 입력 검증

- **[WARNING]** `extractFormFields` 에서 `f.name` 이 DB key 로 사용되는 경우 주입 위험
  - 위치: `form-mode.ts` — `const name = typeof f.name === 'string' ? f.name : '';`
  - 상세: `formConfig` 는 EIA waiting_for_input 페이로드에서 오며, 이 페이로드는 워크플로 정의에서 비롯된다. 워크플로 정의 자체가 신뢰된 출처라면 문제없으나, 워크플로 정의에 악의적인 `name` 값(`../../admin`, `\n`, SQL 특수문자 등)이 포함될 수 있는 경우 `field.name` 이 `pendingFormModal.fields[].name` 으로 저장되고 이후 `form_submission` 시 필드 키로 사용된다. 현재 코드에서 `name` 에 대한 형식 검증이 없다.
  - 제안: `name` 은 알파벳/숫자/언더스코어 조합(예: `/^[a-zA-Z0-9_\-]{1,64}$/`)으로 제한하는 정규식 검증을 `extractFormFields` 에 추가할 것.

- **[WARNING]** `form_submission.fields` 의 키 수 무제한
  - 위치: `discord-update.parser.ts` — `for (const tc of components.flatMap(...))`
  - 상세: Discord MODAL_SUBMIT 의 컴포넌트 수를 상한 없이 이터레이션하여 `fields` Record 를 구성한다. 악의적인 클라이언트가 다수의 컴포넌트를 보내면 메모리/처리 부하가 발생할 수 있다.
  - 제안: 처리할 필드 수를 `NATIVE_MODAL_MAX_FIELDS` (5) 로 제한하거나, `pendingFormModal.fields` 의 name 집합 기반 allowlist 로 필터링할 것.

- **[INFO]** `formConfig` 원본이 `form_modal` body 에 포함 (`formConfig: unknown`)
  - 위치: `types.ts` — `| { kind: 'form_modal'; openLabel: string; formConfig: unknown }`
  - 상세: `formConfig` 는 `unknown` 타입으로 전달되어 어댑터가 modal view 합성 시 읽는다. renderer 가 `event.context?.formConfig` 를 그대로 body 에 담고, dispatcher 가 이를 `(modalMsg.body as { formConfig: unknown }).formConfig` 로 캐스팅해 `extractFormFields` 에 넘긴다. 타입 캐스팅이 런타임 검증 없이 이루어지므로 `extractFormFields` 의 방어적 파싱에 의존한다. `extractFormFields` 는 현재 충분히 방어적으로 작성되어 있어 직접적 위협은 낮다.
  - 제안: `form_modal` body 의 `formConfig` 를 `unknown` 이 아닌 `FormModalField[]` 로 이미 정규화된 형태로 넘기도록 타입을 강화하면 런타임 방어 의존도를 줄일 수 있다.

### OWASP Top 10

- **[WARNING]** A01 – 권한 검증 누락 (위 CRITICAL 항목과 동일)
  - 위치: `hooks.service.ts`
  - 상세: CRITICAL 발견사항과 동일. `open_form_modal` / `form_submission` 경로에서 사용자 식별(channelUserKey) 검증 부재.

- **[INFO]** A03 – 인젝션: 현재 코드에서 SQL/LDAP/명령 인젝션 경로 없음. 워크플로 데이터 주입 위험은 WARNING 항목에서 다룸.

- **[INFO]** A04 – 불안전한 설계: modal open 후 submit 까지 상태(`pendingFormModal`)가 Redis 등 대화 상태 저장소에 유지된다. 대화 상태가 탈취되면 nodeId와 fields 정보가 노출될 수 있으나, 이는 기존 formState 와 동일한 위협 모델이므로 신규 위험은 아니다.

- **[INFO]** A08 – 소프트웨어 무결성: `supportsNativeForm` 이 adapter 인터페이스에 선언된 `readonly` 필드로 런타임에 변경 불가. 신뢰 경계 명확.

### 암호화

- **[INFO]** 신규 코드에 암호화/해시 알고리즘 도입 없음
  - 상세: `interactionToken`, `triggerId` 등 provider 토큰은 외부(Discord/Slack)에서 발급되는 값으로, 코드 내에서 암호화/복호화/해시를 수행하지 않는다. 이들 토큰의 암호화 강도는 provider 책임이다.

- **[INFO]** `private_metadata` 는 평문 전송
  - 위치: `slack.adapter.ts` — `private_metadata: params.conversationKey`
  - 상세: Slack modal 의 `private_metadata` 에 `conversationKey` (채널 ID)를 평문으로 설정한다. Slack API 가 TLS 를 사용하므로 전송 중 노출은 없으나, Slack 서버 측에서 이 값을 읽을 수 있다. 민감 식별자(내부 채널 ID)가 Slack 에 노출되는 점을 수용 가능한지 설계 수준에서 확인이 필요하다. 현재 구조에서 대안(암호화 후 전달)은 복잡도를 높이므로 위험을 수용하더라도 문서화가 권장된다.

### 에러 처리

- **[WARNING]** `form_submission` 오류 시 에러 메시지가 사용자에게 노출될 수 있음
  - 위치: `hooks.service.ts` — `validationError: { message: '입력값을 다시 확인해주세요.' }`
  - 상세: `submit_form` 실패 catch 블록에서 `'입력값을 다시 확인해주세요.'` 라는 고정 문자열을 사용하므로 내부 오류 상세가 사용자에게 노출되지 않는다. 이는 적절한 처리이다.

- **[INFO]** Discord `buildFormSubmissionResponse` 에서 에러 메시지 반영
  - 위치: `discord.adapter.ts` — `` `⚠️ ${params.validationError.message}` ``
  - 상세: `validationError.message` 가 최종 사용자에게 그대로 표시된다. 이 메시지의 출처가 `hooks.service.ts` 의 고정 문자열이면 안전하나, 향후 코드 변경으로 내부 예외 메시지가 전달될 경우 정보 노출 위험이 있다.
  - 제안: `buildFormSubmissionResponse` 의 `validationError.message` 는 항상 사용자 친화적 메시지만 받도록 호출 사이트를 제한하거나, 내부에서 일반 메시지로 치환하는 가드를 추가할 것.

- **[INFO]** Discord 의 `form_modal` exhaustiveness guard 가 내부 에러 메시지를 포함
  - 위치: `telegram.adapter.ts` — `throw new Error('Telegram 은 native form modal 미지원 (supportsNativeForm=false)')`
  - 상세: 이 예외는 내부 guard 용이며 실제로 도달하면 안 되는 경로이다. 예외가 상위로 전파되어 HTTP 응답에 포함될 경우 내부 구현 정보가 노출될 수 있다.
  - 제안: `HooksService` 의 `renderNode` 오류 핸들러(`markDegraded`)가 이 예외를 포착해 외부에 노출하지 않도록 처리 흐름을 확인할 것. 이미 `try/catch` 블록으로 감싸져 있다면 문제없다.

### 의존성 보안

- **[INFO]** 신규 외부 라이브러리 도입 없음
  - 상세: 변경된 파일은 기존 NestJS, Slack/Discord 클라이언트를 사용하며 신규 npm 패키지 의존성을 추가하지 않는다. 기존 의존성의 취약점은 별도 SCA(Software Composition Analysis) 도구로 관리해야 한다.

---

## 요약

이번 변경은 Slack/Discord native modal 폼 처리를 위한 신규 커맨드(`open_form_modal`, `form_submission`)와 어댑터 메서드(`openFormModal`, `buildFormSubmissionResponse`)를 도입한다. 전반적으로 방어적 파싱(`extractFormFields`), 타입 검증, provider 별 capability flag(`supportsNativeForm`) 분리가 잘 설계되어 있다. 그러나 가장 중요한 보안 결함은 `hooks.service.ts` 에서 `open_form_modal` 및 `form_submission` 명령 처리 시 `state.channelUserKey` 와 `update.channelUserKey` 의 일치 검증이 누락된 점이다. 그룹/공유 채널 환경에서 다른 사용자가 타인의 폼을 가로채 열거나 제출하는 인가 우회가 가능하다. 또한 `form_submission.fields` 의 키가 `pendingFormModal.fields` 의 allowlist 로 필터링되지 않아 임의 필드 주입 위험이 있으며, `field.name` 에 대한 형식 검증이 없어 다운스트림 처리 의존성이 존재한다. 이 두 CRITICAL 건과 복수의 WARNING 을 수정한 뒤 재검토를 권장한다.

---

## 위험도

**HIGH**

> channelUserKey 검증 누락(CRITICAL 2건)이 미수정 상태로 릴리즈되면 그룹 채널에서 타인 폼 가로채기가 가능하므로 HIGH 로 평가한다. 단일 사용자 DM 채널 전용 배포라면 MEDIUM 으로 조정 가능하다.
