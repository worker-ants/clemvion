# Documentation Review

## 발견사항

### 파일 1: web-chat-sdk.en.mdx (신규)

- **[WARNING]** frontmatter 누락 — locale 대응 파일 불일치
  - 위치: `/codebase/frontend/src/content/docs/06-integrations-and-config/web-chat-sdk.en.mdx` 전체
  - 상세: 같은 디렉터리의 다른 `.en.mdx` 파일들(예: `discord.en.mdx`, `slack.en.mdx`)은 모두 frontmatter(`---` 블록)를 포함한다. `web-chat-sdk.en.mdx`는 frontmatter 없이 본문만 시작한다. `web-chat-sdk.mdx`(KO 파일)에는 `title`, `title_en`, `section`, `order`, `summary`, `summary_en`, `spec`, `code` frontmatter가 있으나 EN 파일에는 전혀 없어 locale pair 구조가 깨진다.
  - 제안: `web-chat-sdk.mdx`와 동일한 frontmatter를 `web-chat-sdk.en.mdx` 상단에 추가한다. spec 8. i18n 규약(KO/EN 동반 갱신 의무)과 일치시킨다.

- **[WARNING]** BYO-UI 섹션에서 `byo-ui-headless.ts` 예제 파일 참조 누락
  - 위치: `web-chat-sdk.en.mdx` §4 Bring Your Own UI
  - 상세: 기존 `web-chat.en.mdx`(이번 커밋에서 교체된 파일)의 BYO-UI 코드 블록에는 `// Full example: codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` 주석이 있었다. 새 `web-chat-sdk.en.mdx`는 이 참조를 제거하고 단순 import 한 줄로만 끝낸다. `byo-ui-headless.ts`는 실제로 존재하며(`codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts`) `startHeadlessChat` 헬퍼(start→SSE→submit)를 포함하는 완전한 예제다. 개발자가 전체 BYO-UI 구현 흐름을 확인할 수 있는 참조가 사라졌다.
  - 제안: §4 코드 블록 아래에 "전체 예제: `packages/web-chat-sdk/examples/byo-ui-headless.ts`" 안내 링크 또는 주석을 복원한다.

- **[INFO]** boot config 필드 테이블에서 `appearance.zIndex`, `launcher.suggestions` 누락
  - 위치: `web-chat-sdk.en.mdx` §1 CDN snippet 필드 표
  - 상세: `BootConfig` 타입(`codebase/packages/web-chat-sdk/src/types.ts`)에는 `appearance.zIndex`와 `launcher.suggestions` 필드가 있고 spec(`spec/7-channel-web-chat/2-sdk.md` §4)에도 명시되어 있다. 현재 표에는 `apiBase`, `triggerEndpointPath`, `locale`, `headerTitle`, `welcome.text`, `welcome.suggestions`, `disclaimer` 7개 필드만 있고 나머지는 누락되어 있다. `appearance.position`도 표에서는 빠져 있다(코드 예시에만 등장).
  - 제안: 필드 표에 `appearance.primaryColor`, `appearance.position`, `appearance.zIndex`, `launcher.suggestions` 행을 추가한다. 단, phase/구현 범위 표시가 필요하면 spec 표현("현 phase")을 그대로 반영한다.

---

### 파일 2: web-chat-sdk.mdx (신규 KO)

- **[WARNING]** BYO-UI 섹션에서 `byo-ui-headless.ts` 예제 파일 참조 누락 (EN과 동일)
  - 위치: `web-chat-sdk.mdx` §4 자체 UI (BYO-UI)
  - 상세: KO 버전의 원본(`web-chat.mdx`) BYO-UI 절에는 `// 전체 예시: codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts 참고` 주석이 있었다. 새 `web-chat-sdk.mdx`에서는 이 참조가 제거됐다. KO와 EN 모두 동일하게 누락.
  - 제안: §4 코드 블록 하단에 `packages/web-chat-sdk/examples/byo-ui-headless.ts` 참조 복원.

- **[INFO]** boot config 필드 테이블에서 `appearance.zIndex`, `launcher.suggestions` 누락
  - 위치: `web-chat-sdk.mdx` §1 CDN 스니펫 필드 표
  - 상세: EN 파일과 동일한 문제. `appearance.position`은 코드 예시에만 등장하고 표에는 없다.
  - 제안: EN 파일과 동일하게 누락 필드 추가.

---

### 파일 3: web-chat.en.mdx (수정)

- **[INFO]** 삭제(delete) 동작에 대한 사용자 가이드 미제공
  - 위치: `web-chat.en.mdx` 전체 (§2 Creating a web chat 및 Tips)
  - 상세: RBAC Callout("Creating, deleting, and editing the appearance of a web chat requires the **editor** role or above")에서 삭제를 언급하지만, 실제로 삭제하는 방법은 문서 어디에도 없다. spec §7에도 `editor+`가 삭제 권한을 갖는다고 명시되어 있다.
  - 제안: §2 또는 별도 섹션에 삭제 방법(예: 목록에서 인스턴스 선택 후 삭제 버튼)을 한 줄이라도 추가하거나, Tips에 주의 문구로 안내한다. 현재 단계에서 UI 미구현이라면 "삭제" 언급을 RBAC Callout에서 제거해 혼란을 줄인다.

---

### 파일 4: web-chat.mdx (수정)

- **[INFO]** 삭제(delete) 동작에 대한 사용자 가이드 미제공 (EN과 동일)
  - 위치: `web-chat.mdx` §2 웹채팅 만들기 Callout
  - 상세: "웹채팅 생성·삭제·외형 편집은 편집자(editor) 이상 역할이 필요해요."에서 삭제를 언급하나 실제 삭제 방법이 없다.
  - 제안: EN과 동일하게 처리.

---

## 요약

이번 변경은 단일 페이지에 혼재해 있던 운영 콘솔 가이드(non-code)와 SDK 개발자 가이드(code)를 명확히 분리한 높은 품질의 문서화 작업이다. 콘솔 가이드(`web-chat.mdx/en`)는 구조화된 단계별 섹션·ImplAnchor·상호 링크가 잘 갖춰져 있고, 신규 SDK 페이지(`web-chat-sdk.mdx/en`)도 대부분 완성도가 높다. 다만 두 가지 중요한 결함이 있다: (1) `web-chat-sdk.en.mdx`에 frontmatter가 누락되어 locale pair 규약이 위반된다(WARNING), (2) 기존 파일에서 BYO-UI `byo-ui-headless.ts` 예제 참조가 두 locale 모두에서 사라졌는데, 이 예제는 실제로 존재하며 개발자가 headless 구현을 시작할 유일한 완전한 참조 코드다(WARNING). boot config 필드 표에서 `appearance.zIndex`·`launcher.suggestions`·`appearance.position`이 누락된 점과 삭제 동작 가이드 부재는 정보 완전성 측면의 부가적 이슈(INFO)다.

## 위험도

MEDIUM
