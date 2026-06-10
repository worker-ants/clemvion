# 신규 식별자 충돌 검토 결과

검토 대상: branch `claude/spec-sync-audit-998544` vs `origin/main` — spec/ 변경 전체 (~75 파일, +2578 / -503 행)

---

## 발견사항

### 1. `NodeTypeMetadata.kind` 값이 기존 `executionMetadata.kind` 와 enum 어휘 공유

- **[WARNING]** `NodeTypeMetadata.kind` discriminated-union 과 `executionMetadata.kind` 의 값 집합 혼동 가능
  - target 신규 식별자: `spec/5-system/4-execution-engine.md §5.4` 에 새로 도입된 `NodeTypeMetadata` 의 `kind` 값 집합 (`standard` / `container` / `background` / `parallel` / `blocking` / `trigger`)
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-audit-998544/spec/4-nodes/1-logic/9-foreach.md` line 14 — `executionMetadata.kind = 'container'`
    - `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-audit-998544/spec/4-nodes/1-logic/7-map.md` line 12 — `executionMetadata.kind = 'container'`
    - `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-audit-998544/spec/4-nodes/1-logic/10-parallel.md` line 12 — `executionMetadata.kind = 'parallel'`
  - 상세: 두 `kind` 는 서로 다른 객체(`executionMetadata` = 핸들러 런타임 출력, `NodeTypeMetadata` = 레지스트리 등록 메타)의 필드이나 동일 어휘(`container`, `parallel`)를 사용한다. spec 독자가 "nodeType registry 의 `kind: 'container'`" 와 "핸들러 반환의 `executionMetadata.kind = 'container'`" 를 동일 개념으로 혼동할 수 있다. `executionMetadata` 는 spec 에서 단 3곳에만 등장하며 SoT 정의 섹션이 없어 독자 혼동이 더 크다.
  - 제안: `4-execution-engine.md §5.4` 의 `NodeTypeMetadata.kind` 테이블 바로 아래에 "`executionMetadata.kind` (핸들러 런타임 출력) 와 동일 어휘를 공유하나 별개 객체·별개 소비처임" 을 한 줄 주석으로 명문화. 또는 `NodeTypeMetadata.kind` 를 `dispatchKind` 로 rename 해 명확히 구분.

---

### 2. `agent-memory-extraction` 큐가 `spec/5-system/16-system-status-api.md` 모니터링 레지스트리에 누락

- **[WARNING]** 신규 BullMQ 큐 `agent-memory-extraction` 이 시스템 상태 모니터링 목록에서 빠져 있음
  - target 신규 식별자: BullMQ 큐 이름 `agent-memory-extraction` — `spec/data-flow/0-overview.md §4` 카탈로그(15개 목록)와 `spec/data-flow/13-agent-memory.md`, `spec/5-system/17-agent-memory.md` 에 등록
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-audit-998544/spec/5-system/16-system-status-api.md` §1 대상 큐 레지스트리 표 — 14개 큐를 열거하며 `agent-memory-extraction` 이 없음
  - 상세: `data-flow/0-overview.md` 는 15개 큐를 선언하지만 `16-system-status-api.md` 는 14개만 포함한다. `data-flow/0-overview.md` 자신이 "본 카탈로그를 먼저 갱신하고 그 레지스트리를 동기화한다"(`MONITORED_QUEUES` 는 본 표를 SoT 로 삼는다) 고 명시했으므로, `16-system-status-api.md` 가 동기화되지 않은 상태다. 모니터링 대시보드에서 `agent-memory-extraction` 큐가 집계되지 않아 추출 실패를 조기 감지하지 못한다.
  - 제안: `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-audit-998544/spec/5-system/16-system-status-api.md` §1 표에 `| agent-memory-extraction | knowledge-base | 2 | Agent Memory 턴 경계 비동기 추출 |` 행 추가.

---

### 3. `OAUTH_PREVIEW_MISMATCH` 에러 코드가 기존 `oauth_state_mismatch` (DB 저장값)와 혼동 가능

