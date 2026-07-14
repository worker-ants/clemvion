# 정식 규약 준수 검토 — AI Agent 도구 정의 payload 예산 가드레일

대상: `plan/in-progress/ai-agent-tool-payload-budget-guardrail.md` (검토 모드: --spec, 내장된 D1~D5 spec 변경 draft 포함)

## 발견사항

- **[WARNING]** backend-only 경고 rule 이 `cross-node-warning-rules.md §5` "3중 가드" 요구를 충족하지 않음
  - target 위치: "확정 정책" > "노드 설정 변경 API" 항목, D3 (`ai-agent.md §10 config 경고 계약`), Rationale "왜 backend-only graph warning 인가"
  - 위반 규약: `spec/conventions/cross-node-warning-rules.md §5` — "같은 invariant 가 세 시점에 가드되어야 한다 (**특히 severity `error` rule**)" (workflow save endpoint / frontend canvas / runtime 3중)
  - 상세: `ai_agent:tool-payload-budget` rule 은 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 일 때 severity 가 `warning`→`error` 로 승격돼 저장을 400 차단하는 rule 이다. §5 의 문구는 이런 severity `error` rule 에 대해 "특히" 3중 가드(save endpoint + frontend canvas + runtime)를 요구하지만, target 은 "async 통합 scope 조회가 필요"함을 근거로 **가드 ②(frontend canvas 로컬 pre-evaluate)를 명시적으로 제외**한다(D3: "frontend canvas 가드 ②(로컬 pre-evaluate)는 이 rule 을 계산하지 않으며"). 결과적으로 strict 모드에서 저장이 실패할 config 인데도 canvas 에는 저장 버튼이 활성 상태로 남아, 사용자가 Save 클릭 후에야 400 을 만난다 — §5 가 명문화한 "사전 가시화" 보장이 이 rule 에는 적용되지 않는다. Phase 1 에는 §8 표 1행 추가만 있고, §5 자체에 "backend-only async rule 은 가드 ② 예외" 라는 공식 예외 조항 추가가 없다.
  - 제안: (a) Phase 1 spec 변경 항목에 `cross-node-warning-rules.md §5` 개정을 추가해 "async 통합 scope 조회가 필요한 backend-only rule 은 가드 ②(frontend canvas) 를 구조적으로 생략할 수 있다" 는 예외 카테고리를 공식화하거나, (b) frontend 가 근사치(예: 통합 미확정 상태에서도 카탈로그 static 상한으로 낙관적 사전 경고)로 가드 ② 를 부분적으로나마 충족하도록 재검토.

- **[WARNING]** rule 하나가 evaluate 시점에 severity 를 동적으로 바꾸는 패턴은 기존 `GraphWarningRule` 고정-severity 모델과 어긋남
  - target 위치: "확정 정책" 4번째 bullet, D5 (`cross-node-warning-rules.md §8` 신규 행)
  - 위반 규약: `spec/conventions/cross-node-warning-rules.md §3` 타입 정의(`GraphWarningRule.severity: 'error' | 'warning'` 는 rule 당 고정 필드) + 실제 구현(`codebase/packages/graph-warning-rules/src/evaluator.ts`)의 `evaluateGraphWarningRules` 가 `severity: rule.severity` 로 **rule 정의의 정적 값을 그대로 복사**하는 계약, §8 "현재 등재된 rule" 표(노드/rule id/**severity**/의미 — severity 컬럼 1행=1값 가정)
  - 상세: target 의 `ai_agent:tool-payload-budget` 는 `@workflow/graph-warning-rules` 의 `GraphWarningRule.evaluate()` 계약을 타지 않는 backend-only 커스텀 함수라서 타입 시스템상으로는 `GraphWarningRuleResult.severity` 를 자유롭게 설정할 수 있지만, 이는 §3·§8 이 암묵 전제하는 "rule = 고정 severity" 모델과 다른 새 패턴이다. D5 의 §8 표 행은 severity 컬럼에 `warning` 한 값만 적고 조건부 승격은 "의미" 컬럼 산문으로 우회 기술한다 — 향후 §8 표를 기계적으로 파싱/신뢰하는 사람이 "이 rule 은 항상 warning" 으로 오독할 위험.
  - 제안: §8 표에 조건부 severity 표기를 위한 별도 컬럼(예: "승격 조건") 을 추가하거나, cross-node-warning-rules.md 본문에 "backend-only 평가 rule 은 `GraphWarningRuleResult.severity` 를 evaluate 시점에 계산할 수 있다(§3 GraphWarningRule.evaluate 계약과 별개)" 는 명시적 각주를 Phase 1 에 포함.

- **[WARNING]** `output.error.details` 예시에 LLM 계열 노드 필수 필드 `retryable` 누락
  - target 위치: D1 (`ai-agent.md §4.2` 신규, estimator 문단 다음 "런타임 판정 위치"), D2 (`ai-agent.md §10` 에러 코드 표 신규 행)
  - 위반 규약: `spec/conventions/node-output.md §3.2.1` — "`retryable` (boolean) | **LLM 계열 노드(`ai_agent`/...)에서 필수**" (details 객체 내부 필드로 요구)
  - 상세: D1/D2 는 `output.error.details = { totalBytes, budgetBytes, toolCount, culpritProvider? }` 로 details shape 을 예시하면서 "§7.9 `LLM_RATE_LIMIT` details 선례 정합" 이라 주장한다. 그러나 실제 §7.9 선례(`ai-agent.md:900-909`)의 details 는 `{ provider, statusCode, retryable, retryAfterSec }` 로 **`retryable` 이 도메인 필드와 나란히 details 안에 명시**돼 있다. target 의 details 예시에는 `retryable` 이 빠져 있고, `retryable: false` 는 별도 산문 문장("retryable 분류: `false`")으로만 언급된다 — 실제 §4.2/§10 본문 작성 시 이 예시 shape 을 그대로 옮기면 필수 필드 누락 문서가 확정될 위험.
  - 제안: D1/D2 의 `details = {...}` 예시에 `retryable: false` 를 명시적으로 포함시켜 §3.2.1 필수 필드와 §7.9 선례에 맞춘다.

