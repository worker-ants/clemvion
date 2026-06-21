# 정식 규약 준수 검토 결과

검토 대상: `spec/4-nodes/4-integration` (5개 파일: `0-common.md`, `1-http-request.md`, `2-database-query.md`, `3-send-email.md`, `4-cafe24.md`)
검토 모드: 구현 착수 전 (--impl-prep)

---

## 발견사항

### [WARNING] `send-email` 성공 포트 ID 가 conventions 기대치와 상이
- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §3.2, §5.1, §6
- **위반 규약**: `spec/conventions/node-output.md` Principle 5, Principle 3.3
- **상세**: `send_email` 노드의 성공 출력 포트 id 가 `out` 이다. `node-output.md` Principle 5 표에는 `send_email` 가 `port: undefined` (기본 단일 출력) 범주로 기술되어 있고, Principle 3.3 의 `error` 포트 보유 노드 목록에 `send_email` 이 포함된다. 그런데 본 spec §3.2 는 성공 포트 id 를 명시적으로 `out` 으로 정의하고 §5.1 JSON 예시에서도 `"port": "out"` 을 표기하며, §6 에서도 "현재 실제 surface: `EMAIL_SEND_FAILED` / ..." 만 열거하고 `port` 키가 `out` 임을 전제한다. 반면 `http_request` · `database_query` 는 성공 포트가 `success` 로 명시되어 있어 Integration 노드 간 일관성이 깨진다. Conventions `node-output.md` §Principle 5 에서 `send_email` 을 `port: undefined` 로 분류한 것이 현행 spec 의 `port: 'out'` 명시와 상충하는지, 또는 conventions 가 이 구별을 실제로 다루지 않는지 명확하지 않다.
- **제안**: (a) conventions 의 Principle 5 표를 갱신해 `send_email` 성공 포트가 `out` 임을 명시하거나, (b) Integration 노드 전체를 성공 포트 `success` 로 통일하는 방향을 결정 후 spec 과 conventions 를 함께 갱신한다. 현재 spec 내부에서 `http_request`/`database_query` 는 `success`, `send_email` 은 `out` 으로 비대칭인 것이 가장 큰 문제이므로 통일 결정이 선행돼야 한다.

---

### [WARNING] `send-email` §5.5 dry-run 출력에 `port` 필드 생략 — 5필드 invariant 명확성 부족
- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §5.5 JSON 예시 및 필드 표
- **위반 규약**: `spec/conventions/node-output.md` Principle 0 (5필드 invariant), Principle 11
- **상세**: §5.5 dry-run JSON 예시에 `port` 필드가 생략되고 표 비고에 "port 는 생략(default out)" 으로 처리됐다. Principle 0 은 `port?` 가 선택적임을 인정하고 Principle 11 은 `undefined` 필드는 JSON 에서 생략한다고 정의하므로 형식적으로는 위반이 아니나, 성공 포트가 `out` 인지 `undefined` 인지 독자가 혼동하지 않도록 "default `out`" 을 명시하는 산문 또는 표 행이 있어야 한다. 현재 "port 는 생략(default out)" 표기는 문서 내 다른 케이스의 일관된 표기 방식과 달리 필드 표 row 가 아닌 비고문으로만 남아 있다.
- **제안**: §5.5 필드 표에 `port` 행을 추가하고 값을 `undefined` (생략), 설명은 "default `out` — 단일 성공 포트" 로 명시한다. Principle 11 의 "undefined 필드 생략" 에 따라 JSON 에는 없어도 표에는 선택적 필드로 기술하는 것이 문서 일관성에 부합한다.

---

