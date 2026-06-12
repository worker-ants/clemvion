# Documentation Review

## 발견사항

### 파일 1: codebase/backend/.env.example

- **[INFO]** `CODE_NODE_MEMORY_LIMIT_MB` 항목이 신규 추가되었고, 주석 품질이 우수하다.
  - 위치: 파일 끝 (라인 36–39)
  - 상세: 기본값(128), 안전 상한(512), 초과 시 동작(CODE_MEMORY_LIMIT 에러 포트), 스펙 참조(`4-nodes/5-data/2-code.md §7.2`)가 모두 명시되어 있다. 다른 env 항목과 일관된 스타일을 유지한다.
  - 제안: 현재 상태 적절. 별도 조치 불필요.

---

### 파일 2: codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts

- **[INFO]** `CODE_MEMORY_LIMIT` 상수 옆 인라인 주석이 `CODE_NODE_MEMORY_LIMIT_MB` env 조정 가능 사실을 반영하도록 업데이트되었다.
  - 위치: `INTERNAL_CODES` Set, `CODE_MEMORY_LIMIT` 항목 주석
  - 상세: 이전 주석은 "128MB 한도"를 고정값으로 서술했으나, 변경 후에는 "기본 128MB, `CODE_NODE_MEMORY_LIMIT_MB` env 조정 가능"으로 실제 동작과 정확히 일치한다. 파일 상단 module JSDoc(`SoT` 섹션)은 이 변경과 무관하며 여전히 유효하다.
  - 제안: 현재 상태 적절.

---

### 파일 3: codebase/backend/src/nodes/core/error-codes.ts

- **[INFO]** `CODE_MEMORY_LIMIT` 항목 주석이 env 조정 가능성을 반영하도록 업데이트되었다.
  - 위치: `ErrorCode` 객체, `CODE_MEMORY_LIMIT` 항목 (라인 559–563)
  - 상세: "128MB" 고정 수치가 "default 128MB, `CODE_NODE_MEMORY_LIMIT_MB` env-tunable"로 교체되었다. `buildErrorEnvelope`, `truncateForErrorDetails`, `maskEmailForErrorDetails` 공개 함수의 JSDoc은 이 PR 변경과 무관하며 그대로 유효하다.
  - 제안: 현재 상태 적절.

---

### 파일 4: codebase/backend/src/nodes/data/code/code.handler.spec.ts

- **[INFO]** `resolveMemoryLimitMb` import 추가 및 신규 테스트 블록에 spec 참조 주석이 적절히 작성되어 있다.
  - 위치: 파일 상단 import, `describe('resolveMemoryLimitMb (spec §7.2)')` 블록
  - 상세: `// spec §7.2 — memory limit is operator-tunable via CODE_NODE_MEMORY_LIMIT_MB` 주석이 테스트 의도를 명확히 설명한다. `it.each` 케이스들의 test name도 각 엣지케이스를 충분히 서술한다.
  - 제안: 현재 상태 적절.

- **[INFO]** `base64.encode/decode` 비문자열 TypeError 테스트에 spec 참조가 포함되어 있고 기존 `// INFO 10` 주석이 spec §2.2 기반으로 더 정확하게 교체되었다.
  - 위치: 라인 745–769 (신규 `it.each` 블록), 라인 779–781 (기존 주석 교체)
  - 상세: 이전 `// INFO 10 — base64.decode with invalid Base64 input: silent-failure` 주석이 유효하지 않은 base64 STRING과 비문자열 TypeError를 명확히 구분하는 설명으로 교체되었다. 동작 의미를 정확히 전달한다.
  - 제안: 현재 상태 적절.

- **[INFO]** `beforeAll(() => jest.retryTimes(2))` 패턴에 CI flakiness 이유 주석이 추가되었다.
  - 위치: `describe('execute — memory limit (spec §7.2)')` 내부
  - 상세: W10 식별자와 함께 race condition 원인(메모리 한도 위반 vs CPU 타임아웃 경쟁)을 설명하는 주석이 달려 있어 나중에 보는 개발자가 맥락을 파악하기 쉽다.
  - 제안: 현재 상태 적절.

