# Convention Compliance Review

**Target**: `spec/4-nodes/4-integration/` (0-common.md, 1-http-request.md, 2-database-query.md, 3-send-email.md, 4-cafe24.md)
**Mode**: --impl-done (구현 완료 후 검토)
**Reviewer**: convention_compliance sub-agent
**Date**: 2026-06-12

---

## 발견사항

### [INFO] Send Email 출력 포트 id 불일치 — `out` vs `success`
- **target 위치**: `spec/4-nodes/4-integration/0-common.md §7` 색인 표 send_email 행 vs `spec/4-nodes/4-integration/3-send-email.md §3.2`, §5.1
- **위반 규약**: `spec/conventions/node-output.md` Principle 5 포트 활성화 모델 + 문서 내부 단일 진실 원칙 (CLAUDE.md)
- **상세**: `0-common.md §7` 색인 표에서 send_email 정상 케이스를 `§5.1 (success)` 로 표기하지만, `3-send-email.md §3.2` 출력 포트 표와 §5.1 JSON 예시는 포트명을 `out` 으로 정의한다. HTTP Request·Database Query·Cafe24·MakeShop 은 모두 `success` 포트를 사용하여 공통 색인과 정합하나, Send Email 만 `out` 을 유지하고 있어 색인 표기가 거짓이 된다. 다운스트림 노드 작성자가 색인을 기준으로 `port === 'success'` 로 분기 조건을 작성하면 Send Email 에서 의도치 않게 실패한다.
- **제안**: `0-common.md §7` 표의 send_email 행에서 `§5.1 (success)` → `§5.1 (out)` 으로 정정. 또는 포트명을 `success` 로 통일(Breaking Change)하고 `3-send-email.md §3.2`·§5.1·§5.3 을 함께 갱신.

---

### [WARNING] `2-database-query.md` dry-run 케이스 출력 구조 미문서화
- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md §4` Dry-run callout, §5 (dry-run 전용 절 없음)
- **위반 규약**: `spec/conventions/node-output.md` Principle 11 — "Case별로 분리(성공 / 에러 / 재개 등)"
- **상세**: `2-database-query.md §4` callout 에서 dry-run 을 `port: 'success'` + `buildDryRunMock('database_query', { operation, sqlPreview })` 로 단락한다고 기술하지만, §5 출력 구조 섹션에 dry-run 전용 케이스(JSON 예시 + 필드 표)가 없다. `3-send-email.md` 는 §5.5 (Re-run dry-run) 절에 `_dryRun: true`, `skippedReason`, `wouldHaveCalled` 필드를 명시한다. Principle 11 은 케이스별 분리를 요구하므로, dry-run 출력 shape 계약이 문서에서 불명확하다.
- **제안**: `2-database-query.md §5` 에 `§5.5 Case: Re-run dry-run (port success, mock)` 절을 추가하고 `buildDryRunMock` 반환 shape(`_dryRun`, `skippedReason`, `wouldHaveCalled: { kind, operation, sqlPreview }`) 의 JSON 예시 + 필드 표를 문서화.

---

### [WARNING] `1-http-request.md` Transport 실패 `output.response.error` — legacy 잔재 폐기 일정 미명시
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §5.3.2` 필드 표 (`output.response.error` 행), §6 에러 코드 표
- **위반 규약**: `spec/conventions/node-output.md` Principle 8.2 — HTTP 응답 본문은 `output.response`, Principle 11 — 출력 예시 문서화 규칙
- **상세**: `output.response` 는 Principle 8.2 가 "HTTP 응답 본문" 용도로 정의한 필드이나, transport 실패(`HTTP_TRANSPORT_FAILED`) 케이스에서 `{ error: <message> }` 형태의 별개 의미로 재사용된다. spec 은 이를 "legacy 호환 잔재" 로 인정하면서도 현행 출력에 포함하고 `Planned` 제거 표기가 없다. Principle 8 정신(이중/불필요한 중첩 제거)에 어긋나며, 언제 제거할지에 대한 계획이 없어 클라이언트가 계속 이 필드에 의존할 수 있다.
- **제안**: `§5.3.2` 와 §6 에 `output.response` (transport 실패 시) 에 대해 **"Planned: 향후 제거 — `output.error.message` 로 대체"** 명시를 추가하고 관련 plan 항목을 생성. 즉각 제거가 가능하다면 출력에서 제거하고 `output.response` 를 응답 body 전용으로 정합.

---

