# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

리뷰 대상 커밋: `8c5a3a54` — feat(web-chat): 웹채팅 운영 콘솔 — 인스턴스 관리·외형 빌더·설치 스니펫 (증분 1)

---

## 발견사항

### [WARNING] 웹채팅 운영 콘솔 신규 GUI 흐름이 user-guide docs 에 미반영

- **변경 파일 (trigger)**:
  - `codebase/frontend/src/app/(main)/web-chat/page.tsx` (신규)
  - `codebase/frontend/src/components/web-chat/appearance-builder.tsx` (신규)
  - `codebase/frontend/src/components/web-chat/create-web-chat-dialog.tsx` (신규)
  - `codebase/frontend/src/components/web-chat/install-snippet-box.tsx` (신규)
  - `codebase/frontend/src/components/web-chat/live-preview.tsx` (신규)
  - `codebase/frontend/src/components/layout/sidebar.tsx` (sidebar.webChat 메뉴 추가)

- **매트릭스 항목**:
  - `integration-provider-change` (id): "codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키"
  - `userguide-gui-flow-section` (id): "<ImplAnchor kind=\"ui-entry\"> 동반 작성 — file/symbol 실존 의무"

- **누락된 동반 갱신**:
  - `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx`
  - `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.en.mdx`

- **상세**: 기존 `web-chat.mdx` / `web-chat.en.mdx` (마지막 갱신 커밋 `ba76cc0e`)는 외부 개발자 관점의 CDN 스니펫·npm 설치·BYO-UI 만 다룬다. 이번 커밋은 제품 내에 `/web-chat` 신규 메뉴와 운영자 콘솔(인스턴스 목록/생성, 외형 빌더, 설치 스니펫 복사, 라이브 미리보기 placeholder) 전체를 추가했다. 이 GUI 흐름은 현재 docs 어디에도 설명이 없어 운영자가 콘솔에서 웹채팅을 만들고 스니펫을 얻는 방법을 가이드에서 찾을 수 없다. 또한 `userguide-gui-flow-section` 매트릭스 규칙에 따라 GUI 흐름 절에는 `<ImplAnchor kind="ui-entry">` 가 동반되어야 하는데 신규 콘솔 UI(`WebChatPage` / `AppearanceBuilder` / `InstallSnippetBox`)에 대한 ImplAnchor 가 없다.

- **제안**:
  1. `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx` 에 "웹채팅 콘솔 (운영자 UI)" 절을 추가한다. 최소 내용: 사이드바 "웹채팅" 메뉴 진입 경로 → 인스턴스 생성 다이얼로그(워크플로우 연결) → 외형 빌더 필드 설명 → 설치 스니펫 복사 흐름. 기존 CDN 스니펫 절과 연결 멘션.
  2. 신규 GUI 흐름 절에 아래와 같은 ImplAnchor 를 동반 작성:
     ```mdx
     <ImplAnchor
       kind="ui-entry"
       file="codebase/frontend/src/app/(main)/web-chat/page.tsx"
       symbol="WebChatPage"
       describes="사이드바 웹채팅 메뉴 → 인스턴스 목록·외형 빌더·설치 스니펫 콘솔"
     />
     ```
  3. `web-chat.en.mdx` 에 동일 내용 영문 버전을 작성.

---

## i18n parity 확인 결과 (이상 없음)

이번 커밋은 `new-ui-string` 트리거에 해당하는 다수의 신규 TSX 파일을 포함한다. 변경 set 을 확인한 결과:

- `codebase/frontend/src/lib/i18n/dict/ko/webChat.ts` — 신규 생성, ko 전체 키 등록
- `codebase/frontend/src/lib/i18n/dict/en/webChat.ts` — 신규 생성, en 전체 키 등록
- `codebase/frontend/src/lib/i18n/dict/ko/sidebar.ts` — `sidebar.webChat: "웹채팅"` 추가
- `codebase/frontend/src/lib/i18n/dict/en/sidebar.ts` — `sidebar.webChat: "Web Chat"` 추가
- `dict/ko/index.ts`, `dict/en/index.ts` — 양쪽 모두 `webChat` 임포트·등록

ko/en parity 완전히 충족. CRITICAL 이슈 없음.

---

## 요약

매트릭스 총 19개 trigger 행 중 2개(`integration-provider-change`, `userguide-gui-flow-section`)가 이번 변경에 매칭된다. i18n parity(`new-ui-string`)는 동일 커밋에서 충족됐으나, 신규 웹채팅 운영 콘솔 GUI 흐름에 대한 `web-chat.{mdx,en.mdx}` docs 갱신 + `<ImplAnchor kind="ui-entry">` 동반 작성이 누락됐다(1건 누락). 운영자가 제품 내 웹채팅 콘솔을 어떻게 사용하는지 가이드에서 확인할 수 없는 상태다. backend 에러·warning 코드 변경 없음, 신규 docs 섹션 디렉토리 없음.

## 위험도

WARNING
