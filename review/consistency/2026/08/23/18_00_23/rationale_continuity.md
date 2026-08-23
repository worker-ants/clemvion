# Rationale 연속성 검토 — spec/3-workflow-editor/ (impl-done, diff-base=origin/main)

## 발견사항

- **[WARNING]** "실행 조회 도구" Rationale 항목 내부에서 마스킹 구현 서술이 자기모순 — 상단 결정은 갱신됐는데 하단 구현 노트는 예전 결정을 그대로 서술
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` L1471, `### Workflow AI Assistant — 실행 조회 도구(...) 기획 결정 메모` → `#### 구현 단계에서 유의 사항 (실제 구현 반영)` 항목 4 — "**마스킹 구현.** `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` 재사용. 응답 직렬화 직전에 `inputData`/`outputData`/`error` 필드를 각각 한 번씩 통과시킴."
  - 과거 결정 출처: 같은 파일·같은 Rationale 항목의 "확정된 결정 사항" 표(L1435) — "민감 필드 마스킹 | ~~`maskSensitiveFields` 공통 유틸 재귀 적용~~ → **2026-08-23 결정으로 대체**: `maskSensitiveFields` + `deepRedactSecrets` **중첩**, 출력 `"***"` (§4.1.1 이 SoT)."
  - 상세: 이번 diff(`explore-tools.service.ts`)는 `redactAssistantFields()`를 신설해 `deepRedactSecrets(maskSensitiveFields(v))` 두 겹을 적용하도록 바꿨고, 같은 파일 §4.1.1 본문(L259)과 표(L1435)는 이를 정확히 반영해 취소선 + "2026-08-23 결정으로 대체"로 갱신됐다. 그런데 그 표 바로 아래, 같은 Rationale 항목 안의 번호 매긴 구현 노트 4번(L1471)은 여전히 "`mask-sensitive-fields.util.ts` 재사용… 각각 한 번씩 통과"라는 **구(舊) 단일 계층 방식**을 "실제 구현 반영"이라는 제목 아래 서술하고 있다. 표는 갱신됐지만 그 표를 부연하는 하위 항목이 동기화되지 않아, 같은 문서 같은 섹션 안에서 두 서술이 서로 다른 마스킹 방식을 "현재 구현"으로 주장하는 상태다. `item 3`(결정의 무근거 번복) 관점에서 번복 자체는 근거가 있지만, 그 근거가 문서 전체에 일관되게 반영되지 않아 다음 유지보수자가 L1471만 보고 (deepRedactSecrets 계층 없이) 단일 마스킹으로 되돌릴 위험이 있다.
  - 제안: L1471 "마스킹 구현" 항목을 `maskSensitiveFields` → `deepRedactSecrets` 중첩 순서(키 축 먼저, 값 축 나중)로 갱신하거나, 최소한 "→ 2026-08-23 결정으로 대체, §4.1.1 참조"로 취소선/포인터를 남겨 표(L1435)와 정합시킨다.

- **[INFO]** `DEFAULT_SENSITIVE_KEYS` 접두형 확장이 `node-output.md` Principle 7 "비-자격증명 config 는 무변화로 echo" 원칙과 만나는 경계 사례 — 이미 diff 자체가 인지·문서화했으나 convention 문서 쪽엔 반영 안 됨
  - target 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` (`DEFAULT_SENSITIVE_KEYS`에 `csrfToken`/`csrf_token`/`authToken`/`auth_token`/`sessionToken`/`session_token`/`idToken`/`id_token` 추가) — `handler-output.adapter.ts`가 이 상수를 노드 `config` echo 마스킹에 재사용
  - 과거 결정 출처: `spec/conventions/node-output.md` Principle 7 — "**절대 echo 금지**: 자격증명… **egress 값-마스킹이 이 금지를 backstop**한다… **비-자격증명 config(코드 로직·프롬프트 본문·필드 정의)는 무변화로 echo된다.**"
  - 상세: HTTP Request·Send Email 노드의 `headers`/`body`는 사용자가 키 이름을 직접 정의하므로, 사용자가 비-자격증명 목적으로 `headers.id_token` 같은 키를 쓰면 이번 확장으로 그 값이 config echo에서 새로 가려질 수 있다. diff의 코드 주석(`mask-sensitive-fields.util.ts` 상단)은 이 tension을 이미 정확히 인지하고 "과잉 마스킹(안전 쪽)이고 신규 클래스가 아니다(`token`/`apiKey` 등 기존 항목도 같은 성질)"로 명시적으로 트레이드오프 처리했다 — Rationale 연속성 관점에서 위반이라기보다 기존에 이미 존재하던 tension의 점진적 확장이며 무근거 번복은 아니다. 다만 `node-output.md` Principle 7 자체는 "무변화로 echo"라고 단정적으로 서술해, 이 알려진 예외(자격증명-유사 사용자 정의 키)를 문서화하지 않고 있다.
  - 제안: `node-output.md` Principle 7의 "egress 값-마스킹이 backstop" 콜아웃에 "사용자가 정의하는 `headers`/`body` 키가 `DEFAULT_SENSITIVE_KEYS`와 완전 일치하면 비-자격증명이어도 과잉 마스킹될 수 있다(정적 분석으로 닫을 수 없는 잔여 갭, 안전 방향)"는 한 줄을 추가해 SoT를 `mask-sensitive-fields.util.ts`의 코드 주석과 맞춘다.

## 요약

이번 `assistant-mask-leak` diff(`mask-sensitive-fields.util.ts` 키 축 확장, `explore-tools.service.ts`의 `maskSensitiveFields` + `deepRedactSecrets` 이중 마스킹 도입)는 Rationale 연속성 관점에서 전반적으로 모범적이다. `****<last4>` → `***` 포맷 축소라는 명백한 결정 번복에 대해 (1) 코드 JSDoc에 "왜 두 겹인가"·"의도된 트레이드"·"자매 표면과의 강도 차이"를 상세히 남겼고, (2) `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 본문과 "실행 조회 도구" Rationale 표를 취소선 처리로 명시 갱신했으며, (3) `spec/conventions/egress-masking.md` §3에도 "표를 갱신한 실례 (2026-08-23, assistant-mask-leak)"로 좌표계 표의 변경 이력을 append했다. `masked-markers` 패키지가 못박은 "별개 불변식은 합치지 않는다"는 기각 결정과도 직접 충돌하지 않는다(그 결정은 depth-limit 3계열 통합 논의이고, 이번 변경은 별개의 두 마스커를 순차 합성하는 것이며 `isMaskedMarker` 판정 범위 밖의 문자열(`****<last4>`)이라 마커 재덮어쓰기 보호 로직도 우회하지 않는다 — 정직하게 "덮인다"고 서술). 유일한 실질 흠은 같은 Rationale 항목 안에서 결정 요약 표(갱신됨)와 그 아래 번호 매긴 구현 노트(미갱신)가 서로 다른 마스킹 방식을 "현재 구현"으로 서술하는 국소적 비동기화이며, WARNING으로 별도 기재했다.

## 위험도

LOW
