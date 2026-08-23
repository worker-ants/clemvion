# 정식 규약 준수 검토 — `spec/3-workflow-editor/` (impl-done, diff-base=origin/main)

## 검토 대상

`git diff origin/main...HEAD -- spec/3-workflow-editor/` 결과 변경분은 `4-ai-assistant.md` 한 파일, §4.1.1 "마스킹 규칙"과 §14 Rationale 표의 두 지점뿐이다. 대응하는 코드 변경(`explore-tools.service.ts` 가 `maskSensitiveFields` 위에 `deepRedactSecrets` 를 겹치도록 함)은 워킹트리에서 직접 확인했고, `spec/conventions/egress-masking.md` 도 같은 작업(`assistant-mask-leak`, 2026-08-23)에서 표 2행 소비처에 "workflow-assistant explore 응답" 을 이미 반영해 두었다(§3 "표를 갱신한 실례"). 코드·좌표계 문서·target spec 세 곳이 서로 정합함을 실측으로 확인했다:

- `codebase/packages/masked-markers/src/index.ts` — `VALUE_MASK_MARKER = "***"` 확인. target §4.1.1 의 `"***"` 서술과 일치.
- `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` — `deepRedactSecrets(maskSensitiveFields(v))` 순서(키 먼저·값 나중)로 구현됨. target 의 "두 층을 겹쳐" 서술과 일치.
- `explore-tools.service.spec.ts` 캐너리 — `apiKey` 등 매칭 결과가 실제로 `'***'` 임을 고정. target 서술과 일치.
- `spec/5-system/14-external-interaction-api.md` §R17 이 마커 리터럴(`[REDACTED]`·`***`·`[REDACTED_DEPTH]`)을 직접 인용하는 선례가 있어, target 이 `"***"` 리터럴을 산문에 적은 것은 egress-masking.md 가 명시한 "wire 계약 서술 레이어는 리터럴 인용이 정상" 예외와 정합한다 — **위반 아님**.

## 발견사항

- **[WARNING]** "Egress 마스킹 좌표계" 참조가 hyperlink 가 아니라 평문
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 "마스킹 규칙" 첫 문단 — `deepRedactSecrets(Egress 마스킹 좌표계 참조)`
  - 위반 규약: `spec/conventions/egress-masking.md` 가 스스로 소유를 선언한 좌표계 문서 체계. 같은 규약을 인용하는 자매 두 문서 — `spec/5-system/14-external-interaction-api.md:1399` (`[egress-masking 규약](../conventions/egress-masking.md)`) 와 `spec/5-system/6-websocket-protocol.md:200` (`좌표계 SoT 는 [egress-masking 규약](../conventions/egress-masking.md)`) — 은 모두 첫 실질 언급 지점에서 상대경로 markdown link 로 연결한다.
  - 상세: target 문서는 "(Egress 마스킹 좌표계 참조)"라고 괄호로만 적었을 뿐 실제 `[...](../conventions/egress-masking.md)` 링크가 없다. 이번 작업으로 `egress-masking.md` 의 `code:` frontmatter 에 `explore-tools.service.ts` 가 신규 등재되어 이 문서가 좌표계의 세 번째 정식 소비처가 되었는데, 정작 target 은 SoT 로 되짚어가는 링크를 갖지 못한다. 이는 이 저장소가 반복적으로 강조하는 "정식 규약은 spec/conventions/에 두고 소비처는 그리로 되짚어 링크한다"는 교차참조 관행과 어긋난다. 텍스트만으로는 리더나 향후 checker 가 SoT 문서를 못 찾고, 같은 이름의 표현이 다른 문서에서 재정의됐다고 오인할 위험도 있다.
  - 제안: `(Egress 마스킹 좌표계 참조)` → `([Egress 마스킹 좌표계](../conventions/egress-masking.md) 참조)` 로 링크화. 1줄 수정으로 자매 두 문서와 패턴이 맞춰진다.

