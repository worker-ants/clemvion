### 발견사항

- **[WARNING]** `mcpDiagnostics` shape 불일치 — `1-ai-agent.md` 예시가 미구현 필드를 현재 사실처럼 제시
  - target 위치: `spec/5-system/11-mcp-client.md` §6.2 (`mcpDiagnostics` 진단 누적) — "구현 현황 (2026-06-14 갱신)" 노트가 `attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`errors[]` 를 **미구현 (Planned)** 으로 명시하고, 현재는 `serverSummaries[]` 단일 배열만 emit 된다고 서술
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 (라인 485-491, single-turn 출력 예시) — 동일 JSON 예시가 `"mcpDiagnostics": { attempted, serverCount, toolCalls, resourceReads, promptGets, errors: [] }` 를 `serverSummaries[]` 없이, "미구현" 표기도 없이 마치 현재 런타임 출력인 것처럼 보여준다. 반면 같은 영역의 `0-common.md` §7 (113행)은 `mcpDiagnostics.serverSummaries[]` 를 현재 구현 필드로 정확히 언급해 mcp-client.md 와 일치한다
  - 상세: 같은 제품 영역(AI Agent 출력 스키마) 안에서 `1-ai-agent.md` 와 `0-common.md` 가 서로 다른 `mcpDiagnostics` shape 를 "현재" 것으로 제시하며, 그중 `1-ai-agent.md` 쪽이 mcp-client.md 의 SoT 서술과 어긋난다. `spec-sync-mcp-client-gaps.md` 의 "타입 확장 cluster" 작업(본 impl-prep 검토 대상)이 착수되면 이 필드들이 실제로 구조화 객체로 승격되어 `1-ai-agent.md` 예시가 사실이 되지만, **현재 시점**에는 미구현 상태를 예시가 already-shipped 인 것처럼 오도한다
  - 제안: (a) 단기: `1-ai-agent.md` §7.1 예시에 mcp-client.md 와 동일한 "미구현(Planned)" 각주를 달거나 예시를 현재 구현 shape(`serverSummaries[]` 포함, `errors[]` 등 제외)로 교정. (b) 중기: 계획된 "타입 확장 cluster" PR 이 완료되면 mcp-client.md §6.2 + 1-ai-agent.md §7.1 + 0-common.md §7 세 곳을 한 번에 구조화 객체 shape 로 동기화 — `spec-sync-mcp-client-gaps.md` 의 "spec 동기화" phase 범위에 `1-ai-agent.md` §7.1 예시 갱신을 명시적으로 추가할 것을 권고 (현재 plan 은 §6.2/§8.2 만 언급하고 1-ai-agent.md 는 누락)

- **[INFO]** `autoRefresh` derived 필드 Rationale 문구 stale (mcp-client.md 범위 밖, 인접 영역)
  - target 위치: 직접 관련 없음 — mcp-client.md 는 이 필드를 참조하지 않지만 같은 Integration 엔티티(§2.10, mcp-client §3.1 이 의존)의 문서 내부 불일치라 인접 신뢰도에 영향
  - 충돌 대상: `spec/2-navigation/4-integration.md` 라인 794 (본문, "현재 `service_type='cafe24'`, `service_type='google'`, `service_type='makeshop'` 이 `true`") vs 같은 파일 라인 1197 (Rationale, "현재 `cafe24`/`google` 만 true")
  - 상세: 동일 문서 안에서 본문은 makeshop 을 포함해 3-provider 로 갱신됐으나 Rationale 절은 옛 2-provider 서술을 남겨뒀다. `spec/1-data-model.md` §2.10 응답 DTO derived 필드 설명도 본문 쪽(3-provider)과 일치
  - 제안: `4-integration.md` 라인 1197 을 본문과 동일하게 `cafe24/google/makeshop` 로 갱신 (project-planner 소관, mcp-client.md 와는 무관한 별건 fix — 단 이번 검토에서 발견되어 병기)

### 요약

`spec/5-system/11-mcp-client.md` 자체는 Integration 엔티티(§2.10 `service_type`/`auth_type`), Cafe24/MakeShop 노드 spec 의 §8 AI Agent 노출 절, HTTP Request 의 SSRF 정책(`ALLOW_PRIVATE_HOST_TARGETS` vs `MCP_ALLOW_INSECURE_URL` 분리), Integration §5.6/§11 알림·만료 스캐너 로직과 모두 정합적이며 데이터 모델 충돌·API 계약 충돌·요구사항 ID 충돌·RBAC 충돌은 발견되지 않았다. 유일한 실질적 불일치는 `mcpDiagnostics` 진단 필드의 "구현 현황" 서술이 문서마다 다른 점 — mcp-client.md·`0-common.md` 는 현재 `serverSummaries[]` 단일 배열만 구현됐다고 정확히 기술하는 반면, `1-ai-agent.md` §7.1 의 출력 예시는 계획된(아직 미구현) 구조화 shape 를 이미 구현된 것처럼 제시한다. 이는 `plan/in-progress/spec-sync-mcp-client-gaps.md` 가 착수하려는 "타입 확장 cluster" 작업과 직결되며, 해당 작업의 spec 동기화 phase 범위에 `1-ai-agent.md` §7.1 예시 교정을 포함하지 않으면 작업 완료 후에도 두 문서가 자연히 수렴하되 그 사이 기간 동안의 오도 서술이 방치될 위험이 있다. 추가로 발견된 `autoRefresh` Rationale 문구 stale 은 mcp-client.md 와 직접 관련 없는 인접 영역의 사소한 drift(INFO)다.

### 위험도
LOW
