# 정식 규약 준수 검토 결과

**검토 대상**: `spec/4-nodes/4-integration/` (diff-base: origin/main, scope: 구현 완료 후 검토)
**검토 일시**: 2026-06-11
**참조 규약**: `spec/conventions/node-output.md`, `spec/conventions/error-codes.md`, `spec/conventions/spec-impl-evidence.md`, `spec/conventions/cafe24-api-catalog/_overview.md`

---

## 발견사항

### [INFO] `1-http-request.md` §5.3.2 — `output.response` 에 transport 실패 메시지 보존은 레거시 패턴으로 표시됨
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §5.3.2 테이블, `output.response.error` 행
- **위반 규약**: `spec/conventions/node-output.md` Principle 1 — `output` 은 비즈니스 결과물만 담는다; Principle 8.2 통일 1차 네이밍
- **상세**: `output.response` 가 transport 실패 시 `{ error: <message> }` 형태로 채워지는 것을 "legacy 잔재" 로 명시하면서도 JSON 예시에 그대로 포함하고 있다. `output.error` 가 공식 에러 경로(Principle 3.2)이므로 `output.response.error` 잔재를 출력 예시에 싣는 것은 혼동 여지가 있다. Principle 8.2 의 HTTP 응답 본문 = `output.response` 관용 위치와 충돌하진 않지만, `{ error: "ECONNREFUSED" }` 를 response body 로 쓰는 것은 실제 서버 응답이 아닌 핸들러 합성 값이라 Principle 1 의 "외부 호출 결과 도메인 데이터" 관점에서 경계가 모호하다.
- **제안**: 이미 "legacy 잔재" 임을 명시했으므로 현 수준 유지는 수용 가능. 다만 비고에 "신규 코드는 `output.error` 만 사용" 임을 한 줄 더 명확히 추가하면 Principle 1/8 준수 의도를 더 드러낼 수 있다.

---

### [INFO] `1-http-request.md` §5.1 — `output.requestBody?` 는 Principle 7 경계 문서 표현 불명확
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §5.1 테이블 `output.requestBody?` 행
- **위반 규약**: `spec/conventions/node-output.md` Principle 7, Principle 1.1 (config ↔ output 직교성)
- **상세**: `output.requestBody` 는 "실제 wire 에 나간 평가된 본문" 으로 runtime evaluated 값이라 `output` 배치가 옳다. 그런데 `config.body` 에 raw body 가 그대로 echo 되는 동시에 `output.requestBody` 에 평가 완료 body 가 존재하는 구조는 Principle 1.1.1 의 "런타임에 계산/평가된 값 → `output` 만"과 부합하여 규약 준수다. 다만 `body` / `requestBody` 두 이름이 동일 개념의 raw vs evaluated 쌍임이 표에서 명시적으로 설명되지 않아 독자가 중복으로 오해할 수 있다.
- **제안**: 테이블 `output.requestBody?` 설명란에 "raw config.body 가 expression 평가 완료된 wire 송신 본문 (Principle 7 — config 원본과 직교)" 을 명시. 현재 "실제 wire 에 나간 평가된 본문. 256KB 초과 시 잘림" 수준으로 족하나 Principle 7 cross-link 를 추가하면 규약 소통이 더 명확해진다.

---

### [INFO] `3-send-email.md` §3.2 출력 포트 라벨 — `out` vs `success` 불일치
- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §3.2 출력 포트 표, `id = out`
- **위반 규약**: `spec/conventions/node-output.md` Principle 5 (port 활성화 모델) — 시스템 포트 예약어 `out` 은 허용 목록에 포함됨. HTTP Request 와 Database Query 는 `success` / `error` 를 쓰는 반면 Send Email 은 `out` / `error` 를 쓴다.
- **상세**: Principle 5 의 `port: undefined` 예시 노드에 `send_email` 이 나열돼 있으나, 동시에 §3.2 에서 `out` 포트가 명시된다. Principle 6 예약어 목록에 `out` 이 포함되므로 사용 자체는 금지가 아니다. 다만 통합 노드(HTTP / DB Query) 와 통일되지 않아 워크플로 작성자가 `$node["X"].port === 'success'` 를 관용적으로 쓰려 할 때 send_email 만 `out` 이라 혼동 소지가 있다.
- **제안**: INFO 수준. Principle 5 의 send_email 을 `port: undefined` (기본 단일 출력) 에서 `port: 'out'` 으로 수정하거나, 반대로 send_email 포트를 `success` 로 통일하는 방향을 향후 규약 갱신 트랙에 올릴 수 있다. 현 diff 범위 내 변경 사항은 없으므로 이번 PR 차단 불요.

