# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/web-chat-snippet-queue-stub.md`
검토 모드: --impl-prep (구현 착수 전)

---

## 발견사항

신규 식별자 충돌이 없음을 확인했다.

target plan 이 도입하거나 수정하는 식별자들을 항목별로 점검했다:

**1. 요구사항 ID 충돌**

target plan 에 새로 부여하는 요구사항 ID 가 없다. 기존 `spec/7-channel-web-chat/2-sdk.md §1.4` 의 "단일 전역 진입점 + 명령 큐" 요구사항을 참조만 한다.

**2. 엔티티/타입명 충돌**

- `buildWebChatSnippet` — 이미 `codebase/frontend/src/lib/web-chat/snippet.ts:100` 에 존재하는 함수. plan 은 해당 함수의 **내부 로직(스텁 추가)**만 수정하며 시그니처·이름 변경 없음. 충돌 없음.
- `WebChatBootInput` — 이미 `snippet.ts:15` 에 정의된 인터페이스. 신규 타입명 없음.
- `escapeForScript` — 이미 `snippet.ts:87` 에 존재하는 내부 함수. plan 이 이 함수의 비적용 대상(스텁 문자열)을 명시하여 기존 정의와 일치한다.

**3. API endpoint 충돌**

target plan 이 도입하는 신규 API endpoint 없음. 백엔드/로더 변경 불필요(plan §주의 명시).

**4. 이벤트/메시지명 충돌**

- `ClemvionChat` — 이미 `spec/7-channel-web-chat/2-sdk.md §1` 및 `loader.ts:71` (`DEFAULT_GLOBAL_NAME`) 에 정의된 전역명. plan 이 추가하는 큐 스텁(`window.ClemvionChat.q`) 역시 기존 `loader.ts:97` 의 `existing?.q` replay 경로 및 `examples/snippet.html:19-22` 의 스텁과 **정합**한다. 신규 이름 없음.

**5. 환경변수·설정키 충돌**

target plan 이 도입하는 신규 ENV var·config key 없음.

**6. 파일 경로 충돌**

plan 이 수정 대상으로 명시한 파일들:

- `codebase/frontend/src/lib/web-chat/snippet.ts` — 기존 존재.
- `spec/7-channel-web-chat/2-sdk.md` — 기존 존재.
- `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx` — 기존 존재.
- `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.en.mdx` — 기존 존재.
- `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat-sdk.mdx` — 기존 존재.
- `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat-sdk.en.mdx` — 기존 존재.
- `codebase/frontend/src/lib/web-chat/__tests__/snippet.test.ts` — 기존 존재. plan 이 테스트 추가를 명시하지만 파일 신규 생성이 아닌 기존 파일 확장.

신규 파일 경로 없음. 모든 수정 대상이 기존 경로·컨벤션과 일치한다.

---

## 요약

`web-chat-snippet-queue-stub.md` 는 `buildWebChatSnippet` 의 큐 스텁 누락이라는 구현 drift 를 수정하는 순수 bugfix plan 이다. 신규 식별자(요구사항 ID, 타입명, endpoint, 이벤트명, ENV var, 파일 경로)를 전혀 도입하지 않는다. 수정 대상 식별자(`ClemvionChat`, `buildWebChatSnippet`, `window.ClemvionChat.q`)는 모두 기존 spec·코드에서 이미 정의된 이름이며, plan 이 추가하는 스텁 패턴은 `packages/web-chat-sdk/examples/snippet.html:18-22` 및 `loader.ts:97` 의 기존 구현과 완전히 정합한다. 충돌 위험 없음.

---

## 위험도

NONE
