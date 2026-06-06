# Testing Review

## 발견사항

### 파일 1: executions.service.spec.ts (백엔드 unit)

- **[INFO]** `pending` status 노드의 intra-row inconsistency 케이스 미테스트
  - 위치: 새로 추가된 두 테스트 케이스 (라인 42–91)
  - 상세: `reconcilePreParkWaitingStatus` 는 `PENDING` 과 `RUNNING` 두 status 를 모두 봉투 신호 채택 조건으로 포함하지만 (`ne.status === NodeExecutionStatus.RUNNING || ne.status === NodeExecutionStatus.PENDING`), 테스트는 `running` 케이스만 다룬다. `pending` 상태 노드가 `outputData.status='waiting_for_input'` 을 가진 경우도 함수 내부에서 `waiting_for_input` 으로 정규화하도록 설계됐으므로, 이 경로에 대한 테스트가 없으면 `PENDING` 분기 구현이 실수로 제거되더라도 회귀 가드가 없다.
  - 제안: `status: 'pending'` + `outputData.status='waiting_for_input'` 픽스처로 `nodeExecutions[0].status` 가 `'waiting_for_input'` 인지 검증하는 케이스를 추가한다.

- **[INFO]** `form` / `ai_agent` 노드 타입에 대한 intra-row 정규화 테스트 없음
  - 위치: 새로 추가된 두 테스트 케이스
  - 상세: 두 케이스 모두 `carousel-node` 픽스처만 사용한다. 코멘트에는 "Carousel/Form/AI blocking 노드" 가 모두 동일한 윈도우 문제를 가진다고 명시되어 있으나, `form` 이나 `ai_agent` nodeType 에 대한 대응 케이스가 없어 carousel 전용 회귀 가드처럼 읽힌다. 타입별로 outputData 구조가 달라질 경우 함수의 타입 캐스팅 `(ne.outputData as { status?: unknown } | null)?.status` 이 다른 노드 타입에서도 올바르게 동작하는지 커버되지 않는다.
  - 제안: `form` 또는 `ai_agent` nodeType 으로 동일한 시나리오(running + outputData.status=waiting) 픽스처를 추가하거나, 코멘트에 "노드 타입 무관 — 필드만 체크" 임을 명시해 의도를 드러낸다.

- **[INFO]** 복수 nodeExecutions 혼합 케이스(하나는 running/waiting 봉투, 하나는 completed) 미테스트
  - 위치: 새로 추가된 테스트 라인 42–91
  - 상세: `reconcilePreParkWaitingStatus` 는 배열을 순회하므로 여러 노드 중 일부만 정규화되어야 하는 경우(예: `running+봉투=waiting` 노드 하나 + `completed` 노드 하나)의 선택적 변환이 올바른지 확인하는 케이스가 없다. 현재 테스트는 단일 노드 케이스만 다룬다.
  - 제안: 두 노드 픽스처 배열로 정규화 결과가 타깃 노드만 변환되고 completed 노드는 그대로 유지되는지 검증한다.

---

### 파일 5: apply-execution-snapshot.test.ts (프론트엔드 unit)

- **[INFO]** `ne.status='pending'` + `outputData.status='waiting_for_input'` 봉투 케이스 미테스트
  - 위치: 새로 추가된 세 테스트 케이스(라인 335–438)
  - 상세: `isNodeWaitingForInput` 은 `ne.status === "pending"` 도 봉투 신호 채택으로 처리하지만, 프론트엔드 테스트에서 `pending` 상태에서의 intra-row inconsistency 케이스가 없다. 백엔드 정규화가 통과했더라도 WS snapshot·read-replica·legacy 경로에서는 정규화 이전 데이터가 도달할 수 있으므로, 프론트엔드 방어의 `pending` 분기가 테스트 없이 죽은 코드처럼 존재한다.
  - 제안: `pending` status 노드 + 봉투 waiting 픽스처로 `isNodeWaitingForInput` 통과 → store.status=waiting 으로 격상되는지 케이스 추가.

- **[INFO]** `form` / `ai_agent` 노드의 intra-row inconsistent 케이스 미테스트
  - 위치: 새로 추가된 테스트 케이스(라인 335–438)
  - 상세: 새 intra-row 테스트 3건이 모두 `nodeType: "carousel"` 픽스처다. `isNodeWaitingForInput` 자체는 nodeType 무관하지만, `pauseForForm` / `pauseForConversation` 분기까지 포함한 e2e-style unit 검증이 없다. `form` 노드의 `interactionType: "form"` + intra-row inconsistency 조합에서 올바른 `pauseForForm` 호출로 이어지는지 커버되지 않는다.
  - 제안: `form` nodeType + `meta.interactionType="form"` + `ne.status="running"` + 봉투 waiting 케이스를 추가하거나, 기존 테스트 케이스 코멘트에 "nodeType 무관 — isNodeWaitingForInput 은 status 필드만 참조" 라고 명시한다.

