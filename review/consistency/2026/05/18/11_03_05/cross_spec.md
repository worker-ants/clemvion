# Cross-Spec 일관성 검토 결과

target: `plan/in-progress/cafe24-expired-self-healing.md`

---

### 발견사항

- **[INFO]** spec 선행 갱신 확인 — C 항목의 spec 정정이 이미 반영됨
  - target 위치: plan §C (spec 정정 항목)
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` CHANGELOG (2026-05-18), `spec/data-flow/5-integration.md` §1.4, `spec/5-system/11-mcp-client.md` §6.2, `spec/4-nodes/3-ai/0-common.md` §7, `spec/2-navigation/4-integration.md` §10.5/§11.1
  - 상세: plan 의 C 항목("spec 정정")이 계획하는 모든 spec 변경이 이미 반영되어 있다. `4-cafe24.md` CHANGELOG 2026-05-18 행이 §8.6 신설, `connected-expiry` scanner cafe24 분기, `serverSummaries[].skipReason` vocabulary, `spec/data-flow/5-integration.md` 표·mermaid 동시 갱신을 명시적으로 기술한다. `spec/5-system/11-mcp-client.md §6.2` 에 `skipReason` vocabulary 테이블(5행)이 존재하며, `spec/4-nodes/3-ai/0-common.md §7` 에 `mcpDiagnostics.serverSummaries[]` 참조가 추가되어 있다.
  - 제안: plan C 항목의 각 체크박스를 이미 완료된 것으로 체크하고 구현(A, B, D)으로 진행.

- **[INFO]** `skipReason` 값 집합 — plan D 와 MCP spec §6.2 간 완전 일치
  - target 위치: plan §D skipReason 값 목록
  - 충돌 대상: `spec/5-system/11-mcp-client.md §6.2` skipReason vocabulary 표
  - 상세: plan D 가 정의한 6개 값(`expired_install_timeout`, `expired_refresh_failed`, `expired_no_refresh_token`, `error`, `lookup_failed`, `not_cafe24`)이 MCP Client §6.2 의 vocabulary 표와 완전히 일치한다. 추가 충돌 없음.
  - 제안: 일치 확인, 별도 조치 불필요.

- **[INFO]** cafe24 0d 만료 시 `integration_expired` 알림 발사 여부 — plan 과 spec 간 미세 서술 차이
  - target 위치: plan §A "7d/3d 알림은 그대로 유지 (사용자 가시성)"
  - 충돌 대상: `spec/data-flow/5-integration.md` §1.4 connected-expiry 행 ("enqueue + 알림"), `spec/2-navigation/4-integration.md` §11.2 알림 발사 정책 ("refresh_token 없는 provider 의 token_expires_at 만료에만 발사")
  - 상세: data-flow spec 의 mermaid diagram (line 158) 은 cafe24 0d 분기도 `notify integration_expired` 를 발사한다고 표현하고, §11.1 connected-expiry 잡 표도 "enqueue + 알림"이라고 명시한다. 그런데 §11.2 의 알림 발사 정책 본문은 "refresh_token 없는 provider 의 `token_expired` 경로에만 발사"라고 서술한다. cafe24 가 0d 에서 `token_expired` 전이를 하지 않게 되면(A 수정 후) `integration_expired` 알림이 발사될 근거가 명확하지 않다. 단, 이 불일치는 본 plan 이 새로 유발하는 충돌이 아니라 2026-05-18 spec 갱신 당시 이미 존재하는 서술 불일치다. plan 자체는 "7d/3d 알림은 그대로 유지"라고만 명시하고 0d 알림 여부를 명시하지 않아 구현 시 판단이 필요하다.
  - 제안: 구현 착수 전 0d cafe24 만료 시 `integration_expired` 알림 발사 여부를 spec 에서 명확히 결정할 것을 권장. 현재 data-flow spec 의 "enqueue + 알림"을 따라 0d 에서도 발사하는 것이 사용자 가시성(plan §A 마지막 항) 취지에 부합하나, 알림이 이후 worker 가 refresh 성공 시 misleading(expired 아님)할 수 있다. 이 결정은 구현 내용에 영향을 주지 않으며 spec 서술 정합화 작업으로 분리 가능하다. BLOCKING 이슈 아님.

- **[INFO]** `status='error'` 를 buildTools 에서 skip 하는 정책 — MCP Client §8.4 참조 적절
  - target 위치: plan §B "`status === 'error'` 는 본 경로 적용 외"
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md §8.6` 표, `spec/5-system/11-mcp-client.md §8.4`
  - 상세: plan B 가 `status='error'` 를 skip 하며 "외부 명시 reauth 가 정식 회복 경로 (MCP Client §8.4 의 외부 MCP 정책과 일관)"으로 설명한다. cafe24 §8.6 표의 `error(*)` 행도 "skip + skipReason='error' (외부 명시 reauth 가 정식 회복)"로 일치한다. MCP Client §8.4 는 External HTTP transport 한정 정책이지만 Internal Bridge 에도 동일 원칙이 적용된다고 주석되어 있어 참조 정확하다.
  - 제안: 일치 확인, 별도 조치 불필요.

