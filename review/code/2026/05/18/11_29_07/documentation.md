# 문서화(Documentation) 리뷰

## 발견사항

### 독스트링/JSDoc

- **[INFO]** `isCafe24RefreshCapable` 함수에 JSDoc이 잘 작성되어 있음
  - 위치: `integration-expiry-scanner.service.ts` (diff 하단, `function isCafe24RefreshCapable`)
  - 상세: spec 참조, 동작 설명, 확장 방향 모두 기술. 공개 함수는 아니지만 모듈-레벨 helper 로서 충분한 문서 수준.
  - 제안: 현재 상태 유지.

- **[INFO]** `tryRecoverExpired` private 메서드에 JSDoc이 상세하게 작성되어 있음
  - 위치: `cafe24-mcp-tool-provider.ts` (diff +1137~+1157)
  - 상세: 분기 조건(install_timeout / refresh_token 누락 / refresh 실패), 재진입 안전성, BullMQ dedup 동작까지 설명. 복잡한 상태 전이 로직에 적합한 수준.
  - 제안: 현재 상태 유지.

- **[INFO]** `refreshTokenViaQueue` public 메서드에 JSDoc이 작성되어 있음
  - 위치: `cafe24-api.client.ts` (diff +1233~+1247)
  - 상세: source 파라미터 의미, 큐 미바인딩 시 폴백 동작, jobId dedup 목적 설명. 외부 호출자(Cafe24McpToolProvider)와의 계약을 명시.
  - 제안: 현재 상태 유지.

- **[INFO]** `buildMcpDiagnosticsMeta` private static 메서드의 JSDoc에 PR 브랜치 이름이 노출됨
  - 위치: `ai-agent.handler.ts` (diff +564~+569)
  - 상세: `본 PR (cafe24-expired-self-healing) 은 mcpDiagnostics 의 serverSummaries slice 만 시동` — 코드에 PR 이름/브랜치명을 직접 기록하는 것은 JSDoc 관용이 아님. 향후 코드 자체는 남아 있는데 PR 문맥이 퇴색되면 오해 소지.
  - 제안: PR 이름 언급 제거. 대신 `(2026-05-18 신규) 나머지 필드는 follow-up 추가 예정` 형태로 변경.

- **[WARNING]** `ProviderBuildCtx.mcpDiagnostics` 필드 JSDoc이 push-only 계약을 잘 서술하지만, `McpServerSummary` 타입 자체(`mcp-diagnostics.ts`)의 필드별 문서가 diff에 포함되지 않음
  - 위치: `agent-tool-provider.interface.ts` (diff +621~+626), `mcp-diagnostics.ts` (파일 전체 내용 미확인)
  - 상세: `McpServerSummary` 타입은 `mcp-diagnostics.ts` 에서 임포트되는데, 해당 파일의 변경 내용이 리뷰 대상에 없음. `skipReason` enum 값들의 의미는 spec에서는 잘 정리되어 있으나, 코드 레벨 타입 정의 파일에도 동등한 설명이 필요한지 확인 필요.
  - 제안: `mcp-diagnostics.ts` 의 `McpServerSummary` 인터페이스와 `McpSkipReason` 타입에 각 값의 의미를 JSDoc으로 기술했는지 확인. 없다면 spec §6.2 테이블 내용을 type-level 주석으로 반영.

---

### README 업데이트

- **[INFO]** 이 변경은 내부 서비스 동작 정책(expired 자가 회복) 변경이므로 일반 사용자-facing README 업데이트 불필요.
  - 위치: 프로젝트 루트 `README.md`
  - 상세: Cafe24 통합의 자가 회복은 운영/배포 관점 변경이 아닌 내부 상태 전이 정책이다. 사용자 구성 변경이 없어 README 갱신 요인 없음.
  - 제안: 현재 상태 유지.

---

### API 문서

- **[INFO]** 백엔드 API 엔드포인트 변경 없음 — 기존 API 문서 업데이트 불필요.
  - 위치: 전체 diff
  - 상세: 이번 변경은 BullMQ 잡 내부 로직 + buildTools 분기이며 REST/WS 엔드포인트 시그니처 변경이 없음.
  - 제안: 현재 상태 유지.

