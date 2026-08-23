# 정식 규약 준수 검토 — spec/3-workflow-editor/ (impl-done, assistant-mask-leak)

## 검토 대상
- `spec/3-workflow-editor/4-ai-assistant.md` (`spec/3-workflow-editor/_product-overview.md` §10 포함)
- diff: `mask-sensitive-fields.util.ts`(+token 계열 8종) · `explore-tools.service.ts`(`redactAssistantFields` 신설, `deepRedactSecrets` 겹침) · `handler-output.adapter.ts` 관련 테스트
- 대조 규약: `spec/conventions/egress-masking.md`(주 대상, 전문 확보) · `spec/conventions/error-codes.md`(전문 확보) · `spec/conventions/audit-actions.md`(전문 확보). `node-output.md`/`swagger.md`/`secret-store.md` 등은 번들이 컨텍스트 예산으로 절단되어 있어 저장소 원본 파일을 직접 열어 교차 확인함.

## 발견사항

- **[WARNING]** `4-ai-assistant.md` Rationale 의 구현 체크리스트 항목이 §4.1.1 SoT 결정 갱신을 반영하지 않음
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` — "Workflow AI Assistant — 실행 조회 도구 기획 결정 메모" → "구현 단계에서 유의 사항 (실제 구현 반영)" 목록의 4번 항목("**마스킹 구현.** `mask-sensitive-fields.util.ts` 재사용. 응답 직렬화 직전에 `inputData`/`outputData`/`error` 필드를 각각 한 번씩 통과시킴.")
  - 위반 규약: 직접적인 `spec/conventions/*` 조항 위반은 아니나, `spec/conventions/egress-masking.md` §3("이 문서는 기계가 지키지 않는다" — 마스킹 관련 산문이 stale 해질 수 있다는 경고)가 정확히 이 종류의 결함을 겨냥한다. 또한 같은 파일의 바로 위 "확정된 결정 사항" 표 행("민감 필드 마스킹")은 `~~구 결정~~ → **2026-08-23 결정으로 대체**` 형식으로 정확히 갱신되었고, EIA(`spec/5-system/14-external-interaction-api.md`)의 같은 주제 서술도 `~~단순 합성하면 안 된다~~ → **결정 완료(2026-08-23)**` 형식으로 갱신되었다 — 이 저장소가 이번 결정 변경에 일관되게 적용한 "취소선 + 갱신 주석" 관례를 이 항목만 누락했다.
  - 상세: 코드(diff)와 §4.1.1("두 층을 겹쳐 반환… `deepRedactSecrets`")은 이미 `maskSensitiveFields` + `deepRedactSecrets` 이중 마스킹(`redactAssistantFields`)으로 갱신됐는데, 같은 문서 하단의 "실제 구현 반영" 라벨이 붙은 체크리스트 4번 항목은 여전히 `mask-sensitive-fields.util.ts` 단독 재사용만 기술한다. `redactAssistantFields`/`deepRedactSecrets` 언급이 없어, 이 항목만 읽으면 옛 단일층 마스킹이 "실제 구현"인 것으로 오독된다.
  - 제안: 4번 항목에 `~~응답 직렬화 직전에 inputData/outputData/error 필드를 각각 한 번씩 통과시킴~~ → 2026-08-23: deepRedactSecrets 를 추가로 겹치는 redactAssistantFields 로 대체 (§4.1.1 참조)` 식으로 동일한 취소선+갱신 패턴을 적용해 "확정된 결정 사항" 표와 동기화한다.

## 정합성 확인 사항 (양성 — 문제 없음, 참고용)

- §4.1.1 "마스킹 규칙"은 `spec/conventions/egress-masking.md`를 정확히 인용하고, 그 협약이 규정한 좌표계(표 2행 `deepRedactSecrets`, 키 우선·값 나중 순서, 마커가 아니라 이 도구의 "로컬 합성 결과"라는 레이어 구분)와 완전히 일치한다. `egress-masking.md` 본문의 "표를 갱신한 실례(2026-08-23, `assistant-mask-leak`)" 문단이 바로 이 변경을 근거로 표 2행 소비처에 "workflow-assistant explore 응답"을 추가했음을 명시하고 있어 상호 참조가 착지한다.
- `"***"` 리터럴을 §4.1.1에 직접 적은 것은 `egress-masking.md`가 "본 문서는 마커 리터럴을 적지 않는다"고 선언한 규율의 위반처럼 보일 수 있으나, 그 규율은 **egress-masking.md 자신**에 한정되며 "EIA §R17이 마커 리터럴을 인용하는 것은 wire 계약 서술이라 정상"이라고 명시적으로 예외를 둔다. `codebase/packages/masked-markers/src/index.ts`에서 `VALUE_MASK_MARKER = "***"` 를 확인했고, `spec/5-system/14-external-interaction-api.md` §R17도 동일하게 `***`/`[REDACTED_DEPTH]` 리터럴을 반복 인용한다. `4-ai-assistant.md` §4.1.1은 LLM 도구의 **wire 응답 계약**을 서술하는 문서이므로 같은 예외 범주에 속하고, 실제로 EIA §R17은 "포맷 SoT는 [AI Assistant §4.1.1]"이라고 명시적으로 위임하고 있어 이 문서가 그 SoT 역할을 정확히 수행하고 있다.
- error 코드 명명(`EXECUTION_NOT_FOUND`, `EXECUTION_NOT_IN_SCOPE`, `PLAN_AWAITING_APPROVAL`, `ASSISTANT_TOO_MANY_TOOL_CALLS`, `NODE_NOT_FOUND` 등)은 모두 `error-codes.md` §1의 `UPPER_SNAKE_CASE` + 의미 기반 명명 원칙을 따른다. 도메인 예외 레지스트리(§3)·rename 이력(§5)에 저촉되는 항목 없음.
- `audit-actions.md`의 `<resource>.<verb>` 규약은 Assistant 메시지/도구 호출에는 적용되지 않는다 — §9 "감사 로그" 항목이 "메시지·도구 호출은 `AuditLog` 대상이 아닌 `assistant_message`에만 기록 (MVP)"이라고 명시적으로 카브아웃했으므로 정합.
- `node-output.md`(원본 직접 확인)의 "config echo 절대 금지" / "egress 값-마스킹이 backstop" 원칙은 노드 핸들러의 `config` echo 표면(diff의 `handler-output.adapter.ts`)에 대한 것으로, `4-ai-assistant.md`의 실행 조회 도구(별개 표면)와 레이어가 다르며 상충 없음.
- diff에 등장한 `token` 계열 접두형 마스킹 확장(`csrf_token`/`auth_token`/`session_token`/`csrfToken` 등)은 `_product-overview.md` ED-AI-37("민감 필드는 서버가 자동 마스킹")과 상충 없이 범위만 넓히며, 포맷 축은 불변이라는 §4.1.1의 서술과도 일치한다.

## 요약
검토 대상(`spec/3-workflow-editor/4-ai-assistant.md`)은 `spec/conventions/egress-masking.md`가 요구하는 좌표계·레이어 구분·마커 리터럴 인용 예외를 정확히 따르고 있으며, 실제로 EIA §R17로부터 이 마스킹 포맷 결정의 SoT로 명시적으로 위임받는 위치에 있다. 에러 코드 명명·감사 로그 카브아웃 등 다른 정식 규약과도 상충이 없다. 유일한 흠은 문서 내부의 Rationale 체크리스트 한 항목(§ "구현 단계에서 유의 사항" 4번)이 같은 문서·자매 문서(EIA)가 일관되게 적용한 "취소선 + 갱신 주석" 관례를 놓쳐, 2026-08-23 결정 갱신 이전의 단일층 마스킹 서술을 그대로 남긴 것 — 형식적 conventions 위반이 아니라 문서 자기정합성 결함이라 WARNING으로 등급.

## 위험도
LOW
