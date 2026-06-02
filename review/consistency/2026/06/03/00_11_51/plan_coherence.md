# Plan 정합성 검토 결과

검토 모드: spec draft (--spec)
Target: `plan/in-progress/system-status-page.md`

---

## 발견사항

### [WARNING] spec/data-flow/0-overview.md §4 큐 카탈로그와 QueueRegistry 단일 진실 SoT 중복 위험
- **target 위치**: spec A (`spec/5-system/16-system-status.md`) §1 "큐 레지스트리" — "레지스트리는 실제 worker 설정과 단일 진실을 공유하도록 큐 정의 상수를 재사용한다"
- **관련 plan**: `plan/in-progress/refactor-cron-to-bullmq.md` (Phase B 완료, `spec-draft-cron-to-bullmq.md` status: applied) — `spec/data-flow/0-overview.md §1.2` + `§4 BullMQ 큐 카탈로그` 를 코드 실제 12개 큐로 전수 동기화 완료. 현재 `data-flow/0-overview.md §4` 에 12개 큐 전체 열거 표가 이미 정착됨.
- **상세**: target spec A §1 은 `QueueRegistry` 라는 신규 중앙 레지스트리 개념을 도입하고 12개 큐·메타를 해당 spec 에 직접 표로 정의한다. 그러나 `spec/data-flow/0-overview.md §4` 가 이미 "큐가 늘어나면 본 표와 해당 도메인 spec 의 외부 의존 섹션 모두 갱신한다" 는 SoT 선언과 함께 동일한 12개 큐 카탈로그를 유지하고 있다. 두 곳에 12개 큐 테이블이 병존하면 이후 큐 추가/변경 시 한쪽 갱신 누락의 드리프트 위험이 발생한다.
- **제안**: spec A §1 에 `spec/data-flow/0-overview.md §4` 를 명시적으로 cross-reference 해야 한다. 선택지: (a) spec A §1 표를 "이 spec 의 큐 설명 목적 요약" 으로 표기하고 SoT 는 `data-flow/0-overview.md §4` + 코드 상수로 명시, 또는 (b) `QueueRegistry` 코드 상수 파일을 SoT 로 하고 `data-flow/0-overview.md §4` 에도 "QueueRegistry 상수 참조" 주석 추가. 미해결 결정 우회는 아니나, 단일 진실 원칙(CLAUDE.md) 위반 드리프트 위험이 있으므로 spec A 작성 시 해소 권장.

---

### [WARNING] spec/2-navigation/_product-overview.md §3 재번호로 marketplace-and-plugin-sdk.md 섹션 인용 stale 발생
- **target 위치**: spec D (`spec/2-navigation/_product-overview.md` 수정) — 기존 §3.9 Marketplace → §3.10, §3.10 User Guide → §3.11, §3.11 User Profile → §3.12 로 재번호.
- **관련 plan**: `plan/in-progress/marketplace-and-plugin-sdk.md` — "PRD 1 §3.9 NAV-MP-01~07 Marketplace" 를 섹션 번호로 추적 중.
- **상세**: target plan 본문이 "재번호로 인해 기존 ID(NAV-MP-*, NAV-UG-*)는 불변, 섹션 번호만 이동" 이라고 명시해 ID 안정성은 보장한다. 그러나 `marketplace-and-plugin-sdk.md` 내부에서 "PRD 1 §3.9" 형태의 섹션 번호 인용이 있어, spec D 적용 후 해당 인용이 §3.10 으로 밀리면 stale 해진다.
- **제안**: spec D 수정 완료 후 `plan/in-progress/marketplace-and-plugin-sdk.md` 내 "§3.9 Marketplace" 인용을 "§3.10 Marketplace (system-status-page plan 에 의해 재번호)" 로 갱신하거나 ID 기반 인용(`NAV-MP-*`)으로 교체. plan 갱신이 필요한 후속 항목.

---

