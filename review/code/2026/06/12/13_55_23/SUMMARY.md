# Code Review 통합 보고서

대상 파일: `codebase/backend/src/nodes/data/code/code.handler.ts`
리뷰 세션: 2026/06/12 13:55:23

## 전체 위험도

**HIGH** — requirement 리뷰어가 spec §2.2 base64 TypeError 계약 위반 가능성(CRITICAL)과 메모리 초과 오류 메시지 spec 불일치(WARNING)를 발견했으며, 이는 디스크 파일과 리뷰 페이로드 간 버전 불일치에서 비롯된다. 나머지 reviewer 들은 LOW/NONE 위험도이며 모두 INFO/WARNING 수준 개선 제안에 그친다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | REQUIREMENT | `$helpers.base64.encode/decode` — 비문자열 인자에 대해 spec §2.2가 요구하는 `TypeError` throw가 현재 디스크 파일에 미반영. 디스크 파일은 `Buffer.from(String(data), ...)` 로 silent 강제변환 수행. 리뷰 페이로드(신버전)는 올바르게 구현하나 **어느 버전이 실제 배포 대상인지 명확히 해야 함** | `code.handler.ts:398–408` (디스크 구버전 기준) | 배포 대상 버전을 확인한다. 디스크 구버전이 배포 대상이라면 `hostB64Encode`/`hostB64Decode` 의 `typeof` guard 를 즉시 추가한다. |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | REQUIREMENT | `EXECUTION_MEMORY_EXCEEDED` 오류 메시지를 `overrideMessage` 로 고정하지 않아, isolated-vm 버전 업그레이드 시 spec §5.3.3 예시 문자열(`"Isolate was disposed during execution due to memory limit"`) 과 달라질 수 있음 | `execute()` catch 블록 / `failure()` 메서드 | `EXECUTION_TIMEOUT` 과 동일하게 `errorCode === 'EXECUTION_MEMORY_EXCEEDED'` 에도 `overrideMessage: 'Isolate was disposed during execution due to memory limit'` 추가 |
| 2 | REQUIREMENT | `resolveMemoryLimitMb` — `parseInt("64abc")` 가 `64`를 반환하여 spec §7.2의 "비수치 fallback" 의도와 부분적으로 어긋남. 운영자 오타를 경고 없이 수락 | `resolveMemoryLimitMb()` 함수 (~line 58–75) | `Number(raw.trim())` 체크로 순수 숫자 여부를 검증하거나, 현재 동작이 허용이라면 JSDoc에 "prefix 숫자 파싱은 의도적" 명시 |
| 3 | REQUIREMENT | `deepClone` 의 `JSON.stringify` — 순환 참조 또는 `undefined` 키 포함 시 throw하여 엔진 내부 오류처럼 노출됨. spec §4.5 는 비직렬화 변수 처리를 미명시 | `deepClone()` (~line 151–155), `execute()` 내 `varsClone` | `deepClone` 내부에 try/catch 추가하거나 `varsClone` 직렬화 오류를 조기에 catch 해 명확한 오류 메시지 제공 |
| 4 | ARCHITECTURE | `CodeHandler` 클래스의 다중 책임(SRP 경계): VM 샌드박스 인프라(isolate 생명주기)와 노드 핸들러 비즈니스 로직을 단일 클래스에 통합. 향후 언어 추가 시 OCP 위반으로 발전 가능 | `CodeHandler` 클래스 전체 (lines 407–702) | 즉각 필수 아님. 언어 확장 계획이 있다면 `IsolateExecutor` 인터페이스 추출 + 의존성 주입 구조 검토 |
| 5 | SIDE_EFFECT | 모듈 로드 시점에 `ISOLATE_MEMORY_LIMIT_MB`·`DAYJS_SNAPSHOT` 전역 고정 — 이후 env 변경 반영 불가, 테스트 격리 어려움 | `code.handler.ts:78, 133–145` | spec §7.2 "operator-tunable via env at process start" 와 일치하면 주석에 "프로세스 재시작 없이는 변경 불가" 명시. 단위 테스트 격리 주의사항 추가 |
| 6 | SIDE_EFFECT | `syntaxIsolate` 모듈-수준 가변 전역 — 정상 흐름에서 영구 보유되어 프로세스 메모리 기준선 상승, 단일 이벤트 루프 직렬화 전제가 코드에 명시적으로 문서화되어야 함 | `code.handler.ts:325–345` | 싱글톤 설계 의도·메모리 한도(8 MB)·worker_threads 이식 시 재검토 필요 사항을 주석에 명시 |
| 7 | CONCURRENCY | `syntaxIsolate` — 향후 `validate()` async 전환 또는 worker thread 이식 시 TOCTOU 경쟁 조건 가능. 현재는 동기 단일스레드로 안전하나 주석 보완 필요 | `code.handler.ts:328–348` | 현행 유지. 주석에 worker_threads 이식 시 재검토 필요 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | `__host_log` 콜백에서 개별 로그 라인 길이 제한 없음 — `console.log('A'.repeat(10_000_000))` 으로 호스트 힙에 수십 MB 할당 가능 | `_buildIsolateContext` (lines 590–595) | `String(payload).slice(0, MAX_LOG_LINE_LENGTH)` (예: 10,000자) 적용 |
| 2 | SECURITY | `eval`/`Function` 삭제가 `globalThis` 에서만 이루어지며 프로토타입 체인 경유 우회 이론적 가능 (코드 주석에서 인지됨, 실질 탈출 불가) | `BOOTSTRAP_SOURCE` (~lines 274–294) | `Object.freeze(Function.prototype)` 추가 검토 (라이브러리 충돌 사전 확인 필요) |
| 3 | SECURITY | `ALLOWED_HASH_ALGORITHMS` 에 `md5`, `sha1` 포함 — 암호화 목적 사용 시 취약 | `code.handler.ts:82–89` | 문서/UI hint 에 "MD5/SHA-1은 암호화 목적 사용 금지" 명시 |
| 4 | SECURITY | `failure()` 에서 스택 트레이스를 `NODE_ENV !== 'production'` 조건으로 클라이언트 응답에 포함 (의도된 동작, 서버 디버깅 전용) | `failure()` (lines 664–678) | UI 레이어에서 `details.stack` 미렌더링 보장 또는 서버 측 로그 전용 분리 검토 |
| 5 | PERFORMANCE | `deepClone` 이 `JSON.parse(JSON.stringify(...))` 사용 — `structuredClone` 이 더 빠르고 Date/Map/Set 처리 가능 | `deepClone` (~line 151–154) | `structuredClone(value)` 로 교체 (Node 17+) |
| 6 | PERFORMANCE | `_buildIsolateContext` 내 8개 `jail.set` 순차 await — 동기 버전(`jail.setSync`)으로 전환 가능 | `_buildIsolateContext` (lines 554–595) | 컨텍스트 주입 8개 set 만 `setSync` 전환 검토 |
| 7 | MAINTAINABILITY | `_runWithTimeout` 내 wall-clock grace period `+1000` 매직 넘버 | `code.handler.ts:641` | `const WALL_CLOCK_GRACE_MS = 1000` 상수 추출 |
| 8 | MAINTAINABILITY | syntax check isolate 메모리 한계 `8` 매직 넘버 | `code.handler.ts:336` | `const SYNTAX_CHECK_MEMORY_LIMIT_MB = 8` 상수 추출 + 근거 주석 |
| 9 | MAINTAINABILITY | `__host_*` 이름이 `BOOTSTRAP_SOURCE` 문자열과 `_buildIsolateContext` jail.set 블록에 이중 관리 — 이름 불일치 시 런타임 버그로만 드러남 | `BOOTSTRAP_SOURCE` (~lines 263–268), `_buildIsolateContext` (~lines 573–587) | `HOST_CALLBACK_NAMES` 상수 배열로 단일 소스화 검토, 또는 주석으로 동기화 위험 경고 |
| 10 | MAINTAINABILITY | `failure()` 와 `execute()` 성공 경로에서 config echo 구조체 중복 | Lines 497–500, 657–661 | `buildConfigEcho(config)` 헬퍼 함수로 추출 |
| 11 | MAINTAINABILITY | warn/error 메시지 한글·영문 혼재 (한글 warn 메시지 1개) | `code.handler.ts:113–114` 외 | operator-facing 메시지 언어 통일(영어 권장) |
| 12 | MAINTAINABILITY | `wrapUserCode` 내 라인 오프셋 `+3` 미상수화 | `code.handler.ts:311–319` | `export const USER_CODE_LINE_OFFSET = 3` 선언, UI 레이어와 단일 진실 공유 |
| 13 | TESTING | `resolveMemoryLimitMb` 소수점 입력 절사 동작 미테스트 (`"256.9"` → 256) | `code.handler.spec.ts:883–921` | 소수점 절사 케이스 추가 |
| 14 | TESTING | 허용 해시 알고리즘 일부 미검증 (`sha1`, `md5`, `sha384`, `sha512`) | `code.handler.spec.ts` | `ALLOWED_HASH_ALGORITHMS` 각 멤버에 대한 기본 동작 테스트 추가 |
| 15 | TESTING | `wrapUserCode` 라인 오프셋 +3 계약 테스트 없음 | `code.handler.ts:311–320` | throw 포함 코드 실행 후 스택 라인 번호 오프셋 검증 테스트 추가 |
| 16 | REQUIREMENT | [SPEC-DRIFT] `CODE_NODE_MEMORY_LIMIT_MB` 환경변수화 — 구버전 디스크 파일 W15 주석이 stale (신버전 배포 시 자동 해소) | `code.handler.ts:15–20` (디스크 구버전) | 신버전 배포 후 자동 해소, 별도 조치 불필요 |
| 17 | REQUIREMENT | spec §5.1 `meta.durationMs` — 핸들러는 `meta: { success, logs }` 만 반환하고 엔진이 주입하는 구조로 코드 결함 아님 | `execute()` 성공 경로 반환값 | 현 구현 정확 |
| 18 | SIDE_EFFECT | `context.variables` 직접 교체 패턴이 `ExecutionContext` 인터페이스 계약에 미명시 | `execute()` (lines 478–491) | `NodeHandler.execute()` 또는 `ExecutionContext.variables` JSDoc에 "Code 노드는 `context.variables` 직접 교체 가능" 명시 |
| 19 | CONCURRENCY | `execute()` 내 `context.variables` 비원자적 갱신 — `ExecutionContext` 단일 실행 단위 귀속 계약 하에 안전 | `code.handler.ts:481–495` | spec 또는 타입 정의에 "단일 실행 단위 전용(not shared across parallel executes)" 주석 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | CRITICAL: base64 TypeError 계약 미반영(버전 불일치) / WARNING: 메모리 초과 메시지 overrideMessage 미설정, parseInt prefix 파싱 엣지케이스, deepClone 순환참조 미처리 |
| architecture | LOW | WARNING: CodeHandler SRP 경계(VM 인프라+비즈니스 로직 혼재), 향후 언어 확장 시 OCP 위반 위험 |
| security | LOW | INFO: 로그 라인 길이 무제한, 프로토타입 체인 우회 이론적 가능, MD5/SHA-1 허용목록 포함, 스택 트레이스 노출 |
| side_effect | LOW | WARNING: 모듈 로드 시점 전역 고정(env 변경 반영 불가), syntaxIsolate 모듈-전역 변수 명시적 문서화 필요 |
| concurrency | LOW | WARNING: syntaxIsolate worker_threads 이식 시 TOCTOU 잠재 위험, INFO: context.variables 비원자적 갱신 계약 문서화 필요 |
| performance | LOW | INFO: deepClone을 structuredClone으로 교체, jail.set → setSync 전환 가능 |
| testing | LOW | INFO: 소수점 절사·해시 알고리즘·라인 오프셋 +3 테스트 갭 |
| maintainability | LOW | INFO: 매직 넘버 상수화, __host_* 이름 이중관리, config echo 중복, 언어 혼재 |
| scope | NONE | 변경이 SUMMARY W1/W3 항목에 정확히 대응하며 범위 이탈 없음 |