- **[INFO]** `meta.mcpDiagnostics.serverSummaries[]` 가 AI Agent 노드 출력 메타에 추가됨 — 이는 사실상 API contract 변경
  - 위치: `ai-agent.handler.ts`, `spec/5-system/11-mcp-client.md` §6.2
  - 상세: `spec/5-system/11-mcp-client.md` §6.2 에 `serverSummaries[]` 필드가 신규 추가되었고, skipReason vocabulary 테이블도 정의됨. spec 업데이트는 완료됨.
  - 제안: 현재 상태 유지 — 프론트엔드 팀이 `meta.mcpDiagnostics.serverSummaries` 소비 시 spec §6.2를 참조하도록 협의 필요 여부는 팀 운영 문제.

---

### 주석 정확성

- **[INFO]** `integration-expiry-scanner.service.ts` 인라인 주석이 스펙 참조를 포함함
  - 위치: `integration-expiry-scanner.service.ts` diff +221~+226
  - 상세: `spec/data-flow/5-integration.md §1.4 / spec/2-navigation/4-integration.md §11.1 (2026-05-18 갱신)` 로 명시되어 있어 주석과 spec 동기화 여부 추적 용이.
  - 제안: 현재 상태 유지.

- **[WARNING]** `cafe24-mcp-tool-provider.ts` 의 non-auth 에러 처리 주석이 실제 반환 값과 미묘하게 어긋남
  - 위치: `cafe24-mcp-tool-provider.ts` diff +1180~+1186 (tryRecoverExpired 내 catch 블록)
  - 상세: 주석에 `다음 buildTools 호출에서 재시도` 라고 되어 있는데, 실제로는 동일 skipReason `expired_refresh_failed` 를 반환함 — 이 케이스(transport 오류)의 재시도는 다음 노드 실행에서 buildTools 가 새로 호출될 때 일어나는 것이지, 현재 호출 내에서 자동 재시도되는 것이 아님. 주석 자체는 의도를 설명하려는 것이지만 혼동 가능.
  - 제안: `// transport 실패는 현재 buildTools 패스에서 복구하지 않고 skip. 다음 노드 실행 시 buildTools 재호출로 자연 재시도.` 형태로 명확히 변경.

- **[INFO]** `spec/4-nodes/3-ai/0-common.md` §11 CHANGELOG에 2026-05-18 항목이 누락됨
  - 위치: `spec/4-nodes/3-ai/0-common.md` (전체 파일 컨텍스트, §11 CHANGELOG)
  - 상세: §7 진단 누적 섹션이 `mcpDiagnostics.serverSummaries[]` 설명으로 갱신되었으나, CHANGELOG (§11) 의 마지막 항목은 `2026-05-14` 로 본 변경이 기록되지 않음.
  - 제안: CHANGELOG에 `2026-05-18` 항목을 추가. 내용: `§7 진단 누적 — mcpDiagnostics.serverSummaries[] 정적 스냅샷 의미 명시 (buildTools 단위 1회 결정, turn delta 와 무관). MCP §6.2 skipReason vocabulary 링크 보강`.

---

### 인라인 주석

- **[INFO]** `integration-expiry-scanner.service.spec.ts` 테스트 케이스의 인라인 주석이 spec 참조를 포함하고 있음
  - 위치: `integration-expiry-scanner.service.spec.ts` diff +57~+58
  - 상세: `// spec/2-navigation/4-integration.md §11.1 (2026-05-18 갱신) + spec/4-nodes/4-integration/4-cafe24.md §8.6` 와 같이 테스트 코드에 spec 링크를 달아 의도 파악이 용이함. 좋은 관행.
  - 제안: 현재 상태 유지.

- **[INFO]** `ai-agent.handler.ts` 의 `mcpDiagnosticsAcc` 변수 선언 근처 주석이 충분함
  - 위치: `ai-agent.handler.ts` diff +454~+457, +489~+492
  - 상세: single-turn / multi-turn 각각 별도 accumulator를 사용하는 이유와 buildTools 재호출 시 결정론적 재계산에 대한 설명이 있음.
  - 제안: 현재 상태 유지.

- **[INFO]** `cafe24-mcp-tool-provider.ts` 에서 `McpToolProvider` 가 처리하는 ref의 경우 summary를 push하지 않는 이유를 주석으로 설명함
  - 위치: `cafe24-mcp-tool-provider.ts` diff +1066~+1067
  - 상세: `// McpToolProvider 가 본 ref 를 처리하므로 본 provider 의 summary 에는 포함하지 않는다 (다른 provider 가 자기 summary 를 push).` — provider 간 책임 분리를 명확히 기술.
  - 제안: 현재 상태 유지.

---

### 변경 이력 (CHANGELOG)

- **[WARNING]** `spec/4-nodes/3-ai/0-common.md` §11 CHANGELOG에 2026-05-18 변경 미반영 (상기 주석 정확성 항목과 동일)
  - 위치: `spec/4-nodes/3-ai/0-common.md` §11 CHANGELOG (오프셋 1491~1499)
  - 상세: §7 문장이 변경되었는데 CHANGELOG 최신 항목은 2026-05-14 임. 독자가 "언제 변경됐나" 추적할 수 없음.
  - 제안: `| 2026-05-18 | §7 진단 누적 — \`mcpDiagnostics.serverSummaries[]\` 정적 스냅샷 의미 추가 (buildTools 단위 1회 결정, turn delta 와 무관). MCP §6.2 skipReason vocabulary 링크 보강. |` 행 추가.

- **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md` §CHANGELOG에 `2026-05-18 (expired 자가 회복)` 항목이 잘 추가됨
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` diff 마지막 행 (+1554)
  - 상세: 변경 배경(사용자 보고), 연계 spec 문서, worktree 이름까지 기록. 프로젝트 컨벤션 준수.
  - 제안: 현재 상태 유지.

- **[INFO]** `spec/2-navigation/4-integration.md` 와 `spec/data-flow/5-integration.md` 에는 별도 CHANGELOG 섹션이 없고 본문 내 날짜 annotation 으로 변경을 추적함 — 일관성 있는 패턴.
  - 제안: 현재 상태 유지.

---

### 설정 문서

- **[INFO]** 새 환경변수·설정 옵션이 없으며, BullMQ 잡 파라미터(`attempts: 1`, `removeOnComplete`, `removeOnFail`)는 코드 내 상수로 정의되어 있음
  - 위치: `integration-expiry-scanner.service.ts` diff +238~+239
  - 상세: `attempts: 1` 의 근거(refresh 실패는 terminal — invalid_grant)는 `spec/data-flow/5-integration.md` §2.2 Redis 테이블에 이미 설명되어 있음.
  - 제안: 현재 상태 유지.

- **[INFO]** `cafe24RefreshQueue` 의존성 주입이 신규 추가됐으나 모듈 등록 관련 설정 문서는 변경 대상 외
  - 위치: `integration-expiry-scanner.service.ts` 전체 파일 컨텍스트 (constructor)
  - 상세: `@InjectQueue(CAFE24_REFRESH_QUEUE)` 주입이 추가됐는데, 해당 큐 상수(`CAFE24_REFRESH_QUEUE`)는 기존 상수 파일에서 임포트되므로 별도 설정 문서 불필요.
  - 제안: 현재 상태 유지.

---

### 예제 코드

- **[INFO]** `spec/5-system/11-mcp-client.md` §6.2 에 `serverSummaries[]` 가 포함된 JSON 예제가 업데이트됨
  - 위치: `spec/5-system/11-mcp-client.md` diff +1574~+1577
  - 상세: connected 케이스(`uuid-a`)와 skipped 케이스(`uuid-b`) 두 가지를 함께 보여줌. `skipReason='expired_install_timeout'` 예시 포함. 실제 프론트엔드 개발자가 파싱해야 하는 구조를 명확히 확인 가능.
  - 제안: `toolCount` 필드가 예제에 있으나 `skipReason` 없는 connected 케이스에는 `toolCount` 값이 있고, skipped 케이스에는 `toolCount: 0` 이 명시되지 않음. 스키마 일관성을 위해 `{ ..., "toolCount": 0 }` 를 skipped 예제에도 추가하면 독자 친화적.

---

## 요약

이번 변경의 문서화 수준은 전반적으로 높다. spec 세 곳(통합 화면 §11.1, cafe24 §8.6, MCP Client §6.2)이 일관되게 갱신되었고, 코드 변경 의도가 인라인 주석과 JSDoc 양쪽에 적절히 기술되어 있다. `tryRecoverExpired` 와 `refreshTokenViaQueue` 의 JSDoc은 복잡한 BullMQ dedup 동작과 상태 전이 책임 분리를 잘 설명한다. 주요 갭은 두 가지다: (1) `spec/4-nodes/3-ai/0-common.md` §11 CHANGELOG에 2026-05-18 항목이 누락되어 해당 spec 변경의 추적 연결이 끊긴 점, (2) `buildMcpDiagnosticsMeta` JSDoc에 PR 브랜치명이 하드코딩되어 있어 장기적으로 오해 소지가 있는 점. 나머지 발견 사항은 정보성이며 즉각적인 수정이 필요하지 않다.

## 위험도

LOW
