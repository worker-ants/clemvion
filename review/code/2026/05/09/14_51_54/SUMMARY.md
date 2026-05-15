# Code Review 통합 보고서

## 전체 위험도
**LOW** — 핵심 수정(onApplicationBootstrap 이동)은 아키텍처적으로 정확하나, 타입 선언 불일치·로그 레벨 불일치·로그 인젝션 위험·테스트 커버리지 공백이 복수 에이전트에서 공통 지적됨

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 타입 안전성 | `private publisher!: Redis` definite-assignment assertion이 런타임 `if (!this.publisher)` 가드와 모순. 타입 시스템은 "항상 초기화됨"이라고 보장하지만 런타임은 그 반대를 가정함. 5개 에이전트 공통 지적 | `continuation-bus.service.ts` 필드 선언부 | `private publisher?: Redis` 또는 `private publisher: Redis \| undefined`로 변경해 타입과 런타임 동작을 일치시킴 |
| 2 | 일관성 | `releaseLock` 미초기화 가드가 `logger.warn`을 사용하나 `publish`·`acquireLock`은 동일 조건에서 `logger.error` 사용. 운영 알람 임계값이 severity 기준일 때 동일 결함이 서로 다른 레벨로 기록됨. 5개 에이전트 공통 지적 | `continuation-bus.service.ts` `releaseLock()` 가드 블록 | `logger.error`로 통일하거나, 의도적 차이라면 인라인 주석으로 이유 명시 |
| 3 | 보안 | 새 가드 블록이 `msg.type`, `msg.executionId`, `key`를 sanitize 없이 로그 템플릿 리터럴에 삽입. 기존 `dispatch()`는 이미 `/[\x00-\x1F\x7F]/g` strip을 구현하나 신규 경로에 적용되지 않음. Redis pub/sub 채널은 외부 메시지 주입 경계 | `continuation-bus.service.ts` `publish()`, `acquireLock()`, `releaseLock()` 가드 블록 | `dispatch()`의 sanitize 패턴을 공유 헬퍼로 추출하거나 가드 블록 내 로그에도 동일 적용 |
| 4 | 프로세스 | Plan 문서의 모든 작업 항목 체크박스가 `[ ]` 상태이나 구현이 이미 완료됨. CLAUDE.md "작업 단계가 끝날 때마다 plan 문서를 갱신" 규약 위반. 6개 에이전트 공통 지적 | `plan/in-progress/fix-continuation-bus-bootstrap-race.md` 전체 | 완료된 항목을 `[x]`로 갱신 후, TEST/REVIEW WORKFLOW 완료 시 `git mv plan/in-progress/... plan/complete/`로 이동 |
| 5 | 프로세스 | Plan 문서 1행이 `/Users/gehrig/.claude/plans/sorted-shimmying-wirth.md` 머신 종속 절대경로를 참조. 다른 팀원·CI 환경에서 링크 불통. 4개 에이전트 공통 지적 | `plan/in-progress/fix-continuation-bus-bootstrap-race.md:3` | 참조 내용을 plan 내부에 직접 요약하거나 `plan/` 또는 `memory/` 경로로 이동 후 상대경로 교정 |
| 6 | 테스트 커버리지 | `onApplicationBootstrap` 테스트가 `releaseLock` 호출을 검증하지 않음. lock 획득 후 해제 실패가 발생해도 테스트 통과 → lock 누수 무음 통과 위험 | `execution-engine.service.spec.ts` `onApplicationBootstrap 이 recovery 를 트리거한다` | `expect(mockBus.releaseLock).toHaveBeenCalledWith('exec:recover:lock')` 단언 추가 |
| 7 | 테스트 커버리지 | `recoverStuckExecutions` 내 QueryBuilder 체인 reject 시 `onApplicationBootstrap` 동작(throw vs. silent) 미테스트. 부팅 실패로 이어지는 경로 | `execution-engine.service.spec.ts` `recoverStuckExecutions` describe | DB 오류 시 오류 전파 여부를 명시하는 테스트 1건 추가 |
| 8 | 문서화 | `acquireLock` JSDoc `@returns`가 기존 2가지 경로(성공 true / 경쟁 실패 false)만 기술하고 신규 경로(publisher 미초기화 → false)를 누락. 호출자가 `false` 의미를 오해 가능 | `continuation-bus.service.ts` `acquireLock` JSDoc | `@returns 획득 성공 시 true. 다른 인스턴스가 이미 보유하거나 publisher 가 미초기화 상태이면 false.`로 보완 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 중복 | publisher 비활성화 패턴(`ref.publisher = undefined` → try/finally → restore)이 `acquireLock`·`releaseLock`·`publish` 3개 케이스에 동일하게 반복. 2개 에이전트 공통 지적 | `continuation-bus.service.spec.ts` `publisher 미초기화 가드 — race 방어` | `beforeEach/afterEach`로 상태 격리를 추출하거나 `withUninitializedPublisher(fn)` 헬퍼로 묶음 |
| 2 | DB 인덱스 | `recoverStuckExecutions`의 `WHERE status = :status AND started_at < :threshold` 조건에 `(status, started_at)` 복합 인덱스 부재 시 full-table scan 발생 가능. 이번 변경으로 매 부팅 시 확실히 실행되는 경로가 됨. 2개 에이전트 공통 지적 | `execution-engine.service.ts` `recoverStuckExecutions()` QueryBuilder | 마이그레이션에서 `CREATE INDEX idx_exec_status_started_at ON executions(status, started_at)` 추가 검토 |
| 3 | 데이터 품질 | 복구된 row의 `durationMs`가 `NULL`로 유지됨. 집계 쿼리(`AVG(duration_ms)`, 실행 시간 통계)에서 왜곡 가능 | `execution-engine.service.ts` `.set({ status, error, finishedAt })` 블록 | 분석 레이어에서 `durationMs IS NULL AND status = 'failed'` row를 별도 처리하거나, `finishedAt - startedAt` 계산으로 채워넣는 것 검토 |
| 4 | 테스트 커버리지 | `onModuleInit` 테스트가 `registerHandlers()`·`registerContinuationHandlers()` 호출 여부를 검증하지 않음. lifecycle 변경 후 핸들러 등록 회귀 가드 부재. 2개 에이전트 공통 지적 | `execution-engine.service.spec.ts` `onModuleInit 은 recovery 를 트리거하지 않는다` | `expect(mockBus.on).toHaveBeenCalledTimes(5)` 등으로 핸들러 등록 유지 확인 |
| 5 | 테스트 품질 | `mockBus.acquireLock.mockResolvedValue(true)` 중복 설정. `beforeEach`에서 이미 설정되고 `mockClear()`는 구현을 초기화하지 않으므로 해당 줄은 효과 없음 | `execution-engine.service.spec.ts:571` | 중복 제거 또는 `mockClear()` → `mockReset()`으로 변경해 의미 명확화 |
| 6 | 테스트 경계 | `subscriber` 필드는 가드 없음. `publisher`만 방어하는 의도가 코드에 명시되지 않아 향후 public 메서드 추가 시 누락 위험 | `continuation-bus.service.ts` 전체 | 클래스 레벨 주석 1줄로 가드 범위를 `publisher`에만 한정한다는 의도 명시 |
| 7 | 테스트 가드 | 가드 블록의 `logger.error`/`logger.warn` 호출 여부를 테스트에서 검증하지 않음. 로그 레벨 변경·제거 시 테스트 미탐지 | `continuation-bus.service.spec.ts` 3개 가드 테스트 | logger spy를 달아 적절한 레벨 호출 여부 단언 추가 |
| 8 | 문서화 | `publish` JSDoc이 publisher 미초기화 시 `null` 반환·`logger.error` 기록 경로를 언급하지 않음 | `continuation-bus.service.ts` `publish` JSDoc | "publisher 미초기화 상태에서도 `null`을 반환하며 `logger.error`로 기록된다" 한 줄 추가 |
| 9 | 문서화 | `releaseLock` JSDoc에 `@returns` 없음. 기존 누락에 신규 경로(publisher 미초기화 → false)까지 추가 | `continuation-bus.service.ts` `releaseLock` JSDoc | `@returns owner 일치 시 true, 불일치·Redis 오류·publisher 미초기화 시 false.` 추가 |
| 10 | 문서화 | `releaseLock` 가드가 `warn`을 쓰는 이유가 코드에 명시되지 않음 | `continuation-bus.service.ts` `releaseLock` 가드 블록 | 인라인 주석 예시: `// acquireLock 실패 후속이므로 error 중복 방지를 위해 warn 사용` |
| 11 | 동시성 | `onModuleDestroy`가 `publisher.quit()` 후 `this.publisher = undefined`로 초기화하지 않아 shutdown 후 외부 호출 시 가드를 통과하지만 closed connection으로 실패 | `continuation-bus.service.ts` `onModuleDestroy` | 현재 `catch` 방어로 기능 안전성 유지. 명시적 차단 원하면 `onModuleDestroy` 말미에 publisher 초기화 추가 |
| 12 | 동시성 | `Promise.allSettled(this.inflight)` 스냅샷 타이밍 — graceful shutdown 대기 중 신규 추가되는 inflight 태스크 미포함 | `continuation-bus.service.ts` `onModuleDestroy` | 현재 허용 가능 수준. 완전한 drain 필요 시 `while (this.inflight.size > 0)` 패턴 고려 |
| 13 | 문서화 | Plan 문서 내 `acquireLock(line 163)` 등 라인 번호 참조가 코드 변경 후 이미 구식 | `plan/in-progress/fix-continuation-bus-bootstrap-race.md` 작업 항목 2절 | 라인 번호 대신 메서드 이름·시그니처 단위로 참조하거나, 완료 체크 후 그대로 유지 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | LOW | 신규 가드 블록에서 외부 출처 값 미sanitize 로그 인젝션 위험 |
| Performance | NONE | 기능 정확성 픽스로 성능 실질 영향 없음. 복합 인덱스 부재는 기존 문제 |
| Architecture | LOW | `publisher!` 타입 모순, 로거 레벨 불일치, 이중 방어 책임 경계 모호 |
| Requirement | LOW | plan 체크박스 미갱신, `releaseLock` 로그 레벨 불일치, `onModuleInit` 회귀 가드 부재 |
| Scope | NONE | 4개 작업 항목 모두 plan 명세와 1:1 일치. 범위 이탈 없음 |
| Maintainability | LOW | 테스트 publisher 비활성화 패턴 3중 반복, `publisher!` 타입 모순, plan 미갱신 |
| Testing | LOW | `releaseLock` 호출 미검증, DB 오류 전파 시나리오 누락 |
| Documentation | LOW | `publisher!` 타입 모순, `acquireLock` JSDoc 신규 경로 누락, plan 미갱신·절대경로 |
| Dependency | NONE | 신규 외부 패키지 없음. `@nestjs/common`의 `OnApplicationBootstrap` 추가만 |
| Database | LOW | 복합 인덱스 부재 가능성, 복구 row `durationMs` NULL 처리 |
| Concurrency | LOW | `onModuleDestroy` 후 publisher 미초기화, `allSettled` 스냅샷 타이밍 |
| Side Effect | LOW | `publisher!` 타입-런타임 불일치, `releaseLock` 로그 레벨, plan 미갱신 |
| API Contract | NONE | 외부 HTTP API 변경 없음 |

