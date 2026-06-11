# Code Review 통합 보고서

**대상**: HTTP Request 노드 SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**검토일**: 2026-06-11
**세션**: `review/code/2026/06/11/23_00_44/`

---

## 전체 위험도

**MEDIUM** — 의도된 breaking change(none/custom 인증 사설망 호출 차단)로 인한 기존 워크플로 서비스 중단 위험이 존재하며, 에러 메시지 내 hostname 정보 노출(내부 토폴로지 정찰 가능) 및 한국어 사용자 대상 `HTTP_BLOCKED` 에러 미번역 이슈가 WARNING으로 잔존. CRITICAL 없음.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `ALLOW_PRIVATE_HOST_TARGETS` 가 `process.env` 에서 매 호출마다 읽혀 런타임 조작 가능 — 코드 주입 경로 확보 시 전체 SSRF 보호 무효화 가능 | `http-safety.ts` line 81 | 애플리케이션 시작 시 한 번만 읽어 상수화하거나, production 환경 warn 처리 확인 |
| 2 | Security | SSRF 에러 메시지에 차단된 hostname/IP 노출 — 내부 네트워크 토폴로지 정찰 가능(OWASP A02) | `http-safety.ts` line 107, 147 | 클라이언트 응답에는 일반화된 메시지 반환(`"SSRF_BLOCKED: target host is not allowed"`), 상세 정보는 서버 로그에만 기록 |
| 3 | Side Effect / API Contract | Breaking change — `authentication=none`/`custom` 으로 사설망·loopback 호출하던 기존 워크플로가 즉시 `HTTP_BLOCKED`로 차단됨. `ALLOW_PRIVATE_HOST_TARGETS=true` 설정 없는 self-host 환경에서 서비스 중단 | `http-request.handler.ts` SSRF 가드 ungate 블록 | PR 본문·릴리스 노트에 breaking change 명시 + `ALLOW_PRIVATE_HOST_TARGETS=true` 마이그레이션 안내. 에러 메시지에 opt-out 방법 포함 권장 |
| 4 | API Contract | `HTTP_BLOCKED` enum이 SDK/public 타입에 re-export되는 경우 클라이언트 exhaustive switch 처리에서 누락 케이스 발생 가능 | `error-codes.ts` 신규 `HTTP_BLOCKED` 추가 | `ErrorCode`가 SDK public 타입으로 노출되는지 확인하고, 노출 시 SDK 버전 bump 또는 타입 정의 배포 |
| 5 | Documentation | `http-request.handler.ts` configEcho 블록에 "adding a new schema field is automatically echoed without a maintenance step here" 구절이 잔존 — 명시 열거로 변경된 실제 동작과 정반대 진술 | `http-request.handler.ts` configEcho 블록 주석 | 해당 구절 제거 후 "스키마 필드 추가 시 이 열거 목록도 수동 동기화 필요" 주석으로 교체 |
| 6 | Documentation | production 코드 주석에 내부 검토 태그 `(W-4)` 잔존 — 외부 독자에게 불투명 | `http-request.handler.ts` SSRF 가드 블록 주석 | `(W-4)` 참조 제거 또는 `DNS rebinding attack` 등 구체적 위협 명칭으로 대체 |
| 7 | User Guide Sync | `HTTP_BLOCKED` 신규 ErrorCode에 대한 `backend-labels.ts` `ERROR_KO` 한국어 매핑 누락 — 한국어 사용자에게 영문 메시지 그대로 노출 | `codebase/frontend/src/lib/i18n/backend-labels.ts` `ERROR_KO` 테이블 | 동일 PR에 `HTTP_BLOCKED: 'SSRF 보안 정책에 의해 해당 주소로의 요청이 차단되었어요. 내부망이나 클라우드 메타데이터 서버 주소는 접근할 수 없어요.'` 추가하거나, 후속 plan 등록 + PR 본문 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | DNS rebinding race window — `assertSafeOutboundHostResolved` 후 실제 fetch 사이의 TTL 만료 재바인딩 공격 가능. 코드 주석에 이미 명시됨 | `http-safety.ts` line 119–120 | 운영 환경 egress 방화벽 병행 필수. 코드 외 조치 |
| 2 | Security | `ENOTFOUND` DNS 실패 시 fail-open 처리 — 의도적 설계, 코드 주석에 이미 명시됨 | `http-safety.ts` line 141 | 추가 조치 불필요 |
| 3 | Security | `HTTP_BLOCKED` inline string literal 사용 — `ErrorCode.HTTP_BLOCKED` enum 참조로 교체 미완 | `http-request.handler.ts` `new IntegrationError('HTTP_BLOCKED', ...)` | `ErrorCode.HTTP_BLOCKED` 로 교체하여 컴파일 타임 타입 안전성 확보 |
| 4 | Security | 테스트 fixture 값 `SUPER_SECRET_KEY`/`LEAKED_TOKEN` — 시크릿 스캐너 오탐 가능성 | `http-request.handler.spec.ts` line 74–75 | `DUMMY_KEY_FOR_TESTING` 등 명시적 더미값 사용 권장 (기능 문제 없음) |
| 5 | Security | `ALLOW_PRIVATE_HOST_TARGETS` opt-out 테스트의 `process.env` 직접 조작 — 병렬 테스트 환경 race condition 가능성 | `http-request.handler.spec.ts` line 141–167 | 파일 단위 Jest 격리 시 안전. 확산 시 `jest.isolateModules` 또는 mock 방식 전환 검토 |
| 6 | Architecture | `configEcho` 명시 열거와 `http-request.schema.ts` 스키마 정의 간 구조적 동기화 메커니즘 부재 | `http-request.handler.ts` configEcho 블록 | 스키마 `keyof` 순회 단위 테스트 추가 또는 `buildConfigEcho(rawConfig)` 헬퍼 추출 고려 |
| 7 | Architecture | Usage 로그 조건(`integration` 인증 한정)이 핸들러 catch 블록에 2~3곳 반복 | `http-request.handler.ts` catch 블록들 | 현재 규모에서 수용 가능. 반복 확산 시 `logUsageIfIntegration()` 헬퍼 추출 검토 |
| 8 | SPEC-DRIFT | [SPEC-DRIFT] spec §4 step 8이 dry-run 시 SSRF 가드 생략 예외를 명문화하지 않음 — 코드 동작은 합리적이고 의도적이며 코드 수정이 오답 | `spec/4-nodes/4-integration/1-http-request.md` §4 step 8 | spec §4 step 8에 "(dry-run 실행 시 실제 fetch 없으므로 SSRF 가드 생략 — `spec/5-system/13-replay-rerun.md §7` 참조)" 한 줄 추가 |
| 9 | Requirement | `HTTP_TIMEOUT` enum이 `error-codes.ts`에 잔존하나 handler에서 미사용 — 기존 `3-error-handling.md §1.4` 불일치 계승 | `error-codes.ts` line 13 | 본 변경 신규 발생 아님. 별도 에러 코드 정리 작업 시 처리 |
| 10 | Side Effect | `none`/`custom` SSRF 차단 이벤트가 Usage 로그 미생성 — 보안 감사 관점의 운영 가시성 공백 | `http-request.handler.ts` catch 블록 Usage 로그 조건 | 보안 감사 요건 있으면 별도 security log 채널 추가 검토 |
| 11 | Side Effect | configEcho 명시 열거 전환 — 미래 스키마 필드 추가 시 silent omission 위험 | `http-request.handler.ts` configEcho 블록 | 스키마 변경 시 configEcho 갱신 의무 주석 명시 + 동기화 테스트 추가 |
| 12 | Maintainability | 인라인 주석 한국어/영어 혼용 패턴 강화 | `http-request.handler.ts` SSRF 가드 블록 주석 | 파일 전반 주석 언어 정책 통일 또는 혼용 컨벤션 문서화 |
| 13 | Maintainability | `'SSRF_BLOCKED'` 매직 스트링이 핸들러·테스트에 하드코딩 반복 | `http-request.handler.ts` line 418, `http-request.handler.spec.ts` lines 94, 117 | `const SSRF_BLOCKED_PREFIX = 'SSRF_BLOCKED'` 상수 추출하여 명시적 결합으로 전환 |
| 14 | Maintainability | redirect hop 한도 매직 넘버 `5` | `http-request.handler.ts` line 417–418 | `const MAX_REDIRECT_HOPS = 5` 상수 추출 |
| 15 | Maintainability | `err instanceof Error ? err.message : String(err)` 패턴 3회 반복 | `http-request.handler.ts` lines 359, 368 등 | `errorMessage(err: unknown): string` 헬퍼 추출 또는 기존 유틸 활용 |
| 16 | Testing | `none` + RFC1918, `custom` + IMDS 교차 조합 테스트 미검증 | `http-request.handler.spec.ts` lines 961–999 | `test.each`로 인증방식×차단대역 조합 확장 |
| 17 | Testing | `custom` 인증 `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 테스트 누락 | `http-request.handler.spec.ts` lines 1001–1029 | `custom` 인증 opt-out 케이스 추가 또는 파라미터화 |
| 18 | Testing | `none`/`custom` 인증으로 localhost 차단 테스트 누락 (기존 localhost 테스트는 `integration` 전용) | `http-request.handler.spec.ts` localhost 차단 테스트 | `blocks localhost by name` 테스트를 `test.each([none, custom, integration])` 으로 확장 |
| 19 | Testing | SSRF 차단(error 경로) configEcho의 Principle 7 D1 명시적 검증 누락 | `http-request.handler.spec.ts` SSRF 차단 테스트 | SSRF 차단 테스트에 `expect(result.output?.config).not.toHaveProperty('apiKey')` 단언 추가 |
| 20 | Testing | dry-run + `none`/`custom` 인증의 SSRF 가드 skip 동작 테스트 누락 | `http-request.handler.spec.ts` dry-run 테스트 | `none` + 차단 주소 + dry-run → `result.port === 'success'` 검증 추가 |
| 21 | Documentation | `spec/conventions/node-output.md` D4 callout 링크에 anchor(`#`) 누락 | `spec/conventions/node-output.md` D4 callout | 링크에 `#58-d4-...` anchor 추가 |
| 22 | Documentation | `spec/4-nodes/4-integration/1-http-request.md` §8.2 구현 근거 cross-ref 누락 | `spec/4-nodes/4-integration/1-http-request.md` §8.2 | 해당 주석 제거 커밋 참조 brief note 추가 |
| 23 | Documentation | `ALLOW_PRIVATE_HOST_TARGETS` 적용 범위 확장이 외부 운영 가이드/배포 템플릿에 미반영 가능성 | 운영 문서 (diff 외 범위) | PR 체크리스트에 외부 운영 문서 갱신 항목 추가 |
| 24 | Performance | `none`/`custom` 경로에 DNS 리졸브 I/O 1회 추가되나 fetch 자체도 동일 DNS 수행하므로 실질 레이턴시 부담 무시 가능 | `http-request.handler.ts` SSRF 가드 | 추가 최적화 불필요 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | WARNING 2건(ALLOW_PRIVATE_HOST_TARGETS 런타임 조작, SSRF 에러 hostname 노출). 핵심 변경은 보안 개선 |
| side_effect | MEDIUM | breaking change — none/custom 인증 사설망 호출 차단, 마이그레이션 경로 단순하나 기존 워크플로 즉시 실패 |
| api_contract | MEDIUM | breaking change + SDK 타입 전파 미확인. 에러 메시지 opt-out 안내 부재 |
| user_guide_sync | WARNING | HTTP_BLOCKED ERROR_KO 한국어 매핑 누락 — 영문 메시지 노출 |
| documentation | LOW | configEcho 주석 모순 진술 잔존, 내부 검토 태그 production 코드 잔존 |
| requirement | LOW | SPEC-DRIFT 1건(dry-run 예외 spec 미명문화). 기능 요구사항 충족 완전 |
| architecture | LOW | configEcho 스키마 동기화 메커니즘 부재(INFO). SOLID 위반 없음 |
| maintainability | LOW | 모순 주석 잔존, 매직 스트링/숫자 미상수화(INFO) |
| testing | LOW | 교차 인증×대역 조합 테스트 갭, dry-run none/custom 미검증(INFO) |
| scope | NONE | 모든 부수 변경이 plan 사전 선언 또는 consistency-check CRITICAL 해소 의무 범위 내 |
| performance | NONE | 성능 관점 실질적 위험 없음 |