- **[INFO]** `"***"` 리터럴 인용은 정당하나 근거를 각주로 남기면 더 명확
  - target 위치: 같은 §4.1.1 문단 및 §14 Rationale 표
  - 위반 규약: 없음(정보성) — `spec/conventions/egress-masking.md` "본 문서는 마커 리터럴을 적지 않는다" 규칙은 그 문서 자신의 저술 규율이며, 같은 문단이 EIA §R17 을 "wire 계약 서술이라 정상" 이라 예외로 명시한다. target 의 `ExecutionDetailsResponse` 서술도 동일하게 실제 wire 응답 포맷을 문서화하는 레이어이므로 이 예외에 해당해 **규약 위반이 아니다**.
  - 상세: 다만 이 예외가 egress-masking.md 본문에만 적혀 있고 target 에는 "왜 리터럴을 적어도 되는지"에 대한 단서가 없다. 향후 다른 검토자가 §Overview 규칙만 보고 오탐(false positive)을 낼 수 있다.
  - 제안(선택): 위 WARNING 항목에서 추가하는 링크에 "wire 계약 서술이므로 리터럴 인용" 같은 1줄 각주를 덧붙이면 향후 재검토 시 오탐을 예방할 수 있다. 필수 수정은 아니다.

## 점검했으나 위반 없음 (기록)

- **명명 규약**: 신규 에러 코드 없음(`EXECUTION_NOT_FOUND`/`EXECUTION_NOT_IN_SCOPE` 는 이번 diff 이전부터 존재, 의미 기반 명명·UPPER_SNAKE_CASE 로 `spec/conventions/error-codes.md` §1 과 정합). `redactAssistantFields` 등 신규 식별자는 코드 레벨 헬퍼 이름이라 conventions 문서가 규율하는 명명 대상(도메인 식별자·에러 코드·감사 액션 등)에 해당하지 않는다.
- **출력 포맷 규약**: `"***"` 포맷은 §4.1.1 개정 전 존재하던 `"****<last4>"` 서술을 대체했고, 실제 `deepRedactSecrets`/`isMaskedMarker` 동작과 정확히 일치(코드 실측). `maskSensitiveFields` 고유 포맷(`"****<last4>"`)이 다른 소비처(AI Agent 노드, config echo boundary)에는 불변임을 target 이 명시적으로 부연해 `spec/conventions/node-output.md` 의 config-echo 정책과 스코프 혼동을 방지했다.
- **문서 구조 규약**: 이번 diff 는 기존 §4.1.1/§14 표의 국소 수정이며 문서의 Overview/본문/Rationale 구조·frontmatter(`code:` 등)에는 손대지 않았다. `code:` glob(`workflow-assistant/**/*.ts`)이 `explore-tools.service.ts` 를 이미 포괄해 별도 등재가 불필요하다.
- **API 문서 규약**: 이번 diff 에 컨트롤러·DTO·Swagger 데코레이터 변경이 없어 해당 관점은 트리거되지 않는다.
- **금지 항목**: `spec/conventions/egress-masking.md` §Rationale "기각한 대안"(세 상한 통합)을 재시도하지 않았고, `node-output.md` 의 금지 패턴(spread 기반 config echo)도 이번 변경과 무관하다.

## 요약

이번 diff 는 `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 한 곳만 건드린 좁은 변경이며, 서술된 마스킹 동작(`maskSensitiveFields` → `deepRedactSecrets` 순, 출력 `"***"`)은 실제 구현·테스트·`spec/conventions/egress-masking.md` 좌표계 표 갱신과 세 지점 모두 정합했다. 유일한 실질적 규약 이탈은 좌표계 SoT 문서로의 markdown 링크 누락(WARNING) — 같은 규약을 인용하는 EIA·WS-Protocol 두 자매 문서는 모두 링크를 거는데 이 문서만 평문 언급에 그쳤다. `"***"` 리터럴 인용 자체는 egress-masking.md 가 명시한 "wire 계약 서술" 예외에 해당해 위반이 아니다. CRITICAL 은 없다.

## 위험도

LOW
