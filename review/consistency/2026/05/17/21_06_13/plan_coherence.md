### 발견사항

- **[INFO]** `spec-update-cafe24-test-connection.md` 의 §5.8 기술과 target draft §6.1 의 자가 회복 정책이 상호 보완적으로 정합
  - target 위치: target draft "변경 1: §6.1" 및 "변경 3: §10.5 401 자동 회복" bullet
  - 관련 plan: `plan/in-progress/spec-update-cafe24-test-connection.md` — §5.8 갱신 제안 ("401 자동 회복: ... refresh_token 으로 1회 재시도" 문구 포함)
  - 상세: `spec-update-cafe24-test-connection.md` 의 §5.8 갱신 제안에 "401 자동 회복" 문구가 이미 포함되어 있다. target draft §6.1 / §10.5 에서 같은 자가 회복 정책을 `call()` 경로로 확대 적용하는 것은 §5.8 과 정책 방향이 동일하여 충돌은 없다. 단, `spec-update-cafe24-test-connection.md` 는 `cafe24-test-connection-2d7fa4` worktree 에서 아직 미완 상태이며 해당 plan 자체의 직렬화 선결 조건(다른 3건 merge 대기)이 있다. target draft 와 `spec-update-cafe24-test-connection.md` 두 문서 모두 `spec/4-nodes/4-integration/4-cafe24.md` 를 수정 대상으로 삼으나, 수정 섹션이 각각 §5.8 (테스트 방법) 과 §6.1 (인증 실패 분기) 로 분리되어 있어 섹션 레벨 직접 충돌은 없다.
  - 제안: target draft 가 spec 에 반영된 후 `spec-update-cafe24-test-connection.md` 의 §5.8 갱신 내용이 §6.1 의 새 정책과 일관성을 유지하는지 최종 반영 시점에 재확인 권장.

- **[INFO]** `node-output-redesign/cafe24.md` 가 §6.1 의 "401 즉시 격하" 를 현행 스펙으로 인용
  - target 위치: target draft "변경 1: §6.1" — 401 → refresh + 1회 재시도로 정책 변경
  - 관련 plan: `plan/in-progress/node-output-redesign/cafe24.md` line 44, 66, 151, 178 — "401/403 시 `Integration.status = error(auth_failed)`" 자동 전이를 현행 §6.1 정책으로 인용
  - 상세: `node-output-redesign/cafe24.md` 의 "구현 분석 (2026-05-16)" 및 "종합 개선안" 섹션은 401 응답 시 즉시 격하(error(auth_failed)) 전이가 §6.1 의 정책이라고 기술하고 있다. target draft 가 반영되면 401 은 refresh + 1회 재시도 후 격하 가능성이 있으므로, 위 plan 문서의 해당 인용 문구가 사실과 달라진다. node-output-redesign 은 output 컨트랙트(port:'error', output.error.code) 분석이 주목적이므로 output 계약 자체는 변경 없으나, §6.1 외부 부작용(자동 전이) 기술이 구식이 됨.
  - 제안: target draft spec 반영 후, `node-output-redesign/cafe24.md` 의 §6.1 인용 부분을 "401 → refresh + 재시도 후 격하 가능" 으로 갱신하거나 "상세는 §6.1 참조" 로 위임. WARNING 이 아닌 INFO 로 분류하는 이유는 node-output-redesign 의 output 컨트랙트 핵심은 변경 없고 단순 설명 문구의 정합 문제이기 때문.

