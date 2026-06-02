# 신규 식별자 충돌 검토 결과

> 검토 모드: `--impl-prep` (구현 착수 전)  
> 대상: `spec/5-system/16-system-status-api.md` (target)  
> 연관 UI spec: `spec/2-navigation/15-system-status.md`

---

## 발견사항

### 1. 요구사항 ID 충돌

- **[INFO]** `id: system-status-api` vs `id: system-status` 분리는 명확  
  - target 신규 식별자: `system-status-api` (`spec/5-system/16-system-status-api.md` frontmatter)  
  - 기존 사용처: `spec/2-navigation/15-system-status.md` 가 `id: system-status` 를 사용 중  
  - 상세: 두 문서의 id 가 다르므로 충돌은 없음. `system-status` (UI) vs `system-status-api` (백엔드 API) 로 쌍이 명시적으로 분리되어 있고, `plan/in-progress/system-status-page.md §네이밍 통일` 에서도 이 분리가 확인·정의되어 있음.  
  - 제안: 충돌 없음. 현행 유지.

---

### 2. 엔티티/타입명 충돌

- **[WARNING]** `health` 어휘 3단계 확장 — `spec/5-system/3-error-handling.md` 의 `/api/health` 응답과 의미 중첩  
  - target 신규 식별자: `QueueStatusDto.health: "healthy" | "degraded" | "down"` 및 `SystemStatusOverviewDto.overall: "healthy" | "degraded" | "down"`  
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/system-status-page-f96d24/spec/5-system/3-error-handling.md` §7 줄 357–361 — `GET /api/health` 의 전체 상태가 `healthy | degraded | unhealthy` 3단계로 정의되어 있음  
  - 상세: `spec/3-error-handling.md` 는 `degraded`(비필수 checks 실패) + `unhealthy`(필수 checks 실패) 를 `/api/health` 에 정의하고 있으나 실제 `health.service.ts` 구현은 `healthy | unhealthy` binary 만 사용한다(spec-impl 불일치). target 은 동일한 어휘 `degraded` 를 큐 health 에 사용하되 `down` 을 `unhealthy` 대신 사용한다. target `Rationale R-4` 는 이를 의식적 분기로 설명하고 있음. 두 도메인(infra health vs queue health)에서 `degraded` 의 의미는 유사하나 `down` vs `unhealthy` 는 서로 다른 값으로 동일 상황을 표현한다.  
  - 제안: 실질 충돌보다는 어휘 불일치 위험이다. `spec/3-error-handling.md` §7 의 `/api/health` 상태 표를 `healthy | unhealthy` (구현 실제) 로 교정하거나, 또는 `/api/health` 와 큐 health 어휘가 의도적으로 다른 도메인임을 spec 에 명시하면 혼동을 방지할 수 있다. target 자체는 R-4 에서 이미 설명했으므로 이 방향으로 충분함.

- **[INFO]** `QueueRegistry` / `QueueStatusDto` / `SystemStatusOverviewDto` 신규 DTO  
  - target 신규 식별자: `QueueRegistry`, `QueueStatusDto`, `SystemStatusOverviewDto`  
  - 기존 사용처: codebase 검색 결과 없음. spec 전체 검색에서도 해당 이름 없음.  
  - 상세: 충돌 없음.

---

### 3. API endpoint 충돌

- **[INFO]** `GET /api/system-status/overview` 신규 경로  
  - target 신규 식별자: `GET /api/system-status/overview`  
  - 기존 사용처: spec 전체 및 codebase 검색 결과 해당 경로 없음  
  - 상세: 충돌 없음. `GET /api/health` 와 경로 및 의미가 구분됨.

- **[INFO]** plan draft 의 `/queue-monitor/overview` → 실제 spec 의 `/api/system-status/overview` 로 갱신 확인됨  
  - `plan/in-progress/system-status-page.md` 초안은 `/queue-monitor/overview` 를 사용했으나, 동 파일 줄 237 의 "네이밍 통일" 단락에서 `/system-status` 으로 변경하고 `queue-monitor` 폐기를 명시함. 현재 spec 파일 `16-system-status-api.md` 는 `/api/system-status/overview` 를 사용하며 일관성 있음. codebase 에 `queue-monitor` 잔재 없음.  
  - 충돌 없음.

---

### 4. 이벤트/메시지명 충돌

- **[INFO]** 신규 WebSocket / BullMQ 이벤트 없음  
  - target spec 은 WebSocket 이벤트나 BullMQ 이벤트 이름을 신규 도입하지 않음. API 폴링(React Query 5초) + REST 응답만 사용.  
  - 충돌 없음.

---

### 5. 환경변수·설정키 충돌

- **[INFO]** `SYSTEM_STATUS_FAILED_THRESHOLD`, `SYSTEM_STATUS_DELAYED_THRESHOLD` 신규  
  - target 신규 식별자: `SYSTEM_STATUS_FAILED_THRESHOLD`, `SYSTEM_STATUS_DELAYED_THRESHOLD`  
  - 기존 사용처: codebase `backend/.env.example` 및 전체 codebase 검색 결과 해당 이름 없음  
  - 상세: 충돌 없음. prefix `SYSTEM_STATUS_` 가 명확하고 기존 env var 네임스페이스와 겹치지 않음.

---

### 6. 파일 경로 충돌

- **[INFO]** `spec/5-system/16-system-status-api.md` 신규 파일  
  - target 신규 식별자: 파일명 `16-system-status-api.md`  
  - 기존 파일 목록: `spec/5-system/` 내 `1-auth.md` ~ `15-chat-channel.md` 까지 연속된 번호 사용. 16번은 비어 있었음.  
  - 상세: 충돌 없음. 번호 순서가 자연스럽게 이어짐. 관련 UI spec `spec/2-navigation/15-system-status.md` 가 이미 존재하며 두 파일이 cross-reference 하고 있음.

---

## 요약

`spec/5-system/16-system-status-api.md` 가 도입하는 신규 식별자들(API endpoint `GET /api/system-status/overview`, DTO `SystemStatusOverviewDto`·`QueueStatusDto`·`QueueRegistry`, ENV `SYSTEM_STATUS_FAILED_THRESHOLD`·`SYSTEM_STATUS_DELAYED_THRESHOLD`, spec id `system-status-api`, 파일 경로 `16-system-status-api.md`) 은 모두 기존 사용처와 충돌하지 않는다. 주의할 점은 `spec/5-system/3-error-handling.md` §7 이 `/api/health` 에 `degraded` 어휘를 정의하나 구현이 binary(`healthy|unhealthy`)이고, target 큐 health 도 `degraded` 를 사용하되 `down` 을 별도 도입해 어휘 집합이 다르다. 이는 의도적 분기(R-4)로 이미 명시되었으므로 실질 충돌은 없으나 `/api/health` spec 과 구현 간 기존 불일치가 누적된 상황에서 어휘 혼동 가능성이 있어 WARNING 으로 기록한다.

---

## 위험도

LOW
