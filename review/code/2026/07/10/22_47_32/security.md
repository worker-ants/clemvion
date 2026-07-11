# 보안 코드 리뷰 — `InteractionService.getStatus()` 2단계 projection 전환

- **diff base**: `origin/main` (`git diff origin/main...HEAD`)
- **대상**: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (+ `interaction.service.spec.ts`)
- **불변식 소스**: `spec/5-system/14-external-interaction-api.md` §R17 "표면 제약(보안)"

## 발견사항

검토한 8개 관점(인젝션 / 하드코딩 시크릿 / 인증·인가 / 입력 검증 / OWASP Top10 / 암호화 / 에러 처리 / 의존성) 중 이번 diff 는 순수 DB 조회 최적화(단일 쿼리 → 조건부 2단계 쿼리) 라 대부분 항목은 해당 없음. 유일한 실질 위험은 EIA §R17 이 명시한 "secret egress 마스킹 배선 유지" 였고, **이는 정상적으로 보존되어 있다.**

- **[INFO]** `redactThreadForPublic` 마스킹 배선 — 유지 확인, 실효성 있는 회귀 가드 존재
  - 위치: `interaction.service.ts:299-301` (`threadRow?.conversationThread ? redactThreadForPublic(threadRow.conversationThread) : undefined`)
  - 상세: 소스 객체가 `execution.conversationThread` (1단계 단일 조회 결과) → `threadRow.conversationThread` (2단계 별도 partial entity 조회 결과) 로 바뀌었지만, `redactThreadForPublic` 호출은 그대로 새 소스 객체에 적용되도록 재배선되어 있다. 1단계 select 목록(`interaction.service.ts:253-260`)에는 `conversationThread` 가 포함되지 않아, 실수로 1단계 `execution.conversationThread` 를 참조했다면 항상 `undefined` 가 되어 즉시 드러났을 구조 — TypeORM 이 `select` 미지정 컬럼을 populate 하지 않으므로 이 배선 오류는 "조용히 새는" 대신 "조용히 사라지는" 형태로만 실패할 수 있고, 실제로는 올바른 소스(`threadRow`)를 참조하고 있어 해당 실패 모드도 발생하지 않는다.
  - 테스트 실효성: `interaction.service.spec.ts:773-816` ("2단계 재조회 결과의 thread 도 redactThreadForPublic 를 통과") 가 `repo.findOne` mock 을 `select` 배열 내용으로 분기시켜, 1단계 mock 응답(`makeExecution(...)`)에는 `conversationThread` 프로퍼티 자체가 없도록(타입도 `Pick<..>` 로 제한) 구성했다. 코드가 실수로 1단계 결과에서 thread 를 읽으면 `conversationThread` 가 `undefined` 가 되어 `ctx.conversationThread.turns[0].text` 접근에서 `TypeError` 로 테스트가 즉시 실패한다 — **vacuous 가 아니라 실제 배선을 고정하는 가드**로 확인됨.
  - 결론: 이 항목은 문제 없음 (제안 없음, 참고용 INFO).

- **[INFO]** terminal `outputData` (result/error) 마스킹 및 select 배선 무변경 확인
  - 위치: `interaction.service.ts:253-260` (`outputData` 가 1단계 select 목록에 포함), `interaction.service.ts:360-373` (`deepRedactSecrets(execution.outputData ?? null)`)
  - 상세: `outputData` 는 2단계로 미뤄지지 않고 1단계 base projection 에 그대로 포함되어 있다 (plan 문서의 명시적 결정: "completed/failed 에서 항상 필요하므로 미루면 왕복만 증가"). `deepRedactSecrets` 호출 경로·인자는 origin/main 과 동일. 회귀 없음.

- **[INFO]** `nodeOutput` 마스킹 경로(`deepRedactSecrets(nodeExec.outputData ?? {})`, `interaction.service.ts:306-309`) 무변경 확인
  - `nodeExecutionRepository.findOne` 호출 자체가 `Promise.all` 내부로 위치만 이동했을 뿐 쿼리 조건(`where`/`order`/`relations`)과 이후 처리 로직은 origin/main 과 바이트 단위로 동일. 회귀 없음. (참고: 이 쿼리는 `select` 미지정으로 NodeExecution 전체 컬럼을 로드하는데, 이는 이번 diff 로 도입된 패턴이 아니라 origin/main 에도 이미 존재하던 기존 동작이므로 이번 changeset 의 신규 결함은 아님 — 별도 개선 과제로는 남을 수 있음.)