### [WARNING] `0-common.md` §3 출력 구조 예시가 `port` 를 `'success'` 로 예시하나 `send_email` 성공 포트와 불일치
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §3 JSON 예시 (`"port": "success"`)
- **위반 규약**: 동일 영역 내 spec 문서 간 일관성 (cross-file) — `spec/conventions/node-output.md` Principle 5, Principle 11
- **상세**: §3 에서 Integration 노드 공통 출력 형식의 예시로 `"port": "success"` 를 제시하나, `send_email` 노드는 성공 포트가 `out` 이다. "Integration 노드 전체 공통 규약" 문서에서 제시한 예시가 노드 중 1개와 충돌한다. 독자가 `send_email` 에도 `success` 포트가 있다고 오해할 수 있다.
- **제안**: §3 예시를 `"port": "<success-port>"` 등 추상 표기로 변경하거나, 주석으로 "`send_email` 는 성공 포트가 `out`" 임을 명시해 불일치를 드러낸다.

---

### [INFO] `0-common.md` 에 `## Rationale` 섹션 없음
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` 문서 전체
- **위반 규약**: `CLAUDE.md` "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- **상세**: CLAUDE.md 는 spec 문서에 Overview / 본문 / Rationale 3섹션 구성을 권장한다. `0-common.md` 에는 Rationale 섹션이 없다. 다른 Integration 노드 문서들(`1-http-request.md` §8, `2-database-query.md` Rationale, `3-send-email.md` §8)은 모두 Rationale 를 포함하고 있어 일관성이 깨진다.
- **제안**: `0-common.md` 에 `## Rationale` 섹션을 추가하고 공통 규약 설계 결정(D4 포트 라우팅 통일 결정, `meta.durationMs` 통일 등)의 근거를 이관 또는 요약한다.

---

### [INFO] `3-send-email.md` §5.4 "Integration stub" 케이스의 `status: 'requires_integration'` 이 `node-output.md` Principle 0 의 `status` 값 목록에 없음
- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §5.4
- **위반 규약**: `spec/conventions/node-output.md` Principle 0, Principle 4.1
- **상세**: Principle 0 은 `status` 의 값으로 `waiting_for_input`, `resumed`, `ended` 등을 예시하며, Principle 4.1 상태 전이 다이어그램에도 이 세 값만 등장한다. `status: 'requires_integration'` 은 이 목록에 없는 값이다. 본 spec §5.4 는 이 값이 "DI 미주입 식별자" 라고 설명하고 "runtime 정상 경로 분기가 아닌 escape hatch" 라고 정당화하지만, conventions 에 이 값이 허용됨이 명시된 바 없다.
- **제안**: conventions `node-output.md` Principle 0 또는 별도 절에 "Integration stub 환경에서 사용하는 internal escape hatch `status` 값 예외" 를 명시하거나, spec 에서 이 동작을 conventions 의 어느 허용 범위 안에 있는지를 참조로 표기한다. 단 이 케이스는 "워크플로 작성자가 직접 마주칠 일이 없는" 내부 경로이므로 INFO 수준이다.

---

### [INFO] `1-http-request.md` §5.3.2 에서 `output.response` 의 `{ error: "ECONNREFUSED" }` 패턴이 Principle 3.2 표준 envelope 와 중복 구조로 문서화
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §5.3.2 JSON 예시, 필드 표 비고
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 (`output.error` 표준 형태), Principle 8.1
- **상세**: transport 실패 시 `output.response = { error: "ECONNREFUSED" }` 와 `output.error.code = 'HTTP_TRANSPORT_FAILED'` 가 동시에 존재한다. 필드 표 비고에 "Deprecated (legacy 호환 잔재) — 신규 코드는 `output.error.{code,message}` 를 SoT 로 사용하고 본 필드에 의존하지 말 것" 이라고 명시되어 있어 spec 내에서 deprecated 임을 인식하고 있다. Principle 3.2 는 에러 정보를 `output.error.*` 단일 경로로 표준화하므로 `output.response.error` 라는 병렬 경로는 spec 을 읽는 독자에게 혼란을 준다.
- **제안**: 이미 deprecated 임이 표기되어 있으므로 규약 위반이라기보다는 레거시 경로가 spec 에 살아있는 상태다. 구현 착수 전 시점에 해당 경로를 삭제하거나 `PLANNED_CLEANUP` 명칭으로 별도 plan 에 등록하는 것을 권장한다. spec 에서 명시적으로 "레거시" 임을 표기한 것은 Principle 3.2 위반 의식이 있으므로 추가 패널티 없음.

