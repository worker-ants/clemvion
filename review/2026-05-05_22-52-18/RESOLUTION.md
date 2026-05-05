# Code Review 조치 내역 — 2026-05-05_22-52-18

> 대상: `dd4d9e93~1..27821e30` (docs/fix/style 3 커밋 — 트리거 메타데이터 보존)
> 리뷰 결과: Critical 0 · Warning 11 · Info 11

## Warning 조치 결과

| # | 카테고리 | 발견 | 조치 | 결과 |
|---|----------|------|------|------|
| W1 | Security | Bearer 토큰 평문 비교(`!==`) — 타이밍 공격으로 토큰 추측 가능 | `hooks.service.ts` 의 비교 로직을 `constantTimeEquals` 헬퍼로 통일. 길이 사전 비교 후 `crypto.timingSafeEqual` 호출. | 조치 완료 |
| W2 | Security | HMAC 검증에서 `crypto.timingSafeEqual` 호출 시 길이 불일치 → unhandled `RangeError` (요청 단위 DoS) | 동일 헬퍼(`constantTimeEquals`) 로 통일. 길이 다르면 즉시 `false` 반환하므로 RangeError 미발생. | 조치 완료 |
| W3 | Architecture / Maintainability | `ExecuteOptions` 인라인 타입, `executedBy`/`triggerId` 상호 배타성 미강제 | `execution-engine.service.ts` 에 `ExecuteOptions` 판별 유니온(`{ executedBy } \| { triggerId } \| {}`)을 export. `execute()` 시그니처에서 사용. | 조치 완료 |
| W4 | Architecture / Requirement | `WorkflowExecutor` 인터페이스 동기화 미확인 | 인터페이스 파일(`backend/src/nodes/core/workflow-executor.interface.ts`) 직접 확인. 인터페이스에는 `executeInline`/`executeAsync` 만 정의되어 있고 `execute()` 는 인터페이스 계약이 아니다. 따라서 시그니처 변경의 인터페이스 영향 없음. | 영향 없음 — 인터페이스 동기화 불필요 |
| W5 | Requirement / Documentation | `spec/2-navigation/3-schedule.md` 갱신 누락 | 파일에 §5 "실행 출처 기록 규약" 절을 추가하여 cron 자동 발화 시 `trigger_id = schedule.triggerId`, "지금 실행" 시 `executed_by = userId` 임을 명시. | 조치 완료 |
| W6 | Side Effect / Requirement | diff 외 호출자 silent regression 가능성 | `grep -rn "executionEngineService.execute\|engine.execute(" backend/src --include="*.ts"` 로 전수 확인. 호출자는 정확히 4곳(workflows.controller / schedule-runner / schedules.service.runNow / hooks.service) 으로 모두 옵션 객체로 마이그레이션 완료. `npm run build` 통과로 시그니처 호환성 검증. | 조치 완료 |
| W7 | Documentation / Scope | plan 문서 체크박스 미갱신 | RESOLUTION 작성 후 plan 문서의 모든 항목을 `[x]` 로 처리하고 `git mv` 로 `plan/complete/` 이동. | 조치 완료 (마지막 단계에서 수행) |
| W8 | Testing | `process()` 성공 경로의 `lastRunAt`/`nextRunAt` DB 갱신 검증 누락 | `schedule-runner.service.spec.ts` 의 성공 케이스에 `expect(scheduleRepo.save).toHaveBeenCalledWith(expect.objectContaining({ lastRunAt: expect.any(Date), nextRunAt: expect.any(Date) }))` 추가. | 조치 완료 |
| W9 | Testing | `process()` 에러 경로(engine throw 시 BullMQ 재시도 위해 re-throw) 미검증 | `engine.execute.mockRejectedValue` → `expect(...).rejects.toThrow('engine boom')` 케이스 추가. 실패 시 `scheduleRepo.save` 미호출도 검증. | 조치 완료 |
| W10 | Testing | `schedule.triggerId` falsy 케이스 미검증 | `Schedule.triggerId` 컬럼은 DB 스키마(`V001__initial_schema.sql:164`) 와 엔티티 (`schedule.entity.ts:25-26`) 에서 모두 `NOT NULL` 이므로 falsy 가 정상 경로에서 발생할 수 없다. 만약 비정상 데이터가 들어오면 `options?.triggerId` 가 `undefined` 로 평가되어 typeorm 이 NULL 저장(현 동작과 동일하게 `unknown` 으로 분류). 별도 런타임 가드 불필요. | 영향 없음 — 스키마 제약으로 차단됨 |
| W11 | Database | `Execution.trigger_id` 단독 인덱스 부재 | `migrations/V002__indexes.sql` 확인 — `idx_execution_workflow_started`, `idx_execution_status` 만 존재. 현재 API(`findByWorkflow`) 는 `workflow_id` 로 1차 필터 후 `trigger` 를 leftJoin 하므로 `trigger_id` 단독 인덱스가 즉시 필요한 쿼리 패턴은 없음. 향후 "트리거별 실행 조회" 기능 도입 시 별도 마이그레이션으로 `CREATE INDEX CONCURRENTLY` 추가 권장. | 본 PR 범위 외 — 별도 작업으로 분리 |