- **[INFO]** 상태 조건 로직(`execution.status === ExecutionStatus.WAITING_FOR_INPUT`) 불변 — 새로운 노출 경로 없음
  - 위치: `interaction.service.ts:276`
  - 상세: 2단계 조회가 실행되는 조건은 origin/main 의 단일-조회 버전과 동일한 `WAITING_FOR_INPUT` 단일 분기 그대로다. 조건이 느슨해지거나(예: 다른 상태에서도 thread 노출) 새로운 우회 경로가 생기지 않았다.

- **[INFO]** 인가 경계 — 2단계 쿼리 스코프 검증
  - 위치: `interaction.service.ts:282-293` (`where: { id: ctx.executionId }` — threadRow / nodeExec 둘 다 동일)
  - 상세: 1단계·2단계 모두 `ctx.executionId` (Guard 가 토큰 검증 후 합성한 값, `interaction.guard.ts` — 이번 diff 미변경) 로만 필터링한다. 다른 execution 의 `conversationThread` 를 가져올 경로 없음. `ctx.executionId` 는 diff 범위 밖의 `InteractionGuard.canActivate` 에서 토큰 서명 검증을 거쳐 합성되므로, 이번 변경이 인가 경계에 영향을 주지 않는다.

- **[INFO]** `threadRow` null 처리 — 정보 누출 없음
  - 위치: `interaction.service.ts:299-301`, 테스트 `interaction.service.spec.ts:818-835`
  - 상세: 1·2단계 사이 race(row 삭제 등)로 `threadRow` 가 `null` 이면 `conversationThread` 키 자체가 응답에서 생략된다(`undefined` → spread 시 키 미포함, `base` 객체 구성부 `interaction.service.ts:331-335` 참조). 에러 메시지나 상태 코드로 "row 가 사라졌다"는 사실이 노출되지 않고, 기존 "durable thread 없음" 경로와 동일하게 흡수된다. 정보 누출 없음.

- **[INFO]** `select` 컬럼명 오기 방지
  - 위치: `interaction.service.ts:253-260`, `284`
  - 상세: TypeORM `select` 는 엔티티 프로퍼티명(camelCase) 을 요구하며, 실제 사용된 `workflowId`/`startedAt`/`finishedAt`/`outputData`/`conversationThread` 는 `execution.entity.ts` 의 `@Column` 데코레이터 프로퍼티명과 정확히 일치함을 직접 대조 확인(`workflow_id`→`workflowId`, `started_at`→`startedAt`, `finished_at`→`finishedAt`, `output_data`→`outputData`, `conversation_thread`→`conversationThread`). 오기로 인한 침묵 실패(빈 값/undefined) 없음.
  - 부가: `updatedAt = finishedAt ?? startedAt ?? new Date()` 의 fallback 침묵 회귀(두 컬럼 select 누락 시 "현재 시각" 오반환)를 막는 실값 단언 테스트가 별도로 추가됨(`interaction.service.spec.ts` 마지막 `it('updatedAt — finishedAt 우선...')`). 보안 항목은 아니나 이 테스트가 select 배선 오류를 조기에 잡아주는 부수 효과가 있어 참고로 기록.

## 요약

이번 changeset 은 `getStatus()` 의 단일 DB 조회를 "얇은 status projection + `waiting_for_input` 조건부 thread 재조회" 2단계로 바꾸는 순수 조회 최적화이며, 공개(미인증 토큰 기반) EIA 표면에서 요구되는 핵심 보안 불변식(§R17: `redactThreadForPublic` 을 통한 `conversationThread` egress 마스킹, `deepRedactSecrets` 를 통한 `outputData`/`nodeOutput` 마스킹) 이 소스 객체 변경(`execution.conversationThread` → `threadRow.conversationThread`) 에도 불구하고 정확히 재배선되어 있음을 코드 레벨로 확인했다. 인가 스코프(`ctx.executionId` 단일 필터)는 1·2단계 쿼리 모두 동일하게 유지되어 cross-execution 노출 여지가 없고, 2단계 결과가 null 인 race 상황도 기존 "durable thread 없음" graceful 경로로 안전하게 흡수된다. 특히 신규 회귀 가드 테스트(`interaction.service.spec.ts` "2단계 재조회 결과의 thread 도 redactThreadForPublic 를 통과")는 1단계 mock 객체 타입에서 `conversationThread` 프로퍼티 자체를 제거해, 실제로 배선이 깨지면 `TypeError` 로 즉시 실패하도록 구성되어 있어 vacuous 하지 않은 실효성 있는 가드로 판단된다. Critical/Warning 급 보안 결함은 발견되지 않았다.

## 위험도

NONE

STATUS: OK
