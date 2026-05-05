파일 저장 권한이 없어 직접 출력합니다.

---

# Code Review 통합 보고서

> 변경 내용: `execute()` 시그니처 옵션 객체화 + scheduler/webhook 실행의 `triggerId` 보존  
> 참여 에이전트: 13개 (api_contract, architecture, concurrency, database, dependency, documentation, maintainability, performance, requirement, scope, security, side_effect, testing)

---

## 전체 위험도

**LOW** — 핵심 구현은 올바르고 일관성 있게 완료됐으나, 기존 코드의 보안 취약점 2건과 인터페이스 동기화 미확인, 테스트 공백이 조치를 요한다.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | Bearer 토큰 비교에 타이밍 안전 비교 미사용 — 응답 시간 차이로 토큰 문자 추측 가능 | `hooks.service.ts` — `verifyAuth()` bearer 분기 | `crypto.timingSafeEqual`로 교체; 비교 전 길이 동일성 체크 추가 |
| 2 | Security | `crypto.timingSafeEqual` 버퍼 길이 불일치 시 unhandled TypeError — 요청 단위 DoS 가능 | `hooks.service.ts` — HMAC 서명 검증 분기 | 비교 전 `Buffer.byteLength(signature) !== Buffer.byteLength(expected)` 조기 반환 추가 |
| 3 | Architecture / Maintainability | `ExecuteOptions` 타입이 인라인 리터럴로만 존재, `executedBy`와 `triggerId` 상호 배타성이 타입 시스템에서 미강제 | `execution-engine.service.ts` — `execute()` 3번째 파라미터 | named `ExecuteOptions` 판별 유니온으로 추출 후 재사용 (`executedBy?: never \| triggerId?: never` 패턴) |
| 4 | Architecture / Requirement / Side Effect | `WorkflowExecutor` 인터페이스의 `execute()` 시그니처 갱신 여부 미확인 | `execution-engine.service.ts` — `implements WorkflowExecutor` | 인터페이스 파일 직접 확인; 미갱신 시 즉시 수정 |
| 5 | Requirement / Documentation | `spec/2-navigation/3-schedule.md` 갱신 누락 — cron 실행 시 `triggerId` 채움 흐름 미반영 | plan 문서 `[ ] spec/2-navigation/3-schedule.md` 항목 | 해당 파일에 `process()` → `{ triggerId }` 전달 흐름 추가; 해당 없으면 plan 항목 명시적 제거 |
| 6 | Side Effect / Requirement | `execute()` 시그니처 변경 — diff 외 호출자(E2E 테스트, CLI 등)의 silent regression 가능성 | 전체 백엔드 코드베이스 | `grep -r "executionEngineService\.execute" backend/src` 전수 확인 후 `npm run build` 검증 |
| 7 | Documentation / Scope | plan 문서 체크박스 미갱신 — 구현 완료 항목이 모두 `[ ]` 상태 (CLAUDE.md PLAN 라이프사이클 규약 위반) | `plan/in-progress/execution-trigger-metadata-fix.md` | 완료 항목 `[x]` 처리; 잔여 항목 확인 후 전부 완료 시 `git mv`로 `complete/` 이동 |
| 8 | Testing | `ScheduleRunnerService.process()` 성공 경로 — `lastRunAt`/`nextRunAt` DB 갱신 검증 누락 | `schedule-runner.service.spec.ts` — 성공 케이스 | `expect(scheduleRepo.save).toHaveBeenCalledWith(expect.objectContaining({ lastRunAt: expect.any(Date) }))` 추가 |
| 9 | Testing | `process()` 에러 경로 테스트 부재 — `execute()` throw 시 re-throw 여부 미검증 | `schedule-runner.service.spec.ts` | `engine.execute.mockRejectedValue(...)` → `expect(service.process(job)).rejects.toThrow(...)` 케이스 추가 |
| 10 | Testing | `schedule.triggerId`가 falsy일 때 `execute({ triggerId: null })` 호출 동작 미검증 | `schedule-runner.service.spec.ts` | `triggerId: null` 케이스 추가 또는 서비스에서 falsy 시 빈 객체 가드 추가 |
| 11 | Database | `Execution.trigger_id` 컬럼 인덱스 존재 여부 미확인 — 데이터 누적 시 풀 스캔 가능성 | `Execution` 엔티티 `trigger_id` 컬럼 | 엔티티·마이그레이션에서 인덱스 유무 확인; 없으면 `CREATE INDEX CONCURRENTLY` 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance / Maintainability | `options?.executedBy ?? undefined` — `??` 우측이 항상 `undefined`이므로 no-op, 코드 의도를 흐림 | `execution-engine.service.ts:384-385` | `executedBy: options?.executedBy` 로 단순화 |
| 2 | Security | OTEL 트레이스 엔드포인트 기본값이 평문 HTTP | `instrumentation.ts` — `OTLPTraceExporter` URL | 배포 체크리스트에 HTTPS 필수 설정 명시 |
| 3 | Security | `executedBy`/`triggerId` UUID 형식 검증 부재 (현재 호출 경로는 신뢰 가능) | `execution-engine.service.ts` — `create()` 호출부 | TypeORM `@IsUUID()` 데코레이터 추가 고려 |
| 4 | Database | `executedBy`/`triggerId` 상호 배타성이 DB 레벨에서 미강제 | `Execution` 테이블 스키마 | `CHECK (executed_by IS NULL OR trigger_id IS NULL)` 제약 검토 |
| 5 | Database | Execution 생성과 `lastTriggeredAt` 갱신이 단일 트랜잭션 외부 — 실패 시 불일치 가능 | `hooks.service.ts:96-103` (기존 코드) | `queryRunner` 트랜잭션으로 묶거나 현 구조 의도적 수용 명시 |
| 6 | Documentation | `execute()` JSDoc에 `@param options` 태그 누락 | `execution-engine.service.ts:361-376` | `@param options.executedBy` / `@param options.triggerId` 설명 추가 |
| 7 | Testing | 스킵 경로에서 `scheduleRepo.save` 미호출 검증 없음 | `schedule-runner.service.spec.ts` — inactive/no-workflow 케이스 | `expect(scheduleRepo.save).not.toHaveBeenCalled()` 추가 |
| 8 | Testing | `executedBy`와 `triggerId` 동시 전달 케이스 미테스트 | `execution-engine.service.spec.ts` | 동시 전달 시 동작 명시하는 케이스 추가 |
| 9 | Maintainability | `schedule.triggerId`와 `schedule.id` 혼동 여지 (전자는 Trigger FK) | `schedule-runner.service.ts:163-166` | 필요 시 `schedule.trigger?.id ?? schedule.triggerId` 로 명시 |
| 10 | Scope | `instrumentation.ts`에 기능과 무관한 prettier 포맷팅 변경 혼입 | `instrumentation.ts` | 기능상 무해; 향후 스타일 커밋과 기능 커밋 분리 권장 |
| 11 | Dependency | `bullmq`에서 `Job` 타입만 import — 기존 패키지 타입 전용 참조, 런타임 무영향 | `schedule-runner.service.spec.ts:4` | 없음 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | LOW (기존 코드 내 MEDIUM 2건) | Bearer 토큰 타이밍 공격 취약점, HMAC 검증 unhandled TypeError |
| Requirement | MEDIUM | `WorkflowExecutor` 인터페이스 미확인, `spec/3-schedule.md` 누락, 호출자 전수 확인 필요 |
| Testing | LOW | `process()` 성공/에러 경로 검증 공백, `triggerId` falsy 케이스 미테스트 |
| Maintainability | LOW | `ExecuteOptions` 인라인 타입, `?? undefined` 중복, `WorkflowExecutor` 동기화 미확인 |
| Architecture | LOW | `ExecuteOptions` 판별 유니온 미사용, `WorkflowExecutor` 동기화 미확인 |
| Database | LOW | `trigger_id` 인덱스 미확인, 비트랜잭션 다중 쓰기 |
| Side Effect | LOW | 미발견 호출자 silent regression 가능성 |
| Documentation | LOW | plan 문서 체크박스 미갱신, JSDoc `@param` 누락 |
| Scope | LOW | plan 문서 미갱신, `instrumentation.ts` 포맷팅 혼입 |
| Concurrency | LOW | 기존 `schedule-runner` 분산 중복 실행 (신규 도입 아님) |
| API Contract | LOW | `WorkflowExecutor` 인터페이스 동기화 확인 필요 (HTTP API 무변경) |
| Performance | NONE | `?? undefined` 마이크로 노이즈 외 성능 영향 없음 |
| Dependency | NONE | 신규 외부 패키지 도입 없음, 타입 전용 참조만 추가 |