---

### [INFO] `4-cafe24.md` 의 `## Overview (제품 정의)` 섹션 표제 형식이 다른 Integration 노드 문서와 다름
- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` `## Overview (제품 정의)` 섹션 표제
- **위반 규약**: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- **상세**: `4-cafe24.md` 는 도입부에 `## Overview (제품 정의)` 섹션을 가지나, 다른 Integration 노드 문서들(`1-http-request.md`, `2-database-query.md`, `3-send-email.md`)은 Overview 섹션을 별도로 두지 않고 intro 단락과 설정 섹션으로 바로 시작한다. CLAUDE.md 가 3섹션을 "권장"하는 수준이므로 강제 사항은 아니나, `cafe24.md` 가 다른 노드 문서보다 제품 정의를 더 풍부히 다루는 이유(`_product-overview.md` 에서 다루지 않는 이중 활용 아키텍처 설명)는 이해 가능하다. 일관성보다는 내용 충실성이 우선 고려사항이므로 INFO 수준.
- **제안**: 다른 Integration 노드 문서에도 Brief overview 단락이 있다면 `## Overview` 표제를 일관 적용하거나, `4-cafe24.md` 의 Overview 섹션 내용을 intro 단락으로 낮추는 방향 중 하나를 선택해 영역 내 통일성을 높인다. 기능적 위반은 없으며 규약 갱신 필요 없음.

---

### [INFO] `2-database-query.md` Rationale 섹션 표제에 `##` 레벨 누락 — 섹션 계층이 다른 문서와 다름
- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` `## Rationale` 섹션 (다른 노드는 `## 8. Rationale` 등 번호 포함)
- **위반 규약**: 영역 내 문서 형식 일관성 (CLAUDE.md 문서 구조 권장)
- **상세**: `2-database-query.md` 의 Rationale 섹션 표제가 `## Rationale` (번호 없음) 인 반면, `1-http-request.md` 는 `## 8. Rationale`, `3-send-email.md` 는 `## 8. Rationale` 로 번호를 포함한다. 소소한 형식 일관성 문제이며 기능적 영향은 없다.
- **제안**: `2-database-query.md` Rationale 표제를 해당 문서의 섹션 번호 체계에 맞게 `## N. Rationale` 형식으로 맞춘다.

---

## 요약

`spec/4-nodes/4-integration` 전체는 `spec/conventions/node-output.md` 의 핵심 Principle(0, 1, 2, 3, 7, 11)을 전반적으로 충실히 참조하고 있으며, D4 결정(port 라우팅 통일), `meta.durationMs` 명명 통일, config echo 명시 열거 의무(Principle 7 D1) 등을 spec 에 정확히 반영하고 있다. 그러나 `send_email` 노드의 성공 포트 id(`out`)가 `http_request`/`database_query`(`success`)와 비대칭이고 이 비대칭이 `node-output.md` Principle 5 에서 명시적으로 정의되지 않아 `0-common.md` §3 공통 예시와도 충돌하는 점이 구현 착수 전 정리가 필요한 가장 유의미한 이슈다. 에러 코드 표기(`UPPER_SNAKE_CASE`)는 모든 문서에서 준수됐고, frontmatter 스키마(`id`/`status`/`code`/`pending_plans`)는 적용 대상 파일 모두에서 준수됐다. `_product-overview.md` 는 `spec-impl-evidence.md §1` 의 밑줄 prefix 면제 대상으로 frontmatter 불필요하며 현행 구조가 맞다. API 문서(Swagger) 규약은 이 spec 파일들에 적용 범위 외(백엔드 컨트롤러/DTO 가 아님)이므로 점검 불해당이다.

---

## 위험도

LOW
