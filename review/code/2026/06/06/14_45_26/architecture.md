# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### 발견사항 1
- **[WARNING]** 동일 판정 로직이 backend/frontend 두 레이어에 독립 사본으로 존재 — "의도적 중복"이 코드에 구조적으로 강제되지 않음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`reconcilePreParkWaitingStatus`) / `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` (`isNodeWaitingForInput`)
  - 상세: `running|pending` 상태 + `outputData.status==='waiting_for_input'` 조건, terminal 상태 목록(completed/failed/skipped/cancelled) 제외 기준이 두 함수에 각각 하드코딩돼 있다. 단일 책임 원칙(SRP) 관점에서는 각 함수가 자신의 레이어 역할에 집중하므로 위반이 아니나, 개방-폐쇄 원칙(OCP) 측면에서 조건 확장 시 두 곳을 동시에 수정해야 하는 암묵적 결합이 있다. frontend JSDoc(이번 fix에서 `ecc17b15`로 추가됨)에 "backend `reconcilePreParkWaitingStatus` 동기 변경 필요"가 명시됐으나, 역방향(backend 수정 시 frontend 동기 필요) 연결고리가 backend JSDoc에는 없다. 또한 이 명시는 주석 수준이어서 컴파일 타임 강제가 없다.
  - 제안: (1) backend `reconcilePreParkWaitingStatus` JSDoc에도 "이 조건 변경 시 frontend `apply-execution-snapshot.ts:isNodeWaitingForInput` 도 동일 조건으로 변경" 역방향 연결고리 추가. (2) 두 함수가 의도적 중복 방어 계층임을 spec(`spec/5-system/4-execution-engine.md`)에 선언해 주석 외 단일 진실 근거 확보 (spec-update plan에 이미 위임됨). (3) 장기적으로는 두 레이어가 동일 조건 상수를 공유할 수 없는 monorepo 구조상의 한계를 인정하고 e2e 레벨에서 intra-row inconsistency 시나리오를 테스트해 조건 드리프트를 자동으로 탐지하는 방안 검토.

### 발견사항 2
- **[WARNING]** `reconcilePreParkWaitingStatus`의 원본 구현(fix 이전)이 TypeORM 엔티티를 in-place mutation하는 패턴 — 해결 완료 확인 필요
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `reconcilePreParkWaitingStatus`
  - 상세: 이전 리뷰(13_57_06 SUMMARY W4)에서 in-place mutation + snapshotCache 오염 위험이 지적됐으며, `ecc17b15` 커밋으로 `map({...ne, status})` pure function 전환이 이뤄졌다고 RESOLUTION.md에 기록돼 있다. 현재 diff 상의 함수 시그니처는 `NodeExecution[]` 반환 타입을 갖고 `nodeExecutions: reconciledNodeExecutions`로 교체하는 패턴이 적용돼 있다. 이 수정은 ORM identity map 보호와 캐시 오염 방지 측면에서 아키텍처적으로 올바른 방향이다. 다만 `{ ...ne, status: ... }` spread가 shallow copy이므로 `outputData` 등 중첩 객체는 원본 참조를 공유한다. 현재 정규화 로직이 `status` 필드만 교체하므로 실질 문제는 없으나, 향후 `outputData` 필드도 정규화 대상이 될 경우 deep copy 가 필요할 수 있음을 주의해야 한다.
  - 제안: 현재 구현은 적절. JSDoc의 "Pure function: 원본 TypeORM 엔티티를 변이하지 않고" 설명이 shallow copy 한계를 명시하도록 한 줄 보완 권고.

