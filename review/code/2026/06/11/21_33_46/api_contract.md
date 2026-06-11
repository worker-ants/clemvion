# API 계약(API Contract) 리뷰

## 발견사항

### **[WARNING]** 사용자 문서에서 에러 코드 이름 변경 — 기존 API 클라이언트 영향

- 위치: `codebase/frontend/src/content/docs/02-nodes/data.mdx`, `data.en.mdx`
- 상세:
  - `EXECUTION_TIMEOUT` → `CODE_TIMEOUT` (rename)
  - `CODE_RUNTIME_ERROR` → `CODE_EXECUTION_FAILED` (rename)
  - `CODE_SYNTAX_ERROR` 항목 삭제
  이 세 가지 변경은 사용자 문서에서의 에러 코드 표기 수정이지만, 문서가 API surface 를 반영하는 경우 기존 클라이언트 코드가 `output.error.code === 'CODE_RUNTIME_ERROR'` 또는 `=== 'EXECUTION_TIMEOUT'` 으로 분기하고 있다면 silent break 가 발생한다. 일관성 검토(`review/consistency/2026/06/11/21_03_19/naming_collision.md`) 에서도 `legacyCode` 필드로 구 코드가 `output.error.details.legacyCode` 에 유지된다고 언급되나, 문서에서 이 호환성 경로가 명시되지 않아 클라이언트 이전 안내가 불충분하다.
- 제안: 문서 에러 코드 표에 "(구 코드: `EXECUTION_TIMEOUT`은 `legacyCode` 필드로 접근 가능, 신규 코드 `CODE_TIMEOUT` 사용 권장)" 등의 마이그레이션 안내를 추가한다. 또는 `output.error.details.legacyCode` 호환성 보장 범위와 deprecated 일정을 문서화한다.

---

### **[INFO]** `CODE_MEMORY_LIMIT` 신규 에러 코드 — 에러 응답 형식 일관성

- 위치: `codebase/backend/src/nodes/core/error-codes.ts` (신규 추가), `data.mdx`/`data.en.mdx`
- 상세: `CODE_MEMORY_LIMIT` 가 `ErrorCode` enum 에 추가됐고 문서에도 기재됐다. 그러나 일관성 검토(`naming_collision.md`)에서 지적된 바와 같이 `spec/5-system/3-error-handling.md §1.4·§3.2` 와 `spec/conventions/chat-channel-adapter.md §3.2` 분류 표에 아직 미반영이다. 이는 API 에러 응답 스키마의 다운스트림 소비자(chat-channel adapter, 에러 핸들링 미들웨어 등)가 신규 코드를 인식하지 못하는 공백으로, 실제 `CODE_MEMORY_LIMIT` 가 발행될 때 unknown code fallback 으로 처리될 위험이 있다.
- 제안: `spec/5-system/3-error-handling.md §1.4·§3.2` 에 `CODE_MEMORY_LIMIT` 추가 및 chat-channel-adapter 분류 표 갱신을 동반 PR 또는 follow-up 으로 처리한다.

---

### **[INFO]** 내부 실행 엔진 교체 — 공개 API 인터페이스 무변경 확인

- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts`
- 상세: `node:vm` → `isolated-vm` 으로 내부 실행 엔진 교체. Code 노드의 공개 인터페이스(`execute()` 시그니처, 입력 schema, 출력 포트 구조 `port: 'success'|'error'`, `output`/`meta` 형태)는 변경 없다. `$input`, `$vars`, `$execution`, `$node`, `$helpers` 등 사용자 API surface 의 의미와 구조도 그대로 유지된다. 이는 하위 호환성 측면에서 양호하다.
- 제안: 해당 없음.

---

## 요약

이번 변경은 code 노드의 내부 실행 샌드박스를 `isolated-vm` 으로 교체하는 것이 핵심이며, 공개 API 인터페이스(포트 구조·응답 형식·요청 schema)는 그대로 유지된다. 주요 API 계약 관점의 위험은 사용자 문서에서 에러 코드 이름이 `EXECUTION_TIMEOUT` → `CODE_TIMEOUT`, `CODE_RUNTIME_ERROR` → `CODE_EXECUTION_FAILED` 로 변경된 부분이다. `output.error.details.legacyCode` 호환 경로가 존재하나 문서에 명시되지 않아 기존 클라이언트가 구 코드로 분기하는 경우 silent break 위험이 있다 (WARNING). 신규 `CODE_MEMORY_LIMIT` 에러 코드는 `ErrorCode` enum 에 추가됐으나 다운스트림 스키마(error-handling spec, chat-channel-adapter)에 미전파된 공백이 있다 (INFO). URL/경로 설계·버전 관리·인증/인가·페이지네이션에는 해당 변경이 없다.

## 위험도

LOW

---

STATUS=success ISSUES=1
