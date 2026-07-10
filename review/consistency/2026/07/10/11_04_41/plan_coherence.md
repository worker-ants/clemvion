# Plan 정합성 검토 — URI-userinfo SoT 통합 (scheme 보존 + MCP dedup) + 11-mcp-client §8.3 동기화

## 검토 범위 보정

프롬프트 target 다이제스트는 `spec/5-system/`(1-auth.md·10-graph-rag.md 만 노출, 용량 cap 으로 truncate)이지만,
`git diff origin/main...HEAD` 실측 결과 실제 target 은 `spec/5-system/11-mcp-client.md`(§8.2 표 1행 +
§8.3 Rationale 문단) 이며, 코드 변경은 `codebase/backend/src/modules/mcp/mcp-error-codes.ts`(MCP 전용
URL-userinfo 패턴 제거) + `codebase/backend/src/shared/utils/sanitize-error-message.ts`(공용
`SECRET_LEAK_PATTERNS` 의 URI-userinfo 정규식을 scheme-preserving lookbehind/lookahead 로 정밀화) 다.
아래 분석은 두 파일을 절대경로로 직접 재확인하고 `plan/in-progress/**` 전체를 대조해 수행했다
(commit `90ab8f390`→`b48d4c10b`→`078b57e51`, HEAD 기준 origin/main 대비 3개 커밋).

## 발견사항