- **[INFO]** `prevStatus='waiting'` 시 wipe 차단 테스트(라인 335)에서 `nodeStatuses` per-node status 검증 누락
  - 위치: 라인 335–368의 첫 번째 intra-row 테스트
  - 상세: 두 번째 케이스(라인 370, prevStatus=running)에서는 `nodeStatuses.get("carousel-node")?.status` 가 `"waiting_for_input"` 인지 검증하는 단언이 있으나, 첫 번째 케이스(prevStatus=waiting, wipe 차단)에서는 per-node status 가 어떻게 갱신됐는지 검증이 없다. wipe 시나리오에서 per-node timeline 배지도 올바른지 검증하지 않는다.
  - 제안: 첫 번째 테스트 케이스에도 `useExecutionStore.getState().nodeStatuses.get("carousel-node")?.status` 단언을 추가한다.

---

### 파일 4: use-widget-eager-start.test.ts (채널 웹챗 unit)

- **[INFO]** 수정된 W8 테스트가 race 수정을 위해 단언 순서를 역전 — 의도가 명확하지만 callCount 단언 위치 문서화 부족
  - 위치: 라인 2291–2292 (diff 기준)
  - 상세: `callCount` 단언이 `waitFor(executionId)` 뒤로 이동했다. 수정 자체는 올바르고 코멘트로 이유가 잘 설명되어 있다. 다만 `callCount` 가 `await waitFor(...)` 후에 동기로 단언 가능한 이유(이미 resolve 완료)를 인라인 코멘트가 잘 설명하므로 읽기에 무리는 없다. 실질적 위험 없음.
  - 제안: 특별한 추가 조치 없음. 현재 코멘트로 충분.

---

### 파일 3: execution-park-resume.e2e-spec.ts (e2e)

- **[INFO]** diff 는 서식 정규화(포매팅)와 단언 배열 인라인화만 — 기능 변경 없음
  - 위치: 전체 diff
  - 상세: `registerAndLogin` 호출과 `expect(finalUserTexts).toEqual([...])` 배열 인라인화만 이뤄졌다. 테스트 로직 변경 없음. 기존 e2e 커버리지는 유효.

---

### 파일 6: apply-execution-snapshot.ts (프론트엔드 구현)

- **[INFO]** `isNodeWaitingForInput` 에 대한 독립 unit 테스트(pure function) 부재
  - 위치: `apply-execution-snapshot.ts` 의 `isNodeWaitingForInput` export 함수
  - 상세: `isNodeWaitingForInput` 이 `export` 로 공개됐으나, `apply-execution-snapshot.test.ts` 에서 이 함수를 직접 임포트해 단위 검증하는 테스트가 없다. 현재는 `applyExecutionSnapshot` 내부 경로를 통해 간접 검증된다. 단일 책임 함수이므로 직접 테스트로 경계값(`status="skipped"`, `outputData=null`, `outputData={}` 등)을 커버하면 회귀 가드가 더 정밀해진다.
  - 제안: `isNodeWaitingForInput` 을 직접 import 해 `status="skipped"`, `outputData=null`, `outputData={}`, `status="failed"` 등 엣지 케이스에 대한 독립 단언을 추가한다.

- **[INFO]** `outputData=null` 이고 `status='running'` 인 노드가 `isNodeWaitingForInput` 에서 false 를 반환하는지 명시 검증 없음
  - 위치: `isNodeWaitingForInput` 함수 / 프론트 테스트
  - 상세: `(ne.outputData as { status?: unknown } | null)?.status` 는 `null?.status` 가 `undefined` 이므로 `false` 를 반환하는 것이 맞다. 그러나 이 null guard 경로에 대한 명시 테스트가 없어, optional chaining `?.` 실수로 제거해도 테스트가 통과될 수 있다.
  - 제안: `outputData: null` + `status: "running"` 픽스처로 `isNodeWaitingForInput` 이 `false` 를 반환하는 케이스를 추가한다.

---

## 요약

이번 변경은 Carousel disabled stuck 회귀에 대한 테스트를 회귀 가드로 선작성(TDD)한 뒤 구현을 추가한 구조다. 핵심 버그 시나리오(running 컬럼 + waiting 봉투, terminal 노드의 stale 봉투)에 대한 Happy/Sad path 쌍이 백엔드·프론트엔드 모두에 추가되어 있고, flaky race 수정(W8 eager-start)도 의도가 코멘트로 문서화되어 있다. 주요 테스트 격리와 mock 적절성은 양호하다. 다만, 두 가지 공통된 커버리지 갭이 있다: (1) `pending` 상태 노드의 봉투 신호 채택 경로가 백엔드·프론트엔드 모두 테스트 없이 구현에만 존재하고, (2) 두 레이어 모두 `carousel` 타입만 픽스처로 사용해 `form`·`ai_agent` 노드 타입의 정규화 경로에 대한 명시 테스트가 없다. 또한 프론트엔드에서 `isNodeWaitingForInput` 공개 함수가 독립 unit 테스트 없이 간접 검증만 받고 있어, `outputData=null` 등 엣지 케이스에 silent regression 위험이 있다. 이들은 기능 동작을 막는 critical 결함이 아니라 회귀 가드 완전성 수준의 문제다.

## 위험도

LOW
