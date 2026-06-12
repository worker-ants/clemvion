# 요구사항(Requirement) Review

## 발견사항

### [INFO] [SPEC-DRIFT] spec §4 (실행 로직 3번) 및 §7.1 에 `memoryLimit: 128` 하드코딩 잔재
- 위치: `/Volumes/project/private/clemvion/spec/4-nodes/5-data/2-code.md` §4 3번 항목 (line 130), §7.1 표 (line 376)
- 상세: 코드는 `ISOLATE_MEMORY_LIMIT_MB = resolveMemoryLimitMb()` 로 env 조정을 올바르게 구현했다. 그러나 spec §4 3번 항목은 여전히 `new ivm.Isolate({ memoryLimit: 128 })` 하드코딩 예시를 직접 적시하고 있고, §7.1 표의 구현 설명 행도 `new ivm.Isolate({ memoryLimit: 128 })` 를 코드 수준 설명으로 들고 있다. §7.2 와 §5.3.3 각주, Rationale §메모리 한도 환경변수화 에는 `CODE_NODE_MEMORY_LIMIT_MB` 및 env 조정 사실이 이미 반영돼 있어 같은 문서 내에서 일관성이 어긋난다.
- 제안: 코드 유지. spec §4 3번 항목의 `memoryLimit: 128` → `memoryLimit: ISOLATE_MEMORY_LIMIT_MB (기본 128, env 조정 가능)` 로, §7.1 표의 해당 셀 설명도 동일하게 갱신 필요. 대상 spec: `/Volumes/project/private/clemvion/spec/4-nodes/5-data/2-code.md` §4 line 130 · §7.1 line 376.

---

### [INFO] `$execution` 컨텍스트 - spec과 코드 간 필드 불일치 (minor, backwards-compatible)
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` `_buildIsolateContext` 내 `$execution` 주입 (line ~1282), spec §2.1 표 (line 70)
- 상세: spec §2.1 표의 `$execution` 설명은 "`executionId`, `workflowId`" 두 필드를 명시한다. 코드도 `{ executionId, workflowId }` 만 주입한다. 하지만 같은 spec §2.1 의 `$execution` 설명 칸에 "`id`, `startedAt` 등"으로도 (doc.mdx 파일에서) 서술돼 있어, 프론트엔드 docs(`data.mdx`, `data.en.mdx`)가 `$execution` 에 `startedAt` 이 있다고 암시하나 실제 핸들러는 `startedAt` 을 주입하지 않는다. 이는 docs의 설명 과잉이나 현재 변경 범위와 무관하고 기존 문제.
- 제안: 현재 변경 범위 외 이슈. 별도 spec 정비 대상.

---

### [INFO] `resolveMemoryLimitMb()` — `Number.parseInt` 로 소수 입력 처리
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` line ~1406, `resolveMemoryLimitMb()`
- 상세: `'128.5'` 같은 소수 문자열은 `Number.parseInt('128.5', 10)` → `128` 로 정수 truncation 처리된다. spec §7.2 는 기본값·안전 상한·clamp 규칙을 명시하나 소수 입력에 대한 명시적 처리 방향은 없다. truncation 은 합리적 동작이며 `> 0` 검사도 통과한다. 버그는 아니지만, 운영자가 `128.5` 를 넣으면 조용히 `128` 이 되는 동작을 문서화 여부 검토 권고.
- 제안: INFO. 변경 불요. 필요 시 코드 주석 또는 `.env.example` 주석에 "정수만 유효" 명시.

---

### [INFO] 테스트 - `resolveMemoryLimitMb` 가 module-level 상수 `ISOLATE_MEMORY_LIMIT_MB` 를 커버하지 못하는 한계 (이미 코드에서 인지·문서화됨)
- 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts` `resolveMemoryLimitMb` describe 블록
- 상세: `ISOLATE_MEMORY_LIMIT_MB` 는 모듈 로드 시 1회 결정되므로 테스트가 `process.env.CODE_NODE_MEMORY_LIMIT_MB` 를 변경해도 런타임에는 영향이 없다. 이 한계는 코드 주석("Tests exercise resolveMemoryLimitMb() directly")과 spec §7.2("env 조정 가능 — 조정 시 인스턴스 재시작 필요" 암시)에서 이미 인지·문서화됐다. `resolveMemoryLimitMb()` 단위 테스트가 함수 로직을 직접 검증하므로 커버리지 목적은 달성된다.
- 제안: 변경 불요. 현재 접근이 spec 의 의도와 일치한다.

---

## 요약

8개 변경 파일 전체에 걸쳐 요구사항 충족도는 높다. 핵심 기능 세 가지 — (1) Code 노드 isolate 메모리 한도의 `CODE_NODE_MEMORY_LIMIT_MB` env 조정 지원(기본 128MB, 상한 512MB clamp), (2) `$helpers.base64.encode/decode` 비문자열 입력 `TypeError` 정렬, (3) 실행 로직의 `_buildIsolateContext` / `_runWithTimeout` 메서드 분리 — 은 spec §7.2, §2.2 요구사항과 line-level 로 일치하며 에러 분류(`execution-failure-classifier.ts`, `error-codes.ts`)·프론트엔드 docs/i18n(`data.mdx`, `data.en.mdx`, `backend-labels.ts`) 동기화도 완료됐다. 발견된 이슈는 spec §4 3번 항목과 §7.1 표의 `memoryLimit: 128` 하드코딩 잔재(SPEC-DRIFT, spec 갱신 필요), 그리고 소수 입력 truncation 동작의 미문서화(INFO)로, 모두 코드 수정을 요하지 않는다. CRITICAL 또는 WARNING 급 요구사항 위반은 없다.

## 위험도

LOW
