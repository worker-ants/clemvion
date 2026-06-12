# Code Review 통합 보고서

## 전체 위험도
**LOW** — 심각한 버그나 spec 위반 없음. 모든 발견사항은 INFO 수준이며, 문서화 개선·테스트 커버리지 보강·경미한 리팩토링 제안에 해당한다. side_effect 리뷰어 결과 파일 부재(재시도 필요 1건).

## Critical 발견사항

_없음_

## 경고 (WARNING)

_없음_

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `sha1`·`md5` 가 허용 알고리즘 목록에 포함 — 암호학적으로 취약 (OWASP A02) | `code.handler.ts` `ALLOWED_HASH_ALGORITHMS` (line 50–56) | API 문서/hint에 "레거시 호환용이며 보안 목적 사용 금지" 명시; spec에서 명시적 허용 알고리즘이므로 코드 변경 불필요 |
| 2 | Security | `__host_b64decode` — 잘못된 Base64 입력 시 예외 없이 묵시적 실패 | `code.handler.ts` `jail.set('__host_b64decode', ...)` (line 423–428) | API 문서에 "잘못된 입력은 best-effort 디코딩 결과 반환(예외 없음)" 명시 |
| 3 | Security | 스택 트레이스 `NODE_ENV !== 'production'` 조건부 노출 — 스테이징이 실사용자 트래픽 처리 시 위험 | `code.handler.ts` `failure()` (line 553, 567) | 스테이징 환경 고려 시 `EXPOSE_ERROR_STACK=true` 별도 플래그 도입 검토 |
| 4 | Security | 에러 응답 `config.code` 에코 — 민감 정보 하드코딩 시 로그 노출 가능 | `code.handler.ts` `failure()` (line 572) | 코드 에코 최대 N바이트 잘라내기 옵션 고려 |
| 5 | Security | `syntaxIsolate` 모듈 레벨 공유 — Worker Threads 도입 시 가정 재검토 필요 | `code.handler.ts` `syntaxCheck()` (line 264–276) | 현재 단일 스레드 환경에서 문제 없음; Worker Threads 전환 시 스레드 로컬 관리로 리팩토링 |
| 6 | Security | `classifyCodeNodeError` 스포핑 방지 테스트 — 사용자가 `"Isolate was disposed"` throw 시 `CODE_MEMORY_LIMIT` 오분류 가능 | `code.handler.spec.ts` (line 1455–1467) | regex fallback 동작 명시적 문서화; 필요 시 `CODE_RUNTIME_ERROR` fallback으로 변경 검토 |
| 7 | SPEC-DRIFT | [SPEC-DRIFT] `meta.durationMs` 핸들러 미포함 — spec §5.1 JSON 예시와 괴리 (엔진 주입 후 최종 형태 예시임이 spec에 불명확) | `code.handler.ts` execute() 반환 블록; `code.handler.spec.ts` 출력 assertion 전반 | 코드 유지. spec `§5.1` JSON 예시에 "엔진 주입 후 최종 형태; 핸들러 반환값은 `meta: { success, logs }` 만 포함" 주석 추가 |
| 8 | Requirement | 메모리 제한 환경 변수 추출 미완성 작업 주석 (W15) — 기능 동작은 spec과 일치 | `code.handler.ts` line 17–18 | 현재 조치 불필요; 환경 변수 추출 계획 시 `plan/`에 트래킹 이슈 등록 권장 |
| 9 | Requirement | 런타임 에러 라인 오프셋(+3) 표시 계층 미구현 여부 미확인 — 핸들러는 spec 계약 준수 | `code.handler.ts` line 168 (W14 주석) | 프론트엔드 렌더링 계층의 -3 보정 구현 별도 검증 권장 |
| 10 | Requirement | `$helpers.base64.decode` 잘못된 입력 시 묵시적 실패 — spec §2.2 미정의 영역 | `code.handler.ts` line 426–429 | spec §2.2에 "잘못된 입력은 best-effort 디코딩 결과 반환(예외 없음)" 주석 추가 |
| 11 | Requirement | `$vars` copy-out 실패 시 `port: 'success'` 유지 동작 — spec §4.6에 명시 미비 | `code.handler.ts` line 483–497 | spec §4.5 copy-out 실패 섹션에 "포트는 success 유지, 변수만 스냅샷 복원" 명시 |
| 12 | Requirement | `timeout + 1000` wall-clock 버퍼 값의 spec 근거 없음 — 동작은 올바름 | `code.handler.ts` line 478 | 기존 주석(line 462)으로 충분; 추가 조치 불필요 |
| 13 | Scope | 변경된 모든 항목이 PR 목적(dayjs 스냅샷화 + ai-review 후속)에 직접 대응 — 범위 이탈 없음 | `code.handler.ts`, `code.handler.spec.ts` 전체 | 없음 |
| 14 | Maintainability | `execute()` 메서드 ~172 lines, 7단계 책임 혼재 | `code.handler.ts` line 364–536 | `injectContextData`, `injectHostCallbacks`, `runWithTimeout` 등 private 헬퍼로 추출 검토 |
| 15 | Maintainability | 타임아웃 매직 넘버 `+ 1000` 상수명 없음 | `code.handler.ts` line 477 | `const HOST_TIMEOUT_GRACE_MS = 1000;` 추출 + 설명 주석 |
| 16 | Maintainability | `BOOTSTRAP_SOURCE` 내 전역 삭제 목록이 런타임 문자열 리터럴 안에만 존재 | `code.handler.ts` line 205–225 | `const BLOCKED_GLOBALS: readonly string[]` 상수 추출 후 `JSON.stringify` 주입 검토 |
| 17 | Maintainability | `syntaxIsolate` 모듈 레벨 mutable 변수 — 테스트 격리 리셋 API 없음 | `code.handler.ts` line 256 | `resetSyntaxIsolateForTesting()` export 함수 고려 (현재 즉각 문제 없음) |
| 18 | Maintainability | 성공/에러 경로 config 조립 중복 (`code`/`language`/`timeout` 패턴 2곳) | `code.handler.ts` line 501–510, 571–589 | `buildConfigEcho(rawConfig)` 헬퍼로 추출 |
| 19 | Maintainability | `deepClone` — JSON 직렬화 한계 미문서화 | `code.handler.ts` line 113–116 | JSDoc에 "JSON-safe values only" 제약 명시 |
| 20 | Maintainability | fallback 테스트 `ctx` 인라인 재정의 — `context`와 중복 | `code.handler.spec.ts` line 1394–1403 | `makeExecutionContext(overrides?)` 팩토리 함수 추출 |
| 21 | Maintainability | `execute()` 결과 타입 캐스팅 `as unknown as {...}` 패턴 반복 | `code.handler.spec.ts` 다수 it 블록 | `SuccessResult`, `ErrorResult` 타입 별칭 정의 후 재사용 |
| 22 | Testing | `output.error.details` 필드(`legacyCode`/`stack`) 어설션 부재 | `code.handler.spec.ts` basic/timeouts/memory 섹션 전반 | error path에 `expect(result.output.error.details).toMatchObject({ legacyCode: '...' })` 추가 |
| 23 | Testing | `context.rawConfig` 분기 미검증 — 항상 fallback 경로만 실행 | `code.handler.ts` line 377, `code.handler.spec.ts` | `context.rawConfig` 설정 시 config echo가 rawConfig 우선하는지 검증 테스트 추가 |
| 24 | Testing | config echo `timeout` 필드 어설션 부재 | `code.handler.spec.ts` line 204–237 | `expect(result.config.timeout).toBe(30)` 추가 |
| 25 | Testing | `NODE_ENV=production` 시 스택 제거 분기 미검증 | `code.handler.ts` line 553–567 | `process.env.NODE_ENV = 'production'` 임시 설정 + afterEach restore 테스트 추가 |
| 26 | Testing | `deepClone(null/undefined)` 경계값 직접 단위 테스트 없음 | `code.handler.ts` line 113–116 | `context.variables = undefined as any` 통합 케이스로 커버 (낮은 우선순위) |
| 27 | Testing | `$helpers.crypto.hash` — `sha256` 외 4개 알고리즘 미검증 | `code.handler.spec.ts` `execute — $helpers` | `it.each`로 `sha1`, `md5`, `sha384`, `sha512` 성공 경로 추가 |
| 28 | Testing | `BOOTSTRAP_SOURCE` 삭제 전역 일부만 security 테스트에 포함 | `code.handler.spec.ts` line 738 snapshot 테스트 | `Symbol`, `WeakMap`, `Atomics`, `Intl` 등 추가 포함 |
| 29 | Testing | `jest.isolateModules` 블록에 `afterEach(() => jest.restoreAllMocks())` 없음 | `code.handler.spec.ts` line 1366–1416 | describe 블록에 `afterEach(() => jest.restoreAllMocks())` 추가 |
| 30 | Testing | 동시 실행(concurrency) 케이스 미검증 — isolate 독립성 보장 | `code.handler.spec.ts` 전체 | `Promise.all`로 10개+ execute() 동시 실행 후 상태 누출 없음 검증 (낮은 우선순위) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | sha1/md5 허용 목록 포함, 스택 트레이스 조건부 노출, 코드 에코 민감정보 위험 — 모두 INFO |
| requirement | NONE | spec 핵심 요구사항 높은 충실도 구현; `meta.durationMs` SPEC-DRIFT (엔진 주입 계층 명확화 필요) |
| scope | NONE | 모든 변경이 PR 목적(dayjs 스냅샷화 + ai-review 후속)에 직접 대응, 범위 이탈 없음 |
| side_effect | N/A | 결과 파일 부재 — 재시도 필요 |
| maintainability | LOW | `execute()` 172 lines 다중 책임, 타임아웃 magic number, config 조립 중복 — 즉각 차단 이슈 없음 |
| testing | LOW | `output.error.details` 어설션 부재, `rawConfig` 분기 미검증, `config.timeout` 미검증, NODE_ENV=production 분기 미검증 |

