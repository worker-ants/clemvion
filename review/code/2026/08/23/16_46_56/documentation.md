# 문서화(Documentation) 리뷰 — assistant-mask-leak

## 발견사항

- **[WARNING]** `CHANGELOG.md` 에 이번 변경(마스킹 포맷 `****<last4>` → `***`, 자유 텍스트 값 축 마스킹 신설)에 대한 항목이 없다
  - 위치: `CHANGELOG.md` (신규 섹션 부재 — 참고: 기존 `## Unreleased — \`token\` 계열이 값·키 두 축에서 마스킹 없이 나가고 있었다` 항목, 116번째 줄 부근)
  - 상세: 이 저장소의 `CHANGELOG.md` 는 마스킹·보안 관련 동작 변경을 거의 예외 없이 "Unreleased" 항목으로 기록해 왔다(예: 마커 재제출 거부, `token` 계열 확장, 종결 이벤트 자격증명 마스킹 등 다수). 특히 위에 인용한 기존 항목은 **바로 이 PR 이 닫는 갭을 명시적으로 예고**하고 있다 — *"`maskSensitiveFields` 는 닫지 않았다 — workflow-assistant 트래커 항목이 소유하고 마스킹 형태도 다르다(`****<last4>` vs `***`). 대신 이번 실측을 그 항목에 증거로 덧붙였다."* 그런데 이번 PR 은 정확히 그 항목을 닫으면서도(`plan/in-progress/spec-sync-external-interaction-api-gaps.md` W1 종결) `CHANGELOG.md` 에는 대응 항목을 추가하지 않았다. 사용자에게 보이는 마스킹 힌트(마지막 4자)가 사라지는 **관측 가능한 동작 변경**이고, 자격증명 유출을 막는 **보안 수정**이기도 해 이 저장소의 기존 관례(entry 패턴) 양쪽에 다 해당한다.
  - 제안: `CHANGELOG.md` 에 "Unreleased" 섹션을 추가한다 — (a) workflow-assistant `get_execution_details`/`get_workflow_executions` 응답의 `inputData`/`outputData`/`error` 가 이제 `deepRedactSecrets` 를 겹쳐 값 축(자유 텍스트 안 `Bearer …`/자격증명 URI)까지 가린다, (b) 그 결과 마스킹 포맷이 `"****<last4>"` 에서 `"***"` 로 바뀌어 식별 힌트를 잃는다(트레이드오프 근거 포함), (c) `DEFAULT_SENSITIVE_KEYS` 가 `token` 접두 계열(`csrf_token` 등) 8개를 추가로 흡수한다(자매 표면 `handler-output.adapter.ts` 에도 영향). 기존 항목(116줄)과 상호 참조하면 독자가 "왜 그때 안 닫혔고 지금 닫혔는지" 를 이어서 읽을 수 있다.

