# 문서화(Documentation) Review

## 발견사항

- **[WARNING] spec 본문(`mcp-client.md` §6.2 / §8.2)이 구현 완료 후에도 여전히 "미구현 (Planned)"로 남아 있음**
  - 위치: `spec/5-system/11-mcp-client.md` §6.2 (라인 353 "구현 현황 (2026-06-14 갱신)" 노트), §8.2 skipReason vocabulary 문단
  - 상세: 본 PR 은 `mcpDiagnostics` 를 `McpServerSummary[]` 단일 배열에서 `attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`serverSummaries`/`errors` 를 모두 갖는 구조화 객체로 완전히 승격했고(`mcp-diagnostics.ts`, `ai-turn-executor.ts`, `mcp-tool-provider.ts` 전부 반영, unit test 통과), `MCP_TIMEOUT`/`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED` 코드 granularity 도 build-phase 전 구간에 emit 된다. 그러나 spec 본문은 여전히 이 필드들을 "본 spec 에 정의되어 있으나 미구현 (Planned)"라고 서술한다 — 코드와 spec 이 지금 이 순간 어긋나 있다.
  - 참고: 이는 실수로 놓친 것이 아니라 `plan/in-progress/spec-sync-mcp-client-gaps.md` 의 "spec 동기화(본 작업의 정식 phase)" 항목으로 이미 명시적으로 추적 중이며, 착수 체크리스트에도 `[ ] spec 동기화 (§6.2/§8.2/1-ai-agent §7.1) + /consistency-check --spec` 로 남아 있고, impl-prep consistency-check(WARNING#1, `review/consistency/2026/07/06/20_59_31/SUMMARY.md`)도 동일 문제를 사전에 포착해 BLOCK 사유가 아니라고 판단했다. 즉 "알고 있는 채무"이며 계획상 다음 phase에서 해소될 예정이다.
  - 제안: 이 PR 이 spec 동기화 phase까지 포함해 완결한다면 지금 `mcp-client.md` §6.2/§8.2 의 "미구현 (Planned)" 문구를 구현 완료로 갱신해야 한다. 만약 이번 PR 은 구현만 포함하고 spec 동기화는 별도 PR로 분리한다면, 이 갭이 방치되는 기간(코드는 구조화 객체를 emit 하는데 spec 은 여전히 미구현이라 서술) 동안 다른 개발자가 spec 을 SoT 로 신뢰해 잘못된 판단을 할 위험이 있다는 점을 PR 설명/커밋 메시지에 명시할 것을 권장.

- **[INFO] `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 예시가 구현 완료로 인해 이제 "선견지명"이 아니라 실제로 정합해짐 — 확인 후 no-op 처리 여지**
  - 위치: `spec/4-nodes/3-ai/1-ai-agent.md` 라인 485-491 (`mcpDiagnostics` JSON 예시)
  - 상세: impl-prep 단계의 cross_spec checker WARNING(리뷰 대상 파일 `review/consistency/.../cross_spec.md`)이 지적했듯, 이 예시는 원래 미구현 필드를 이미 구현된 것처럼 제시하는 문제가 있었다. 이번 구현으로 코드가 실제로 이 shape를 emit하게 되어 예시 자체는 이제 사실과 부합한다. 다만 `serverSummaries[]`가 예시에서 생략되어 있어(`errors[]`만 명시) — 실제 emit 되는 `McpDiagnostics` 타입은 `serverSummaries` 도 항상 포함하므로, 예시를 실제 emit shape와 완전히 맞추는 정합 작업이 spec 동기화 phase에서 함께 처리돼야 한다(plan 문서에도 이미 이 항목 반영됨: "§7.1 라인 485-491 ... 스코프에 포함").
  - 제안: 별도 조치 불필요 — spec 동기화 phase에서 함께 처리 예정임을 확인.

- **[INFO] `with-timeout.ts` 의 `TimeoutError` JSDoc/plan 서술과 실제 소비 범위의 미세한 불일치**
  - 위치: `plan/in-progress/spec-sync-mcp-client-gaps.md` "생산 사이트" 단락 — "`with-timeout.ts` 에 `TimeoutError` class 도입 → 타임아웃 robust 판정(message regex 회피). McpClientService 공유 — 하위호환"
  - 상세: 실제로 `TimeoutError` 를 `instanceof` 로 분류해 소비하는 곳은 `mcp-tool-provider.ts` (`openServer`) 뿐이며, `mcp-client.service.ts` 는 여전히 `err instanceof Error` 의 일반적 처리만 하고 `TimeoutError` 를 특별 취급하지 않는다(grep 결과 무일치). plan 문구의 "McpClientService 공유"는 "같은 `withTimeout`/`TimeoutError` 정의를 두 모듈이 import 해 쓸 수 있다"는 잠재 능력을 말한 것이라면 오해의 소지가 없으나, 문면만 보면 이미 `McpClientService` 쪽에서도 `TimeoutError` 분류를 소비하고 있다는 인상을 준다.
  - 제안: 사소하므로 차단 사유는 아니나, plan 문서를 다듬을 기회가 있다면 "현재는 `McpToolProvider` 만 소비, `McpClientService` 는 후속 확장 여지로 공유 가능한 타입만 정의"로 명확히 하면 좋다.