---

### [INFO] `0-common.md` `id: common` — spec-impl-evidence frontmatter `id` 가 basename 불일치
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` frontmatter `id: common`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §2.1 — "파일 basename(확장자 제외) 기반 권장"
- **상세**: 파일 basename 은 `0-common` 이지만 frontmatter `id` 는 `common` 이다. 규약은 "권장" 이고 명시적으로 "같은 basename 이 영역을 달리해 중복될 때 prefix 로 충돌 회피" 예외를 허용하므로 강제 위반은 아니다. 그러나 `0-common` → `common` 처럼 숫자 prefix 를 제거하는 패턴이 일관성 없이 섞이면 `id` 로 spec 을 식별할 때 혼동 소지가 있다.
- **제안**: 다른 Integration 노드(`1-http-request.md id: http-request`, `2-database-query.md id: database-query`)는 `0-` prefix 만 제거하고 `-` 구분자를 유지하는 패턴이다. `0-common.md` 도 `id: integration-common` 또는 `id: node-integration-common` 으로 구체화하면 flat namespace 충돌을 더 잘 방지한다. 단, 현재 규약 가드(`spec-frontmatter.test.ts`)가 이를 차단하진 않으므로 INFO 수준.

---

### [INFO] `1-http-request.md` §8.2 Rationale — emoji(`⚠️`) 사용
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §8.2 운영 영향 항목
- **위반 규약**: 프로젝트 일반 문서 관행 (CLAUDE.md 등). `⚠️` emoji 가 spec 본문에 인라인으로 사용됨.
- **상세**: 다른 Integration spec 문서 (`3-send-email.md`, `2-database-query.md`) 의 Rationale 섹션은 emoji 를 사용하지 않는다. `spec/conventions/` 에서 emoji 를 명시 금지하는 규약 조항은 없으나 일관성 측면에서 격차가 있다.
- **제안**: `⚠️` → `> ⚠ 운영 영향 (breaking):` 처럼 텍스트 인용구로 대체해 다른 spec 문서와 형식을 맞춘다.

---

### [WARNING] `1-http-request.md` §4.2 Usage 로깅 매트릭스 — 3xx 단독 케이스 누락
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §4.2 Usage 로깅 매트릭스 표
- **위반 규약**: `spec/conventions/node-output.md` Principle 11 (출력 예시 문서화 규칙 — Case 별 분리)의 정신. 표가 실제 코드 동작을 완전히 반영해야 한다는 일관성 요건.
- **상세**: 표의 조건 열에 `3xx · 4xx · 5xx` 가 한 행으로 묶여 `status: 'failed'` / `error.code: HTTP_{status}` 로 기록된다고 명시한다. 그러나 §4 실행 로직 step 9 및 §6 에러 코드 표에 따르면 3xx 는 `authentication='integration'` 에서만 수동 follow 후 한도 초과 시 `HTTP_4XX` 로 surface 되고, `none`/`custom` 인증에서는 3xx 를 그대로 `§5.3` 으로 반환하여 `HTTP_4XX` 로 처리된다고 기술한다. Usage 로깅은 `integration` 인증 한정이므로 3xx 는 `integration` 케이스에서만 `failed` 기록된다 — 이 조건이 표 컬럼 제목(`authentication='integration'` 일 때)에 이미 명시돼 있어 부분 완화되지만, `error.code` 열이 `HTTP_{status}` 라고만 써 `HTTP_4XX`·`HTTP_5XX` 의 실제 enum 값을 숨긴다.
- **제안**: 표의 `error.code` 컬럼을 `HTTP_4XX` / `HTTP_5XX` / `HTTP_TRANSPORT_FAILED` 로 구체화하거나, 3xx-전용 행(redirect 한도 초과 → `HTTP_4XX`)을 별도 행으로 분리하면 §6 에러 코드 표와의 정합이 높아진다.

---

### [WARNING] `1-http-request.md` §5.8 D4 결정 설명 vs `0-common.md` §4.2 에러코드 표 간 `INTEGRATION_SERVICE_UNAVAILABLE` 불일치 해소됐으나 §5.8 문장 잔재
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §5.8, line: `Integration-based authentication is not available in this environment — 내부 환경 오류는 INTEGRATION_SERVICE_UNAVAILABLE 코드로`
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 — `code` 는 `UPPER_SNAKE_CASE`. `spec/conventions/error-codes.md` §1 의미 기반 명명.
- **상세**: diff 를 통해 `0-common.md` 에 `INTEGRATION_SERVICE_UNAVAILABLE` 이 공통 에러코드 표에 추가됐고 `1-http-request.md` §6 에러코드 표에도 일관되게 포함됐다. 그러나 §5.8 에서는 코드 이름을 직접 쓰지 않고 메시지 문자열(`Integration-based authentication is not available in this environment`)을 먼저 적고 `INTEGRATION_SERVICE_UNAVAILABLE` 코드로 표현한다는 식의 이중 표현이 남아 있다. 에러코드 규약(§1)은 코드 이름으로 분기·식별해야 하며 메시지 리터럴을 카탈로그하지 않는다. 메시지 문자열을 spec 에서 직접 인용하면 코드 리팩토링 시 spec 과 코드가 어긋날 리스크가 있다.
- **제안**: §5.8 내 해당 행을 `INTEGRATION_SERVICE_UNAVAILABLE` — IntegrationsService 미주입 또는 workspace context 누락 (§공통 §4.2)` 형식으로 단일화하고 메시지 리터럴은 제거한다.

