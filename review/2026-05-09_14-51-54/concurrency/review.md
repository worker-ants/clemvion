### 발견사항

- **[INFO] TOCTOU — `onModuleDestroy` 이후 publisher non-null 잔존**
  - 위치: `continuation-bus.service.ts` — `onModuleDestroy` + 각 메서드의 guard 체크
  - 상세: `onModuleDestroy`는 `publisher.quit()`을 호출하지만 `this.publisher = undefined`로 초기화하지 않는다. 이후 외부에서 `publish()`/`acquireLock()`이 호출되면 `!this.publisher` guard를 통과하지만 이미 closed connection으로 Redis 명령이 실패한다. 이 경우 각 메서드의 `catch` 블록이 실제로 에러를 흡수하므로 기능적 안전성은 유지된다.
  - 제안: 현재 catch 방어가 있으므로 운영상 문제 없음. 단, `onModuleDestroy` 말미에 `this.publisher = undefined as unknown as Redis`를 추가하면 guard가 quit 이후 경우도 명시적으로 차단할 수 있다. 다만 TypeScript 타입 우회가 필요해 트레이드오프가 있음.

- **[INFO] `Promise.allSettled(this.inflight)` 스냅샷 타이밍**
  - 위치: `continuation-bus.service.ts:onModuleDestroy`
  - 상세: `Promise.allSettled`는 호출 시점의 Set 이터러블을 내부적으로 배열로 복사한다. graceful shutdown 대기 중에 새로 추가되는 `inflight` 태스크는 allSettled 대상에 포함되지 않는다. NestJS shutdown 시점에 신규 publish가 들어올 가능성이 극히 낮아 실질적 위험은 없지만, pre-existing한 미묘한 gap이다.
  - 제안: 현재 허용 가능한 수준. 완전한 graceful drain이 필요하다면 `while (this.inflight.size > 0) await Promise.allSettled([...this.inflight])` 패턴을 고려할 수 있으나 과도한 방어다.

- **[INFO] 테스트의 `publisher` 필드 임시 변조**
  - 위치: `continuation-bus.service.spec.ts` — `publisher 미초기화 가드 — race 방어` describe
  - 상세: 세 개의 테스트가 각각 독립적으로 `ref.publisher = undefined` → try/finally → restore를 수행한다. Jest가 파일 내 테스트를 순차 실행하는 한 안전하지만, `--runInBand=false`와 같은 설정에서 동일 spec 파일 내 테스트 병렬화가 발생할 경우 이 패턴은 공유 `bus` 인스턴스 오염을 일으킬 수 있다. 현재 Jest 기본값(파일 내 테스트 순차 실행)에서는 문제없다.
  - 제안: 수용 가능. 단, `beforeEach`에서 `bus` 인스턴스를 새로 생성하는 현재 구조 덕분에 describe 블록 간 오염은 이미 차단되어 있다.

---

### 요약

핵심 변경인 `recoverStuckExecutions()` 호출 시점을 `onModuleInit` → `onApplicationBootstrap`으로 이동한 것은 NestJS 라이프사이클을 정확히 활용한 올바른 race 수정이다. `onApplicationBootstrap`은 모든 모듈의 `onModuleInit`이 완료된 후에 호출되므로 `ContinuationBusService.publisher` 초기화가 보장된 상태에서 lock 획득이 이루어진다. 방어적 guard(`!this.publisher` 조기 반환)는 defense-in-depth로 유효하며, Node.js 단일 스레드 이벤트 루프 덕분에 check-then-use 사이의 실질적 TOCTOU 위험은 없다. 발견된 사항들은 모두 pre-existing 또는 운영상 영향이 없는 INFO 수준이다.

### 위험도
**LOW**