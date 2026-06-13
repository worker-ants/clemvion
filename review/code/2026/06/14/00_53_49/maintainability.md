# 유지보수성(Maintainability) Review

## 발견사항

### [WARNING] IIFE 스프레드 패턴 — 가독성·의도 불명확
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` L311-314 (diff hunk)
- 상세: `...(() => { const title = extractFormTitle(modalFormConfig); return title ? { title } : {}; })()` 형태의 IIFE 스프레드는 TypeScript 코드베이스에서 관용적이지 않다. 조건부 프로퍼티 추가라는 목적은 명확하지만, 클로저·즉시 호출·스프레드가 한 줄에 중첩돼 처음 읽는 사람이 역할을 파악하는 데 시간이 걸린다. 동일 파일 내 다른 곳(예: `discord.adapter.ts` L1558-1560)에서 `...(application.verify_key ? { publicKey: application.verify_key } : {})` 처럼 단순 삼항 스프레드를 사용하는 것과 스타일이 일치하지 않는다.
- 제안: 중간 변수를 미리 선언해 스프레드에 넣거나, IIFE 없이 삼항 스프레드로 통일한다.
  ```ts
  const title = extractFormTitle(modalFormConfig);
  state.pendingFormModal = {
    nodeId: channelEvent.node.id,
    fields: extractFormFields(modalFormConfig),
    ...(title ? { title } : {}),
  };
  ```

### [WARNING] `modalFormConfig` 지역 변수 추출 — 위치 적절하나 범위가 `if` 블록 안으로 제한될 수 있음
- 위치: `chat-channel.dispatcher.ts` L304-305 (diff hunk)
- 상세: `modalFormConfig` 는 `modalMsg` 존재 확인 직후 추출되므로 논리 흐름은 옳다. 그러나 이미 `extractFormFields` 호출 시 `(modalMsg.body as { formConfig: unknown }).formConfig` 를 인라인 캐스팅하던 패턴을 지역 변수로 올린 것이어서 변경 자체는 긍정적이다. 이 부분의 중간 변수 도입(리팩터) 목적과 기능 변경(IIFE 추가)이 한 diff 에 혼재해 있어 의도를 분리하기 어렵다.
- 제안: 별도 리팩터 커밋으로 분리하거나, 주석에 "로컬 변수 도입 목적 = 중복 캐스팅 제거" 를 명시한다.

### [INFO] `openFormModal` 내 `rawTitle` 매직 리터럴 `45`
- 위치: `discord.adapter.ts` L1917 (`rawTitle.slice(0, 45)`)
- 상세: `45` 는 Discord modal title 최대 길이로 spec §3.3 에서도 명시한 수치이나, 코드에 상수로 추출되지 않아 의미를 알려면 주석이나 spec 문서를 참조해야 한다. `4000` (TEXT_INPUT max), `100` (placeholder max) 등 다른 Discord API 상수도 모두 인라인으로 분산돼 있다.
- 제안: 파일 상단 또는 공유 상수 파일에 `DISCORD_MODAL_TITLE_MAX_LEN = 45`, `DISCORD_TEXT_INPUT_MAX_LEN = 4000`, `DISCORD_PLACEHOLDER_MAX_LEN = 100` 등으로 추출한다.

### [INFO] `openFormModal` 내 매직 숫자 `4000` (2회) 및 `100` 
- 위치: `discord.adapter.ts` L1930-1938 (diff hunk)
- 상세: `Math.min(f.minLength, 4000)`, `Math.min(f.maxLength, 4000)`, `f.description.slice(0, 100)` 모두 Discord API 문서 기준 상수이나 인라인 하드코딩. 위 INFO 와 동일 문제.
- 제안: 위와 같이 명명 상수로 추출.

### [INFO] `discord.adapter.ts` `sendMessage` 함수 길이 및 분기 수
- 위치: `discord.adapter.ts` L1791-1859
- 상세: `sendMessage` 는 본 PR 에서 직접 변경되지 않았지만, 전체 파일 컨텍스트에서 `text` / `buttons` / `form_prompt` / `form_modal` / `image` / `typing` 6개 body 종류를 단일 메서드에서 분기한다. 현재 크기(~70 라인, 순환 복잡도 ~7)는 경계 수준이다. 변경이 누적될 경우 유지보수 부담이 증가할 수 있다.
- 제안: 즉시 리팩터는 필요 없으나, body 종류가 추가될 때 private helper 로 분리(`sendTextMessage`, `sendButtonsMessage` 등)를 권장한다.

### [INFO] `extractFormFields` 내 `FIELD_NAME_RE` 정규식 함수 내부 선언
- 위치: `form-mode.ts` L2567 (전체 파일 컨텍스트 기준)
- 상세: `const FIELD_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;` 이 `extractFormFields` 함수 바디 안에 선언돼 있어 호출 시마다 정규식 객체가 재생성된다. 본 PR 의 변경 대상은 아니나, 신규 추가된 `validation` 블록과 같은 파일이어서 언급한다.
- 제안: 모듈 최상위로 이동해 `EMAIL_RE`, `NUMBER_RE` 와 동일한 위치에 배치.

### [INFO] `discord.adapter.spec.ts` — `openFormModal` 관련 테스트에서 `DiscordAdapter` 인스턴스를 매번 생성
- 위치: `discord.adapter.spec.ts` L1056-1087 (diff hunk)
- 상세: 3개의 신규 테스트(`§3.3 title 미지정`, `§3.3 title 지정`, `§3.3 TEXT_INPUT 길이 제약`) 가 각각 `new DiscordAdapter(new DiscordClient(), makeSecretsMock())` 를 반복 생성한다. 기존의 `describe('§4.1 openFormModal')` 블록(L1370-) 에서도 같은 패턴이 반복된다. `beforeEach` 로 공통화하면 중복이 줄고 새 테스트 추가 시 일관성이 유지된다.
- 제안: `describe` 블록 상단에 `let adapter: DiscordAdapter; beforeEach(() => { adapter = new DiscordAdapter(new DiscordClient(), makeSecretsMock()); });` 패턴 도입.

### [INFO] `hooks.service.ts` diff — 조건부 스프레드 스타일 일관성
- 위치: `hooks.service.ts` L385-361 (diff hunk)
- 상세: `...(state.pendingFormModal.title ? { title: state.pendingFormModal.title } : {})` 패턴은 `discord.adapter.ts` 의 `...(application.verify_key ? { publicKey: application.verify_key } : {})` 와 일치해 코드베이스 내 일관성은 양호하다. 다만 `chat-channel.dispatcher.ts` 의 IIFE 스프레드와 다른 스타일을 사용하므로 dispatcher 의 패턴만 동일 형태로 통일하면 스타일이 완전히 통일된다.
- 제안: `chat-channel.dispatcher.ts` 의 IIFE 스프레드를 이 형태로 교체.

---

## 요약

이번 변경(§3.1 publicKey 캐시, §3.3 modal title 동적화 + TEXT_INPUT 길이 제약, §5.1(b) reply 버튼 테스트 보강)은 전반적으로 유지보수성 관점에서 양호하다. `extractFormTitle` 은 `extractFormFields` 와 동일한 dual-shape 패턴을 깔끔하게 재사용하고, `FormModalField` 타입 확장과 테스트 커버리지 추가는 회귀 방지에 효과적이다. 주요 개선 포인트는 `chat-channel.dispatcher.ts` 의 IIFE 스프레드 패턴으로, 코드베이스 내 다른 조건부 스프레드 방식과 일치하지 않아 가독성을 저해한다. Discord API 경계 상수(`45`, `4000`, `100`)가 여러 위치에 인라인 하드코딩된 점도 향후 API 제한 변경 시 누락 위험이 있어 명명 상수 추출을 권장한다. 테스트 파일 내 어댑터 인스턴스 반복 생성은 기능적 문제는 아니나 설정 중복을 낳는다.

## 위험도

LOW
