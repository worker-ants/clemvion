# Rationale 연속성 검토 — spec/5-system/ (--impl-prep, assistant-mask-leak)

## 발견사항

- **[WARNING]** EIA §R17 "잔여 ③" 이 명시적으로 미결정으로 남긴 트레이드오프를 지금 뒤집으면서, 그 SoT 두 문서(spec)의 Rationale·본문은 갱신 계획이 없다 (`spec_impact: none`)
  - target 위치: `plan/in-progress/assistant-mask-leak.md` — frontmatter `spec_impact: none`, 본문 "표면별로 강도를 나눈다" 절(`explore-tools.service.ts` 에 `deepRedactSecrets` 중첩), "기존 단언 6개가 바뀐다" 절, 작업 체크리스트(spec 갱신 항목 부재)
  - 과거 결정 출처:
    - `spec/5-system/14-external-interaction-api.md` `## Rationale` → §R17 "잔여 ③ (범위 밖 유지)": *"workflow-assistant LLM 도구(`explore-tools.service.ts`)는 … 여기에 값-패턴 마스킹을 **단순 합성하면 안 된다** — 그 함수는 자격증명 키를 `****9876` 처럼 **접미 힌트를 남겨** 어떤 키가 가려졌는지 식별하게 하는데, 값-패턴 마스킹을 겹치면 그 힌트가 사라진다(기존 테스트가 이 회귀를 잡는다). **어느 의미가 우선하는지는 별도 결정이라 분리했다.**"*
    - SoT 병행 문서 `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 "마스킹 규칙"(요구사항 ID `ED-AI-37`): *"매칭된 값이 문자열이면 `"****<last4>"` 로 … 치환"* — target 이 이 포맷을 `***` 로 바꾸므로 이 문장이 구현과 어긋나게 된다.
    - 같은 결정을 "결정 항목"으로 명시 등재한 트래커 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (`17_12_34` requirement W1): *"두 마스킹 의미 중 이 표면에서 무엇이 우선인지가 **결정 항목**이다 … 그 결정 없이 넓히면 여기서 또 되돌리게 된다."*
  - 상세: target plan 은 "사용자 결정(2026-08-23): 유출 차단이 우선" 이라는 새 rationale 을 **plan 파일 안에서만** 기록하고 `deepRedactSecrets` 를 `explore-tools.service.ts` 위에 중첩해 `****<last4>` → `***` 로 마스킹 형태를 바꾼다. 이 결정 자체는 EIA §R17 이 "별도 결정 필요" 로 명시적으로 열어 둔 항목을 닫는 정당한 후속이라 **대안 재도입(CRITICAL)에는 해당하지 않는다** — 다만 두 spec 문서(EIA §R17 "범위 밖 유지" 서술, ai-assistant.md §4.1.1 `ED-AI-37` 의 `****<last4>` 서술)는 구현 완료 후 사실과 어긋나는 채로 남는다. `spec/` 은 developer 쓰기 권한 밖이고(`CLAUDE.md` Skill 표), "결정의 배경·근거"는 관례상 plan 파일이 아니라 **해당 spec 문서 끝의 `## Rationale`** 에 두어야 한다(`CLAUDE.md` "정보 저장 위치"). 현재 체크리스트에는 이 두 문서의 spec 갱신(Rationale 종결 기록 + §4.1.1 본문 정정) 또는 project-planner 위임 단계가 없고, frontmatter 는 `spec_impact: none` 으로 선언돼 있어 "spec 변경 불요"라는 상반된 신호를 낸다.
  - 제안: `spec_impact` 를 `[spec/5-system/14-external-interaction-api.md, spec/3-workflow-editor/4-ai-assistant.md]` 로 갱신하고, 구현 완료 직후(같은 세션이든 후속 PR 이든) project-planner 턴으로 (a) EIA §R17 "잔여 ③"을 "결정 완료(2026-08-23, 유출 차단 우선)"로 종결 기록, (b) `4-ai-assistant.md` §4.1.1 을 `***`(last4 미보존) 서술로 정정, (c) 트래커 `17_12_34` W1 항목을 해소 처리하도록 이어간다. developer 단계에서 즉시 spec 을 못 고치더라도, 최소한 plan 체크리스트에 "spec Rationale 갱신 (project-planner 위임)" 항목을 명시해 두어야 `spec_impact: none` 과의 모순이 남지 않는다.

