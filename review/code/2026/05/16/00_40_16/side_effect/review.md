# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `KbStatsHelper` 생성자 시그니처 변경 — `WebsocketService` 의존성 제거
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` (constructor, L179 기준 diff)
  - 상세: `constructor(private readonly dataSource: DataSource, private readonly websocketService: WebsocketService)` 에서 `constructor(private readonly dataSource: DataSource)` 로 축소됨. `KbStatsHelper` 를 직접 `new` 하는 테스트·코드가 있다면 컴파일 오류 없이 통과할 수 있으나, NestJS DI 컨테이너를 통해 주입하는 모든 호출자(`Module` 의 `providers` 배열)에서 `WebsocketService` 제공을 중단하면 런타임 주입 오류 발생 여지 있음. 단, DI 컨테이너 계층이므로 컨테이너 설정을 올바르게 갱신하면 문제 없음.
  - 제안: `KbStatsHelper` 를 providers 로 등록한 모든 모듈(`KnowledgeBaseModule` 등)에서 `WebsocketService` import/provide 여부를 재검토해 불필요한 의존이 남지 않도록 정리 확인.

- **[INFO]** `refresh()` 반환값 타입 변경 — `rows` 를 로컬 변수에 할당하던 코드 제거
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`, `refresh()` 본문
  - 상세: 기존 구현은 `const rows = await this.dataSource.query<...>(...)` 로 RETURNING 결과를 캡처한 뒤 `entityCount`/`relationCount` 를 추출해 WebSocket emit 에 사용했다. 변경 후에는 쿼리 결과가 완전히 무시(`await` 만 실행)되고 함수는 `Promise<void>` 를 유지한다. 호출자 시그니처(`Promise<void>`)는 동일하므로 외부 계약 파손은 없으나, 향후 호출자가 실행 후 새 카운트 값을 필요로 할 경우 함수 재설계가 필요하다.
  - 제안: 현재 모든 호출자가 반환값을 사용하지 않음을 확인했다면 현 상태가 적절함. 미래 확장성을 위해 RETURNING 결과를 반환하는 형태(`Promise<{ entityCount: number; relationCount: number } | null>`)로 리팩토링하는 것을 고려할 수 있으나, 이는 이번 PR 범위 외.

- **[INFO]** WebSocket 이벤트 emit 제거 — 의도된 부작용 삭제
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`, 기존 L41-49 (diff 기준)
  - 상세: `websocketService.emitExecutionEvent('kb:...', 'kb:graph_stats_updated' as never, {...})` 블록이 삭제됨. 이 이벤트는 `execution:kb:${id}` 채널로 broadcast 되어 frontend 의 `kb:${documentId}` 구독에 도달하지 못하는 dead path 였으므로, 삭제 자체는 실질적 부작용 없음. plan 문서와 JSDoc 주석에 결정 근거가 명확히 문서화되어 있어 추적 가능성이 높음.
  - 제안: 이슈 없음. 삭제 처리가 올바르다.

- **[INFO]** 테스트 파일 신규 추가 — 전역 상태 오염 가능성 점검
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts`
  - 상세: `beforeEach` 에서 매번 새 `jest.fn()` 과 `TestingModule` 을 생성해 테스트 간 상태 공유가 없음. `afterEach`/`afterAll` 에서 명시적 cleanup 이 없으나, `jest.fn()` 은 자동 초기화되고 `TestingModule` 은 스코프 내 소비되므로 전역 오염 위험 없음.
  - 제안: 이슈 없음.

## 요약

이번 변경의 핵심은 `KbStatsHelper.refresh()` 에서 dead-path 였던 WebSocket emit 블록(`emitExecutionEvent` 호출, `WebsocketService` 의존성)을 제거하는 것이다. 부작용 관점에서 실질적으로 문제가 되는 항목은 없다. 시그니처 변경은 NestJS DI 컨테이너를 통한 주입 방식이므로 컨테이너 설정을 함께 갱신하면 런타임 주입 오류를 방지할 수 있으며, 이는 plan의 "WebsocketService import/constructor 의존성 정리" 체크리스트 항목이 커버한다. 반환값을 무시하는 방식(`await` only)은 현재 모든 호출자가 반환값을 참조하지 않으므로 계약 위반이 아니다. 테스트 파일은 격리된 mock 구조로 전역 상태 오염이 없다.

## 위험도

LOW
