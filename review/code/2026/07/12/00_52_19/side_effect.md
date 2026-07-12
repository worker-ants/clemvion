# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** private `emitEvent` 시그니처 `event: string` → `event: KbEventType` 좁힘, `as` 캐스트 제거
  - 위치: `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts:397-410`, `codebase/backend/src/modules/knowledge-base/graph/graph-extraction.service.ts:926-938`
  - 상세: 두 서비스의 `private emitEvent()` 는 클래스 내부에서만 호출되는 private 메서드이며, 외부 caller 가 없어 시그니처 좁힘의 파급 범위는 해당 클래스 내부로 완전히 국한된다. 두 파일의 모든 호출부(`'document:embedding_started'`, `'_progress'`, `'_completed'`, `'_retry'`, `'_failed'` / `'document:graph_started'`, `'_progress'`, `'_completed'`, `'_retry'`, `'_failed'`)는 이미 문자열 리터럴로 `KbEventType` 11종 union 에 포함되는 값만 사용하고 있어(직접 확인함), 컴파일타임 좁힘이 기존 런타임 동작을 전혀 바꾸지 않는다. `emitKbEvent(documentId, event, payload)` 호출도 이전엔 `event as Parameters<typeof emitKbEvent>[1]`(런타임 no-op 캐스트)이었고 지금은 이미 좁혀진 타입을 그대로 전달 — 런타임 값·순서·동작 동일.
  - 제안: 조치 불필요. 순수 컴파일타임 강화로 부작용 없음. 향후 두 서비스에 새 이벤트 문자열을 추가할 때 `KbEventType` union 밖 값이면 build 에러가 나므로, 이는 오히려 부작용을 예방하는 방향의 변경(V038류 채널 mismatch 재발 방지).

- **[INFO]** `websocket.service.ts` 변경은 JSDoc 주석 추가뿐
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:333-338` (KbEventType 상단 JSDoc)
  - 상세: `KbEventType` union 멤버(11종), `emitKbEvent` 시그니처, 로직 모두 무변경. 순수 문서 주석 추가로 공개 API·런타임 동작에 영향 없음.

- **[INFO]** 신규 파일 `plan/in-progress/kb-websocket-emit-compile-guard.md`
  - 위치: 신규 파일 (git status: new file)
  - 상세: 프로젝트 규약(`plan/in-progress/<name>.md`, frontmatter `worktree` 명시)에 따른 의도된 plan 문서. "예상치 못한 파일시스템 부작용"에 해당하지 않음 — 애플리케이션 코드/런타임과 무관한 작업 추적 파일이며 커밋 대상으로 정상.

## 점검 관점별 결과

1. **의도치 않은 상태 변경**: 없음. `emitEvent`/`emitKbEvent` 로직 자체는 무변경(캐스트 제거만), DB write·전역 상태 변경 없음.
2. **전역 변수**: 신규 전역 변수 없음. 기존 `WeakMap`(`SANITIZE_CACHE`) 등도 이번 diff 범위 밖.
3. **파일시스템 부작용**: 신규 plan md 파일 생성은 프로젝트 컨벤션에 따른 의도된 것. 코드 실행 경로상 파일 I/O 변경 없음.
4. **시그니처 변경**: `private emitEvent(documentId, event: string, payload)` → `(documentId, event: KbEventType, payload)`. private 메서드라 외부 caller 영향 없음. 클래스 내부 모든 호출부가 이미 union 호환 리터럴만 사용해 컴파일 성공 확인됨(plan 문서 "build clean" 기록과 일치). `emitKbEvent` 자체(공개 메서드) 시그니처는 무변경.
5. **인터페이스 변경**: 공개 API(`emitKbEvent`, `KbEventType` export, `KB_EVENT_NAMES` 11종)는 무변경. frontend `useKbEvents` 구독 계약에 영향 없음.
6. **환경 변수**: 관련 없음.
7. **네트워크 호출**: 관련 없음. WebSocket emit 호출 흐름(broadcastToChannel) 자체는 동일 인자·동일 순서로 유지.
8. **이벤트/콜백**: emit 되는 이벤트명 집합·payload·호출 시점 전부 동일. try/catch(best-effort) 구조도 무변경.

## 요약

이번 변경은 KB WebSocket emit 경로의 private helper `emitEvent` 파라미터를 `string` → `KbEventType` 로 좁히고 불필요한 `as` 캐스트를 제거하는 순수 컴파일타임 강화이며, `websocket.service.ts` 는 JSDoc 주석 추가뿐이다. 두 서비스 모두 `emitEvent` 는 private 이라 외부 호출자가 없고, 클래스 내부 모든 호출 지점이 이미 `KbEventType` union 에 속하는 리터럴만 사용하므로 런타임 동작·이벤트명·payload·emit 시점에 아무런 차이가 없다. 신규 plan 문서 파일은 프로젝트 작업 추적 컨벤션에 따른 의도된 파일시스템 변경으로 부작용이 아니다. 전역 상태, 환경 변수, 네트워크 호출, 공개 API 계약 모두 영향받지 않았다.

## 위험도

NONE