- **[INFO]** `cafe24-backlog-residual.md` §B-5-8 의 `refreshAccessToken` 단위 테스트 항목이 target 구현 plan 과 연동 필요
  - target 위치: target draft Rationale "구현 plan: `plan/in-progress/cafe24-call-401-retry.md`" (아직 미생성)
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` B-5-8 항목 — `refreshAccessToken` 의 mock fetch 단위 테스트 (b) `invalid_grant → error(auth_failed)`, (d) `refresh invalid_grant → status 전이` 시나리오
  - 상세: target draft 의 §6.1 자가 회복 흐름(refresh → 재시도 → 성공/실패 분기) 은 `cafe24-backlog-residual.md` B-5-8 의 refresh 단위 테스트 시나리오와 직접 연관된다. target 구현 plan(`plan/in-progress/cafe24-call-401-retry.md`) 이 생성될 때 B-5-8 의 (c) refresh 성공 → atomic UPDATE 시나리오에 "재시도 성공 시 status='connected' 유지" 케이스가 추가되어야 할 수 있다. 현재 B-5-8 에는 이 케이스가 명시적으로 포함되어 있지 않다.
  - 제안: `cafe24-call-401-retry.md` plan 작성 시 B-5-8 을 교차 참조하고, "401 재시도 성공 → connected 유지" 단위 테스트 케이스를 B-5-8 에 추가하거나 구현 plan 에 명시.

- **[INFO]** target draft Rationale 의 구현 plan 파일(`plan/in-progress/cafe24-call-401-retry.md`) 미생성 상태
  - target 위치: target draft Rationale 절 "구현 plan: `plan/in-progress/cafe24-call-401-retry.md` (worktree `cafe24-401-refresh-a3f2c1`)"
  - 관련 plan: 해당 경로에 파일 없음 (find 확인)
  - 상세: target draft 의 Rationale 은 구현 plan 을 `cafe24-401-refresh-a3f2c1` worktree 에 연결하겠다고 명시하나, 현재 해당 plan 파일이 아직 존재하지 않는다. spec 반영 후 구현 착수 전에 plan 을 생성해야 한다.
  - 제안: spec 반영 확정 후 `plan/in-progress/cafe24-call-401-retry.md` 를 `cafe24-401-refresh-a3f2c1` worktree frontmatter 로 생성. consistency-check --impl-prep 를 의무 호출한 뒤 구현 착수.

---

### 동일 spec 파일 worktree 충돌 점검 결과

target draft 가 수정하는 4개 spec 경로와 진행 중 plan/worktree 의 충돌 여부:

| target spec 경로 | 다른 worktree 수정 여부 |
|---|---|
| `spec/4-nodes/4-integration/4-cafe24.md` §6.1 | `cafe24-test-connection-2d7fa4` (§5.8 — 섹션 분리, 직접 충돌 없음) |
| `spec/5-system/11-mcp-client.md` §8.4 | 현재 다른 worktree 수정 없음 |
| `spec/2-navigation/4-integration.md` §10.5 | `cafe24-test-connection-2d7fa4` 의 직렬화 선결 조건 3건(`cafe24-spec-sync-e2a8b9`, `cafe24-app-url-reuse-f9a2e3`, `prod-rereview-fix-a7c93f`) 이 이미 반영 완료 여부에 따라 달라짐. 단, 현재 활성 worktree(`cafe24-401-refresh-a3f2c1`) 외에 `4-integration.md` 를 동시 편집 중인 다른 worktree는 확인되지 않음 |
| `spec/2-navigation/4-integration.md` Rationale | 동상 |

활성 worktree 목록(`cafe24-401-refresh-a3f2c1`, `harness-generalize-b2c3d4`, `plan-housekeeping-a1b2c3`) 에서 `4-integration.md` 나 `11-mcp-client.md` 를 동시 수정 중인 다른 worktree는 발견되지 않았다. `cafe24-test-connection-2d7fa4` worktree 는 현재 활성 worktree 목록에 없으므로 이미 merge 됐거나 정리된 상태로 보인다.

---

### 미해결 결정과의 충돌 점검

`plan/in-progress/20260516-full-review/RESOLUTION.md` 의 의사결정 보류 목록 중 target draft 와 관련이 있는 항목:

- **C-12** (보류): "Cafe24 OAuth callback/BullMQ refresh e2e — HTTP stub 컨테이너 추가가 e2e 인프라 변경 사안". target draft 는 e2e 를 다루지 않으므로 충돌 없음.
- **W-53** (보류): "Cafe24ApiClient 1,271줄 — HTTP 요청·rate-limit·OAuth 토큰 갱신·상태 전이 혼재, 분해 권장". target draft 는 `executeWithRateLimit()` 의 401 분기 로직을 현재 구조 안에서 수정하는 것이므로 W-53 의 분해 결정과 충돌할 수 있다. 단, W-53 은 "결정 보류" 상태이고 분해 시점 결정이 나지 않았으므로, target draft 가 현 구조를 전제하여 구현을 확장하는 것은 W-53 의 보류 결정을 일방적으로 우회하는 것이 아니다(분해를 강제하지 않음). 분해 결정이 이후 확정될 때 `executeWithRateLimit()` 의 401 분기 코드도 함께 이전하면 된다. 충돌 없음.

그 외 `plan/in-progress/cafe24-oauth-invalid-scope-handler.md` 가 403 `invalid_scope` 의 callback 분기를 다루지만, target draft 의 "403 즉시 격하" 정책(호출 경로)과는 영역이 다르다(target = `call()` 경로의 응답 처리, 해당 plan = OAuth callback 의 `query.error` 분기). 충돌 없음.

---

### 요약

target plan(`plan/in-progress/spec-draft-cafe24-call-401-retry.md`, worktree `cafe24-401-refresh-a3f2c1`) 은 `spec/4-nodes/4-integration/4-cafe24.md` §6.1, `spec/5-system/11-mcp-client.md` §8.4, `spec/2-navigation/4-integration.md` §10.5 및 Rationale 4개 위치를 수정하는 spec draft 이다. 현재 활성 worktree 중 동일 spec 파일을 동시에 수정하는 경합 worktree는 없고, 의사결정 보류 목록과의 직접 충돌도 발견되지 않는다. 다만 (1) `node-output-redesign/cafe24.md` 가 §6.1 의 현행 "즉시 격하" 정책을 기술하고 있어 spec 반영 후 설명 문구 정합이 필요하고, (2) `cafe24-call-401-retry.md` 구현 plan 이 아직 미생성 상태이며, (3) `cafe24-backlog-residual.md` B-5-8 의 refresh 단위 테스트에 "재시도 성공 → connected 유지" 케이스가 누락되어 있어 구현 plan 작성 시 보완이 필요하다. 전반적으로 대형 정합성 위험 요소는 없으며 INFO 수준의 추적 항목만 존재한다.

### 위험도

LOW
