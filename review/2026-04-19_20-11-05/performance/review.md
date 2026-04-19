## 발견사항

### [INFO] `config` 전체 echo — 실행 데이터 크기 증가
- **위치**: `spec/4-nodes/6-presentation-nodes.md` (전체 노드 출력 형식 섹션)
- **상세**: Principle 1.1 적용으로 모든 노드의 `NodeHandlerOutput`에 `config` 전체가 echo됨. Carousel의 `items` 배열, Form의 `fields` 배열 등이 크면 `NodeExecution.output_data`에 config + output이 중복 저장됨. 수십~수백 개 아이템을 가진 Dynamic Carousel은 DB 저장 크기가 2배 이상 될 수 있음.
- **제안**: `config` echo 시 대용량 배열 필드(`items`, `rows`, `fields`)는 요약(count only)하거나 별도 컬럼으로 분리 저장 검토. 또는 expression resolver가 `$node["X"].config`를 참조할 때 `NodeExecution.config`가 아닌 `Workflow.nodes[id].config`를 직접 참조하도록 하여 echo 자체를 제거.

---

### [WARNING] `previousOutput` 호환 필드 — 데이터 이중 저장
- **위치**: `spec/4-nodes/6-presentation-nodes.md` — Carousel Resumed 출력 형식의 `output.previousOutput` 필드
- **상세**: `previousOutput`은 Stage 3 전환기 호환용으로 `output.items`·`output.rendered`를 한 번 더 내포함. Carousel이 재개될 때마다 렌더링된 HTML(`rendered`)이 두 벌 저장됨. HTML 렌더링 결과는 수 KB ~ 수십 KB일 수 있어 누적 시 저장 비용이 눈에 띄게 증가함.
- **제안**: Phase 3 제거까지의 기간을 명시적으로 제한하고, `previousOutput`을 null-safe reference(`output.previousOutput = null; // stripped at Phase 3`)로만 유지. 실제 데이터 복사 대신 참조 제거 경로를 엔진에서 보장하면 저장 비용 없이 호환 가능.

---

### [INFO] Migration script 다중 패스 regex — 대규모 DB에서 선형 비용 곱셈
- **위치**: `backend/src/scripts/migrate-node-output-refs.spec.ts` (테스트에서 드러나는 Pass 1~5 구조)
- **상세**: `rewriteExpression`이 동일 문자열에 대해 Pass 1(이중 중첩) → Pass 2(config 이동) → Pass 3(meta 이동) → Pass 4(판별자) → Pass 5(status 통일) 를 순차 적용. 각 Pass가 정규식이라면 표현식당 O(k·n) (k=패스 수, n=문자열 길이). `walkAndRewrite`는 매 노드마다 전체 config/output 트리를 순회하므로 레코드 수 × 트리 크기 만큼의 총 비용이 발생.
- **제안**: 단일 패스 내에서 모든 패턴을 통합한 교체 맵으로 처리 가능한지 검토. `walkAndRewrite`는 구조적으로 문제없으나 DB 배치 크기(현재 미명시)를 명시하고 필요 시 스트리밍 커서 방식으로 메모리 상한 제어.

---

### [INFO] `error-codes.ts` — 성능 문제 없음
- **위치**: `backend/src/nodes/core/error-codes.ts`
- **상세**: `as const` 객체는 V8에서 히든 클래스 최적화가 적용되어 O(1) 조회. `buildErrorEnvelope`는 단순 객체 리터럴 생성으로 hot path가 아님. 성능 이슈 없음.

---

## 요약

이번 변경은 주로 spec 문서 재작성과 migration 유틸리티로, 런타임 hot path 변경이 없어 실행 엔진 성능에 직접적인 영향은 낮다. 다만 Principle 1.1(`config` echo) 적용이 확산되면 `NodeExecution.output_data` 컬럼의 평균 크기가 증가하여 DB 저장/조회 비용에 누적 영향이 생길 수 있다. `previousOutput` 이중 저장은 실체적인 낭비이므로 Phase 3 전환 일정을 단축하거나 엔진에서 즉시 strip하는 방안을 권장한다.

## 위험도

**LOW**