# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
**검토 대상**: `spec/5-system/` 전체 (1-auth, 10-graph-rag, 11-mcp-client, 12-webhook, 13-replay-rerun)
**보조 코퍼스**: spec/0-overview.md, spec/1-data-model.md, spec/2-navigation/0-dashboard.md, spec/2-navigation/1-workflow-list.md, spec/2-navigation/10-auth-flow.md

---

### 발견사항

---

- **[CRITICAL]** `spec/5-system/13-replay-rerun.md` — `re_run_of` / `chain_id` 컬럼이 `spec/1-data-model.md §2.13` 에 누락
  - target 위치: `spec/5-system/13-replay-rerun.md §9.1 "executions 테이블 컬럼 추가"`
  - 충돌 대상: `spec/1-data-model.md §2.13 Execution` 엔티티 정의
  - 상세: re-run spec 은 `re_run_of UUID NULL` (self-FK) 과 `chain_id UUID NOT NULL` 두 컬럼을 executions 테이블에 추가한다고 명세하고, 인덱스 `(re_run_of)` / `(chain_id, started_at)` 도 정의한다. 그러나 `spec/1-data-model.md §2.13` 의 Execution 필드 목록에는 이 두 컬럼이 존재하지 않으며, `§3 인덱스 전략` 테이블에도 해당 인덱스가 없다. 구현 팀이 데이터 모델 spec 만 보면 두 컬럼을 인지할 수 없고, 데이터 모델과 re-run spec 간 단일 진실이 깨진다.
  - 제안: `spec/1-data-model.md §2.13` Execution 필드 목록에 `re_run_of` / `chain_id` 를 추가하고, §3 인덱스 전략 테이블에도 두 인덱스를 추가한다. re-run spec 은 현재 표현("본 spec 은 컬럼·인덱스·불변식만 명세한다")을 유지하고 데이터 모델 spec 을 primary SoT 로 삼도록 cross-reference 를 명시한다.

---

- **[CRITICAL]** `spec/5-system/10-graph-rag.md §2.2` — `graph_extraction_status` Enum 값 목록이 `spec/1-data-model.md §2.12` 와 불일치
  - target 위치: `spec/5-system/10-graph-rag.md §2.2 Document 추가 컬럼` — 열거값을 `pending / processing / completed / error` 로 기술
  - 충돌 대상: `spec/1-data-model.md §2.12 Document` — `graph_extraction_status` 를 `pending / processing / completed / error / failed` 5종으로 정의
  - 상세: 데이터 모델 spec 은 `failed` 상태("최대 재시도 소진 또는 비재시도성 오류로 인한 최종 실패")를 명시하지만, graph-rag spec §2.2 의 설명에는 `failed` 가 없다. §3.2 GraphExtractionProcessor 의 처리 단계와 §7 에러 처리에서는 `failed` 상태를 사용함에도 §2.2 의 Enum 목록과 일치하지 않는다. 구현 시 `failed` 상태의 존재 여부가 혼동될 수 있고, 상태 머신이 영역마다 다르게 기술된 상태다.
  - 제안: `spec/5-system/10-graph-rag.md §2.2` 의 `graph_extraction_status` 값 목록에 `failed` 를 추가하고, 각 상태의 의미(embedding_status 와 동일)를 명시한다. `spec/1-data-model.md §2.12` 가 정의하는 5종이 canonical 값이다.

---

- **[WARNING]** `spec/5-system/13-replay-rerun.md §8` — API 경로에 `/api/v1/` 버전 접두사 사용, 다른 spec 과 불일치
  - target 위치: `spec/5-system/13-replay-rerun.md §8.1 POST /api/v1/executions/:executionId/re-run`, `§8.2 GET /api/v1/executions/:executionId/chain`
  - 충돌 대상: `spec/5-system/1-auth.md §5` (예: `POST /api/auth/register`), `spec/5-system/12-webhook.md §3.1` (`POST /api/hooks/:endpointPath`), `spec/5-system/10-graph-rag.md §5` (`POST /api/knowledge-bases/:kbId/...`), `spec/2-navigation/1-workflow-list.md §3` (`GET /api/workflows`) 등 전체 API spec
  - 상세: 다른 모든 spec 의 API 경로는 `/api/` prefix 만 사용하며 버전 세그먼트가 없다. re-run spec 만 `/api/v1/` 을 명시해 API 규약 불일치가 발생한다. 구현 시 라우터에서 충돌하거나, 실제로 v1 prefix 가 없으면 경로 자체가 동작하지 않는다.
  - 제안: `spec/5-system/2-api-convention.md` 에 버전 접두사 정책(예: 버전 없음 또는 `/api/v1/` 통일)이 있다면 그에 맞춰 re-run spec 또는 다른 spec 전체를 일치시킨다. 없다면 re-run spec 의 경로를 `/api/executions/:executionId/re-run` 으로 수정해 기존 spec 패턴에 맞춘다.