---

### [WARNING] `3-send-email.md` §5.4 Integration stub 케이스 — `status: 'requires_integration'` 가 Principle 0 5필드 invariant 기준 예외 케이스임을 명시 부족
- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §5.4
- **위반 규약**: `spec/conventions/node-output.md` Principle 0 — `{ config, output, meta?, port?, status? }` 5필드. Principle 11 (출력 예시 문서화 규칙).
- **상세**: §5.4 의 JSON 예시에 `meta` 와 `port` 가 생략되고 `status: 'requires_integration'` 만 있다. Principle 0 는 이 5필드가 "모든 노드 핸들러에서 동일 의미"라고 명시하며, `status` 는 `waiting_for_input` / `resumed` / `ended` 계열 흐름 제어 상태로 정의한다(Principle 4). `requires_integration` 은 이 enum 에 없는 확장 값이다. 본 케이스가 "환경 구성 누락 escape hatch" 임을 §5.4 비고에 설명하지만, Principle 0 의 `status` 의미와의 관계가 문서에서 명확히 해소되지 않는다.
- **제안**: §5.4 비고에 "이 케이스에서 `status` 값 `requires_integration` 은 Principle 0 의 흐름 제어 enum 과 다른 진단 신호이며, 워크플로 실행 엔진이 아닌 DI 환경 진단 목적으로만 사용된다 (Principle 9 의 container overwrite signal 과도 구별 — 본 문서 §5.4 비고 참조)" 와 같은 설명을 추가하거나, 아니면 이 케이스를 `status` 가 아닌 `meta.integrationStub: true` 로 이동하도록 규약 갱신을 고려한다.

---

## 요약

`spec/4-nodes/4-integration/` diff 범위(0-common·1-http-request 중심)의 변경 사항은 정식 규약(`node-output.md`, `error-codes.md`, `spec-impl-evidence.md`)을 대체로 준수한다. 핵심 변경(SSRF 가드 전 인증 공통 적용, `INTEGRATION_NOT_FOUND` 제거 및 `INTEGRATION_CALL_FAILED` 로 fallback 정정, Principle 7 D1 spread 금지 반영)이 모두 해당 규약 조항과 정합하며 Rationale 섹션에 결정 근거가 명시되어 있다. CRITICAL 위반은 없으며, WARNING 2건(Usage 로깅 표 `error.code` 불완전 표현, send_email `requires_integration` status 값의 Principle 0 enum 위탈 해명 미흡)과 INFO 4건이 발견됐다. WARNING 사항들은 다운스트림 시스템의 invariant 를 직접 파괴하지는 않으나, 표와 코드의 불일치로 이어질 수 있어 정정이 권장된다.

## 위험도

LOW

---

STATUS: SUCCESS