---

### 파일 5: codebase/backend/src/nodes/data/code/code.handler.ts

- **[INFO]** `resolveMemoryLimitMb` 함수에 `@internal` JSDoc이 정확하게 작성되어 있다.
  - 위치: 라인 1406–1411 (`resolveMemoryLimitMb` JSDoc)
  - 상세: `@internal Exported only for unit testing`이 명시되어 있고, 폴백 동작 및 상한 클램핑 정책이 `{@link DEFAULT_MEMORY_LIMIT_MB}` / `{@link MAX_MEMORY_LIMIT_MB}` 링크와 함께 설명된다. spec §7.2 참조도 포함된다.
  - 제안: 현재 상태 적절.

- **[INFO]** `hostB64Encode` / `hostB64Decode` 함수에 JSDoc이 신규 추가되었다.
  - 위치: 라인 1523–1528 (`hostB64Encode`), 라인 1539–1543 (`hostB64Decode`)
  - 상세: `hostHash`와 동형임을 명시하고 spec §2.2 타입 계약을 참조한다. `hostB64Decode`에는 *invalid base64 STRING*이 TypeError가 아님을 의도적으로 서술해 두어 동작 구분이 명확하다. `{@link hostHash}` 크로스 링크가 유용하다.
  - 제안: 현재 상태 적절.

- **[INFO]** `_buildIsolateContext` / `_runWithTimeout` private 메서드에 JSDoc이 신규 추가되었다.
  - 위치: 라인 1877–1885 (`_buildIsolateContext`), 라인 1956–1960 (`_runWithTimeout`)
  - 상세: 두 메서드 모두 수행 동작(주입 단계 순서, W13 ordering, dual-timeout 구조)을 명확히 설명한다. private 메서드이므로 `@param`/`@returns` 생략은 허용 수준이며 현재 설명 수준으로 충분하다.
  - 제안: 현재 상태 적절.

- **[WARNING]** `_buildIsolateContext`의 W13 ordering 주석이 JSDoc과 메서드 본문 인라인 주석 양쪽에 중복 기술되어 있다.
  - 위치: JSDoc 마지막 줄(`W13 ordering is preserved: ...`) 및 본문 내 `// --- inject host-realm callbacks` 섹션 주석
  - 상세: JSDoc에서 "W13 ordering is preserved: host callbacks are injected here BEFORE BOOTSTRAP_SOURCE captures them lexically and deletes the globals"라고 명시하고, 본문 내에도 동일 내용의 섹션 주석이 존재한다. 이중 기술 자체가 오류는 아니나, 향후 한쪽만 수정될 경우 불일치가 발생할 수 있다.
  - 제안: JSDoc의 W13 문장을 유지하고 메서드 본문 내 중복 설명은 간소화(`// W13: host callbacks BEFORE BOOTSTRAP_SOURCE`)하거나, 반대로 JSDoc에서 W13 문장을 제거하고 본문 주석으로만 유지한다. 어느 쪽이든 한 곳에서만 관리하는 것이 바람직하다.

- **[INFO]** 모듈 수준 상수(`DEFAULT_MEMORY_LIMIT_MB`, `MAX_MEMORY_LIMIT_MB`, `ISOLATE_MEMORY_LIMIT_MB`)의 인라인 주석이 역할과 의도를 명확히 설명한다.
  - 위치: 라인 1399–1422
  - 상세: "Resolved once at module load (matches isolate-lifetime semantics; env is read at process start). Tests exercise resolveMemoryLimitMb() directly." 주석이 모듈 로드 시점 고정 이유를 설명한다.
  - 제안: 현재 상태 적절.

---

### 파일 6 & 7: codebase/frontend/src/content/docs/02-nodes/data.en.mdx, data.mdx

