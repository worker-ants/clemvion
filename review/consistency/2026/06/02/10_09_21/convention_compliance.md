# 정식 규약 준수 검토 결과

검토 대상: `spec/4-nodes/4-integration/` (0-common.md, 1-http-request.md, 2-database-query.md, 3-send-email.md, 4-cafe24.md) + `spec/conventions/cafe24-api-catalog/` (catalog 파일 다수)
검토 모드: 구현 착수 전 (--impl-prep)
검토 일시: 2026-06-02

---

## 발견사항

### 1. [WARNING] `4-cafe24.md` §4.2 — `config` echo 에 spread 패턴 언급

- target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §4 실행 로직 step 2
- 위반 규약: `spec/conventions/node-output.md` Principle 7 §"config echo 구현 방식 — 명시 enumeration 의무화 (D1)"
- 상세: step 2 는 "Config echo 빌드 (Principle 7): `context.rawConfig` 를 **그대로 spread**" 라고 기술한다. Principle 7 (D1) 는 `{ ...context.rawConfig }` / `{ ...rawConfig, ...overrides }` spread 패턴을 명시적으로 금지하고, 각 비민감 필드를 **명시 enumeration** 으로 나열해 echo 해야 한다고 정한다. spec 이 금지된 구현 방식을 지시하는 형태로 기술되어 있어 구현자가 spread 를 택할 위험이 있다.
- 제안: step 2 를 "Config echo 빌드 (Principle 7): `integrationId` · `resource` · `operation` · `fields` · `pagination` 를 명시 enumeration 으로 echo (spread 금지 — D1). `{{ }}` 표현식은 raw 보존. 자격증명은 echo 금지 — `integrationId` 만 echo." 형태로 수정한다.

---

### 2. [WARNING] `4-cafe24.md` §5 출력 구조 — `meta.callLimit` 타입 불일치

- target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §5.1 출력 구조 표 (`meta.callLimit?`)
- 위반 규약: `spec/conventions/node-output.md` Principle 2 — `meta` 는 실행 메트릭만 담는다. 필드 타입의 형식 일관성 암묵 기대.
- 상세: §4.1 Rate Limit 처리 표에서 `X-Api-Call-Limit` 헤더는 `"현재/상한 (예: 1/40)"` 이고 `meta.callLimit` 으로 보존한다고 기술한다. §5.1 출력 필드 표에서는 `meta.callLimit?` 의 타입이 **`string`** 으로 명시된다. 그런데 같은 표에서 `meta.callUsage?` 는 `number` (%), `meta.callRemain?` 는 `number` (초) 다 — 단위가 일관되게 숫자형인데 `callLimit` 만 `string` (복합 포맷). 이는 Principle 2 의 "실행 메트릭" 필드로서 이질적이고, 소비 코드가 파싱을 별도로 해야 한다. 또한 이 필드가 Principle 2 의 "공통 / HTTP / DB" 필드 분류 표에 없어 non-normative 임이 불명확하다.
- 제안: `meta.callLimit` 이 **informative / 진단 메트릭**임을 명시 주석으로 표시하거나, 타입을 `{ current: number; limit: number }` 구조체로 분리해 파싱을 spec 수준에서 정의한다. 혹은 Principle 2 의 필드 표에 Cafe24 계열 노드용 항목으로 추가해 의도를 공식화한다.

---

### 3. [WARNING] `4-cafe24.md` §2 UI 섹션 — `§9.9` 내부 참조가 전방 참조

- target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §2 설정 UI, line "키는 메타데이터로 고정되므로 사용자가 임의 key 를 추가하는 경로는 없다 (배경: §9.9)."
- 위반 규약: CLAUDE.md 정보 저장 위치 원칙 — 문서 구조 규약 (Overview / 본문 / Rationale 3섹션 순서 권장). 전방 참조는 독자가 §9.9 를 먼저 읽어야 §2 의 의도를 이해하는 역전 의존성을 만든다.
- 상세: §2 는 §9.9 를 전방 참조한다. CLAUDE.md 는 "결정의 배경·근거" 를 해당 spec 문서 끝의 `## Rationale` 에 두도록 권고하고, 구조는 Overview / 본문 / Rationale 3섹션이 권장이다. 본문에서 Rationale 절을 직접 참조하는 것 자체는 관례상 허용이지만, §2 의 기능 기술 문장이 독자로 하여금 §9.9 를 즉시 참조해야 이해될 수 있는 구조라면, 간결한 한 줄 요약 후 참조를 두는 편이 낫다.
- 제안: "(배경: §9.9)" → "(키는 메타데이터로 고정되어 사용자 임의 추가 경로 없음 — 이유: §9.9)" 처럼 본문 자체에서 핵심 이유를 1줄 요약하고 세부는 §9.9 로 위임한다. 또는 §9.9 의 핵심 한 줄을 §2 에 인라인하고 참조를 없앤다.

---

### 4. [INFO] `4-cafe24.md` §6 에러 코드 표 — 프롬프트 내 truncate 로 인한 누락 확인 필요

- target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §6 에러 코드 표 (prompt_file 내 줄 1525 근처 `"` 로 끊김)
- 위반 규약: `spec/conventions/node-output.md` Principle 3.2 / Principle 11 — 에러 코드 enum 과 출력 예시의 완전한 정의 의무.
- 상세: 제공된 입력 payload 에서 §6 에러 코드 표가 `| \`CAFE24_INVALID_MALL_ID\` ...` 행 중간에서 truncate 됐다 (1525행의 백틱 이후 잘림). 원본 파일에서 직접 확인한 결과 §6 표는 완전히 정의되어 있으나, 이 섹션이 입력에서 누락됐기 때문에 spec 본문의 완전성 여부만 INFO 로 기록한다. 실제 파일은 정상.
- 제안: 별도 조치 불필요 (원본 파일 정상 확인).

