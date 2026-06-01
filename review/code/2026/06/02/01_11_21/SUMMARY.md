# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 구현이 완결되고 문서화·테스트가 충분하나, concurrency > 1 상향 시 `cancel` 핸들러의 `void` fire-and-forget race window 해소 전 운영 상향 금지가 필요하다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 | `cancel` 케이스에서 `applyCancellation` 을 `void` fire-and-forget 으로 호출. `CONTINUATION_WORKER_CONCURRENCY` 를 2 이상으로 상향하면 cancel 완료 전에 동일 executionId 의 resume job 이 다른 slot 에서 처리되는 race window 가 발생한다. 현재 기본값 1(직렬)에서는 실영향 없음. | `continuation-execution.processor.ts` L422–424 (TODO 주석 존재) | concurrency 상향 전 반드시 `void` 제거 후 `await this.engine.applyCancellation(executionId)` 로 전환. TODO 를 plan/issue 에 연결해 추적 가능하게 할 것. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 / DRY | `resolveContinuationWorkerConcurrency` 내 파싱 로직(`/^\d+$/ + Number.isInteger + > 0`)이 `continuation-dlq-monitor.config.ts` 의 `parsePositiveInt` 와 완전히 동일한 구조. 현재 2곳이지만 한쪽이 변경될 때 다른 쪽 누락 위험. | `continuation-execution.queue.ts` L531–538 vs `continuation-dlq-monitor.config.ts` L48–52 | 공통 유틸(`parse-positive-int.util.ts`) 추출 또는 설정 파일 분리 시 통합 검토. 즉각 위험은 낮음. |
| 2 | 아키텍처 / SRP | env 파싱 책임이 큐 정의 파일에 인라인으로 위치. DLQ monitor 의 전용 config 파일 패턴과 비일관성. `@Processor` 정적 평가 제약상 DI 주입이 불가해 현재 구조는 불가피하나, 설정 항목 증가 시 큐 파일 비대화 우려. | `continuation-execution.queue.ts` (파서 함수 위치) | 향후 설정 항목 증가 시 별도 `continuation-worker.config.ts` 파일로 분리 검토. |
| 3 | 동시성 | concurrency > 1 시 동일 `nodeExecutionId` 에 대한 두 job 이 동시에 `isNodeExecutionWaiting = true` 를 보고 진행할 수 있는 check-then-act 간격 존재. BullMQ jobId 멱등성·DB conditional-update 가 방어하고 있을 것으로 예상되나 코드 레벨 명시 여부 확인 필요. | `continuation-execution.processor.ts` L399–408 | `applyContinuation` 내 `NodeExecution.status` 업데이트 시 `WHERE status = 'waiting_for_input'` 조건부 UPDATE 적용 여부를 코드 주석에 명시. |
| 4 | 유지보수성 | `resolveContinuationWorkerConcurrency` 에서 정규식 선검증 후 `Number.isInteger(parsed) && parsed > 0` 재검증이 중복. 정규식 통과 시 이미 양의 정수가 보장되므로 이후 재검증은 항상 true. | `continuation-execution.queue.ts` L531–538 | "정규식이 이미 양수 정수를 보장함" 주석 한 줄 추가 또는 재검증 제거로 단순화. |
| 5 | 유지보수성 | processor 의 `@Processor` 호출부에 DI 불가 제약 배경(DI 이전 평가 시점) 주석 부재. queue.ts JSDoc 에는 상세히 설명돼 있으나 처음 보는 개발자가 processor 만 읽으면 판단 근거를 모른다. | `continuation-execution.processor.ts` L371–373 | 호출부 위에 "// DI 주입 불가 — continuation-execution.queue.ts JSDoc 참조" 한 줄 주석 추가. |
| 6 | 유지보수성 | `ContinuationJob.payload` 가 `unknown` 으로 선언되어 processor switch 내 인라인 타입 단언이 잔존. 파일 상단 JSDoc 의 "인라인 단언 제거" 의도와 실제 구현 간 괴리. 이번 변경 범위 외. | `continuation-execution.processor.ts` L424–450 | `ContinuationJob.payload` 를 구체 유니언 타입으로 좁히는 후속 작업을 plan 에 추가 검토. |
| 7 | 유지보수성 | `cancel` TODO 가 plan/issue 에 연결되지 않아 소멸 위험. | `continuation-execution.processor.ts` L419–421 | `// TODO(#<issue>)` 형태로 추적 참조 추가. |
| 8 | 요구사항 / spec | spec §7.4 "메시지 타입" 행에 `retry_last_turn` 미등재. processor switch 가 처리하는 타입이지만 spec 테이블에 누락. pre-existing 불일치. | `spec/5-system/4-execution-engine.md` L780 | `project-planner` 위임 — §7.4 "메시지 타입" 행에 `retry_last_turn` 추가. |
| 9 | 요구사항 / spec | spec §11 내 `### 10.3 호출 순서` 서브섹션 번호 오기. §11 문맥에 §10.x 번호가 섞임. pre-existing. | `spec/5-system/4-execution-engine.md` L1065 | `project-planner` 위임 — 서브섹션 번호 정합성 수정. |
| 10 | 문서화 | `.env.example` 주석("Non-positive, non-integer, or non-numeric") 과 queue.ts JSDoc 서술 케이스 목록이 소폭 달라 유지 시 양쪽 동기화가 필요함을 알기 어렵다. | `.env.example` L40 / `continuation-execution.queue.ts` JSDoc | 단일 정책 표현("정규식 `\d+` 검증 후 양의 정수만 허용, 그 외 fallback 1")으로 통일하거나 상호 참조 추가. |
| 11 | 문서화 | spec §7.4 "Worker 동시성" 행에 fallback 정책 미기재. §11 표에만 있어 §7.4 단독 독자가 정책을 놓칠 수 있음. | `spec/5-system/4-execution-engine.md` L781 | §7.4 행에 "(fallback 정책은 §11)" 괄호 병기. |
| 12 | 테스트 | `onFailed` 테스트에서 `job.opts?.attempts` 미설정(undefined) 시 `CONTINUATION_QUEUE_DEFAULT_OPTS.attempts` fallback 경로가 검증되지 않음. 사소한 경계값 갭. | `continuation-execution.processor.spec.ts` L232–278 | `failJob` 헬퍼에서 `opts.attempts` 생략 케이스를 추가해 fallback 값(3) 검증. |
| 13 | 운영 | concurrency 값은 모듈 로드 시 1회 고정되므로 런타임 env 변경이 반영되지 않음. 재시작 필요 사실이 운영 문서에 명시적이지 않을 수 있음. | `.env.example` / 운영 문서 | `.env.example` 주석에 "변경 시 인스턴스 재시작 필요" 한 줄 추가 검토. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 취약점 없음. 입력 파싱 정규식 선검증 양호. |
| performance | NONE | O(1) 모듈 로드 시 1회 평가. 런타임 추가 비용 없음. |
| architecture | LOW | 큐 파일 내 env 파싱 책임 혼재(SRP), parsePositiveInt 로직 중복(DRY). 제약상 불가피하나 향후 부채. |
| requirement | LOW | 기능 완전성 충족. pre-existing spec 불일치(`retry_last_turn` 미등재, §10.3 번호 오기) 별도 수정 필요. |
| scope | NONE | 6개 파일 모두 작업 의도 범위 내. 불필요한 변경 없음. |
| side_effect | NONE | 기존 export 시그니처 유지. 기본값 1로 배포 동작 변화 없음. |
| maintainability | LOW | 중복 검증, processor 호출부 주석 부재, payload 타입 단언 잔존, TODO 추적 부재. |
| testing | LOW | 핵심 함수 커버리지 우수. `onFailed` opts.attempts fallback 경로 미검증이 유일한 갭. |
| documentation | NONE | 전 계층 문서 균일하게 갱신. spec·JSDoc·env.example·plan 일관성 양호. |
| concurrency | LOW | 기본값 1에서는 안전. concurrency > 1 상향 시 `cancel` void fire-and-forget race window 가 WARNING 수준 위험. |

