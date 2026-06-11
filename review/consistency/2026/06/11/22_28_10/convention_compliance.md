# 정식 규약 준수 검토 결과

**Target**: `spec/4-nodes/4-integration/1-http-request.md`
**검토 모드**: spec draft 검토 (--spec)
**검토일**: 2026-06-11

---

## 발견사항

### 1. **[CRITICAL]** Principle 7 금지 패턴 — `spread` 명문화

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §4 실행 로직 step 2 (line 85)
- **위반 규약**: `spec/conventions/node-output.md` Principle 7 "Config echo 구현 방식 — 명시 enumeration 의무화 (D1)" — "❌ 금지 — spread 패턴: `{ ...context.rawConfig }` 또는 `{ ...context.rawConfig, ...overrides }` 형태로 echo 하지 않는다."
- **상세**: 해당 줄은 `"context.rawConfig 를 그대로 spread + url 만 sanitizeUrlCredentials 결과로 교체"` 라고 기술한다. 이는 `{ ...context.rawConfig, url: sanitizeUrlCredentials(...) }` 패턴을 spec 이 정식 동작으로 기술·묵인하는 것이다. Principle 7 D1 은 이 패턴을 세 가지 이유(credential leak 위험·회귀 감지 곤란·dead field echo)로 **명시 금지**하고 명시 키 enumeration 을 의무화한다. spec 이 금지 패턴을 정상 동작으로 설명하면, 구현 검토자가 이를 정합적 구현으로 오인하고 Principle 7 준수 여부 검증을 우회할 수 있다.
- **제안**: step 2 를 다음과 같이 수정한다 — "Config echo 빌드 (Principle 7): 비민감 필드를 **명시 열거**하여 echo (spread 패턴 금지 — Principle 7 D1). `url` 은 `sanitizeUrlCredentials` 결과로, 나머지 비민감 필드(`method`/`authentication`/`integrationId`/`headers`/`queryParams`/`body`/`bodyType`/`responseType`/`timeout`/`followRedirects`/`verifySsl`)는 `context.rawConfig` 에서 각각 직접 참조한다."

---

### 2. **[WARNING]** `§105` 불명확 자기참조 — 하이퍼링크 없는 bare 섹션 번호

- **target 위치**: line 96 (§4 step 8), line 354 (§8.2 Rationale), line 358 (§8.2 Rationale) — 총 4회
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §4.2 `spec-link-integrity.test.ts` 가드 기준 — in-repo 링크는 `[텍스트](경로)` 형식으로 anchor 포함 표기 의무. `spec/4-nodes/4-integration/1-http-request.md` 에는 `## 10` 또는 `## 105` 섹션이 존재하지 않으며, 동일 파일 내에 참조 대상이 없다. 다른 통합 노드 spec(`4-cafe24.md`, `5-makeshop.md`)은 동일한 "§10.5 토큰 자동 갱신" 개념을 `[통합 §10.5](../../2-navigation/4-integration.md#105-토큰-자동-갱신)` 형식으로 정확히 링크한다.
- **상세**: `§105` 는 `spec/2-navigation/4-integration.md` 의 `## 10.5 토큰 자동 갱신` 이 아니라, 본 문서 자체의 `ALLOW_PRIVATE_HOST_TARGETS` 정책 설명 단락을 가리키는 자체 문서 내 섹션 번호처럼 보이지만 실제 해당 heading 이 없다. 독자와 가드 모두에게 대상이 불명확하다.
- **제안**: (A) `ALLOW_PRIVATE_HOST_TARGETS` 정책을 이 문서 내에서 별도 named section(예: `### SSRF opt-out: ALLOW_PRIVATE_HOST_TARGETS`)으로 승격시켜 anchor 링크 가능하게 하거나, (B) 외부 cross-cutting 정책 문서(`spec/5-system/` 등)로 이전하고 Markdown 링크로 참조하거나, (C) 현재 §4 본문 callout block(`> ALLOW_PRIVATE_HOST_TARGETS ...`)이 SoT 이므로 `§105` 표기를 제거하고 "위 §4 callout 참조" 로 대체한다. 어느 방법이든 bare `§105` 표기는 삭제한다.

---

### 3. **[WARNING]** §5 섹션 번호 불연속 — §5.4~§5.7 설명 없음

- **target 위치**: `## 5. 출력 구조` 내 — `### 5.3` 다음이 `### 5.8` (line 313)
- **위반 규약**: `spec/conventions/node-output.md` Principle 11 문서화 규칙은 Case별 분리를 권장하며, 암묵적 섹션 번호 비약은 독자에게 누락 케이스가 있을 것이라는 오해를 준다. CLAUDE.md 의 "문서 구조 규약" 관점에서도 설명 없는 번호 비약은 문서 완결성에 반한다.
- **상세**: `§5.2` 비약은 본문 callout에서 "의도적으로 비어 있다(연번 보존용)" 라고 명시해 납득 가능하다. 그러나 `§5.4`~`§5.7` 비약은 설명이 없다. `§5.8` 은 "(D4)" 결정 내용이라 히스토리 맥락 섹션으로 성격이 다르지만 why-5.8 근거가 없다. 독자가 "5.4~5.7 케이스가 존재하는가?" 를 직접 확인해야 한다.
- **제안**: `§5` 서두 callout 에 "§5.4~§5.7 은 현재 정의되지 않는다(연번 예약)" 를 추가하거나, `§5.8` 을 `§5.4` 로 재번호 매기고 하단에 "(구 번호: D4 결정 이전 §5.8 에서 이동)" 주석을 달아 연번을 정합시킨다.

