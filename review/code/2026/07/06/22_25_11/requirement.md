### 발견사항

- **[INFO]** `McpErrorPhase` 유니온에 `'initialize'` 값이 선언돼 있으나 어디서도 emit 되지 않음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts:56-61` (`McpErrorPhase` 타입), `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` (`McpBuildPhaseError` 생성 지점 전체)
  - 상세: spec §8.2 는 "SDK 가 connect 와 initialize 를 하나의 호출로 묶어 처리하므로 두 단계를 의미적으로 분리하기 어려움" 이라 명시하고, 실제 구현도 connect+initialize 실패를 모두 `phase: 'connect'` 로만 태깅한다 (`mcp-tool-provider.ts` L678-684, L658-664). `'initialize'` 는 타입에만 존재하고 실제 코드 경로에서 결코 선택되지 않는 dead literal이다. 기능적 버그는 아니며 (spec 이 이 축약을 명시적으로 정당화함), 단지 타입 정의가 실제 상태 공간보다 넓다.
  - 제안: 사소한 정리 사안. 굳이 고칠 필요는 없으나, 다음 관련 변경 시 `'initialize'` 리터럴을 유니온에서 제거하거나 (SDK 가 향후 분리 가능해질 때 대비한 선제적 여지로 남기려면) 주석으로 "미사용, §8.2 흡수 규칙에 의해 항상 'connect' 로 emit" 명시 권장.

- **[INFO]** plan/in-progress 잔류 draft 2건 — `plan_coherence.md` 의 자체 지적과 동일 확인
  - 위치: `plan/in-progress/spec-update-mcp-client-diagnostics.md`, `plan/in-progress/spec-sync-mcp-client-gaps.md`
  - 상세: 커밋 `1a4124842` 로 `spec/5-system/11-mcp-client.md` §6.2/§8.1/§8.2 및 `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 갱신이 실제로 반영 완료됐음을 직접 diff 로 확인했다. `spec-update-mcp-client-diagnostics.md` 는 이미 소비된 1회성 인계 draft 로 판단되나 `plan/in-progress/` 에 그대로 남아있어, `plan_coherence.md` 리뷰가 지적한 하우스키핑 사안과 일치한다. `spec-sync-mcp-client-gaps.md` 는 call-phase errors[] 누적 + §3.3 캐시라는 명시적 잔여(Planned) 항목이 있어 in-progress 유지가 타당하다.
  - 제안: `spec-update-mcp-client-diagnostics.md` 를 `plan/complete/` 로 이동 또는 `spec-sync-mcp-client-gaps.md` 로 흡수 — `plan_coherence.md` 제안과 동일. 정합성 자체에는 영향 없음.

- **[INFO]** spec §6.2 "구현 노트" 문단이 provider 입력 슬롯(`ProviderBuildCtx.mcpDiagnostics`/`mcpDiagnosticErrors`, 배열)과 최종 `meta.mcpDiagnostics`(객체) 의 shape 차이를 명시적으로 경고하는데, 실제 코드 확인 결과 이 설명과 구현이 정확히 일치
  - 위치: `spec/5-system/11-mcp-client.md` §6.2 "구현 노트" 문단; `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts` 의 `ProviderBuildCtx`; `mcp-diagnostics.ts` `finalizeMcpDiagnostics`; `ai-turn-executor.ts` `buildMcpDiagnosticsMeta`
  - 상세: `pushMcpServerSummary`/`pushMcpDiagnosticError` 는 두 개의 독립 배열 슬롯에만 push 하고, `finalizeMcpDiagnostics` 가 executor 소유 accumulator (`toolCalls`/`resourceReads`/`promptGets` 카운터 포함) 를 받아 구조화 객체로 환원한다 — spec 서술과 line-level 로 일치. 회귀 요소 없음.

### 요약
이번 diff(`review/consistency/.../plan_coherence.md` 신규 산출물 + `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 `serverSummaries` 예시 추가 + `spec/5-system/11-mcp-client.md` §6.2/§8.1/§8.2 갱신)는 이미 커밋된(`1a4124842`) `mcpDiagnostics` 구조화 객체 승격 + build-phase granular error code 구현을 spec 에 사후 반영한 문서 변경이다. spec 본문(§6.2 구조화 객체 shape, `serverSummaries[]`/`errors[]` 병존, §8.1 표의 phase 기록, §8.2 세 코드의 emit 지점 확장)을 실제 코드(`mcp-diagnostics.ts`, `mcp-tool-provider.ts`, `ai-turn-executor.ts`)와 line-level 로 대조한 결과 필드명·에러 코드·기본 emit 조건(attempted 시에만 emit, MCP 미시도 시 key 자체 omit, errors 는 항상 `[]` 로 존재)이 정확히 일치했다. 테스트(`mcp-diagnostics.spec.ts`, `mcp-tool-provider.spec.ts`)도 connect/tools/list 의 timeout·non-timeout 실패, attempted=false 케이스, connected/skipped 혼재 serverCount 계산 등 엣지 케이스를 구체적으로 커버한다. `McpErrorPhase` 유니온의 `'initialize'` 리터럴이 실제로는 emit 되지 않는 dead literal 이라는 사소한 타입 정의 이슈, 그리고 `plan_coherence.md` 자체가 지적한 draft plan 잔류 하우스키핑 외에는 기능 완전성·에러 시나리오·반환값·비즈니스 로직 관점에서 CRITICAL/WARNING 요소를 발견하지 못했다. plan_coherence.md 리뷰 산출물 자체도 근거(커밋 해시, 파일 line 번호)가 명확하고 결론(NONE 위험도)이 실측과 부합한다.

### 위험도
NONE