- **[INFO]** 샌드박스 규칙 "Memory" 항목 설명이 고정 128MB에서 operator-tunable 형태로 정확하게 업데이트되었다.
  - 위치: `data.en.mdx` 라인 66, `data.mdx` 라인 108
  - 상세: 두 파일 모두 `CODE_NODE_MEMORY_LIMIT_MB` 서버 설정을 언급하여 운영자가 조정할 수 있음을 사용자에게 알린다. 영문/한국어 버전이 동일 내용으로 동기화되어 있다.
  - 제안: 현재 상태 적절.

- **[INFO]** 에러 코드 테이블의 `CODE_MEMORY_LIMIT` 설명에서 "128MB" 고정 수치가 제거되었다.
  - 위치: `data.en.mdx` 라인 74, `data.mdx` 라인 124
  - 상세: "The 128MB memory limit was exceeded" → "The memory limit was exceeded"로 변경. env 조정 가능성을 이미 샌드박스 규칙 표에서 설명하므로 에러 코드 설명에서는 수치를 제거하는 것이 적절하다.
  - 제안: 현재 상태 적절.

- **[INFO]** `data.en.mdx`의 "Tips & notes" 섹션에 여전히 "The default timeout is 30 seconds"가 명시되어 있으나 메모리 한도 기본값(`128MB default`)에 대한 언급은 없다. 타임아웃처럼 메모리 기본값을 Tips에 반영하면 더 일관적이다.
  - 위치: `data.en.mdx` 마지막 Tips & notes 단락
  - 상세: 현재 "The default timeout is 30 seconds, configurable in node settings." 문장 옆에 메모리 기본값에 대한 설명이 없다. 샌드박스 규칙 표에는 이미 있으므로 중복이 될 수 있어 필수는 아니다.
  - 제안: 선택 사항. 현재 상태도 허용 수준.

---

### 파일 8: codebase/frontend/src/lib/i18n/backend-labels.ts

- **[INFO]** `CODE_MEMORY_LIMIT` 한국어 에러 메시지에서 고정 수치 "128MB"가 제거되었다.
  - 위치: `ERROR_KO` 객체, `CODE_MEMORY_LIMIT` 항목 (라인 3012–3013)
  - 상세: "코드 실행 중 메모리 한도(128MB)를 초과했어요." → "코드 실행 중 메모리 한도를 초과했어요."로 변경. `data.mdx`의 에러 코드 설명과 동일한 방향으로 일관되게 수정되었다. 영문 fallback(`CODE_EXECUTION_FAILED`의 영문 메시지)과 대칭을 이룬다.
  - 제안: 현재 상태 적절.

- **[INFO]** `backend-labels.ts` 파일 상단 module JSDoc 및 각 export 함수의 `@internal` 태그가 이 PR 변경과 무관하게 유지되고 있으며 여전히 정확하다.
  - 위치: 파일 상단, `WARNING_KO`/`NODE_LABEL_KO`/`NODE_DESCRIPTION_KO` 선언부
  - 제안: 현재 상태 적절.

---

## 요약

이번 변경은 Code 노드의 메모리 한도 env 조정 가능성(`CODE_NODE_MEMORY_LIMIT_MB`)을 코드베이스 전반에 걸쳐 일관되게 문서화한 작업으로, 문서화 품질이 전반적으로 우수하다. `resolveMemoryLimitMb`의 `@internal` JSDoc, `hostB64Encode`/`hostB64Decode`의 신규 함수 JSDoc, `_buildIsolateContext`/`_runWithTimeout`의 private 메서드 JSDoc, `.env.example` 주석, 영문/한국어 MDX 문서, i18n 레이블이 모두 서로 동기화되어 있다. 경미한 주의사항은 `_buildIsolateContext`의 W13 ordering 설명이 JSDoc과 본문 인라인 주석에 중복 기술되어 있어 향후 한쪽만 수정되면 불일치 위험이 있다는 점이다. 그 외 에러 코드 주석 업데이트, 테스트 블록 설명 주석, `.env.example` 신규 항목 모두 기존 파일 스타일 규약을 잘 따르고 있다.

## 위험도

LOW
