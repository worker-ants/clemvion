# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — isolated-vm 전환은 보안을 구조적으로 강화하는 방향이며 하위 호환성도 유지된다. 다만 `CODE_MEMORY_LIMIT` 가 `execution-failure-classifier.ts` 의 `INTERNAL_CODES` Set 에 미등록되어 spec 계약 위반 + 노이즈 warn 로그가 발생하고, MD5/SHA-1 취약 해시 알고리즘이 암호학적 목적에 사용될 수 있다는 경고(사용자 가이드 미주석)가 주요 수정 대상이다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | Critical 발견사항 없음 | — | — |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `CODE_MEMORY_LIMIT` 가 `execution-failure-classifier.ts` 의 `INTERNAL_CODES` Set 에 미등록. spec(chat-channel-adapter.md §3.1)은 `executionFailedInternal` 분류를 명시하나 unknown-fallback 경로로 처리되어 불필요한 `warn` 로그가 발화됨. 기능 반환값은 우연히 동일하나 spec 계약 위반임 | `execution-failure-classifier.ts` — `INTERNAL_CODES` Set (line 54–68) | `INTERNAL_CODES` 에 `'CODE_MEMORY_LIMIT'` 를 추가 |
| 2 | 보안 | MD5/SHA-1 이 `$helpers.crypto.hash` API 의 `ALLOWED_HASH_ALGORITHMS` 에 허용됨. spec §2.2 가 "체크섬, 레거시 호환" 여부를 명시하지 않아 사용자가 암호학적 보안 목적(패스워드 해시 등)으로 사용할 수 있음 | `code.handler.ts` — `ALLOWED_HASH_ALGORITHMS` 상수 및 `hostHash()` | spec §2.2 에 md5/sha1 은 비암호학적 용도 전용임을 경고 명시; 장기적으로 deprecated 플래그 또는 제거 검토 |
| 3 | 보안 | `exposeStack = process.env.NODE_ENV !== 'production'` 조건으로 스택 트레이스가 응답에 포함됨. `NODE_ENV` 가 `undefined` / `staging` / `test` 이면 내부 경로·구조 노출. 배포 시 단일 의존점 | `code.handler.ts` — `failure()` 메서드, `exposeStack` 조건 | `process.env.NODE_ENV === 'development'` 명시적 화이트리스트 방식으로 변경; 또는 서버사이드 로그 전용으로 이동; 배포 체크리스트에 `NODE_ENV=production` 필수 명문화 |
| 4 | 유지보수성 | `execute()` 메서드가 약 160줄에 7가지 책임(isolate 생성, 컨텍스트 주입, host callback, bootstrap 로드, 사용자 코드 컴파일, 이중 타임아웃 race, `$vars` sync-back, 결과 조립)을 혼재하여 변경 시 부작용 추적 부담이 높음 | `code.handler.ts` — `CodeHandler.execute()` (line 1169–1330) | `_buildIsolateContext()`, `_runWithTimeout()` 등으로 역할 분리하여 `execute()` 가 오케스트레이션만 담당하도록 리팩터링 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `output.error.details.legacyCode` 에 내부 분류 코드(`EXECUTION_TIMEOUT` 등)가 production 포함 항상 응답에 노출됨. 후속 노드가 실제로 이 값에 의존하지 않는다면 제거 가능 | `code.handler.ts` — `failure()` 메서드 | production 에서 `details.legacyCode` 노출 필요성 재검토; deprecation 계획 spec 명시 |
| 2 | 보안 | `__host_b64encode` / `__host_b64decode` — 비문자열 입력 시 `String()` 강제 변환으로 silent failure(예: `[object Object]`). `hostHash()` 는 동일 상황에 TypeError 를 throw하여 불일치 | `code.handler.ts` — `__host_b64encode`, `__host_b64decode` Callback | `typeof data !== 'string'` 검사 추가, 비문자열 입력에 TypeError 발생으로 일관성 확보 |
| 3 | 보안 | `ISOLATE_MEMORY_LIMIT_MB = 128` 하드코딩. W15 주석에서 인지하고 있으나 다중 테넌트 환경에서 런타임 조정 불가 | `code.handler.ts` — `ISOLATE_MEMORY_LIMIT_MB` | `CODE_NODE_MEMORY_LIMIT_MB` 환경 변수로 추출, 안전한 상한(512MB 이하) 강제 |
| 4 | 보안 | 에러 메시지에 사용자 제공 `algorithm` 문자열이 최대 길이 검사 없이 직접 반영됨 | `code.handler.ts` — `hostHash()` 에러 메시지 | 에러 메시지 내 알고리즘 문자열 최대 50자 truncate |
| 5 | 요구사항 | W14 코멘트의 라인 오프셋 수치 오류 — "4-line header / +4" 라고 명시되어 있으나 실제 prepend 줄은 3줄이므로 +3이 정확함 | `code.handler.ts` — `wrapUserCode` JSDoc W14 코멘트 | W14 주석의 "4-line header" / "+4" 를 "3-line header" / "+3" 으로 정정 |
| 6 | SPEC-DRIFT | [SPEC-DRIFT] spec §4 실행 로직 step 2 의 래핑 패턴이 현재 구현과 불일치. spec 은 1-단 구조를 설명하나 구현은 outer IIFE + inner async 의 2-단 구조 | `spec/4-nodes/5-data/2-code.md §4` step 2 | 코드 유지, spec §4 step 2 래핑 구조 설명을 실제 2-단 패턴으로 갱신 |
| 7 | SPEC-DRIFT | [SPEC-DRIFT] W14 라인 오프셋 정보(런타임 에러 라인 번호 오프셋)가 spec 에 미명시. UI/디버깅에 영향을 주는 동작임 | `spec/4-nodes/5-data/2-code.md` 전체 | 코드 유지, spec §4 또는 §2(에디터 설명)에 "런타임 에러 라인 번호는 래퍼 헤더 3줄 오프셋" 추가 |
| 8 | 부작용 | `LEGACY_TO_NORMALIZED` 가 `const` + `Record<string, string>` 으로 선언되어 런타임 변이 기술적으로 가능 | `code.handler.ts` lines 1383–1393 | `Object.freeze()` 또는 `as const` (`satisfies Record<string, string>`) 적용 |
| 9 | 유지보수성 | `classifyError` 테스트 이름 "should NOT classify user-thrown 'Isolate was disposed' as memory when isolate is alive" 이 실제 결과(`EXECUTION_MEMORY_EXCEEDED`)와 모순되어 독해 혼란 야기. 실제로는 priority-3 regex 로 분류됨 | `code.handler.spec.ts` — classifyError (unit) 두 번째 테스트 | 테스트 이름을 "should fall through to regex (priority 3) when isolate is alive — priority-2 isDisposed branch not triggered" 등으로 수정 |
| 10 | 유지보수성 | 모듈 레벨 상수(`RE_*`, `LEGACY_TO_NORMALIZED`)가 파일 하단에 선언되어 사용처보다 아래에 위치. 코드 읽기 흐름을 역행 | `code.handler.ts` lines 1382–1393 | 기존 상수 블록(파일 상단) 으로 이동하여 "상수 → 헬퍼 함수 → 클래스" 순서 유지 |
| 11 | 유지보수성 | `backend-labels.ts` 의 `CODE_MEMORY_LIMIT` 메시지에 `128MB` 하드코딩. `ISOLATE_MEMORY_LIMIT_MB` 상수와 독립 관리되어 메모리 한도 변경 시 두 파일 동시 수정 필요 | `backend-labels.ts` — `CODE_MEMORY_LIMIT` 항목 | 주석 `// keep in sync with ISOLATE_MEMORY_LIMIT_MB in code.handler.ts` 추가; 장기적으로는 백엔드 에러에 `params` 담아 프론트엔드 보간 처리 |
| 12 | 유지보수성 | W-번호 참조 형식 불일치(`// W8:`, `// W13 (IMPORTANT ...)`, `// W4/INFO#3` 등). 파일 내 탐색 어려움 | `code.handler.ts` 전반 | 파일 상단에 `// Review annotations (W*): see review/code/2026/06/11/22_03_15/` 한 줄 추가 |
| 13 | 테스팅 | 메모리 초과 통합 테스트 CI 플래키니스(W10) — `CODE_MEMORY_LIMIT` 대신 `CODE_TIMEOUT` 이 발생할 수 있다는 경고가 주석으로만 존재하며 코드 수준 완화(`jest.retryTimes`, 환경별 skip) 없음 | `code.handler.spec.ts` lines 41–45, 685–707 | `CI=true` 환경에서 skip 또는 `jest.retryTimes(2)` 적용; classifyError 단위 테스트가 의도를 충분히 커버하므로 통합 테스트는 `@slow` suite 분리 검토 |
| 14 | 테스팅 | `classifyError(null as any)`, `classifyError(undefined as any)` 케이스에 대한 명시적 테스트 없음. 구현은 optional chaining 으로 안전하나 regression 방지 명시 테스트 부재 | `code.handler.spec.ts` — classifyError (unit) 블록 | null/undefined 케이스를 별도 it 블록으로 추가 |
| 15 | 테스팅 | `console.warn`, `console.error` 캡처 및 prefix 포맷(`[warn]`, `[error]`) 검증 테스트 없음. BOOTSTRAP_SOURCE 에서 세 레벨 모두 `__host_log` 로 라우팅되나 warn/error 레벨은 미검증 | `code.handler.spec.ts` — execute security restrictions | `console.warn("test")` → `meta.logs` 에 `"[warn] test"` 포함 여부 테스트 추가 |
| 16 | 테스팅 | `syntaxIsolate.isDisposed` 재생성 경로(W4/INFO#3) 직접 검증 테스트 없음 | `code.handler.ts` line 1131–1133 | disposed 상태에서 재생성 후 정상 작동 확인 테스트 추가 (권고 수준) |
| 17 | 테스팅 | `LEGACY_TO_NORMALIZED` 에 없는 키의 fallback 경로(`?? errorCode`)가 내부 코드를 그대로 공개 API 에 노출하는 케이스에 대한 테스트 없음 | `code.handler.ts` line 1354 | 알 수 없는 코드 발생 시 `CODE_EXECUTION_FAILED` 기본값 또는 warn 로그 방어 코드 추가 후 테스트 보완 |
| 18 | 문서화 | `classifyError` JSDoc 에 `@param err` / `@param [isolate]` 태그 누락. `syntaxCheck` JSDoc 에 `@param wrappedCode` 태그 누락 | `code.handler.ts` — 각 함수 JSDoc | 해당 `@param` 태그 추가 |
| 19 | 문서화 | `ISOLATE_MEMORY_LIMIT_MB` W15 주석 "Can be extracted to env var" 이 이미 구현된 것처럼 읽힐 여지 있음 | `code.handler.ts` — `ISOLATE_MEMORY_LIMIT_MB` JSDoc | "TODO(W15): Not yet implemented — currently hardcoded." 형식으로 명확화 |
| 20 | 문서화 | spec §7.2 / §5.3.3 에 isDisposed flag(priority-2) → message regex(priority-3) 분류 방식 설명 없음 | `spec/4-nodes/5-data/2-code.md` §7.2 또는 §5.3.3 | "분류 방식: `isolate.isDisposed` 플래그(priority 2) → 메시지 regex(priority 3) 순서로 판단" 한 줄 추가 |
| 21 | API 계약 | `classifyError` export 가 테스트 전용임을 명시하는 마커 없음. 외부 의존 방지 관리 필요 | `code.handler.ts` — `export function classifyError` | JSDoc 에 `@internal` 마커 추가 |
| 22 | API 계약 | `LEGACY_TO_NORMALIZED` fallthrough(`?? errorCode`) 경로에서 알 수 없는 내부 코드가 비정규화된 채로 공개 API 응답에 노출될 위험 | `code.handler.ts` line 1354 | fallthrough 시 `CODE_EXECUTION_FAILED` 기본값 또는 warn 로그 방어 코드 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | MD5/SHA-1 허용(WARNING), 스택 트레이스 NODE_ENV 의존 노출(WARNING), legacyCode production 노출(WARNING) |
| requirement | LOW | `CODE_MEMORY_LIMIT` INTERNAL_CODES 미등록(WARNING), spec 래핑 패턴 drift 2건(SPEC-DRIFT INFO) |
| scope | NONE | 범위 일탈 항목 없음. 모든 변경이 isolated-vm 전환 단일 범위 내 |
| side_effect | LOW | `LEGACY_TO_NORMALIZED` 런타임 변이 가능성(INFO), classifyError export 표면 확장(INFO) |
| maintainability | LOW | `execute()` 과도한 길이/다중 책임(WARNING), 모듈 상수 선언 순서 역전(INFO) |
| testing | LOW | 메모리 테스트 CI 플래키니스 미완화(INFO), null/undefined 케이스 미검증(INFO), warn/error 캡처 미검증(INFO) |
| documentation | LOW | classifyError @param 태그 누락(INFO), 테스트 이름 의도 불명확(INFO), 라인 오프셋 +4 오류(INFO) |
| api_contract | LOW | legacyCode 수명 미문서화(INFO), fallthrough 비정규화 노출 위험(INFO) |
| user_guide_sync | NONE | 매트릭스 18개 trigger 전수 통과. new-error-code 동반 갱신 충족 |

---

## 발견 없는 에이전트

- **scope**: Critical/WARNING 발견 없음 — 모든 변경이 isolated-vm 전환 단일 범위 내
- **user_guide_sync**: 동반 갱신 누락 0건 — `ERROR_KO` 매핑 3개 및 `data.mdx` + `data.en.mdx` KO/EN parity 충족

---

## 권장 조치사항

1. **[필수 — WARNING#1]** `execution-failure-classifier.ts` 의 `INTERNAL_CODES` Set 에 `'CODE_MEMORY_LIMIT'` 추가 (spec 계약 위반 + 노이즈 warn 로그 해소)
2. **[권고 — WARNING#2]** `spec/4-nodes/5-data/2-code.md §2.2` 에 MD5/SHA-1 비암호학적 용도 전용 경고 명시 (사용자 오용 방지)
3. **[권고 — WARNING#3]** `exposeStack` 조건을 `=== 'development'` 화이트리스트 방식으로 변경하거나 서버사이드 로그 전용으로 이동
4. **[권고 — WARNING#4]** `execute()` 메서드를 `_buildIsolateContext()`, `_runWithTimeout()` 등으로 분리하여 단일 책임 원칙 적용
5. **[권고 — INFO#5]** W14 주석 "+4 offset" → "+3 offset" 정정 (실제 prepend 줄 수와 일치)
6. **[권고 — SPEC-DRIFT #6, #7]** spec §4 step 2 래핑 구조 설명을 2-단 패턴으로 갱신; spec §4 또는 §2 에 "3줄 오프셋" 추가 (코드 변경 불필요, spec 갱신만)
7. **[권고 — INFO#9]** 테스트 이름 "should NOT classify...as memory" → priority-3 regex 분기 의도를 반영한 명칭으로 수정
8. **[권고 — INFO#11]** `backend-labels.ts` CODE_MEMORY_LIMIT 메시지에 `ISOLATE_MEMORY_LIMIT_MB` 동기화 의무 주석 추가
9. **[권고 — INFO#13]** 메모리 초과 통합 테스트 CI 플래키니스에 대해 `jest.retryTimes(2)` 또는 환경별 skip 가드 추가
10. **[선택 — INFO#8]** `LEGACY_TO_NORMALIZED` 에 `Object.freeze()` 또는 `as const` 적용으로 런타임 변이 방지

---

## 라우터 결정

라우터가 reviewer 를 선별하여 실행함.

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync` (9명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외**: 5명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |