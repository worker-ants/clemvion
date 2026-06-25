---
title: 웹채팅 로더 — iframe 코너 고정(bottom/left·right + z-index) 누락으로 위젯 미표시 수정
worktree: web-chat-loader-iframe-position-d37b1a
started: 2026-06-26
owner: developer
status: complete
spec_impact:
  - spec/7-channel-web-chat/2-sdk.md
related_spec:
  - spec/7-channel-web-chat/2-sdk.md
---

# 배경

고객 사이트 스니펫 임베드 시 위젯 버튼이 안 보임(콘솔 에러 없음). 런타임 진단으로 확정:
- 로더·dispatcher 정상(`__wcInstalled=true`), boot 정상 실행, 위젯 앱(`/_widget/web-chat/v1/app/`) 직접 열면 버튼 정상.
- boot 가 만든 iframe 이 `border:0; position:fixed; width:392px; height:572px` 로 **크기조정(wc:resize)까지 정상**인데,
  **코너 고정 오프셋이 없어** `<body>` 끝 정적 위치(=본문 맨 아래)에 fixed → **화면 밖(아래)** 으로 나가 안 보임.

# Root cause (코드 확정)

`WidgetBridge`(`codebase/packages/web-chat-sdk/src/bridge.ts:51-54`)가 iframe 에 `position:fixed` 만 주고
**`bottom`/`left`/`right`·`z-index` 를 설정하지 않는다**. `applyResize` 도 width/height 만 적용.
spec 2-sdk §3(line 106)는 "**position/zIndex 는 `appearance` 를 따른다**"고 명시 → **구현이 spec 을 안 따른 버그**.

위젯 SPA 는 iframe **내부에서** 런처/패널을 `position:fixed; bottom:16px; left/right:16px`(styles.ts:4-5,10-11)로
띄우고 박스(`LAUNCHER_BOX 392×132`/패널 392×572)에 16px 여백 포함 → host iframe 을 **코너 flush(bottom:0 + side:0)**
로 고정해야 내부 런처가 페이지 모서리 16px 에 온다.

콘솔 미리보기(live-preview.tsx)는 SDK 로더가 아니라 **콘솔 레이아웃 박스 안의 직접 iframe** 이라 이 경로를 안 타서
버그가 안 드러났다(로더 경로 미검증).

# 수정 (SDK 로더 전용, `packages/web-chat-sdk`)

1. `bridge.ts` `BridgeDeps` 에 `position?: "bottom-right"|"bottom-left"` + `zIndex?: number` 추가.
2. `WidgetBridge` 생성자: `position:fixed` 뒤에 코너 고정 —
   `iframe.style.bottom="0"`; `position==="bottom-left"` → `left="0"`, else(기본 bottom-right) → `right="0"`;
   `iframe.style.zIndex = String(zIndex ?? DEFAULT_Z_INDEX)` (기본 2147483000, spec §3 예시값).
3. `index.ts` `boot()`: `new WidgetBridge({ iframeSrc, widgetOrigin, position: config.appearance?.position, zIndex: config.appearance?.zIndex })`.

# 테스트 (TDD)
`bridge.spec.ts`: 생성된 iframe 이 (a) `position:fixed`+`bottom:0`, (b) 기본 `right:0`/`bottom-left` 시 `left:0`,
(c) zIndex 적용(지정/기본), 검증. `index.spec.ts`: boot 가 appearance.position/zIndex 를 bridge 로 전달.

# spec
**변경 없음** — §3(line 106)이 이미 "position/zIndex 는 appearance 를 따른다" 명시. 순수 impl 수정. (필요 시 §3 에 host 가
설정하는 정확한 style(bottom/side/z-index) 1줄 보강 검토.)

# 배포 주의
머지 후 **운영 이미지 재빌드·재배포** 필요(운영이 빌드된 loader.js 를 서빙). 재배포 후 고객 사이트에서 버튼이 코너에 표시됨.

# 작업 체크리스트

- [x] `bridge.ts` `BridgeDeps` 에 `position`/`zIndex` 추가 + `DEFAULT_Z_INDEX`
- [x] `WidgetBridge` 생성자 코너 고정(`position:fixed; bottom:0; left/right:0`) + z-index
- [x] `index.ts` `boot()` 가 `config.appearance.position/zIndex` 를 bridge 로 전달
- [x] `bridge.spec.ts` 코너 고정·z-index 단위 테스트
- [x] `index.spec.ts` boot→appearance 전달 단위 테스트
- [x] lint / web-chat-sdk jest(45 pass) / build PASS

# 무관 확인
고객 사이트의 기존 오류(`riend.js` CORS / `optimizer.php` 502 / `about:blank` — mbiflare.com 서드파티 스킨/optimizer)는
우리 위젯과 도메인·의존 무관 → 영향 없음.
