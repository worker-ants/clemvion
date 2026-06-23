# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-draft-web-chat-console.md`
검토 모드: spec draft (--spec)
검토 기준일: 2026-06-23

---

## 발견사항

### 1. [WARNING] "선행 B — EIA 배선" 선행조건 서술이 현행 plan 상태와 불일치

- **target 위치**: `spec-draft-web-chat-console.md §1.4` "선행 B — EIA 배선": "위젯의 EIA 호출(webhook/SSE/REST) 배선이 **partial** — SDK 코어만 구현, `@workflow/sdk` 미import (`2-sdk.md §2`, `channel-web-chat-followups.md`). **대화형** 미리보기는 이 배선 완료가 전제."
- **관련 plan**: `plan/in-progress/channel-web-chat-followups.md` "종결 (parked, 2026-06-03)" 섹션, `plan/in-progress/channel-web-chat-impl.md` §작업 범위
- **상세**:
  - `channel-web-chat-impl.md`는 "EIA 클라이언트(webhook 시작→SSE→submit_*) + per_execution 세션 + 새로고침 복원" `[x]` 완료로 표기한다. 위젯의 핵심 EIA 통신(webhook trigger → SSE → submit_message)은 이미 구현된 상태다.
  - `channel-web-chat-followups.md`의 보류(⏸) 항목은 `@workflow/sdk` 통합(`unwrapEnvelope`/`ExecutionStatus`) — 이는 M2 BYO-UI headless client sdk 배선이며, M1 hosted iframe 위젯의 대화형 미리보기와는 다른 surface이다. followups 전체가 "사용자 결정(2026-06-03)으로 전부 보류 — 현 시점 필요성 낮음"으로 종결됐고 활성 TODO 0건이다.
  - target이 "선행 B — 대화형 미리보기 불가" 근거로 인용한 `channel-web-chat-followups.md`의 해당 항목은 실제 대화형 미리보기 차단 사유가 아니라, M2 headless client의 sdk 타입 재사용 정렬 보류다.
  - 따라서 "대화형 미리보기는 선행 B 완료가 전제"라는 서술은 현행 plan 상태로 볼 때 과도하게 강한 주장이다. 실제로는 선행 A(위젯 호스팅)만 충족되면 M1 hosted iframe 방식으로 대화형 미리보기가 가능할 수 있다.
- **제안**: target의 §1.4와 §3 Phase 2 서술을 재검토한다. "선행 B"가 대화형 미리보기의 필수 전제인지 확인하고, `channel-web-chat-impl.md`의 `[x]` EIA 클라이언트 완료 사실을 §1.4에 반영하거나, "선행 B" 정의를 더 정확히 서술해야 한다. 대화형 미리보기가 선행 A만으로 가능하다면 Phase 2를 prerequisite에서 제거하거나 옵션으로 격하한다.

---

### 2. [INFO] `plan/in-progress/web-chat-console.md` 미존재 — spec write 시 pending_plans 가드 차단 위험

- **target 위치**: `spec-draft-web-chat-console.md §3` "구현 plan 개요 (별도 파일 `plan/in-progress/web-chat-console.md`)", §2.1 `5-admin-console.md` 예정 frontmatter `pending_plans: - plan/in-progress/web-chat-console.md`
- **관련 plan**: `plan/in-progress/` 전체 목록 — `web-chat-console.md` 미존재 확인
- **상세**: target은 spec draft이므로 지금 당장 blocking은 아니다. 단, spec write 후 `5-admin-console.md`의 `pending_plans:`에 해당 파일을 등재하면, plan-lifecycle 규약의 `spec-pending-plan-existence` 가드가 `plan/in-progress/web-chat-console.md` 미존재를 지적하며 테스트를 실패시킬 수 있다.
- **제안**: spec write(`5-admin-console.md` 실제 파일 생성) 전에 `plan/in-progress/web-chat-console.md`를 먼저 생성하거나, spec write와 동시에 생성할 것을 plan에 Phase 0 체크박스로 명시한다. 이를 target §3 Phase 0에 추가하면 충분하다.

---

### 3. [INFO] `NEXT_PUBLIC_WIDGET_CDN_BASE` 신규 admin 프론트 env — 기존 아키텍처 플레이스홀더 표 추가 필요 여부

- **target 위치**: `spec-draft-web-chat-console.md §1.3` "`<widget-cdn-base>`: **신규 env `NEXT_PUBLIC_WIDGET_CDN_BASE`** (현재 프론트에 위젯 cdn-base 노출 경로 없음 → 신규 필요)."
- **관련 plan**: `plan/in-progress/channel-web-chat-impl.md` 진입 조건 CDN 확정 항목 / `spec/7-channel-web-chat/0-architecture.md §4` 플레이스홀더 표
- **상세**: `channel-web-chat-impl.md`는 `<widget-cdn-base>`가 "loader 빌드/배포 시 env 주입(빌드타임)"으로 확정됐다고 기록하며, `0-architecture §4`가 SoT이다. 이 결정은 loader/위젯 SPA 측 빌드타임 env를 가리킨다. target이 제안하는 `NEXT_PUBLIC_WIDGET_CDN_BASE`는 **admin 프론트엔드** 측 신규 env로, 기존 결정과 직교한다(스니펫 생성을 위해 admin 앱도 위젯 CDN base를 알아야 함). 충돌은 아니나, `0-architecture §4` 플레이스홀더 표에 admin 프론트엔드용 env 행이 추가 필요한지 검토가 필요하다.
- **제안**: 신규 `5-admin-console.md` §5 서술에 `NEXT_PUBLIC_WIDGET_CDN_BASE`가 admin 앱 전용 env임을 명시하고, `0-architecture §4` 표에 admin-frontend env 행 추가 여부를 §2.4(변경 없음) 확인 범위에 포함한다. 직접 충돌 없음.

---

## 요약

target `spec-draft-web-chat-console.md`는 전반적으로 기존 plan 결정(트리거 재사용, 외형 백엔드 미저장, CDN 플레이스홀더 방침, EIA client-consumer 원칙)과 정합한다. 가장 주의할 사항은 §1.4의 "선행 B — EIA 배선 미충족(partial)" 서술이다. `channel-web-chat-impl.md`는 EIA 클라이언트(webhook→SSE→submit) 완료로 기록하고, `channel-web-chat-followups.md`의 sdk 통합 보류는 M2 headless 전용 surface이며 전체가 "활성 TODO 0건"으로 종결됐다. 이 불일치가 수정되지 않으면 구현 plan의 Phase 2가 실제로 필요 없는 blocking prerequisite를 만들어 일정을 불필요하게 지연시킬 수 있다. 또한 spec write 시 `pending_plans:`에 등재될 `plan/in-progress/web-chat-console.md`가 미존재하므로, spec 실제 write 전 해당 파일 생성이 필요하다.

## 위험도

LOW
