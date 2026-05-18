# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/2fa-webauthn.md`  
검토 모드: spec draft 검토 (--spec)  
worktree: `2fa-webauthn-impl`  
검토 일시: 2026-05-18

---

### 발견사항

- **[WARNING]** `spec/1-data-model.md` 동시 수정 — `spec-overview-followups-2026-05-18.md` §1 과 worktree 경합
  - target 위치: `2fa-webauthn.md` §3 작업 단위 / §2 spec 갱신 목록 (`spec/1-data-model.md §2.1`, `§2.18.2`, `§2.21`)
  - 관련 plan: `plan/in-progress/spec-overview-followups-2026-05-18.md` §1 — `spec/1-data-model.md §2.6` Node.type enum 에 `filter` 추가 작업 (worktree: TBD, per-item)
  - 상세: 2fa-webauthn.md 는 `spec/1-data-model.md` 의 §2.1 User, §2.18.2 LoginHistory, §2.21 WebAuthnCredential(신규), §3 인덱스 표를 수정한다. spec-overview-followups-2026-05-18.md §1 은 동일 파일의 §2.6 Node.type enum 을 수정한다. 영역이 다른 섹션이나 같은 파일에 대한 동시 편집이므로 rebase/merge 충돌 위험이 있다. 또한 2fa-webauthn.md 의 §2 체크리스트는 `[x]` 로 완료 표기되어 있으나, spec-overview-followups-2026-05-18.md §1 의 작업 착수 여부를 고려해 rebase 순서를 조율해야 한다. (이 리스크는 target plan 의 §의존성·리스크 마지막 행에 `spec-overview-followups-2026-05-18.md` 와 동시 수정 위험으로 이미 명시되어 있으나 구체적 조율 메커니즘이 기재되지 않았다.)
  - 제안: target plan 의 §의존성·리스크 항목을 "본 plan 의 spec/1-data-model.md 변경 (§2.1 / §2.18.2 / §2.21 / §3 인덱스) 이 merge 되기 전에 spec-overview-followups-2026-05-18.md §1 이 동일 파일을 편집 중이면 직렬화 필요. 두 작업 중 먼저 merge 된 쪽에서 rebase 를 제공" 으로 구체화 권장.

- **[WARNING]** 마이그레이션 번호 V057 / V058 점유 확인 — `replay-rerun.md` PR2 와의 잠재 경합
  - target 위치: `2fa-webauthn.md` §3 — "착수 직전 max(V) 재확인 필수" 경고 + `V057__webauthn_credentials_and_recovery.sql` / `V058__login_history_webauthn_failed_event.sql`
  - 관련 plan: `plan/in-progress/replay-rerun.md` §3 — `V###` 마이그레이션 (번호 미확정으로 기재됨, `re_run_of` 컬럼 + `chain_id` + 인덱스 2개)
  - 상세: replay-rerun.md PR2 는 아직 착수 전이고 마이그레이션 번호가 `V###` 으로 비어있다. 만약 PR2 가 2fa-webauthn impl 과 거의 동시에 진행될 경우 V057 이 양쪽에서 경합될 수 있다. target plan 이 "착수 직전 max(V) 재확인" 경고를 이미 두고 있으나, replay-rerun PR2 의 착수 시점에도 동일 확인이 필요하다.
  - 제안: replay-rerun.md §3 의 마이그레이션 항목에 "착수 직전 max(V) 재확인 필수 (2fa-webauthn impl 이 V057~V058 예약 중)" 주석을 추가하거나, 두 plan 의 의존성·리스크 절 양쪽에 상호 참조를 명시. 실제 착수 시 `ls codebase/backend/migrations | grep -E '^V[0-9]+__' | sort -V | tail -1` 으로 확인.

- **[WARNING]** `consistency-check --impl-prep` 미완료 상태에서 구현 체크리스트 병렬 진행 위험
  - target 위치: `2fa-webauthn.md` §7 REVIEW — `consistency-check --impl-prep` 항목이 `[ ]` (미완료)
  - 관련 plan: CLAUDE.md 의 skill 정책 — "developer 는 구현 착수 직전에 `consistency-checker --impl-prep` 를 의무 호출한다"
  - 상세: target plan 의 §3~§6 구현 단계 항목들은 모두 `[ ]` 미완료이다. 그러나 §7 의 `consistency-check --impl-prep` 도 `[ ]` 상태이다. --impl-prep 는 구현 착수 직전 의무 호출이므로 §3~§6 착수 전에 먼저 실행해 BLOCK 이 없는지 확인해야 한다. 본 checker 가 --spec 모드로 호출된 현재 시점은 spec 갱신 완료(§2 [x]) 직후로, --impl-prep 는 아직 실행 전이다. plan 의 §7 순서가 §3 이전에 위치하지 않아 개발자가 순서를 놓칠 가능성이 있다.
  - 제안: target plan 의 §3 첫 항목 바로 앞에 "**전제: §7 의 `consistency-check --impl-prep` 통과 후 이 단계에 진입**" 안내 추가. 또는 §7 을 §2 와 §3 사이로 재배치.

