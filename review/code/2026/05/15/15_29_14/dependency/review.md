### 발견사항

---

**[CRITICAL] 순환 모듈 의존성 — `forwardRef` 가 주입 레벨에만 적용됨**

- 위치: `background-execution.processor.ts:36–38`, `websocket.gateway.ts:60–62`, `executions.module.ts`
- 상세:
  - `ExecutionEngineModule` → `WebsocketModule` (`BackgroundExecutionProcessor`가 `WebsocketService` 주입)
  - `WebsocketModule` → `ExecutionsModule` (`WebsocketGateway`가 `BackgroundRunsService` 주입)
  - `ExecutionsModule` → `ExecutionEngineModule` (`executions.module.ts`에서 `ExecutionEngineModule` import 확인)
  - 결과: `ExecutionEngineModule → WebsocketModule → ExecutionsModule → ExecutionEngineModule` 삼각 순환
  - NestJS에서 `@Inject(forwardRef(() => ...))` 는 *프로바이더* 레벨 순환만 처리. *모듈 imports 배열* 에도 `forwardRef(() => WebsocketModule)` 가 적용되어야 하며, 없으면 런타임에 `Nest can't resolve dependencies` 오류 또는 undefined inject 발생
- 제안: `ExecutionEngineModule`의 imports에 `forwardRef(() => WebsocketModule)` 추가 여부 확인 필수. 근본 해결은 `WebsocketService.emitBackgroundRunEvent`를 별도 `EventEmitter2`/NestJS Event 기반 pub-sub으로 분리해 `ExecutionEngineModule`이 `WebsocketModule`을 직접 참조하지 않도록 구조 개선

---

**[WARNING] `useEffect` 의존성 배열 누락 + eslint-disable 억제**

- 위치: `use-background-run.ts:82` (`// eslint-disable-next-line react-hooks/exhaustive-deps`)
- 상세: `queryClient`와 클로저 내부의 `queryKey`가 effect 의존성에서 제외됨. `queryClient`는 `useQueryClient()`의 안정 참조이므로 실질 오류는 적지만, `queryKey`는 매 렌더마다 새 배열이 생성되어 `invalidateQueries({ queryKey })`가 올바른 쿼리를 무효화하지 못할 수 있음 (`useQuery`의 `queryKey`와 다른 참조)
- 제안: `queryKey`를 `useMemo`로 메모이제이션하거나 `[QUERY_KEY, executionId, backgroundRunId]`를 effect 의존성에 직접 포함. eslint-disable 대신 의존성을 명시적으로 해결

---

**[WARNING] `Notification` 리포지토리 이중 등록 — 모듈 경계 오염**

- 위치: `executions.module.ts:21`
- 상세: `Notification` 엔티티가 `NotificationsModule`과 `ExecutionsModule` 양쪽에서 `TypeOrmModule.forFeature` 등록됨. NestJS는 이중 등록을 허용하지만, `executions` 모듈이 `notifications` 모듈의 엔티티를 직접 소유하는 형태가 됨. `BackgroundRunsService`가 알림 조회를 자체 리포지토리로 처리하면서 `NotificationsService`의 캐싱·비즈니스 로직을 우회할 여지
- 제안: `NotificationsService`에 `findByResourceId(resourceType, resourceId)` 메서드를 추가하고 `BackgroundRunsService`가 이를 호출하는 방식으로 모듈 경계 명확화. `NotificationsModule`을 `ExecutionsModule` imports에 추가

---

**[WARNING] `BackgroundRunsService.exports` — 불필요한 public export**

- 위치: `executions.module.ts:32` (`exports: [ExecutionsService, BackgroundRunsService]`)
- 상세: `BackgroundRunsService`를 export하는 유일한 목적이 `WebsocketGateway`의 채널 구독 권한 검증(`verifyBackgroundRunOwnership`)임. 이를 위해 service 전체를 외부 모듈에 노출하는 것은 과도한 공개 — websocket 모듈이 executions 도메인 서비스에 직접 의존하는 결합이 생김
- 제안: 권한 검증 인터페이스만 분리(`IBackgroundRunOwnershipChecker`)하거나, websocket gateway의 가드 로직을 NestJS Guard/인터셉터로 옮겨 도메인 서비스 직접 참조를 제거

---

**[INFO] 신규 외부 패키지 없음 — 기존 의존성 재활용**

- 위치: 전체 변경사항
- 상세: 모든 신규 import가 기존 프로젝트 의존성(`@nestjs/*`, `typeorm`, `@nestjs/swagger`, `lucide-react`, `@tanstack/react-query`) 또는 내부 모듈. `package.json` 변경 없음
- 제안: 없음

---

**[INFO] V047 마이그레이션 — `executeInTransaction=false` 올바른 적용**

- 위치: `V047__node_execution_background_run_id_index.conf`
- 상세: `CREATE INDEX CONCURRENTLY`는 PostgreSQL에서 트랜잭션 외부에서만 실행 가능. Flyway `.conf` 파일로 올바르게 분리. 표준 패턴
- 제안: 없음

---

### 요약

이번 변경의 의존성 관점 가장 큰 위험은 **삼각 순환 모듈 의존성**이다. `ExecutionEngineModule` → `WebsocketModule` → `ExecutionsModule` → `ExecutionEngineModule` 구조가 형성되며, 생성자 레벨 `forwardRef` 만으로는 NestJS 모듈 그래프의 순환을 해결할 수 없어 런타임 DI 실패 가능성이 있다. 신규 외부 패키지 추가는 없고 기존 스택을 잘 재활용했으나, WebSocket 이벤트 발행을 위해 `ExecutionEngineModule`이 `WebsocketModule`을 직접 참조하는 구조는 `EventEmitter2` 기반 이벤트 pub-sub으로 분리해야 장기적으로 안정적이다. `Notification` 리포지토리 이중 등록과 `BackgroundRunsService` 전체 export도 모듈 경계를 흐리는 부분으로 점진적 정리가 필요하다.

### 위험도

**HIGH**