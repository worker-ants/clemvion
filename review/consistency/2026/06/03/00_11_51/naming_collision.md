# 신규 식별자 충돌 검토 결과

## 검토 대상

`plan/in-progress/system-status-page.md` — spec draft A~E

---

## 발견사항

### WARNING: §3.9 재번호로 인한 기존 anchor 링크 파손

- **target 신규 식별자**: `§3.9 System Status` (신규 삽입) — 기존 `§3.9 Marketplace` → `§3.10`, `§3.10 User Guide` → `§3.11`, `§3.11 User Profile` → `§3.12` 로 밀림
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/system-status-page-f96d24/spec/2-navigation/8-marketplace.md` line 9: `_product-overview.md#39-marketplace-마켓플레이스`
  - `/Volumes/project/private/clemvion/.claude/worktrees/system-status-page-f96d24/spec/2-navigation/9-user-profile.md` line 10: `_product-overview.md#311-user-profile-사용자-프로필`
- **상세**: target 의 D항에서 "기존 3.9 Marketplace→3.10, 3.10 User Guide→3.11, 3.11 User Profile→3.12" 로 재번호하면 위 두 파일의 anchor 링크(`#39-marketplace-마켓플레이스`, `#311-user-profile-사용자-프로필`)가 깨진다. 마크다운 anchor 는 헤더 텍스트 전체를 slug 화하므로 섹션 번호가 바뀌면 기존 링크가 무효화된다.
- **제안**: spec D 항 변경 시 `8-marketplace.md` 와 `9-user-profile.md` 의 관련 문서 링크를 새 anchor 로 동시 갱신한다 (`#310-marketplace-마켓플레이스`, `#312-user-profile-사용자-프로필`). target plan 에 이 파일 갱신을 명시적으로 포함해야 한다.

---

### INFO: `health` 필드 어휘 — 기존 도메인과 다른 enum 값 집합 사용

- **target 신규 식별자**: `health: "ok" | "degraded" | "down"` (`QueueStatusDto`, `SystemStatusOverviewDto.overall`)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/system-status-page-f96d24/spec/5-system/14-external-interaction-api.md` line 565: `notification_health` — `'unknown'|'healthy'|'degraded'`
  - `/Volumes/project/private/clemvion/.claude/worktrees/system-status-page-f96d24/spec/5-system/15-chat-channel.md` line 264: `chat_channel_health` — `'unknown'|'healthy'|'degraded'`
  - `/Volumes/project/private/clemvion/.claude/worktrees/system-status-page-f96d24/codebase/backend/src/modules/health/dto/responses/health-response.dto.ts`: `HealthCheckDto.status` — `'healthy'|'unhealthy'`
- **상세**: 기존 두 health 어휘군은 각각 `healthy/unhealthy` (인프라 헬스체크), `unknown/healthy/degraded` (알림·채널 건강도)를 사용한다. 새 `QueueStatusDto.health` 는 `ok/degraded/down` 으로 `ok`(기존에서는 `healthy`)와 `down`(기존에서는 없는 값)을 새롭게 도입한다. 직접 충돌이 아니라 도메인이 다른 별개 필드이지만, 같은 제품 안에서 `health` 라는 단어에 세 가지 다른 어휘 체계가 공존하게 된다.
- **제안**: target spec A 의 Rationale 에 "기존 `notification_health`·`chat_channel_health` 의 `healthy/degraded` 와 어휘가 다른 이유" 를 한 줄 명시하거나, `healthy`를 `ok` 대신 그대로 사용하는 방향을 검토한다.

---

### INFO: spec frontmatter `id` 값 중복 없음 — 확인 완료

- target A 의 `id: system-status` 및 target B 의 `id: system-status-page` 는 기존 `spec/5-system/` 과 `spec/2-navigation/` 전체에서 사용 중인 어떤 id 값과도 겹치지 않는다.

---

### INFO: 파일 번호 충돌 없음 — 확인 완료

- `spec/5-system/16-system-status.md` — 기존 `spec/5-system/` 에 `16-` prefix 파일 없음.
- `spec/2-navigation/15-system-status.md` — 기존 `spec/2-navigation/` 에 `15-` prefix 파일 없음.

---

### INFO: API endpoint 충돌 없음 — 확인 완료

- `GET /queue-monitor/overview` — 기존 spec 및 codebase 전체에 동일 경로 정의 없음. 기존 `GET /health` 는 인프라 liveness 체크 목적이고 경로·controller 모두 별개이므로 충돌 없음.

---

### INFO: 요구사항 ID 충돌 없음 — 확인 완료

- `NAV-SS-01` ~ `NAV-SS-06`: 기존 `spec/2-navigation/_product-overview.md` 에 `NAV-SS-` prefix 를 가진 ID 없음.
- `NF-OB-06`: 기존 `spec/5-system/_product-overview.md` 의 NF-OB 계열은 `NF-OB-01` ~ `NF-OB-05` 까지 사용 중. `NF-OB-06` 은 미사용.

---

### INFO: 환경변수 충돌 없음 — 확인 완료

- `QUEUE_MONITOR_FAILED_THRESHOLD`, `QUEUE_MONITOR_DELAYED_THRESHOLD` — 기존 spec 및 codebase 어디에도 동일 ENV var 없음.
- `CONTINUATION_WORKER_CONCURRENCY` 는 기존 `spec/5-system/4-execution-engine.md` 에서 이미 정의된 변수를 target 이 단순 인용하는 것이므로 충돌 아님.

---

### INFO: DTO 명 충돌 없음 — 확인 완료

- `SystemStatusOverviewDto`, `QueueStatusDto`, `QueueRegistry` — 기존 codebase 어디에도 이 이름을 가진 class/interface 없음.

---

## 요약

신규 식별자(요구사항 ID, spec frontmatter id, API endpoint, ENV var, DTO 명, 파일 번호) 관점에서 치명적 충돌은 없다. 단, `spec/2-navigation/_product-overview.md` 의 §3.9~§3.11 재번호 작업이 기존 두 spec 파일(`8-marketplace.md`, `9-user-profile.md`)의 anchor 링크를 파손시키므로, 해당 파일의 링크를 동시 갱신하지 않으면 문서 내비게이션이 깨진다. 이 사항을 작업 체크리스트에 명시적으로 추가하면 충분히 해소 가능하다. 추가로 `health` 필드 어휘(ok/degraded/down)가 기존 도메인들(`healthy/unhealthy`, `unknown/healthy/degraded`)과 다른 체계를 사용하지만, 도메인이 분리되어 있어 실제 혼선 가능성은 낮다.

## 위험도

LOW

STATUS: SUCCESS