- **[INFO]** LLM 도구 설명(tool description)·system prompt 가 새 마스킹 메커니즘(값 패턴 축)을 반영하지 못해 "키만 가려진다"는 인상을 준다
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/tool-definitions.ts:170` (`get_execution_details` 의 `description` 필드: `"Sensitive fields (apiKey, token, password, secret, authorization, etc.) are auto-masked server-side."`), `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts:234` (`"Per-node \`inputData\` / \`outputData\` / \`error\` are auto-masked for sensitive keys."`)
  - 상세: 이 두 문자열은 LLM 이 도구 출력을 해석할 때 참고하는 사실상의 "API 문서"다. 이번 PR 전에는 정확했다(키 이름 매칭만 존재). 이번 PR 로 `redactAssistantFields` 가 `deepRedactSecrets` 를 겹쳐 **키 이름과 무관하게 문자열 값 안의 자격증명 패턴**(예: `error.detail: "connect failed: postgres://***@db.internal/prod"` — `detail` 은 sensitive key 목록에 없음)까지 가리게 됐다. 그런데 두 설명 모두 "sensitive fields/keys" 라는 표현을 그대로 유지해, "필드 이름이 민감 목록에 있을 때만 가려진다"는 함의가 남아 있다. 기능적 결함은 아니지만(과소 마스킹 방향이 아니라 과다 마스킹 방향이라 안전 쪽), LLM 이 어떤 필드가 왜 `***` 로 나왔는지 잘못 추론할 여지가 생긴다(예: sensitive 하지 않은 필드가 부분적으로 `***` 로 나오면 "필드명이 sensitive 목록에 있나?" 라고 잘못 판단할 수 있음).
  - 제안: 두 문자열에 "자유 텍스트 안에 박힌 자격증명 패턴도 값 기준으로 가려질 수 있다"는 취지를 한 구절 추가한다(필수는 아니며, `redactAssistantFields` JSDoc 의 "왜 두 겹인가" 요지를 짧게 재사용 가능).

- **[INFO]** 같은 문단 안에서 상호 참조 링크 스타일이 일관되지 않는다 — `EIA §R17` 은 실제 링크, `egress-masking.md` 는 텍스트 언급뿐
  - 위치: `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 "마스킹 규칙" 문단(`"값 패턴 기반 \`deepRedactSecrets\`(Egress 마스킹 좌표계 참조)"`)과 바로 아래 "잔여 갭은 상속된다" 문단(`"— [EIA §R17](../5-system/14-external-interaction-api.md) 참조"`)
  - 상세: 같은 섹션 안에서 EIA §R17 참조는 마크다운 링크(`[EIA §R17](../5-system/14-external-interaction-api.md)`)로 처리됐지만, `egress-masking.md` 참조는 `"(Egress 마스킹 좌표계 참조)"` 라는 평문일 뿐 링크가 아니다. 이전 라운드의 consistency-check(`16_21_45` convention_compliance WARNING/INFO #5)가 "`[Egress 마스킹 좌표계](../conventions/egress-masking.md)` 한 줄 추가(필수 아님)"를 제안했고, 텍스트 언급은 추가됐으나 실제 하이퍼링크로는 반영되지 않았다.
  - 제안: `(Egress 마스킹 좌표계 참조)` 를 `([Egress 마스킹 좌표계](../conventions/egress-masking.md) 참조)` 로 링크화하면 좌표계 SoT 로의 발견성이 개선된다. 급하지 않음(이전 리뷰도 "필수 아님"으로 분류).

## 확인했지만 문제 없음 (참고)

- `mask-sensitive-fields.util.ts` `DEFAULT_SENSITIVE_KEYS` 신규 8개 항목 + `maskSensitiveFields` 함수 JSDoc: 왜/무엇을/어떻게 넓혔는지, 완전 일치 제약, 자매 상수(`CREDENTIAL_KEY_PATTERN`)와의 관계까지 인라인 주석으로 충분히 설명됨. 함수 자체 JSDoc(포맷·재귀·비파괴 계약)은 이번 변경으로 깨지지 않아 갱신 불요.
- `explore-tools.service.ts` 신설 `redactAssistantFields` 의 JSDoc: "왜 두 겹인가", "식별 힌트를 잃는 의도된 트레이드", "순서가 의미를 정한다" 세 절로 설계 의도·트레이드오프·불변식(키 먼저, 값 나중)을 모두 설명 — 이 저장소 기준으로 모범적인 수준.
- `mask-sensitive-fields.util.spec.ts` / `explore-tools.service.spec.ts` 신규 캐너리(무수정 프로브로 실증한 두 형태 고정, 대조군 포함)에 "왜 이 자리에 캐너리를 두는가"까지 주석으로 남겨 재발견 비용을 낮춤.
- `plan/in-progress/assistant-mask-leak.md`, `spec-update-assistant-masking.md`, `spec-sync-external-interaction-api-gaps.md` 갱신분: 사용자 결정·근거·뮤테이션 예측/실측·처분(같은 PR 안 planner 턴)까지 상세히 기록됨.
- spec 4개 파일(`4-ai-assistant.md` §4.1.1 + `:1432` 결정 메모, `14-external-interaction-api.md` §R17 잔여③, `_product-overview.md` EH-NAV-04, `egress-masking.md` §1 표+`code:`)은 두 차례 consistency-check(1차 BLOCK:YES CRITICAL 1, 2차 BLOCK:NO WARNING 5)가 지적한 항목을 모두 반영한 상태로 확인됨(EH-NAV-04 갱신, §1432 결정 메모 동기화, §R17 캐비엇 취소선 처리+통일된 포맷, egress-masking.md 표 갱신+§3 판단 근거, 잔여 갭 상속 문장, scoping 명시 문장 전부 diff 에 존재).
- 코드 전체(`explore-tools.service.ts`) grep 결과 `maskSensitiveFields`/`deepRedactSecrets`/`****` 관련 코멘트가 서로 모순되지 않음. `explore-tools.service.spec.ts` 전체에 옛 포맷(`****...`) 잔존 단언 없음(주석·단언 정확성 통과).
- `sanitize-error-message.ts`/`websocket.service.ts` 의 "bare `token` 만 있고 접두형이 빠져 있었다" 류 주석은 이번 diff 대상이 아닌 **별도(2026-08-17) 라운드**에서 이미 닫힌 자매 표면에 대한 과거형 서술이라 여전히 정확함 — stale 아님.
- README(`codebase/packages/masked-markers/README.md` 등) 는 마커 집합·소비처 판정 기준을 다루는 일반 문서이고 소비처 전수 목록의 SoT 는 `egress-masking.md` 로 이미 분리돼 있어 이번 신규 소비처(`explore-tools.service.ts`) 추가로 인한 갱신 의무 없음.

## 요약

코드·인라인 주석·JSDoc·spec(4개 파일)·plan 트래커까지 이 저장소 기준으로 매우 촘촘하게 문서화된 PR이다. 두 차례 consistency-check 가 지적한 spec 동기화 항목(포맷 변경, scoping, 잔여 갭 상속, 결정 메모 표, egress-masking 좌표계 표, EH-NAV-04)은 모두 반영이 확인됐다. 다만 이 저장소가 마스킹/보안류 동작 변경마다 꾸준히 남겨 온 `CHANGELOG.md` 관례를 이번 PR 만 건너뛰었고, 특히 기존 CHANGELOG 항목이 이 PR 이 닫는 갭을 직접 예고해 뒀다는 점에서 이 누락은 우선 보완할 가치가 있다(WARNING). 그 외에는 LLM 도구 설명 문자열의 미세한 불완전성과 문서 내 링크 스타일 불일치 정도의 경미한 INFO 만 남는다.

## 위험도

LOW
