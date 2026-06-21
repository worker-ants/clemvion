# 정식 규약 준수 검토 결과

검토 대상: `spec/4-nodes/4-integration` (0-common.md, 1-http-request.md, 2-database-query.md, 3-send-email.md, 4-cafe24.md, 5-makeshop.md) + `spec/conventions/audit-actions.md`, `spec/conventions/cafe24-api-catalog/_overview.md`, `spec/conventions/cafe24-api-catalog/application.md`, `spec/conventions/cafe24-api-catalog/application/apps.md`

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/4-nodes/4-integration, diff-base=origin/main)

---

## 발견사항

### [WARNING] send_email 성공 포트 `'out'` — Principle 5 의 `send_email` 단일 출력 포트 모델과 충돌

- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §3.2 출력 포트 표, §5.1, §5.3, §5.4, §5.5, §5.8
- **위반 규약**: `spec/conventions/node-output.md` Principle 5 (`port` 활성화 모델)
- **상세**: Principle 5 표에 `send_email` 은 `port: undefined`(기본 단일 출력, outputs 1개 노드) 로 명시된다. 그런데 `3-send-email.md` 는 §3.2 출력 포트 표에 `out` 포트 id 를 정식 등록하고, §5.1 JSON 예시에 `"port": "out"` 을 내보내며, §5.3 에러 케이스엔 `port: 'error'` 를 내보낸다. `send_email` 이 `error` 포트를 가지면 단일 출력 노드가 아니라 복수 출력 노드(`success`/`error` 2포트)로 취급돼야 하므로 Principle 5 의 분류 자체가 맞지 않는다. 규약과 문서 중 하나가 실제 구현을 반영하지 못하고 있다.
- **제안**: (a) 실제 코드가 `port: 'out'` 과 `port: 'error'` 두 포트를 사용한다면, `spec/conventions/node-output.md` Principle 5 표에서 `send_email` 을 "단일 출력(`port: undefined`)" 항목에서 제거하고 복수 포트 항목으로 이동하도록 규약을 갱신한다. (b) 반대로 Principle 5 가 설계 의도이고 `port` 생략이 맞다면, `3-send-email.md` §5.1 의 `"port": "out"` 을 제거하고 `port` 를 undefined(생략)로 정정한다.

---

### [WARNING] `output.rowCount` — Principle 2 의 DB `meta.rowCount` 명세와 충돌

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §5.1, §6.2 본문 표 설명, Rationale 주석
- **위반 규약**: `spec/conventions/node-output.md` Principle 2 (`meta` 는 실행 메트릭만 담는다) — DB 분류 `meta.durationMs`, `meta.rowCount` 나열
- **상세**: `node-output.md` Principle 2 표는 DB 노드에 대해 `meta.durationMs`, `meta.rowCount` 를 명시한다. 그러나 `2-database-query.md` 는 `rowCount` 를 `output.rowCount` 에 두고 `meta` 에는 두지 않는다. 이를 정당화하는 주석("워크플로우 분기(`if rowCount > 0`)의 비즈니스 판단 재료로 사용되어 `output` 에 유지한다 — CONVENTIONS Principle 1 의 실용적 해석, Principle 8.2 표 명시")과 Principle 8.2 표("DB 쿼리 결과 | `output.rows`, `output.rowCount`, `output.fields`, `output.insertId?` (그대로 유지)")가 Principle 2 표와 직접 모순된다. Principle 2 와 Principle 8.2 가 같은 `node-output.md` 내에서 서로 상충한다.
- **제안**: `spec/conventions/node-output.md` Principle 2 표의 `meta.rowCount` 를 삭제하거나 "(단, 2-database-query 는 비즈니스 분기 목적으로 `output.rowCount` 에 배치 — Principle 8.2 참조)"와 같은 각주로 대체해 두 Principle 간 충돌을 해소한다. target `2-database-query.md` 자체는 현행 Principle 8.2 및 실용 해석 주석을 이미 갖추고 있어 규약 갱신 후 정합된다.

---

### [INFO] `0-common.md` 에 `## Rationale` 섹션 없음

