# Code Review 통합 보고서

## 전체 위험도
**HIGH** — spec 갱신 누락(CRITICAL)이 코드-spec 비대칭을 영구화할 위험. 구현 자체는 기능상 올바르나 spec 단일 진실 원칙 위반이 미해소 상태.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항/문서화 | `CAFE24_INSTALL_RATE_LIMITED` 에러 코드 및 Layer 2 실패 페널티 정책(`FAIL_THRESHOLD=10`, `FAIL_WINDOW_SEC=600`)이 spec 에 미등재. plan step 4(DOCUMENTATION)가 완료로 체크되어 있으나 실제 spec 파일 미갱신. consistency-check W1·W2·W3 경고가 미해소 상태로 구현 완료됨 | `spec/4-nodes/4-integration/4-cafe24.md` §9.8; `spec/2-navigation/4-integration.md` §10.3 에러 코드 vocabulary 표 | `project-planner` 위임 후 두 spec 파일 갱신: (1) `spec/4-nodes/4-integration/4-cafe24.md §9.8` 에 Layer 2 실패 페널티 단락·상수 표·Rationale 추가, (2) `spec/2-navigation/4-integration.md` 에러 코드 표에 `CAFE24_INSTALL_RATE_LIMITED (429)` 행 추가, (3) 코드 상수명(`FAIL_THRESHOLD`/`FAIL_WINDOW_SEC`) 기준으로 spec 상수 표 작성 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `req.ip` 신뢰 전제 미검증 — Express `trust proxy` 미설정 시 헤더 위조로 lockout 우회·DoS 가능 | `third-party-oauth.controller.ts` L107 `const clientIp = req.ip` | 앱 초기화 시 `app.set('trust proxy', ...)` 명시 설정; IP 추출을 전용 미들웨어로 중앙화 |
| 2 | 보안 | `buildKey` IP 입력 새니타이징 부재 — 비정상 IP 값(개행 포함 등) 유입 시 Redis 키 공간 오염 가능 | `cafe24-install-rate-limit.service.ts` L139-141 `buildKey` | 진입 시점에 IPv4/IPv6 정규식 또는 `net` 모듈로 형식 검증; 실패 시 no-op 처리 |
| 3 | 보안 | 에러 응답에서 `e.message`(내부 예외 메시지)를 클라이언트에 직접 노출 | `third-party-oauth.controller.ts` L173 | 클라이언트 응답은 `e.response?.message` 만 사용; `e.message`는 서버 로그에만 기록 |
| 4 | 아키텍처 | SRP 위반 — `Cafe24InstallRateLimitService`가 Redis 연결 생명주기·비즈니스 로직·종료를 동시에 담당; 생성자 내 테스트 우회 분기 내포 | `cafe24-install-rate-limit.service.ts` constructor (L308-345) + `onModuleDestroy` | Redis 인스턴스를 모듈 레벨 팩토리 provider(`CAFE24_RATE_LIMIT_REDIS`)로 분리; 서비스는 주입만 받도록 변경 |
| 5 | 아키텍처 | DIP 미적용 — 컨트롤러가 구현 클래스에 직접 의존; 테스트에서 `as never` duck-typing으로 우회 | `third-party-oauth.controller.ts` L883-884 생성자 파라미터 | `IInstallRateLimitService` 인터페이스 추출 후 컨트롤러는 인터페이스 타입에 의존 |
| 6 | 아키텍처 | 에러 코드 분류 로직(enumeration 신호 판별)이 컨트롤러 catch 블록에 인라인 — 비즈니스 규칙이 프레젠테이션 레이어에 위치 | `third-party-oauth.controller.ts` catch 블록 내 `code === 'CAFE24_INSTALL_INVALID_TOKEN' \|\| code === 'CAFE24_INSTALL_INVALID_HMAC'` | `Cafe24InstallRateLimitService.isEnumerationSignal(code)` 스태틱 메서드 또는 상수 집합으로 분리 |
| 7 | 요구사항 | plan 상수명(`INSTALL_FAIL_THRESHOLD`/`INSTALL_FAIL_WINDOW_SEC`)과 코드 상수명(`FAIL_THRESHOLD`/`FAIL_WINDOW_SEC`) 불일치 | `plan/in-progress/cafe24-install-ratelimit.md` 상수 테이블 vs `cafe24-install-rate-limit.service.ts` | spec 갱신 시 코드 실제 식별자 기준으로 통일 |
| 8 | 유지보수성 | `cafe24Install` 메서드에 rate limit 체크·파라미터 검증·서비스 호출·에러 분류·HTML 렌더링 5개 책임 혼재 — 메서드 복잡도 높음 | `third-party-oauth.controller.ts` L104~ `cafe24Install` 메서드 | `isEnumerationError(code)` 순수 함수 추출; 장기적으로 `handleCafe24Install()` private 메서드 위임 |
| 9 | 성능 | 실패 응답 경로에서 `recordFailure` `await` — Redis 왕복만큼 응답 레이턴시 증가 (보안상 의도적, 운영 영향 낮음) | `third-party-oauth.controller.ts` L939, L953 | 현재 `await` 유지 권장(보안 정확성 우선); 저빈도 엔드포인트 특성상 운영 영향 없음 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | Fail-open 정책 — Redis 장애 시 lockout 체크 생략(의도적), 단 Redis 장애 악용 공격 탐지 불가 | `cafe24-install-rate-limit.service.ts` L82-92 | Redis 연결 실패 빈도를 메트릭으로 수집·알림 설정 |
| 2 | 보안 | Lua 스크립트 INCR+EXPIRE 원자성 — 올바르게 구현됨 | `cafe24-install-rate-limit.service.ts` L51-54 | 없음 |
| 3 | 동시성 | TOCTOU — `isLockedOut`→`recordFailure` 사이 원자성 부재(의도적 설계, Layer 1 위 보강 Layer) | 컨트롤러 `cafe24Install` 핸들러 | 필요 시 두 연산을 단일 Lua 스크립트로 통합 가능; 현재 설계 허용 범위 |
| 4 | 아키텍처 | `Cafe24InstallRateLimitService` exports 미포함 — 모듈 내부 전용 의도 명확 | `integrations.module.ts` exports | 현행 유지; 향후 타 모듈 접근 시 exports 추가 |
| 5 | 테스트 | `close()`/`onModuleDestroy()` 테스트 없음 — quit 호출, 에러 흡수, no-op 미검증 | `cafe24-install-rate-limit.service.spec.ts` | `describe('close / onModuleDestroy')` 블록 3케이스 추가 |
| 6 | 테스트 | `recordFailure` Lua 스크립트의 EXPIRE 조건부 실행(`c == 1`) 검증 없음 — Lua 수정 시 회귀 탐지 어려움 | `cafe24-install-rate-limit.service.spec.ts` L99-106 | `expect.stringContaining('if c == 1')` 또는 `expect.stringContaining('EXPIRE')` 추가 |
| 7 | 테스트 | `isLockedOut` NaN/비정수 Redis 반환값 경계값 케이스 미검증 | `cafe24-install-rate-limit.service.spec.ts` | `it('non-numeric GET value → false')` 케이스 추가 |
| 8 | 테스트 | `recordFailure` `await` 완료 순서 보장 미검증 — fire-and-forget 변경 탐지 불가 | `third-party-oauth.controller.spec.ts` | 비동기 mock으로 await 순서 보장 검증 케이스 추가 또는 주석으로 의도 명시 |
| 9 | 테스트 | `req.ip === undefined` 시 controller 레벨 동작 미검증 | `third-party-oauth.controller.spec.ts` rate limiting 블록 | `{ ip: undefined }` req fixture 케이스 추가 |
| 10 | 테스트 | `makeRedisMock` 반환 타입 `Record<string, Mock>` — 오타 타입 안전성 미흡 | `cafe24-install-rate-limit.service.spec.ts` L5-11 | `{ get: Mock; eval: Mock; quit: Mock }` 인라인 타입 사용 |
| 11 | 유지보수 | 반복되는 warn 로그 패턴 3곳 중복 | `cafe24-install-rate-limit.service.ts` L341, L363, L385 | `private warnDegradation(context, err)` 헬퍼 추출 |
| 12 | 유지보수 | `INCR_EXPIRE_LUA` 문자열 연결 방식 — 백틱 멀티라인으로 가독성 개선 가능 | `cafe24-install-rate-limit.service.ts` L465-468 | 백틱 템플릿 리터럴로 변경 |
| 13 | 성능 | `recordFailure` 반환값(현재 카운트) 미활용 — 향후 임계치 도달 즉시 감지 시 추가 Redis 호출 필요 | `cafe24-install-rate-limit.service.ts` L378-384 | 장기적으로 `Promise<number>` 시그니처 고려; 현재 스펙에서 문제 없음 |
| 14 | 문서화 | user guide MDX(`cafe24.mdx` + `cafe24.en.mdx`) 에 신규 429 에러코드 미반영 | `codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.mdx` | install flow 절에 429 lockout 조건 1-2 문장 추가 |
| 15 | 변경 범위 | review/consistency 산출물·plan 파일이 PR diff 포함 — 규약상 정상 | `review/consistency/2026/06/02/00_56_06/` 전체; `plan/in-progress/cafe24-install-ratelimit.md` | 현행 유지 |
| 16 | API 계약 | 429 응답 형식이 기존 `{ error: { code, message } }` envelope 규약 준수, Swagger 갱신 완료 | `third-party-oauth.controller.ts` L928-936 | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | CRITICAL — spec 미갱신(에러코드·상수·Layer 2 정책), plan step 4 완료 체크 불일치 |
| security | MEDIUM | req.ip 신뢰 전제 미검증, buildKey IP 새니타이징 부재, 에러 응답 내부 메시지 노출 |
| documentation | MEDIUM | spec §9.8 및 §10.3 에러 코드 목록 미갱신 (requirement 와 동일 근본 원인) |
| architecture | LOW | SRP/DIP 미적용, 생성자 분기 과도, 에러 분류 로직 인라인 |
| maintainability | LOW | cafe24Install 메서드 책임 혼재, warn 로그 중복, Lua 문자열 가독성 |
| performance | LOW | recordFailure await 레이턴시 (의도적), 반환값 미활용 |
| testing | LOW | close/onModuleDestroy 미테스트, Lua EXPIRE 조건 미검증, 경계값 케이스 누락 |
| concurrency | LOW | isLockedOut→recordFailure TOCTOU (의도적 설계) |
| side_effect | LOW | 생성자 시그니처 변경 (테스트에서 이미 처리됨), Redis 연결 추가 |
| api_contract | LOW | req.ip proxy 환경 주의 (인프라 설정 확인 사항) |
| user_guide_sync | LOW | cafe24.mdx 429 에러코드 설명 누락 |
| scope | NONE | 변경 범위 적절, 무관 파일 수정 없음 |

