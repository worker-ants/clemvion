# 데이터베이스(Database) 코드 리뷰

## 발견사항

### [WARNING] recordNodeLatencyMetrics — 대용량 실행의 N 개 node_execution 전량 조회
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `recordNodeLatencyMetrics()` 메서드 (추가된 블록, 약 line 9296~)
- **상세**: 실행 terminal 전이 시 `nodeExecutionRepository.find({ where: { executionId, status: In([...]) }, relations: ['node'] })` 로 해당 실행의 **모든 종료된 node_execution 행 + node 관계**를 일괄 로드한다. 워크플로 규모에 따라 수십~수백 행이 될 수 있고, `relations: ['node']` 가 node 테이블 JOIN을 유발한다. 메트릭 수집 실패는 무시(`catch {}`)로 처리하고 fire-and-forget(`void`)로 실행 경로를 막지 않는 설계 자체는 적절하나, **실행 종료마다 이 SELECT가 발생**하므로 빈번한 실행 환경에서는 DB 부하가 누적된다.
- **제안**: `durationMs` 와 `node.type` 만 필요하므로 `select: ['id', 'durationMs', 'status']` 옵션을 추가하고, `relations: ['node']` 대신 `node_executions.node_type` 칼럼을 직접 저장하거나, QueryBuilder로 필요한 칼럼만 SELECT 하는 방향을 검토한다. 단, 현재 node_execution 엔티티에 `nodeType` 비정규화 칼럼이 없다면 추가하는 것이 근본 해결책이다. 최소 개선으로는 `select` 옵션으로 불필요한 칼럼 전송을 줄이는 것으로도 부하를 낮출 수 있다.

### [INFO] recordNodeLatencyMetrics — node 관계 조회의 잠재적 인덱스 의존성
- **위치**: 동일 메서드
- **상세**: `where: { executionId, status: In([...]) }` 조건으로 조회한다. `node_executions` 테이블에 `(execution_id, status)` 복합 인덱스가 없다면 `execution_id` 단독 인덱스 후 status 필터링(인덱스 부분 스캔)이 된다. 메트릭 수집은 fire-and-forget 이라 즉각적인 영향은 없지만, 실행 종료 빈도가 높아질 경우 이 쿼리의 비중이 증가한다.
- **제안**: `node_executions` 테이블에 `(execution_id, status)` 또는 `(execution_id)` 인덱스가 존재하는지 마이그레이션 파일에서 확인한다. 대부분의 경우 `execution_id` 단독 인덱스가 이미 있을 것이며, 이 경우 현 조회는 허용 범위 내다. 인덱스 부재 시 추가를 권장한다.

### [INFO] LlmUsageLogService.record — 메트릭 계측 순서 (DB insert 실패 시 메트릭 기록 보장)
- **위치**: `codebase/backend/src/modules/llm/llm-usage-log.service.ts` — `record()` 메서드
- **상세**: `recordLlmTokens` 를 `try` 블록 진입 **전에** 호출하므로 DB insert 실패 여부와 무관하게 메트릭이 기록된다. 이는 의도된 설계("DB insert 성패와 무관하게 계측")이며 테스트에서도 검증(`insert 실패 시에도 메트릭은 기록된다`)된다. DB와 메트릭의 일관성(insert 실패 → 메트릭 과계상) 은 spec의 "이원화 정책"에 따라 허용된 트레이드오프다.
- **제안**: 현재 설계가 의도적이며 적절하다. 별도 조치 불필요.

### [INFO] 테스트 파일 — BusinessMetricsService 중복 등록
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `describe('SUMMARY W3 / W5 / W6 / W7 보완 단위 테스트')` 블록 내 TestingModule providers (line 15290~)
- **상세**: `BusinessMetricsService` 가 providers 배열에 **2회 중복** 등록되어 있다(`BusinessMetricsService, BusinessMetricsService`). NestJS는 동일 토큰을 나중 것으로 덮어쓰므로 런타임 오동작은 없지만, 의도치 않은 코드 잡음이며 유지보수 시 혼란을 줄 수 있다.
- **제안**: 중복 라인 1개를 제거한다.

## 요약

이번 변경은 NF-OB-07 도메인 비즈니스 메트릭 파이프라인(`BusinessMetricsService`)을 신규 도입하고, execution-engine·DLQ monitor·LLM usage log 에 계측 지점을 추가한다. DB 직접 접근 변경은 `recordNodeLatencyMetrics` 한 곳으로, 실행 종료 시 `node_executions` 테이블을 `relations: ['node']` JOIN과 함께 전량 조회하는 것이 주요 DB 관점 위험 요소다. fire-and-forget/catch 처리로 실행 경로에 영향은 없으나, 빈번한 실행 환경에서 이 SELECT 부하가 누적될 수 있고 `select` 제한 없이 전 칼럼을 로드하는 점은 개선 여지가 있다. 마이그레이션 변경·스키마 변경·커넥션 관리·트랜잭션·SQL 인젝션 관련 위험은 없다. 나머지 DB 변경(TypeORM pool 설정, Redis BullMQ 큐 깊이 조회)은 기존 패턴의 확장으로 안전하다.

## 위험도

LOW

---

STATUS=success ISSUES=3
