# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 발견 없음. WARNING 1건(테스트 커버리지 갭). 전반적으로 보안 수준을 향상시키는 변경이며 구조적 문제 없음.

## Critical 발견사항

_해당 없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 커버리지 | `mapHttpErrorLike` 비-413 4xx 분기(`'The request could not be processed.'`)가 테스트에서 직접 검증되지 않음. 현재 데드 코드에 가깝지만 향후 확장 시 의도치 않은 메시지 변경이 무방비 상태 | `codebase/backend/src/common/filters/http-exception.filter.ts` L178–182 / `http-exception.filter.spec.ts` | `{ status: 400 }` 등 비-413 4xx 오브젝트를 `catch()` 에 전달해 `body.error.message === 'The request could not be processed.'` 를 단언하는 테스트 케이스 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `mapHttpErrorLike` 413 고정 문구(`'Request payload too large.'`) 반환 — spec 미기술(CWE-209 개선, 코드 정확) | `http-exception.filter.ts` L179–183 / `spec/5-system/3-error-handling.md §1.3` | 코드 유지. spec `§1.3 PAYLOAD_TOO_LARGE` 항목에 "내부 message echo 하지 않고 고정 문구 반환(CWE-209)" 추가 |
| 2 | SPEC-DRIFT | `[SPEC-DRIFT]` 비-413 4xx http-error-like에 대한 일반 문구 정책 spec 미기술 | `http-exception.filter.ts` L182 / `spec/5-system/3-error-handling.md §1.3` | 코드 유지. spec에 비-413 4xx message 정책("상태 기반 일반 문구, 내부 message 미전달") 추가 |
| 3 | SPEC-DRIFT | `[SPEC-DRIFT]` trigger 조회 실패 fail-open 로그 레벨 `warn→error` 격상 — spec 미기술(보안 모니터링 개선, 코드 정확) | `public-webhook-throttle.guard.ts` L78 / `spec/5-system/3-error-handling.md §6.1` | 코드 유지. spec `§6.1` 또는 `spec/5-system/12-webhook.md` fail-open 절에 "trigger 조회 실패 → ERROR 레벨 로깅" 추가 |
| 4 | SPEC-DRIFT | `[SPEC-DRIFT]` whitespace-only 헤더 폴백 동작 spec 미기술 | `client-ip.spec.ts` L358–370 / `spec/5-system/1-auth.md §2.3` | 코드 유지. spec에 "헤더가 빈 문자열/공백만일 경우 미존재 취급해 다음 우선순위로 폴백" 추가(선택적) |
| 5 | 보안 | IP 미식별 시 rate-limit fail-open 정책 — XFF 헤더 제거/조작으로 우회 가능. 인프라 수준 방어에 위임된 설계 의도 | `public-webhook-throttle.guard.ts` L108 | 인프라 수준 XFF 없는 요청 차단 또는 `req.socket.remoteAddress` 폴백 확장 고려(중장기) |
| 6 | 보안 | DB 조회 실패 시 fail-open — `error` 레벨 로깅으로 모니터링 가시성 개선됨. DB 장애 장기화 시 보호 우회 지속 가능 | `public-webhook-throttle.guard.ts` L73–80 | 연속 조회 실패 시 서킷브레이커 패턴 도입 고려(spec 정책 결정 사안) |
| 7 | 부작용 | `extractClientIp` export 제거로 인한 외부 의존성 — 삭제된 JSDoc에 "Exported for shared use" 주석 존재. 외부 참조가 남아 있으면 컴파일 오류 | `public-webhook-throttle.guard.ts` (diff 삭제 블록) | 코드베이스 전체 grep으로 `extractClientIp` 참조 잔존 여부 확인(이미 완결됐을 가능성 높음) |
| 8 | 부작용 | `logger.warn→error` 상향으로 DB 일시 장애 시 alert storm 발생 가능 | `public-webhook-throttle.guard.ts` L955–956 | 모니터링 시스템에서 해당 로그 패턴에 rate-limit 또는 flapping 억제 정책 설정(운영 절차) |
| 9 | 부작용 | `mapHttpErrorLike` 반환 메시지 변경 — 기존에 원본 문자열(`'request entity too large'`)을 expect 하는 e2e/통합 테스트가 있다면 실패 | `http-exception.filter.ts` L178–181 | 해당 문자열에 의존하는 e2e/통합 테스트 유무 확인 |
| 10 | 유지보수성 | `mapHttpErrorLike`에서 `413` 매직 넘버 인라인 사용 | `http-exception.filter.ts` L306 | `HttpStatus.PAYLOAD_TOO_LARGE` 상수로 교체 또는 `STATUS_MESSAGES` 맵 패턴 도입 |
| 11 | 유지보수성 | 기본 에러 메시지 문자열 두 버전 공존(`'An unexpected error occurred'` vs `'...Please try again later.'`) | `http-exception.filter.ts` L225, L271 | 클래스 최상단 `private static readonly DEFAULT_ERROR_MESSAGE` 상수로 통합 |
| 12 | 유지보수성 | `getRequest<{...}>` 인라인 익명 타입과 테스트 `ReqShape` 구조 중복 | `public-webhook-throttle.guard.ts` / `guard.spec.ts` | named interface 추출 후 양쪽에서 공유 |
| 13 | 유지보수성 | env 복원 패턴 혼용(`afterEach` vs `try/finally`) | `public-webhook-throttle.guard.spec.ts` L801–847 | guard spec CF 테스트도 `beforeEach`/`afterEach` 패턴으로 통일 |
| 14 | 유지보수성 | 이관 주석 두 곳 중복 | `public-webhook-throttle.guard.spec.ts` L621, L898–899 | 섹션 구분자 부근(L898) 한 곳만 유지 |
| 15 | 테스트 | `mapHttpErrorLike` 비-413 경로 `logger.warn` 호출 검증 누락 — 로깅 경로 삭제 시 테스트 미탐지 | `http-exception.filter.spec.ts` | logger mock/spy 주입 후 `logger.warn` 원본 메시지와 함께 호출됐음을 단언하는 케이스 추가 |
| 16 | 테스트 | fail-open 케이스 `logger.error` 호출 검증 누락 — 모니터링 알람 보장이 테스트로 고정되지 않음 | `public-webhook-throttle.guard.spec.ts` / `guard.ts` L953–957 | Logger mock 주입 후 fail-open 케이스에서 `logger.error` 1회 이상 호출 단언 추가 |
| 17 | 문서화 | `mapHttpErrorLike` JSDoc이 반환 `message`가 sanitized 문구임을 명시하지 않음 | `http-exception.filter.ts` JSDoc L287–292 | JSDoc에 "반환 `message`는 CWE-209 방지를 위해 상태 기반 일반 문구만 사용" 한 줄 추가 |
| 18 | 문서화 | 삭제된 `extractClientIp` export 이관 근거가 최종 파일에서 추적 불가 | `public-webhook-throttle.guard.ts` | 클래스 JSDoc 또는 import 블록 근처에 위임 이유 한 줄 주석 추가(선택적) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 전 항목 INFO — CWE-209 수정, IP 추출 통합, fail-open 로그 상향 모두 보안 개선 방향 |
| requirement | NONE | 4건 SPEC-DRIFT(INFO) — 코드 정확, spec 갱신 누락 |
| scope | NONE | 변경 범위 W1/W2/W4 의도와 완전 대응, 불필요한 변경 없음 |
| side_effect | LOW | `extractClientIp` export 제거 외부 의존성, 메시지 변경 클라이언트 계약 영향, alert storm 가능성 |
| maintainability | LOW | 매직 넘버, 메시지 상수 중복, 인라인 타입 중복, env 복원 패턴 혼용 등 소수 개선점 |
| testing | LOW | WARNING 1건 — 비-413 4xx 메시지 분기 테스트 미존재. logger 호출 검증 누락 2건(INFO) |
| documentation | NONE | JSDoc 미동기화 2건(INFO) — 차단 사유 없음 |

