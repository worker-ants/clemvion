파일 쓰기 권한이 필요합니다. 권한을 허용해 주시면 `review/2026-04-13_10-56-10/SUMMARY.md`에 저장하겠습니다.

그 전에 통합 보고서 내용을 먼저 보여드리겠습니다:

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — `WorkflowsModule`에 `Node` 엔티티 미등록으로 인한 런타임 오류 위험 + `loadTriggerParameterSchema` 3중 중복으로 인한 아키텍처/보안/유지보수 복합 위험

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 런타임 오류 | `WorkflowsController`가 `@InjectRepository(Node)` 신규 주입하나 `WorkflowsModule`에 `TypeOrmModule.forFeature([Node])` 등록 없음. 런타임 "No repository for Node" 오류 발생 | `workflows.controller.ts:38`, `workflows.module.ts` | `workflows.module.ts`에 `Node` 엔티티 등록 추가. 또는 `loadTriggerParameterSchema` 로직을 공통 서비스로 이동 |

---

## 경고 (WARNING) — 주요 항목

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처/DRY | `loadTriggerParameterSchema` 로직이 `hooks.service.ts`, `schedule-runner.service.ts`, `workflows.controller.ts` 세 곳에 완전 중복. 보안 수정·캐싱 적용 시 누락 위험 | 3개 파일 | `TriggerParameterService`로 추출하여 단일 소스화 |
| 2 | 아키텍처 | `WorkflowsController`가 Repository 직접 주입 — Controller 레이어가 DB에 직접 접근 | `workflows.controller.ts:38` | `loadTriggerParameterSchema`를 서비스 레이어로 이동 |
| 3 | 아키텍처 | `SchedulesService`(비즈니스)가 `ScheduleRunnerService`(인프라)를 역방향 의존 | `schedules.service.ts:198` | `resolveScheduleParameters`를 공통 서비스로 추출 |
| 4 | 의존성 | `ScheduleRunnerService`가 `ExpressionResolverService` 무시하고 `evaluate()` 직접 import — 표현식 평가 경로 2중 분기 | `schedule-runner.service.ts:10` | `ExpressionResolverService`에 제한 컨텍스트 메서드 추가 후 주입 사용 |
| 5 | 보안 | 스케줄 파라미터 표현식 `evaluate()` sandbox 격리 수준 불명확. `Function()`/`eval` 계열이면 sandbox escape → RCE 위험 | `resolveLimitedExpression()` | sandbox 격리 수준 명시·문서화, 허용 변수 화이트리스트 강제 |
| 6 | 보안/DoS | `parameterValues` DTO에 크기·깊이 제한 없음(`@IsObject()`만). 대량 키/깊은 중첩 JSON 제출 시 DoS 가능 | `create-schedule.dto.ts`, `update-schedule.dto.ts` | 최대 키 개수·중첩 깊이 제한 validator 추가 |
| 7 | 기능/스펙 | `object`/`array` coerce 실패가 감지되지 않음. JSON 파싱 실패 시 원본 값 그대로 반환 → 스펙 §5.2 "coerce 실패 시 400" 위반 | `resolve-trigger-parameters.ts:95-105` | `coerceToType`에서 실패 시 null/sentinel 반환, 실패 감지 로직 추가 |
| 8 | 테스트 | `WorkflowsController` 새 파라미터 해석 로직 전체 무테스트 (3-레벨 fallback, 400 변환 등) | `workflows.controller.ts:102-160` | `WorkflowsController` 단위 테스트 작성 |
| 9 | 테스트 | `SchedulesService.runNow()` 변경사항 미테스트 | `schedules.service.ts:198-210` | `schedules.service.spec.ts`에 테스트 추가 |
| 10 | 테스트 | `schedule-runner.service.spec.ts`에서 TriggerParameterValidationException 폴백 경로 및 표현식 평가 실패 경로 미테스트 | `schedule-runner.service.ts:74-97` | 두 경로 테스트 추가 |
| 11 | 테스트 | `hooks.service.spec.ts`에서 `coerce_failed` 케이스 미테스트 | `hooks.service.spec.ts` | `coerce_failed` 포함 400 응답 테스트 추가 |
| 12 | 동시성 | `lastTriggeredAt` 갱신이 read-modify-write 비원자적 패턴 | `hooks.service.ts` | TypeORM `update()` 또는 단일 SQL UPDATE로 변경 |
| 13 | 동시성 | BullMQ 동시 잡 처리 시 동일 스케줄 중복 실행 위험 | `schedule-runner.service.ts:process()` | job ID를 `scheduleId`로 고정 또는 DB 낙관적 잠금 적용 |
| 14 | API 계약 | `/execute` 바디 구조 변경(soft breaking change) 및 400 에러 `code` 필드가 스펙·엔드포인트 간 불일치 | `workflows.controller.ts`, `hooks.service.ts` | CHANGELOG 기재, 공통 error-response factory 도입 |
| 15 | DB | `node(workflow_id, category)` 복합 인덱스 누락 — 모든 실행 경로에서 반복 조회 시 seq-scan 위험 | migrations | `V012` 마이그레이션으로 인덱스 추가 |
| 16 | 스펙 | `spec/5-system/4-execution-engine.md` 6.1.1의 함수 시그니처가 실제 구현과 불일치 | spec 문서 | 시그니처 및 책임 기술 수정 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| scope | **HIGH** | `WorkflowsModule` Node 엔티티 미등록 → 런타임 오류 |
| security | **MEDIUM** | sandbox 미검증(잠재적 HIGH), parameterValues 크기 제한 없음 |
| api_contract | **MEDIUM** | /execute 바디 soft breaking change, 400 응답 형식 불일치 |
| side_effect | **MEDIUM** | $input.someKey 접근 패턴 마이그레이션 필요 |
| dependency | **MEDIUM** | loadTriggerParameterSchema 3중 중복, expression engine 직접 import |
| architecture | **MEDIUM** | 3중 중복, Controller Repository 주입, 역방향 의존 |
| maintainability | **MEDIUM** | 3중 중복, Repository 주입, isPlainObject 중복 타입 가드 |
| performance | **MEDIUM** | 매 요청 DB 조회(캐싱 없음) |
| database | **MEDIUM** | 복합 인덱스 누락, 3중 중복 |
| concurrency | **MEDIUM** | lastTriggeredAt 비원자적 갱신, BullMQ 중복 실행 위험 |
| testing | **MEDIUM** | WorkflowsController 무테스트, runNow() 미테스트 |
| requirement | **MEDIUM** | object/array coerce 실패 스펙 불일치 |
| documentation | **LOW** | 스펙 시그니처 불일치, 주석 보강 필요 |

---

## 권장 조치사항 (우선순위순)

1. **[즉시]** `WorkflowsModule`에 `Node` 엔티티 등록 — 런타임 오류 차단
2. **[높음]** `TriggerParameterService` 추출 — 3중 중복, Controller Repository 주입, 역방향 의존, ExpressionResolverService 미활용 동시 해소
3. **[높음]** `object`/`array` coerce 실패 감지 — 스펙 §5.2 요구사항 충족
4. **[높음]** 표현식 엔진 sandbox 격리 수준 확인·문서화
5. **[높음]** `WorkflowsController` 단위 테스트 작성
6. **[중간]** `(workflow_id, category)` 복합 인덱스 마이그레이션 추가
7. **[중간]** BullMQ job ID 고정 및 `lastTriggeredAt` 원자적 갱신
8. **[중간]** 400 에러 응답 형식 통일
9. **[중간]** `schedules.service.spec.ts` runNow() 테스트 추가
10. **[중간]** `parameterValues` DTO 크기 제한
11. **[낮음]** 스펙 문서 함수 시그니처 수정
12. **[낮음]** 코드 품질 정리 (중복 import, `void _omit`, `isPlainObject` 헬퍼, `fail()` 교체)