---

- **[WARNING]** `spec/5-system/1-auth.md §5` — 초대 수락 엔드포인트 경로 모호성 (`/api/workspaces/invitations/accept` vs. `/api/v1/workspaces/:id/invitations/accept`)
  - target 위치: `spec/5-system/1-auth.md §1.5.3` 흐름 step 3 (`POST /api/workspaces/invitations/accept { token }`) 및 §5 엔드포인트 목록 ("초대 발송·재발송·취소·수락 엔드포인트는 사용자 프로필 spec §6.1 에 정의")
  - 충돌 대상: `spec/5-system/1-auth.md §1.5.2` 흐름 step 1 (`POST /api/v1/workspaces/:id/invitations { email, role }` — `/api/v1/` 버전 세그먼트 포함 + `:id` 경로 파라미터)
  - 상세: §1.5.2 의 초대 발송 엔드포인트는 `/api/v1/workspaces/:id/invitations` 형식이지만, §1.5.3 의 수락 엔드포인트는 `/api/workspaces/invitations/accept` (워크스페이스 ID 없음, v1 없음)로 형식이 다르다. 사용자 프로필 spec 에 위임한다고만 명시하고 경로가 일치하는지 불확실하다.
  - 제안: auth spec §1.5.2 와 §1.5.3 의 엔드포인트 경로 형식을 동일하게 통일한다. 또한 사용자 프로필 spec §6.1 에서 정의한 경로와 대조해 일치시키고, auth spec 에 "cross-reference 확인" 주석을 추가한다.

---

- **[WARNING]** `spec/5-system/13-replay-rerun.md §RR-PL-06` — Re-run 권한 규칙이 `spec/5-system/1-auth.md §3.2` RBAC 매트릭스에 미반영
  - target 위치: `spec/5-system/13-replay-rerun.md §RR-PL-06` — "원본 실행 시작자 + Editor+ (Owner/Admin/Editor) 조합" 규칙
  - 충돌 대상: `spec/5-system/1-auth.md §3.2 리소스별 권한 매트릭스` — Workflow 실행 행: `Owner/Admin/Editor: ✅, Viewer: —`
  - 상세: RBAC 매트릭스의 "Workflow 실행" 항목은 Editor+ 권한이면 실행 가능하다고 명시한다. Re-run 은 실행의 파생 동작임에도 매트릭스에 별도 행이 없고, "원본 실행 시작자 여부"라는 추가 조건이 숨어 있다. 즉, Admin 이 다른 사람의 실행을 Re-run 할 수 있는지가 매트릭스만 보면 알 수 없다(re-run spec 은 "Owner/Admin 이면 OK"라고 하지만 매트릭스에는 없음).
  - 제안: `spec/5-system/1-auth.md §3.2` 권한 매트릭스에 "Workflow Re-run" 행을 추가하거나, Workflow 실행 항목의 비고에 RR-PL-06 을 참조 표시한다.

---

- **[WARNING]** `spec/5-system/11-mcp-client.md §8.3` — 존재하지 않는 "§14 핸들러 실행 세멘틱" 참조
  - target 위치: `spec/5-system/11-mcp-client.md §8.3 IntegrationUsageLog` — "[Spec 통합 §14 핸들러 실행 세멘틱](../2-navigation/4-integration.md#14-연관-동작)"
  - 충돌 대상: `spec/2-navigation/4-integration.md` — 제공된 코퍼스에서 §14 섹션이 확인되지 않음
  - 상세: MCP 클라이언트 spec 이 integration spec 의 §14 를 참조하지만, integration spec 에 §14 섹션("핸들러 실행 세멘틱")이 존재하는지 코퍼스에서 확인할 수 없다. 앵커(`#14-연관-동작`)가 실제로 없다면 dead-link 이며, 구현 팀이 usage 로그 작성 정책을 파악할 수 없다.
  - 제안: `spec/2-navigation/4-integration.md` 에 §14(또는 해당 섹션)가 실제로 존재하는지 확인하고, 없다면 mcp-client spec 의 참조를 올바른 앵커로 수정하거나 mcp-client spec 안에 usage 로그 정책을 직접 기술한다.

---

