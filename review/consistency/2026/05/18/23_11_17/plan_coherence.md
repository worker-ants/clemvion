### 발견사항

- **[WARNING]** `spec/1-data-model.md` 동시 수정 — 2fa-webauthn 미완 ERD 항목과 spec-overview-followups §1 충돌 위험
  - target 위치: `plan/in-progress/2fa-webauthn.md` §2 spec 갱신 체크박스 — `[ ] spec/1-data-model.md §1 ERD 다이어그램 — WebAuthnCredential (User 1:N) 관계 반영`
  - 관련 plan: `plan/in-progress/spec-overview-followups-2026-05-18.md` §1 — `spec/1-data-model.md §2.6` Node.type enum 에 `filter` 추가 (별도 worktree `spec-data-model-filter-<slug>` 예정)
  - 상세: `2fa-webauthn-impl` worktree 는 `spec/1-data-model.md` 의 §2.1·§2.18.2·§2.21(신설)·§3 를 이미 수정해 브랜치에 커밋했다. §2.21 신설로 기존 AssistantMessage 번호가 §2.21→§2.22 로 시프트됐다. 한편 `spec-overview-followups-2026-05-18.md` §1 은 동일 파일의 §2.6 Node.type enum 을 별도 worktree 에서 수정 예정이며, ERD 다이어그램(§1) 항목도 미완(`[ ]`)이므로 이 체크박스를 처리할 때 다시 동일 파일을 건드리게 된다. 수정 섹션이 다르므로 자동 merge 가 가능할 수 있으나 번호 시프트(§2.21→§2.22) 이후 머지 순서가 맞지 않으면 섹션 번호 참조 링크가 깨질 수 있다.
  - 제안: (1) `2fa-webauthn-impl` PR 의 ERD 항목을 별도 follow-up 으로 분리하거나 본 PR 에 포함시켜 `spec/1-data-model.md` 수정을 한 번에 끝낸다. (2) `spec-overview-followups-2026-05-18.md` §1 작업 착수 전 `2fa-webauthn-impl` PR 이 main 에 머지되었는지 확인하고, 머지 후 최신 main 에서 rebase 한다. `2fa-webauthn.md` 의 `## 의존성·리스크` 절에 이 순서 제약을 명기한다.

- **[WARNING]** `replay-rerun.md` 마이그레이션 번호 미확정 — V057·V058 선점 충돌 가능
  - target 위치: `plan/in-progress/2fa-webauthn.md` §3 데이터 모델/마이그레이션 — `V057__webauthn_credentials_and_recovery.sql`, `V058__login_history_webauthn_failed_event.sql`
  - 관련 plan: `plan/in-progress/replay-rerun.md` §3 백엔드 구현 — `V### 마이그레이션` (번호 미정)
  - 상세: 현재 최신 마이그레이션은 V056. `2fa-webauthn.md` 는 V057·V058 두 파일을 점유할 예정임을 plan 에 명시했다. `replay-rerun.md` 는 PR2(구현) 단계에서 마이그레이션이 필요하며 번호가 `V###` 로 미확정이다. `2fa-webauthn-impl` PR 이 먼저 머지되면 V057·V058 이 소비되어 `replay-rerun` 의 PR2 는 V059 이상을 써야 하지만, plan 에 이 사실이 미반영되어 있어 개발자가 착수 시점에 번호를 충분히 인지하지 못할 수 있다.
  - 제안: `replay-rerun.md` §3 의 `V###` 주석에 "2fa-webauthn PR 머지 후 착수 시 V059 이상 사용 — V057·V058 은 WebAuthn 에 할당됨" 을 명기한다. `2fa-webauthn.md` 의 `## 의존성·리스크` 에도 "V057·V058 이 선점됨을 replay-rerun plan 에 고지 필요" 한 줄을 추가한다.

- **[INFO]** `spec/1-data-model.md` ERD 다이어그램 항목이 spec 갱신 단계에서 미완으로 남아 있음
  - target 위치: `plan/in-progress/2fa-webauthn.md` §2 — `[ ] spec/1-data-model.md §1 ERD 다이어그램 — WebAuthnCredential (User 1:N) 관계 반영`
  - 관련 plan: 없음 (단독 항목)
  - 상세: `consistency-check --impl-prep` 실행 조건(§7 두 번째 항목)은 spec 갱신(§2) 완료를 전제로 한다. 그러나 ERD 다이어그램 항목이 `[ ]` 로 미완이므로, 현재 시점에서 impl-prep 를 통과시키려면 이 항목의 처리가 선행되어야 한다.
  - 제안: ERD 항목을 본 PR 에 포함시켜 `[x]` 로 완료하거나, follow-up PR 로 명시적으로 분리해 `## Follow-up (§8)` 에 추가한다. 전자가 spec 일관성 측면에서 권장.

- **[INFO]** `ai-agent-tool-connection-rewrite.md` 의 미해결 설계 결정이 본 target 과 무관하게 확인됨
  - target 위치: n/a (본 target `codebase/backend/src/modules/auth` 와 무관)
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 — 도구 등록 모델 TBD, 도구 시그니처 위치 TBD, 도구 호출 실행 컨텍스트 TBD, 도구 결과 라우팅 TBD
  - 상세: auth 모듈 구현과 직접 충돌하지 않으나, 해당 plan 의 frontmatter 에 `worktree` 필드가 없어 활성 worktree 를 특정하기 어렵다. 본 검토 범위(`codebase/backend/src/modules/auth`) 와 겹치지 않으므로 INFO 등급.
  - 제안: `ai-agent-tool-connection-rewrite.md` frontmatter 에 `worktree: TBD` 를 추가해 plan 인덱스와 일관성 유지.

---

### 요약

`codebase/backend/src/modules/auth` 를 대상으로 하는 `2fa-webauthn.md` 구현 착수 준비 검토 결과, 다른 plan 과의 직접적인 worktree 경합(동일 코드 파일 동시 수정)은 발견되지 않았다. 활성 worktree 5개 중 auth 모듈을 건드리는 것은 없으며 `2fa-webauthn-impl` 이 유일하다. 단, `spec/1-data-model.md` 에 대해 두 가지 주의가 필요하다. 첫째, 본 plan 의 ERD 다이어그램 항목(`[ ]`)이 미완이어서 spec 갱신이 완전히 끝나지 않은 상태이며, `spec-overview-followups-2026-05-18.md` 가 동일 파일의 다른 섹션을 별도 worktree 에서 수정 예정이므로 머지 순서를 맞추지 않으면 섹션 번호 링크가 깨질 수 있다. 둘째, `replay-rerun.md` 의 마이그레이션 번호가 미확정(`V###`)이어서 V057·V058 점유 사실이 해당 plan 에 반영되지 않은 상태다. 두 항목 모두 plan 문서 갱신으로 해소 가능한 WARNING 수준이며, 구현 차단 사유는 아니다.

### 위험도

LOW
