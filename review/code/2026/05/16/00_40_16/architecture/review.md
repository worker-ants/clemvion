### 발견사항

- **[INFO]** `KbStatsHelper` 의 단일 책임 원칙(SRP) 개선 확인 — broadcast 책임 제거
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`
  - 상세: 변경 전 `KbStatsHelper` 는 "캐시 갱신"과 "WebSocket broadcast" 두 가지 책임을 동시에 가지고 있었다. 이번 변경으로 broadcast 블록이 제거되어 이 클래스는 오직 DB의 `entity_count`/`relation_count` 캐시를 원자적으로 갱신하는 단일 책임만 수행한다. SRP 준수 방향으로 개선된 긍정적 변화다.
  - 제안: 현 상태 유지. 추후 broadcast가 필요해지면 `KbStatsHelper` 를 호출하는 상위 서비스 레이어에서 별도 이벤트 발행을 담당하도록 분리하는 것이 적절하다.

- **[INFO]** `WebsocketService` 의존성 제거로 결합도 감소
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`, constructor
  - 상세: 기존에는 `knowledge-base/graph` 모듈이 `websocket` 모듈에 불필요하게 결합되어 있었다. 이번 변경으로 `DataSource` 만 의존하므로 모듈 간 결합도가 낮아졌다. 특히 해당 의존성이 dead path(`as never` 강제 캐스트, `execution:` prefix 오작동)였다는 점에서 실질적 기능 손실 없이 결합도만 제거된 이상적인 케이스다.
  - 제안: 현 상태 유지.

- **[WARNING]** `KbStatsHelper` 가 `DataSource` 에 직접 의존하여 레이어 책임 경계가 다소 낮음
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`, L3 및 constructor
  - 상세: NestJS 에서 일반적으로 비즈니스 레이어(Service/Helper)는 Repository 추상화를 통해 DB에 접근한다. 이 클래스는 TypeORM `DataSource` 에 직접 의존해 raw SQL을 실행한다. 원자적 `UPDATE ... SET ... RETURNING` 쿼리는 ORM의 단순 Repository API로는 표현하기 어렵기 때문에 실용적 이유가 있으나, 테스트에서 mock 대상이 `DataSource.query` 라는 저수준 계약이 된다. 이 trade-off 는 현재 코드에서 인지하고 있는 것으로 보이며 허용 범위 내다.
  - 제안: 현 구조를 유지하되, `KbStatsHelper` 가 "raw SQL 원자 갱신 특화 헬퍼" 임을 주석 혹은 네이밍으로 명확히 표현하면 충분하다. 이미 JSDoc 에 배경이 잘 서술되어 있어 큰 문제 없음.

- **[INFO]** 추상화 수준이 적절하게 유지됨
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`
  - 상세: Helper 클래스 명칭과 역할이 일치하고, 단일 `refresh(knowledgeBaseId)` 퍼블릭 메서드만 노출한다. 호출자는 내부 SQL 구조를 알 필요 없이 "캐시를 갱신하려면 refresh() 를 호출한다"는 계약만 알면 된다. 과도한 추상화(인터페이스 레이어 추가 등) 없이도 적절한 캡슐화가 이루어져 있다.
  - 제안: 현 상태 유지.

- **[INFO]** 순환 의존성 위험 해소
  - 위치: `backend/src/modules/knowledge-base/graph/` 과 `backend/src/modules/websocket/`
  - 상세: 기존에는 `kb-stats.helper.ts` 가 `websocket` 모듈을 참조하였다. WebSocket 서비스가 향후 KB 이벤트를 역참조하는 코드를 갖게 되는 경우 순환 참조 위험이 잠재해 있었다. 이번 변경으로 `knowledge-base/graph` → `websocket` 의존 엣지가 제거되어 순환 가능성이 줄었다.
  - 제안: 현 상태 유지.

- **[INFO]** 테스트 구조가 구현의 아키텍처 경계를 충실히 반영
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts`
  - 상세: 테스트가 `DataSource` 만 mock 하고 `WebsocketService` 를 전혀 주입하지 않음으로써, 제거된 의존성이 테스트 수준에서도 완전히 격리되었음을 확인할 수 있다. NestJS Testing Module을 통해 실제 DI 컨테이너 맥락에서 헬퍼를 생성하는 방식은 모듈 경계를 존중한 적절한 접근이다.
  - 제안: 현 상태 유지.

- **[INFO]** 확장성: 향후 broadcast 재도입 시 아키텍처적 준비 필요
  - 위치: 설계 수준
  - 상세: 현재는 "통계 갱신 후 실시간 push 없이 REST 폴링"으로 수렴되었다. 향후 관리자 단건 삭제 등의 실시간 반영이 필요해질 때는 `KbStatsHelper.refresh()` 반환값을 활용하거나, 상위 서비스(GraphExtractionService, GraphQueryService 등)에서 이벤트를 발행하는 구조가 필요하다. 현재 `refresh()` 는 `Promise<void>` 를 반환하여 통계 결과를 caller에게 제공하지 않으므로, 실시간 push 재도입 시 시그니처 변경이 필요하다.
  - 제안: 당장은 문제없으나, broadcast 재도입 plan이 구체화될 때 `refresh()` 가 갱신된 카운트를 반환(`Promise<{ entityCount: number; relationCount: number } | undefined>`)하도록 시그니처를 먼저 확장한 뒤, 상위 서비스에서 이벤트를 발행하는 흐름으로 설계하는 것을 권장한다.

### 요약

이번 변경은 `KbStatsHelper` 에서 dead path로 확인된 WebSocket broadcast 블록과 `WebsocketService` 의존성을 제거하는 전형적인 "결합도 감소 + 단일 책임 강화" 리팩토링이다. 아키텍처 관점에서 모듈 경계가 명확해지고 순환 의존 위험이 줄었으며, 클래스가 DB 원자 갱신이라는 단일 책임에 집중하게 되었다. `DataSource` 직접 의존이라는 레이어 경계 이슈가 잠재하나, 원자적 raw SQL 필요성이라는 실용적 근거가 있어 허용 범위 내다. 테스트도 변경된 의존성 구조를 정확히 반영하고 있어 아키텍처 일관성이 높다. 향후 broadcast 재도입 요구가 생길 경우 `refresh()` 반환 타입 확장과 이벤트 발행 책임의 상위 레이어 배치를 사전에 설계해 두면 변경 폭을 최소화할 수 있다.

### 위험도
LOW
