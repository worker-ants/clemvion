# 신규 식별자 충돌 Check — system-status failed 지표 "최근 윈도우 + 누적(보관 중)" 병기

검토 대상: `plan/in-progress/spec-draft-system-status-recent-failed.md`
수정 대상 spec: `spec/5-system/16-system-status-api.md`, `spec/2-navigation/15-system-status.md`

---

## 발견사항

### [WARNING] `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` — spec 본문과 구현 상수명 불일치
- **target 신규 식별자**: draft §3에서 health 규칙 3번을 교체하며 `FAILED_DEGRADED_THRESHOLD`, `DELAYED_DEGRADED_THRESHOLD` 라는 토큰명을 pseudo-code 형태로 노출함
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/5-system/16-system-status-api.md` line 73: 기존 spec 본문도 동일 토큰명 사용 (pseudo-code)
  - `/Volumes/project/private/clemvion/codebase/backend/src/modules/system-status/system-status.constants.ts` lines 84, 86: 구현체 상수명 `FAILED_DEGRADED_THRESHOLD`, `DELAYED_DEGRADED_THRESHOLD`
  - `/Volumes/project/private/clemvion/codebase/backend/.env.example` lines 253, 257: 환경변수명 `SYSTEM_STATUS_FAILED_THRESHOLD`, `SYSTEM_STATUS_DELAYED_THRESHOLD`
- **상세**: spec 본문(기존·신규 모두)은 `FAILED_DEGRADED_THRESHOLD`/`DELAYED_DEGRADED_THRESHOLD` 라는 코드 상수명으로 threshold 를 참조하나, 실제 환경변수명은 `SYSTEM_STATUS_FAILED_THRESHOLD`/`SYSTEM_STATUS_DELAYED_THRESHOLD`다. draft 의 §3 "임계 env `SYSTEM_STATUS_FAILED_THRESHOLD`(기본 1) 재사용" 문장은 env 이름을 올바르게 표기하지만, 같은 절에서 pseudo-code `FAILED_DEGRADED_THRESHOLD` 를 혼용해 독자가 env 이름과 코드 상수명을 혼동할 수 있다. 이는 신규 충돌이 아니라 **기존 spec에 이미 존재하던 표기 혼용**을 draft 가 그대로 이어받은 것이나, 새 규칙을 추가하는 시점에 명확화하지 않으면 혼동이 심화된다.
- **제안**: draft §3 pseudo-code 내 `FAILED_DEGRADED_THRESHOLD` 를 `SYSTEM_STATUS_FAILED_THRESHOLD`(env) 로 통일하거나, "코드 상수 `FAILED_DEGRADED_THRESHOLD` ← env `SYSTEM_STATUS_FAILED_THRESHOLD`" 대응을 명시. 기존 spec line 73 도 함께 정정하면 spec ↔ env 이름 일관성이 확보된다.

---

### [INFO] `R-5` Rationale ID — additive 충돌 없음, 번호 확인
- **target 신규 식별자**: draft A절 "Rationale R-5 (신규)" — `spec/5-system/16-system-status-api.md`에 R-5 추가
- **기존 사용처**: 동 파일 lines 86–96: R-1 ~ R-4 이미 존재, R-5 미사용
- **상세**: 충돌 없음. 순차 추가로 안전하다.
- **제안**: 없음.

---

### [INFO] `R-3` (UI spec) — 신규 추가 가능, 번호 확인
- **target 신규 식별자**: draft B절 "R-3 류로 최근 실패가 주 지표인 이유 한 줄 추가 또는 R-1 인근에 노트"
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/2-navigation/15-system-status.md` lines 65–69: R-1, R-2 만 존재, R-3 미사용
- **상세**: 충돌 없음. 순차 추가로 안전하다.
- **제안**: 없음.

---

