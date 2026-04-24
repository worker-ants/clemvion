파일 쓰기 권한이 필요합니다. 권한을 허용해주시면 저장하겠습니다. 그동안 보고서 내용을 직접 출력합니다.

---

# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 정확성과 핵심 보안 방어(sanitize + JSON.stringify)는 갖춰져 있으나, 테스트 커버리지 누락 2건과 문서 미갱신이 회귀 위험을 남긴다.

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `add_edge`의 **target_id label lookalike** 경로 미테스트 — source가 존재하고 target만 label인 케이스의 `targetHint` 분기가 회귀 보호 없이 노출됨 | `shadow-workflow.spec.ts` — `NODE_NOT_FOUND label-lookalike hint` describe | `source_id: TRIGGER_NODE.id`, `target_id: 'SendEmail'` 케이스 추가 |
| 2 | Testing | `system-prompt.spec.ts` UUID 근접성 단언이 취약 — `/UUID/`와 `/never.*label/` 패턴이 독립 검사되어 두 표현이 별개 섹션에 있어도 통과 | `system-prompt.spec.ts:104–107` | `expect(prompt).toMatch(/always reference a node by its UUID, never by its label/i)` 형태로 구체적 문구 고정 |
| 3 | Documentation | `ShadowResult.hint` JSDoc에 신규 케이스 2종 누락 — `update_node`/`remove_node`/`add_edge`의 label-lookalike 경로가 기존 열거 목록에 없음 | `shadow-workflow.ts` — `ShadowResult.hint` 필드 JSDoc | label-lookalike 케이스 두 항목 추가 |
| 4 | Maintainability | `labelLookalikeHint`가 `findByLabel`의 O(n) 순회 로직을 중복 구현 — 향후 `findByLabel` 변경 시 누락 위험 | `shadow-workflow.ts` — `labelLookalikeHint` 메서드 | `const node = this.findByLabel(value); if (!node) return null;`로 위임 |
| 5 | Maintainability | `labelLookalikeHint` 내 `safeValue`/`safeLabel`이 항상 동일한 값 — `node.label === value` 조건 진입이므로 `sanitizeLlmProvidedString` 두 번 호출, 동어반복 문구 생성 | `shadow-workflow.ts` — `labelLookalikeHint` | `safeLabel` 제거 후 `safeValue` 재사용; 메시지 단순화 |
| 6 | Architecture | `ShadowWorkflow` SRP 침식 — LABEL_CONFLICT·cascading·label-lookalike 세 가지 hint 전략이 단일 클래스에 누적 | `shadow-workflow.ts` — `ShadowWorkflow` 클래스 전반 | 당장 불필요; hint 전략 4종째 추가 시점에 `HintEnricher` 분리 검토 |
| 7 | Security | Prompt Injection 표면 — `sanitize + JSON.stringify`로 완화됐으나 자연어 instruction 문장이 tool result에 잔류 가능 | `shadow-workflow.ts` — `labelLookalikeHint` 반환 문자열 | `[hint] … [/hint]` 고정 마커로 LLM이 hint 범위 구분하도록 보완 |
| 8 | Requirement | 시스템 프롬프트의 hint 형식 기술과 실제 `result.hint` 포맷 일치 여부를 검증하는 assertion 부재 | `system-prompt.ts` 신규 블록 / `shadow-workflow.spec.ts` | `result.hint`가 `'Value "SendEmail" matches the label'` 패턴 포함하는지 assertion 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `sanitizeLlmProvidedString` C1 제어 문자(`\x80–\x9F`) 미처리 | `shadow-workflow.ts` — `sanitizeLlmProvidedString` | 정규식을 `/[\x00-\x1F\x7F-\x9F]/g`로 확장 |
| 2 | Security | 유니코드 Bidi 방향 제어 문자 미중화 — zero-width 문자 필터 우회 가능 | `shadow-workflow.ts` — `sanitizeLlmProvidedString` | Bidi 범위 replace 추가 |
| 3 | Security | `labelLookalikeHint(value)` 호출 전 길이 상한 없음 | `shadow-workflow.ts` — call-site 3곳 | `value.length > LABEL_HINT_MAX_LEN * 4`이면 null 조기 반환 |
| 4 | Security | `node.id`에 `JSON.stringify` 래핑 불필요 — UUID는 `[0-9a-f\-]`만 포함 | `shadow-workflow.ts` — `labelLookalikeHint` | 단순 문자열 보간으로 대체 |
| 5 | Documentation | `spec/3-workflow-editor/4-ai-assistant.md`에 label-lookalike hint 절 및 cascading 우선순위 규칙 미기재 | spec 파일 | 해당 절 추가 |
| 6 | Documentation | `system-prompt.spec.ts` 신규 테스트에 spec 절 참조 미기재 (기존 테스트는 `§N` 형식 일관 사용) | `system-prompt.spec.ts` 신규 `it` 블록 | `(spec/3-workflow-editor/4-ai-assistant.md §Contracts — Label vs identifier)` 주석 추가 |
| 7 | API Contract | `addEdge` hint 우선순위(cascading > label-lookalike) 계약이 테스트로만 보장, 타입 미표현 | `shadow-workflow.ts` / spec | hint 소스 3종 이상 시 `hintSource?` 필드 도입 검토 |
| 8 | Concurrency | 모듈 스코프 `expressionReferenceCache` — 단일 스레드 안전, Worker Threads 확장 시 경쟁 조건 가능 | `system-prompt.ts` | 현재 조치 불필요 |
| 9 | Performance | `addEdge` 내 `this.nodes.has()` 조건 중복 평가 | `shadow-workflow.ts` — `addEdge` else 블록 | `const sourceExists` 변수화 후 재사용 |
| 10 | Side Effect | `addEdge`의 `sourceHint === null` 조건이 "source 존재해서 null"과 "매치 없어서 null"을 미구분 | `shadow-workflow.ts` — `addEdge` else 블록 | `!this.nodes.has(sourceId) && sourceHint === null`로 명시화 |
| 11 | Maintainability | `labelLookalikeHint` 네이밍이 `build*` 컨벤션과 불일치 | `shadow-workflow.ts` — 메서드명 | `buildLabelAsIdHint`로 변경 |
| 12 | Maintainability | `updateNode` 인라인 주석 있고 `removeNode` 없는 비대칭 | `shadow-workflow.ts` | 두 곳 통일 |
| 13 | Testing | 공백 전용 문자열 경계값 미테스트 (`'   '`는 falsy가 아님) | `shadow-workflow.spec.ts` | 공백 입력 시 hint undefined 검증 케이스 추가 |
| 14 | Testing | cascading 우선순위 반례("FIFO 비면 lookalike 출력") 명시적 검증 미존재 | `shadow-workflow.spec.ts` | 별도 반례 케이스 추가 |
| 15 | Requirement | `add_edge`에서 source/target 양쪽 모두 label인 케이스 미테스트 | `shadow-workflow.spec.ts` | `source_id: 'LabelA'`, `target_id: 'LabelB'` 케이스 추가 |
| 16 | Requirement | `source_id === target_id` 모두 label일 때 `CYCLE_DETECTED` 반환 — hint 없어 LLM이 원인 파악 어려움 | `shadow-workflow.ts` — `addEdge` | 현재 범위 밖; 별도 태스크로 관리 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | LOW | C1/Bidi 제어 문자 미처리, prompt injection 완화됨 |
| Performance | NONE | 에러 경로 한정 O(n) 순회 — 현 규모에서 무해 |
| Architecture | LOW | SRP 침식 (hint 전략 3종 누적), safeValue/safeLabel 중복 |
| Requirement | LOW | hint 포맷 매칭 검증 부재, add_edge 양측 label 케이스 미테스트 |
| Scope | NONE | 변경 범위가 단일 기능에 응집, 불필요한 리팩토링 없음 |
| Side Effect | LOW | sourceHint === null 조건 모호, safeValue/safeLabel 이중 계산 |
| Maintainability | LOW | findByLabel 순회 중복, safeValue/safeLabel 동일값, 주석 비대칭 |
| Testing | LOW | add_edge target lookalike 경로 미테스트, UUID 근접성 단언 취약 |
| Documentation | LOW | ShadowResult.hint JSDoc 미갱신, spec 절 미추가 |
| API Contract | LOW | hint 조건 JSDoc 누락, 우선순위 타입 미표현 |
| Concurrency | LOW | expressionReferenceCache 모듈 스코프 (현 환경에서 안전) |
| Dependency | NONE | 신규 외부 의존성 없음 |
| Database | NONE | DB 관련 코드 없음 |

