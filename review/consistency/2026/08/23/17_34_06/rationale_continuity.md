# Rationale 연속성 검토 — spec/3-workflow-editor/ (--impl-done, assistant-mask-leak)

## 검토 방법

target 스코프(`spec/3-workflow-editor/`)의 diff(주로 `4-ai-assistant.md` §4.1.1 마스킹 규칙 —
`maskSensitiveFields` 단독 → `deepRedactSecrets` 중첩, 출력 포맷 `"****<last4>"` → `"***"`)를
`spec/5-system/14-external-interaction-api.md` §R17("잔여 ③"), `spec/conventions/egress-masking.md`
`## Rationale`, `spec/conventions/node-output.md` Principle 7, 그리고 실제 구현
(`explore-tools.service.ts`, `mask-sensitive-fields.util.ts`, `handler-output.adapter.spec.ts`)과
대조했다. 또한 같은 스코프에 대해 이미 두 차례 수행된 이전 라운드 리포트
(`review/consistency/2026/08/23/16_09_25/rationale_continuity.md`,
`.../16_21_45/rationale_continuity.md`)를 대조해 지적된 WARNING/INFO 가 이번 diff 에서
실제로 해소됐는지 재검증했다.

## 발견사항

- **[INFO]** §4.1.1 "다른 소비처는 영향을 받지 않는다" 문구가 문맥 없이 읽히면 범위를 넘어 오독될 수 있다
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1, "**이 포맷은 이 도구의 로컬 합성 결과다**" 문단(`maskSensitiveFields` **자체**의 포맷은 `"****<last4>"` 로 **불변**이고, 그 유틸을 공유하는 다른 소비처(AI Agent 노드 · 노드 `config` echo boundary)는 영향을 받지 않는다)
  - 과거 결정 출처: `CHANGELOG.md` "Unreleased — workflow-assistant LLM 도구의 마스킹을 값 축까지 넓혔다" 항목 3 (`DEFAULT_SENSITIVE_KEYS` 에 token 계열 8개 추가 — "실질 수혜자는 이 목록을 공유하는 **자매 표면**(`handler-output.adapter.ts`, 노드 `config` echo)이다"), 및 `handler-output.adapter.spec.ts` 의 신규 canary(`masks the '%s' key in echoed config (token family)` — `csrf_token` 등이 이제 config echo 에서 `****4321` 로 마스킹됨을 확인)
  - 상세: 이 diff 는 두 개의 공유 파일을 동시에 바꾼다 — (a) `explore-tools.service.ts` 위에 `deepRedactSecrets` 를 겹쳐 **이 도구만** `"***"` 포맷으로 바뀌고, (b) `mask-sensitive-fields.util.ts` 의 `DEFAULT_SENSITIVE_KEYS`(전역 공유 상수)에 `token` 접두 계열 8개를 추가해 **config echo 를 포함한 모든 소비처**가 이제 그 키들을 `"****<last4>"` 로 마스킹한다. §4.1.1 문장은 (a)에 대해서는 정확하다(포맷이 `"***"` 로 새는 것은 이 도구 로컬). 그러나 "영향을 받지 않는다" 라는 서술만 떼어 읽으면 (b)까지 "config echo 는 이 PR 과 무관하다"로 오독될 수 있다 — 실제로는 config echo 가 새 token 계열 키를 마스킹하기 **시작**한다(포맷은 그대로 `****<last4>`). `CHANGELOG.md`는 이 구분("실질 수혜자는 자매 표면")을 정확히 적어 두었지만 §4.1.1 자신은 그 구분을 명시하지 않는다. 이는 이전 라운드(`16_21_45` WARNING #2, "scoping 을 명시한다 — 전역 포맷 변경이 아니다")가 지적한 문제를 **포맷 축**에서는 해소했으나, 이번 diff 로 새로 생긴 **키 축**(DEFAULT_SENSITIVE_KEYS 확장)의 동일한 모호성은 아직 다루지 않은 잔여로 보인다.
  - 제안: §4.1.1 해당 문단에 "(포맷 기준. `DEFAULT_SENSITIVE_KEYS` 의 `token` 계열 확장은 이 유틸을 공유하는 config echo 등에도 적용되어 새 키가 마스킹 대상에 추가된다 — 마스킹 **범위**는 넓어지고 **포맷**만 불변이다)" 정도의 한 문장을 추가해 CHANGELOG 의 구분을 spec 에도 미러한다. CRITICAL/WARNING 은 아니다 — 코드·테스트·트래커(`spec-sync-external-interaction-api-gaps.md` 신규 항목)·CHANGELOG 모두 이미 정확히 문서화돼 있어 사실 관계 자체는 틀리지 않았고, spec 문장 하나의 정밀도 문제다.

## 확인했으나 문제 없음 (참고)

- **EIA §R17 "잔여 ③" 종결**: 원래 "어느 의미가 우선하는지는 별도 결정" 으로 명시적으로 열어 둔 항목을 "유출 차단이 우선" 으로 닫으면서, 기존 경고 문구(*"값-패턴 마스킹을 단순 합성하면 안 된다"*)를 **삭제하지 않고 취소선으로 보존**한 뒤 "당시 옳았다 — 실제로 테스트 6건이 RED 였다"는 새 Rationale 을 덧붙였다. 기각된 대안의 무단 재도입이 아니라 정당하게 예고된 후속 결정이며, 번복 사유가 새 Rationale 로 함께 기록되어 있다(§Rationale 갱신 요건 충족).
- **`잔여 갭은 상속된다` 서술**: `deepRedactSecrets` 가 자격증명 없는 연결 문자열·내부 호스트명·스택 프래그먼트를 의도적으로 통과시킨다는 기존 EIA §R17 원칙과 정합하며, 이전 라운드(`16_21_45` INFO)가 요청한 교차 참조가 실제로 추가돼 있다.
- **순서 원칙("키 먼저, 값 나중")**: 기존 Rationale 이 명시한 원칙과 충돌하지 않는 **신규** 원칙이며, 뒤집으면 두 층이 서로를 지운다는 근거가 코드 주석·spec 양쪽에 일관되게 적혀 있다.
- **`egress-masking.md` 좌표계 표 갱신**: 표 2행 소비처에 "workflow-assistant explore 응답" 을 추가하고 `code:` 두 파일을 등재했다. 바로 아래(기존, 이 PR 범위 밖) `masking-gate-consolidation` 노트와 대비 관계를 스스로 명시해 두 개정 이력이 충돌하지 않는다.
- **트래커 위생**: `spec-sync-external-interaction-api-gaps.md` 가 W1 항목을 닫으면서 자매 갭(`handler-output.adapter.ts` 값 축 잔여)을 **별도 미체크 항목**으로 분리해, "결합 항목을 한 체크박스로 닫으면 나머지가 조용히 사라진다" 패턴을 스스로 회피했다고 명시했다. 재개 신호(사용자 신고·downstream 표현식 소비 확인)도 구체적으로 적혀 있어 유예 근거가 측정 가능하다.
- **이전 라운드 WARNING 전부 재확인 해소**: `16_09_25` WARNING(spec_impact:none 인데 spec SoT 두 문서 미갱신) → planner 턴에서 4개 spec 파일 동기화로 해소. `16_21_45` WARNING(같은 파일 내 "확정된 결정 사항" 표 미갱신) → §4.1.1 근처 표 행에 취소선 + "2026-08-23 결정으로 대체" 로 해소. `16_21_45` INFO(취소선 포맷 통일) → `~~잔여 ③~~ 해소 (2026-08-23)` 형태로 기존 관행과 일치.

## 요약

target diff(`spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 마스킹 규칙 및 그 파급을 받는 `spec/5-system/14-external-interaction-api.md` §R17·`spec/conventions/egress-masking.md`)는 EIA §R17 이 명시적으로 "별도 결정" 으로 열어 둔 항목을 정당하게 닫는 것이며, 기존 경고를 삭제 없이 취소선으로 보존하고 번복 사유(유출 차단 우선, 실측 테스트 RED 이력 포함)를 새 Rationale 로 함께 남겨 CLAUDE.md/MEMORY 가 요구하는 "결정 번복 시 새 Rationale 동반" 원칙을 충실히 지켰다. 이전 두 라운드(`16_09_25` MEDIUM, `16_21_45` LOW)가 지적한 WARNING·INFO 는 이번 diff 에서 전부 실제로 해소된 것을 코드·spec 텍스트 대조로 확인했다. 유일한 잔여는 §4.1.1 의 "다른 소비처는 영향을 받지 않는다" 문구가 `DEFAULT_SENSITIVE_KEYS`(공유 상수) 확장이 config echo 의 마스킹 **범위**에는 실제로 영향을 준다는 사실(CHANGELOG·핸들러 canary 테스트가 이미 정확히 문서화)과 미묘하게 어긋나 보일 수 있다는 정밀도 문제이며, CRITICAL/WARNING 급 대안 재도입이나 원칙 위반은 발견되지 않았다.

## 위험도

LOW