---

### 4. **[INFO]** `output.response` transport 실패 legacy 패턴 — 수정 계획 미명시

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §5.3.2 (line 297 표, line 335 §6 에러 코드 표)
- **위반 규약**: `spec/conventions/node-output.md` Principle 1 — "output 은 비즈니스 결과물만 담는다" / Principle 8.2 — HTTP 응답 본문 → `output.response` (관용적). Transport 실패 시 실제 HTTP 응답이 없는데 `output.response = { "error": "<message>" }` 를 두는 것은 `output.response` 의 의미(HTTP 응답 body)를 오염시킨다. spec 은 이를 "legacy 호환 잔재" 라 칭하면서도 Planned 수정 계획이 없다.
- **상세**: `followRedirects`, `verifySsl`, `binary` responseType 은 모두 "(Planned)" 딱지를 달고 명시적 미구현 상태가 기록된다. 이 legacy `output.response` 패턴도 동일하게 "(Planned: 제거 또는 `output.rawError`로 이동)" 수준의 처분 방향이 없으면, 향후 구현 시 spec 과의 정합 판단이 어렵다.
- **제안**: §5.3.2 의 `output.response.error` 설명에 `(Planned: transport 실패 시 `output.response` 는 제거 예정 — `output.error` 만 사용)` 주석을 추가하거나, 별도 plan 연결을 명시한다.

---

### 5. **[INFO]** §5 출력 예시 — `HTTP_BLOCKED` / `INTEGRATION_*` 에러 케이스 JSON 예시 없음

- **target 위치**: `## 5. 출력 구조` — `HTTP_BLOCKED`, `INTEGRATION_NOT_FOUND`, `INTEGRATION_SERVICE_UNAVAILABLE` 에 대한 JSON 예시 없음
- **위반 규약**: `spec/conventions/node-output.md` Principle 11 — "Case별로 분리 (성공 / 에러 / 재개 등)"
- **상세**: §6 에러 코드 표에는 D4 신설 에러 코드(`HTTP_BLOCKED`, `INTEGRATION_*`, `INTEGRATION_SERVICE_UNAVAILABLE`)가 목록화되어 있고 `output.response = —`, `output.responseHeaders = —`, `meta.statusCode = 0` 등이 기재된다. 그러나 §5.3 에는 이 케이스의 JSON 예시가 없다. §5.3.2 (transport 실패) 와 달리 SSRF 차단 / Integration 실패 케이스는 JSON schema 가 다를 수 있어 Principle 11 준수 관점에서 케이스 분리가 권장된다.
- **제안**: §5.3 에 `#### 5.3.3 SSRF 차단 / Integration 에러 (HTTP_BLOCKED · INTEGRATION_*)` 소절을 추가하고 최소 JSON 예시 1개를 삽입한다. 분량 문제면 §6 에러 코드 표를 §5.3 에서 직접 링크하는 것으로 대체 가능.

---

## 요약

`spec/4-nodes/4-integration/1-http-request.md` 는 전반적으로 `spec/conventions/node-output.md` 의 5필드 invariant, Principle 7 echo 원칙, Principle 3 에러 컨트랙트, Principle 11 문서화 규칙을 상당히 준수한다. SSRF 가드 전 인증 방식 공통 적용이라는 변경 내용(§8.2 Rationale)도 decision/rationale 구조를 갖춰 기술된다. 그러나 **CRITICAL 1건**: Principle 7 의 `spread` 금지 패턴이 spec 본문에 정상 구현 방식으로 명문화돼 있어 규약 직접 위반 상태이며, 구현 검토자의 준수 가드를 무력화할 수 있다. **WARNING 2건**: `§105` bare 참조는 anchor 없는 dead 참조로 link-integrity 가드가 추적 불가능하고, §5 섹션 번호 비약(5.4~5.7)은 케이스 누락 오해를 유발한다. **INFO 2건**: legacy transport failure 응답 패턴의 처분 계획 미명시, D4 신규 에러 케이스 JSON 예시 부재.

---

## 위험도

**MEDIUM** — CRITICAL 발견(Principle 7 spread 금지 패턴 정상화)이 1건 있으나, 이것이 spec 문서의 텍스트 표현 문제이지 다른 시스템의 invariant 를 즉시 깨는 것은 아니다. 단, 구현 코드 리뷰에서 이 spec 설명을 근거로 spread 패턴을 정당화하면 credential leak 위험이 현실화된다.
