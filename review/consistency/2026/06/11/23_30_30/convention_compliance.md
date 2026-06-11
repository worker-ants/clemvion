# Convention Compliance Report

검토 범위: `spec/4-nodes/4-integration/` (구현 완료 후 검토, diff-base=origin/main)
검토 일시: 2026-06-11

---

## 발견사항

### 1. **[CRITICAL]** `node-output.md Principle 3.1` 미갱신 — SSRF 차단이 pre-flight throw 로 분류된 채 잔존

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §4 step 8`, `§5.3`, `§5.8`, `§6`; `0-common.md §4.2`; `2-database-query.md §4 SSRF 가드 callout`
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.1 표
  ```
  | Pre-flight 에러 (config 오류, credential 누락, SSRF 차단 등) | throw → 엔진이 실행 실패로 마킹 |
  ```
- **상세**: D4 결정(SSRF 차단 포함 모든 `execute()` 안 실패를 `port: 'error'` 로 라우팅)이 `1-http-request.md §5.8`, `§6 HTTP_BLOCKED` 표, `2-database-query.md §4 SSRF callout` 등 여러 노드 spec 에 기록됐지만, **정식 규약인 `node-output.md` Principle 3.1 표는 "SSRF 차단"을 여전히 pre-flight throw 로 명시한 채 갱신되지 않았다.** `1-http-request.md §8.2 Rationale` 는 이 변경의 근거를 상세히 기록했으나, conventions SoT 가 구버전 분류를 유지하므로 두 문서 간 invariant 충돌이 존재한다. 다른 노드 개발자·툴링이 Principle 3.1 을 참조하면 틀린 분류를 따른다.
- **제안**: `spec/conventions/node-output.md` Principle 3.1 표에서 "SSRF 차단 등" 문구를 제거하거나 "SSRF 차단 — D4 이후 `port: 'error'` 라우팅 참조" 주석을 추가하고, D4 결정 이후의 Integration 노드 분류를 반영한다.

---

### 2. **[WARNING]** `0-common.md §3` 에 "Principle 7 / §3" 복합 인용 — 잘못된 anchor 참조

- **target 위치**: `spec/4-nodes/4-integration/0-common.md` 라인 47
  ```
  모든 Integration 노드의 출력은 CONVENTIONS Principle 7 / §3 의 nested envelope 을 따른다
  ```
- **위반 규약**: `spec/conventions/node-output.md` 의 섹션 구조 — 규약 문서에 `§3` 는 존재하지 않는다(섹션 표기 없음). Principle 3 은 있으나 별도 `§3` anchor 가 아니다.
- **상세**: "Principle 7 / §3" 는 Principle 7(config echo)과 Principle 3(에러 envelope)을 비공식 복합 참조한 것으로 보인다. 그러나 규약 문서에 `§3` 라는 anchor 가 없어 독자가 해당 섹션을 직접 찾을 수 없다. 문서의 nested envelope(`config / output / meta / port`) 구조는 실제로 Principle 0(5필드 invariant) 에 정의되며, Principle 7 은 `config` echo 원칙이다.
- **제안**: "CONVENTIONS Principle 7 / §3" → "CONVENTIONS [Principle 0](../../conventions/node-output.md#principle-0--nodehandleroutput의-5필드는-불변) · [Principle 7](../../conventions/node-output.md#principle-7--config-echo-원칙-nodehandleroutputconfig)" 로 정확한 anchor 링크로 교체한다.

---

### 3. **[WARNING]** `1-http-request.md` `status: implemented` 유지 — 미구현 planned 항목 존재 시 `partial` 요건 검토

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` frontmatter `status: implemented`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `partial`: 일부 구현됨, `pending_plans:` 의무. `implemented`: 모든 약속 구현 완료.
- **상세**: `1-http-request.md §1` 설정 표에 `followRedirects` / `verifySsl` 가 **현재 런타임 미반영(Planned)** 으로 명시돼 있고, `bodyType: binary` / `responseType: binary` 전용 처리도 **미구현(Planned)** 으로 기록돼 있다. 이들이 "spec 이 약속한 surface" 인지 여부가 기준인데, 현 spec 본문이 해당 필드들의 동작을 약속(설정 표에 공식 필드로 등재)하고 있으므로 구현 미완 상태이면 `partial` + `pending_plans:` 가 규약상 더 정확하다. 단, 이번 diff 는 SSRF 관련 변경만이며 planned 항목은 기존부터 존재한 것이므로 본 PR 범위에서 새로 위반이 생긴 것은 아니다.
- **제안**: `followRedirects` / `verifySsl` / `binary` 처리 미구현 항목을 추적하는 plan 이 없다면 `plan/in-progress/` 에 등재 후 `status: partial` + `pending_plans:` 로 전환하거나, 해당 항목들이 spec 약속이 아닌 "향후 계획 메모" 임을 spec 본문에 명확히 구분하고 `implemented` 를 유지하는 방향 중 하나를 선택해 일관성을 확보한다.

