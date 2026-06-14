# 성능(Performance) 리뷰

## 발견사항

- **[WARNING]** `assertFormSubmissionValid` 내 연속 DB 조회 2회 — 이전 리뷰(W-11 BACKLOG) 미해소 반복
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid` 메서드
  - 상세: `nodeExecutionRepository.findOne({ where: { id: nodeExecutionId }, select: { id, nodeId } })` 후 `nodeRepository.findOneBy({ id: nodeExec.nodeId })` 를 순차 실행한다. `continueExecution` 호출 체인에서 `resolveWaitingNodeExecutionId` 가 이미 `NodeExecution` row 를 조회했음에도 `assertFormSubmissionValid` 가 독립적으로 동일 row 를 재조회한다. 이번 리뷰 사이클(21_30_20)의 diff 대상 파일 자체가 이전 사이클에서 이미 W-11 BACKLOG 로 등록된 항목을 포함하므로, 신규 변경이 해당 항목을 다시 도입한 것은 아니다. 단, BACKLOG 미해소 상태로 재배포되는 구조이므로 주의.
  - 제안: (1) 단기: TypeORM `findOne({ where: { id }, relations: { node: true } })` 으로 JOIN 단일 쿼리화. (2) 중기: `resolveWaitingNodeExecutionId` 가 `{ nodeExecutionId, nodeId }` 를 함께 반환하거나 `assertFormSubmissionValid(nodeId, formData)` 로 시그니처를 변경해 이미 조회된 `nodeId` 를 재사용. 별도 태스크 추적 필요.

- **[INFO]** `coerceFormSubmission` — 매 호출마다 신규 `Record<string,string>` 객체 생성
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `coerceFormSubmission` 정적 메서드
  - 상세: `Object.entries(formData)` 루프로 출력 객체를 생성한다. 일반 폼 필드 수(10개 미만)에서 비용은 무시 가능하며 V8 GC 가 빠르게 회수한다. submit_form 자체가 저빈도 사용자 인터랙션 경로이므로 실질적 병목 없음.
  - 제안: 현 시점 최적화 불필요. 필드 수가 수백 이상 되는 시나리오 발생 시 재검토.

- **[INFO]** `coerceFormValue` — 배열 원소별 `JSON.stringify` 호출
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `coerceFormValue` 정적 메서드
  - 상세: 배열 내 비문자열 원소마다 `JSON.stringify(x)` 를 호출 후 콤마 join 한다. multi-select 값은 보통 문자열 배열이어서 실제 `JSON.stringify` 경로 진입 빈도는 낮고, file 메타 배열도 소규모이므로 O(n) 에서 문제없다.
  - 제안: 현 시점 최적화 불필요.

- **[INFO]** `badRequest()` 함수 내 조건부 빈 객체 spread
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `badRequest` 함수
  - 상세: `{ code, message, ...(details ? { details } : {}) }` 는 `details` 없는 경우 빈 객체 spread 를 수행한다. 런타임 비용은 무시 가능하다.
  - 제안: 성능 임계값 미달. 코드 명확성을 위해 `if (details) body.details = details` 패턴으로 교체하는 것은 선택사항.

- **[INFO]** `FormValidationError.toHttpDetails()` — FIRST-only 정책으로 배열 길이 항상 1
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `toHttpDetails()` 메서드
  - 상세: 현재 `details[]` 배열이 항상 길이 1 로 고정된다. `validateFormSubmission` 이 첫 오류만 반환하는 구조이므로 추가 배열 할당 비용은 없다. 복수 오류를 모아서 반환하는 시나리오로 확장할 경우 `validateFormSubmission` 자체가 변경 단위가 되며, 이 레이어는 영향 없다.
  - 제안: 현 구조 유지. 복수 오류 응답 요구사항 발생 시 `form-mode.ts` 의 `validateFormSubmission` 시그니처부터 검토.

- **[INFO]** spec 문서 변경 — 성능 관련 신규 연산 없음
  - 위치: `spec/4-nodes/6-presentation/4-form.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`
  - 상세: 이번 리뷰 사이클(21_30_20)의 diff 에 포함된 spec 파일 변경은 순수 문서 갱신(표 행 추가·주석 정정·Planned 항목 명시)이다. 런타임 연산에 영향을 주는 코드 변경이 없으므로 성능 관점에서 검토 대상 아님.

- **[INFO]** 검증 결과 캐싱 부재 — 동일 form 노드 config 의 반복 제출
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid`
  - 상세: 검증 실패 후 수정 재제출 반복 시 매 호출마다 `nodeRepository.findOneBy` 로 node config 를 DB 에서 읽는다. form 노드 config 는 실행 중 변경되지 않으므로 request 범위(또는 short-lived) 캐시 적용이 가능하다. 이전 리뷰(I-5, NOT FIXED)에서도 지적된 사항이다.
  - 제안: 중장기 최적화로 별도 태스크 관리 권장. NestJS CacheModule 또는 Map 기반 in-memory TTL 캐시 사용. 현 트래픽 수준에서 즉각 조치 불필요.

## 요약

이번 리뷰 사이클(21_30_20)의 diff 는 이전 사이클(21_13_46)의 소스 코드 변경에 대한 consistency review 산출물 및 spec 문서 갱신이 주를 이루며, 실질적인 새 런타임 코드가 추가되지 않았다. 성능 관점에서 신규 위험 요소는 발견되지 않는다. 핵심 이슈인 `assertFormSubmissionValid` 의 순차 DB 조회 2회는 W-11 BACKLOG 로 이미 등록되어 있으며 미해소 상태가 유지되고 있다. submit_form 자체가 사용자 인터랙션 기반 저빈도 호출이어서 현재 트래픽에서 병목이 될 가능성은 낮지만, 이 항목은 별도 태스크로 해소가 권장된다. 알고리즘 복잡도·블로킹 I/O·메모리 누수 관점에서 신규 위험 요소는 없다.

## 위험도

LOW

STATUS=success ISSUES=1
