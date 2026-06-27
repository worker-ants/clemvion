# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/data-flow/**` (구현 완료 후 검토, diff-base=origin/main)
**검토 일시**: 2026-06-27

---

## 발견사항

---

### [CRITICAL] `spec/data-flow/10-triggers.md` — `endpointPath` UUID 강제 주장이 코드와 불일치

- **target 위치**: `spec/data-flow/10-triggers.md` Rationale "Webhook `endpoint_path` 의 UNIQUE 범위" 섹션
- **충돌 대상**:
  - `codebase/backend/src/modules/triggers/dto/create-trigger.dto.ts` (endpointPath 필드)
  - `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` (endpointPath 필드)
  - `spec/5-system/12-webhook.md` WH-MG-02 (UUID 자동 생성 = 클라이언트 책임)
- **상세**:
  이 PR 의 diff 는 기존 문장 "서버는 UUID 형식을 강제하지 않는다"를 다음으로 교체했다:
  > **서버가 생성/수정 DTO 에서 v4 UUID 형식을 강제한다**(`@IsUUID('4')` — `create-trigger.dto.ts`·`update-trigger.dto.ts`)

  그러나 실제 코드에서 `endpointPath` 필드에는 `@IsString()` + `@MaxLength(255)` 만 선언되어 있고 `@IsUUID()` 는 없다. `create-trigger.dto.ts` 의 `@IsUUID()` (line 24)는 `workflowId`, (line 87)는 `authConfigId` 에 해당하며, `endpointPath` 와 무관하다. `update-trigger.dto.ts` 도 동일하다. `create-trigger.dto.ts` 의 `endpointPath` 예시값 자체가 `'/hooks/my-integration'` 으로 비-UUID 형식이다.
  결과적으로 spec 이 존재하지 않는 보안 강제를 선언하게 되며, spec 을 신뢰하는 구현자·감사자가 서버 검증이 실제로 일어난다고 오해할 위험이 있다. 기존 `spec/5-system/12-webhook.md` WH-MG-02 도 UUID 를 "자동 생성" 으로만 기술하고 서버 강제를 언급하지 않는다.
- **제안**: 이 Rationale 섹션을 원래 문장("서버는 UUID 형식을 강제하지 않는다")으로 되돌리거나, 실제로 `@IsUUID('4')` 를 `endpointPath` 에 추가하는 구현 후 spec 을 동기화한다. 구현을 추가하는 경우 `spec/5-system/12-webhook.md` WH-MG-02 에도 "서버단 UUID 형식 강제" 사실을 명시해야 한다.

---

### [CRITICAL] `spec/data-flow/12-workspace.md` — `WorkspaceInvitationsPrunerService` BullMQ 잡 미구현 사실과 충돌

- **target 위치**: `spec/data-flow/12-workspace.md` §1.2 (만료 초대 정리), §3.1 (Expired 실제 수명)
- **충돌 대상**:
  - `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그 (workspace-invitation-pruner 큐 미등록)
  - `codebase/backend/src/modules/system-status/system-status.constants.ts` MONITORED_QUEUES (해당 큐 없음)
  - 기존 `spec/data-flow/12-workspace.md` (동일 파일의 origin/main 버전): "현재 프로덕션 호출자가 없어 만료 row 는 영구 잔존한다. 정리 job 연결은 미구현."
- **상세**:
  이 PR 의 diff 는 §1.2 에 "매일 04:00 Asia/Seoul 에 BullMQ repeatable 잡(`WorkspaceInvitationsPrunerService`)이 삭제한다" 를 추가하고, §3.1 에서 "미구현" 표기를 "구현됨"으로 교체했다. 그러나:
  1. `WorkspaceInvitationsPrunerService` 라는 클래스는 codebase 어디에도 존재하지 않는다(`WorkspaceInvitationsService.pruneExpired` 메서드만 있음, 호출자 없음).
  2. `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그는 이 PR 에서 수정되지 않았으며 workspace-invitation-pruner 큐를 포함하지 않는다. 카탈로그가 "16개"를 계속 선언하므로 §12-workspace.md 의 주장과 내부 모순이 발생한다.
  3. `MONITORED_QUEUES` 레지스트리에도 해당 큐가 없다.
  spec 이 구현됐다고 선언하지만 코드·카탈로그·모니터링 레지스트리 모두 그 사실을 뒷받침하지 않는다.
- **제안**: (A) 구현이 실제로 이뤄졌다면 — `WorkspaceInvitationsPrunerService` + BullMQ 등록 코드를 실제로 구현하고, `spec/data-flow/0-overview.md §4` 카탈로그에 해당 큐를 추가(큐 이름·모듈·스케줄·작업 단위), `MONITORED_QUEUES` 레지스트리도 동기화한다. (B) 구현이 아직 미완성이라면 — 이 PR 에서 변경된 두 문단을 되돌려 "미구현" 상태를 유지한다.

---

### [WARNING] `spec/data-flow/0-overview.md §4` — `agent-memory-extraction` 큐가 MONITORED_QUEUES 에서 누락

