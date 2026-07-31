# 의존성(Dependency) 리뷰 — retry_last_turn 재진입 원자 claim (조건부 UPDATE 교체)

## 발견사항

- **[INFO]** 새 외부 패키지 의존성 없음 — 기존 TypeORM `QueryBuilder` API 재사용
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:323-332`
  - 상세: 이번 변경(`applyRetryLastTurn` 의 원자 claim 추가)은 이미 생성자에 주입된 `nodeExecutionRepository`(`@InjectRepository(NodeExecution)`, 파일 상단 69-70줄)의 `createQueryBuilder()` 만 사용한다. `package.json`/`pnpm-lock.yaml` 은 이 커밋(`b351731f0`)에서 전혀 변경되지 않았고(직접 `git show --stat`/`git diff` 로 확인), import 블록(1-33줄)에도 신규 import 가 없다. 분산 락 라이브러리(예: redlock, 별도 mutex 패키지)를 새로 끌어오지 않고 기존 DB 레벨 조건부 UPDATE(compare-and-swap) 관용구로 동시성을 해결한 점은 의존성 최소화 관점에서 바람직하다.
  - 제안: 조치 불필요. (참고용 긍정 기록)

- **[INFO]** 신규 raw SQL(`jsonb_exists`) 사용은 같은 파일의 기존 관행과 일관 — 새로운 벤더 결합 아님
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:331` (신규), 대조: 동일 파일 `207`, `247` 줄 (기존 `retryLastTurn` 트랜잭션 블록의 `jsonb_exists(output_data, '_retryState')`)
  - 상세: 신규 claim 쿼리가 쓰는 `jsonb_exists(input_data, '_retryState')` 는 PostgreSQL 전용 내장 함수이며 별도 라이브러리가 필요 없다. 이미 같은 파일의 `retryLastTurn`(원본 row 소비, 207/247줄)이 동일 함수를 동일한 이유(`?` 연산자가 TypeORM/pg 드라이버의 바인드 파라미터 placeholder 와 충돌하는 문제 회피)로 쓰고 있어, 이번 추가는 새로운 DB-벤더 결합을 만드는 것이 아니라 기존 관행을 반복 적용한 것이다.
  - 제안: 조치 불필요.

- **[INFO]** 내부 모듈 간 "서술적 의존성"(comment-level invariant coupling) 오류가 이번 커밋으로 해소됨
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts:83-92` ↔ `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:310-322`
  - 상세: 8번 관점(내부 의존성) 에 해당하는 구조적 관찰. `continuation-execution.processor.ts` 는 `retry_last_turn` 타입을 공용 원자 claim(`claimResumeEntry`, 93줄의 `type !== 'cancel' && type !== 'retry_last_turn'` 분기) 대상에서 제외하는데, 이 제외 결정의 정당성은 "`applyRetryLastTurn` 내부에 자체 원자 가드가 있다"는 전제에 의존한다. 커밋 이전에는 그 전제가 실제로는 read-then-branch(`findOneBy` → `status !== RUNNING`) 였을 뿐 원자적이지 않았음에도 주석이 "자체 멱등 가드"로 잘못 서술해 순환 참조적 정당화(자기모순)가 발생했었다(직전 ai-review 5차 라운드 CRITICAL 의 원인, 두 파일 주석에 공통 기록됨). 이번 커밋은 `retry-turn.service.ts` 에 실제 조건부 UPDATE 원자 claim(323-332줄)을 추가해 그 전제를 사실로 만들고, 두 파일의 주석을 모두 정정해 파일 간 불변식 의존 관계를 정합시켰다. 코드 레벨의 새 의존성 추가는 없지만, 두 파일이 공유하던 암묵적 계약이 실제로 강제되도록 고쳐진 것은 의존성 검토 관점에서 긍정적 개선이다.
  - 제안: 조치 불필요. (참고용 긍정 기록 — 향후 `claimResumeEntry` 대상 타입 목록을 바꿀 때는 이 상호 참조 주석 두 곳을 동반 갱신해야 함을 유지보수자가 인지할 것)

- **[INFO]** 신규 생성자 주입 없음 — 기존 의존성 그래프 변경 없음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 생성자 (66-85줄)
  - 상세: `RetryTurnService` 생성자의 의존성 목록(executionRepository/nodeExecutionRepository/nodeRepository/dataSource/contextService/eventEmitter/graphTraversal/aiTurnOrchestrator(forwardRef)/driver(ENGINE_DRIVER))은 이번 커밋 전후 동일하다. `continuation-execution.processor.ts` 의 생성자(`engine`(forwardRef) + `retryTurnService`, 60-67줄)도 변경되지 않았다. 즉 이번 변경은 순수하게 메서드 본문 로직(원자 claim 추가) + 주석 정정이며, 서비스 간 DI 그래프·순환 의존 구조에는 어떤 영향도 주지 않는다.
  - 제안: 조치 불필요.

## 요약

이번 변경은 `applyRetryLastTurn` 재진입 가드를 비원자 read-then-branch 에서 조건부 UPDATE(`status='running' AND jsonb_exists(input_data, '_retryState')`) 기반 원자 claim 으로 교체하고, 관련 주석을 정정하는 순수 로직 수정이다. 검토 대상 3개 파일(`retry-turn.service.ts`, `retry-turn.service.spec.ts`, `continuation-execution.processor.ts`) 어디에도 신규 import 나 `package.json`/`pnpm-lock.yaml` 변경이 없으며(직접 `git show`/`git diff` 로 확인), 새 외부 패키지·버전 변경·라이선스·취약점·번들 크기 이슈는 전혀 발생하지 않는다. 신규 로직은 이미 주입돼 있던 `nodeExecutionRepository` 의 TypeORM `QueryBuilder` 와, 같은 파일에서 이미 쓰이던 PostgreSQL `jsonb_exists` 관행을 그대로 재사용해 새로운 라이브러리·벤더 결합을 추가하지 않았다. 유일하게 의미 있는 "의존성" 관점 관찰은 8번(내부 의존성) 항목 — `continuation-execution.processor.ts` 의 claim 제외 결정이 `retry-turn.service.ts` 의 가드 성질에 대한 암묵적 전제에 기대고 있었는데, 이번 커밋이 그 전제를 실제 원자 보장으로 채우고 양쪽 주석을 정합시켜 이전의 자기모순적 서술 의존성을 해소했다는 점이며, 이는 개선으로 평가한다.

## 위험도

NONE