### [INFO] `cafe24-api-catalog/application/appstore-orders.md` — `order` wrapper 설명 오기입
- **target 위치**: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md`, `GET /api/v2/admin/appstore/orders/{order_id}` 응답 표 및 `POST /api/v2/admin/appstore/orders` 응답 표의 `order` 행 설명
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.2` — "property list 에 없는 wrapper 는 `(응답 객체)` 표기. 추측 주입 금지" 및 §7.3 "docs 에 없는 것은 본 문서에도 없다"
- **상세**: 두 응답 표의 `order` 행 설명이 `"정렬 순서 asc : 순차정렬 · desc : 역순 정렬"` 로 잘못 기입되어 있다. `order` 는 응답 객체 wrapper 이므로 `_overview.md §7.2` 에 따라 `(응답 객체)` 로 표기해야 한다. 같은 entity 파일 내 `## 응답 속성 (Property list)` 에도 `order` wrapper 자체는 없으며, 이 설명은 전혀 다른 맥락에서 잘못 복사된 것이다.
- **제안**: 두 응답 표의 `order` 행 설명을 `(응답 객체)` 로 수정.

---

### [INFO] `0-common.md` Rationale 섹션 부재
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` 전체 구조
- **위반 규약**: CLAUDE.md — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" + Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장
- **상세**: `1-http-request.md` (§8 Rationale), `2-database-query.md` (§ Rationale), `3-send-email.md` (§8 Rationale) 은 Rationale 섹션이 있으나, 공통 규약 문서인 `0-common.md` 는 Rationale 섹션이 없다. D4 결정(§4.2 D4 callout), `meta.durationMs` 통일(§6.1), Usage 로깅 `api` 식별 정보 의무화(§4.1 step 6), Integration 카테고리 에러 코드 체계 등 설계 결정 근거가 본문에 인라인으로 분산되어 있다.
- **제안**: `0-common.md` 끝에 `## Rationale` 섹션을 추가하고 D4 결정, `meta.durationMs` 통일, api 식별 정보 의무화 등 주요 결정 근거를 정리.

---

### [INFO] Frontmatter `id` 값의 숫자 prefix 제거 패턴이 규약에 미명시
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` frontmatter `id: http-request`, `2-database-query.md` `id: database-query` 등 (basename 의 숫자 prefix `1-`, `2-` 제거 후 사용)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `id` 는 "파일 basename(확장자 제외) 기반 권장"
- **상세**: 본 영역의 모든 spec 파일이 숫자 prefix(`0-`, `1-`, `2-` 등)를 제거한 형태로 `id` 를 설정한다. `spec-impl-evidence.md §2.1` 는 basename 기반 권장을 설명하면서 "영역 prefix 로 충돌 회피" 패턴은 인정하나, 숫자 prefix 제거 패턴은 명시하지 않는다. 실질적으로 `spec-frontmatter-parse.ts` 가 이를 오류로 잡지 않는다면 실용적으로 허용된 패턴이나, 규약 문서에는 기술되지 않은 암묵적 관행이다.
- **제안**: `spec-impl-evidence.md §2.1` 에 "숫자 정렬 prefix(`0-`, `1-` 등)는 `id` 에서 제거 가능" 패턴을 명시적으로 허용 패턴으로 추가하거나, 가드 테스트가 통과하는 정확한 규칙을 문서에 반영.

---

## 요약

`spec/4-nodes/4-integration/` 전반은 `spec/conventions/node-output.md` 의 5필드 invariant (Principle 0), config echo 규칙 (Principle 7, D1 — 명시 enumeration 의무화), 에러 envelope 형식 (Principle 3.2 — UPPER_SNAKE_CASE, `output.error.{code, message, details?}`), 에러 포트 라우팅 (Principle 3 D4), 출력 문서화 포맷 (Principle 11)을 대체로 잘 준수하고 있다. D4 결정에 따른 모든 Integration 노드 에러 포트 통일, `meta.durationMs` 명명 통일, SSRF 가드 전 인증 방식 적용, Usage 로깅 `api` 식별 정보 의무화 등 최근 주요 규약 변경도 문서에 충실히 반영되어 있다. 한편 `send_email` 포트명 `out` 과 공통 색인 표기 `success` 의 불일치(INFO), `database-query` dry-run 케이스 출력 구조 미문서화(WARNING), HTTP transport 실패의 `output.response.error` legacy 잔재 폐기 일정 미명시(WARNING), catalog 파일 오기입(INFO) 등이 발견됐다. WARNING 2건은 문서 계약 불명확으로 이어질 수 있어 조기 수정을 권장한다.

## 위험도

LOW