- **[INFO]** "(또는 워크스페이스 설정)" 트리거가 스펙 어디에도 정의되지 않음
  - target 위치: D3 (`ai-agent.md §10 config 경고 계약`) — "`AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true`(또는 워크스페이스 설정) 인 경우"
  - 위반 규약: 직접적인 conventions 위반은 아니나 문서 구조 규약(본문의 자기완결성) 관점 — "확정 정책"/Phase 1/Phase 2 전체가 env var 단일 메커니즘만 기술하는데 D3 에만 "워크스페이스 설정" 이라는 미정의 대안 trigger 가 괄호로 등장.
  - 상세: 워크스페이스 단위 override 스키마·저장 위치·API 가 plan 어디에도 없다. 구현 시 혼동 소지.
  - 제안: 현 단계에서 미확정이면 괄호 구절을 삭제하거나 "(백로그, 워크스페이스별 override 는 별도 plan)" 으로 명확히 스코프 아웃.

- **[INFO]** soft/hard 예산 env var 이름의 비대칭
  - target 위치: "확정 정책" > "예산 (모두 env override)"
  - 상세: `AI_AGENT_TOOL_PAYLOAD_MAX_BYTES` (soft) 와 `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES` (hard) 가 나란히 있는데, soft 쪽만 봤을 때 이름에 "soft/warn" 신호가 없어 "MAX" 가 상한(=hard)처럼 오독될 수 있다. `AI_AGENT_TOOL_COUNT_MAX` 역시 이 pair 와 별도로 "MAX" 를 hard-cap 의미로 쓰고 있어 동일 문서 안에서 "MAX" 토큰의 의미가 (soft-warn) vs (hard-cap) 두 갈래로 쓰인다.
  - 제안: `AI_AGENT_TOOL_PAYLOAD_SOFT_MAX_BYTES` / `AI_AGENT_TOOL_PAYLOAD_HARD_MAX_BYTES` 같은 대칭 명명으로 정정 검토 (선택사항 — 필수 아님).

- **[INFO]** estimator 반환 타입 표기가 "확정 정책" 과 D1 draft 사이에서 다름
  - target 위치: "확정 정책" > "단일 estimator (SoT)" vs D1 (`ai-agent.md §4.2`) "estimator (단일 진실)"
  - 상세: 전자는 `{ bytes, approxTokens, toolCount, perProvider?: [{ key, bytes, toolCount }] }` (perProvider optional, 원소 타입 명시), 후자는 `{ bytes, approxTokens, toolCount, perProvider[] }` (optional 마커·원소 타입 생략). 실제 spec 본문에 어느 표기를 채택할지 불명확.
  - 제안: 최종 §4.2 반영 시 하나의 표기로 통일 (원소 타입 포함, optional 마커 유지 권장 — perProvider 는 "범인 서버 지목"용 부가 정보이므로 optional 이 의미상 맞음).

## 요약

target 의 명명(에러코드 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` UPPER_SNAKE_CASE·기존 `TOOL_*`/`LLM_*` 계열 정합, rule id `ai_agent:tool-payload-budget` kebab-case 네임스페이스), 참조 정확성(§5.6/§5.7 cross-link, `GRAPH_VALIDATION_FAILED`·`GraphWarningRuleResult` 재사용, swagger.md §5-4 조건부 인용)은 대체로 정식 규약과 잘 정합한다. 다만 두 가지 구조적 지점에서 `cross-node-warning-rules.md` 의 암묵/명시 invariant 와 거리가 있다 — ① severity `error` 로 승격 가능한 rule 인데 §5 "3중 가드" 의 frontend canvas 가드를 구조적으로 생략하면서도 그 예외를 컨벤션 문서 자체에는 등재하지 않는 점, ② rule 당 고정 severity 를 가정하는 `GraphWarningRule`/§8 표 모델에 evaluate-시점 동적 severity 승격을 얹으면서 표 스키마를 그대로 재사용해 정보 손실이 발생하는 점. 두 지점 모두 target 이 스스로 rationale 을 남기고 있어 "의도된 이탈" 로 보이며 CRITICAL 급 invariant 파괴(backend 저장 reject 자체는 guard① 로 여전히 작동)는 아니지만, Phase 1 에 해당 컨벤션 문서(§5·§8) 개정이 누락돼 있어 향후 다른 rule 작성자가 이 예외를 몰래 답습할 위험이 있다. 추가로 `output.error.details` 예시가 node-output.md §3.2.1 의 필수 `retryable` 필드를 빠뜨려 §4.2/§10 본문 확정 시 그대로 반영될 경우 스펙 결함으로 굳어질 소지가 있다.

## 위험도

MEDIUM