### [WARNING] spec/2-navigation/_layout.md 메뉴 순서 10번 재사용 — frontend 구현 sync 항목 누락
- **target 위치**: spec C (`spec/2-navigation/_layout.md` §2.2) — 기존 10번 User Guide 를 11번으로 밀고 10번에 System Status 삽입.
- **관련 plan**: `plan/in-progress/channel-web-chat-followups.md` (worktree `channel-web-chat-followups-1feff2`) — `_layout.md` 를 직접 수정하는 체크박스 없음, 직접 충돌 없음.
- **상세**: spec C 는 순서 번호 표만 수정하지만, 실제 frontend 사이드바의 항목 순서는 코드(`codebase/frontend/src/`) 에 의존한다. target plan 의 작업 체크리스트에 "frontend 사이드바 순서 재정렬 (Statistics 다음에 System Status 삽입)" 항목이 명시되지 않으면 구현 단계에서 누락될 수 있다.
- **제안**: target plan 체크리스트의 "구현 (backend queue-monitor 모듈 + frontend 페이지 + 메뉴/i18n)" 항목 아래에 "사이드바 nav 순서 확인 (Statistics 다음 위치)" 를 명시적 sub-item 으로 추가 권장.

---

### [INFO] 0-unimplemented-overview.md 인덱스 갱신 후보
- **target 위치**: target plan 체크리스트 전체.
- **관련 plan**: `plan/in-progress/0-unimplemented-overview.md` — 미구현 항목 인덱스. System Status 는 이 인덱스에 없음(신규 spec).
- **상세**: 인덱스는 2026-05-30 기준 "부분 stale 경고" 상태라 전면 재동기화가 보류 중. 긴급하지 않으나 spec A+B 추가 후 인덱스에 반영되지 않으면 향후 갭 감사 시 누락될 수 있다.
- **제안**: 필수 아님. spec 반영 완료 후 인덱스 §A 표에 "Spec 5-system/16 + 2-navigation/15 System Status API/Page" 행 추가 고려.

---

### [INFO] spec/data-flow/0-overview.md §4 큐 카탈로그 — queue-monitor 모듈 외부 의존 섹션 추가 후보
- **target 위치**: spec A (`spec/5-system/16-system-status.md`) — `GET /queue-monitor/overview` API 신설.
- **관련 plan**: 없음.
- **상세**: `data-flow/0-overview.md §4` 주석이 "큐가 늘어나면 본 표와 해당 도메인 spec 의 외부 의존 섹션 모두 갱신" 을 요구한다. queue-monitor 모듈은 12개 큐 각각에 읽기 전용으로 접근하므로 "외부 의존" 의 정의에 따라 §4 또는 신규 spec 에 외부 의존 섹션이 필요할 수 있다.
- **제안**: 필수 아님. 구현 단계에서 `spec/5-system/16-system-status.md` 에 "외부 의존 — 12개 BullMQ 큐 (읽기 전용, getJobCounts + isPaused)" 섹션 추가 고려.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

- `channel-web-chat-spec-3b22b3` (branch `channel-web-chat-spec-3b22b3`) — Step 1: merge-base 판정 불가(local branch 없음), Step 2: PR #384 state=MERGED → **stale**. spec/2-navigation/ 파일과 동시 수정 후보였으나 stale 이므로 §5 충돌 대상에서 제외.

stale skip 1건. `.claude/worktrees/channel-web-chat-spec-3b22b3` 디렉토리가 남아 있으나 PR #384 MERGED 이므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

active worktree 분석 (`system-status-page-f96d24` 제외): spec/2-navigation/, spec/5-system/, spec/data-flow/ 를 동시에 수정하는 다른 active worktree 없음. worktree 충돌 후보 1건 중 stale 1건 skip, active 0건.

---

## 요약

target `system-status-page.md` spec draft(A~E) 는 미해결 결정을 일방적으로 우회하는 항목이 없고, active worktree 와 동일 spec 파일을 동시에 수정하는 CRITICAL 충돌도 없다. 주요 주의 사항은 (1) 신규 `QueueRegistry` 표가 이미 정착된 `spec/data-flow/0-overview.md §4` 큐 카탈로그와 SoT 중복을 만들 수 있어 cross-reference 명시가 필요하고 (2) `spec/2-navigation/_product-overview.md` 섹션 재번호로 `marketplace-and-plugin-sdk.md` 내 섹션 번호 인용이 stale 해지므로 plan 갱신이 필요하다. worktree 충돌 후보 1건(`channel-web-chat-spec-3b22b3`) 은 PR #384 MERGED 로 stale skip.

### 위험도
LOW
