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
- [ ] `saveCanvas`/`restoreVersion` 감사 기록 — 리뷰 W3. `saveCanvas` 는 캔버스 편집마다
      발동해 위 카디널리티 논점을 공유한다. *(`importWorkflow` 는 4차 리뷰에서 조치 완료 —
      `workflows.service.ts` `details: { imported: true }`. 카디널리티 논거가 적용되지 않는데
      `saveCanvas` 와 묶여 유예됐던 것이 원래의 오분류였다.)*
- [ ] `recordAudit` 공통 팩토리 (W4) — 5개 helper 의 `details` 계약이 전부 달라(passthrough /
      `{type}` / 없음 / `{kind}` / `ipAddress`) 공통분모가 `resourceType` 바인딩 + 필드 전달뿐이다.
      추출해도 타입 있는 per-service 래퍼는 남는다. *(원래 근거였던 "6번째 리소스에서 재검토" 는
      이미 5개라 성립하지 않아 6차에서 근거를 교체했다.)*
- [ ] **트리거 시크릿/토큰 회전 3종 감사 — planner 선행 필요** (8차 리뷰 security).
      `TriggersService` 의 `rotateNotificationSecret`·`revokePerTriggerToken`·`rotateBotToken`
      이 `recordAudit` 를 호출하지 않는다(실측). Editor+ 면 호출 가능한 특권 작업이고 응답에
      새 시크릿을 1회 평문 반환하므로, 계정 탈취 후 조용한 시크릿 교체를 `audit_log` 만으로
      재구성할 수 없다 — 감사 가치가 CRUD 보다 높다. `integration.rotated` 선례도 있다.
      **다만 대응 액션이 spec 카탈로그에 없어**(`spec/` 전체에 `trigger.rotate*` 0건)
      `1-auth.md §4.1` + `conventions/audit-actions.md` 개정이 선행돼야 한다.
      아래 "spec SoT 동기화" 항목과 **같은 planner 턴에서 함께** 처리하는 것이 맞다.
- [ ] 동시 삭제 중복 감사 (W7, 기존 `auth-configs` 패턴과 함께) — 우선순위 낮음.
- [ ] **[보안·별도 트랙] `@Roles()` 미부착 라우트의 워크스페이스 멤버십 검증 누락** — 7차 리뷰
      `security` CRITICAL. `RolesGuard.canActivate` 가 `requiredRoles` 가 비면 `return true` 로
      조기 반환해 `getMemberRole` 이 실행되지 않고, 멤버십을 보는 다른 가드가 없다. 비멤버가
      `X-Workspace-Id` 를 위조해 타 워크스페이스 데이터를 열람/조작할 수 있다. **이 PR 과 무관한
      기존 결함**(`origin/main` 에도 동일, diff 밖 — 실측 확인). 특히 `triggers.controller.ts`
      `rotateBotToken` 은 mutation 인데 `@Roles()` 가 없다. **전수 조사 선행 필요** — 확인된
      11곳은 7차 배치의 4개 컨트롤러만 훑은 결과다. 근거: `review/code/2026/08/01/13_46_48/security.md`
- [x] 컨트롤러 `userId` 배선 spec (W8) — **6차 리뷰에서 종결**. 감사 기록 대상 배선 15곳 전수
      단언 + 뮤턴트 13종 RED. 유예 근거였던 "타입이 강제한다" 가 반증됐다 (TS2554 는 인자
      누락만 잡고 동일 타입 스왑은 못 잡는다 — 실측 오류 0건).

> `status: implemented` 승격은 여전히 불가 — §1.3 LDAP/SAML 이 남아 있다.
