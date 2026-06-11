# 신규 식별자 충돌 검토 결과

검토 범위: `spec/4-nodes/5-data/` (구현 완료 후 검토, diff-base=origin/main)

---

## 발견사항

### 발견사항 1

- **[WARNING]** `CODE_MEMORY_LIMIT` — `execution-failure-classifier` 화이트리스트 미등재로 분류 낙오
  - target 신규 식별자: `CODE_MEMORY_LIMIT` (정규화된 공개 에러 코드, `error-codes.ts` + spec §5.3.3)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` — `TIMEOUT_CODES` · `THIRD_PARTY_CODES` · `INTERNAL_CODES` 세 Set 어디에도 `CODE_MEMORY_LIMIT` 가 없음. `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md` §3.1 분류 표에도 미등재.
  - 상세: `CODE_MEMORY_LIMIT` 가 실제 발생하면 `classifyExecutionFailure()` 는 unknown 분기(`executionFailedInternal` + Logger.warn)로 처리한다. 이는 의도와 다를 가능성이 있으며, 채팅 채널 어댑터(Slack/Discord/Telegram) 사용자에게 "내부 에러" 로 표시된다. timeout 유형으로 분류하거나 별도 버킷으로 처리하는 것이 사용자 경험상 더 명확하다.
  - 제안: `TIMEOUT_CODES` 에 `CODE_MEMORY_LIMIT` 를 추가하거나, `spec/conventions/chat-channel-adapter.md` §3.1 분류 표에 이 코드를 어떤 버킷으로 보낼지 명시하고 `execution-failure-classifier.ts` 를 업데이트한다. 기존 미등재 코드들(`CODE_RUNTIME_ERROR`, `EXECUTION_TIMEOUT`) 도 이 목록에 있었으므로 전례가 있다.

---

### 발견사항 2

- **[WARNING]** `EXECUTION_MEMORY_EXCEEDED` — 내부(legacy) 코드로 신규 도입되나 기존 정의 집합과 격리 없이 문자열로만 존재
  - target 신규 식별자: `EXECUTION_MEMORY_EXCEEDED` (내부 legacy 코드, `classifyError()` 반환값 + `LEGACY_TO_NORMALIZED` 테이블 키)
  - 기존 사용처: `spec/4-nodes/5-data/2-code.md` origin/main §5.3 에러 코드 정규화 매핑 표에 `EXECUTION_MEMORY_EXCEEDED (로드맵)` 으로 예고 기재. `error-codes.ts` 에는 정의 없음 — 코드 내에서 문자열 리터럴로만 쓰임.
  - 상세: `EXECUTION_TIMEOUT`, `CODE_RUNTIME_ERROR` 는 `error-codes.ts` 의 `ErrorCode` 객체에 등록돼 있지 않고 handler 내부에서 문자열로 사용되는 legacy 코드들이다 (원래 그렇게 설계된 것). `EXECUTION_MEMORY_EXCEEDED` 도 동일 패턴. 충돌은 없으나, 이 코드가 기존 error-codes.ts 에 등록된 식별자와 이름 패턴이 달라(`EXECUTION_` prefix) 오해의 소지가 있다.
  - 제안: 주석 또는 spec §5.3 에러 코드 정규화 매핑 표에 `EXECUTION_MEMORY_EXCEEDED` 가 내부 legacy 코드이며 `error-codes.ts` 에 등록되지 않는다는 사실을 명시하면 충분하다 (기존 `EXECUTION_TIMEOUT` 과 동일 처리).

---

### 발견사항 3

- **[WARNING]** `classifyError` — module-level exported 함수명이 기존 private 클래스 메서드와 동일
  - target 신규 식별자: `export function classifyError(err, isolate?)` (`code.handler.ts` 모듈 레벨 export)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` L726 `private classifyError(err)`, `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts` L714 `private classifyError(err)`.
  - 상세: 두 기존 `classifyError` 는 클래스 private 메서드이므로 import namespace 충돌은 없다. 그러나 코드베이스 전역 검색 시 `classifyError` 가 여러 위치에 독립적으로 정의되어 있어 혼동 가능성이 있다. 또한 `code.handler.spec.ts` 가 `classifyError` 를 named import 하므로 향후 import 경로를 잘못 지정할 리스크가 있다.
  - 제안: 함수명을 `classifyCodeNodeError` 등으로 구분하거나, 현 상태 유지 시 JSDoc 에 "Code 노드 isolate 전용" 임을 명시하여 혼동을 방지한다.