### 발견사항 3
- **[INFO]** `reconcilePreParkWaitingStatus` 가 모듈 파일 최상단 자유 함수로 배치 — 레이어 구조 내 위치 적합성
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` L77 이후 (서비스 클래스 선언 이전)
  - 상세: 이 함수는 서비스 계층의 read-side normalization 책임을 수행하며 서비스 인스턴스 상태(repository, 캐시 등)에 의존하지 않는다. NestJS 모듈 구조에서 자유 함수는 서비스 클래스 메서드가 아니므로 의존성 주입 컨테이너 외부에 있다. 이는 의존성 역전 원칙(DIP) 측면에서 추상화 경계가 약간 모호하지만, 순수 변환 함수를 클래스에 억지로 넣는 것보다 자유 함수가 오히려 설계 의도(클래스 상태와 무관)를 명확히 한다. 레이어 책임 분리(비즈니스 레이어 내 데이터 변환) 관점에서도 서비스 파일 내 배치는 허용 가능하다. 다만 `executions.service.ts` 파일이 커지면 `executions.normalizer.ts` 또는 `node-execution-status.utils.ts`로 추출하면 테스트 독립성과 재사용성이 높아진다.
  - 제안: 현재 규모에서는 즉각 리팩터링보다 향후 후보로 기록. 파일 크기가 임계치(400-500줄)를 초과하는 시점에 추출 검토.

### 발견사항 4
- **[INFO]** `isNodeWaitingForInput` 의 export 범위 — 모듈 경계 캡슐화 약화 가능성
  - 위치: `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` (함수 export)
  - 상세: 주석에 "Internal helpers (also used by `use-execution-events.ts`)"로 명시되어 있으나 `export` 키워드로 패키지 외부에도 노출된다. 인터페이스 분리 원칙(ISP) 관점에서 소비자가 늘어날수록 이 함수의 의미론적 변경(예: 조건 추가) 시 영향 범위가 확대된다. 현재는 `use-execution-events.ts` 한 곳에서 사용되나, barrel(`index.ts`)을 통해 외부에 무분별하게 재노출되는 경우를 방지해야 한다.
  - 제안: `websocket/` 폴더의 barrel에서 이 함수를 re-export하지 않도록 확인. 또는 `use-execution-events.ts`와 공유가 필요한 경우 `websocket/internal/` 하위 모듈로 분리하거나 별도 `node-execution-status.util.ts`로 이동해 명시적 내부 공유 유틸임을 구조로 표현.

### 발견사항 5
- **[INFO]** backend-frontend 정규화 레이어의 책임 경계와 확장성
  - 위치: 양쪽 정규화 함수 전반
  - 상세: 현재 설계는 "backend 1차 정규화 + frontend defense-in-depth 2차" 두 레이어 방어로 올바른 방향이다. 그러나 향후 새로운 blocking 노드 타입이 추가될 때 두 함수 모두를 수정해야 하는 구조다. 현재는 `ne.status` 기반 조건(`running|pending`)으로 노드 타입 무관하게 동작하므로 새 blocking 타입 추가 시 별도 코드 변경이 필요 없다는 점에서 확장성은 양호하다. 단, outputData envelope 구조(`{ status?: unknown }`)가 blocking 노드 간 공통 계약임이 spec에 명시되지 않으면, 다른 형태의 envelope를 가진 노드가 추가될 때 이 조건이 오작동할 수 있다.
  - 제안: spec에 "blocking 노드 핸들러는 반드시 `outputData.status='waiting_for_input'` 봉투를 반환한다"는 계약을 명시해 envelope 구조 표준화를 강제. 이는 위임된 spec-update plan에 포함 권고.

### 발견사항 6
- **[INFO]** e2e 파일 및 channel-web-chat 테스트 변경은 아키텍처 영향 없음
  - 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts`, `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`
  - 상세: e2e 파일은 Prettier 포맷팅 조정만이고, channel-web-chat 테스트는 flaky race condition 수정이다. 아키텍처 구조·의존성·레이어 경계 변화 없음.
  - 제안: 해당 없음.

---

## 요약

이번 변경은 Carousel/Form/AI blocking 노드의 pre-park read window intra-row inconsistency를 read-side normalization으로 처리하는 설계로, 레이어 책임 분리와 단일 책임 원칙 측면에서 각 변경이 자신의 레이어 경계 내에 국한되어 있다. backend는 `findById` 스냅샷 조합 직후에 순수 변환(`reconcilePreParkWaitingStatus`)을 삽입해 DB write를 건드리지 않고, frontend는 `isNodeWaitingForInput` 헬퍼로 동일 불일치를 2차 방어하는 defense-in-depth 구조다. 순환 의존성이나 레이어 역전은 없으며 기존 아키텍처 경계를 준수한다. 주요 아키텍처 리스크는 동일 판정 조건이 두 레이어에 독립 사본으로 존재하고 연결고리가 주석 수준에만 머무른다는 점으로, frontend JSDoc에는 backend 동기 변경 필요가 명시됐으나 backend → frontend 역방향 참조가 없고 컴파일 타임 강제가 없다. 이 의도적 중복을 spec 수준에서 선언하고 e2e로 드리프트를 탐지하는 안전망을 갖추면 장기 유지보수 위험을 구조적으로 통제할 수 있다. pure function 전환(`ecc17b15`)과 enum 상수화는 이미 적용된 것으로 확인되며 방향이 올바르다.

---

## 위험도

LOW

STATUS: SUCCESS
