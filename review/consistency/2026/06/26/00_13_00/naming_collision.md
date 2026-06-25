# 신규 식별자 충돌 검토

## 발견사항

충돌 해당 없음.

검토 범위에서 도입된 신규 식별자는 다음 세 가지다.

1. **`QUEUE_STUB_JS`** (exported const, `codebase/frontend/src/lib/web-chat/snippet.ts:100`)
2. **`window.ClemvionChat.q`** (런타임 큐 배열 프로퍼티, 스니펫 인라인 JS)
3. 마크다운 문서 인라인 큐 스텁 코드 예시 (`.mdx` 4개 파일)

### 요구사항 ID 충돌

plan 문서(`plan/in-progress/web-chat-snippet-queue-stub.md`)는 신규 요구사항 ID 를 부여하지 않는다 — 기존 spec 2-sdk §1·R5 의 이미 정의된 요구사항(명령 큐 패턴)에 대한 구현 완료 커밋이다. 신규 ID 충돌 없음.

### 엔티티/타입명 충돌

- `QUEUE_STUB_JS`: `codebase/frontend/src/lib/web-chat/` 스코프 내부에서만 export 되는 모듈 레벨 상수. 동일 이름의 기호가 `spec/`, `codebase/packages/`, `codebase/backend/` 어디에도 존재하지 않는다.
- `QueueStub` (인터페이스): `codebase/packages/web-chat-sdk/src/loader.ts:10` 에 이미 선행 정의돼 있으며 이번 diff 가 도입한 것이 아니다. 두 모듈이 각자 별개 파일에서 독립적으로 큐 스텁 개념을 다루지만 이름 공간이 분리돼 있어 충돌이 없다. `QUEUE_STUB_JS` (프런트 어드민 모듈, 스니펫 문자열 상수)와 `QueueStub` (SDK 타입, 런타임 인터페이스)는 의미와 소속 패키지가 달라 혼용될 가능성이 없다.

### API endpoint 충돌

이번 변경은 새 API endpoint 를 도입하지 않는다.

### 이벤트/메시지명 충돌

이번 변경은 새 이벤트·큐 이름을 도입하지 않는다. `ClemvionChat.q` 는 기존 spec 2-sdk §1 에서 이미 정의된 큐 배열 프로퍼티다.

### 환경변수·설정키 충돌

이번 변경은 새 ENV var 또는 config key 를 도입하지 않는다.

### 파일 경로 충돌

변경된 파일 경로는 모두 기존 파일의 수정이며 새 파일이 추가되지 않았다. 명명 컨벤션 위반 없음.

---

## 요약

이번 변경이 도입하는 유일한 신규 public 식별자는 `QUEUE_STUB_JS` (TypeScript 모듈 레벨 export constant) 하나다. 이 이름은 프로젝트 전체에서 처음 등장하며, 기존 `QueueStub` 인터페이스(`codebase/packages/web-chat-sdk/src/loader.ts`)와 명칭·의미·패키지 스코프가 모두 다르므로 충돌이 없다. 나머지 변경(인라인 JS 큐 스텁 코드, `.mdx` 문서 예시)은 기존 spec 2-sdk §1·R5 에서 이미 정의된 `window.ClemvionChat.q` 패턴을 그대로 구현한 것이다. 요구사항 ID, API endpoint, 이벤트명, 환경변수, 파일 경로 영역에서 신규 도입 항목이 없으므로 식별자 충돌은 발견되지 않았다.

## 위험도

NONE