## 발견 없는 에이전트

없음 (모든 에이전트가 최소 1건 이상 발견사항 기록)

## 권장 조치사항

1. **[WARNING 해소]** `http-exception.filter.spec.ts`에 비-413 4xx `HttpErrorLike` 케이스 테스트 추가 (`{ status: 400 }` 등 → `'The request could not be processed.'` 단언)
2. **[SPEC-DRIFT 처리 — project-planner 위임]** `spec/5-system/3-error-handling.md §1.3`에 413 고정 문구 + 비-413 4xx 일반 문구 정책 + trigger 조회 실패 ERROR 로깅 내용 반영; `spec/5-system/1-auth.md §2.3`에 whitespace 헤더 폴백 동작 추가(선택적)
3. **[INFO 운영]** `extractClientIp` 잔존 참조 grep 확인 후 컴파일 검증
4. **[INFO 유지보수]** `mapHttpErrorLike`의 `413` → `HttpStatus.PAYLOAD_TOO_LARGE`, 기본 에러 메시지 상수 통합
5. **[INFO 테스트]** `logger.warn`(filter) 및 `logger.error`(guard fail-open) 호출 검증 단언 추가
6. **[INFO 문서]** `mapHttpErrorLike` JSDoc에 CWE-209 sanitized 문구 반환 명시 한 줄 추가

## 라우터 결정

라우터가 reviewer 를 선별 실행함 (`routing_status=done`).

- **실행(강제 포함)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명 — 전원 router_safety 강제 포함)
- **제외**: `performance`, `architecture`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (7명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |