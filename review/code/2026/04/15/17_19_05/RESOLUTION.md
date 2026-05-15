# 코드 리뷰 이슈 조치 내역

리뷰 세션: `review/2026-04-15_17-19-05/SUMMARY.md`
커밋: `cd6463e` (워크플로우 실행 이벤트를 WS 스냅샷 방식으로 전환)

## 조치 완료

| # | 분류 | 이슈 | 조치 |
|---|------|------|------|
| W#4 | Concurrency | 스냅샷과 실시간 WS 이벤트 경쟁 조건 | `handleSnapshot` 노드 반복 처리 시 기존 스토어 상태의 `STATUS_PRIORITY`와 비교(`shouldUpdateStatus`)하여 터미널 상태가 과거 스냅샷으로 덮어써지지 않도록 가드. `use-execution-events.ts` |
| W#5 | Requirement | 실행 중 페이지 재진입 시 `running` 상태 미갱신 | `execution.status === 'running' && prevStatus === 'idle'` 분기를 추가하여 실행 ID·시작 시간으로 스토어 승격. 기존 `nodeResults` 는 보존. `use-execution-events.ts` |
| W#6 | Side Effect | 재구독 시 스냅샷 중복 전송 | `handleSubscribe` 에서 `clientSubs.has(channel)` 로 신규 구독 여부를 먼저 판정한 뒤에만 `emitExecutionSnapshot` 을 예약. `websocket.gateway.ts` |
| W#8 | Testing | `emitExecutionSnapshot` 성공 경로 테스트 부재 | `findById` 가 실행을 반환할 때 `client.emit('execution.snapshot', ...)` 호출 여부를 검증하는 테스트 추가. `websocket.gateway.spec.ts` |
| W#11 | Testing | `running` 스냅샷 수신 무변경 경로 테스트 부재 | 페이로드 없는 스냅샷이 상태를 바꾸지 않는지와, 아이들 → running 승격 케이스를 각각 테스트로 추가. `use-execution-events.test.ts` |
| INFO#1 | Maintainability | `EXECUTION_SNAPSHOT` enum 미사용 | `client.emit(ExecutionEventType.EXECUTION_SNAPSHOT, ...)` 로 교체. `websocket.gateway.ts` |
| INFO#5 | Performance | `localeCompare` 로 ISO 타임스탬프 정렬 | 스냅샷 노드 정렬을 `<` / `>` 비교 연산자로 교체. `use-execution-events.ts` |
| 추가 | Testing | 경쟁 조건 회귀 방지 | "스냅샷이 완료된 노드를 `running` 으로 되돌리지 않음" 테스트 추가. `use-execution-events.test.ts` |

## 의도적 보류