### [INFO] `recentFailed` (DTO 필드 / 클래스 내부 프로퍼티) — 동음이의 존재, 의미 상이
- **target 신규 식별자**: `QueueStatusDto.recentFailed: number` — 큐의 최근 윈도우 내 실패 job 수
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/workflow-assistant/tools/shadow-workflow.ts` lines 326, 645, 649, 809–820: `private readonly recentFailedAddNodeLabels: string[]` — Workflow AI Assistant 의 ShadowWorkflow 클래스 내 add_node 실패 노드 라벨 rolling window. 전체 식별자는 `recentFailedAddNodeLabels` 이므로 prefix만 공유
- **상세**: `recentFailed` 와 `recentFailedAddNodeLabels` 는 서로 다른 모듈·클래스 스코프이고, 전자는 DTO 필드, 후자는 클래스 private 프로퍼티다. 네임스페이스 충돌은 없다. 다만 "recentFailed" 라는 단어가 두 도메인(큐 실패 카운트 vs AI 어시스턴트 노드 라벨)에 공통으로 등장하므로 코드 검색 시 노이즈가 생길 수 있다.
- **제안**: 실용적 충돌은 없으나, 스코프가 명확히 분리되어 있으므로 이름 변경 필요 없음. 코드 구현 시 DTO 레이어와 ShadowWorkflow 레이어의 검색 노이즈를 의식하는 정도로 충분하다.

---

### [INFO] `totalRecentFailed` — 신규 DTO 필드, 기존 사용처 없음
- **target 신규 식별자**: `SystemStatusOverviewDto.totalRecentFailed: number`
- **기존 사용처**: spec, codebase 전체에서 미발견
- **상세**: 충돌 없음.
- **제안**: 없음.

---

### [INFO] `failedWindowMinutes` — 신규 DTO 필드, 기존 사용처 없음
- **target 신규 식별자**: `SystemStatusOverviewDto.failedWindowMinutes: number`
- **기존 사용처**: spec, codebase 전체에서 미발견
- **상세**: 충돌 없음.
- **제안**: 없음.

---

### [INFO] `SYSTEM_STATUS_FAILED_WINDOW_MINUTES` — 신규 ENV var, 기존 사용처 없음
- **target 신규 식별자**: env `SYSTEM_STATUS_FAILED_WINDOW_MINUTES` (기본 60)
- **기존 사용처**: `.env.example` 및 codebase 전체에서 미발견
- **상세**: 충돌 없음. 기존 `SYSTEM_STATUS_FAILED_THRESHOLD` / `SYSTEM_STATUS_DELAYED_THRESHOLD` 네임스페이스와 일관된 `SYSTEM_STATUS_` prefix 사용.
- **제안**: 없음.

---

### [INFO] `SYSTEM_STATUS_FAILED_SCAN_CAP` — 신규 ENV var, 기존 사용처 없음
- **target 신규 식별자**: env `SYSTEM_STATUS_FAILED_SCAN_CAP` (기본 1000)
- **기존 사용처**: `.env.example` 및 codebase 전체에서 미발견
- **상세**: 충돌 없음. prefix 컨벤션 일관.
- **제안**: 없음.

---

## 요약

target draft 가 도입하는 신규 식별자(`totalRecentFailed`, `failedWindowMinutes`, `recentFailed`, `SYSTEM_STATUS_FAILED_WINDOW_MINUTES`, `SYSTEM_STATUS_FAILED_SCAN_CAP`)는 모두 기존 사용처와 충돌하지 않는다. 유일한 주목할 사항은, draft 가 기존 spec 에서 이어받은 표기 혼용이다 — spec 본문의 pseudo-code 토큰 `FAILED_DEGRADED_THRESHOLD` 와 실제 환경변수명 `SYSTEM_STATUS_FAILED_THRESHOLD` 가 다른 이름을 사용하고 있으며 draft 가 이를 병용한다. 이는 신규 충돌이 아니라 기존의 표기 불일치가 새 규칙 추가로 노출되는 것이므로, spec 갱신 시점에 함께 정정하면 독자 혼동을 방지할 수 있다. `recentFailed` prefix 는 `shadow-workflow.ts` 의 `recentFailedAddNodeLabels` 와 단어를 공유하나 스코프·타입이 완전히 달라 실질적 충돌은 없다.

---

## 위험도

LOW
