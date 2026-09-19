# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보(디스크 기존 파일과 인라인 전문 일치, 재시도 필요 항목 없음). CRITICAL 발견 0건.

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 5건은 전부 target(`spec/4-nodes/4-integration/`) 자체가 아니라 다른 spec/convention 문서의 stale 상태이거나 절차적 기록 누락이며, 착수하려는 `ssrf-guard-integration-unify` 플랜(코드 전용, `spec_impact: none`)의 진행을 막지 않는다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — CRITICAL 발견 자체가 없어 인계 대상 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `IntegrationsService.logUsage` TS 시그니처가 INT-US-05 `api` 필드를 빠뜨린 stale 선언 | `spec/5-system/4-execution-engine.md` §10.1 | `spec/4-nodes/4-integration/0-common.md` §4.1, `spec/1-data-model.md` §2.10.1, `spec/5-system/11-mcp-client.md` | §10.1 TS 선언에 `api?: {label?; method?; path?}` 추가. spec 쓰기이므로 project-planner 턴 필요 |
| 2 | cross_spec | chat-channel 실행 실패 분류표가 `INTEGRATION_*`/`CAFE24_*`/`MAKESHOP_*`/`EMAIL_HOST_BLOCKED` 미커버 — `CAFE24_RATE_LIMITED`/`MAKESHOP_RATE_LIMITED` 가 rate-limit 대신 internal 로 오분류 가능 | `spec/conventions/chat-channel-adapter.md` §3.1 | `spec/4-nodes/4-integration/{0-common,3-send-email,4-cafe24,5-makeshop}.md` 에러 코드 정의 | `INTEGRATION_*`/`EMAIL_HOST_BLOCKED` 와일드카드 행 추가, `CAFE24_RATE_LIMITED`/`MAKESHOP_RATE_LIMITED` 를 `executionFailedRateLimit` 행에 합류. spec 쓰기이므로 project-planner 턴 필요(제품 우선순위 판단 병행) |
| 3 | convention_compliance | `meta.rowCount` 중복 허용 여부에 대해 상위 규약(`node-output.md` Principle 2)·형제 문서(`0-common.md` §6)가 "허용" 이라 적은 반면, 정작 그 필드를 정의하는 `2-database-query.md` §5.1 은 "중복 금지" 로 명시적 반대 결정을 내림 | `spec/conventions/node-output.md` Principle 2 표, `spec/4-nodes/4-integration/0-common.md` §6 표 | `spec/4-nodes/4-integration/2-database-query.md` §5.1 (최신 결정) | `node-output.md` DB 행에서 `meta.rowCount` 제거(또는 "폐기됨 — §5.1 참조" 각주), `0-common.md` §6 문구 동기화. `spec/conventions/**` 쓰기이므로 project-planner 턴 필요 |
| 4 | convention_compliance | `send_email` 이 `node-output.md` Principle 5 표에서 "port: undefined(단일 출력)" 로 분류돼 있으나, 같은 문서 Principle 3.3·D4 는 send_email 에 `error` 포트 의무화 — target(`3-send-email.md`) 은 Principle 3.3 을 정확히 따르는 중 | `spec/conventions/node-output.md` Principle 5 표 (target 문서 수정 불필요) | `spec/conventions/node-output.md` Principle 3.3 / D4 결정 (같은 문서 내부 모순) | Principle 5 표에서 `send_email` 을 "port: undefined" 행에서 제거해 "port: string" 행으로 이동. `spec/conventions/**` 쓰기이므로 project-planner 턴 필요 |
| 5 | plan_coherence | `spec-draft-nullable-notation-followups.md` 트래커에 `developer→planner` 로 명시 escalate 된 SMTP CGNAT 항목을, `ssrf-guard-integration-unify` 플랜이 planner 턴 없이 developer 단독 판단으로 해소 — 결론(spec 문언이 이미 정확·명확해 spec 변경 자체가 없음)은 타당하나 그 근거가 트래커 종결 문장에 기록돼 있지 않음 | `plan/in-progress/ssrf-guard-integration-unify.md` "할 것" §1~§2 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4777-4779` (`developer→planner` 태그 항목) | 트래커 항목 체크 시 "spec 문장(§5.5·§4 step7)이 이미 명확·정확함을 확인 → spec 변경 불필요 → planner 턴 생략, `plan/complete/ssrf-guard-integration-unify.md` 참조" 한 줄을 명시해 우회가 아닌 의도적 생략임을 문서로 고정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | SSRF 가드는 실제로 3개 독립 메커니즘(HTTP/DB, SMTP, LLM Client)인데 target 콜아웃은 통합 노드 vs MCP 두 갈래로만 대조 | `1-http-request.md` §4 말미 콜아웃 vs `spec/5-system/7-llm-client.md` §5.5 | 여유 있으면 "LLM Client 는 별도 독립 SSRF 목록(밴드 상이·opt-out 없음)을 쓰는 세 번째 메커니즘" 한 줄 보강. 필수 아님 |
| 2 | rationale_continuity | SSRF 가드 통합은 기각된 대안(`SMTP_BLOCK_PRIVATE_HOSTS`) 재도입이 아니라 그 잔재(코드 주석) 제거 방향 — Rationale 연속성 정합 확인 | `plan/in-progress/ssrf-guard-integration-unify.md` §"할 것" 3번, `spec/2-navigation/4-integration.md` Rationale | 정정 커밋 본문에 "과거 기각된 `SMTP_BLOCK_PRIVATE_HOSTS` 흔적 제거" 명시 권장 |
| 3 | rationale_continuity | `http-safety`/`ssrf.util` 이원화 해소는 여러 Rationale(§8.2·§8.3·DB_HOST_BLOCKED 신설·SMTP 통일)이 반복 못박은 "SSRF posture 일관성" 원칙의 자연스러운 다음 단계 | `1-http-request.md` §8.2·§8.3, `2-database-query.md` Rationale, `2-navigation/4-integration.md` Rationale | 없음 — 계획대로 진행. `error-codes.ts` 주석이 이번 변경으로 "참" 이 되었다는 실측을 커밋 메시지에 남기면 향후 spec-coverage 감사 재부각 방지 |
| 4 | rationale_continuity | DNS 해석 실패 시 fail-open 유지가 어느 spec Rationale 에도 명문화돼 있지 않은 암묵적 invariant | `1-http-request.md` §4-8, `3-send-email.md` §4-7, `2-database-query.md` §4 | 필수 아님 — 여유 있으면 판정기 Rationale 에 "DNS 해석 실패 시 차단하지 않는다(가용성 우선)" 한 줄 추가 |
| 5 | rationale_continuity | `ssrf.util`(LLM·S3) 비대상 처리 근거가 LLM 전용 사용 패턴에 특정되어 있고 S3 몫은 별도 논증 없이 얹혀 있음 | `plan/in-progress/ssrf-guard-integration-unify.md` §"비대상" 1번 | 트래커 항목 격상 시 S3 제외 사유를 LLM 과 별도로 한 줄 추가 권장. 이번 PR 범위 아님 |
| 6 | convention_compliance | `makeshop` 이 `node-output.md` Principle 3.3 "반드시 error 포트를 갖는 노드" 열거에서 누락(cafe24 는 있음) | `spec/conventions/node-output.md` Principle 3.3 | 열거에 `makeshop` 추가. 차단 사유 아님 |
| 7 | naming_collision | `SMTP_BLOCK_PRIVATE_HOSTS` 는 target 이 도입한 식별자가 아니라 코드 주석·spec 각주에만 남은 phantom 이름이며, 이번 plan 항목 3이 정확히 이를 제거 대상으로 지목 | `codebase/backend/.../send-email.handler.ts:176`, `integrations.service.ts:1594`, `spec/2-navigation/4-integration.md:1228` | 조치 불필요 — 구현 시 이 phantom 이름을 실제 코드/설정 키로 "부활" 시키지 않도록만 주의 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | execution-engine.md §10.1 `logUsage` stale 시그니처(api 누락), chat-channel-adapter.md 분류표 미커버(WARNING 2건) — 둘 다 target 밖 drift |
| rationale_continuity | NONE | 위반 없음 — 이번 통합은 기존 Rationale(§8.2/§8.3/DB_HOST_BLOCKED/SMTP 통일)이 반복 못박은 원칙의 이행. INFO 4건은 보강 제안 |
| convention_compliance | LOW | `node-output.md` 내부 stale 예시 표 2건(`meta.rowCount`, `send_email` 포트 분류) — target 문서는 규약을 정확히 따름 |
| plan_coherence | LOW | `developer→planner` 태그 트래커 항목을 developer 단독 해소하며 근거 미기록(절차적 WARNING). 결론 자체는 타당 |
| naming_collision | NONE | 신규 식별자 도입 없음(`spec_impact: none`). 기존 식별자 재사용 전부 정합. phantom 이름은 plan 이 스스로 제거 대상으로 지목한 기존 결함 |

## 권장 조치사항

1. (BLOCK 없음 — 즉시 착수 가능) `ssrf-guard-integration-unify` 플랜 코드 작업을 진행한다.
2. `spec-draft-nullable-notation-followups.md` 트래커 항목 체크 시, "spec 문언이 이미 정확해 planner 턴 생략" 근거를 한 줄 남긴다(plan_coherence WARNING #5).
3. 별도 project-planner 턴에서 다음 4곳을 정정: (a) `execution-engine.md` §10.1 `logUsage` 시그니처에 `api` 필드 추가, (b) `chat-channel-adapter.md` §3.1 분류표에 `INTEGRATION_*`/`EMAIL_HOST_BLOCKED`/rate-limit 행 보강, (c) `node-output.md` Principle 2 의 `meta.rowCount` DB 행 정정, (d) `node-output.md` Principle 5 의 `send_email` 포트 분류를 Principle 3.3 과 정렬(+ Principle 3.3 열거에 `makeshop` 추가).
4. 여유가 있으면 INFO 항목(LLM Client SSRF 서술 보강, DNS fail-open Rationale 명문화, S3 비대상 근거 개별화)을 함께 처리.
