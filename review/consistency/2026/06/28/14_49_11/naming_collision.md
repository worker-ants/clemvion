# 신규 식별자 충돌 검토 결과

검토 범위: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)

## 발견사항

### 발견사항 1

- **[WARNING]** `resetSession` — §1 전역 메서드 목록에 추가됐으나 `ClemvionChatMethod` 타입 유니언 · `ChatInstance` 인터페이스에는 미반영
  - target 신규 식별자: `spec/7-channel-web-chat/2-sdk.md` §1 메서드 목록에 `resetSession` 추가 (diff +행)
  - 기존 사용처:
    - `spec/7-channel-web-chat/2-sdk.md` §3 postMessage 표·§3 `resetSession` 설명 블록 — origin/main 시점부터 이미 존재 (이미 3회 등장)
    - `spec/7-channel-web-chat/2-sdk.md` §5 `ChatInstance` 인터페이스 타입 블록 — `resetSession(): void` 항목 **없음** (origin/main·HEAD 동일)
    - `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/packages/web-chat-sdk/src/types.ts` 60–72행 — `ChatInstance` 에 `resetSession` 없음
    - `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/packages/web-chat-sdk/src/types.ts` 26–36행 — `ClemvionChatMethod` 유니언에 `"resetSession"` 없음
    - `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/packages/web-chat-sdk/src/loader.ts` `switch` — `case "resetSession"` 없음
  - 상세: `resetSession` 은 §3 프로토콜 표(wc:command 목록)와 §3 본문 설명에서 이미 origin/main 에 기술돼 있었다. 이번 target diff 는 §1 스니펫 메서드 목록에만 추가한다. 그러나 spec §5 `ChatInstance` 타입 블록(본문 "공개 메서드 계약의 타입 SoT 는 §5" 라고 명시)과 실제 구현 타입 `ChatInstance`·`ClemvionChatMethod`·loader `switch` 에는 `resetSession` 이 없다. §1 산문이 이를 공개 메서드로 열거하는 반면 §5 타입 SoT 와 코드가 일치하지 않아, 외부 개발자가 `chat.resetSession()` 을 npm API 로 호출 가능하다고 오해할 수 있다. 실제 호출 경로는 `wc:command resetSession` postMessage(host→iframe 프로토콜)로만 동작하며 `ChatInstance` 메서드로 노출되지 않는다.
  - 제안: `spec/7-channel-web-chat/2-sdk.md` §5 `ChatInstance` 인터페이스에 `resetSession(): void` 를 추가하거나, §1 메서드 목록의 `resetSession` 항에 "(스니펫 전역 큐 경로만, npm `ChatInstance` 미노출 — wc:command 경유)" 注를 추가해 범위를 명확히 한다. 코드에도 `ChatInstance`·`ClemvionChatMethod`·loader `switch` 동기화가 필요하다.

### 발견사항 2

- **[INFO]** `safeApiBaseFromQuery` — 신규 export 함수, 기존 동명 식별자 없음
  - target 신규 식별자: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.ts` 81행 `export function safeApiBaseFromQuery`
  - 기존 사용처: 프로젝트 전체(`codebase/`)에 동명 함수·변수 없음 (grep 0건)
  - 상세: 네임스페이스 내부에서만 사용되고 export 범위도 동일 패키지 내 테스트 파일(`use-widget.test.ts`)로 한정된다. 충돌 없음.
  - 제안: 없음(INFO 수준 기록용).

### 발견사항 3

- **[INFO]** `isTextInputSurface` — 이번 target diff 가 spec 에 첫 명시, 코드는 origin/main 이전부터 존재
  - target 신규 식별자: `spec/7-channel-web-chat/1-widget-app.md` §2 "입력창" 행에 `판정 SoT widget-state.isTextInputSurface` 문구 신규 추가
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/lib/widget-state.ts` 30행 `export function isTextInputSurface` — origin/main 에 이미 존재(코드 선행, spec 후행 문서화)
  - 상세: 코드 식별자와 spec 기술이 동일 의미로 일치하며 충돌 없다. spec 이 구현을 따라잡는 정상적인 문서화 반영.
  - 제안: 없음.

### 발견사항 4

- **[INFO]** `embed-config.dto.ts` — JSDoc 인라인 주석 추가, 타입·필드명 변경 없음
  - target 신규 식별자: `EmbedConfigDto` 의 `allowlist`·`enforce` 필드에 `/** */` JSDoc 주석 추가
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` — origin/main 에 동일 DTO 존재, 필드명 변경 없음
  - 상세: 식별자 변경이 없는 순수 주석 추가. 충돌 없음.
  - 제안: 없음.

### 발견사항 5

- **[INFO]** `spec/7-channel-web-chat/5-admin-console.md` — `## Overview (제품 정의)` → `## Overview` 헤딩 정규화, 내부 링크 앵커 참조 수정
  - target 신규 식별자: 헤딩 텍스트 변경 및 `[0-architecture R5]` → `[0-architecture §R2]` 링크 수정
  - 기존 사용처: 헤딩 변경이 마크다운 앵커에 영향을 주지만 이 파일 내부 자가 참조 없음. 다른 spec 파일에서 `5-admin-console.md#overview-제품-정의` 형태로 앵커를 직접 참조하는 경우 없음 (grep 확인)
  - 상세: `0-architecture R5` 는 존재하지 않는 Rationale 번호였다(실제 항목은 `R2` — client-consumer 원칙). 잘못된 앵커를 올바른 `§R2` 로 수정한 것으로, 충돌·오탐이 아닌 수정이다.
  - 제안: 없음.

---

## 요약

이번 target 변경(diff-base=origin/main)이 도입하는 신규 식별자는 `safeApiBaseFromQuery`(새 내부 함수), `isTextInputSurface`(spec 기술 추가, 코드 선행), JSDoc 주석 추가, 헤딩·링크 수정으로 구성된다. 이 중 실질적인 식별자 충돌은 없으나, `resetSession` 이 spec §1 메서드 목록에 추가되면서 spec §5 `ChatInstance` 타입 SoT 및 실제 코드(`types.ts` `ChatInstance`·`ClemvionChatMethod`, `loader.ts` switch)와 불일치가 발생한다. `resetSession` 은 이미 origin/main 의 §3 프로토콜 표에 기술돼 있어 신규 충돌은 아니지만, §1 에 공개 메서드로 추가 나열함으로써 npm API 표면인 `ChatInstance` 에 포함된다는 혼선이 커졌다. 이를 제외한 나머지 변경은 기존 사용처와 충돌하지 않는다.

## 위험도

LOW
