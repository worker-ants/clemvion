### 발견사항

- **[WARNING]** `spec/1-data-model.md` 동시 수정 — worktree 경합 가능성
  - target 위치: `plan/in-progress/2fa-webauthn.md` §2 (spec 갱신 단계, `[x]` 완료 표시) 및 §의존성·리스크 마지막 항목
  - 관련 plan: `plan/in-progress/spec-overview-followups-2026-05-18.md` (worktree 미명시 — prompt payload에 해당 plan의 frontmatter가 포함되지 않아 worktree 필드 확인 불가)
  - 상세: target은 `spec/1-data-model.md`의 §2.1 User, §2.18.2 LoginHistory, §2.21 WebAuthnCredential, §3 인덱스 표를 이미 수정(`[x]`)했으며 §1 ERD 다이어그램은 미완(`[ ]`). target 자체 §의존성 항목에 "spec-overview-followups-2026-05-18.md 와 동시 수정 → 후자 plan 작업 시 본 plan merge 여부 확인 후 rebase 필요"라고 명시했으나, spec-overview plan의 frontmatter에 worktree 필드가 있는지, 해당 worktree가 현재 같은 파일을 열어두고 있는지 prompt payload에서 확인되지 않는다. 두 plan이 서로 다른 worktree에서 동일 파일을 수정한 상태로 모두 in-progress이면 merge 시 충돌 위험이 있다.
  - 제안: `plan/in-progress/spec-overview-followups-2026-05-18.md`의 frontmatter `worktree` 필드를 확인하고, 해당 plan의 `spec/1-data-model.md` 수정 범위가 target과 겹치는지 명시적으로 기록한다. target의 §의존성 항목에 이미 인지가 있으므로, 추가 조치는 spec-overview plan 측에서 "2fa-webauthn merge 대기" 상태를 frontmatter 또는 본문에 명시하는 것으로 충분하다.

- **[WARNING]** Migration 번호 V057/V058 점유 — `replay-rerun.md`와의 직렬화 미확인
  - target 위치: `plan/in-progress/2fa-webauthn.md` §3 착수 조건 항목 및 §의존성
  - 관련 plan: `plan/in-progress/replay-rerun.md` (prompt payload에 세부 내용 미포함 — migration 번호 사용 여부 불명)
  - 상세: target §3는 V057, V058 두 개의 마이그레이션 번호를 지정했다. target §3 착수 조건에 "다른 worktree (`replay-rerun.md` 등) 가 동일 번호를 점유했으면 다음 정수로 시프트"라는 절차를 두었으나, replay-rerun plan이 현재 어떤 migration 번호를 사용 중인지 prompt payload에서 확인되지 않는다. `replay-rerun.md`의 worktree가 현재 V057 이상 번호를 선점한 상태라면 target의 §3 migration SQL 파일명과 plan 본문을 함께 갱신해야 한다.
  - 제안: `consistency-check --impl-prep` 실행 전에 `replay-rerun.md`의 현재 worktree 및 migration 번호 예약 상태를 직접 확인(ls 또는 python3 guards script)하여 plan §3 본문을 사전에 갱신한다. target이 이미 착수 조건에 이 절차를 명시하고 있으므로 구조적 누락은 아니지만, 현 시점 정합성이 미확인 상태임을 기록한다.

- **[INFO]** `spec/1-data-model.md §1 ERD 다이어그램` 항목 미완료로 §2 단계 완료 선언 불완전
  - target 위치: `plan/in-progress/2fa-webauthn.md` §2, 마지막 항목 `[ ] spec/1-data-model.md §1 ERD 다이어그램 — WebAuthnCredential (User 1:N) 관계 반영`
  - 관련 plan: 없음 (target 내부 사안)
  - 상세: §2의 나머지 항목은 모두 `[x]`이나 ERD 다이어그램 항목만 `[ ]`이다. §7 "consistency-check --impl-prep 실행 (구현 직전 의무)" 체크포인트가 이 항목의 완료 여부를 어떻게 처리하는지 명시되지 않았다. ERD 미반영 상태에서 구현을 착수하면 spec 완전성이 떨어진다.
  - 제안: §3 구현 착수 전에 ERD 항목을 완료하거나, 이 항목을 별도 follow-up으로 분리하고 §2 완료 판정 기준을 명시한다. 현재 구조에서는 `consistency-check --impl-prep`이 미완료 spec 항목을 BLOCK으로 판정할 수 있으므로 선제 완료를 권장한다.

