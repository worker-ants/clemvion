# 성능(Performance) 리뷰

## 발견사항

- **[WARNING]** `assertFormSubmissionValid` 내 연속 DB 조회 2회 (N+1 패턴)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid` 메서드
  - 상세: `nodeExecutionRepository.findOne({ where: { id: nodeExecutionId }, select: { id, nodeId } })` 후 `nodeRepository.findOneBy({ id: nodeExec.nodeId })` 를 순차 실행한다. `continueExecution` 호출 경로에서 이미 `resolveWaitingNodeExecutionId` 가 `NodeExecution` 조회를 수행했음에도 `assertFormSubmissionValid` 가 독립적으로 동일 row 를 재조회한다. submit_form 이 빈번하게 호출되는 hot-path 는 아니지만, 서비스 트래픽 증가 시 불필요한 DB 왕복이 누적된다.
  - 제안: (1) 단기: TypeORM `findOne({ where: { id }, relations: { node: true }, select: { ..., node: { id: true, config: true } } })` 으로 JOIN 단일 쿼리화. (2) 중기: `resolveWaitingNodeExecutionId` 가 `{ nodeExecutionId, nodeId }` 를 함께 반환하거나 `assertFormSubmissionValid(nodeId, formData)` 로 시그니처를 변경해 이미 조회된 `nodeId` 를 재사용. 이전 리뷰(W-11, BACKLOG)에서도 동일 항목 등록됨.

- **[INFO]** 검증 결과 캐싱 부재 — 동일 form 노드 config 의 반복 제출
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid`
  - 상세: 검증 실패 후 수정 재제출 반복 시 매 호출마다 `nodeRepository.findOneBy` 로 node config 를 DB 에서 읽는다. form 노드 config 는 실행 중 변경되지 않으므로 request 범위(또는 short-lived) 캐시 적용이 가능하다. 이전 리뷰(I-5, NOT FIXED)에서도 지적된 사항.
  - 제안: 중장기 최적화로 별도 태스크 관리 권장. NestJS CacheModule 또는 Map 기반 in-memory TTL 캐시 사용. 현 트래픽 수준에서 즉각 조치 불필요.

- **[INFO]** `coerceFormSubmission` — 매 호출마다 신규 `Record<string,string>` 객체 생성
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `coerceFormSubmission` 정적 메서드
  - 상세: `Object.entries(formData)` 루프로 출력 객체를 생성한다. 일반 폼 필드 수(10개 미만)에서 비용은 무시 가능하며 V8 GC 가 빠르게 회수한다.
  - 제안: 현 시점 최적화 불필요. 필드 수가 수백 이상 되는 시나리오 발생 시 재검토.

- **[INFO]** `coerceFormValue` — 배열 원소별 `JSON.stringify` 호출
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `coerceFormValue` 정적 메서드
  - 상세: 배열 내 비문자열 원소마다 `JSON.stringify(x)` 를 호출 후 콤마 join 한다. multi-select 값은 보통 문자열 배열이어서 실제 `JSON.stringify` 경로 진입 빈도는 낮고, file 메타 배열도 소규모이므로 O(n) 에서 문제없다.
  - 제안: 현 시점 최적화 불필요.

- **[INFO]** `badRequest()` 함수 내 조건부 빈 객체 spread
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `badRequest` 함수
  - 상세: `{ code, message, ...(details ? { details } : {}) }` 는 `details` 없는 경우 빈 객체 spread 를 수행한다. 런타임 비용은 무시 가능하다.
  - 제안: 성능 임계값 미달. 코드 명확성을 위해 `if (details) body.details = details` 패턴 교체는 선택사항.

## 요약

이번 변경에서 실질적인 성능 이슈는 `assertFormSubmissionValid` 의 순차 DB 조회 2회다. submit_form 자체가 사용자 인터랙션 기반 저빈도 호출이어서 현재 트래픽에서 병목이 될 가능성은 낮지만, 이전 리뷰(W-11 BACKLOG)에서 이미 등록된 동일 항목이 미해소 상태로 유지되고 있다. JOIN 단일 쿼리 또는 호출 체인에서 이미 확보된 `nodeId` 재사용으로 해소 가능하며 별도 태스크 처리가 권장된다. 나머지 항목(객체 할당, `JSON.stringify` 호출, 캐싱 부재)은 현 규모에서 실질적 병목이 아니며, 알고리즘 복잡도·블로킹 I/O·메모리 누수 관점에서 신규 위험 요소는 발견되지 않는다.

## 위험도

LOW
