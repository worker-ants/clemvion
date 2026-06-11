# 정식 규약 준수 검토 — `spec/4-nodes/4-integration/1-http-request.md`

검토 모드: spec draft (--spec)
검토 일시: 2026-06-11

---

## 발견사항

### 1. [CRITICAL] `spec/conventions/node-output.md Principle 3.1` 위반 — SSRF/Integration 에러의 포트 라우팅과 Principle 3.1 "Pre-flight 에러 → throw" 간 모순

- **target 위치**: §5.8, §6 에러 코드 표, §4 실행 로직 step 8, Rationale §8.2
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.1
  > Pre-flight 에러 (config 오류, credential 누락, **SSRF 차단 등**) → `throw` → 엔진이 실행 실패로 마킹
- **상세**: Principle 3.1 은 SSRF 차단을 Pre-flight 에러의 예시로 명시해 `throw` 경로로 분류한다. 그러나 대상 문서는 D4 결정에 따라 SSRF 차단(`HTTP_BLOCKED`)과 Integration resolve 실패(`INTEGRATION_NOT_FOUND` 등)를 모두 `port: 'error'` + `output.error.*` 로 라우팅하도록 정의한다. 두 spec 이 동일 에러 조건에 대해 반대 동작을 규정하므로 `node-output.md` Principle 3.1 의 invariant 가 깨진다. `0-common.md §4.2` D4 결정도 동일 변경을 선언하고 있으나 `node-output.md` 는 아직 갱신되지 않았다.
- **제안**: `spec/conventions/node-output.md` Principle 3.1 의 Pre-flight 예시에서 "SSRF 차단 등" 문구를 제거하거나, D4 결정을 반영해 "Integration 노드에서 SSRF 차단 및 Integration 에러는 Runtime 에러(`port:'error'`) 로 처리" 예외 조항을 추가한다. target 문서 변경이 아닌 conventions 갱신이 필요한 케이스다.

---

### 2. [CRITICAL] `spec/4-nodes/4-integration/0-common.md §4.2` 와의 에러 코드 목록 불일치 — `INTEGRATION_NOT_FOUND` / `INTEGRATION_SERVICE_UNAVAILABLE`

- **target 위치**: §5.8 및 §6 에러 코드 표 (`INTEGRATION_NOT_FOUND`, `INTEGRATION_SERVICE_UNAVAILABLE`)
- **위반 규약**: `spec/4-nodes/4-integration/0-common.md §4.2` (공통 에러 코드 SoT)
- **상세**:
  1. target §5.8 과 §6 은 `INTEGRATION_NOT_FOUND` 를 독립 코드로 열거하지만, `0-common.md §4.2` 는 "별도의 `INTEGRATION_NOT_FOUND` 코드는 현재 코드에 존재하지 않는다 — `INTEGRATION_CALL_FAILED` 로 surface 된다" 고 명시한다. target 이 없는 코드를 있는 것처럼 문서화해 클라이언트가 잘못된 코드 분기 로직을 작성할 수 있다.
  2. `INTEGRATION_SERVICE_UNAVAILABLE` 코드는 `0-common.md §4.2` 에 아예 등재되지 않았다. target §5.8 과 §6 에서만 정의되며, 정식 공통 코드 목록과 동기화되지 않았다.
- **제안**: `INTEGRATION_NOT_FOUND` 를 target §5.8 / §6 에서 제거하고 `INTEGRATION_CALL_FAILED` 로 교체(또는 `0-common.md §4.2` 에 코드 실제 추가 후 target 에 반영). `INTEGRATION_SERVICE_UNAVAILABLE` 은 `0-common.md §4.2` 에 공통 코드로 추가하거나, target 가 단독으로 정의하는 코드임을 명시한다.

---

### 3. [WARNING] `spec/conventions/node-output.md Principle 1` 위반 — `output.response.error` legacy 필드가 "비즈니스 결과물 전용" 원칙과 충돌

- **target 위치**: §5.3.2 Transport 실패 JSON 예시, §5.3.2 필드 표 (`output.response.error`)
- **위반 규약**: `spec/conventions/node-output.md` Principle 1 ("output 은 비즈니스 결과물만 담는다"), Principle 8.2 (표준 1차 네이밍)
- **상세**: Transport 실패 시 `output.response = { error: "ECONNREFUSED" }` 형태를 "legacy 호환 잔재" 로 유지한다. 그러나 Principle 1 은 `output` 에 후속 노드가 로직에 사용할 도메인 데이터만 두도록 규정하며, 에러 정보는 `output.error.*` (Principle 3.2)가 SoT 다. 같은 에러 정보가 `output.response.error` (legacy) 와 `output.error` (표준) 두 곳에 동시에 존재하는 것은 Principle 1.1 의 "중복 금지" 방향과도 어긋난다. target 이 이를 명시적으로 "legacy 잔재" 로 인정하고 있어 CRITICAL 은 아니지만, conventions 에 등록된 historical-artifact 는 아니다.
- **제안**: `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` 에 `output.response.error` (transport 실패 legacy 필드) 를 등재해 관리하거나, 제거 계획(`Planned`)을 target 문서에 명시한다. 단기적으로는 target 의 `output.response.error` 필드 표에 "deprecated — `output.error.message` 로 마이그레이션 권장" 을 추가한다.

---

### 4. [WARNING] 문서 구조 규약 — `## Overview` 섹션 누락

