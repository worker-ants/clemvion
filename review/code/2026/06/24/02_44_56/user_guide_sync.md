# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [WARNING] 웹채팅 외형 설정 "서버 미저장" 설명이 서버 영속화 구현과 불일치

- **변경 파일**:
  - `codebase/backend/src/modules/triggers/dto/web-chat-appearance.dto.ts` (신규 — `WebChatAppearanceDto`)
  - `codebase/backend/src/modules/triggers/dto/interaction-config.dto.ts` (수정 — `appearance?: WebChatAppearanceDto` 추가)
  - `codebase/frontend/src/components/web-chat/use-web-chat.ts` (`useUpdateWebChatAppearance` mutation 추가)
  - `codebase/frontend/src/app/(main)/web-chat/page.tsx` (save 버튼 + `markSaved`/`isDirty` 흐름 추가)
- **매트릭스 항목**: `integration-provider-change` — "codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키"
- **누락된 동반 갱신**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx` — §3 외형 및 콘텐츠 설정 섹션 (line 78)
  - `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.en.mdx` — §3 Appearance & content section (line 65)
- **상세**:
  `web-chat.mdx` line 78: "설정 값은 설치 스크립트에 그대로 포함돼요. 브라우저에 임시로 보존되어 다음 방문 시 직전 설정이 복원되지만, **서버에 별도로 저장되지는 않아요**."
  `web-chat.en.mdx` line 65: "They are preserved temporarily in the browser so your settings are restored on your next visit, but **they are not saved on the server**."

  현재 변경 set 은 `WebChatAppearanceDto` + `useUpdateWebChatAppearance` + page.tsx 의 save 버튼(`저장` 버튼 + toast.success)을 통해 외형/콘텐츠 설정을 서버(`config.interaction.appearance`)에 영속화하는 기능을 완전 구현한다. 두 가이드 파일의 해당 문장이 구현과 **직접 모순**되어 사용자가 저장 버튼을 눌러도 "서버 저장 안 됨"으로 오해할 수 있다. 또한 새 "저장" 버튼의 존재·`isDirty` 미저장 경고·저장 성공/실패 토스트 흐름이 가이드에 전혀 서술되어 있지 않다.

- **제안**:
  1. `web-chat.mdx` §3 외형 및 콘텐츠 설정 — "서버에 별도로 저장되지는 않아요" 문장을 삭제하고 서버 영속화를 명시하는 문장으로 교체: "설정 값은 **저장** 버튼을 눌러 서버에 저장할 수 있어요. 저장 후에는 설치 스크립트에 반영되며, 다른 기기나 브라우저에서 콘솔에 접속해도 동일한 설정이 유지돼요."
  2. `web-chat.en.mdx` §3 — 대응 영문 문장도 동일하게 수정.
  3. "저장하지 않은 변경이 있어요" 안내 메시지(`webChat.appearance.unsaved`)가 언제 나타나는지 한 줄 안내 추가 권장.

---

### [INFO] i18n 신규 키 parity — 이상 없음

- 변경 파일: `codebase/frontend/src/lib/i18n/dict/ko/webChat.ts`, `codebase/frontend/src/lib/i18n/dict/en/webChat.ts`
- 확인: `appearance.save`, `appearance.saved`, `appearance.saveError`, `appearance.unsaved` 키가 ko/en 양쪽 동일하게 등록되어 있음. CRITICAL 없음.

---

## 요약

매트릭스 총 18개 trigger 중 이번 변경 set 에 매칭되는 trigger 는 `integration-provider-change`(semantic) 1개와 `new-ui-string`(semantic) 1개. `new-ui-string` 은 ko/en 양쪽 동록으로 parity 충족(NONE). `integration-provider-change` 는 `web-chat.mdx` + `web-chat.en.mdx` 가 변경 set 에 이미 포함되어 있으나, §3 외형 설정 섹션의 "서버 미저장" 설명이 서버 영속화 구현과 직접 모순되어 WARNING 1건 발생. 누락 1건.

## 위험도

WARNING
