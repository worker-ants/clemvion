# Cross-Spec 일관성 검토 결과

검토 대상: G-01/G-02 audit (rebase onto #542 후 재검) — `execution.re_run` 개명 + `AUDIT_ACTIONS` union 강제 + spec §4.1 구현됨/Planned 반영

---

## 발견사항

### 발견사항 1

- **[WARNING]** `spec/2-navigation/4-integration.md §14.3` 감사 로그 액션 목록에서 `integration.updated` 누락
  - target 위치: 구현 diff — `integrations.service.ts` 에서 `AUDIT_ACTIONS.INTEGRATION_UPDATED` 를 emit
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/spec/2-navigation/4-integration.md §14.3`
  - 상세: `§14.3` 은 Integration 감사 로그 액션을 "integration.created, integration.deleted, integration.rotated, integration.reauthorized, integration.scope_changed" 5종으로 열거하지만, 구현은 `integration.updated` 를 포함한 6종을 emit 한다. 반면 canonical SoT 인 `spec/5-system/1-auth.md §4.1` 과 `spec/data-flow/1-audit.md §1.1` 은 모두 `integration.updated` 를 포함해 구현과 일치한다. 즉 `§14.3` 이 SoT 와 어긋나는 부분적 목록이 된 상태다.
  - 제안: `spec/2-navigation/4-integration.md §14.3` 에 `integration.updated` 를 추가해 SoT(`spec/5-system/1-auth.md §4.1`) 와 동기화한다.

### 발견사항 2

- **[WARNING]** `spec/data-flow/5-integration.md` 감사 cross-ref 가 `integration.updated` 를 누락
  - target 위치: 구현 diff — `integrations.service.ts` 에서 `AUDIT_ACTIONS.INTEGRATION_UPDATED` emit
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/spec/data-flow/5-integration.md` 행 406 (`integration.created/updated/deleted/rotated/reauthorized` 를 나열)
  - 상세: `data-flow/5-integration.md` 의 Audit cross-ref 행은 `integration.created/updated/deleted/rotated/reauthorized` 로 `scope_changed` 가 빠진 목록이다. `integration.scope_changed` 도 구현되어 있고 `spec/5-system/1-auth.md §4.1` · `spec/data-flow/1-audit.md §1.1` 양쪽에 존재한다.
  - 제안: `spec/data-flow/5-integration.md §406 cross-ref` 를 `integration.created/updated/deleted/rotated/scope_changed/reauthorized` 전체 6종으로 갱신한다.

### 발견사항 3

- **[INFO]** `re_run_initiated` 레거시 명칭이 spec Rationale 내 역사적 언급으로만 잔존 — 충돌 없음
  - target 위치: 구현 diff — `executions.service.ts`, `executions-rerun.service.spec.ts` 에서 `re_run_initiated` → `execution.re_run` 전환 완료
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/spec/data-flow/1-audit.md` Rationale 절 (행 196–200)
  - 상세: `data-flow/1-audit.md` Rationale 절이 `re_run_initiated` 를 "과거 표기" 로 역사 기록하는 목적으로만 언급하며 현재 규약으로 사용하지 않는다. 본문(§1.1 표)은 `execution.re_run` 으로 통일돼 있다. 충돌이 아닌 의도된 역사 주석이므로 갱신 불필요.

### 발견사항 4

- **[INFO]** `spec/5-system/13-replay-rerun.md §11` 및 `spec/5-system/1-auth.md §4.1` 이 `execution.re_run` 을 구현 완료 액션으로 기록 — 구현과 일치
  - target 위치: 구현 diff — `executions.service.ts` 에서 `AUDIT_ACTIONS.EXECUTION_RE_RUN` emit
  - 충돌 대상: 없음
  - 상세: 두 spec 파일 모두 이미 `execution.re_run` 을 현재 구현 액션으로 열거하며, naming 규약(`<resource>.<verb>`)도 일치한다. 데이터 모델 충돌·API 계약 충돌·RBAC 충돌·상태 전이 충돌 없음.

---

## 요약

G-01(AUDIT_ACTIONS union 강제)/G-02(`execution.re_run` 개명) 변경은 canonical SoT 인 `spec/5-system/1-auth.md §4.1` 및 `spec/data-flow/1-audit.md §1.1` 과 완전 일치한다. 직접 모순(CRITICAL)은 없다. 다만 `spec/2-navigation/4-integration.md §14.3` 이 `integration.updated` 를 감사 로그 액션 목록에서 누락하고, `spec/data-flow/5-integration.md` cross-ref 가 `integration.scope_changed` 를 누락하는 두 건의 부분적 목록 불일치(WARNING)가 있다 — 어느 쪽도 구현 작동을 막는 모순이 아니지만 spec 내부 일관성을 위해 동기화를 권고한다.

---

## 위험도

LOW