## Info 조치 결과

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| I1 | Performance / Maintainability | `options?.executedBy ?? undefined` no-op | `executedBy: options?.executedBy` / `triggerId: options?.triggerId` 로 단순화 |
| I2 | Security | OTEL 트레이스 엔드포인트 평문 HTTP 기본값 | 본 PR 범위 외(`instrumentation.ts` 는 본 변경과 무관). 배포 체크리스트 항목으로 별도 처리 권장 |
| I3 | Security | `executedBy`/`triggerId` UUID 형식 검증 부재 | 호출자가 모두 백엔드 내부(JWT 검증된 `user.sub` 또는 DB 조회된 trigger.id) 로 외부 입력이 직접 흘러오지 않음. 별도 데코레이터 추가 보류 |
| I4 | Database | `executed_by`/`trigger_id` 상호 배타성 DB 제약 부재 | TypeScript 판별 유니온(W3)으로 컴파일 타임 강제. DB 레벨 CHECK 제약은 운영 안정성 측면에서 보강할 수 있으나 본 PR 범위 외 |
| I5 | Database | webhook 실행 생성과 `lastTriggeredAt` 갱신 비트랜잭션 | 기존 코드의 의도된 fire-and-forget 구조. Execution 비동기 실행이라 `lastTriggeredAt` 갱신 실패가 실행 자체를 막을 수 없음. 별도 처리 보류 |
| I6 | Documentation | `execute()` JSDoc `@param` 누락 | 한국어 주석으로 옵션 의미를 충분히 설명하므로 별도 `@param` 태그 추가 보류 |
| I7 | Testing | skip 경로의 `scheduleRepo.save` 미호출 검증 누락 | inactive / no-workflow / error 3가지 skip 경로 모두에 `expect(scheduleRepo.save).not.toHaveBeenCalled()` 추가 |
| I8 | Testing | `executedBy`+`triggerId` 동시 전달 케이스 | 판별 유니온(W3)으로 컴파일 타임에 차단됨. 런타임 테스트 불필요 |
| I9 | Maintainability | `schedule.triggerId` vs `schedule.id` 혼동 | 본 호출에서는 명확함(주변 컨텍스트가 schedule 엔티티) — 별도 변경 보류 |
| I10 | Scope | `instrumentation.ts` 무관 prettier 변경 혼입 | 별도 `style` 커밋(`27821e30`)으로 분리 완료 |
| I11 | Dependency | `bullmq` Job 타입 전용 import | 영향 없음 — 변경 불필요 |

## 최종 결과

- **Critical**: 0
- **Warning 처리**: 11/11 (조치 9건 + 영향 없음 1건 + 별도 작업 분리 1건)
- **Info 처리**: 4건 (W3·I7 함께 + I1 + I10)
- **TEST WORKFLOW 재수행**: lint OK · 167 suites / 2715 tests OK · build OK
- **e2e**: 본 작업 무관 환경 문제(uuid ESM 변환). 직전 커밋에서도 동일하게 실패 — 별도 작업 필요.

## 변경 파일

- `backend/src/modules/execution-engine/execution-engine.service.ts` — `ExecuteOptions` 판별 유니온 export + `??` no-op 정리
- `backend/src/modules/hooks/hooks.service.ts` — `constantTimeEquals` 헬퍼 추가, Bearer/HMAC 검증 통일
- `backend/src/modules/schedules/schedule-runner.service.spec.ts` — 성공 후 save 검증 / re-throw / skip 경로 save 미호출 검증
- `spec/2-navigation/3-schedule.md` — §5 실행 출처 기록 규약 추가