- **[INFO]** `DEFAULT_SENSITIVE_KEYS` token 계열 확장은 기존 Rationale 이 명시적으로 예고한 잔여 갭을 닫는 것으로, 연속성 위반이 아님(참고용 확인)
  - target 위치: `plan/in-progress/assistant-mask-leak.md` "작업" 체크리스트 — `DEFAULT_SENSITIVE_KEYS` 에 token 계열 추가
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §Rationale "`token` 계열 확장(2026-08-17)": *"이 확장은 잔여 ③ 에 미치지 않는다 — `maskSensitiveFields` 의 키 목록은 리터럴 나열이라 접두 계열이 **아직 통과한다**."*
  - 상세: 이 문장은 `DEFAULT_SENSITIVE_KEYS`(=`maskSensitiveFields` 가 쓰는 리터럴 키 목록)가 `csrf_token`/`auth_token`/`session_token`/`csrfToken` 등 token 접두 계열을 아직 못 막는다는 **알려진 갭으로 명시 기록**돼 있다. target 의 "DEFAULT_SENSITIVE_KEYS 에 token 계열 추가"는 이 문서가 예고한 갭을 정확히 닫는 작업이라 대안 재도입도 원칙 위반도 아니다. 단, 이 목록은 `handler-output.adapter.ts`(config echo)와 `explore-tools.service.ts` 양쪽이 공유하므로, 확장 시 `4-ai-assistant.md` §4.1.1 의 "매칭 키" 나열(`apiKey, api_key, password, token, accessToken, refreshToken, secret, clientSecret, authorization`)도 함께 낡는다 — 위 WARNING 의 spec 갱신 범위에 이 목록 갱신도 포함해야 한다.
  - 제안: 별도 조치 불요 — 위 WARNING 의 spec 갱신 작업에 이 키 목록 정정을 병합해서 처리하면 된다.

## 요약

target(assistant-mask-leak 구현 계획)이 뒤집는 결정 — `explore-tools.service.ts` 에 값-패턴 마스킹(`deepRedactSecrets`)을 겹쳐 `****<last4>` 힌트를 잃고 `***` 로 통일하는 것 — 은 `spec/5-system/14-external-interaction-api.md` `## Rationale` §R17 "잔여 ③"이 명시적으로 "별도 결정 필요"로 열어 둔 항목이며, 트래커(`spec-sync-external-interaction-api-gaps.md` W1)도 같은 문구로 이를 "결정 항목"이라 못 박아 뒀다. 오늘 날짜(2026-08-23)로 그 결정이 내려졌다는 점에서 이는 **기각된 대안의 무단 재도입이 아니라 정당하게 예고된 후속 결정**이지만, 그 결정의 근거는 plan 파일에만 적혀 있고 SoT 인 두 spec 문서(EIA §R17, `4-ai-assistant.md` §4.1.1/`ED-AI-37`)는 구현 후에도 예전 서술(`****<last4>`, "범위 밖 유지")을 그대로 유지한 채 `spec_impact: none` 으로 선언돼 있다. 이는 "결정 번복이 의도된 것 같으나 새 Rationale(spec 쪽) 부재" 패턴에 정확히 해당해 WARNING 이다. `DEFAULT_SENSITIVE_KEYS` token 계열 확장은 같은 Rationale 이 예고한 잔여 갭을 닫는 것이라 그 자체로는 문제없다(같은 spec 갱신에 병합 가능).

## 위험도

MEDIUM
