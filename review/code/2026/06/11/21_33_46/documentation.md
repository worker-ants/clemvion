# 문서화(Documentation) 리뷰 결과

**대상**: code-node-isolated-vm 전환 (refactor 04 C-2)
**검토일**: 2026-06-11
**검토 파일**: 25개 (핵심 구현 3개, 사용자 문서 2개, plan 문서 2개, consistency review 산출물 18개)

---

## 발견사항

### [CRITICAL] 사용자 공개 문서의 에러 코드가 구현과 불일치 — 런타임 오작동 유발
- 위치: `codebase/frontend/src/content/docs/02-nodes/data.mdx` L124–125, `data.en.mdx` L113–114
- 상세: 두 user-docs는 에러 코드 표에 `EXECUTION_TIMEOUT` / `CODE_RUNTIME_ERROR` / `CODE_SYNTAX_ERROR` 를 공개 에러 코드로 안내한다. 그러나 구현(`code.handler.ts`)은 이미 `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` / `CODE_MEMORY_LIMIT` 를 발행하도록 전환됐다. 워크플로우 작성자가 user-docs 를 보고 `EXECUTION_TIMEOUT` 으로 `error` 포트 분기를 작성하면 조건이 영구적으로 불일치한다. `CODE_SYNTAX_ERROR` 는 spec·구현 어디에도 존재하지 않는 허상 코드다.
- 제안: `data.mdx` / `data.en.mdx` 에러 코드 표를 `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` / `CODE_MEMORY_LIMIT` 세 코드로 교체. `CODE_SYNTAX_ERROR` 행 제거 후 "컴파일 실패는 캔버스 pre-flight 오류로 처리" 안내 추가. (이번 변경에서 `data.mdx` / `data.en.mdx` 수정이 포함됐으나, 위 C-1 사항은 consistency review 세션 `21_19_55`의 BLOCK 사유로도 이미 식별됨 — 해당 수정이 이미 이 PR에 포함되어 있다면 RESOLVED.)

### [CRITICAL] 사용자 공개 문서에 `setTimeout` 이 허용 전역으로 안내 — 구현은 차단
- 위치: `codebase/frontend/src/content/docs/02-nodes/data.mdx` L114 ("setTimeout(최대 5초)"), `data.en.mdx` L103 ("setTimeout (max 5s)")
- 상세: user-docs 는 `setTimeout` 을 "최대 5초 허용 전역"으로 명시하지만, 새 구현(`code.handler.ts` BOOTSTRAP_SOURCE)은 `setTimeout` / `setInterval` / `setImmediate` 를 `delete globalThis[key]` 로 명시 차단한다. 사용자가 `setTimeout` 을 호출하면 `ReferenceError` 가 발생한다.
- 제안: `data.mdx` / `data.en.mdx` 의 "허용 전역" 행에서 `setTimeout` 제거. `Promise` / `async/await` 로 비동기 처리를 안내하는 문구로 대체. (이번 diff 에서 `data.mdx` / `data.en.mdx` 에 해당 수정이 이미 포함됐는지 확인 필요 — `data.mdx` diff 상 "허용 전역" 행 수정에 `setTimeout` 제거가 반영됐으면 RESOLVED.)

### [WARNING] `CODE_MEMORY_LIMIT` 에러 코드가 `error-codes.ts` 에 추가됐으나 인라인 주석 불충분
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` L101–103
- 상세: 새 에러 코드 `CODE_MEMORY_LIMIT` 에 한 줄 주석 `// isolated-vm exceeded its 128MB memory hard limit — distinct from CODE_TIMEOUT so authors can branch on resource cause.` 가 있다. 설명은 적절하나, `error-codes.ts` 의 다른 에러 코드 그룹(예: `CODE_EXECUTION_FAILED`, `CODE_TIMEOUT`)과 달리 이 코드만 spec 문서 참조(`spec §7.2`)가 주석에 포함되어 형식 불일치가 있다. 일관성 차원에서 다른 에러 코드 주석 형식과 맞추거나, 전체 파일 주석 스타일을 통일하는 것이 권장된다.
- 제안: 현 주석은 기능적으로 충분하다. 형식 통일이 필요하다면 spec 섹션 참조 방식을 파일 전체에 일관 적용하거나, 이 코드에서만 spec 참조를 제거한다.

