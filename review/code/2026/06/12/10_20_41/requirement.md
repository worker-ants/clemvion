# 요구사항(Requirement) 리뷰 결과

리뷰 대상: `test-code-http-hardening` 그룹3 (C-2/C-3 후속)
변경 유형: 테스트 보강 + W14 주석 오프셋 수정 + plan 체크박스 갱신

---

## 발견사항

### [INFO] W14 오프셋 수정 (+4 → +3) — spec §4 step2 와 line-level 일치

- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` lines 168-173 (W14 JSDoc)
- 상세: 수정 후 W14 주석이 "3-line header / offset +3 / subtract 3" 로 올바르게 기술됨. 실제 `wrapUserCode` 반환값은 줄 1 `(async () => {`, 줄 2 `"use strict";`, 줄 3 `const __user = async () => {`, 줄 4 이후 사용자 코드이므로 오프셋 +3 이 정확함. 워크트리 spec `4-nodes/5-data/2-code.md` lines 122-124 에도 "헤더 3줄 (...) 런타임 에러 라인은 사용자 원본 기준 +3" 으로 명시되어 line-level 일치.
- 제안: 없음. 정합.

### [INFO] `classifyCodeNodeError` null/undefined 케이스 테스트

- 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts` lines 710-727 (신규 2케이스)
- 상세: `classifyCodeNodeError(null)`, `classifyCodeNodeError(undefined)` 모두 `CODE_RUNTIME_ERROR` 반환 확인. `classifyCodeNodeError(null, undefined)` 로 isolate arg 없는 경로도 검증. `err?.code` / `err?.message` optional-chain 이 `undefined` 로 단락되는 동작과 일치. plan `code-node-isolated-vm-followups.md` "null/undefined 케이스" 요구사항 충족.
- 제안: 없음.

### [INFO] `console.warn`/`console.error` prefix 캡처 + 순서 보존 테스트

- 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts` lines 62-85 (신규 2케이스)
- 상세: `[warn] careful 2`, `[error] boom {"x":1}` 형식 단언. 인터리브된 log/warn/error 순서가 `['[log] a', '[error] b', '[warn] c']` 로 유지됨을 검증. plan 요구사항 `console.warn/error 캡처([warn]/[error] prefix)` 에 정확히 대응.
- 제안: 없음.

### [INFO] `syntaxIsolate` 공유 isolate reuse 내성 테스트

- 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts` lines 37-54 (신규 1케이스)
- 상세: valid/invalid 교차 5회 루프 + 최종 valid 확인. disposed 분기는 module-private 라 직접 트리거 불가하므로 "공유 isolate 가 오염되지 않음" 회귀 검증으로 대체. 주석에 이유 명시. plan 요구사항 `syntaxIsolate disposed 재생성 경로` 에 대한 합리적 근사.
- 제안: 없음.

### [INFO] `$vars` copy-out 실패 → snapshot 복원 테스트

- 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts` lines 95-112 (신규 1케이스)
- 상세: `() => 1` 비직렬화 값을 `$vars.notClonable` 에 할당 → copy-out 실패 → `varsClone` 복원 경로. `result.port === 'success'` + `context.variables === { counter: 1 }` (원본 보존) 단언. plan 요구사항 `$vars copy-out 실패 fallback 직접 검증` 충족. spec `2-code.md §4.5` "copy-out 실패 시 varsClone fallback" 과 일치.
- 제안: 없음.

### [INFO] HTTP SSRF 6-콤보 test.each 차단 검증

- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` (신규 `it.each` — none/custom × IMDS/RFC1918/localhost)
- 상세: 6조합 모두 `port: 'error'` + `output.error.code === 'HTTP_BLOCKED'` + `message.match(/SSRF_BLOCKED/)` 단언. spec `1-http-request.md §4 step8` "전 인증 방식 공통 SSRF 가드 → HTTP_BLOCKED" 및 `§8.2` 결정(none/custom 무가드 폐지) 과 일치. literal IP/localhost fast-path 라 DNS 없이 결정적 차단.
- 제안: 없음.

### [INFO] custom-auth opt-out 테스트

- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` (신규 `allows custom-auth private targets when ALLOW_PRIVATE_HOST_TARGETS=true`)
- 상세: `ALLOW_PRIVATE_HOST_TARGETS=true` 설정 시 `custom` 인증 RFC1918 대상이 `port: 'success'` 로 통과. `global.fetch` 호출 확인. env 복원 `finally` 블록 사용. spec `§4 SSRF opt-out callout` "ALLOW_PRIVATE_HOST_TARGETS=true 로만 허용" 정책과 일치.
- 제안: 없음.

### [INFO] dry-run × none/custom SSRF skip 테스트 — dry-run mock 계약 완전 단언

- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` (신규 `it.each(['none', 'custom'])`)
- 상세: dry-run 컨텍스트(`__dryRun: true, __workspaceId: 'ws-1'`) 에서 IMDS 주소로 none/custom 실행 → `port: 'success'`, `fetchSpy` 미호출, `output._dryRun === true`, `output.wouldHaveCalled.kind === 'http_request'` 모두 단언. 이전 세션(10_07_06) Warning 4 (`output._dryRun` 단언 누락) 가 RESOLUTION.md 에서 FIXED 처리됐고 현 diff 에서 해당 단언이 포함됨. spec `1-http-request.md §4 step8` dry-run 예외(SSRF 가드 이전 mock 반환) 및 `spec/5-system/13-replay-rerun §7` 계약과 일치.
- 제안: 없음.

### [INFO] SSRF 에러 경로 config echo credential strip 테스트

- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` (신규 `SSRF error path config echo strips URL credentials`)
- 상세: `http://alice:s3cr3t@10.0.0.5/internal` 으로 none-auth 요청 → `HTTP_BLOCKED` + `config.url` 에 `s3cr3t`/`alice` 미포함. spec `1-http-request.md §4 step2` URL userinfo 제거 및 Principle 7 D1 (config echo 에서 자격증명 미노출) 과 일치.
- 제안: 없음.

### [INFO] i18n `backend-labels.test.ts` HTTP_BLOCKED / DB_HOST_BLOCKED 매핑 테스트

- 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` (신규 케이스)
- 상세: `LOCALIZED_ERROR_CODES` 에 `HTTP_BLOCKED`·`DB_HOST_BLOCKED` 추가 → `ERROR_KO` 에 해당 키 존재 확인. `translateBackendError` 테스트 (5) HTTP_BLOCKED 한국어 반환 + "SSRF" 포함 단언, (6) DB_HOST_BLOCKED 한국어 반환 + fallback 아님 단언. `backend-labels.ts` 에 두 코드 모두 등록됨(`HTTP_BLOCKED` line 584, `DB_HOST_BLOCKED` line 588). plan "backend-labels HTTP_BLOCKED i18n 매핑 테스트" 충족.
- 제안: 없음.

### [WARNING] [SPEC-DRIFT] spec `2-code.md §4 step2` 래퍼 표현식 — 개념적 단순화와 실제 구현 2단 구조 불일치

- 위치: `spec/4-nodes/5-data/2-code.md` §4 line 107
- 상세: 워크트리 spec §4 line 107 은 래퍼를 `(async () => { "use strict"; <code> })()` 단일 인라인 형태로 표현한다. 실제 `wrapUserCode` 는 2단 구조(`outer async IIFE + "use strict" + inner __user async arrow`)를 사용하며 동일 §4 의 lines 122-124 에서 이를 정확히 기술한다. Step 2 의 인라인 표현식은 실제 구조를 반영하지 않아 독자가 step 2 기준으로 오프셋 계산 시 오류 가능. 코드 구현은 2단 구조로 옳으며, spec step2 가 개념 요약으로서 낡은 상태.
- 제안: 코드 유지. spec `§4 step2` (line 107) 의 래퍼 표현식을 2단 구조로 갱신하거나 "개념적 요약 — 실제 구조 및 오프셋 계산은 §4 step2 아래 노트 참조" 보조 주석 추가. project-planner 위임.

---

## 요약

이 PR 은 C-2/C-3 후속 그룹3으로, plan 에 명시된 테스트 항목 전체(code 노드 classifyCodeNodeError null/undefined·console prefix·isolate reuse·$vars copy-out, HTTP SSRF 6-콤보·opt-out·dry-run·configEcho·i18n)를 구현했다. W14 주석 오프셋 off-by-one 버그도 spec §4 step2 (+3) 에 맞게 수정됐다. dry-run 테스트는 이전 세션 Warning 4 를 RESOLUTION.md 에서 수정 완료하여 `output._dryRun === true` 와 `wouldHaveCalled.kind` 단언이 포함된다. 기능 완전성·에러 시나리오·비즈니스 로직이 spec 과 일치하며 TODO/FIXME 미완성 마커는 없다. 발견된 WARNING 1건은 spec `2-code.md §4 step2` 의 래퍼 표현식이 실제 2단 구조를 묘사하지 않는 [SPEC-DRIFT] 유형으로 코드 버그가 아니라 spec 갱신 누락이며, 코드 자체는 올바르다.

---

## 위험도

LOW

STATUS: SUCCESS