- **target 위치**: `spec/4-nodes/4-integration/0-common.md` 전체
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- **상세**: CLAUDE.md 는 spec 문서에 Overview / 본문 / Rationale 3섹션 구성을 권장한다. `0-common.md` 는 본문 섹션만 있고 `## Rationale` 가 없다. 결정의 배경(D4 결정, `meta.durationMs` 명명 통일 근거 등)이 본문 callout 박스에 산문으로 흩어져 있다.
- **제안**: 선택적 개선 — D4 결정 배경, `durationMs` 통일 근거, `api` 식별 정보 의무화 배경 등을 `## Rationale` 섹션으로 분리하면 문서 구조 규약을 완전히 준수한다. 기능적 영향은 없다.

---

### [INFO] `1-http-request.md` 에 `## Overview` 섹션 없음

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` 전체
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- **상세**: `1-http-request.md` 는 `## Rationale` 는 있으나 `## Overview` 가 없다. 반면 `4-cafe24.md` 와 `5-makeshop.md` 는 `## Overview (제품 정의)` 섹션을 갖는다. 같은 Integration 노드 군 내에서 문서 구조가 불일치한다.
- **제안**: 선택적 개선 — `1-http-request.md` 도 제품 정의 한두 문장을 `## Overview` 로 격리하면 같은 영역 내 문서 구조 일관성이 생긴다. 규약 위반의 심각도는 낮다.

---

### [INFO] `3-send-email.md` 에 `## Rationale` 섹션이 §8 으로 번호 부여되어 있음 — Rationale 위치 규약 충족

- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §8
- **위반 규약**: 해당 없음 (규약 준수)
- **상세**: CLAUDE.md 는 Rationale 를 "해당 spec 문서 끝의 `## Rationale`" 로 지정한다. `3-send-email.md` 는 `## 8. Rationale` 로 번호가 붙어 있어 실질적으로 요건을 충족한다. 단 다른 파일(`1-http-request.md` 의 `## 8. Rationale`, `2-database-query.md` 의 `## Rationale`)과 달리 섹션 번호 스타일(번호 유무)이 혼재한다.
- **제안**: 미미한 형식 불일치이므로 수정 필요 없음.

---

### [INFO] `spec/conventions/audit-actions.md` frontmatter `id` — basename 과 일치 (규약 준수)

- **target 위치**: `spec/conventions/audit-actions.md` frontmatter
- **위반 규약**: 해당 없음 (규약 준수)
- **상세**: `id: audit-actions`, `status: implemented`, `code:` 모두 정상이다. 3섹션 구조 (Overview-없는-Overview 대신 `## Overview` 가 존재)도 갖춰져 있다. 기술 명세 섹션과 `## Rationale` 도 완비.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application/apps.md` — frontmatter 가드 면제 대상, 생략 가능한 `id`/`status` 없음 (규약 준수)

- **target 위치**: `spec/conventions/cafe24-api-catalog/application/apps.md` frontmatter
- **위반 규약**: 해당 없음 (규약 준수)
- **상세**: `spec-impl-evidence.md §1` 이 `spec/conventions/<name>-api-catalog/<resource>/**/*.md` 를 frontmatter 가드 면제 대상으로 명시한다. `apps.md` 는 `resource`/`entity`/`cafe24_docs`/`source` frontmatter 를 갖추고 있으며, `id`/`status` 의무 면제에 정확히 해당한다.

---

## 요약

`spec/4-nodes/4-integration` 영역과 연계된 `spec/conventions/` 파일 전반은 규약을 비교적 충실히 이행하고 있다. 프론트매터 필드(`id`/`status`/`code:`), 에러 코드 `UPPER_SNAKE_CASE` 표기, `output.error.{code, message, details?}` Principle 3.2 envelope, `config` echo 명시 enumeration(D1) 등 주요 규약은 준수된다. 단 두 가지 WARNING 이 주목 대상이다: (1) `send_email` 의 성공 포트 `'out'` 이 Principle 5 에서 해당 노드를 `port: undefined` 단일 출력으로 분류한 것과 모순되며, 규약 또는 노드 spec 중 하나를 정정해야 한다. (2) `meta.rowCount` 가 Principle 2 표에는 명시되어 있으나 `2-database-query.md` 는 `output.rowCount` 에 두고 있어 같은 `node-output.md` 내에서 Principle 2 와 Principle 8.2 가 충돌한다. 이 두 항목은 `node-output.md` 규약 자체의 정비가 선결돼야 target 문서와 정합할 수 있다. 문서 구조(Overview/Rationale 3섹션) 면에서 `0-common.md` 와 `1-http-request.md` 는 권장 구조를 일부 생략하고 있으나 기능적 영향은 없다.

## 위험도

MEDIUM
