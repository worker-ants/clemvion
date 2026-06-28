# Convention Compliance Review

**검토 범위**: `spec/7-channel-web-chat/` (impl-done, diff-base=origin/main)
**검토 일시**: 2026-06-28
**변경 코드**: `use-widget.ts` 분리 → `use-pending-message-queue.ts` + `use-token-refresh.ts` 신설

---

## 발견사항

### 1. Spec frontmatter `code:` 경로 — 신설 파일 누락

- **[WARNING]** `3-auth-session.md` 의 `code:` 가 분리된 훅 파일 미반영
  - target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-usewidget-split-5e9d26/spec/7-channel-web-chat/3-auth-session.md` frontmatter (lines 1-8)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 필드는 "본 spec 이 약속한 surface 의 구현 경로"를 열거해야 한다.
  - 상세: 현재 `3-auth-session.md` 의 `code:` 는 다음 3개만 기재한다:
    ```
    - codebase/channel-web-chat/src/lib/session-store.ts
    - codebase/channel-web-chat/src/lib/eia-client.ts
    - codebase/channel-web-chat/src/widget/use-widget.ts
    ```
    이번 PR 에서 토큰 갱신 로직(`refreshDelayMs`, `TOKEN_REFRESH_LEAD_MS`, `TOKEN_REFRESH_MIN_DELAY_MS`, `scheduleRefresh`, `clearRefreshTimer`)이 `use-widget.ts` 에서 `use-token-refresh.ts` 로 이동됐다. `3-auth-session.md §3 step7` 이 직접 참조하는 토큰 갱신 구현체가 `use-token-refresh.ts` 로 분리됐으므로 해당 파일이 `code:` 에 추가되어야 한다. `use-widget.ts` 는 re-export 만 남아 있는 경유 파일이 됐으므로 여전히 포함은 맞지만, 실질 구현 경로(`use-token-refresh.ts`)가 누락이다.
  - 제안: `3-auth-session.md` frontmatter `code:` 에 `codebase/channel-web-chat/src/widget/use-token-refresh.ts` 추가.

- **[WARNING]** `1-widget-app.md` 의 `code:` 가 `use-pending-message-queue.ts` 미반영
  - target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-usewidget-split-5e9d26/spec/7-channel-web-chat/1-widget-app.md` frontmatter
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1`
  - 상세: `1-widget-app.md §R6` (eager-start 큐 게이팅 로직)과 §2(입력창 비활성 조건)의 구현체가 `usePendingMessageQueue` 로 캡슐화돼 `use-pending-message-queue.ts` 에 분리됐다. 현재 `1-widget-app.md` 의 `code:` 는 `codebase/channel-web-chat/**` glob 만 있어 직접 파일 명시가 없으므로 glob 으로 커버되나, `spec-impl-evidence.md` 가 지향하는 "구현 경로 명시" 정신상 신설 핵심 파일을 glob 뒤에 별도 명시해 두는 것이 권장된다. 다만 glob 이 이미 커버하므로 가드 테스트 실패는 없다.
  - 제안: INFO 수준으로 강등(아래 참조) — glob 커버로 가드 위반은 없음.

### 2. 문서 구조 규약 — `_product-overview.md` prefix 준수

- **[INFO]** `spec/7-channel-web-chat/_product-overview.md` 는 CLAUDE.md 규약 준수
  - target 위치: `spec/7-channel-web-chat/_product-overview.md`
  - 위반 규약: 없음 — `_` prefix 는 정확히 규약을 따른다 (`spec/<영역>/_product-overview.md`).
  - 상세: 정상.

### 3. Spec ID 명명 규약 (kebab-case, 영역 prefix 충돌 회피)

- **[INFO]** `4-security.md` 의 `id: web-chat-security` 가 basename(`4-security`)과 다름 — 의도된 충돌 회피
  - target 위치: `spec/7-channel-web-chat/4-security.md` frontmatter line 2
  - 위반 규약: 없음 — `spec-impl-evidence.md §2.1` 는 "같은 basename 이 영역을 달리해 중복될 때 후발 문서가 영역 prefix 로 충돌을 회피한다"를 명시적으로 허용하고, 해당 frontmatter 주석(`# basename '4-security' 와 의도적으로 다름`)에 근거가 기재돼 있다.
  - 상세: 정상.

### 4. postMessage 프로토콜 명명 (`wc:` namespace)

- **[INFO]** 코드(use-widget.ts, host-bridge.ts)에서 `wc:` namespace prefix 사용 — 규약 준수
  - target 위치: `spec/7-channel-web-chat/2-sdk.md §3`
  - 위반 규약: 없음.
  - 상세: 변경된 파일들은 `wc:boot`, `wc:command`, `wc:ready`, `wc:resize`, `wc:event` 프로토콜을 변경하지 않았다. `use-pending-message-queue.ts`, `use-token-refresh.ts` 모두 EIA interact 계층(`submit_message` command)만 다루며 postMessage 명명에 관여하지 않는다.

### 5. EIA 이벤트 필드명 — SSE wire 필드 규약

- **[INFO]** `use-pending-message-queue.ts` 의 `sendCommand({ command: "submit_message", nodeId, message })` — 규약 준수
  - target 위치: `spec/7-channel-web-chat/0-architecture.md §3 EIA 매핑` 표
  - 위반 규약: 없음.
  - 상세: `submit_message` command 명과 payload 키가 EIA §5.1 스펙과 일치한다.

### 6. API 문서 규약 (Swagger/OpenAPI)

- **[INFO]** 변경 코드는 백엔드 컨트롤러·DTO 를 포함하지 않아 `spec/conventions/swagger.md` 적용 범위 외.
  - 상세: 이번 PR 변경 파일은 전부 `codebase/channel-web-chat/src/widget/` 프론트엔드 훅 계층이며, Swagger 데코레이터·DTO 명명 패턴 검토 대상이 아니다.

### 7. 금지 항목 점검

- **[INFO]** `use-pending-message-queue.ts` 내 `"use client"` directive — 정상
  - `spec/7-channel-web-chat/1-widget-app.md §1` 은 "모든 UI 컴포넌트는 `'use client'`" 를 명시하며, 위젯 훅 파일도 동일 규약 적용 대상이다.

- **[INFO]** 금지 패턴(`srcdoc`/`about:blank` 자가 생성, per_trigger 토큰 노출, `subprocess.run(["claude"])` 등) 은 변경 파일에 존재하지 않음.

---

## 요약

이번 PR 의 변경 범위는 `use-widget.ts` God hook 에서 토큰 갱신(`use-token-refresh.ts`)과 보류 메시지 큐(`use-pending-message-queue.ts`) 로직을 분리해 캡슐화하는 리팩토링이다. 코드의 명명·프로토콜·postMessage namespace·EIA 필드 등은 모두 정식 규약을 준수한다. 유일한 미흡 사항은 spec frontmatter `code:` 경로 동기화다: `3-auth-session.md` 의 `code:` 가 토큰 갱신 로직의 실질 구현 경로인 `use-token-refresh.ts` 를 누락하고 있어 WARNING 이다. `1-widget-app.md` 는 glob(`codebase/channel-web-chat/**`)으로 커버되므로 가드 위반은 없지만 명시성 차원의 INFO 를 남긴다. 문서 구조(`_product-overview.md`, `0-` prefix, Overview/본문/Rationale 3섹션)는 `spec/7-channel-web-chat/` 전역에 걸쳐 모두 규약을 준수하고 있다.

---

## 위험도

**LOW** — WARNING 1건(spec frontmatter `code:` 누락)이 가드 테스트 실패를 일으킬 수 있으나, 관련 테스트(`spec-code-paths.test.ts`)가 `codebase/channel-web-chat/src/widget/use-widget.ts` 를 `code:` 에 보유한 `3-auth-session.md` 를 기준으로 검증하며, `use-widget.ts` 는 re-export 가 남아 있어 실제 가드 실패 여부는 해당 테스트의 glob 확장 방식에 의존한다. 기능 동작에는 영향 없고 spec-impl 증거 정확도 문제다.
