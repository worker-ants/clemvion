# 부작용(Side Effect) Review — PR2b 동시성 cap enforcement (재검증)

Diff base: origin/main. 대상: `execution-engine.service.ts` (admitExecutionOrDefer /
markQueueWaitTimeout / runExecution alreadyRunning 파라미터), execution-limits.ts,
execution.entity.ts(queued_at), V104/V105 migrations, workspaces DTO/service,
e2e/unit specs, docker-compose.e2e.yml, .env.example.

## 재검증 대상 1 — recordRunningSegmentStart 가 admitted 분기에 있는가 (선행 CRITICAL fix 확인)

**확인됨 — 반영됨.** `execution-engine.service.ts:2662-2673`:

```ts
if (admitted) {
  execution.status = ExecutionStatus.RUNNING; // → runExecution 전이 skip
  this.recordRunningSegmentStart(executionId);
  await this.eventEmitter.emitExecution(
    executionId,
    ExecutionEventType.EXECUTION_STARTED,
    { status: ExecutionStatus.RUNNING },
  );
  return 'admitted';
}
```

`recordRunningSegmentStart`(7417-7419)는 `this.segmentStartMs.set(executionId, Date.now())`
— pre-existing 인스턴스 레벨 `Map`(471-491 문서화된 set/delete 상호배제 불변식)에 대한
쓰기다. `updateExecutionStatus`의 RUNNING 진입 분기(7444-7445), `runExecutionFromQueue`의
stalled 재배달 분기(3310), `reclaimStuckRunningExecution`류 backstop과 동일 패턴을 그대로
재사용 — 새 전역 상태나 새 부작용 경로를 도입하지 않았다. `execution.status = RUNNING`
로컬 뮤테이션도 `runExecutionFromQueue`에서 새로 `findOneBy`로 가져온 로컬 객체에 대한
것이라(3287-3289) 외부 참조자와 공유되지 않는다 — 안전. `runExecution(execution, input,
true)`가 `alreadyRunning=true`로 RUNNING 재전이/재-emit을 skip(602-612)하는 것도 정합.

