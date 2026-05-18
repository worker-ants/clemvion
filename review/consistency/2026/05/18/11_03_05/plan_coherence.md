# Plan 정합성 검토 결과

> 검토 대상: `plan/in-progress/cafe24-expired-self-healing.md`
> 검토 일시: 2026-05-18
> 검토 모드: spec draft (--spec)

---

### 발견사항

- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md` 동시 수정 가능성 — spec-update-cafe24-test-connection
  - target 위치: plan 항목 C — `spec/4-nodes/4-integration/4-cafe24.md §6.1 또는 §9.6`, CHANGELOG
  - 관련 plan: `plan/in-progress/spec-update-cafe24-test-connection.md` (worktree: `cafe24-test-connection-2d7fa4`) — 동 파일의 `§5.8` 및 `§9.1` 수정 예정이나 직렬화 선행 조건(3건 머지 후 착수) 이 명시되어 있음
  - 상세: 두 plan 이 모두 `spec/4-nodes/4-integration/4-cafe24.md` 를 수정한다. `spec-update-cafe24-test-connection` 은 §5.8·§9.1 영역, 본 target 은 §6.1·§8·§9.6·CHANGELOG 영역으로 섹션이 다르지만 같은 파일이다. 단, `spec-update-cafe24-test-connection` 은 3건 선행 머지 조건을 명시하고 있어 실제 동시 작업 여부는 그 3건(cafe24-spec-sync-e2a8b9, cafe24-app-url-reuse-f9a2e3, prod-rereview-fix-a7c93f)의 상태에 달려 있다. 해당 3건이 아직 main 에 미머지된 상태라면 `spec-update-cafe24-test-connection` 은 착수 전이므로 실질 경합 없음. 그러나 target plan 의 비고(§비고)에는 이 의존 관계가 언급되지 않았다.
  - 제안: target plan 의 `§비고` 에 "spec-update-cafe24-test-connection 과 동 파일 수정 — 섹션 분리되나 착수 순서 확인 필요" 한 줄 추가. 또는 spec-update-cafe24-test-connection 의 선행 조건 3건 머지 여부를 확인해 착수 순서를 명시한다.

- **[WARNING]** `Cafe24ApiClient` 공개 API 추가가 full-review RESOLUTION 의 보류 결정(W-53)과 잠재 충돌
  - target 위치: plan 항목 B — "(잠재) `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — refresh API public 노출"
  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` §의사결정 보류 — W-53 "Cafe24ApiClient (1,271줄) 분해 — `Cafe24HttpTransport`, `Cafe24TokenManager`, `Cafe24RateLimiter` 로 분해" 를 별도 plan 으로 보류
  - 상세: W-53 은 `Cafe24ApiClient` 의 책임 분해를 "결정 필요" 로 남겨둔 채 보류했다. target plan 의 B 항목이 `ensureFreshToken` (또는 `refreshViaQueue`) 를 public 으로 추가하면, 이후 W-53 분해 작업이 public API surface 를 재배치해야 하는 부담이 생긴다. target plan 은 이 점을 "(잠재)" 로 표기만 했을 뿐 W-53 과의 순서 관계를 언급하지 않는다.
  - 제안: target plan §B 의 잠재 영향 범위 코멘트에 "W-53(Cafe24ApiClient 분해)과 인터페이스 충돌 위험 — 분해 전에 추가된 public entry 는 분해 시 이동 대상이 됨을 인지하고 진행" 한 줄 보강. 실제로 W-53 이 아직 명확한 착수 plan 이 없으므로 blocking 은 아니다.

- **[WARNING]** `mcpDiagnostics` 의 `serverSummaries` 신규 필드가 기존 spec 에 없음 — spec 갱신 선행 필요
  - target 위치: plan 항목 C — `spec/5-system/11-mcp-client.md §8.4 또는 §6` + `spec/4-nodes/3-ai/0-common.md §7`; 항목 D — `meta.mcpDiagnostics.serverSummaries[]`
  - 관련 plan: 없음 (기존 spec 의 공백)
  - 상세: 현재 `spec/5-system/11-mcp-client.md §6.2` 의 `mcpDiagnostics` JSON 스키마에는 `serverSummaries[]` 필드가 존재하지 않는다 — `attempted`, `serverCount`, `toolCalls`, `resourceReads`, `promptGets`, `errors[]` 만 정의되어 있다. target plan 의 D 항목은 구현에서 `serverSummaries[].skipReason` 을 추가하고, C 항목은 이를 spec 에 명시하겠다고 한다. spec → 구현 순서(C 완료 후 D 착수)가 워크플로우 §1-3 에 명시되어 있어 순서는 맞지만, C 의 spec 갱신이 반드시 먼저 consistency-check 를 통과해야 함을 plan 에서 더 명확히 강조할 필요가 있다. 현재 plan 의 `§워크플로우 2` 는 C 를 하나의 커밋으로 묶었는데, `serverSummaries` 신규 필드처럼 spec 확장이 큰 경우에도 --spec consistency-check 를 별도로 명시하면 좋다.
  - 제안: 워크플로우 §2 에 "spec 갱신 (C) commit 전 `/consistency-check --spec` 재실행 — serverSummaries 신규 필드가 0-common.md §7 / 11-mcp-client.md §6.2 두 파일에 걸쳐 추가되므로" 한 줄 추가.

- **[INFO]** `spec/data-flow/5-integration.md` 의 `connected-expiry` 기술과 target plan A 항목의 범위 구분이 불명확
  - target 위치: plan 배경 및 항목 A
  - 관련 plan: 없음 (spec 기술 문제)
  - 상세: `spec/data-flow/5-integration.md` 의 `connected-expiry` 행은 "refresh_token 없는 provider 는 여전히 `expired(token_expired)`" 로 기술되어 있다. 그러나 target plan 이 설명하는 버그는 `connected-expiry` 잡의 `connected` 상태 처리가 아니라, scanner `run()` 의 **별도 `0d` 분기**(이미 `tokenExpiresAt <= now` 인 행을 처리하는 경로)에서 cafe24 의 `refresh_token` 유무를 구분하지 않고 일률 `expired` 격하하는 것이다. 이 두 코드 경로(`connected-expiry` job vs `0d` 분기)는 spec 상에서 구분이 되어 있지 않다. 항목 C 에서 spec 을 정정할 때 이 코드 레벨 경로 차이를 어느 쪽에 기술할지 명확히 하지 않으면 spec 이 다시 모호해질 수 있다.
  - 제안: 항목 C spec 정정 시 "이 정책은 `connected-expiry` job 의 기존 refresh 흐름과 별개로, `run()` 의 `tokenExpiresAt <= now` 판별 분기(0d 분기)에 적용되는 추가 규칙임" 을 Rationale 또는 코드 경로 주석으로 구분 기술.

- **[INFO]** `node-output-redesign/cafe24.md` 도 `spec/4-nodes/4-integration/4-cafe24.md` 를 대상으로 하지만 worktree frontmatter 없음
  - target 위치: plan 항목 C — `spec/4-nodes/4-integration/4-cafe24.md`
  - 관련 plan: `plan/in-progress/node-output-redesign/cafe24.md` — README 에 worktree frontmatter 없음. node-output-redesign 폴더 전체의 상위 README 도 worktree 필드 미기재
  - 상세: `node-output-redesign/cafe24.md` 는 동 spec 파일의 §5 출력 구조 영역을 검토 대상으로 삼고 있다. target plan 이 수정하는 §6.1, §8, §9 와 섹션이 다르고, `node-output-redesign` 전체가 "D 결정 phase 완료" 이후 Phase 2 가 아직 착수 전인 상태이므로 실질 경합 가능성은 낮다. 그러나 worktree frontmatter 가 없어 plan_coherence checker 가 충돌 탐지를 자동화하기 어렵다.
  - 제안: 추적 메모 수준. `node-output-redesign/README.md` 에 worktree frontmatter 추가를 나중에 housekeeping 으로 처리하면 된다. target plan 은 수정 불필요.

---

### 요약

`cafe24-expired-self-healing` plan 은 기존 plan 들과의 심각한 결정 충돌이나 직접적인 worktree 경합은 없다. `integration-token-ui-autorefresh` 와 `cafe24-restricted-scopes` 는 이미 `plan/complete/` 로 이동되어 있어 비고의 전제가 유효하다. 주요 주의점은 세 가지다: (1) `spec-update-cafe24-test-connection` 과 동일 spec 파일(`spec/4-nodes/4-integration/4-cafe24.md`)을 수정하므로 착수 순서를 확인해야 하며, (2) full-review RESOLUTION W-53 의 `Cafe24ApiClient` 분해 보류 결정과 항목 B 의 잠재적 public API 추가가 인터페이스 충돌로 이어질 수 있으므로 인지하고 진행해야 하고, (3) `mcpDiagnostics.serverSummaries` 신규 필드 추가(항목 C·D)는 spec 에 존재하지 않는 새 스키마를 도입하므로 C spec 커밋 전 `--spec` consistency-check 가 필요하다. CRITICAL 수준의 미해결 결정 우회나 동시 worktree 충돌은 발견되지 않았다.

---

### 위험도

LOW