---

### 4. **[INFO]** `1-http-request.md §5.3.2` Transport 실패 케이스 — `output.response` 에 legacy 잔재 echo

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §5.3.2` JSON 예시 및 필드 표
  ```json
  "output": {
    "response": { "error": "ECONNREFUSED" },
    ...
  }
  ```
  필드 표: `output.response.error | string | handler return | transport 실패 메시지 (legacy 호환 잔재 — 신규 코드는 output.error 를 사용)`
- **위반 규약**: `spec/conventions/node-output.md` Principle 1.1 — "`output` 은 비즈니스 결과물만 담는다", Principle 3.2 — 에러는 `output.error.{code, message, details?}` 표준 envelope.
- **상세**: Transport 실패 케이스에서 `output.response: { error: "ECONNREFUSED" }` 라는 비표준 에러 필드가 `output` 최상위에 노출된다. spec 이 이를 "legacy 잔재" 로 명시했으므로 현황 인지는 돼 있으나, 규약 상 표준 에러 envelope(`output.error.*`) 과 별개 경로가 `output` 에 공존하는 상태다. 이 잔재가 지속되면 소비자 코드가 두 경로를 구분해야 한다.
- **제안**: `output.response` legacy 잔재 제거 plan 을 `pending_plans:` 에 등재하거나, 허용된 단계적 호환 패턴임을 규약 문서(`node-output.md Principle 3.2`)에 명시하는 방향 중 하나를 택한다. 이번 diff 범위 외이므로 후속 이슈로 등록 가능.

---

### 5. **[INFO]** `0-common.md §3` 의 nested envelope 예시에 `port` 기본값 설명 — Principle 5 와 경미한 표현 차이

- **target 위치**: `spec/4-nodes/4-integration/0-common.md §3` JSON 예시 주석
  ```
  `port` 는 포트 라우팅 (생략 시 success 계열 기본 포트)
  ```
- **위반 규약**: `spec/conventions/node-output.md` Principle 5 — `port: undefined` 는 "기본 단일 출력 (노드 정의상 outputs 가 1개)" 인 노드에만 해당.
- **상세**: `0-common.md` 의 설명 "생략 시 success 계열 기본 포트" 는 약간 부정확하다. Integration 노드는 `success`/`error` 두 포트를 갖고, `port` 를 명시적으로 반환하는 것이 표준이다 (`send_email` 의 경우 `port: undefined` → 기본 `out` 이지만, `http_request`/`database_query`/`cafe24`/`makeshop` 은 `port` 를 명시 반환). 단순한 설명 간소화이며 코드 동작에 영향 없다.
- **제안**: 표현을 "명시 반환 권장 (기본값 없음 — Integration 노드는 `success` 또는 `error` 를 명시)" 으로 정확화하거나 현행 유지(사소한 표현 차이).

---

## 요약

이번 diff(`spec/4-nodes/4-integration/` SSRF 전 인증 방식 공통 적용 + config echo D1 명시 + `INTEGRATION_NOT_FOUND` 오인식 수정 + `INTEGRATION_SERVICE_UNAVAILABLE` 추가)는 각 노드 spec 내부에서는 일관성 있게 갱신됐다. 그러나 **가장 중요한 미처리 사항은 `spec/conventions/node-output.md` Principle 3.1 표가 SSRF 차단을 pre-flight throw 로 분류한 채 갱신되지 않은 점**이다. 이 conventions SoT 위반은 다른 노드 개발자가 규약을 참조할 때 틀린 분류를 따르게 만드는 직접 위반(CRITICAL)이다. 나머지 항목은 intra-document 참조 정확도(WARNING) 또는 기존 잔재에 대한 정보 제공(INFO) 수준이며, `status: implemented` 유지 여부(WARNING)는 기존 planned 항목 정책 재확인이 필요하다.

---

## 위험도

**MEDIUM** — Principle 3.1 conventions 문서 미갱신이 다른 노드 개발자의 구현에 잘못된 기준을 제공할 수 있으나, 현재 Integration 노드 코드 자체의 동작에는 영향 없다.

STATUS: OK