- **[INFO]** `refreshViaQueue` wrapper — plan B 와 cafe24 §8.6 간 API 명칭 일치
  - target 위치: plan §B `cafe24ApiClient.ensureFreshToken` (또는 동등한 큐 경로 `refreshViaQueue`)
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md §8.6` 표 (`refreshViaQueue` 사용)
  - 상세: plan B 는 `ensureFreshToken` 또는 `refreshViaQueue` 중 하나를 선택하도록 열어 두었고, §8.6 표는 `refreshViaQueue` 를 정식 entry-point 로 명시한다. 구현 시 `refreshViaQueue` 를 사용하면 spec 과 완전 정합.
  - 제안: 구현 시 `refreshViaQueue` 로 고정. `ensureFreshToken` 은 public 노출이 불필요하다.

- **[INFO]** `consecutive_network_failures` 카운터와 0d 분기 관계 — 잠재 언급 누락
  - target 위치: plan §A scanner 0d 분기 cafe24 처리
  - 충돌 대상: `spec/1-data-model.md §2.10` consecutive_network_failures 컬럼, `spec/data-flow/5-integration.md §1.4`
  - 상세: plan §A 는 cafe24 0d 분기에서 `cafe24-token-refresh` 큐 enqueue 후 refresh 실패 시 worker 가 `markAuthFailed` 로 `error(auth_failed)` 전이를 책임진다고 설명한다. `error(network)` 전이(transport 3회 연속 실패 카운터)는 worker 내부에서 처리되며, plan 에서 별도 언급이 없다. spec 상 worker 의 network 실패 경로도 이미 정의되어 있어 충돌은 없다. 단, 구현 테스트 케이스에 "network 오류 3회 연속 → error(network) 전이" 케이스가 명시되어 있지 않다.
  - 제안: 구현 시 Cafe24TokenRefreshProcessor 의 network 실패 분기 테스트가 기존에 커버되어 있다면 별도 추가 불필요. 신규 작성 시 포함 권장.

---

### 요약

target 문서(plan)가 기술하는 모든 spec 변경(C 항목)은 spec 파일에 이미 반영되어 있으며, plan 이 참조하는 `spec/data-flow/5-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md §8.6`, `spec/5-system/11-mcp-client.md §6.2`, `spec/4-nodes/3-ai/0-common.md §7` 가 상호 일관되게 갱신된 상태다. 데이터 모델(Integration.status 전이 경로, status_reason vocabulary), API 계약(queue enqueue 방식, skipReason 집합), 계층 책임(scanner → worker → buildTools 순서) 모두 충돌이 없다. RBAC 변경 없음. 단, 0d 만료 cafe24 행에 대한 `integration_expired` 알림 발사 여부가 data-flow spec 과 nav spec §11.2 사이에 서술 불일치가 남아 있으나, 이는 본 plan 이 신규 유발한 충돌이 아니며 구현 진행을 차단하지 않는다. Critical 이슈 없음.

### 위험도

LOW

---

CRITICAL: 0  WARNING: 0  INFO: 6