---

### 발견사항 4

- **[INFO]** 프론트엔드 문서 에러 코드 표 — 구버전 코드 제거 + 신규 코드 추가가 origin/main 대비 갱신됨 (충돌 없음, 단 다른 워크트리와 불일치 주의)
  - target 신규 식별자: `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` / `CODE_MEMORY_LIMIT` (프론트엔드 docs FieldTable)
  - 기존 사용처: origin/main `codebase/frontend/src/content/docs/02-nodes/data.mdx` 및 `data.en.mdx` 에 `EXECUTION_TIMEOUT` / `CODE_RUNTIME_ERROR` / `CODE_SYNTAX_ERROR` 가 노출 에러 코드로 기재되어 있음. 이 중 `CODE_SYNTAX_ERROR` 는 `error-codes.ts` 에 정의된 적 없는 코드였다 (다른 워크트리에서도 동일하게 잔존).
  - 상세: 이번 diff 가 구버전 코드(`CODE_SYNTAX_ERROR` 포함)를 올바르게 제거하고 신규 코드로 교체한다. 다만 현재 fork-off 된 다른 워크트리(`fix-model-configs-kind-400-88c8b4`, `fix-embedding-test-dimension-a3d42a`)에서는 여전히 구버전 코드가 docs 에 남아 있어 머지 시 충돌이 발생할 수 있다.
  - 제안: 머지 시 위 두 워크트리의 `data.mdx` / `data.en.mdx` 도 신규 코드로 동기화한다.

---

### 발견사항 5

- **[INFO]** `ISOLATE_MEMORY_LIMIT_MB` — 새 module-level 상수, 기존 사용처 없음 (충돌 없음)
  - target 신규 식별자: `const ISOLATE_MEMORY_LIMIT_MB = 128` (`code.handler.ts`)
  - 기존 사용처: 없음. 이전 검토 세션(`review/code/2026/06/11/21_33_46`) 의 W15 에서 `CODE_NODE_MEMORY_LIMIT_MB` 환경변수 추출 가능성 주석 추가가 이미 반영됐음을 확인.
  - 상세: 식별자 충돌 없음. 다른 파일이나 spec 에서 이 상수명을 참조하는 곳 없음.
  - 제안: 이미 해결된 사항 — 추가 조치 불필요.

---

## 요약

신규 식별자 충돌 관점의 전체 평가: 이번 diff 가 도입하는 공개 에러 코드 `CODE_MEMORY_LIMIT` 및 내부 코드 `EXECUTION_MEMORY_EXCEEDED` 는 기존 코드베이스에 동일 이름으로 다른 의미를 가지는 식별자가 없어 직접 충돌은 없다. 그러나 `CODE_MEMORY_LIMIT` 가 `execution-failure-classifier.ts` 의 분류 화이트리스트에 등재되지 않아 채팅 채널 어댑터 경로에서 unknown fallback 으로 처리되는 점이 가장 중요한 누락이다. 또한 `classifyError` 가 exported 함수로 추가됐으나 동일 이름의 private 클래스 메서드가 두 provider 파일에 존재해 검색·혼동 리스크가 있다. 나머지 내부 식별자(`BOOTSTRAP_SOURCE`, `DAYJS_SOURCE`, `LEGACY_TO_NORMALIZED`, `syntaxCheck`, `syntaxIsolate`, `hostHash`, regex 상수 등)는 모두 `code.handler.ts` 파일 내 신규 도입이며 기존 사용처와 충돌하지 않는다.

## 위험도

MEDIUM