---

## 발견 없는 에이전트

- **scope**: 범위 이탈 없음. 모든 변경이 커밋 의도(W1 warn 추가, W3 JSDoc 정밀화)에 1:1 대응.

---

## 권장 조치사항

1. **(즉시·CRITICAL)** 배포 대상 버전 확인: 디스크 파일(구버전)과 리뷰 페이로드(신버전) 중 어느 것이 실제 배포되는지 확인하고, 구버전이 배포된다면 `hostB64Encode`/`hostB64Decode` 의 비문자열 `TypeError` guard 를 즉시 추가한다.
2. **(높은 우선순위·WARNING)** `EXECUTION_MEMORY_EXCEEDED` 에 `overrideMessage: 'Isolate was disposed during execution due to memory limit'` 추가 — isolated-vm 내부 메시지 변경에 의한 spec §5.3.3 회귀 방지.
3. **(중간 우선순위·WARNING)** `resolveMemoryLimitMb` 에서 `Number(raw.trim())` 기반 순수 숫자 검증 추가, 또는 JSDoc 에 현재 동작이 의도적임을 명시.
4. **(중간 우선순위·WARNING)** `deepClone` 에 try/catch 추가하여 순환 참조/비직렬화 변수에 대한 명확한 오류 메시지 제공.
5. **(낮은 우선순위·INFO)** 보안: `__host_log` 콜백에 단일 라인 최대 길이 제한(예: 10,000자) 추가.
6. **(낮은 우선순위·INFO)** 유지보수성: `WALL_CLOCK_GRACE_MS`, `SYNTAX_CHECK_MEMORY_LIMIT_MB` 상수 추출; `buildConfigEcho` 헬퍼 추출; operator-facing 메시지 언어 통일.
7. **(낮은 우선순위·INFO)** 테스트: `resolveMemoryLimitMb` 소수점 절사, `ALLOWED_HASH_ALGORITHMS` 전체 알고리즘, `wrapUserCode` 라인 오프셋 +3 테스트 추가.
8. **(문서화)** `syntaxIsolate` 주석에 "worker_threads 이식 시 TOCTOU 재검토 필요" 명시; `ExecutionContext.variables` 직접 교체 계약을 JSDoc 에 문서화.

---

## 라우터 결정

라우터가 선별 실행했습니다 (`routing_status=done`).

- **실행** (9명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `concurrency`
- **강제 포함(router_safety)** (6명): `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (5명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| documentation | 라우터 제외 |
| dependency | 라우터 제외 |
| database | 라우터 제외 |
| api_contract | 라우터 제외 |
| user_guide_sync | 라우터 제외 |