- **[INFO] `with-timeout.ts` — `TimeoutError` 신규 export 클래스의 JSDoc 품질은 양호**
  - 위치: `codebase/backend/src/common/utils/with-timeout.ts`
  - 상세: 신규 `TimeoutError` 클래스에 "왜 필요한지"(instanceof 로 견고한 분류, message 정규식 매칭 회피), "하위호환성"(여전히 `Error` subclass) 을 설명하는 JSDoc 이 잘 작성되어 있다. 공개 API 문서화 관점에서 모범적.

- **[INFO] `mcp-diagnostics.ts` 모듈·타입 JSDoc — 매우 상세하고 spec 앵커까지 명시, 모범적**
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts`
  - 상세: 모듈 최상단 주석에 변경 이력(`2026-07-06 (spec-sync mcp-client 타입 확장)`)을 날짜와 함께 남기고, `McpDiagnosticError.code` 가 union 이 아니라 `string` 인 이유(외부 MCP vs Internal Bridge 두 vocabulary 공존, spec §2.3 인용)까지 명시해 향후 유지보수자가 "왜 string 인가"를 다시 조사할 필요가 없게 해준다. `finalizeMcpDiagnostics` 의 lean-omit 정책(`attempted` 가 false 면 undefined)도 근거와 함께 문서화됨. call-phase(`tools/call`/`resources/read`/`prompts/get`) 실패의 `errors[]` 누적이 "별도 follow-up"이라는 범위 경계도 정확히 명시되어, 코드만 보고 "왜 execute 단계 실패는 errors[]에 안 쌓이지?" 라는 의문이 들 때 바로 답을 찾을 수 있다. 인라인 주석·설계 근거 문서화 관점에서 이 PR의 강점.

- **[INFO] `ai-turn-executor.ts` 의 change-tracking 주석(`mcpServerSummaries` → `mcpDiagnostics` rename)**
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (여러 지점, 예: `mcpDiagnosticsAcc` 생성부, `buildMcpDiagnosticsMeta` JSDoc)
  - 상세: 필드명 변경(`metadata.mcpServerSummaries` → `metadata.mcpDiagnostics`)에 맞춰 인접 인라인 주석도 갱신되어 있고(예: "MCP 진단 누적(serverSummaries / errors / 호출 카운터)"), stale comment 는 발견되지 않음. `buildMcpDiagnosticsMeta` 의 JSDoc 도 "2026-05-18 시점에는 serverSummaries 만" 이라는 과거 서술에서 "시도됐으면 전체 구조 emit" 으로 정확히 갱신됨.

- **[INFO] CHANGELOG 갱신 대상 없음 확인**
  - 위치: 저장소 전역
  - 상세: 본 프로젝트는 CLAUDE.md 규약상 CHANGELOG.md 파일 대신 `plan/complete/` 이관과 spec frontmatter 를 변경 이력 SoT로 사용하는 구조이며, 실제로 리포에 루트 레벨 CHANGELOG.md 가 없다. `plan/in-progress/spec-sync-mcp-client-gaps.md` 자체가 이 변경의 이력·근거 기록 역할을 충실히 수행하고 있어 별도 CHANGELOG 갱신 불필요.

- **[INFO] 신규 공개 함수(`classifyMcpCall`, `createMcpDiagnosticsAccumulator`, `finalizeMcpDiagnostics`, `pushMcpDiagnosticError`)의 예제 코드**
  - 위치: `mcp-diagnostics.ts` / `mcp-diagnostics.spec.ts`
  - 상세: 별도 사용 예제(README 스니펫 등)는 없으나, `mcp-diagnostics.spec.ts` 의 테스트 케이스들(`classifyMcpCall` 분류 규칙 5종, `finalizeMcpDiagnostics` lean-omit·안정 shape 3종)이 사실상 실행 가능한 사용 예제 역할을 충분히 하고 있어 별도 예제 코드 추가는 불필요.

## 요약

이번 변경은 소스 코드 레벨의 문서화(JSDoc·인라인 주석·모듈 헤더)가 전반적으로 우수하다 — 특히 `mcp-diagnostics.ts`는 타입 설계 근거, 변경 이력, 범위 경계(call-phase errors 미포함)를 정확히 명시해 향후 유지보수 관점에서 모범적이다. 다만 핵심 문제는 spec 레벨: 이 PR로 `mcpDiagnostics`가 완전히 구조화 객체로 구현됐음에도 SoT인 `spec/5-system/11-mcp-client.md` §6.2/§8.2는 아직 "미구현 (Planned)"라고 서술 중이어서, 코드와 spec이 현시점 어긋나 있다. 다행히 이는 실수가 아니라 `plan/in-progress/spec-sync-mcp-client-gaps.md`에 정식 후속 phase(spec 동기화 + `/consistency-check --spec`)로 명시 추적되고 있고, impl-prep consistency-check도 사전에 동일 갭을 WARNING으로 포착해 BLOCK 사유가 아님을 확인했다. 따라서 이 PR 자체를 차단할 사유는 아니되, spec 동기화 phase가 후속 커밋/PR에서 반드시 완결되어야 하며 그전까지는 spec을 신뢰하는 독자에게 오도 위험이 있다는 점을 릴리즈 커뮤니케이션에 반영할 필요가 있다.

## 위험도
LOW
