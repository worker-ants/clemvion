# Plan 정합성 검토 결과

## 검토 대상

- **target**: `plan/in-progress/spec-draft-web-chat-console.md` (webchat-console-95fe1e 워크트리)
- **관련 plan**: `channel-web-chat-followups.md`, `channel-web-chat-impl.md`, `webchat-eager-start.md`

---

## 발견사항

### [WARNING] `0-architecture.md §2.1·§R8` — same-origin 미리보기 카브아웃 미반영

- **target 위치**: §1.5 (co-deploy + same-origin 미리보기 결정), §2.5 (EDIT `0-architecture.md §4` env 등재)
- **관련 plan**: 직접 plan 항목이 아닌, 현재 spec `spec/7-channel-web-chat/0-architecture.md §2.1·§R8` 와의 충돌
- **상세**:
  - `0-architecture.md §2.1` 은 "iframe 은 **반드시 다른 origin 의 실제 src 여야 한다**(§R8)"로 명시한다.
  - `0-architecture.md §R8` 는 "loader 가 iframe 생성 + 문서는 정적 **cross-origin CDN 자산**" 으로 격리를 만족한다고 서술한다.
  - target §1.5 의 co-deploy 결정은 **admin console 미리보기에 한해** same-origin 동봉 위젯을 sandbox iframe 으로 로드하는 것인데, target §2.5 의 `0-architecture.md` 변경 범위가 §4(env 등재·버전 전략)뿐이고 **§2.1·§R8 에 "admin preview = same-origin 예외" 주석·cross-reference 가 포함되지 않는다**.
  - target §1.5 본문에는 R8 정합 설명이 있으나, 이 설명은 신설되는 `5-admin-console.md` 에만 들어간다. `0-architecture.md §R8`/`§2.1` 을 읽는 독자는 same-origin admin preview 가 이 규칙의 예외임을 알 수 없다.
- **제안**: target §2.5 에 `0-architecture.md §2.1` 또는 `§R8` Rationale 에 "admin console 미리보기는 same-origin 동봉 위젯을 sandbox iframe 으로 로드하는 별개 컨텍스트 — 고객 사이트 임베드(cross-origin 격리 필수)와 목적이 다름. 상세 5-admin-console §R" 한 줄 cross-reference 를 추가하도록 변경 범위를 명시하거나, 아니면 `5-admin-console.md` Rationale 에 `0-architecture.md §R8` 와의 관계를 명확히 역참조하도록 draft 를 보강해야 한다.

---

### [WARNING] `spec/0-overview.md §8` 업데이트 — target §2 변경 목록에 누락

- **target 위치**: §2 "반영할 spec 변경" 목록 (§2.1~§2.6)
- **관련 plan**: `plan/in-progress/web-chat-console.md` Phase 0 체크리스트
- **상세**:
  - `web-chat-console.md` Phase 0 체크리스트에는 "EDIT `spec/0-overview.md §8` 문서 맵에 `5-admin-console.md` 등록" 항목이 명시돼 있다.
  - 그러나 target (`spec-draft-web-chat-console.md`) §2 의 "반영할 spec 변경" 목록에는 `0-overview.md` 업데이트가 없다.
  - 이 불일치는 spec write 단계에서 `0-overview.md` 변경이 누락될 위험을 만든다.
- **제안**: target §2 에 `spec/0-overview.md §8` 문서 맵 추가 항목을 §2.6 (변경 없음 확인 목록) 또는 별도 §2.7 로 추가해 `web-chat-console.md` 의 Phase 0 체크리스트와 일치시킨다.

---

### [INFO] `spec/7-channel-web-chat/2-sdk.md §2` — "미배선(계획)" 문구 유효성 주석 부재

- **target 위치**: §1.4 ("EIA 대화 배선은 이미 완료 (M1 경로)" 정정 설명)
- **관련 plan**: `channel-web-chat-followups.md` (M2 BYO-UI `unwrapEnvelope`/`ExecutionStatus` ↔ `@workflow/sdk` 통합 보류)
- **상세**:
  - target 은 `2-sdk.md §2` 의 "현 increment 미배선 (계획)" 이 **M2 headless 경로 한정**이며 M1 hosted iframe 과 무관함을 올바르게 설명한다.
  - 그러나 `2-sdk.md §2` 본문은 그 구분이 없어 독자가 M1 도 미배선으로 오해할 수 있다.
  - target 이 제안하는 spec 변경(§2.1~§2.6)에 `2-sdk.md` 보정이 포함되지 않는다.
- **제안**: target 에서 "변경 없음 확인" 으로 처리하고 있으나, `2-sdk.md §2` 에 "(M1 widget SPA 는 자체 eia-client.ts 로 완료 — channel-web-chat-impl.md [x]; 본 미배선은 M2 @workflow/sdk import 한정)" 한 줄 주석을 추가하는 것을 고려할 수 있다. 단, 이미 `channel-web-chat-followups.md` 가 M2 상태를 추적 중이므로 차단 이슈는 아니다.

---

### [INFO] `web-chat-console.md` 의 `pending_plans` 가드 선행 요건 — 이미 충족

- **target 위치**: §2.1 frontmatter (`pending_plans: - plan/in-progress/web-chat-console.md`), §3 순서 주의 노트
- **관련 plan**: `plan/in-progress/web-chat-console.md` (worktree 내 존재 확인됨)
- **상세**: target §3 은 "spec write 전에 plan 파일을 먼저 생성해야 spec-pending-plan-existence 가드에 걸리지 않는다" 고 명시하고, `web-chat-console.md` 가 worktree 에 이미 존재한다(Phase 0 체크리스트 체크됨). 충돌 없음 — 올바른 선행 충족.

---

## 요약

target 은 미해결 결정을 우회하거나 관련 plan 과 직접 충돌하는 항목이 없다. 두 가지 WARNING 이 있다: (1) co-deploy same-origin 미리보기 결정이 `0-architecture.md §2.1·§R8` 에 carve-out cross-reference 없이 §4 만 갱신되는 범위 누락 — spec 작성 후 `0-architecture.md §R8` 가 admin preview same-origin 을 암묵적으로 부정하는 apparent 모순이 생길 수 있다. (2) `spec/0-overview.md §8` 문서 맵 업데이트가 target §2 변경 목록에서 누락됐으나 `web-chat-console.md` Phase 0 에는 포함돼 있어 spec write 시 빠질 위험이 있다. 두 항목 모두 구현 착수를 차단하는 CRITICAL 수준은 아니지만, spec write 단계에서 해소하는 것이 권장된다.

## 위험도

LOW
