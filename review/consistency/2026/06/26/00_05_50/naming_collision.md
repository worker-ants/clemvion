# 신규 식별자 충돌 검토 — web-chat-snippet-queue-stub

검토 대상: `plan/in-progress/web-chat-snippet-queue-stub.md`  
검토 모드: `--impl-done` (구현 완료 후, diff-base=origin/main)

---

## 발견사항

충돌 발견 없음.

이 변경이 도입하는 신규 식별자는 다음 두 가지다.

1. **`QUEUE_STUB_JS`** (TypeScript `export const`) — `codebase/frontend/src/lib/web-chat/snippet.ts:100`
2. **queue stub 인라인 문자열** (`window.ClemvionChat=…`) — 동일 파일 및 네 개의 `.mdx` 유저 가이드 파일

### 요구사항 ID 충돌

신규 요구사항 ID 없음. 본 작업은 plan 파일에 별도 요구사항 ID를 부여하지 않으며, spec `2-sdk §1 / R5` 를 기존 ID 범위 내에서 참조한다.

### 엔티티/타입명 충돌

`QUEUE_STUB_JS` 라는 이름은 기존 codebase 전체에서 이전에 사용된 적이 없다(diff 이전 파일에 없음). `QueueStub` 인터페이스는 이미 `codebase/packages/web-chat-sdk/src/loader.ts:10` 에 존재하지만, 이것은 `QUEUE_STUB_JS` 와 충돌하지 않는다. `QueueStub` 는 SDK 패키지의 TypeScript 타입(인터페이스)이고, `QUEUE_STUB_JS` 는 프론트엔드 라이브러리의 문자열 상수로 의미·패키지 경계·타입 종류가 다르며 export 범위도 겹치지 않는다.

### API endpoint 충돌

신규 API endpoint 없음.

### 이벤트/메시지명 충돌

신규 이벤트·메시지명 없음.

### 환경변수·설정키 충돌

신규 환경변수·설정키 없음.

### 파일 경로 충돌

변경 대상 파일은 모두 기존 파일의 수정이며 신규 파일 생성이 없다. 기존 명명 컨벤션과 충돌하지 않는다.

### `window.ClemvionChat` 전역 식별자

`window.ClemvionChat` 은 기존에 이미 `spec/7-channel-web-chat/2-sdk.md §1` 에서 공식 전역 진입점으로 정의되어 있고, `codebase/packages/web-chat-sdk/src/loader.ts` 의 `DEFAULT_GLOBAL_NAME = "ClemvionChat"` 상수와도 정합한다. 이번 변경은 동일 전역명을 큐 스텁 형태로 먼저 동기 설치하는 것으로, 기존 정의와 의미가 일치한다(spec Rationale R5 명시 패턴). 충돌 아님.

---

## 요약

이번 변경은 `QUEUE_STUB_JS` 라는 단일 신규 상수를 도입하고 기존 4개의 문서 파일과 1개의 소스 파일을 수정한다. 신규 식별자 `QUEUE_STUB_JS` 는 동일 이름의 기존 사용처가 없으며, 유사한 이름인 `QueueStub` 인터페이스와는 패키지·타입 종류가 달라 혼동 위험이 없다. `window.ClemvionChat` 전역은 기존 spec 및 SDK 코드에서 이미 동일 의미로 사용 중이며 이번 변경이 재정의하지 않는다. 요구사항 ID·API endpoint·이벤트명·ENV·파일명 신규 도입 없음. 식별자 충돌 관점에서 차단 사유 없음.

---

## 위험도

NONE