- **[INFO]** 신규 API 에러 코드 `OAUTH_PREVIEW_MISMATCH` 가 기존 DB 저장값 `oauth_state_mismatch` 와 어휘 충돌 가능성
  - target 신규 식별자: `OAUTH_PREVIEW_INVALID` / `OAUTH_PREVIEW_EXPIRED` / `OAUTH_PREVIEW_MISMATCH` — `spec/data-flow/5-integration.md §1.1` 에 새로 도입된 previewToken 소비 실패 에러 코드
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-audit-998544/spec/1-data-model.md` line 285 — `status_reason` 값 목록에 `oauth_state_mismatch`, `oauth_state_expired` (snake_case DB 저장값)
    - `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-audit-998544/spec/conventions/error-codes.md` line 35 — `OAUTH_STATE_MISMATCH` API 에러 코드
  - 상세: 기존에 `OAUTH_STATE_MISMATCH`(OAuth state 검증 실패)와 `OAUTH_PREVIEW_MISMATCH`(previewToken service_type 불일치)가 공존한다. 두 코드의 의미가 다르고(전자 = state 파라미터 불일치, 후자 = service_type 불일치) 발생 경로도 다르므로 실제 충돌은 아니다. 그러나 `MISMATCH` 접미사를 두 다른 의미에 재사용해 에러 처리 코드 작성자가 혼동할 수 있다.
  - 제안: `spec/data-flow/5-integration.md §1.1` 주석 또는 에러 코드 규약(`spec/conventions/error-codes.md`)에 두 코드의 구분을 명시. 대안으로 `OAUTH_PREVIEW_MISMATCH` → `OAUTH_PREVIEW_SERVICE_MISMATCH` 로 rename.

---

### 4. `exec:seq:<executionId>` Redis 키가 기존 `exec:cont:seq:<executionId>` 와 네임스페이스 중복 외관

- **[INFO]** 신규 Redis 키 패턴 `exec:seq:` 와 기존 `exec:cont:seq:` 가 접두사 공유
  - target 신규 식별자: `exec:seq:<executionId>` — `spec/5-system/4-execution-engine.md §9.2` 에 신규 추가된 emit-event seq 카운터 키
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-audit-998544/spec/5-system/4-execution-engine.md §9.2` — `exec:cont:seq:<executionId>` (continuation publish seq)
  - 상세: 두 키는 `exec:` 접두사를 공유하나 `exec:seq:<id>` 와 `exec:cont:seq:<id>` 는 명확히 다른 문자열이므로 실제 Redis 키 충돌은 없다. `exec:run:seq:<executionId>` (PR3/PR4 예약)도 마찬가지. spec 본문 자체도 "namespace 분리" 를 명시(`exec:cont:seq:` 와 namespace 분리)하고 있다. 그러나 `exec:seq:` 가 `exec:cont:seq:` 의 단축형처럼 보여 오독 가능성이 있다.
  - 제안: INFO 수준. 현 네이밍을 유지하되, `spec/5-system/4-execution-engine.md §9.2` 의 주석 "exec:seq: 는 WS/SSE/Notification 공유 emit-event seq 전용 — exec:cont:seq: (continuation seq) 와 목적·TTL 이 다름" 을 이미 기재했으므로 충분함. 추가 조치 불필요.

---

### 5. `integration_oauth_preview` 엔티티가 `spec/1-data-model.md` 데이터 모델에 미등록

- **[INFO]** 신규 DB 엔티티 `integration_oauth_preview` 가 `spec/1-data-model.md` 에 정의 섹션 없음
  - target 신규 식별자: 테이블 `integration_oauth_preview` — `spec/data-flow/5-integration.md §2` sink 카탈로그와 mermaid 다이어그램에 도입
  - 기존 사용처: `spec/1-data-model.md` 는 `integration_oauth_state` 를 §2 에서 정의하지 않는다(data-flow 에만 존재). 두 엔티티 모두 data-flow spec 에만 정의되고 1-data-model.md 에 없다.
  - 상세: `integration_oauth_state` 도 이미 1-data-model.md 에 없고 data-flow 에만 존재하는 상태다. `integration_oauth_preview` 도 동일 패턴이라 일관성은 있다. 그러나 DB 스키마 변경 시 data-model 과 data-flow 두 곳을 각각 갱신해야 하는 분산 SoT 문제가 잠재한다.
  - 제안: 기존 패턴(data-flow SoT)을 따르는 것이라면 현 상태 유지 가능. 엄격히는 `spec/1-data-model.md §2` 하단에 `integration_oauth_state` / `integration_oauth_preview` / `integration_expiry_dispatch` 세 보조 엔티티를 간략히 cross-reference 추가 권장.

---

## 요약

이번 브랜치는 75개 spec 파일에 걸친 대규모 drift 적용으로, 신규 도입된 식별자 대부분은 기존 어휘 체계를 올바르게 확장한다. 요구사항 ID(AGM-*)·Redis 키(exec:seq:)·BullMQ 큐 이름·에러 코드 체계는 기존 네임스페이스와 충돌하지 않는다. 주의가 필요한 항목은 두 가지다: (1) `NodeTypeMetadata.kind` 와 기존 `executionMetadata.kind` 가 동일 enum 어휘를 다른 객체에서 재사용해 독자 혼동을 유발할 수 있고(WARNING), (2) 신규 BullMQ 큐 `agent-memory-extraction` 이 `spec/5-system/16-system-status-api.md` 모니터링 레지스트리에서 누락되어 카탈로그 count(15)와 레지스트리 count(14)가 불일치한다(WARNING). 나머지 두 항목은 어휘 유사성으로 인한 오독 가능성(INFO)이며 실제 충돌은 아니다.

## 위험도

LOW