- **[WARNING]** `spec-sync-mcp-client-gaps.md` 의 `task_fa96e218` 잔여 표기가 이번 diff 로 완전히 해소됐는데도 plan 문서가 갱신되지 않음
  - target 위치: `spec/5-system/11-mcp-client.md` §8.3 Rationale ("에러 message redaction 은 공용 패턴 재사용", L587-589 신규 "2026-07-10 갱신" 문단) + `mcp-error-codes.ts` L39-47 (MCP_EXTRA_SECRET_PATTERNS 에서 URL-userinfo 항목 제거 주석)
  - 관련 plan: `plan/in-progress/spec-sync-mcp-client-gaps.md` L79 — "**잔여(별건 follow-up, plan in-progress 유지)**: call-phase errors[] 누적 / §3.3 capability 캐시 / task_fa96e218(에러 message redaction) / task_947e443e(Rationale 섹션·코드 prefix) / McpClientService TimeoutError 소비"
  - 상세: 직전 세션(`review/consistency/2026/07/10/10_15_22/plan_coherence.md`, PR #886 검토)이 이미 이 항목을 INFO 로 잡아 "`task_fa96e218` 가 이번 신규 shared 패턴과 동일 스코프인지 plan 문서만으로는 확정 불가"라고 유보했다. 이번 diff 는 그 불확실성을 실제로 해소한다 — `mcp-error-codes.ts` 의 MCP 전용 URL-userinfo 패턴(task_fa96e218/PR #842 로 최초 구현된 것)을 명시적으로 제거하고 "공용 SoT 로 통합"이라 주석에 못박았으며, `11-mcp-client.md` §8.3 에도 "MCP 전용으로 남는 것은 bare `token=` 뿐" 이라고 정정했다. 즉 task_fa96e218 의 URL-userinfo 서브스코프는 (a) 이미 `plan/complete/mcp-client-diagnostics-followups.md`(PR #842, 2026-07-07)로 1차 완료됐고, (b) 이번 diff 로 shared SoT 흡수까지 확정돼 완전히 종결됐다. 그런데도 `spec-sync-mcp-client-gaps.md` L79 는 여전히 task_fa96e218 을 "잔여" 로 표기하고 있고, ①(call-phase errors[])·③(task_947e443e)·④(McpClientService TimeoutError) 도 `plan/complete/mcp-client-diagnostics-followups.md` 에서 이미 전부 체크 완료(PR #842)된 항목인데 동일하게 "잔여" 로 남아 있다 — 이번 diff 이전부터의 누적 staleness이나, 이번 diff 가 그 중 하나(task_fa96e218)를 실제로 확정 종결시킨 시점이므로 지금이 정정할 타이밍이다. 방치 시 후속 세션이 "task_fa96e218 이 아직 미해결"로 오인해 중복 조사·중복 작업을 유발할 위험이 있다(§3.3 capability 캐시만 유일한 진짜 미구현 항목인데, 5개 항목이 뭉뚱그려 "잔여"로 보여 구분이 어려움).
  - 제안: `spec-sync-mcp-client-gaps.md` L79 를 갱신 — call-phase errors[]/task_fa96e218/task_947e443e/McpClientService TimeoutError 4항목은 `plan/complete/mcp-client-diagnostics-followups.md`(PR #842) 완료로 표기하고, task_fa96e218 옆에 "URL-userinfo 서브스코프는 2026-07-10 SoT 통합(90ab8f390/b48d4c10b)으로 재확정 종결" 각주를 추가한다. §3.3 capability 캐시만 유일한 실질 잔여로 남긴다. (spec 문서 자체는 이미 정확하므로 target 갱신 불요 — plan 쪽만 정정.)

## 미충돌 확인 (참고)

- `plan/complete/eia-secret-masking-residuals.md`(observer-vs-participant P1-1·DB-at-rest P1-3 등 완료 결정) — 이번 diff 는 매칭 표면을 정밀화(scheme 보존)할 뿐 그 결정들을 재론하거나 우회하지 않는다.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `SECRET_LEAK_PATTERNS`/`userinfo`/`R17` 어떤 키워드도 언급하지 않아 이번 diff 와 무관 (grep 확인).
- `plan/in-progress/http-ssrf-all-auth-followups.md` L20 의 "configEcho userinfo strip" 은 HTTP 노드 전용 별도 메커니즘(`sanitizeUrlCredentials` 계열, node-output 특화 레이어)이며 `shared/utils/sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS` 를 참조하지 않는다 — 별개 메커니즘이라는 §8.3 Rationale ("공용 SoT vs 특화 얇은 레이어") 구조와 일치, 충돌 없음.
- `plan/in-progress/spec-sync-mcp-client-gaps.md` 의 §3.3 credentials.cached_capabilities capability 캐시(유일한 실질 미구현 항목)는 이번 diff 와 무관.
- 이번 diff 자체의 code review 체인(`review/code/2026/07/10/{09_17_14,09_29_31,10_05_20,10_14_41,10_54_39,11_04_04}`)은 INFO→구현→처분까지 자기완결적으로 추적돼 있고 Critical/Warning 0 이며, 이는 target 이 임의로 새 결정을 내린 것이 아니라 이전 리뷰가 명시적으로 분리해 둔 후속 과제(SoT 파편화 제거)를 계획대로 이행한 것임을 뒷받침한다.
- `plan/in-progress/**` 어디에도 "URI-userinfo 는 MCP 전용으로 유지해야 한다"거나 "공용 SoT 로 통합하면 안 된다" 는 결정 필요/미해결 항목이 없다 — CRITICAL(미해결 결정 우회)에 해당하는 항목 없음.

## 요약

이번 diff(URI-userinfo 마스킹을 MCP 전용 → 공용 `SECRET_LEAK_PATTERNS` SoT 로 통합 + scheme 보존 정밀화 + `spec/5-system/11-mcp-client.md` §8.2/§8.3 동기화)는 `plan/in-progress/**` 의 어떤 미해결 결정과도 정면 충돌하지 않으며, 선행 ai-review·consistency 세션(09:17~10:15)이 명시적으로 분리해 둔 SoT 파편화 제거 후속 과제를 정확히 이행한다. 다만 이번 diff 가 `task_fa96e218`(에러 message redaction) 의 URL-userinfo 서브스코프를 사실상 확정 종결시켰음에도 `plan/in-progress/spec-sync-mcp-client-gaps.md` L79 의 "잔여" 목록(task_fa96e218 포함 4항목, 실제로는 PR #842 로 이미 전부 완료)이 갱신되지 않은 채 방치돼 있다 — 직전 세션의 INFO(불확실성으로 인한 유보)를 이번 diff 가 사실관계로 해소했으므로 지금은 plan 갱신이 필요한 WARNING 으로 격상해 기록한다. target(spec) 자체의 정확성에는 문제가 없다.

## 위험도

MEDIUM