---

## 발견 없는 에이전트

- **performance**: 성능 관점 실질적 위험 없음
- **scope**: 임의 범위 이탈 없음

---

## 권장 조치사항

1. **[WARNING #3 우선]** PR 본문·릴리스 노트에 breaking change 블록 추가 — `authentication=none`/`custom` + 사설망 호출 기존 워크플로가 `HTTP_BLOCKED`로 차단됨 명시, `ALLOW_PRIVATE_HOST_TARGETS=true` 마이그레이션 경로 안내. 에러 메시지에도 opt-out 방법 포함.
2. **[WARNING #7]** `codebase/frontend/src/lib/i18n/backend-labels.ts` `ERROR_KO`에 `HTTP_BLOCKED` 한국어 메시지 등록 (동일 PR 또는 즉시 후속 plan).
3. **[WARNING #2]** SSRF 에러 메시지에서 hostname/IP 제거 — 클라이언트에는 일반화된 메시지, 서버 로그에만 상세 기록.
4. **[WARNING #5, #6]** `http-request.handler.ts` configEcho 블록의 모순 주석 제거 및 내부 검토 태그 `(W-4)` 제거.
5. **[WARNING #1]** `ALLOW_PRIVATE_HOST_TARGETS` production 환경 warn 처리 구현 여부 확인; 미구현이면 시작 시 상수화 또는 경고 로그 추가.
6. **[WARNING #4]** `ErrorCode` SDK public 타입 노출 여부 확인 및 필요 시 타입 배포.
7. **[INFO #8 / SPEC-DRIFT]** spec `§4 step 8`에 dry-run SSRF 가드 생략 예외 한 줄 추가 (`spec/4-nodes/4-integration/1-http-request.md`).
8. **[INFO #3]** `http-request.handler.ts` 내 `'HTTP_BLOCKED'` inline string을 `ErrorCode.HTTP_BLOCKED`로 교체.
9. **[INFO #16~#20]** 테스트 커버리지 보완 — 교차 인증×차단대역 `test.each`, custom opt-out, none/custom localhost 차단, SSRF error 경로 Principle 7 D1, dry-run none/custom 검증.
10. **[INFO #13, #14]** `SSRF_BLOCKED_PREFIX`, `MAX_REDIRECT_HOPS` 상수 추출.

---

## 라우터 결정

routing_status=done (router가 선별):

**실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync` (11명)

**강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)

**제외**: 3명

| 제외된 reviewer | 이유 |
|-----------------|------|
| dependency | 라우터 제외 |
| database | 라우터 제외 |
| concurrency | 라우터 제외 |