### [WARNING] `ISOLATE_MEMORY_LIMIT_MB` 상수에 환경변수 추출 가능성 문서화 누락
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` — `const ISOLATE_MEMORY_LIMIT_MB = 128;`
- 상세: JSDoc 주석 `/** isolate 메모리 하드 리밋 (spec §7.2) — 초과 시 CODE_MEMORY_LIMIT. */` 는 목적을 잘 설명한다. 그러나 이 값이 하드코딩임을 명시하지 않아, 운영 환경에서 환경변수로 조정 가능한지 알 수 없다. consistency review 에서도 `CODE_NODE_MEMORY_LIMIT_MB` 환경변수 추출 여지가 INFO 로 제안됐다.
- 제안: 주석에 "현재 하드코딩 — 운영 튜닝 필요 시 `CODE_NODE_MEMORY_LIMIT_MB` 환경변수 추출 가능" 을 한 줄 추가. 또는 spec §Rationale 에 이 사실 기재(plan-based 작업으로 처리 가능).

### [WARNING] `BOOTSTRAP_SOURCE` 인라인 문자열에 JSDoc 없음 — 복잡한 보안 로직
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` — `const BOOTSTRAP_SOURCE = ...`
- 상세: `BOOTSTRAP_SOURCE` 는 isolate 내부에서 실행되는 보안 하드닝 스크립트로, host-realm 콜백 캡처, 전역 삭제, 동적 코드 실행 차단 등 복잡한 보안 결정을 포함한다. 현재 변수 선언 직전에 JSDoc `/** Bootstrap script run once per context ... */` 가 있어 전반적인 설명은 있으나, 이 스크립트가 왜 IIFE 구조인지, 왜 글로벌 삭제가 closures 이후에 발생해야 하는지에 대한 설명이 없다. 미래 유지보수자가 순서를 변경하면 보안 취약점이 발생할 수 있다.
- 제안: JSDoc 에 "(중요) 글로벌 삭제는 closures 캡처 이후에 실행되어야 함 — 순서 변경 시 callbacks 접근 불가" 경고 문구 추가.

### [WARNING] `syntaxCheck` 함수에 JSDoc 없음
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` — `function syntaxCheck(wrappedCode: string): string | undefined`
- 상세: `syntaxCheck` 는 모듈 레벨 공개 함수는 아니지만, syntax isolate 를 lazy create 하는 설계 결정(JS 단일 스레드 이유로 공유 안전)을 주석으로만 설명한다. 함수 시그니처 반환 타입(`string | undefined` — undefined = 오류 없음, string = 오류 메시지)의 의미가 JSDoc 없이 코드를 읽어야만 파악 가능하다.
- 제안: `/** 구문 체크 — 오류 없으면 undefined, 오류 있으면 오류 메시지 반환. ... */` JSDoc 추가.

### [WARNING] `wrapUserCode` 함수 JSDoc 에 중요 제약 누락
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` — `function wrapUserCode(code: string): string`
- 상세: 현재 JSDoc `/** Wrap user code so the IIFE resolves to a JSON string ... */` 는 설계를 잘 설명한다. 그러나 이 래핑이 `line:column` 오류 위치를 사용자 코드 기준으로 offset 하는 처리를 별도로 하지 않음을 명시하지 않는다. 사용자가 구문 오류 위치를 받았을 때 실제 코드 라인과 불일치할 수 있다(래핑 헤더가 4줄 추가됨).
- 제안: JSDoc 에 "주의: 오류 라인 번호는 래핑 헤더 4줄 오프셋이 포함됨 — 사용자 코드 기준 보정이 필요하면 line-4" 추가.