- **target 위치**: `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그 (agent-memory-extraction 행)
- **충돌 대상**: `codebase/backend/src/modules/system-status/system-status.constants.ts` MONITORED_QUEUES
- **상세**:
  `spec/data-flow/0-overview.md §4` 는 `agent-memory-extraction` 을 16개 큐 중 하나로 등록하고, 카탈로그 주석에 "코드 측 큐 모니터링 레지스트리 `MONITORED_QUEUES` 는 본 표를 SoT 로 삼는다"고 선언한다. 그러나 `system-status.constants.ts` 의 `MONITORED_QUEUES` 에는 `agent-memory-extraction` 이 없다(15개). 큐 자체는 `agent-memory.module.ts` 에 BullMQ 로 등록되어 있어 operational 큐는 맞으나, 시스템 상태 화면에서 보이지 않는다.
  이 불일치는 이 PR 이 도입한 것이 아니라 기존 항목이나, spec 이 SoT 임을 명시하고 있으므로 gap 은 명시될 필요가 있다.
- **제안**: `system-status.constants.ts` 의 `MONITORED_QUEUES` 에 `agent-memory-extraction` 큐를 추가하거나, spec 카탈로그에 "시스템 상태 모니터링에서 제외 — fire-and-forget 특성" 같은 주석을 달아 의도적 제외임을 명시한다.

---

### [WARNING] `spec/data-flow/0-overview.md §5` — HNSW 인덱스 대상이 KB 에 한정 기술, agent_memory 누락

- **target 위치**: `spec/data-flow/0-overview.md §5` 다중 인스턴스·동시성 모델 — "HNSW 인덱스" 항목
- **충돌 대상**: `spec/data-flow/13-agent-memory.md §2.1` Schema 매핑 (V074~V079)
- **상세**:
  `spec/data-flow/0-overview.md §5` 는 "pgvector HNSW 인덱스는 차원별로 분리된 partial index (`V022/V030~V033`) — KB 마다 차원이 다르면 각자 인덱스에 매칭된다"고 기술한다. 이 인덱스는 `document_chunk` 테이블 용이다. 그러나 `spec/data-flow/13-agent-memory.md §2.1` 에 따르면 `agent_memory` 테이블도 동일 패턴의 차원별 HNSW partial index 를 갖는다 (V074~V079). 두 테이블이 같은 `SUPPORTED_EMBEDDING_DIMS` 차원 집합을 공유하지만, 개요 §5 의 설명은 KB 에만 한정해 agent_memory HNSW 인덱스가 누락됐다.
- **제안**: `spec/data-flow/0-overview.md §5` HNSW 항목을 "document_chunk (V022/V030~V033) 및 agent_memory (V074~V079) 모두 차원별 partial index" 로 보완한다.

---

### [INFO] `spec/data-flow/0-overview.md` Rationale "S3 key" — 비교 대상 `spec/0-overview.md §2.7` 의 기술이 이미 수렴됨

- **target 위치**: `spec/data-flow/0-overview.md` Rationale "S3 key 의 코드/spec 불일치 처리"
- **충돌 대상**: `spec/0-overview.md §2.7` Object Storage 버킷 구조
- **상세**:
  data-flow Rationale 는 "`spec/0-overview.md §2.7` 은 S3 버킷 구조를 `{bucket}/{workspaceId}/knowledge-base/{kbId}/...` 로 기술하지만" 이라고 시작한다. 그러나 현재 `spec/0-overview.md §2.7` 의 실제 내용은 `kb/{kbId}/{documentId}/{sanitizedFilename}` (workspaceId 미포함) 와 `{workspaceId}/forms/...`, `{workspaceId}/avatars/...` 로 이미 분리되어 있다 — 즉 spec/0-overview.md 가 이미 코드와 수렴된 상태다. Rationale 가 기술하는 불일치는 더 이상 존재하지 않아, 새 독자에게 혼동을 준다.
- **제안**: `spec/data-flow/0-overview.md` Rationale 의 해당 단락을 "spec/0-overview.md §2.7 과의 불일치는 이미 해소됐다. 본 카탈로그와 동일: `kb/{kbId}/{docId}/{filename}`" 형태로 갱신하거나, 해소된 사실을 명시한다.

---

## 요약

이 PR 의 `spec/data-flow` 변경 중 두 가지 사실 오류가 기존 spec 및 코드베이스와 직접 충돌한다. 첫째, `spec/data-flow/10-triggers.md` Rationale 는 `endpointPath` 에 서버가 `@IsUUID('4')` 를 강제한다고 선언하지만 실제 `create-trigger.dto.ts` / `update-trigger.dto.ts` 에는 해당 검증자가 없어 코드·기존 spec 문장("서버는 UUID 형식을 강제하지 않는다") 모두와 모순된다. 둘째, `spec/data-flow/12-workspace.md` 는 `WorkspaceInvitationsPrunerService` BullMQ 잡이 구현됐다고 선언하지만 해당 서비스 클래스·BullMQ 큐·MONITORED_QUEUES 항목이 모두 없고, 같은 `spec/data-flow` 폴더의 BullMQ 카탈로그(`0-overview.md §4`)와도 내부 모순을 일으킨다. 두 항목 모두 구현 확인 또는 spec 문장 철회가 필요하다. 그 외 `agent-memory-extraction` 큐의 MONITORED_QUEUES 미등록(경고)과 Rationale 의 stale 비교 문구(정보) 가 있다.

---

## 위험도

**HIGH**

*(CRITICAL 2건 — spec 이 존재하지 않는 보안 강제·미구현 서비스를 구현된 것으로 선언)*