---

## 발견 없는 에이전트

Database, Dependency, Scope, Performance — 변경사항이 순수 인메모리 로직이고 단일 기능에 집중되어 있어 해당 영역에서 지적 사항 없음.

---

## 권장 조치사항

1. **[필수] `add_edge` target_id label lookalike 테스트 추가** — `targetHint` 분기가 회귀 보호 없이 노출. `source_id: TRIGGER_NODE.id`, `target_id: 'SendEmail'` 케이스 추가.
2. **[필수] `system-prompt.spec.ts` UUID 근접성 단언 강화** — `"always reference a node by its UUID, never by its label"` 고정 문구 단언으로 교체.
3. **[권장] `ShadowResult.hint` JSDoc에 label-lookalike 케이스 2종 추가** — `update_node`/`remove_node`/`add_edge` 경로 명시.
4. **[권장] `labelLookalikeHint`를 `findByLabel` 위임으로 리팩토링** — 순회 중복 제거, `safeValue`/`safeLabel` 통합, 메서드명 `buildLabelAsIdHint`로 통일.
5. **[권장] `sanitizeLlmProvidedString` 방어 범위 확장** — C1 제어 문자 및 유니코드 Bidi 제어 문자 추가 제거.
6. **[선택] `spec/3-workflow-editor/4-ai-assistant.md` label-lookalike hint 절 추가** — cascading 우선순위 규칙 포함.
7. **[선택] `labelLookalikeHint` 호출 전 길이 상한 조기 반환** — `value.length > LABEL_HINT_MAX_LEN * 4`이면 null 반환.