### [WARNING] `hostHash` 함수 JSDoc 에 오류 전파 경로 부정확
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` — `function hostHash(algorithm: unknown, data: unknown): string`
- 상세: JSDoc `/** ... The algorithm allowlist + type guard throw here; the thrown message is copied back into the isolate and propagates to the user code's error port (spec §2.2, §5.3). */` — `ivm.Callback` 이 host 예외를 isolate 로 재전파하는 방식이 맞으나, `ivm.Callback` 의 기본 동작(host 예외 → isolate 오류 전파)을 전제로 한다. 만약 isolated-vm 버전 변경으로 이 동작이 달라지면 주석이 틀린 정보가 된다.
- 제안: "단, isolated-vm Callback 의 예외 전파 동작에 의존함 (ivm v6.x 기준)" 을 주석에 명시.

### [INFO] `data.en.mdx` 에 `Memory` 필드 추가 — 번역 일관성 양호
- 위치: `codebase/frontend/src/content/docs/02-nodes/data.en.mdx` L683
- 상세: 한국어 문서(`data.mdx`)와 영문 문서(`data.en.mdx`) 모두 `Memory` / `메모리` 필드와 `CODE_MEMORY_LIMIT` 코드가 동시에 추가됐다. 두 문서 간 일관성은 유지된다. 영문 설명 "Code runs in an isolated environment; exceeding 128MB stops execution and routes to an error." 은 사용자 관점에서 충분히 설명적이다.

### [INFO] `plan/in-progress/code-node-isolated-vm.md` — 운영 영향 문서화 양호
- 위치: `plan/in-progress/code-node-isolated-vm.md`
- 상세: 네이티브 의존성(node-gyp, musl 소스 컴파일 실증), Node 버전 요구사항(isolated-vm 6.x = node>=22), latency 프로파일 변화 가능성, 후속 snapshot 최적화 여지 등 운영 영향이 체크리스트 및 Rationale 에 상세히 기록돼 있다. 문서화 관점 양호.

### [INFO] `refactor/04-security.md` C-2/M-2 체크박스 갱신 — 이번 diff 에 포함됨
- 위치: `plan/in-progress/refactor/04-security.md`
- 상세: C-2 와 M-2 가 `[x]` 로 갱신됐고, 결정 날짜(2026-06-11), 옵션 결정 내용, worktree 링크가 명시됐다. 복수의 consistency review 에서 plan 갱신 누락으로 지적했으나 이번 diff 에 포함돼 있어 RESOLVED.

### [INFO] 새 `CODE_MEMORY_LIMIT` 에 대한 CHANGELOG 항목 없음
- 위치: 프로젝트 루트 CHANGELOG (파일 존재 여부 미확인)
- 상세: `CODE_MEMORY_LIMIT` 는 사용자 코드 분기에 영향을 주는 새 공개 에러 코드다. CHANGELOG 가 프로젝트에서 관리된다면 이 에러 코드 추가와 에러 코드 이름 변경(`EXECUTION_TIMEOUT` → `CODE_TIMEOUT`, `CODE_RUNTIME_ERROR` → `CODE_EXECUTION_FAILED`) 은 breaking change 수준이므로 기록이 필요하다. 다만 이 프로젝트의 CHANGELOG 관리 여부를 현재 diff 에서 확인할 수 없어 INFO 로 분류.
- 제안: CHANGELOG 가 존재한다면 에러 코드 rename 및 신규 코드 추가 항목 기록 권장.

### [INFO] `HelpersApi` 인터페이스 삭제 — 타입 문서화 공백
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` (삭제된 코드)
- 상세: 기존 코드에는 `/** Typed surface of the $helpers object injected into the sandbox (spec §2.2). */` JSDoc 이 있는 `HelpersApi` 인터페이스가 있었다. 새 구현에서 `$helpers` 의 API surface(`date`, `crypto.hash`, `crypto.uuid`, `base64.encode`, `base64.decode`)는 BOOTSTRAP_SOURCE 문자열 내에 정의되어 별도 TypeScript 타입이 없다. sandbox 코드는 JS 이므로 타입이 불필요하지만, host 측에서 `$helpers` API surface 를 파악하려면 코드를 직접 읽어야 한다.
- 제안: BOOTSTRAP_SOURCE JSDoc 또는 별도 주석에 `$helpers` API surface 목록을 명시적으로 나열 (`date(value?)`, `crypto.hash(algorithm, data)`, `crypto.uuid()`, `base64.encode(data)`, `base64.decode(data)`).

---

## 요약

이번 `isolated-vm` 전환은 보안 경계를 구조적으로 강화하는 중요 변경이며, 핵심 문서화(사용자 공개 문서, 에러 코드 문서, plan 기록)가 대체로 이번 diff 에 함께 반영됐다. 가장 심각한 문서화 문제는 user-docs(`data.mdx` / `data.en.mdx`)의 에러 코드 표와 허용 전역 목록이 구현 변경과 불일치하는 것으로, 이번 diff 에서 일부 수정이 이뤄졌으나 `setTimeout` 허용 안내 제거와 `CODE_SYNTAX_ERROR` 허상 코드 제거가 완전히 반영됐는지 확인이 필요하다. 구현 코드(`code.handler.ts`)의 인라인 문서화는 복잡한 보안 로직(BOOTSTRAP_SOURCE 실행 순서 의존성, wrapUserCode 라인 오프셋)에 대한 보완이 필요하며, 삭제된 `HelpersApi` 인터페이스의 API surface 설명도 주석 형태로 보존할 것을 권장한다. 전반적으로 spec 참조 및 보안 결정 근거는 잘 기록되어 있다.

---

## 위험도

HIGH

(사용자 공개 문서의 에러 코드·허용 전역 불일치로 인한 런타임 오작동 위험이 CRITICAL 수준으로 존재하며, 이 문제가 현재 diff 에서 완전히 해소됐는지 확인이 필요하다. 구현 코드 문서화 미비는 MEDIUM 이하지만 보안 로직 보완은 권장된다.)

STATUS: SUCCESS