---

### 5. [INFO] `cafe24-api-catalog/_overview.md` — frontmatter 없음 (제외 대상 확인)

- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 파일 첫 줄
- 위반 규약: `spec/conventions/spec-impl-evidence.md` §1 적용 대상 및 제외 규칙
- 상세: `_overview.md` 는 밑줄 prefix (`_*.md`) 에 해당하므로 spec-impl-evidence 가드의 **제외 대상**이다 — frontmatter 의무 없음. 단, `spec/conventions/` 하위의 resource 카탈로그 파일(`application.md`, `category.md` 등) 은 frontmatter 를 보유하고 있으며 `spec/conventions/**.md` 가 적용 대상이므로 정상. `_overview.md` 의 frontmatter 누락은 규약 위반이 아니다.
- 제안: 조치 불필요.

---

### 6. [INFO] `0-common.md` §3 JSON 예시 — top-level 키가 5필드 초과 여부

- target 위치: `spec/4-nodes/4-integration/0-common.md` §3 공통 출력 구조 JSON 예시
- 위반 규약: `spec/conventions/node-output.md` Principle 0 / Principle 11 — "5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지"
- 상세: §3 의 JSON 예시에는 `{ config, output, meta, port }` 4필드만 있어 5필드 invariant 내에 있다. `status` 필드는 비-블로킹 노드에서 `undefined` 이므로 생략이 Principle 11 ("`undefined` 필드 생략") 과 일치한다. 위반 없음 — INFO 로만 기록.
- 제안: 조치 불필요.

---

### 7. [INFO] `3-send-email.md` §3.2 출력 포트 — port 이름 `out` 사용

- target 위치: `spec/4-nodes/4-integration/3-send-email.md` §3.2 출력 포트 표 (`out` 포트)
- 위반 규약: `spec/conventions/node-output.md` Principle 5 — `port: undefined` 는 "기본 단일 출력 (노드 정의상 outputs 가 1개)" 일 때 사용.
- 상세: Send Email 은 `out` / `error` 두 포트를 갖는다. Principle 5 의 표에서 `send_email` 은 `port: undefined` (기본 단일 출력) 로 분류되어 있다. 그러나 Send Email 은 실제로 `out` 과 `error` 두 포트를 가지므로 `port: string` 형태 (복수 출력 중 하나)가 맞다. Principle 5 의 예시 표에 `send_email` 이 잘못 분류되어 있거나 Send Email 이 단일 포트(implicit)이어야 하는데 `error` 포트가 추가된 경우다.
- 세부 확인: §5.1 에서 `"port": "out"` 이 JSON 예시에 명시되어 있고, 에러 케이스는 `"port": "error"` 다. 반면 Principle 5 는 `send_email` 을 `port: undefined` (단일 출력, outputs 1개) 그룹에 분류한다. 이는 conventions 의 예시 표와 노드 spec 이 일치하지 않는 내적 불일치다.
- 제안: `spec/conventions/node-output.md` Principle 5 의 `port: undefined` 예시 표에서 `send_email` 을 `port: string` 그룹으로 이동하거나, Send Email 의 포트 정의를 재검토한다. conventions 쪽 수정이 필요하면 project-planner 위임.

---

### 8. [INFO] `2-database-query.md` §4 step 8 — Usage 로깅 절 참조 번호 불일치

- target 위치: `spec/4-nodes/4-integration/2-database-query.md` §4 실행 로직 step 8
- 위반 규약: 문서 내부 일관성 (단일 진실 원칙)
- 상세: step 8 는 "Usage 로깅: ... ([공통 §4.1](./0-common.md#41-공통-계약) 단계 6)" 으로 참조한다. 그런데 `0-common.md` 의 해당 절 제목은 `## 4. Handler 실행 세멘틱` 이고 내부에 `### 4.1 공통 계약` 이다. 참조 anchor `#41-공통-계약` 은 Markdown heading에서 생성되는 anchor 로 올바르다. 단, step 6 이 "Usage 로깅" 임을 "(단계 6)" 으로 명시하는 것은 맥락상 맞다.
- 제안: 조치 불필요 (정상).

---

## 요약

`spec/4-nodes/4-integration/` 전체는 `spec/conventions/node-output.md` 의 5필드 invariant(Principle 0), config echo 원칙(Principle 7), 에러 컨트랙트(Principle 3), 출력 문서화 규칙(Principle 11) 을 전반적으로 준수하고 있다. `spec/conventions/spec-impl-evidence.md` 의 frontmatter 스키마도 모든 대상 파일이 적절히 구비하고 있다 (`_product-overview.md` 는 제외 대상). 가장 주의할 사항은 두 가지다: (1) `4-cafe24.md` §4 step 2 가 Principle 7 (D1) 에서 금지한 spread 패턴을 지시하는 형태로 기술되어 있어 구현자를 잘못 유도할 수 있으므로 명시 enumeration 으로 수정 권장(WARNING), (2) `3-send-email.md` 의 `out` 포트와 `spec/conventions/node-output.md` Principle 5 예시 표의 `send_email` 분류(`port: undefined`) 가 불일치하므로 conventions 또는 노드 spec 중 하나를 정렬해야 한다(INFO — conventions 수정 가능성 있으므로 착수 전 확인 권장). 나머지는 모두 규약 범위 내에 있다.

## 위험도

LOW

STATUS: SUCCESS