- **target 위치**: 문서 최상단 (§1 바로 전)
- **위반 규약**: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장", `spec/conventions/spec-impl-evidence.md §2.1`
- **상세**: target 문서는 `## 1. 설정 (config)` 으로 바로 시작하고 Overview 섹션이 없다. 본문 서두의 한 문장 설명(범용 HTTP 요청 노드 설명 inline 텍스트)이 Overview 역할을 하지만, 공식 `## Overview` 헤딩이 없다. 규약은 Overview / 본문 / Rationale 3섹션을 "권장" 수준으로 정의하고 있어 CRITICAL 은 아니다. 동일 영역의 `0-common.md` 는 Overview 섹션을 보유하고 있어 일관성도 어긋난다.
- **제안**: `# Spec: HTTP Request` 바로 아래, `## 1. 설정 (config)` 앞에 `## Overview` 섹션을 추가하고 현재의 한 줄 설명 + 관련 문서 blockquote 를 그 안으로 이동한다.

---

### 5. [WARNING] `spec/conventions/node-output.md Principle 3.1` 과의 분류 불일치 — SSRF 차단을 "Pre-flight" 에서 "Runtime" 으로 재분류했으나 이름 충돌 미해소

- **target 위치**: §5.8 첫 번째 bullet (`handler.validate()` 실패 — pre-flight)
- **위반 규약**: `spec/conventions/node-output.md` Principle 3 (에러 컨트랙트 통일 — 분류 표)
- **상세**: §5.8 은 `handler.validate()` 실패만 throw (pre-flight) 로 처리하고, `execute()` 안의 모든 에러는 `port:'error'` 로 라우팅한다고 기술한다. Principle 3.1 의 분류 표는 "Pre-flight 에러 (config 오류, **credential 누락**, SSRF 차단 등) → throw" 로 기재되어 있어, target 이 `execute()` 안에서 credential resolve 실패를 `port:'error'` 로 보내는 것도 명목상 Principle 3.1 의 pre-flight 분류(credential 누락)와 충돌한다. 발견사항 1과 연관되나, credential 관련 에러 항목도 Principle 3.1 텍스트에 명시되어 있어 별도 지적이 필요하다.
- **제안**: 발견사항 1 의 conventions 갱신에서 credential resolve 실패(runtime 단계에서 발생하는 INTEGRATION_INCOMPLETE, INTEGRATION_NOT_CONNECTED 등)도 명시적으로 Runtime 에러로 재분류한다.

---

### 6. [INFO] `§5.2` 의도적 공백 절 — Principle 11 출력 예시 문서화 규칙과의 스타일 불일치

- **target 위치**: §5 출력 구조 서두 callout (`절 번호: 성공(§5.1) / 에러(§5.3) 두 케이스만 존재한다. §5.2 는 의도적으로 비어 있다(연번 보존용)`)
- **위반 규약**: `spec/conventions/node-output.md` Principle 11 (출력 예시 문서화 규칙) — 명시적 금지 항목은 없음
- **상세**: Principle 11 은 출력 예시 섹션을 "Case: <케이스 이름>" 단위로 분리하도록 가이드한다. 비어 있는 §5.2 를 "연번 보존용"으로 유지하는 것은 Principle 11 에서 요구하지 않으며, 향후 독자에게 혼란을 줄 수 있다. 현재는 빈 절이 본문에 실제 등장하지 않고 callout 에서만 언급하므로 기계 가드를 깨지는 않는다.
- **제안**: §5.2 는 삭제하고, callout 에서 연번 보존 설명도 제거한다. 케이스 번호 체계가 아닌 서술명("성공" / "4xx·5xx" / "Transport 실패") 으로 sub-heading 을 구분하는 것이 Principle 11 의 의도와 더 부합한다.

---

### 7. [INFO] `§5.8` 절 번호가 §5.3 다음에 비연속 — 문서 구조 일관성

- **target 위치**: `### 5.8 (D4) handler.validate 실패만 throw, 나머지 모두 §5.3 으로 라우팅`
- **위반 규약**: 명시 규약 없음 (INFO)
- **상세**: §5 하위에 §5.1 · §5.3 이 있고 §5.8 이 바로 나온다. §5.4~§5.7 은 없다. §5.2 공백과 마찬가지로 연번 보존 의도로 보이지만 Principle 11 기준 "Case별 분리" 와는 이질적인 절 번호 체계다. §5.8 의 내용은 에러 라우팅 정책이므로 §5 출력 구조 아래에 있기보다 §4 실행 로직의 sub-section 이나 §6 에러 코드 앞에 위치하는 것이 문서 의미 구조에 더 적합하다.
- **제안**: `### 5.8` 을 `### 4.4` 또는 `### 6.1` 로 이동하거나, §5 에 두더라도 `### 5.4` 로 번호를 연속시킨다.

---

## 요약

`spec/4-nodes/4-integration/1-http-request.md` 는 D4 결정(SSRF 차단 및 Integration 에러 → `port:'error'` 라우팅) 을 상세히 반영하고 있으나, 이 변경이 `spec/conventions/node-output.md Principle 3.1` ("Pre-flight 에러 → throw") 의 기존 문언과 직접 충돌한다는 점이 가장 중대한 문제다. 또한 `0-common.md §4.2` 가 "존재하지 않는다" 고 명시한 `INTEGRATION_NOT_FOUND` 코드를 target 문서가 실존 코드처럼 열거해 공통 에러 코드 SoT 와의 불일치가 발생한다. 두 항목 모두 다른 시스템이 가정한 invariant 를 깨거나 클라이언트 분기 로직 오류를 유발할 수 있어 채택 전 conventions 갱신 또는 target 수정이 필요하다. 나머지 항목은 문서 구조 권장 사항 및 legacy 필드 관리 방식에 관한 경고/정보 수준이다.

---

## 위험도

**HIGH**

(CRITICAL 2건 — Principle 3.1 모순, 에러 코드 목록 불일치)
