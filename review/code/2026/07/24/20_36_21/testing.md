STATUS=success reviewed 4 files (1 new e2e spec, 2 plan docs, 1 spec convention doc)

# 테스트(Testing) 리뷰 — node-cancellation-propagation e2e

## 발견사항

- **[WARNING]** 하류 노드 상태 단언이 배제(exclusion) 방식이라 예상 밖 상태를 놓칠 수 있다
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:275-276`
    ```
    expect(downstream).not.toBe('completed');
    expect(downstream).not.toBe('running');
    ```
  - 상세: 주석(게이트 271-273)은 "행이 없거나(도달 전), 있더라도 completed 면 안 된다"는 의도를 밝히는데, 실제 코드가 배제하는 값은 `'completed'`/`'running'` 두 개뿐이다. 하류 노드가 어떤 이유로든 실제 dispatch 돼 `'failed'`(또는 `'pending'`/`'queued'` 등 코드베이스가 쓰는 다른 상태)로 끝나는 경우 — 예: 취소 전파와 무관한 별개 버그로 dispatch 후 실패 — 이 두 단언은 모두 통과해 버려 "하류가 실제로 도달하지 않았다"는 핵심 주장이 거짓 양성(false positive)으로 통과한다. `'failed'` 도달은 취소가 dispatch 전에 막았다는 이 테스트의 핵심 주장과 모순되는 신호인데도 잡히지 않는다.
  - 제안: 배제 대신 허용 집합으로 양성 비교. 예: `expect([null, 'cancelled'].includes(downstream)).toBe(true)` (또는 실제 엔진이 dispatch 전 노드에 남길 수 있는 상태 집합에 맞춰 조정). 이 파일이 이미 §"대조군이 vacuous 통과를 잡았다"는 사례를 문서화해 둔 만큼, 같은 vacuity 축(배제 대 포함)을 여기서도 닫아 두는 편이 일관적이다.

- **[INFO]** WS 이벤트(`execution.node.cancelled` / `execution.cancelled`) 발행은 이 e2e 로 검증되지 않음
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts` 전체 (REST 폴링 + `nodeStatus`/`getStatus` 만 사용)
  - 상세: `spec/conventions/node-cancellation.md` §5.1(게이트 107)은 "cancelled 종료 시 `execution.node.cancelled` WS 이벤트를 발행"한다고 명시하는데, 본 e2e 는 REST(`GET /api/executions/:id`)와 DB 직접 조회로만 최종 상태를 관측한다. WS 프로토콜 이벤트 발행 자체(타임라인이 `running` 에 영구 잔류하지 않는지)는 커버 갭으로 남는다. 다만 이 파일의 목적(다단계 전파의 종결 상태)에는 REST/DB 관측으로 충분하므로 스코프 확장 요구는 아니고, 별도 WS 계층 테스트가 존재하는지 확인할 가치가 있다는 수준의 노트.
  - 제안: 이미 WS 이벤트를 커버하는 별도 통합/e2e 테스트가 있는지 확인. 없다면 후속 plan 항목으로 남길 것.

- **[INFO]** 진행 중 창(5s)이 CI 부하 상황에서 이론상 여전히 flaky 할 여지(저위험, 이미 완화됨)
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:57` (`INFLIGHT_WINDOW_MS`), `:246-259` (관측 후 stop 발사 구간)
  - 상세: 폴링이 100ms 주기로 `running` 을 감지한 뒤 `/stop` HTTP 왕복을 쏘는 구조라, 감지~stop 도달 사이에 남은 여유가 이론상 4.9s 이하로 줄어들 수 있다. 매우 부하가 큰 CI(공유 backend-e2e 컨테이너에 다른 e2e 파일들이 동시에 executor 를 점유하는 경우)에서 stop 왕복 자체가 수 초 지연되면 노드가 먼저 완주해 `stop` 이 이미-terminal 실행에 대해 400 을 반환할 잠재적 경합이 남는다. 다만 주석(게이트 47-56)이 이 트레이드오프를 이미 명시적으로 검토했고 30s 타임아웃 대비 5s 창은 상당히 보수적인 마진이라 실질 위험은 낮다.
  - 제안: 별도 조치 불필요. 만약 CI 에서 이 스펙이 드물게 flaky 하다고 관측되면 `INFLIGHT_WINDOW_MS` 상향을 우선 검토.

- **[INFO]** 세 번째 `it`(재-stop 거부)이 첫 번째 `it`과 설정 로직(워크플로 생성 → running 대기 → stop) 을 중복
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:296-322` vs `:240-260`
  - 상세: DRY 관점에서는 공유 헬퍼로 추출 가능하나, 각 `it` 이 자기 완결적이라 격리에는 문제없고 가독성도 나쁘지 않다. 우선순위 낮음.

## 테스트 품질 평가 (긍정적 관찰)

- **비-vacuity 설계가 탁월하다**: 대조군 테스트(`[대조군] stop 하지 않으면...`, 게이트 279-295)가 실제로 초안의 버그(`sourcePort: 'out'` 오기로 엣지가 붙지 않아 하류가 취소와 무관하게 항상 미도달)를 잡아낸 이력이 주석과 plan 문서에 기록되어 있고, 그 대조군이 영구 보존된다. 이는 "무수정 프로브로 전제를 먼저 실증" 하는 모범 사례.
- **결정적 하네스**: 고정 sleep 대신 `node_execution.status='running'` 을 폴링해 관측 후 반응하는 설계로 타이밍 의존 축을 단언에서 제거했다. flaky e2e 의 전형적 실패 패턴(경합 조건에 의존한 sleep 기반 타이밍)을 회피.
- **테스트 격리**: 각 `it` 이 `createTwoStepWorkflow()` 로 독립된 워크플로/실행을 생성하므로 테스트 간 데이터 의존이 없다. `beforeAll` 의 공유 owner/workspace 는 읽기 전용 인증 컨텍스트라 안전.
- **Mock 미사용**: e2e 이므로 실제 API·DB·엔진 dispatch 를 그대로 사용 — 이 시나리오(엔진의 `throwIfAborted()` pre-dispatch 가드)에는 mock 이 오히려 부적절했을 것이므로 적절한 선택.
- **회귀 없음**: 신규 파일이며 기존 테스트에 영향 없음. `spec/conventions/node-cancellation.md` 의 `status: implemented` 전환과 `pending_plans` 제거는 이 e2e 완료를 반영한 문서 동기화로, 코드 관점의 회귀 리스크 없음.

## 요약

이전까지 커버리지 0이었던 "다단계 워크플로우에서 진행 중 노드를 지나 cancel 이 전파되는지" 시나리오를 결정적 하네스(고정 sleep 대신 상태 관측)로 잠갔고, 자신의 초안이 실제로 vacuous 하게 통과했던 이력을 대조군 테스트로 영구 방어하는 등 테스트 엔지니어링 품질이 높다. 유일한 실질 갭은 하류 노드 상태 단언이 배제 방식이라 `'completed'`/`'running'` 외의 예상치 못한 상태(예: 별개 버그로 인한 `'failed'`)를 놓칠 수 있다는 점(WARNING) — 이는 이 테스트가 스스로 정립한 "vacuity 차단" 원칙을 하류 단언에는 완전히 적용하지 못한 잔여 지점이다. 그 외에는 WS 이벤트 미검증·타이밍 마진의 이론적 잔여 flaky 가능성 등 저위험 INFO 수준.

## 위험도

LOW