## 발견 없는 에이전트

- **scope**: 범위 이탈 발견 없음 (위험도 NONE, 모든 변경 추적 완료)
- **requirement**: spec 위반 발견 없음 (위험도 NONE)

## 권장 조치사항

1. **spec 문서 명확화 (SPEC-DRIFT)**: `spec/4-nodes/5-data/2-code.md §5.1` JSON 예시에 "엔진 주입 후 최종 형태; 핸들러 반환값은 `meta: { success, logs }` 만 포함" 주석 추가. spec §2.2 `$helpers.base64.decode` 및 §4.5 copy-out 실패 섹션 명확화 주석 추가.
2. **테스트 커버리지 보강**: `output.error.details.legacyCode` 어설션 추가 (error path 전반); `context.rawConfig` 분기 테스트; `config.timeout` echo 검증; `NODE_ENV=production` 스택 제거 분기 테스트. 이 4건이 기능 회귀를 놓칠 수 있는 가장 실질적인 갭.
3. **타임아웃 grace 상수화**: `const HOST_TIMEOUT_GRACE_MS = 1000;` 추출 — 의미 불명 magic number 제거.
4. **config 조립 중복 제거**: `buildConfigEcho()` 헬퍼 추출 — config 필드 추가 시 2곳 수정 방지.
5. **deepClone JSDoc 보강**: "JSON-safe values only" 제약 명시 — 미래 오용 방지.
6. **jest.restoreAllMocks() afterEach 추가**: W-D describe 블록 방어적 cleanup.
7. **side_effect 리뷰어 재시도**: 결과 파일(`side_effect.md`) 부재로 부작용 분석 완료되지 않음 — 재실행 권장.

## 라우터 결정

라우터가 reviewer 를 선별하여 실행:

- **실행 (강제 포함, router_safety)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing` (6명)
- **제외**: 아래 표 (8명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| documentation | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |

- **강제 포함 (router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (6명 전원 강제 포함)

---

_재시도 필요: side_effect (output_file 부재 — 1건)_