## 발견 없는 에이전트

- **security**: 보안 취약점 발견 없음
- **performance**: 성능 문제 발견 없음
- **scope**: 범위 이탈 없음
- **side_effect**: 의도치 않은 부작용 없음
- **documentation**: 문서화 결함 없음

## 권장 조치사항

1. **(필수, concurrency 상향 전)** `continuation-execution.processor.ts` L422의 `void this.engine.applyCancellation(executionId)` 를 `await this.engine.applyCancellation(executionId)` 로 전환. TODO 를 plan 항목 또는 issue 번호와 연결. concurrency > 1 운영 상향 전 이 조치가 반드시 선행되어야 한다.
2. **(권장)** `applyContinuation` 내 `NodeExecution.status` conditional UPDATE(`WHERE status = 'waiting_for_input'`) 적용 여부를 코드 주석으로 명시해 concurrency > 1 안전성 근거를 문서화.
3. **(권장)** `parsePositiveInt` 파싱 로직 2곳 중복 해소 — 공통 유틸 추출 또는 설정 파일 분리 시 통합. 항목이 늘어나기 전 처리 권장.
4. **(소규모)** spec §7.4 "메시지 타입" 행에 `retry_last_turn` 추가(`project-planner` 위임).
5. **(소규모)** spec §11 내 `### 10.3` 서브섹션 번호 수정(`project-planner` 위임).
6. **(소규모)** `continuation-execution.processor.ts` `@Processor` 호출부에 DI 불가 배경 주석 한 줄 추가.
7. **(소규모)** `.env.example` 에 "변경 시 인스턴스 재시작 필요" 주석 추가.
8. **(선택)** `onFailed` 테스트에 `opts.attempts` 미설정 fallback 케이스 추가.
9. **(선택)** `ContinuationJob.payload` 를 구체 유니언 타입으로 좁혀 인라인 단언 제거하는 후속 plan 항목 추가.

## 라우터 결정

라우터가 reviewer 를 선별했습니다 (`routing_status=done`).

- **실행** (10명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`
- **강제 포함 (router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (4명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| dependency | 라우터 판단에 의해 제외 |
| database | 라우터 판단에 의해 제외 |
| api_contract | 라우터 판단에 의해 제외 |
| user_guide_sync | 라우터 판단에 의해 제외 |