---

## 발견 없는 에이전트

- **Dependency** — 신규 외부 패키지 도입 없음, 내부 의존 방향 무변경 (위험도 NONE)
- **Performance** — 추가 쿼리 없음, 알고리즘 복잡도 변화 없음 (위험도 NONE)

---

## 권장 조치사항

1. **[즉시] `hooks.service.ts` 보안 취약점 2건 수정** — Bearer 토큰을 `crypto.timingSafeEqual`로 비교하고, HMAC 검증 전 버퍼 길이 동일성 체크 추가 (외부 공격자가 직접 호출하는 엔드포인트)
2. **[즉시] `WorkflowExecutor` 인터페이스 동기화 확인** — `execute()` 3번째 파라미터가 options 객체로 일치하는지 파일 직접 확인; 미갱신 시 즉시 수정
3. **[즉시] 호출자 전수 확인 + 빌드 검증** — `grep -r "\.execute(" backend/src` 로 diff 외 호출자 없는지 확인 후 `npm run build` 통과
4. **[단기] `ExecuteOptions` 타입 named 선언 및 판별 유니온 적용** — 인라인 리터럴을 exported type으로 추출, `executedBy`/`triggerId` 상호 배타성 컴파일 타임 강제
5. **[단기] `?? undefined` 제거** — `options?.executedBy ?? undefined` → `options?.executedBy` 단순화
6. **[단기] `spec/2-navigation/3-schedule.md` 확인 및 갱신** — cron 실행 시 `triggerId` 저장 흐름 명시 또는 plan 항목 제거
7. **[단기] plan 문서 체크박스 갱신** — 완료 항목 `[x]` 처리, 잔여 항목 확인 후 `complete/` 이동 여부 결정
8. **[단기] 테스트 보완 3건** — `process()` 성공 후 `lastRunAt` 갱신 검증, 에러 re-throw 케이스, `triggerId` falsy 케이스
9. **[중기] `Execution.trigger_id` 인덱스 확인** — 없으면 `CREATE INDEX CONCURRENTLY`로 무중단 추가
10. **[중기] DB CHECK 제약 검토** — `CHECK (executed_by IS NULL OR trigger_id IS NULL)` 추가로 상호 배타성 강제