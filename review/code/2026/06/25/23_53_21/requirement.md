# 요구사항(Requirement) 리뷰

## 분석 대상

커밋 `ed31b821` — `fix(web-chat): 설치 스니펫에 command-queue 스텁 추가 — ClemvionChat ReferenceError 해소`

변경 파일 8개:
- `codebase/frontend/src/lib/web-chat/snippet.ts` (핵심 버그픽스)
- `codebase/frontend/src/lib/web-chat/__tests__/snippet.test.ts`
- `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx`
- `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.en.mdx`
- `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat-sdk.mdx`
- `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat-sdk.en.mdx`
- `spec/7-channel-web-chat/2-sdk.md`
- `plan/in-progress/web-chat-snippet-queue-stub.md`

---

## 발견사항

### **[INFO]** `data-global` 재지정 시 큐 스텁과의 정합성 — 문서·스니펫 미언급

- 위치: `snippet.ts` `buildWebChatSnippet`, `web-chat-sdk.{mdx,en.mdx}` §Renaming the global (`data-global`)
- 상세: `buildWebChatSnippet` 이 생성하는 큐 스텁은 `window.ClemvionChat` 을 하드코딩한다. spec §1 의 `data-global` 기능으로 전역명을 `SupportChat` 으로 바꿀 경우 스텁도 `window.SupportChat=window.SupportChat||function(){…}` 으로 맞춰야 한다. 현재 `buildWebChatSnippet` 은 `data-global` 파라미터를 받지 않으며, 문서의 `data-global` 예시 코드도 큐 스텁이 없는 `async src=...` 단일 태그 형태라 스텁 부재 문제가 그대로 잠재한다. 단, `data-global` 이 콘솔 생성 스니펫에는 노출되지 않는 개발자 전용 고급 기능이므로 현 PR 범위에서 즉시 차단하기에는 분리된 이슈다.
- 제안: 별도 이슈/plan 으로 추적. `web-chat-sdk.{mdx,en.mdx}` §Renaming the global 의 `data-global` 예시에도 큐 스텁 또는 "스텁 포함 CDN 블록 대체" 안내를 추가하면 재drift 예방. 현 PR 차단 사항은 아님.

### **[INFO]** `spec/7-channel-web-chat/2-sdk.md` — §1.4 명령 큐 섹션 본문 부재

- 위치: `spec/7-channel-web-chat/2-sdk.md` 전체
- 상세: `snippet.ts` JSDoc 과 plan 파일이 "spec 2-sdk §1.4 명령 큐 패턴" 을 다수 참조하지만 spec 본문에 `## 1.4` 또는 `### 1.4` 서브섹션이 존재하지 않는다. 내용은 §1 산문과 R5 Rationale 에 분산 기술됐다. 의미적으로는 §1 전체를 가리키는 것으로 간주 가능하며 동작에 영향 없는 참조 부정확이다.
- 제안: 코드·plan 에서 "§1.4" 로 참조하는 명령 큐 내용을 spec §1 서브섹션으로 명시화하거나, 참조를 "§1 (명령 큐 패턴)" 으로 정정. 현 PR 차단 사항은 아님.

### **[INFO]** `WebChatBootInput` 에 `profile` 필드 누락

- 위치: `codebase/frontend/src/lib/web-chat/snippet.ts` `WebChatBootInput` 인터페이스
- 상세: spec `2-sdk.md §4 BootConfig` 에는 `profile?: Record<string, unknown>` 필드가 있으나 `WebChatBootInput` 과 `buildBootConfig` 에 `profile` 필드가 없어 콘솔 생성 스니펫으로는 profile 주입이 불가하다. 단, plan 파일에 "npm SDK 경로는 본 버그와 무관" 이라 명시되고 profile 은 개발자용 고급 기능이므로 본 PR 의 fix 범위 밖이다.
- 제안: 기존 알려진 gap(channel-web-chat-followups 트래킹 대상). 현 PR 차단 사항 아님.

---

## 요약

`buildWebChatSnippet` 에 command-queue 스텁을 추가해 `ReferenceError` 를 해소하는 핵심 버그픽스가 올바르게 구현됐다. 스텁 패턴(`window.ClemvionChat=window.ClemvionChat||function(){(…q…).push(arguments)}`)이 spec `2-sdk.md §1`·R5 와 일치하며, 스텁이 loader 생성보다 앞에 위치하는 순서도 정확하다. 테스트 2건(스텁 존재·순서)이 regression 방지를 충분히 커버한다. spec·유저 가이드(KO/EN) 4파일·plan 파일이 일관되게 갱신됐다. TODO/FIXME/HACK 주석 없음. 발견된 이슈 3건은 모두 INFO 등급으로 기존 known-gap 또는 본 PR 범위 밖의 별도 추적 대상이다. 요구사항(ReferenceError 수정·6곳 동기화·테스트 추가)은 완전히 충족됐다.

## 위험도

NONE