- **[INFO]** `requiresTotp` deprecated 필드 제거 follow-up이 `0-unimplemented-overview.md` 인덱스에 미반영
  - target 위치: `plan/in-progress/2fa-webauthn.md` §8 Follow-up 첫 항목 ("requiresTotp deprecated 필드 제거 (두 마이너 버전 후)")
  - 관련 plan: `plan/in-progress/0-unimplemented-overview.md` (미구현 인덱스)
  - 상세: target §8의 follow-up 3건이 "별 PR" 예정이지만, 이 항목들이 미구현 인덱스(`0-unimplemented-overview.md`)에 등록되지 않았다. 특히 `requiresTotp` 제거는 API 계약 변경이라 나중에 별도 plan으로 추적해야 할 후속 작업임에도 현재 어떤 plan에도 반영되지 않았다.
  - 제안: 2fa-webauthn PR merge 시점에 §8 follow-up 3건을 새 plan(`plan/in-progress/2fa-webauthn-followups.md` 등)으로 등록하거나, `0-unimplemented-overview.md`의 적절한 섹션에 추적 항목으로 추가한다.

- **[INFO]** `harness-i18n-userguide-gap.md` P1 미진행 항목과의 연관 — WebAuthn i18n/user-guide 갱신이 신규 트리거 케이스
  - target 위치: `plan/in-progress/2fa-webauthn.md` §5 i18n 항목 + §6 매뉴얼 항목
  - 관련 plan: `plan/in-progress/harness-i18n-userguide-gap.md` P1 (convention-compliance-checker prompt 확장, documentation-reviewer 체크리스트 확장 — 미진행)
  - 상세: target §5에서 `profile.security.webauthn.*`, `auth.twoFactor.webauthn.*`, `auth.login.webauthn.*` i18n 키 추가와 ko↔en parity 테스트를 명시했고, §6에서 `content/docs/07-workspace-and-team/` 보안 가이드 갱신을 명시했다. 이는 harness plan의 "인증·권한 흐름 변경" 트리거 케이스에 정확히 해당한다. harness plan의 P0는 이미 완료됐으므로 parity 가드는 자동으로 작동하며, P1 미진행 항목(convention-compliance-checker 확장, documentation-reviewer 확장)이 없더라도 target 자체가 i18n/docs 갱신을 명시하고 있어 누락 가능성은 낮다. 충돌은 아니며 정합이나 추적 목적으로 기록한다.

### 요약

`plan/in-progress/2fa-webauthn.md` (worktree: `2fa-webauthn-impl`)는 전체적으로 plan 체계와 정합하게 작성됐다. 디자인 결정 단계(§1)가 완료 표시(`[x]`)로 명확하게 기록됐고, spec 갱신 → 구현 → 리뷰의 SDD 순서를 따른다. 주요 우려 사항은 두 가지다. 첫째, `spec/1-data-model.md`를 `spec-overview-followups-2026-05-18.md`와 동시에 수정 중일 가능성이 있으며 해당 plan의 frontmatter가 확인되지 않아 경합 상태가 불명확하다. 둘째, migration 번호 V057/V058이 `replay-rerun.md`와 충돌하지 않는다는 보장이 현 시점에서 없으나 target이 착수 조건에 재확인 절차를 명시하고 있어 구조적 누락은 아니다. ERD 다이어그램 미완(`[ ]`)은 구현 착수 전 해소가 필요한 소규모 항목이고, follow-up 3건의 인덱스 미반영은 PR merge 시 정리가 필요하다. 전체적으로 MEDIUM 위험 수준이나, 두 WARNING 항목을 착수 전 명시적으로 확인하면 충돌 없이 진행 가능하다.

### 위험도

MEDIUM
