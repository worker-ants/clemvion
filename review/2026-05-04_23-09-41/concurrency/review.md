## 발견사항

### **[WARNING]** `stop()` — TOCTOU 경쟁 조건 (check-then-act)
- **위치**: `executions.service.ts` — `stop()` 메서드 (findOne → status 체크 → save)
- **상세**: `findOne`으로 상태를 읽은 뒤 `save`로 쓰기까지의 구간이 트랜잭션으로 보호되지 않습니다. 두 요청이 동시에 같은 execution을 stop하면 두 요청 모두 status 체크를 통과한 뒤 각자 `CANCELLED`를 저장할 수 있습니다. `finishedAt` 및 `durationMs`도 각자 계산되므로 값이 서로 덮어써질 수 있습니다.
- **제안**: TypeORM의 `@Version()` 낙관적 락 또는 `queryRunner`로 `SELECT ... FOR UPDATE` 비관적 락, 혹은 `update({ id, status: In([RUNNING, PENDING, WAITING_FOR_INPUT]) }, { status: CANCELLED, finishedAt, durationMs })` 형태의 단일 원자 UPDATE를 사용하여 상태 전환을 원자적으로 처리해야 합니다.

---

### **[WARNING]** `cancelWaitingExecution` — 누락된 `await` (fire-and-forget 후 즉시 상태 조회)
- **위치**: `executions.service.ts` — `stop()` 내 `WAITING_FOR_INPUT` 분기
  ```ts
  this.executionEngineService.cancelWaitingExecution(id);  // await 없음
  const updated = await this.executionRepository.findOne({ where: { id } });
  ```
- **상세**: `cancelWaitingExecution`이 비동기로 status를 업데이트하는 경우, 다음 줄의 `findOne`은 취소 완료 이전의 stale 상태를 반환할 수 있습니다. 이전 커밋에서 해당 동작에 관한 주석이 제거된 것을 확인했는데, 의도적 fire-and-forget이라면 즉시 re-fetch하는 것은 신뢰할 수 없습니다.
- **제안**: `cancelWaitingExecution`이 Promise를 반환한다면 `await`를 추가해야 합니다. fire-and-forget이 설계 의도라면 `findOne` re-fetch를 짧은 재시도 루프로 교체하거나, engine 측에서 DB 업데이트 완료를 보장하는 방식으로 변경해야 합니다.

---

### **[INFO]** `getCount()` + `getMany()` — 두 쿼리 간 페이지네이션 불일치
- **위치**: `executions.service.ts` — `findByWorkflow()`
  ```ts
  const totalItems = await qb.getCount();
  const data = await qb.skip(...).take(limit).getMany();
  ```
- **상세**: 두 쿼리 사이에 행 삽입/삭제가 발생하면 `totalItems`와 실제 `data` 개수가 맞지 않아 클라이언트의 페이지 계산이 어긋날 수 있습니다. 이는 페이지네이션 API에서 널리 알려진 패턴이며 일반적으로 허용 범위이지만, 고빈도 실행 환경에서는 UX 영향을 줄 수 있습니다.
- **제안**: 완전한 정확성이 필요하다면 단일 트랜잭션(`REPEATABLE READ`) 내에서 두 쿼리를 실행하거나, TypeORM의 `getManyAndCount()`를 사용해 단일 왕복으로 처리하세요.

---

## 요약

변경된 코드에서 동시성 관련 실질적 위험은 `executions.service.ts`의 `stop()` 메서드에 집중됩니다. 상태 체크와 저장 사이에 트랜잭션/락이 없어 동시 stop 요청 시 TOCTOU 경쟁 조건이 발생하고, `cancelWaitingExecution` 후 즉시 re-fetch하는 패턴은 `await` 누락으로 인해 stale 상태를 반환할 수 있습니다. 나머지 변경사항(DTO, 유틸 함수, 프론트엔드, i18n)은 모두 상태를 공유하지 않는 순수 함수 혹은 읽기 전용 데이터이므로 동시성 문제가 없습니다.

## 위험도
**LOW ~ MEDIUM**