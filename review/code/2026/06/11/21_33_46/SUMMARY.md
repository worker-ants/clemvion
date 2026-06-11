# Code Review 통합 보고서

**대상**: code-node-isolated-vm — `node:vm` → `isolated-vm@6.1.2` 전환  
**리뷰 일시**: 2026-06-11  
**리뷰어**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, concurrency, api_contract, user_guide_sync

---

## 전체 위험도

**HIGH** — 사용자 가시 런타임 문제(ERROR_KO 매핑 누락)와 user-docs 에러코드 불일치 CRITICAL 2건 존재. 단, docs 불일치 일부는 이번 diff 에 이미 수정 포함 가능성 있어 확인 필요. 신규 `CODE_MEMORY_LIMIT` 의 i18n 매핑 누락은 확정 미수정.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | i18n / UX | `CODE_MEMORY_LIMIT` 신규 에러코드의 한국어 매핑(`ERROR_KO`) 누락 — 메모리 초과 시 사용자에게 영문 raw 코드 `'CODE_MEMORY_LIMIT'` 그대로 노출 | `codebase/frontend/src/lib/i18n/backend-labels.ts` `ERROR_KO` 테이블 | `CODE_MEMORY_LIMIT: '코드 실행 중 메모리 한도(128MB)를 초과했어요.'` 항목 추가 후 `npm test -- backend-labels` 확인 |
| 2 | Documentation | user-docs 에러 코드 표에 구 코드(`EXECUTION_TIMEOUT`, `CODE_RUNTIME_ERROR`, `CODE_SYNTAX_ERROR`)가 잔존 / `setTimeout` 이 허용 전역으로 안내되나 구현은 차단 — 이번 diff 에 수정 포함됐을 가능성 있으나 완전 반영 여부 확인 필요 | `data.mdx` L124-125, `data.en.mdx` L113-114 / L103 | docs 에러코드 표를 `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` / `CODE_MEMORY_LIMIT` 으로 교체, `setTimeout` 행 제거, 이번 diff 에 미반영됐으면 즉시 수정 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 에러 메시지에 내부 레거시 에러코드(`legacyCode`) 프로덕션 응답 노출 — OWASP A05 정보 최소 노출 원칙 위반 | `code.handler.ts` `failure()` L400 | 비프로덕션 환경에서만 `legacyCode` 포함하거나, 클라이언트 API 문서에 "내부 분류 전용" 가드 강화 |
| 2 | Security | `classifyError` 문자열 패턴 매칭 — 사용자 코드가 `throw new Error("Isolate was disposed")` 등을 실행해 에러 분류 스푸핑 가능(하위 워크플로우 분기 조작) | `code.handler.ts` `classifyError()` L431-438 | 에러 타입/`err.code` 속성을 우선 확인하고 메시지 패턴을 fallback으로 격하 |
| 3 | Performance | 실행마다 dayjs UMD + bootstrap 스크립트를 재컴파일·재실행 — 동시 워크플로우 증가 시 컴파일 오버헤드 선형 누적 | `code.handler.ts` L280-286 | `isolated-vm` Snapshot API(`ivm.Isolate.createSnapshot()`)로 힙 스냅샷을 프로세스 시작 시 1회 생성 후 재사용 (plan에서 후속 최적화 여지로 이미 인지됨) |
| 4 | Performance / Concurrency | `syntaxIsolate` 모듈 레벨 싱글톤의 `isDisposed` 체크 부재 — disposed 상태 진입 시 이후 모든 `validate()` 호출 실패 | `code.handler.ts` L172-184 | `syntaxCheck` 진입 시 `if (!syntaxIsolate \|\| syntaxIsolate.isDisposed) { syntaxIsolate = new ivm.Isolate({ memoryLimit: 8 }); }` 추가 |
| 5 | Architecture | `classifyError()` 내부 레거시 코드 반환 + `failure()` 에서 정규화 코드로 재매핑 — 이중 매핑 레이어로 신규 에러 유형 추가 시 누락 위험 | `code.handler.ts` L392-399, L431-439 | `classifyError` 가 정규화된 공개 코드를 직접 반환하도록 단일화하거나, `LEGACY_TO_NORMALIZED` 매핑 테이블 상수로 추출 |
| 6 | Architecture | 모듈 초기화 시점 `readFileSync` 동기 I/O — `dayjs/dayjs.min.js` 부재 시 서버 기동 실패 / 패키지 경로 변경에 취약 | `code.handler.ts` L32-35 | `dayjs/dayjs.min.js` 를 프로젝트 내부 `assets/`로 복사하거나, `readFileSync` 를 팩토리 초기화 시점으로 이동 |
| 7 | Maintainability | `execute()` 메서드 150줄 이상 — isolate 생성·데이터 주입·호스트 콜백·부트스트랩·컴파일·타임아웃 경쟁·`$vars` 동기화·응답 조립 8단계 인라인 | `code.handler.ts` L212-370 | `buildIsolateContext()` 등 헬퍼로 주입·부트스트랩 단계 분리 (즉각 필수 아님) |
| 8 | Maintainability | 에러 코드 정규화 3단 삼항 연산 체인 — 신규 에러 코드 추가 시 수정 포인트 증가 | `code.handler.ts` L392-399 | `const LEGACY_TO_NORMALIZED: Record<string, string>` 상수 테이블 추출 |
| 9 | Testing | `classifyError` 에러 메시지 정규식 패턴 단위 테스트 없음 — `isolated-vm` 버전 업그레이드 시 silent fallback 위험 | `code.handler.ts` L431-439 / `code.handler.spec.ts` | `classifyError` 를 export 또는 별도 단위 테스트로 다양한 메시지 패턴 직접 검증 |
| 10 | Testing | 메모리 초과 테스트에서 CPU 타임아웃(30초)과 메모리 초과 경쟁 — CI 환경에 따라 `CODE_TIMEOUT` 반환으로 flaky 가능성 | `code.handler.spec.ts` L564-581 | 메모리 할당 속도 공격적으로 설정하거나 `timeout` 값 확대, CI flakiness 모니터링 주석 추가 |
| 11 | Testing | `$vars` copy-out 실패 fallback(`varsClone` 유지) 경로 테스트 없음 | `code.handler.ts` L318-330 / `code.handler.spec.ts` | JSON 직렬화 불가 값을 `$vars` 에 할당 후 성공 반환 케이스 추가 |
| 12 | API Contract | 에러 코드 이름 변경(`EXECUTION_TIMEOUT`→`CODE_TIMEOUT` 등)에 대한 클라이언트 마이그레이션 안내 미흡 — `legacyCode` 호환 경로 존재하나 문서 미명시 | `data.mdx`, `data.en.mdx` | 에러 코드 표에 "(구 코드: `legacyCode` 필드로 접근 가능, 신규 코드 사용 권장)" 마이그레이션 안내 추가 |
| 13 | Documentation | `BOOTSTRAP_SOURCE` JSDoc 에 실행 순서 의존성 경고 누락 — 글로벌 삭제는 closure 캡처 이후 실행되어야 함, 순서 변경 시 보안 취약점 발생 | `code.handler.ts` BOOTSTRAP_SOURCE 선언부 | JSDoc 에 "(중요) 글로벌 삭제는 closures 캡처 이후 실행되어야 함 — 순서 변경 시 보안 취약점" 경고 추가 |
| 14 | Documentation | `wrapUserCode` JSDoc 에 래핑 헤더 4줄 오프셋 미명시 — 사용자 코드 오류 라인 번호가 실제와 불일치 | `code.handler.ts` `wrapUserCode` 함수 | JSDoc 에 "오류 라인 번호는 래핑 헤더 4줄 오프셋 포함" 명시 |
| 15 | Documentation | `ISOLATE_MEMORY_LIMIT_MB` 상수 주석에 하드코딩 여부 및 환경변수 추출 가능성 미기재 | `code.handler.ts` 상수 선언부 | "현재 하드코딩 — 운영 튜닝 필요 시 `CODE_NODE_MEMORY_LIMIT_MB` 환경변수 추출 가능" 주석 추가 |
| 16 | Dependency | `isolated-vm@6.1.2` native addon — Alpine/musl 환경 CI 빌드 시간 및 per-exec dayjs 컴파일 오버헤드 기준치 미측정 | `package.json`, CI 파이프라인 | CI alpine 환경 `npm install` 소요시간 기준치 측정 및 기록 권장 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec §5.3 공통 필드 표 `output.error.code` 설명에 `CODE_MEMORY_LIMIT` 누락 — 코드는 옳고 spec 표만 낡음 | `spec/4-nodes/5-data/2-code.md` §5.3 L298 | spec §5.3 표를 `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` / `CODE_MEMORY_LIMIT` 3종으로 갱신 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `queueMicrotask` 가 bootstrap 차단 목록에 포함되나 spec §7.3 차단 API 표에 미등재 — 구현이 spec보다 더 정밀 | `code.handler.ts` L144 vs `spec/4-nodes/5-data/2-code.md` §7.3 | spec §7.3 차단 API 표에 `queueMicrotask` 행 추가 |
| 3 | Security | `syntaxIsolate` disposed 시 내부 에러 메시지가 사용자에게 노출 가능 | `code.handler.ts` L172, `syntaxCheck()` | `isDisposed` 재생성 로직 추가(WARNING #4와 병행 처리) + 에러 메시지 필터링 래퍼 고려 |
| 4 | Security | `$vars` copy-out 실패 시 민감 데이터 크기/깊이 제한 없음 | `code.handler.ts` L329 | `deepClone` 진입 전 바이트 크기 체크 추가 고려 |
| 5 | Security | `deepClone` `JSON.parse(JSON.stringify(...))` — 대용량 변수 객체 동기 처리 시 이벤트 루프 일시 점유 | `code.handler.ts` `deepClone()` L41-44 | 상위 레이어에서 `context.variables` 직렬화 크기 제한 정책 확인 |
| 6 | Security | `readFileSync(require.resolve('dayjs/dayjs.min.js'))` — lockfile integrity 로 공급망 공격 기본 방어 확보됨, CI `npm ci` 사용 여부 확인 권장 | `code.handler.ts` L32-35 | Dependabot 또는 동등 도구로 `isolated-vm` 업데이트 알림 구성 |
| 7 | Security | `isolated-vm@6.1.2` 알려진 CVE 없음 (지식 컷오프 기준), V8 JIT 취약점 주기적 추적 필요 | `package.json` | Dependabot 설정, 다중 테넌트 확장 시 gVisor 추가 레이어 검토 |
| 8 | Security | `BOOTSTRAP_SOURCE` `globalThis` 삭제 후 `__host_*` 콜백 제거 검증 테스트 부재 | `code.handler.ts` L78-149 | `jail.get('__host_hash')` 가 `undefined` 반환하는지 확인하는 회귀 테스트 추가 |
| 9 | Performance | `classifyError` 정규식이 함수 호출마다 재생성 — 고빈도 시 미미한 GC 압력 | `code.handler.ts` L431-439 | `const RE_TIMEOUT = /timed out/i;` 등 모듈 레벨 상수 추출 |
| 10 | Architecture | `CodeHandler` 단일 클래스에 격리·분류·직렬화·설정 에코·`$vars` 동기화 모두 집중 — 현재 규모 수용 가능 | `code.handler.ts` 전체 | `IsolateRunner` / `SandboxFactory` 분리 경로를 TODO 주석으로 명시 |
| 11 | Architecture | `syntaxIsolate` 모듈 레벨 가변 상태 — DIP 관점 암묵적 공유, 테스트 다중 인스턴스 시나리오 주의 | `code.handler.ts` L172 | `CodeHandler` private 필드 또는 `SyntaxChecker` 클래스로 캡슐화 |
| 12 | Architecture | `BOOTSTRAP_SOURCE` 인라인 보안 정책 — TS 타입 체크·lint 미적용 영역 | `code.handler.ts` L78-149 | 차단 키 목록을 `const BLOCKED_GLOBALS` TS 배열로 분리하고 팩토리 함수로 생성 |
| 13 | Requirement | `classifyError` `/memory limit/i`, `/Isolate was disposed/i` 패턴 — isolated-vm 6.x 실제 에러 메시지 확인 후 추가 패턴 보강 선택적 | `code.handler.ts` L435 | 테스트 게이트 존재하므로 즉시 필수 아님 |
| 14 | Requirement | `$vars` copy-out 실패 fallback — spec §4.5 "원본 보존"과 표면적 차이, catch 블록 주석 오해 소지 | `code.handler.ts` L325-329 | 주석을 "fallback 시 varsClone(실행 전 스냅샷)이 원본 보존과 동치" 로 정정 |
| 15 | Side Effect | `context.variables` 직접 교체 catch 블록 주석 "Keep the mutated clone" 오해 소지 | `code.handler.ts` L320-329 | "Keep the pre-execution clone (read-back failed; variables not updated)" 로 주석 정정 |
| 16 | Side Effect | per-execution Isolate 생성·폐기로 GC 압력 및 네이티브 힙 단편화 — 인식된 트레이드오프, plan 기록됨 | `code.handler.ts` L226, L230 | 변경 불필요, 후속 snapshot/pool 최적화 시 처리 |
| 17 | Maintainability | 메모리 초과 테스트 `timeout: 30` (초) vs Jest timeout `30_000` (ms) — 단위 불명확 | `code.handler.spec.ts` L213, L224 | 인라인 주석으로 단위 명시 |
| 18 | Maintainability | `CODE_MEMORY_LIMIT` 주석 형식이 다른 에러 코드 항목과 상이 | `error-codes.ts` L101-103 | 주석 형식 통일 |
| 19 | Testing | `wrapUserCode` 단위 테스트 없음 — 기존 통합 테스트가 간접 커버 | `code.handler.ts` L158-167 | export 후 `return` 있음/없음/top-level `await` 케이스 단위 테스트 추가 또는 주석으로 의도 명시 |
| 20 | Testing | `dayjs.extend()` / locale 플러그인이 isolate 내 동작 불가임을 명시하거나 테스트 없음 | `code.handler.ts` DAYJS_SOURCE / `code.handler.spec.ts` | spec §2.2 에 dayjs API surface 범위 명시, 테스트 추가 |
| 21 | Testing | `$helpers.crypto.hash` unsupported algorithm 에러의 `error` 포트 라우팅 테스트 명확성 부족 | `code.handler.ts` `hostHash` / `code.handler.spec.ts` | `md2` 등 비허용 알고리즘 → `CODE_EXECUTION_FAILED` 라우팅 확인 테스트 |
| 22 | API Contract | `CODE_MEMORY_LIMIT` 가 `spec/5-system/3-error-handling.md §1.4·§3.2` 및 `chat-channel-adapter` 분류 표에 미반영 — 다운스트림 unknown code fallback 처리 위험 | `spec/5-system/3-error-handling.md`, `spec/conventions/chat-channel-adapter.md` | follow-up PR 또는 동반 spec 갱신으로 처리 |
| 23 | Dependency | `isolated-vm@6.1.2` `^` 버전 범위 — lockfile 고정으로 재현성 확보됨, node≥26 승급 전 `7.x` 포함 방지 원할 시 `~6.1.2` 핀 고려 | `package.json` L65 | 현재 lockfile 고정으로 충분, 낮은 우선순위 |
| 24 | Dependency | `dayjs/dayjs.min.js` 경로가 공식 `exports` 필드에 포함되는지 확인 미완료 | `code.handler.ts` L32-35 | dayjs 패키지 `exports` 필드 확인, 미포함이면 공식 alias 사용 고려 |
| 25 | Dependency | `package.json` 에 `engines: { node: ">=22.0.0" }` 미명시 | `codebase/backend/package.json` | `engines` 필드 추가로 하위 Node 버전 설치 시 명시적 경고 |
| 26 | Documentation | `HelpersApi` 인터페이스 삭제로 `$helpers` API surface 타입 문서 공백 | `code.handler.ts` (삭제된 코드) | BOOTSTRAP_SOURCE JSDoc 또는 별도 주석에 `$helpers` API surface 목록 명시 |
| 27 | Documentation | `syntaxCheck` 함수 JSDoc 없음 — 반환 타입(`undefined` = 오류 없음, `string` = 오류 메시지) 문서화 부재 | `code.handler.ts` `syntaxCheck` 함수 | JSDoc 추가 |
| 28 | Documentation | 새 에러 코드 이름 변경 관련 CHANGELOG 항목 없음 (프로젝트 CHANGELOG 관리 여부 미확인) | 프로젝트 루트 CHANGELOG | CHANGELOG 존재 시 breaking change 수준 에러 코드 rename 기록 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| user_guide_sync | CRITICAL | `CODE_MEMORY_LIMIT` `ERROR_KO` 한국어 매핑 누락 — 런타임 영문 raw 코드 노출 |
| documentation | HIGH | user-docs 에러코드/허용전역 불일치 CRITICAL 2건 (diff 반영 여부 확인 필요), JSDoc 미비 다수 |
| security | MEDIUM | `legacyCode` 프로덕션 노출(W), `classifyError` 스푸핑 가능성(W) |
| performance | MEDIUM | per-exec dayjs 재컴파일(W), `syntaxIsolate` disposed 방어 부재(W), 이중 타임아웃 +1000ms 마진(W) |
| testing | MEDIUM | `classifyError` 정규식 단위 테스트 부재(W), 메모리 테스트 flakiness 위험(W), `$vars` copy-out 실패 경로 미테스트(W) |
| architecture | LOW | `classifyError`·`failure()` 이중 매핑(W), 모듈 초기화 `readFileSync`(W) |
| maintainability | LOW | `execute()` 책임 과부하(W), `classifyError` fragile 패턴(W), 에러코드 정규화 삼항 체인(W) |
| side_effect | LOW | `readFileSync` 모듈 로드 경로 이동(W), `syntaxIsolate` 네이티브 힙 장기 점유(W) |
| concurrency | LOW | `syntaxIsolate` disposed 재진입 방어 부재(W), `ivm.Callback` logs 접근 이론적 경계(W) |
| api_contract | LOW | 에러코드 rename 마이그레이션 안내 미흡(W) |
| requirement | LOW | spec §5.3 `CODE_MEMORY_LIMIT` 누락(SPEC-DRIFT, W) |
| dependency | LOW | native addon 빌드 시간 기준치 미측정(W) |
| scope | NONE | 범위 이탈 없음 |

---

## 발견 없는 에이전트

- **scope**: 전체 26개 파일 검토 결과 범위 이탈 없음. 모든 변경이 isolated-vm 전환 목적에 직접 부합.

---

## 권장 조치사항

1. **[즉시 필수]** `codebase/frontend/src/lib/i18n/backend-labels.ts` `ERROR_KO` 테이블에 `CODE_MEMORY_LIMIT: '코드 실행 중 메모리 한도(128MB)를 초과했어요.'` 추가 (CRITICAL #1)
2. **[즉시 확인]** `data.mdx` / `data.en.mdx` 가 이번 diff 에서 구 에러코드(`EXECUTION_TIMEOUT`, `CODE_RUNTIME_ERROR`, `CODE_SYNTAX_ERROR`) 완전 제거 및 `setTimeout` 허용 행 제거를 포함하는지 검증 — 미포함 시 즉시 수정 (CRITICAL #2)
3. **[단기]** `syntaxCheck` 내 `syntaxIsolate.isDisposed` 재생성 방어 코드 추가 (WARNING #4 / 복수 리뷰어 공통 지적)
4. **[단기]** `classifyError` 에러 메시지 정규식 단위 테스트 추가 (WARNING #9)
5. **[단기]** 에러코드 rename 마이그레이션 안내를 user-docs 에 추가 (`legacyCode` 호환 경로 명시) (WARNING #12)
6. **[단기]** `BOOTSTRAP_SOURCE` JSDoc 에 실행 순서 의존성 경고 추가 (WARNING #13)
7. **[단기]** `classifyError` + `failure()` 이중 매핑 단일화 또는 `LEGACY_TO_NORMALIZED` 매핑 테이블 추출 (WARNING #5, #8)
8. **[중기]** spec §5.3 `output.error.code` 표에 `CODE_MEMORY_LIMIT` 추가 (SPEC-DRIFT INFO #1)
9. **[중기]** spec §7.3 차단 API 표에 `queueMicrotask` 추가 (SPEC-DRIFT INFO #2)
10. **[중기]** `spec/5-system/3-error-handling.md §1.4·§3.2` 및 chat-channel-adapter 분류 표에 `CODE_MEMORY_LIMIT` 반영 (INFO #22)
11. **[후속]** Snapshot API 도입으로 per-exec dayjs 재컴파일 제거 (plan 기인지, WARNING #3)
12. **[후속]** `dayjs/dayjs.min.js` 공식 `exports` 경로 안정성 검증 (INFO #24)

---

## 라우터 결정

라우터 선별 실행 (`routing_status=done`).

- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, concurrency, api_contract, user_guide_sync (13명)
- **강제 포함 (router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| database | 이번 변경이 데이터베이스 레이어와 무관한 샌드박스 실행 엔진 전환으로 판단 |