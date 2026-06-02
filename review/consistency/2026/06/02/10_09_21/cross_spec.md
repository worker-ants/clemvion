# Cross-Spec 일관성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/4-integration/)
검토 대상: `spec/4-nodes/4-integration/` (0-common.md / 1-http-request.md / 2-database-query.md / 3-send-email.md / 4-cafe24.md)

---

## 발견사항

### [WARNING] Integration 노드 수 "3종" 표기 — 4-cafe24.md 추가 이후 미갱신

- **target 위치**: `spec/4-nodes/4-integration/0-common.md` 관련 문서 헤더 (`[PRD Integration 노드](../_product-overview.md#7-integration-노드-3종)`)
- **충돌 대상**:
  - `/Volumes/project/private/clemvion/spec/4-nodes/_product-overview.md` §7 "Integration 노드 (3종)" (HTTP / Database Query / Send Email 3행만 기재, Cafe24 미기재)
  - `/Volumes/project/private/clemvion/spec/4-nodes/0-overview.md` §2.4 "Integration 노드 (3종)" (동일하게 3행, cafe24 행 없음)
- **상세**: `0-common.md §4.2 D4 결정` 및 §7 출력 구조 색인에서 "Integration 4종 (HTTP / Database Query / Send Email / Cafe24)" 를 명시하며, `4-cafe24.md` 가 실존함에도 상위 `_product-overview.md` 와 `0-overview.md` 는 여전히 "3종"을 제목·절 헤더에 유지하고 Cafe24를 표에서 누락했다. 또한 `0-common.md` 의 관련 문서 링크(`#7-integration-노드-3종`)가 이미 구식 앵커를 가리킨다.
- **제안**:
  - `spec/4-nodes/_product-overview.md` §7 제목을 "Integration 노드 (4종)"으로 수정, Cafe24 요구사항 섹션 추가
  - `spec/4-nodes/0-overview.md` §2.4 제목을 "Integration 노드 (4종)"으로 수정, cafe24 행 추가
  - `0-common.md` 관련 문서 링크를 `#7-integration-노드-4종`으로 갱신

---

### [WARNING] `node-output.md` CONVENTIONS 내 `send_email` 포트 모델 자기 충돌

- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §3.2 출력 포트 (`out` + `error` 이중 포트)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/node-output.md`
  - Principle 3.3 (line 148): "`send_email`은 반드시 `error` 포트를 가져야 한다" — 이중 포트 전제
  - Principle 5 표 (line 267): `send_email`이 `port: undefined` (단일 출력) 범주에 분류됨
- **상세**: CONVENTIONS 내부에서 두 원칙이 직접 모순된다. Principle 3.3은 `send_email`이 `error` 포트를 필수로 가진다고 명시하는 반면, Principle 5 는 `send_email`을 `port: undefined` (기본 단일 출력) 사례로 분류한다. `3-send-email.md` 의 실제 정의(§3.2)는 `out` + `error` 이중 포트로 Principle 3.3에 부합하지만, Principle 5 표와 어긋난다. 또한 `spec/4-nodes/0-overview.md`(line 174)도 `send_email` 출력 열을 "1"로 표기해 이중 포트를 반영하지 않는다.
- **제안**:
  - `node-output.md` Principle 5 표에서 `send_email`을 `port: undefined` 행에서 제거하고, `port: string` 행(`'out'` 또는 `'error'` 중 하나 선택)으로 이동
  - `spec/4-nodes/0-overview.md` §2.4 `send_email` 행의 출력 열을 "2 (out/error)"로 수정
  - `spec/4-nodes/_product-overview.md` §7.3 Send Email 요구사항에 이중 포트 반영

---

### [WARNING] `spec/4-nodes/0-overview.md` — `database_query` 출력 포트 수 불일치

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §3.2 출력 포트 (`success` + `error` 이중 포트)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/0-overview.md` line 173 — `database_query` 출력 열 "1"
- **상세**: `2-database-query.md` 는 D4 결정 이후 `success` / `error` 이중 포트를 명시하며, `node-output.md` Principle 3.3도 `database_query`를 에러 포트 필수 노드로 열거한다. 그러나 `0-overview.md` 표는 출력 수를 여전히 "1"로 표기한다. `http_request`는 동일 표에서 "2 (success/error)"로 올바르게 기재되어 있어 일관성 문제가 더욱 두드러진다.
- **제안**: `spec/4-nodes/0-overview.md` §2.4 `database_query` 행의 출력 열을 "2 (success/error)"로 수정

---

### [INFO] `node-output.md` Principle 5 — `send_email` 성공 포트 ID (`out` vs `undefined`) 명명 동기화

- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §5.1 (`port: 'out'`)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/node-output.md` Principle 5 표 — `send_email`이 `port: undefined` (단일 출력)로 분류
- **상세**: `3-send-email.md`는 성공 포트를 `'out'`으로 명시한다. 반면 `node-output.md` Principle 5는 `port: undefined`로 분류해, 포트 ID 가 `undefined`인지 `'out'`인지 모호하다. 두 명세가 다른 방식으로 "성공" 신호를 표현하므로 expression 접근(`$node["X"].port`)이 `"out"` 또는 `undefined` 중 어느 것을 반환하는지 소비자가 판단할 수 없다. 이는 위 [WARNING] 항목의 심층 원인이기도 하다.
- **제안**: Principle 5 표를 수정해 `send_email`의 성공 포트를 `'out'`으로 명시한 뒤 `port: string` 행으로 이동 (단, 에러 포트 추가 후). Principle 5 의 `port: undefined` 범주 설명을 "outputs 가 1개이며 error 포트도 없는 노드"로 보완해 `transform` / `manual_trigger`와 구분 명확화.

---

### [INFO] `spec/4-nodes/4-integration/0-common.md` §4.1 단계 6 — Usage 로깅 `api` 인자 참조 일관성

- **target 위치**: `0-common.md` §4.1 단계 6 — `logUsage({..., api?})` 호출 규약
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/_product-overview.md` §2.4 INT-US-05 표 (단일 진실 선언) 및 `spec/1-data-model.md` §2.10.1 `IntegrationUsageLog` 정의
- **상세**: `0-common.md`는 `api` 식별 정보를 `logUsage` 에 항상 전달해야 한다고 명시하지만, `_product-overview.md` INT-US-05 표가 각 노드별 `api_label` / `api_method` / `api_path` 채우기 정책의 단일 진실이라고 선언해 두 문서 간 책임 위치가 미묘하게 중복된다. 데이터 모델 §2.10.1의 `api_*` 컬럼 설명도 "통합별 의미는 INT-US-05 표 참조"라고 포워딩한다. 현재 모순은 없지만 향후 새 노드 추가 시 세 곳 모두 갱신이 필요하다는 암묵적 의존이 위험.
- **제안**: `0-common.md §4.1 단계 6`에 "각 노드의 api 식별 정보 채우기 정책은 [INT-US-05](./_product-overview.md#24-사용처-추적-및-라이프사이클) 표가 단일 진실" 문구를 명시적으로 추가해 포워딩 경로를 공식화.

---

### [INFO] `spec/4-nodes/4-integration/0-common.md` §5 캔버스 요약 — Cafe24 행 추가

- **target 위치**: `0-common.md` §5 캔버스 요약 표
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §7 캔버스 요약 — `{resource} · {operation}` (35자 초과 시 잘림) 포맷 정의
- **상세**: `0-common.md` §5 표에 이미 cafe24 행이 포함되어 있어 일관성 위반은 없으나, 표 주석이 Integration 노드를 여전히 열거 없이 "각 노드별 정확한 포맷은 노드별 문서 참조"로만 기술한다. `4-cafe24.md` §7에서 정의된 포맷과의 동기 여부를 자동으로 확인할 방법이 없다. 향후 포맷 변경 시 두 문서 간 drift 위험.
- **제안**: `0-common.md` §5 표에 Cafe24 행이 있는 것은 이미 정상이므로 추가 조치 불필요. 다만 `4-cafe24.md §7`에서 `0-common.md §5`를 단일 진실로 명시적 cross-reference하도록 권장.

---

## 요약

Cross-Spec 일관성 관점에서 `spec/4-nodes/4-integration/` 영역은 D4 결정(에러 포트 단일 경로 통일) 이후의 실질 내용이 비교적 일관되게 기술되어 있다. 그러나 두 가지 주요 동기화 누락이 존재한다. 첫째, Cafe24 노드(4-cafe24.md) 추가 이후 상위 `_product-overview.md`와 `0-overview.md`가 "Integration 노드 3종"을 유지해 카운트 불일치가 발생한다. 둘째, `send_email` 및 `database_query` 의 이중 출력 포트(D4 이후 error 포트 추가)가 `node-output.md` Principle 5 표와 `0-overview.md` 출력 수 컬럼에 반영되지 않아 CONVENTIONS 내부 자기 모순이 생긴다. 이 두 WARNING 항목은 spec 구현 전 정정이 권장된다. API 계약·데이터 모델·상태 전이·RBAC 충돌은 발견되지 않았다.

## 위험도

MEDIUM