---

## 발견 없는 에이전트
- **API Contract** — 내부 서비스 레이어만 변경, 외부 계약에 영향 없음
- **Dependency** — 신규 외부 패키지 추가 없음, 내부 의존 방향 변경 없음
- **Scope** — 구현이 plan 명세와 완전히 일치, 범위 이탈 없음
- **Performance** — 실질적 성능 영향 없음

---

## 권장 조치사항

1. **[즉시] `releaseLock` 로그 레벨 통일** — `logger.warn` → `logger.error`로 변경하거나 인라인 주석으로 의도 명시 (코드 1줄, 5개 에이전트 공통 지적)

2. **[즉시] 로그 인젝션 방어 추가** — `publish`, `acquireLock`, `releaseLock` 가드 블록의 로그에 `msg.type`, `msg.executionId`, `key` sanitize 적용 (기존 `dispatch()` 패턴 재사용)

3. **[즉시] `publisher` 타입 선언 수정** — `private publisher!: Redis` → `private publisher?: Redis`로 변경해 타입과 런타임 가드 일관성 확보

4. **[즉시] Plan 문서 정리** — 완료 항목 `[x]` 갱신, 머신 종속 절대경로 제거, TEST/REVIEW WORKFLOW 완료 후 `git mv plan/in-progress/... plan/complete/`

5. **[권장] 테스트 보강** — `onApplicationBootstrap` 테스트에 `releaseLock` 호출 검증 추가, DB 오류 전파 시나리오 테스트 1건 추가

6. **[권장] `acquireLock` JSDoc 보완** — `@returns`에 publisher 미초기화 시 `false` 반환 경로 명시

7. **[검토] `(status, started_at)` 복합 인덱스** — `executions` 테이블에 인덱스 존재 여부 확인, 없으면 마이그레이션 추가

8. **[선택] 테스트 픽스처 리팩토링** — publisher 비활성화 패턴 3중 반복을 `beforeEach/afterEach`로 추출