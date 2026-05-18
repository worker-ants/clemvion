# Plan 정합성 Check — plan/in-progress/2fa-webauthn.md

검토 일시: 2026-05-18  
검토 대상: `plan/in-progress/2fa-webauthn.md` (worktree: `2fa-webauthn-impl`)  
모드: spec draft 검토 (--spec)

---

### 발견사항

- **[WARNING]** plan frontmatter 누락 — worktree 추적 불가
  - target 위치: `plan/in-progress/2fa-webauthn.md` 파일 최상단 (frontmatter 전무)
  - 관련 plan: CLAUDE.md §PLAN 문서 라이프사이클 "frontmatter 메타데이터" 규약
  - 상세: target plan 은 `worktree`, `started`, `owner` frontmatter 없이 시작한다. 실제 worktree 는 `2fa-webauthn-impl` 로 존재하고 prompt_file 도 그렇게 명시하지만, plan 문서 자체에 frontmatter 가 없어 `plan_coherence` checker 의 자동 worktree 충돌 검출이 작동하지 않는다. 다른 plan 이 동일 spec 파일을 건드릴 때 충돌 경고가 누락될 수 있다.
  - 제안: plan 문서 상단에 다음 frontmatter 를 추가한다.
    ```
    ---
    worktree: 2fa-webauthn-impl
    started: 2026-05-18
    owner: developer
    ---
    ```

- **[WARNING]** 마이그레이션 버전 번호 충돌 위험 — V057/V058 선점 필요
  - target 위치: `plan/in-progress/2fa-webauthn.md` §2 데이터 모델 / 마이그레이션 항목 — "마이그레이션 파일 `V057__webauthn_credentials_and_recovery.sql`" 및 "V058 로 갱신"
  - 관련 plan: `plan/in-progress/replay-rerun.md` §3 백엔드 구현 — "V### 마이그레이션" (번호 미확정)과 `plan/in-progress/spec-overview-followups-2026-05-18.md` §1 — "누락 시 migration 추가"
  - 상세: 현재 최신 migration 은 `V056__notification_active_partial_index.sql` 이다. `2fa-webauthn.md` 는 V057 과 V058 을 명시적으로 선점했으나, `replay-rerun.md` PR2 구현도 `re_run_of` / `chain_id` 컬럼 추가 migration 이 필요하고 번호가 "V###" 미확정 상태다. 두 plan 이 병렬로 진행되면 같은 번호를 다른 내용으로 생성하는 충돌이 발생할 수 있다. `spec-overview-followups-2026-05-18.md` §1 도 Node.type enum 변경 migration 을 추가할 수 있다.
  - 제안: 구현 착수 전 번호를 협의해 선점하거나, `replay-rerun.md` 에 "2fa-webauthn 보다 후순위로 V059 이후 사용" 메모를 추가한다. 번호는 PR merge 순서로 결정되어도 무방하지만 plan 에 명시해 두어야 충돌을 피할 수 있다.

- **[WARNING]** `spec/1-data-model.md` 동시 수정 잠재 충돌
  - target 위치: `plan/in-progress/2fa-webauthn.md` §5 spec/PRD 갱신 — "`spec/1-data-model.md` — `webauthn_credential` 테이블 + `user.webauthn_recovery_codes` 추가"
  - 관련 plan: `plan/in-progress/spec-overview-followups-2026-05-18.md` §1 — "`spec/1-data-model.md §2.6` Node.type 전체 목록 확인 + filter 행 추가" (worktree: TBD per-item)
  - 상세: `spec-overview-followups-2026-05-18.md` §1 도 `spec/1-data-model.md` 를 수정 예정이다. 두 worktree 가 같은 파일을 동시에 수정하면 merge conflict 가 발생할 수 있다. 현재 `spec-overview-followups` 의 worktree 는 TBD 로 미확정이나, 곧 생성될 수 있다.
  - 제안: 두 plan 중 하나가 먼저 merge 되면 나머지가 rebase 후 진행하는 방식으로 직렬화한다. 두 plan 에 각각 "진행 전 상대 plan 의 merge 여부를 확인할 것" 메모를 추가하는 것을 권장한다.

