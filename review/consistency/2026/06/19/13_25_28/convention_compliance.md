# 정식 규약 준수 검토 결과

검토 모드: --impl-prep
Target: `spec/4-nodes/2-flow/1-workflow.md`

---

## 발견사항

### [INFO] `output.result` 래핑 규약 적용 노드 분류 명시 부재
- target 위치: §5.1 (Sync 정상 케이스) `output.result` 래핑 설명
- 위반 규약: `spec/conventions/node-output.md` Principle 8.2 마지막 규칙 — "`output.result` 래핑은 LLM 계열 노드(ai_agent, text_classifier, information_extractor) 한정"
- 상세: `node-output.md` Principle 8.2 는 `output.result` 래핑을 LLM 계열 3노드 한정이라 명시하고, Code/Transform 은 예외로 명시한다. `workflow` 노드는 sync 정상 케이스에서 `output.result` 에 서브 워크플로우 결과를 1단 래핑하는데, 이 패턴이 Principle 8.2 적용 범위 목록("LLM 계열 3노드 한정")에 명시적으로 등재되지 않아 규약 문서만 보면 위반처럼 보인다. 다만 Principle 8.2 의 예외 각주("Code/Transform 은 사용자가 shape 을 결정하므로…") 처럼, `workflow` 노드가 `output.result` 를 쓰는 이유(서브 워크플로우 결과를 구별하는 네임스페이스 필요)는 목적이 달라 규약 위반으로 보기는 어렵다. 그러나 Principle 8.2 가이드라인과 명시적으로 조율된 기술이 문서에 없다.
- 제안: `1-workflow.md` §5.1 에 "`output.result` 래핑 — CONVENTIONS Principle 8.2 의 LLM 계열 전용 원칙 예외: 서브 워크플로우 결과에 단독 키(`result`)를 부여해 부모 output 과 구별하기 위함" 한 줄 주석을 추가하거나, `node-output.md` Principle 8.2 예외 목록에 `workflow` 를 명시한다.

### [INFO] `meta` 필드 — Async 정상·런타임 에러 케이스 예시에 `meta.durationMs` 생략
- target 위치: §5.2 (Async 정상) / §5.3 (런타임 에러) JSON 예시
- 위반 규약: `spec/conventions/node-output.md` Principle 2 — `meta.durationMs: number` 는 모든 노드 공통 필수 / Principle 11 — Case 별 예시 문서화 규칙
- 상세: Principle 2 에 따르면 `meta.durationMs` 는 공통 필수다. §5.1 예시에는 포함되어 있으나 §5.2 / §5.3 예시에는 `meta` 키 자체가 없다. Principle 11 은 `undefined` 필드는 생략하라고 하지만 필수 필드를 생략하라는 뜻은 아니다. 독자가 Async 및 에러 케이스에서 `meta` 가 불필요하다고 오해할 수 있다.
- 제안: §5.2 / §5.3 JSON 예시에 `"meta": { "durationMs": 0 }` (또는 적절한 값)를 추가하거나, 해당 절 표에 `meta.durationMs` 행을 추가한다.

### [INFO] `output.error.details.retryable` 필드 — 설계 공백
- target 위치: §5.3 (런타임 에러) `output.error.details` 표, §6 에러 코드 표
- 위반 규약: `spec/conventions/node-output.md` Principle 3.2.1 — 비-LLM 노드 선택, "명시할 경우 본 spec 의 의미를 준수"
- 상세: `workflow` 노드는 LLM 계열이 아니므로 `retryable` 필드 의무는 없다. 그러나 `SUB_WORKFLOW_TIMEOUT` 같이 일시적 실패가 명확한 케이스에 대해 `retryable` 포함 여부가 spec 에 전혀 언급되지 않아, 구현 시 임의 결정이 필요하다. 규약 위반은 아니지만 설계 공백이다.
- 제안: §5.3 표나 §6 표에 `SUB_WORKFLOW_TIMEOUT` 케이스의 `retryable` 값을 명시한다(예: `retryable: false` — 부모가 재시도 타이밍을 결정함). 또는 의도적으로 미선언임을 주석으로 밝힌다.

---

## 요약

`spec/4-nodes/2-flow/1-workflow.md` 는 frontmatter(`id: workflow`, `status: implemented`, `code:` 3개 경로)가 `spec/conventions/spec-impl-evidence.md` 스키마를 충족하며, 출력 구조(5필드 invariant, 에러 포트 컨트랙트, config echo 원칙, Principle 11 문서화 양식, 에러 코드 UPPER_SNAKE_CASE, 감사 액션 audit-actions 규약과 무관)를 전반적으로 올바르게 따른다. CRITICAL 또는 WARNING 급 규약 위반은 발견되지 않았다. 발견된 3건은 모두 INFO 수준으로, Principle 8.2 의 `output.result` 래핑 예외 미선언, Async/에러 케이스 예시에서 공통 필수 `meta.durationMs` 생략, `retryable` 필드 설계 공백이며, 구현 착수를 차단할 규약 위반은 없다.

---

## 위험도

NONE
