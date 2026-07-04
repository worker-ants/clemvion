# 보안(Security) 코드 리뷰 — exec-limits 리팩터 (ARCH#4·ARCH#6·MAINT#9)

## 리뷰 방법 안내

`_prompts/security.md` payload 는 실제 diff(6개 코드 파일: `execution-limits.ts`,
`execution-limits.spec.ts`, `execution-run.processor.ts`, `execution-run.queue.ts`,
`execution-run.queue.spec.ts`, `system-status.constants.ts`) 뒤에 이번 세션과 무관한
plan/consistency-review 산출물(`plan/in-progress/*.md`, `review/consistency/**`)이
추가로 번들링되어 있었다. 코드 diff 부분은 `git diff origin/main...HEAD` 결과와
바이트 단위로 일치함을 확인했고, 후반부 non-code 파일(plan/review 문서)은 보안
분석 대상이 아니므로 코드 6개 파일만을 기준으로 검토했다.

## 변경 내용 요약

동작 보존(behavior-preserving) 리팩터:
- **ARCH#4**: `resolveExecutionRunWorkerConcurrency` + `DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY`를
  `queues/execution-run.queue.ts` → `execution-limits.ts` 로 단순 이동(함수 본문·정규식·분기 로직 무변경).
- **ARCH#6**: `execution-limits.ts` 모듈 최상단 JSDoc 확장(주석만).
- **MAINT#9**: `system-status.constants.ts` 의 `continuationConcurrency` 계산을
  inline `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1` (loose) 에서
  기존 canonical `resolveContinuationWorkerConcurrency()` (정규식 `^\d+$` 선검증 strict parser,
  기존 코드에 이미 존재)로 교체.

세 항목 모두 신규 엔드포인트·신규 사용자 입력 경로·신규 DB 접근·신규 외부 통신을 도입하지 않는다.
파싱 대상 값(`EXECUTION_RUN_WORKER_CONCURRENCY`, `CONTINUATION_WORKER_CONCURRENCY`)은 서버
운영자가 설정하는 프로세스 환경변수이며, 공격자가 제어 가능한 요청 경로에서 유입되지 않는다.

## 발견사항

없음 (no findings).

검토 포인트별 확인 내용:

1. **인젝션 취약점** — 해당 없음. 변경은 `Number(string)` / 정규식 `^\d+$` 파싱 로직뿐이며 SQL·쉘·경로·LDAP 등 어떤 조합에도 관여하지 않는다. 입력은 신뢰된 env var.
2. **하드코딩된 시크릿** — 없음. 하드코딩된 값은 상수 `1`(기본 concurrency)뿐, 자격증명·키 없음.
3. **인증/인가** — 영향 없음. worker concurrency 설정은 인증/인가 로직과 무관.
4. **입력 검증** — MAINT#9 는 오히려 검증을 **강화**하는 방향(loose `Number(x) || 1` → strict `^\d+$` 정규식 선검증 + `Number.isInteger && > 0`). 회귀 없음. ARCH#4 이관 함수 자체 로직은 무변경.
5. **OWASP Top 10** — 해당 사항 없음(신규 데이터 흐름/신뢰 경계 변경 없음).
6. **암호화** — 관련 없음.
7. **에러 처리** — 함수는 예외를 던지지 않고 항상 안전한 기본값으로 fallback — 정보 노출 경로 없음.
8. **의존성 보안** — 신규 의존성 추가 없음. import 재배선만 발생(`execution-run.queue.ts` → `execution-limits.ts`), 순환 의존도 없음(`execution-limits.ts` 는 zero-import 순수 모듈).

부가로 확인한 사항(참고, 비발견): `system-status.constants.ts` 는 System Status 화면(admin 전용은 아니고 spec §3.2 기준 전 역할 조회 가능)에 표시되는 `MonitoredQueue.concurrency` 계산식만 변경한다 — 표시 값이 실제 worker concurrency 설정과 더 정확히 일치하게 되는 정합화이며, 응답 스키마·권한 체크에는 영향 없음.

## 요약

이번 변경은 순수 함수 재배치, 주석(JSDoc) 확장, 그리고 이미 코드베이스에 존재하는 동일 계약의 strict 파서로의 치환(loose→strict, 더 엄격한 검증 방향)으로 구성된 동작 보존 리팩터다. 신규 신뢰 경계나 사용자 입력 처리 경로가 생기지 않으며, 파싱 대상은 공격자가 아닌 서버 운영자가 제어하는 환경변수다. 보안 관점에서 우려할 변경 사항이 없다.

## 위험도

NONE

STATUS: SUCCESS