- **[INFO]** `spec/5-system/13-replay-rerun.md §9.2` — `dryRun` 필드가 API 응답에 포함되지만 DB 컬럼으로는 v2+ 로 유예
  - target 위치: `spec/5-system/13-replay-rerun.md §8.1 Response 201` — `dryRun: boolean` 필드 포함, §9.2 — "Execution 단위 dry_run 컬럼은 v2+ 검토"
  - 충돌 대상: `spec/1-data-model.md §2.13 Execution` — `dry_run` 컬럼 없음
  - 상세: API 응답은 `dryRun: boolean` 을 반환하지만 DB 에는 해당 컬럼이 없다. v1 에서는 NodeExecution._dryRun 을 집계해 도출한다는 방침이나, 집계 로직이 spec 에 기술되지 않아 구현 시 해석이 달라질 수 있다. 중요성은 낮지만 "API 응답에 있는 값의 SoT 가 불명확"하다는 점에서 동기화 필요.
  - 제안: re-run spec §8.1 응답 섹션에 `dryRun` 필드의 도출 방법("NodeExecution.outputData._dryRun 이 하나라도 true 이면 true")을 한 줄 주석으로 명시한다.

---

- **[INFO]** `spec/5-system/10-graph-rag.md §6` — WebSocket 채널 명칭 `kb:{documentId}` 가 직관적이지 않음
  - target 위치: `spec/5-system/10-graph-rag.md §6 WebSocket 이벤트` — "채널은 `kb:{documentId}` (spec/5-system/8-embedding-pipeline.md §8 과 동일)"
  - 충돌 대상: 채널 이름이 KB ID 가 아닌 Document ID 를 키로 사용함. 명칭이 `kb:` prefix 이지만 실제로 documentId 를 구독 단위로 한다.
  - 상세: 직접적인 명세 충돌은 아니지만, `kb:{documentId}` 라는 채널 이름은 혼동을 유발한다 — `kb:` prefix 가 KB 단위를 암시하지만 실제 값은 Document ID 다. embedding-pipeline spec 과 동일 채널을 사용한다고 명시되어 있으므로 일관성 자체는 있지만, 프론트엔드 구현 시 잘못된 구독 대상(KB ID)을 사용할 위험이 있다.
  - 제안: `spec/5-system/10-graph-rag.md §6` 에 채널 이름 옆에 `{documentId}` 임을 강조하는 주석을 추가한다. 장기적으로는 embedding-pipeline spec 과 함께 채널 네이밍 규약을 `spec/conventions/` 에 정식화하는 것을 권장한다.

---

- **[INFO]** `spec/5-system/1-auth.md §4.1` — AuditLog 조회 권한 표기 불일치
  - target 위치: `spec/5-system/1-auth.md §4.2` — "관리자(Admin+)만 조회 가능"
  - 충돌 대상: `spec/5-system/1-auth.md §3.2 RBAC 매트릭스` — `Audit Log: R(Owner), R(Admin), —(Editor), —(Viewer)`
  - 상세: §4.2 의 "Admin+" 표현은 매트릭스와 실질적으로 동일하지만, 매트릭스는 `R` 로 표기하고 §4.2 는 `관리자(Admin+)만` 이라 명시해 표기 방식이 다르다. Owner 가 포함되는지 여부가 모호하게 읽힐 수 있다(Owner 는 암묵적으로 Admin 이상이지만 "Admin+" 표현이 Owner 를 포함하는지 오해 여지 있음).
  - 제안: §4.2 표현을 "Owner 또는 Admin (§3.2 Audit Log 권한 행 참조)"으로 수정해 명시적으로 일치시킨다.

---

### 요약

`spec/5-system/` 의 4개 주요 문서를 교차 검토한 결과, **CRITICAL 2건, WARNING 4건, INFO 3건** 총 9개 이슈가 발견되었다. 가장 시급한 문제는 `spec/5-system/13-replay-rerun.md` 가 추가하는 `re_run_of` / `chain_id` 컬럼이 `spec/1-data-model.md §2.13` 에 반영되지 않아 데이터 모델의 단일 진실이 깨진 것과, `spec/5-system/10-graph-rag.md §2.2` 의 `graph_extraction_status` Enum 목록에서 `failed` 상태가 누락된 것이다. 두 CRITICAL 은 구현 팀이 각 spec 을 독립적으로 읽을 경우 서로 다른 스키마를 구현하거나 상태 머신이 불완전하게 구현될 직접적 위험을 내포한다. WARNING 4건은 API 버전 prefix 불통일, 초대 엔드포인트 경로 모호성, Re-run 권한의 RBAC 매트릭스 미반영, dead-link 참조로 구성되어 있으며, 구현 착수 전에 정책 결정 또는 spec 동기화가 필요하다.

### 위험도

HIGH