- **[INFO]** `login-form.tsx` + `spec/5-system/1-auth.md` 의 `requiresTotp` → `requires2fa` API 응답 변경의 후속 항목 미명시
  - target 위치: `plan/in-progress/2fa-webauthn.md` §3 백엔드 구현 — "기존 `/auth/login` 응답을 확장: `{ requiresTotp }` 대신 `{ requires2fa: true, methods: ['webauthn'|'totp'], challengeToken }` 로 진화. 호환을 위해 `requiresTotp` 도 한동안 같이 내려준다"
  - 관련 plan: 다른 in-progress plan 에 `requiresTotp` 필드를 소비하는 코드 변경 계획은 명시되지 않았다.
  - 상세: `requiresTotp` 의 deprecated 시점 또는 제거 조건이 plan 에 명시되지 않았다. "한동안" 이라는 표현이 모호하므로, 언제 `requiresTotp` 를 제거할지 follow-up 항목을 plan 에 추가해 두는 것이 좋다. 또한 e2e / 단위 테스트가 `requiresTotp` 를 어서션하는 경우 이를 업데이트해야 할 후속 작업이 발생한다.
  - 제안: plan §3 또는 §7 REVIEW 아래에 "`requiresTotp` deprecated 제거 follow-up" 항목을 추가한다. 또는 spec §5 API 표에 deprecated 컬럼 제거 시점 기준을 명시한다.

- **[INFO]** `plan/in-progress/harness-i18n-userguide-gap.md` 의 P1 항목 — 인증·권한 흐름 변경 시 user-guide 갱신 트리거
  - target 위치: `plan/in-progress/2fa-webauthn.md` §6 매뉴얼 — "보안 가이드 신규 `security-2fa.md` 에 Passkey 등록/사용/복구 코드 추가"
  - 관련 plan: `plan/in-progress/harness-i18n-userguide-gap.md` §1-B 매핑표 — "인증·권한 흐름 변경" 시 `codebase/frontend/src/content/docs/07-workspace-and-team/` + e2e 갱신 필요
  - 상세: `harness-i18n-userguide-gap` 의 P0 는 이미 완료됐고 P1(convention-compliance-checker prompt 확장)은 미진행이다. `2fa-webauthn` 의 §6 매뉴얼 항목은 이 트리거 매핑에서 자연스럽게 도출되며 plan 에 이미 반영돼 있어 직접 충돌은 없다. 다만 i18n 키 (`profile.security.webauthn.*`, `auth.twoFactor.webauthn.*`) 추가 시 ko ↔ en dict parity 테스트 (P0 이미 도입)를 반드시 통과해야 하는 조건을 plan 에 명시하면 좋다.
  - 제안: plan §4 프론트엔드 구현 항목에 "i18n key 추가 시 ko↔en parity 테스트 통과 확인 (`npm test -- i18n`)" 주석 추가를 권장한다.

- **[INFO]** `replay-rerun.md` 의 `audit_log` enum 확장과 `2fa-webauthn.md` 의 `check_login_history_event` CHECK 제약 갱신(V058) 간 연동 불명확
  - target 위치: `plan/in-progress/2fa-webauthn.md` §3 — "AuditLog/LoginHistory 의 `event` enum 에 `webauthn_failed` 추가 — `check_login_history_event` CHECK 제약을 V058 로 갱신"
  - 관련 plan: `plan/in-progress/replay-rerun.md` §3 — "`audit_log` enum 확장 + `re_run_initiated` 이벤트 기록"
  - 상세: 두 plan 이 각각 `audit_log` 계열 enum 을 확장한다. 두 plan 이 같은 CHECK 제약 또는 같은 enum 타입을 수정하는지 여부는 현재 코드를 확인해야 알 수 있으나, plan 수준에서는 어느 plan 이 먼저 merge 되느냐에 따라 V058 번호가 충돌할 수 있다 (위 V057/V058 충돌 경고와 연계됨).
  - 제안: `replay-rerun.md` PR2 착수 전에 `2fa-webauthn` merge 여부를 확인하는 메모를 추가한다.

---

### 요약

`plan/in-progress/2fa-webauthn.md` 는 대체로 독립적인 작업 범위를 갖고 있으며, 다른 in-progress plan 과 직접적인 CRITICAL 수준 충돌은 없다. 주요 위험은 (1) plan frontmatter 누락으로 인한 worktree 자동 추적 불가, (2) V057/V058 마이그레이션 번호가 `replay-rerun.md` 및 `spec-overview-followups` 와 충돌할 수 있는 잠재적 경합, (3) `spec/1-data-model.md` 를 `spec-overview-followups` 와 동시 수정하는 병렬 worktree 경합이다. 모두 plan 에 메모를 추가하거나 작업 순서를 명시함으로써 해소 가능하며, 지금 당장 작업을 차단해야 하는 CRITICAL 항목은 없다.

---

### 위험도

LOW
