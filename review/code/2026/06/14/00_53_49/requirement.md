# 요구사항(Requirement) Review — Discord Gaps 구현

## 발견사항

---

### **[WARNING]** `[SPEC-DRIFT]` discord.md §3.1 — botIdentity pseudo-code 가 spec 에서 업데이트됐지만 Convention chat-channel-adapter.md §2.3 의 `botIdentity` 타입 정의는 여전히 `publicKey?` 없음

- 위치: `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md §2.3` (ChatChannelConfig 인터페이스 botIdentity 행)
- 상세: `chat-channel-adapter.md §2.3` 의 ChatChannelConfig 타입 선언에서 `botIdentity?: { botId: number; username: string; teamId?: string }` 로만 정의돼 있고 Discord에서 추가된 `publicKey?: string` 필드가 없다. 코드(`types.ts`)와 discord.md 는 모두 갱신됐으나 Convention 의 타입 스니펫이 낡았다.
- 제안: 코드 유지 + `spec/conventions/chat-channel-adapter.md §2.3` botIdentity 타입 스니펫에 `/** (Discord) §3.1 — verify_key cache */ publicKey?: string;` 추가.

---

### **[WARNING]** `title` 이 `pendingFormModal` 에 저장되지만 `hooks.service.ts` 는 `title` 전달을 조건부 spread 로 수행 — `title: undefined` 인 경우도 spread 없음으로 처리돼 어댑터 fallback이 정상 동작하나, 타입 엄밀성 약함

- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` 385~388줄 (변경 diff)
- 상세: `state.pendingFormModal.title` 이 falsy(`undefined` 또는 빈 문자열)이면 `title` 키를 `openFormModal` params 에서 생략한다. `extractFormTitle` 이 이미 trim 후 빈 문자열을 `undefined` 로 반환하므로 실제 "" 가 저장될 가능성은 없어 동작 상 문제없다. 단 `title: ''` 이 `ChannelConversationState.pendingFormModal.title` 타입에 포함되므로 (string | undefined), 방어적으로 `|| state.pendingFormModal.title.trim().length === 0` 추가 조건이 없으면 공백 문자열이 어댑터에 전달될 수 있다. 현재 `extractFormTitle` 이 trim·공백 차단을 이미 수행하므로 실질 위험은 낮지만, 저장 경로와 전달 경로가 분리돼 있어 향후 다른 코드가 `pendingFormModal.title`에 직접 쓰는 경우 보호가 없다.
- 제안: `hooks.service.ts` 의 spread 조건을 `state.pendingFormModal.title && state.pendingFormModal.title.trim().length > 0` 로 강화하거나, `ChannelConversationState.pendingFormModal.title` 타입 계약에 "반드시 비어있지 않은 문자열" 주석을 추가해 의도를 명시한다. (낮은 위험도이므로 WARNING)

---

### **[INFO]** `minLength=0` 은 Discord TEXT_INPUT 에서 `min_length: 0` 으로 전달됨 — 의미론적으로 "최솟값 없음"과 동일하나 불필요한 필드 노출

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` 1919~1921줄, `form-mode.ts` 2578~2582줄
- 상세: `extractFormFields` 는 `validation.minLength >= 0` (0 포함)이면 `field.minLength = 0` 으로 저장하고, `discord.adapter.ts` 의 `openFormModal` 도 `minLength >= 0` 조건이라 `min_length: 0` 을 Discord API에 전달한다. Discord API 에서 `min_length=0` 은 "입력하지 않아도 됨" 과 동일하므로 기능상 결함은 없다. 테스트(`form-mode.spec.ts`)에서 `minLength: -1` 은 무시하고 `minLength: 8` 은 반영하도록 검증하지만 `minLength: 0` 케이스는 명시적으로 테스트하지 않는다.
- 제안: 필요 시 `minLength > 0` 조건으로 변경해 불필요한 `min_length: 0` 전송을 차단 가능. 현재는 기능 결함 아님.

---

### **[INFO]** `extractFormTitle` 의 `nested` 우선순위 — `direct` 가 없을 때만 `nested` 를 사용하나, 두 shape 이 동시에 있을 경우 `direct` 우선

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` 2608줄
- 상세: `direct ?? nested` 패턴이므로 `{ title: 'A', config: { title: 'B' } }` 인 경우 `'A'` 를 반환한다. 이 동작이 의도적인지 spec에 명시되지 않는다. `extractFormFields` 도 동일하게 `root.fields` 가 있으면 `config.fields` 를 무시하므로 일관성은 있다.
- 제안: spec §3.3 에 "직접 shape(`{ title }`) 우선, wrapping shape(`{ config: { title } }`) 차선" 임을 명시하면 spec-code 일치가 완전해진다. 현재는 INFO.

---

### **[INFO]** `spec/4-nodes/7-trigger/providers/discord.md §5.1(b)` 의 spec 갱신에서 `(a)` 경로 설명이 과거 표현("현재 v1 유일 경로")으로 유지됨

- 위치: `spec/4-nodes/7-trigger/providers/discord.md` 5.1 (a) 항목 본문
- 상세: `(b)` 항목 아래에 "계획상 v1 default UX = (b) modal ... **현재는 (a) `/<prefix> reply` slash 만 동작한다**" 라는 문장이 여전히 존재한다. 이제 (b) 가 구현됐으므로 이 문장은 사실과 다르다. 기능 구현에는 영향 없지만 spec 본문 일관성이 깨진다.
- 제안: 해당 문장을 "(b) 도입 후 현재 두 경로 모두 동작하며 (a) 는 power user 보조 옵션으로 병존한다" 로 갱신.

---

## 요약

변경된 7개 코드 파일(dispatcher, adapter, renderer, form-mode, types, hooks.service) 과 2개 문서(plan, spec)에 걸쳐 §3.1 publicKey 캐시, §3.3 modal title 동적화 + TEXT_INPUT 길이 제약, §5.1(b) Reply 버튼·Modal 흐름이 구현됐다. 핵심 비즈니스 로직(publicKey 저장, title 전파 경로, minLength/maxLength Discord 상한 cap, extractFormTitle 두 shape 수용, pendingFormModal.title → OpenFormModalParams.title 전달)은 모두 올바르게 구현됐으며, 에러 케이스(title 미설정 시 languageHints→'양식' fallback, minLength 음수 차단, maxLength=0 차단)도 코드와 테스트 모두 커버된다. Critical 또는 코드를 되돌려야 할 버그는 발견되지 않았다. 발견된 Warning 1건은 `hooks.service.ts` 의 조건부 spread 에서 `title: ''` 엣지 케이스가 이론상 가능한 것이나, 현재 저장 경로(`extractFormTitle`)가 이를 사전 차단하므로 실질 위험도는 낮다. SPEC-DRIFT 1건은 `chat-channel-adapter.md §2.3` 의 `botIdentity` 타입 스니펫 갱신 누락으로, 코드 동작에는 영향 없고 spec 문서 동기화가 필요하다.

## 위험도

LOW