| # | 이슈 | 보류 사유 |
|---|------|-----------|
| W#1, W#2 | 실행 스냅샷·채널 구독 시 소유권 인가 누락 (IDOR) | **사전 존재 이슈**. 기존 REST `GET /executions/:id`, WS `execution:*` 채널 모두 소유권 검증이 없어 본 변경으로 새로 도입된 취약점이 아님. 실행 소유권 모델(워크스페이스 멤버십·공유 규칙 등) 설계가 선행 필요하므로 별도 태스크로 분리 예정. |
| W#3 | `inputData`/`interactionData` WS 이벤트 노출 | **기능 요구사항**. 스냅샷만으로는 구독 이후 시작되는 노드의 입력/상호작용 데이터를 실시간 반영할 수 없어 본 변경의 핵심 목적(REST 폴링 제거)을 달성 불가. 채널 자체가 같은 authn/authz 경계를 공유하므로 추가 노출 표면은 없음(위 W#1/#2 와 같은 근본 원인). 향후 필드 마스킹 정책은 인가 모델 재설계와 함께 검토. |
| W#7 | REST 폴링 제거로 인한 fallback 소실 | 본 변경의 명시적 목표(WS-only). 실환경 모니터링 결과 스냅샷 유실이 관측되면 단발 REST fallback 도입 검토. |
| W#12, W#13 | 스냅샷 전용 DTO, Gateway SRP | 본 PR 범위(최소 변경으로 폴링 제거) 밖. Executions 모듈의 DTO 계층 정비와 함께 후속 리팩토링. |
| W#14, W#15 | 스냅샷 쿼리 캐싱, 페이로드 크기 상한 | 부하·페이로드 규모 측정 선행 필요. 실측 근거 없이 캐시 TTL/상한을 설정하면 오히려 스냅샷 최신성이나 대용량 입력 정상 케이스를 깨뜨릴 수 있어 후속 태스크로 분리. |
| W#16 | `forwardRef` 과잉 사용 | 실제로 `WebsocketModule ↔ ExecutionEngineModule` 양방향 순환이 존재(기존). `WebsocketModule → ExecutionsModule → ExecutionEngineModule → WebsocketModule` 경로가 추가되므로 `forwardRef` 유지가 정당함. |
| W#17, W#18 | 이벤트 페이로드/waiting rehydration 헬퍼 추출 | 중복 호출 지점이 7곳으로 많지만 각 지점의 컨텍스트(어떤 `nodeExec` 스냅샷을 쓰는지, interactionData 를 포함하는지)가 미묘하게 다름. 성급한 추상화 대신 추후 필드가 추가될 때 리팩토링 예정. |
| W#19 | `handleSnapshot` 을 `useCallback` 로 | 현재 이펙트 내부에서만 호출되며 외부 참조되지 않아 `useCallback` 의 메모이제이션 이득 없음. 다른 핸들러는 `useEffect` deps 로 진입하기 때문에 필요했음. 스타일 통일 목적뿐이라 보류. |
| INFO#2 | `finishedAt`/`interactionData` 소비부 부재 | 현재 스토어에는 필드가 없지만, 상세 패널이 향후 `finishedAt`·대화 로그 재생 등을 지원할 때 사용 예정. 페이로드를 먼저 채워두고 UI 는 별도 태스크에서 연결. |
| INFO#3 | `finishedAt?.toISOString?.()` 이중 옵셔널 체이닝 | 런타임 방어 수준. 타입상 `Date | null` 이지만 TypeORM 컬럼이 lazy 이거나 save 직후 Date 반환이 확실치 않은 일부 엔티티 상태에서 안전을 위해 유지. |
| INFO#4 | `inputData` 타입 캐스팅 | JSONB 컬럼의 스키마가 `Record<string, unknown>` 으로 고정되어 있어 엔티티 타입을 먼저 넓혀야 연쇄 수정이 따름. 별도 리팩토링. |
| INFO#6 | `executionId` UUID 검증 | `ExecutionsService.findById` 의 TypeORM 쿼리에서 무효 UUID 는 not found 로 떨어지며 에러는 catch 로 조용히 처리됨. 본 PR 범위 외. |
| INFO#7 | 스냅샷 오류 로그 레벨 | 현재 로직은 존재하지 않는/접근 불가 실행을 동일하게 "스냅샷 생략"으로 처리하므로 `debug` 레벨 유지. W#1 과 함께 인가 에러를 분리하면 `warn` 승격. |
| INFO#8 | spec 문서 미갱신 | 후속 문서 정리 PR 에서 `execution.snapshot`, 확장된 노드 이벤트 필드 명세 추가. |
| INFO#9, #10 | `node_execution(execution_id)` 인덱스 / JSONB 행 크기 | 기존 스키마 범위 이슈, 마이그레이션 체인 검토와 함께 별도 처리. |

## 검증

- backend: `npx jest src/modules/websocket src/modules/execution-engine src/modules/executions` → 848 tests passed
- backend: 전체 `npm test` → 1160 tests passed
- frontend: `npm test` → 562 tests passed (41 files)
- backend: `npx eslint src/modules/websocket/ src/modules/execution-engine/execution-engine.service.ts` → 0 errors on modified files
- frontend: `npm run lint` → clean
- frontend: `npm run build`, backend: `npm run build` → 둘 다 성공
