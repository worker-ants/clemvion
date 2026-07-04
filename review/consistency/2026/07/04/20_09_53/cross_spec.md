# Cross-Spec 일관성 검토 — §8 동시성-cap admission gate 회귀 테스트 보강

## 검토 대상
- 검토 모드: `--impl-prep`, scope=`spec/5-system/`
- 계획된 작업 (TEST-ONLY, 프로덕션 코드·spec 변경 없음):
  1. `runExecutionFromQueue` 가 admission 실패(deferred 재큐 / queue-wait-timeout cancelled)일 때 `runExecution` 이 호출되지 않음을 확인하는 unit
  2. 동일 상황에서 `releaseExecutionRouting`(라우팅 리소스 해제)이 호출됨을 확인하는 unit
  3. admission raw SQL 의 파라미터 바인딩 순서를 검증하는 assert
  4. workspace-level cap 을 검증하는 e2e 시나리오
- 근거 문서: `plan/in-progress/exec-intake-followups.md` §"PR2b 후속" 의 "admission 회귀 보강 (ai-review testing INFO)" 항목과 문자 그대로 일치 — 신규 요구사항이 아니라 이미 식별된 백로그 항목의 착수.
- 대상 스펙 본문: `spec/5-system/4-execution-engine.md` §8(동시 실행 제한, PR2b 구현 완료로 명시), 연관 §2.13(`Execution.queued_at`, V104), §7.1(stalled 재배달), §7.5(재개), §9.3(BullMQ 큐), `spec/1-data-model.md` §2.2/§2.4(`maxConcurrentExecutions`), `spec/5-system/3-error-handling.md` §1.4~1.5(`EXECUTION_QUEUE_WAIT_TIMEOUT`).

## 발견사항

검토 관점 1~6(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 전체에 대해 target 작업이 도입하는 신규 요소가 없음을 확인했다. 계획은 순수 테스트 추가이며:

- 신규 엔티티·필드 없음 (`queued_at` 등 기존 §2.13 필드만 참조)
- 신규 endpoint·API 계약 없음 (`runExecutionFromQueue`/`releaseExecutionRouting`/`runExecution` 은 이미 §8·§4.2 에 정의된 내부 함수)
- 신규 요구사항 ID 없음
- 신규 상태 전이 없음 (`pending → running` admission 성공, `pending → cancelled`(`EXECUTION_QUEUE_WAIT_TIMEOUT`) 큐-대기 초과는 §8·spec-draft-concurrency-cap-pr2b.md 에 이미 정의된 기존 전이를 그대로 검증)
- RBAC 변경 없음
- 계층 책임 변경 없음 (intake consumer / admission gate 책임 분할은 §8 "admission gate = consumer-side" Rationale 과 정합, 테스트가 이 경계를 재확인할 뿐)

target 이 검증하려는 3가지 동작 각각이 기존 spec 본문과 대조해 모순이 없는지 개별 확인:

- **admission 실패 시 `runExecution` 미호출**: §8 "제한 초과 시 동작" — "cap 초과 → 새 Execution 은 `pending` 상태로 intake 큐 대기 … 아니면 pending 유지 + delayed 재큐" 라고 명시. `runExecution`(active 세그먼트 실행 본체, §2.1/§9.3)은 admission 통과 후에만 호출되어야 한다는 것이 spec 문언과 일치. 큐-대기 5분 초과 cancel 의 경우도 "consumer 가 job 을 pick up 할 때 admission gate 이전에 `now - queued_at` 을 확인해 초과 시 재큐 대신 `cancelled` 로 마감"이라고 명시 — 이 경로 역시 `runExecution` 진입 전 조기 종료이므로 미호출 단정과 정합.
- **`releaseExecutionRouting` 호출**: §8 본문에는 라우팅 리소스 해제를 직접 언급하지 않으나, 이는 admission 실패로 job 이 재큐/취소될 때 이미 점유했을 수 있는 실행 라우팅 자원을 되돌리는 내부 정리 동작이다. spec §8·§9.3 어디에도 "admission 실패 시 라우팅 리소스를 점유 상태로 방치한다"는 상반 문언이 없어 충돌 없음(spec 이 세부 구현 함수명까지 규정하지 않는 영역이므로 이는 구현 세부에 대한 화이트박스 unit — spec 정합성 문제가 아니라 impl-level 검증).
- **admission raw SQL 파라미터 순서 assert**: §8 "admission gate 원자성(TOCTOU)" 단락이 "advisory lock 안에서 조건부 UPDATE(`WHERE status='pending' AND (SELECT count …) < cap RETURNING`)" 구조를 명시하고, "조건부 UPDATE 단독은 불충분"이라는 ai-review CRITICAL 실증 근거까지 문서화되어 있다. 파라미터 순서 assert 는 이 이미 명세된 raw SQL 형태를 고정하는 회귀 방지 테스트이며 신규 계약을 만들지 않는다.
- **workspace-level cap e2e**: §8 표의 "워크스페이스당 동시 Execution 수(기본 10, `Workspace.settings.maxConcurrentExecutions`)" 및 `spec/1-data-model.md` §2.2 필드 정의와 정합. 신규 시나리오 없이 기존 cap 값·엔드포인트(`PATCH /api/workspaces/:id/settings`)를 그대로 사용하는 e2e 다.

특기 사항 — 정보성:

- **[INFO]** `plan/in-progress/spec-draft-concurrency-cap-pr2b.md` 가 여전히 `in-progress/` 에 남아 있음
  - target 위치: 해당 없음 (target 자체와 무관, 주변 정황)
  - 충돌 대상: `.claude/docs/plan-lifecycle.md` 의 완료 plan 이동 규칙
  - 상세: §8 은 이미 "PR2b 구현 완료"로 명시하고 `exec-intake-queue-impl.md`도 `plan/complete/`로 이동된 상태인데, 그 spec 선행 draft(`spec-draft-concurrency-cap-pr2b.md`)만 `in-progress/`에 잔존한다. target(테스트 전용 회귀 보강) 자체의 정합성에는 영향 없음 — 별도 정리 대상으로만 기록.
  - 제안: 이번 작업 범위 밖. 별도 plan-lifecycle 정리 시 처리 권장(테스트 작업과 함께 처리할 필요는 없음).

## 요약

계획된 작업은 이미 spec(§8)과 백로그(`exec-intake-followups.md`)에 명시적으로 예정되어 있던 "admission 회귀 보강" 항목의 TEST-ONLY 착수로, 신규 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 것도 도입하지 않는다. 검증 대상 동작(admission 실패 시 `runExecution` 미호출·라우팅 해제, raw SQL 파라미터 순서, workspace-cap e2e) 은 모두 기존 §8/§2.13/§9.3 문언과 직접 대응되며 모순되는 지점이 없다. 발견된 유일한 항목은 무관한 plan-lifecycle 정리 이슈(INFO)로, target 작업을 막을 이유가 되지 않는다.

## 위험도
NONE

BLOCK: NO
STATUS: SUCCESS