이전 리뷰의 CRITICAL(#2, SUMMARY/RESOLUTION 16_58_32)는 실제로 해소됐다.

## 재검증 대상 2 — advisory lock 트랜잭션 부작용

`admitExecutionOrDefer` (c) 블록(2644-2661):

```ts
const admitted = await this.executionRepository.manager.transaction(async (m) => {
  await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
  const rows = (await m.query(`UPDATE execution SET status='running', ... RETURNING id`, ...));
  return rows.length === 1;
});
```

### 발견사항

- **[INFO]** JSDoc 상단부(2603-2607, "TOCTOU" 문단)가 여전히 "pg advisory lock 불요"라고
  서술 — 실제로는 바로 아래 (c) 블록 주석(2636-2643)이 advisory lock 필수로 정정돼 있어
  코드 자체는 정확하지만, 같은 메서드 JSDoc 내부에 상반된 두 서술이 공존한다(문서 drift,
  RESOLUTION #5 spec 정정과 별개로 이 로컬 JSDoc은 미정리).
  - 위치: `execution-engine.service.ts:2603-2607` vs `2636-2643`
  - 상세: 기능 결함은 아니나 차후 유지보수자가 상단 문단만 읽고 "lock 불요"로 오인해
    회귀시킬 위험(부작용 자체는 아니고 문서 불일치).
  - 제안: 상단 TOCTOU 문단의 "pg advisory lock 불요" 구절을 (c) 서술과 일치시켜 삭제/수정.

- **[INFO]** `pg_advisory_xact_lock`은 트랜잭션 커밋/롤백 시 자동 해제(세션 advisory
  lock과 달리 명시적 unlock 불필요) — 트랜잭션 누수(unreleased lock) 위험 없음. lock key는
  `hashtext(workspaceId 또는 workflowId 문자열)`이므로 해시 충돌 시 서로 다른
  workspace/workflow가 동일 lock을 공유해 불필요한 직렬화가 생길 수 있으나(정합성 문제
  아님, 성능 저하만), 이는 admission 경로에 한정되고 다른 잠금 획득 순서와 얽히지 않아
  데드락 위험은 낮다(단일 lock 획득 후 즉시 해제, lock 순서 고정).
  - 위치: `2644-2661`
  - 영향: 없음(정확성). 관측 가능성 낮은 성능 특성만.

- **[INFO]** advisory lock을 잡는 트랜잭션 안에서 COUNT 서브쿼리가 스캔하는 `execution`/
  `workflow` 테이블에는 row-level 잠금이 없다 — 그러나 이는 의도된 설계다(주석 2636-2643):
  같은 workspace의 admission 끼리는 advisory lock으로 완전 직렬화되므로 서로 다른
  트랜잭션이 같은 시점에 COUNT를 읽는 경우가 없다. **다른 workspace의 admission은 병렬
  진행**되며 서로 다른 lock key를 쓰므로 교착 없음. 부작용 관점에서 문제 없음.

- **[INFO]** `runExecutionFromQueue`가 `admitExecutionOrDefer` 전에 이미
  `registerExecutionRouting`을 호출(3324-3331)한 뒤, deferred 판정 시
  `releaseExecutionRouting`으로 원복(3337-3340)한다. cancelled 판정 시에는
  `markQueueWaitTimeout` 내부에서도 별도로 `releaseExecutionRouting`을 호출(2584) —
  두 경로 모두 routing 등록 해제가 누락 없이 대칭적으로 짝지어져 있음을 확인. admitted
  경로는 routing을 유지한 채 `runExecution`으로 진행(정상).

## 그 외 파일 부작용 스캔

- **[INFO]** `.env.example`에 `EXECUTION_QUEUE_WAIT_TIMEOUT_MS` 신규 항목 추가만 — 기존 키
  변경 없음, 부작용 없음.
- **[INFO]** V104(execution.queued_at, `DEFAULT NOW()`)·V105(`CREATE INDEX CONCURRENTLY ...
  IF NOT EXISTS`, non-transactional `.conf`)는 additive/idempotent 마이그레이션. 기존 row는
  NULL 대신 마이그레이션 시각으로 채워지나 이미 종결/running 상태라 admission 재검사
  대상이 아님(문서화된 대로 무해).
- **[INFO]** `runExecution` 시그니처에 3번째 파라미터 `alreadyRunning = false` 추가 —
  기본값 지정으로 기존 호출부(`executeSync`/`executeInline` 등)는 영향 없음. private
  메서드라 외부 API 파급 없음.
- **[INFO]** `WorkspaceSettingsDto`/`UpdateWorkspaceSettingsDto`에 `maxConcurrentExecutions`
  필드 추가는 additive(optional) — 기존 클라이언트 파싱에 영향 없음. `getWorkspaceSettings`
  반환 타입 확장도 optional 필드 추가라 하위 호환.
- **[INFO]** e2e 스펙이 `docker-compose.e2e.yml`에 `EXECUTION_QUEUE_WAIT_TIMEOUT_MS=8000`
  env를 신설 — e2e 컨테이너 스코프 한정, 프로덕션 compose 파일 미변경.
- **[INFO]** `execution-engine.service.spec.ts`의 `mockExecutionRepo.manager.transaction`
  기본 mock 도입은 테스트 더블 변경으로, 실제 부작용 없음(테스트 인프라 범위).

## 요약

선행 리뷰 CRITICAL(#2: admitted 분기의 `recordRunningSegmentStart` 누락)은 코드 상 명확히
해소되었고, 기존 in-memory `segmentStartMs` Map 관리 불변식(set/delete 상호배제)을 그대로
따른다. advisory lock 트랜잭션은 자동 해제되는 `pg_advisory_xact_lock`을 사용해 잠금
누수·데드락 위험이 없고, workspace 단위 직렬화로 다른 workspace admission과 병렬성도
보존한다. routing 등록/해제도 admitted/deferred/cancelled 세 분기 모두 대칭적으로
처리된다. 발견된 유일한 항목은 JSDoc 상단 문단이 "advisory lock 불요"라는 낡은 서술을
남겨 실제 구현(락 사용)과 불일치하는 문서 drift로, 기능적 부작용은 아니다. 그 외 마이그레이션·
DTO·엔티티·env 변경은 모두 additive/backward-compatible.

## 위험도

LOW (문서 drift 1건 INFO만 남음, 기능적 부작용 없음)

STATUS: SUCCESS
