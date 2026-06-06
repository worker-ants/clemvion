# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### 발견사항 1
- **[WARNING]** `reconcilePreParkWaitingStatus` — 동일 로직이 백엔드와 프론트엔드 양쪽에 중복 구현됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (함수 `reconcilePreParkWaitingStatus`) + `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` (함수 `isNodeWaitingForInput`)
  - 상세: "running/pending 상태인 NodeExecution 의 outputData.status 가 waiting_for_input 이면 waiting 으로 간주" 하는 판정 규칙이 백엔드 서비스 계층과 프론트엔드 스냅샷 적용 레이어에 각각 독립적으로 존재한다. 두 구현은 현재 동일하게 동작하나, 유지보수 시 한쪽만 변경되어 불일치가 발생할 위험이 있다. 특히 `pending` 상태 포함 여부, 봉투 필드 경로(`outputData.status`), terminal 상태 목록 등의 세부 조건이 향후 달라질 수 있다.
  - 제안: 봉투 기반 waiting 판정 로직을 단일 진실(SoT)로 명시적으로 문서화하고, 백엔드 정규화(서버사이드)가 완전하다면 프론트엔드는 ne.status 만 신뢰하도록 단계적으로 일원화를 검토한다. 현재 구조처럼 양측 모두 방어적으로 구현하는 경우라면 spec에 "양측 방어 계층" 전략임을 명시해 의도적 중복임을 선언한다.

### 발견사항 2
- **[WARNING]** `ExecutionsService.findById` 내 `reconcilePreParkWaitingStatus` 가 DB에서 로드된 엔티티 객체를 직접 변경(mutate)함
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` L317 (`reconcilePreParkWaitingStatus(nodeExecutions)`)
  - 상세: 함수 시그니처 `reconcilePreParkWaitingStatus(nodeExecutions: NodeExecution[]): void` 는 in-place mutation을 수행한다. TypeORM 엔티티는 ORM identity map에 의해 관리될 수 있으며, status 필드를 직접 수정하면 캐싱 계층(`snapshotCache`)에 저장된 엔티티 참조의 내부 상태가 의도치 않게 변경되는 위험이 있다. 반환 타입이 `void`이고 side-effect가 있음이 함수 이름만으로 충분히 드러나지 않아 호출자가 원본 엔티티가 변경된다는 사실을 파악하기 어렵다.
  - 제안: pure function 으로 전환 — `nodeExecutions` 배열을 변경하지 않고 정규화된 상태로 매핑한 새 배열을 반환하거나, 함수 이름을 `applyPreParkWaitingStatusNormalization` 등 변경 동작임을 명확히 드러내는 이름으로 바꾸고 JSDoc에 mutation을 명시한다. snapshotCache 저장 이전 단계에서만 호출되는지 확인 필요.

### 발견사항 3
- **[INFO]** `isNodeWaitingForInput` 함수가 `apply-execution-snapshot.ts` 에서 `export` 됨 — 모듈 경계 노출 범위 검토 필요
  - 위치: `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` L345 이하
  - 상세: 파일 하단 "Internal helpers (also used by use-execution-events.ts)" 주석과 함께 `export` 가 붙어 있다. 이는 동일 `websocket/` 패키지 내 `use-execution-events.ts` 에서도 사용하기 위한 것이나, 모듈 외부에서도 임의로 임포트 가능해 캡슐화가 약화된다. 현재는 문제없지만 소비자가 늘어나면 이 함수의 의미론적 변경이 더 많은 사이트에 영향을 준다.
  - 제안: `websocket/` 폴더 내 배럴(`index.ts`)이 있다면 배럴에서 이 함수를 re-export하지 않고 폴더 내 내부 공유용임을 명시한다. 또는 `use-execution-events.ts` 로 함수를 이동하거나, 별도 `node-execution-status.util.ts` 등 공유 유틸 모듈로 분리한다.

### 발견사항 4
- **[INFO]** `reconcilePreParkWaitingStatus` 함수가 모듈 최상단(서비스 클래스 바깥)에 자유 함수로 위치
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` L77 이하
  - 상세: 이 정규화 로직은 `findById` 의 read-side normalization에만 사용되며 서비스 상태에 의존하지 않는다. 자유 함수 배치 자체는 합리적이나, 파일 내 위치가 `ExecutionDetailWithTrigger` 타입 정의 바로 다음이라 모듈 레이아웃이 다소 파편화되어 보인다. `executions.utils.ts` 또는 `node-execution-status.utils.ts` 같은 별도 유틸 파일로 추출하면 향후 재사용성과 테스트 독립성이 높아진다.
  - 제안: 독립성이 높은 순수 변환 로직이므로 별도 유틸 파일로 추출을 고려한다. 단, 현재 규모에서는 큰 문제가 아니므로 즉각 조치보다는 추후 리팩터링 후보로 기록하는 수준이면 충분하다.

### 발견사항 5
- **[INFO]** e2e 파일(`execution-park-resume.e2e-spec.ts`) 변경은 순수 포맷팅(줄바꿈 정리)이며 아키텍처 영향 없음
  - 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts`
  - 상세: diff 내용은 긴 줄을 Prettier 기준으로 분할한 것이 전부다. 기능 로직·의존성 변화 없음.
  - 제안: 해당 없음.

### 발견사항 6
- **[INFO]** `use-widget-eager-start.test.ts` 변경 — 테스트 단언 순서 교정(race condition 수정)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`
  - 상세: `callCount` 를 먼저 기다리고 `executionId` 를 단언하는 순서를 역전해 flaky를 제거했다. `waitFor(() => executionId === 'e2')` 를 먼저 기다리면 callCount 도 이미 2임이 보장된다. 아키텍처 구조 변경은 없고 테스트 올바름 개선만 해당.
  - 제안: 해당 없음.

---

## 요약

이번 변경은 Carousel/Form/AI blocking 노드의 "pre-park window" intra-row inconsistency(NodeExecution.status 컬럼이 아직 `running`이지만 outputData.status가 `waiting_for_input`인 상태)를 read-side normalization으로 처리하는 방향으로 올바르게 설계되었다. 백엔드는 `reconcilePreParkWaitingStatus` 자유 함수를 REPEATABLE READ 트랜잭션 내 스냅샷 구성 직후에 삽입해 DB 쓰기를 건드리지 않는 순수 읽기 측 정규화로 구현했으며, 프론트엔드는 `isNodeWaitingForInput` 헬퍼로 동일 불일치를 방어적으로 처리한다. 레이어 책임 분리와 단일 책임 원칙 측면에서 각 변경은 자신의 레이어 내에 국한되어 있고 교차 레이어 의존성은 추가되지 않았다. 주요 아키텍처 리스크는 두 레이어에 동일 판정 규칙이 중복 존재한다는 점이며, 현재는 의도적인 방어 이중화로 볼 수 있으나 장기적으로 단일 진실 전략을 명시적으로 선언하거나 일원화하는 방향이 바람직하다. 전반적으로 변경 범위는 좁고 기존 아키텍처 경계를 준수하며, 순환 의존성이나 레이어 역전은 없다.

---

## 위험도

LOW