- **[INFO]** `harness-i18n-userguide-gap.md` 의 i18n 갱신 하네스 — 2fa-webauthn 의 i18n 작업 (§5) 이 parity 테스트를 충족하는지 확인 권장
  - target 위치: `2fa-webauthn.md` §5 프론트엔드 구현 — "i18n (ko/en) — `profile.security.webauthn.*`, `auth.twoFactor.webauthn.*`, `auth.login.webauthn.*`. i18n key 추가 시 ko↔en parity 테스트 통과 확인 (`npm test -- i18n`)"
  - 관련 plan: `plan/in-progress/harness-i18n-userguide-gap.md` P0 완료 (ko↔en dict parity 단위 테스트 + SECTION_LABELS coverage 테스트 도입됨)
  - 상세: harness-i18n-userguide-gap 의 P0 (dict parity 테스트, locale.test.ts 확장) 가 이미 완료됐다고 표기되어 있으므로, 2fa-webauthn 의 i18n 키 추가 시 parity 테스트가 자동 게이트 역할을 한다. target plan 이 `npm test -- i18n` 확인을 이미 명시하고 있어 하네스와 정합한다. 단, §6 매뉴얼 (보안 가이드 문서) 의 경우 신규 문서 섹션 생성 시 SECTION_LABELS_BY_LOCALE 등록이 필요한지 확인이 빠져 있다 (해당 문서 위치가 기존 섹션 `07-workspace-and-team/` 하위이면 등록 불요, 신규 섹션 디렉토리 생성 시에는 등록 필요).
  - 제안: target plan §6 에 "기존 `07-workspace-and-team/` 섹션 하위에 파일 추가 시 SECTION_LABELS_BY_LOCALE 재등록 불요. 신규 섹션 디렉토리 생성 시에는 locale.test.ts coverage 테스트를 통과할 것" 주석 추가.

- **[INFO]** `ai-agent-tool-connection-rewrite.md` 의 미해결 결정이 2fa-webauthn 과 직접 충돌하지는 않으나 동일 worktree 기간 중 `spec/5-system/1-auth.md` 이 영향 받지 않는지 확인 권장
  - target 위치: `2fa-webauthn.md` §2 — `spec/5-system/1-auth.md` 대규모 갱신
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` — worktree 미할당, 결정 사항 TBD
  - 상세: ai-agent-tool-connection-rewrite.md 의 spec 작업은 `spec/4-nodes/3-ai/1-ai-agent.md` 와 `spec/3-workflow-editor/0-canvas.md` 를 주로 건드리며 `spec/5-system/1-auth.md` 와 직접 겹치지는 않는다. 그러나 해당 plan 이 conversation-thread worktree (`conversation-thread-e509c5`) 의 merge 를 선행 조건으로 두고 있고 현재 worktree 미할당 상태이므로, 본 plan 기간 중 갑작스럽게 착수될 경우 worktree frontmatter 확인이 빠질 수 있다. 현재 직접 충돌 가능성은 낮음.
  - 제안: 특별한 조치 불필요. 다만 ai-agent-tool-connection-rewrite.md 착수 시 worktree frontmatter 기재 규약 준수 확인.

---

### 요약

`plan/in-progress/2fa-webauthn.md` 는 전반적으로 CLAUDE.md 의 SDD/TDD 원칙과 plan 라이프사이클 규약을 잘 따르고 있다. spec 갱신 단계(§2) 를 구현 단계(§3~§6) 보다 먼저 배치하고, consistency-check --spec 완료를 전제로 한 점도 정합하다. 주요 리스크는 두 가지다. 첫째, `spec/1-data-model.md` 를 `spec-overview-followups-2026-05-18.md` §1 과 동시에 편집하는 상황에서 rebase 직렬화 메커니즘이 plan 에 구체적으로 기술되지 않았다 (target plan 자체가 이 위험을 인지하고 있으나 조율 방법이 빠져 있음). 둘째, `replay-rerun.md` PR2 의 마이그레이션 번호가 미확정인 상태에서 V057~V058 이 2fa-webauthn 에 예약되어 있으므로, replay-rerun PR2 착수 시 번호 선점 여부를 양쪽 plan 이 명시적으로 확인해야 한다. `consistency-check --impl-prep` 의 선행 실행 순서도 plan 구조 내에서 더 명확하게 안내되면 좋다. 미해결 결정과의 충돌이나 worktree 직접 경합(동일 파일 동시 커밋)은 현재 시점에서 확인되지 않는다.

---

### 위험도

MEDIUM
