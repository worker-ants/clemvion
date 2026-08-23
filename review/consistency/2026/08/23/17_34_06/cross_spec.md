# Cross-Spec 일관성 검토 — `spec/3-workflow-editor/` (--impl-done)

## 컨텍스트

이 브랜치(`claude/assistant-mask-leak-e36aa6`, origin/main 대비 5 commit)는 workflow-assistant
LLM 탐색 도구의 마스킹을 `maskSensitiveFields`(키 축) 단일 적용에서 `deepRedactSecrets(마스킹
결과)`(값 축 + `token` 계열 키 축) 중첩으로 강화했다. 이번이 세 번째 cross-spec 라운드다 —
1차(`16_09_25`, `--impl-prep`)는 `4-ai-assistant.md §4.1.1`/EIA §R17 잔여③ 미동기화를
**CRITICAL** 로 판정해 착수를 차단했고, 2차(`16_21_45`)는 그 spec 동기화 초안을 검토해
**WARNING 2 건**(EH-NAV-04 stale 주석, §4.1.1 scoping 문구 누락)을 냈다. 실제 반영된 diff
(`git diff origin/main...HEAD`)를 코드·spec 양쪽에서 직접 대조한 결과, 두 WARNING 모두 이번
커밋에서 해소되어 있다.

## 발견사항

이번 라운드에서 신규 CRITICAL/WARNING 은 발견되지 않았다. 확인한 항목:

- **[해소 확인]** EH-NAV-04 구현 상태 주석 동기화 — `spec/2-navigation/_product-overview.md:265`
  가 "**키 축 + 값 축 2중 마스킹**(`maskSensitiveFields` + `deepRedactSecrets`, 출력 `***`)"
  로 갱신됨. `16_21_45` WARNING 1 이 정확히 이 지점을 지적했고 diff 로 반영이 확인된다.
- **[해소 확인]** `maskSensitiveFields` 전역 포맷 불변 scoping 문구 — `4-ai-assistant.md` §4.1.1
  에 "이 포맷은 이 도구의 로컬 합성 결과다 … 그 유틸을 공유하는 다른 소비처(AI Agent 노드 ·
  노드 `config` echo boundary)는 영향을 받지 않는다" 가 추가됨. `16_21_45` WARNING 2 가 요구한
  정확히 그 문장이다. `spec/4-nodes/3-ai/1-ai-agent.md`(480/755/979/1114행)·
  `spec/2-navigation/14-execution-history.md:469`·`spec/5-system/4-execution-engine.md`·
  `spec/conventions/node-output.md:219` 등 같은 `maskSensitiveFields` 를 인용하는 문서들과
  대조했을 때, 이 scoping 문구 덕분에 "전역 포맷 변경" 으로 오독될 위험이 제거됐다.
- **[해소 확인]** EIA §R17 "잔여 ③" — `spec/5-system/14-external-interaction-api.md:1649-1668`
  가 취소선 + "해소 (2026-08-23)" 로 갱신되고 "유출 차단이 우선" 결정 근거·트레이드오프
  (`****9876` 식별 힌트 상실, 키 이름은 보존)를 명문화. `4-ai-assistant.md §4.1.1` 의 서술과
  상호 참조가 정확히 맞물린다(양쪽 다 "키 이름 보존, 값 last4 힌트만 상실"을 동일하게 서술).
  `spec/**` 전체에서 "잔여③/잔여 ③" 을 인용하는 곳은 이 파일 자기 자신뿐이라 flip 이 다른
  문서의 동기화 누락을 유발하지 않는다(실측).
- **[해소 확인]** `spec/conventions/egress-masking.md` §1 좌표계 표 2행에 신규 소비처
  "workflow-assistant explore 응답" 이 추가되고 `code:` frontmatter 에
  `explore-tools.service.ts` · `mask-sensitive-fields.util.ts` 두 파일이 등재됨(`16_09_25`
  WARNING 이 요구한 갱신). §3 에 이번 갱신을 "실례"로 기록해 문서 self-audit 이력도 남겼다.