## 발견 없는 에이전트

없음 (전 에이전트 발견사항 있음)

## 권장 조치사항

1. **[CRITICAL — 즉시]** `project-planner` 에 spec 갱신 위임: `spec/4-nodes/4-integration/4-cafe24.md §9.8` 에 Layer 2 실패 페널티 단락·상수 표 추가, `spec/2-navigation/4-integration.md` 에러 코드 표에 `CAFE24_INSTALL_RATE_LIMITED (429)` 행 추가. plan step 4 체크 상태를 실제 갱신 완료 시점으로 정정.
2. **[WARNING — 단기]** Express `trust proxy` 설정 명시 및 IP 추출 로직 중앙화 — proxy 환경에서 rate limiting 우회·오발동 위험 차단.
3. **[WARNING — 단기]** `buildKey` IP 형식 검증 추가 — 비정상 IP 값 Redis 키 공간 오염 방지.
4. **[WARNING — 단기]** 에러 응답 클라이언트 노출 범위 축소 — `e.message` 대신 generic fallback 반환.
5. **[WARNING — 중기]** `IInstallRateLimitService` 인터페이스 추출 및 `isEnumerationSignal(code)` 순수 함수 분리 — DIP 적용·enumeration 분류 로직 단일 진실화.
6. **[WARNING — 중기]** Redis 인스턴스를 모듈 팩토리 provider로 분리 — SRP 개선, 생성자 분기 제거.
7. **[INFO — 단기]** 테스트 보강: `close`/`onModuleDestroy` 케이스, Lua `EXPIRE` 조건 검증, NaN 경계값 케이스 추가.
8. **[INFO — 단기]** `cafe24.mdx`/`cafe24.en.mdx` user guide 에 429 lockout 조건 1-2 문장 추가.
9. **[INFO — 선택]** warn 로그 헬퍼 추출, Lua 문자열 백틱 멀티라인 전환 등 유지보수성 소폭 개선.

## 라우터 결정

- **실행** (ran): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, user_guide_sync (12명)
- **제외** (skipped by router): dependency, database (2명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단에 의한 제외 (신규 외부 의존성 변경 없음으로 판단) |
  | database | 라우터 판단에 의한 제외 (DB 스키마/쿼리 변경 없음으로 판단) |

- **강제 포함 (router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)