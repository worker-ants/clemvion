---
worktree: (unstarted)
started: 2026-06-03
owner: planner
---

# auth — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 유지하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/1-auth.md

## 미구현 항목
- [ ] §1.3 LDAP / Active Directory 연동 (셀프 호스팅 선택 기능) — 백엔드에 핸들러·passport strategy·의존성 부재
- [ ] §1.3 SAML 2.0 기업 SSO 연동 (셀프 호스팅 선택 기능) — 동일하게 미구현
- [x] **§4.1 감사 로깅 커버리지 갭** — **CRUD 13개 구현 완료 (2026-08-01)**.
      `workflow.*` / `trigger.*` / `schedule.*` / `model_config.*`(create/update/delete/set_default).
      *(착수 시점 실측 — 이제는 해소됨: 네 모듈에 `AuditLogsService` import 가 **0건**이었다.)*
- [ ] **spec SoT 4곳 동기화 — planner 턴 필요** (`developer` 는 `spec/` read-only).
      `5-system/1-auth.md §4.1` Planned→구현 이동 · `data-flow/1-audit.md §1.1` 커버리지 갭
      문단·표 갱신 · `conventions/audit-actions.md §3` 상태 컬럼 · `2-navigation/2-trigger-list.md`
      L182/L252 (`trigger.delete` **액션명 오기** 포함 — 실제는 `trigger.deleted`).
      한 커밋에서 동시에 고쳐야 재drift 하지 않는다 (impl-prep 09_11_58 이 예견).
- [ ] **`workflow.executed`** — Planned 잔류. CRUD 와 카디널리티 차원이 달라
      (트리거·webhook 발동마다 적재) `audit_log` 보존 정책 결정과 묶어야 한다.
      실측: `audit_log` 은 pruner 가 없고 정책 미정(`login_history` 는 정리 배치 존재).
- [ ] `saveCanvas`/`importWorkflow` 감사 기록 — 리뷰 W3. 이번 PR 범위(서비스 CRUD)
      밖이며 `saveCanvas` 는 캔버스 편집마다 발동해 위 카디널리티 논점을 공유한다.
- [ ] `recordAudit` 공통 팩토리 (W4, 6번째 리소스 추가 시) · 동시 삭제 중복 감사 (W7,
      기존 `auth-configs` 패턴과 함께) · 컨트롤러 spec 보강 (W8) — 전부 우선순위 낮음.

> `status: implemented` 승격은 여전히 불가 — §1.3 LDAP/SAML 이 남아 있다.