- **[확인, 문제 없음]** `DEFAULT_SENSITIVE_KEYS` 확장(csrfToken/authToken/sessionToken/idToken
  등 8개 추가)은 `maskSensitiveFields` 를 공유하는 전역 소비처(AI Agent 자격증명 strip,
  `handler-output.adapter.ts` config echo boundary)에도 적용되지만, `spec/4-nodes/**` 어디에도
  이 키 목록을 리터럴로 못박은 서술이 없고 노드 config 스키마와 이름이 겹치는 정적 필드도
  없다(grep 0건, `mask-sensitive-fields.util.ts` 신규 주석이 이 실측을 코드에도 남김). 잔여
  위험(사용자 정의 `headers`/`body` 키가 우연히 겹치는 경우)은 `spec-sync-external-interaction-
  api-gaps.md` 에 별도 백로그 항목으로 정직하게 등재되어 있어 spec 서술과 실제 보장 범위가
  일치한다("문서한 보장이 구현보다 넓지 않다").
- **요구사항 ID 충돌**: 없음. `ED-AI-37`(`_product-overview.md:237`, `4-ai-assistant.md:789`
  부근)은 "민감 필드는 서버가 자동 마스킹 후 반환" 이라는 포맷-불가지론적 서술이라 이번 포맷
  변경과 모순되지 않는다. `ED-AI-35~38`/`EH-NAV-04` 도 동일 의미로만 재사용된다.
- **데이터 모델 충돌**: 없음. `spec/1-data-model.md` §2.20/§2.22(`AssistantSession`/
  `AssistantMessage`)는 마스킹 상세를 서술하지 않고 SoT 를 `4-ai-assistant.md`/EIA §R17 로
  위임하는 구조라 이번 변경에 영향받지 않는다. `Execution.input_data`/`NodeExecution.input_data`
  행도 "표면 목록·개수를 여기 다시 적지 않는다 — SoT 는 EIA §R17" 을 이미 명시해 drift 를
  구조적으로 차단해 두었다.
- **API 계약 충돌**: 없음. `get_execution_details` 응답 shape(`inputData: unknown` 등 타입)은
  불변 — 런타임에 마스킹되는 문자열 표기만 `"****<last4>"` → `"***"` 로 바뀌었고, 이는 §4.1.1
  자체가 SoT 인 wire 계약이라 자기 문서 안에서 갱신됨.
- **상태 전이 / RBAC / 계층 책임 충돌**: 없음. 상태 머신·엔드포인트 method/path·역할 게이팅은
  건드리지 않는다. `explore-tools.service.ts` 가 `shared/utils/sanitize-error-message.ts` 의
  `deepRedactSecrets` 를 import 하는 것도 기존 선례(WS `sanitizePayloadForWs`, MCP client
  `sanitizeMcpErrorMessage` — `spec/5-system/11-mcp-client.md:485,604` 참고)와 동일한 "공용
  secret 패턴 SoT 재사용" 패턴이라 계층 책임 분할과 충돌하지 않는다.

## 요약

이번 target 작업은 이미 두 차례의 cross-spec 라운드(1차 CRITICAL 차단 → 2차 WARNING 2건)를
거쳐 `spec/3-workflow-editor/4-ai-assistant.md`·`spec/5-system/14-external-interaction-api.md`·
`spec/2-navigation/_product-overview.md`·`spec/conventions/egress-masking.md` 네 파일을 원자적
으로 갱신했고, 실제 diff 대조 결과 지적됐던 두 WARNING 모두 정확히 요구된 형태로 반영되어
있다. 코드(`mask-sensitive-fields.util.ts`, `explore-tools.service.ts`)와 spec 서술(마스킹
순서 "키 먼저 값 나중", 포맷 `"***"`, scoping 한정)도 1:1로 대응한다. `spec/1-data-model.md`·
`spec/4-nodes/3-ai/1-ai-agent.md`·`spec/2-navigation/14-execution-history.md`·
`spec/5-system/4-execution-engine.md`·`spec/conventions/node-output.md`·
`spec/5-system/11-mcp-client.md` 등 같은 마스킹 유틸/패턴을 인용하는 인접 영역과도 직접
모순이 없으며, 정적 분석의 구조적 한계(사용자 정의 config 키 충돌 가능성)는 은폐하지 않고
`spec-sync-external-interaction-api-gaps.md` 트래커에 별도 항목으로 정직하게 남겨 두었다.
신규 CRITICAL·WARNING 을 발견하지 못했다.

## 위험도

NONE
