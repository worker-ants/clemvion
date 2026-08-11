---
worktree: trigger-rotation-audit
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
- [x] **spec SoT 4곳 동기화** — **완료 (2026-08-06, planner 턴)**. 한 커밋에서 동시 정정:
      `conventions/audit-actions.md §3` 4행 상태 → 구현 · `5-system/1-auth.md §4.1` 4개
      카테고리를 구현 표로 이동(Planned 에는 `workflow.executed` 만 잔류) + `model_config`
      "현재 미구현" 주석 정정 · `data-flow/1-audit.md §1.1` Writer 표 13행 추가 + 커버리지
      갭 문단 정정(남은 갭은 `workflow.executed` 와 `alerts` 모듈 둘로 좁힘) · 오기 3곳.
      정정 전 실측: 네 서비스 모두 `AuditLogsService.record` 를 호출하고 resourceType 은
      각각 `workflow`/`trigger`/`schedule`/`model_config`. 잔존 오기 0건(`grep` 전수).
      *(원 항목 서술 — `developer` 는 `spec/` read-only.)*
      `5-system/1-auth.md §4.1` Planned→구현 이동 · `data-flow/1-audit.md §1.1` 커버리지 갭
      문단·표 갱신 · `conventions/audit-actions.md §3` 상태 컬럼 · **audit 액션명 오기 3곳**.
      한 커밋에서 동시에 고쳐야 재drift 하지 않는다 (impl-prep 09_11_58 이 예견).

      **액션명 오기 3곳** (전수 재확인: `rg "trigger\.(delete|update)\b" spec/`):

      | 위치 | 현재 | 정정 | 주의 |
      | --- | --- | --- | --- |
      | `2-navigation/2-trigger-list.md:182` | `trigger.delete` ×2 | **둘 다 틀렸다 (각각 다른 이유)** | 뒤쪽(audit action) → `trigger.deleted`. 앞쪽은 "`trigger.delete` **permission** 으로 보호" 라고 쓰는데 **그런 permission 은 존재하지 않는다** — spec §3 에도 코드에도 없고, 인가는 역할 기반(`@Roles('editor')`)이다. `§3.2 리소스별 권한 매트릭스` 인용으로 바꿔야 한다 |
      | `2-navigation/2-trigger-list.md:252` | `trigger.update` | `trigger.updated` | — |
      | `5-system/15-chat-channel.md:377` | `trigger.update` | `trigger.updated` | **impl-done consistency(19_26_35 naming_collision)가 추가 발견** — 원래 인계 목록에 없던 세 번째 지점 |
- [x] **신규 설계 결정 2건을 spec `## Rationale` 로 승격** — **완료 (2026-08-06)**, `conventions/audit-actions.md §3` 아래 두 문단으로 기록. — impl-done consistency(19_26_35
      `rationale_continuity` INFO). 아래 둘은 기존 Rationale 을 번복하지 않지만 **현재 코드
      주석(`audit-action.const.ts`)에만 있어** spec 독자가 알 수 없다. 위 planner 턴에서 함께
      기록해야 다음 사람이 같은 판단을 다시 하지 않는다.
      - **1:1 결합 리소스는 주(主) 리소스만 기록** — `Schedule`↔`Trigger` 는 서로의 row 를
        직접 쓰지만 짝의 액션은 남기지 않는다. 사용자 행위 하나가 감사에 2행으로 보이는 것을
        막기 위함이며, 기준은 **호출된 엔드포인트의 리소스**다.
      - **고빈도 액션은 보존 정책 확정 전까지 유예** — `workflow.executed` 배제의 일반 원칙.
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
- [x] **트리거 시크릿/토큰 회전 3종 감사** — **완료 (2026-08-11, `claude/trigger-rotation-audit`)**. planner 선행(spec 6곳)과 구현을 한 PR 에서 처리했다. 액션명은 규약(§2.1 과거분사 + §1 언더스코어)과 선례(`integration.rotated`)로 도출: `trigger.notification_secret_rotated` · `trigger.chat_channel_bot_token_rotated` · `trigger.interaction_token_revoked`. 셋으로 가른 근거(폭발 반경)는 `conventions/audit-actions.md §3` Rationale. 아래는 착수 시점 서술로 남긴다.
      `TriggersService` 의 `rotateNotificationSecret`·`revokePerTriggerToken`·`rotateBotToken`
      이 `recordAudit` 를 호출하지 않는다(실측). Editor+ 면 호출 가능한 특권 작업이고 응답에
      새 시크릿을 1회 평문 반환하므로, 계정 탈취 후 조용한 시크릿 교체를 `audit_log` 만으로
      재구성할 수 없다 — 감사 가치가 CRUD 보다 높다. `integration.rotated` 선례도 있다.
      **다만 대응 액션이 spec 카탈로그에 없어**(`spec/` 전체에 `trigger.rotate*` 0건)
      `1-auth.md §4.1` + `conventions/audit-actions.md` 개정이 선행돼야 한다.
      ~~아래 "spec SoT 동기화" 항목과 **같은 planner 턴에서 함께** 처리하는 것이 맞다.~~
      **2026-08-06 — 번들되지 않았다. 별도 planner 턴이 필요하다.** 그 턴은 push 가 막혀
      촉발된 **정정** 작업이었다(이미 병합된 구현을 spec 이 "미구현" 으로 적고 있던 것을
      코드 실측에 맞춤). 반면 이 항목은 **새 설계**다 — `trigger.rotate*` 는 spec 카탈로그
      에도 코드에도 0건이라(재확인), 액션명·시제 분류·감사 대상 범위를 새로 정해야 하고
      그 자체가 리뷰 대상이다. 정정 턴에 설계를 얹으면 두 성격이 한 커밋에서 섞인다.
- [ ] **`audit_log` 적재 실패에 관측 수단이 없다** (2026-08-11, side_effect WARNING).
      `AuditLogsService.record()` 는 DB 오류를 `logger.warn` 한 줄로 **삼킨다** — 알림도
      메트릭도 없다. 그래서 "회전은 200 으로 성공, 그런데 감사 행만 조용히 비어 있음" 이
      아무에게도 안 보인다. **이 PR 이 만든 회귀가 아니라** 17개 감사 producer 전체의
      기존 설계이고, 세 회전 메서드가 그 관례를 따른 것 자체는 옳다.
      다만 이번에 "계정 탈취 재구성" 이라는 신뢰 수준을 명시적으로 끌어올렸으므로, 그
      신뢰를 지탱하는 하부 메커니즘과의 갭을 등재해 둔다.
      - [ ] 적재 실패 카운터/알림 도입 여부 결정 — 전 producer 공통이라 별도 트랙
- [ ] 동시 삭제 중복 감사 (W7, 기존 `auth-configs` 패턴과 함께) — 우선순위 낮음.
- [~] **[보안·별도 트랙] `@Roles()` 미부착 라우트의 워크스페이스 멤버십 검증 누락** —
      **2026-08-08 전용 plan 으로 이관**: [`auth-workspace-membership-guard.md`](../complete/auth-workspace-membership-guard.md).
      완료 판정은 그 plan 이 소유한다(중복 소유 방지). 이관 사유 = 본 plan 은 `owner: planner`
      의 감사 로깅 계열인데 본 건은 developer 트랙 P0 이라, 한 plan 에 묶으면 push 게이트가
      보는 `worktree:` 가 충돌한다. 이관 시점 전수 실측: HTTP 라우트 222건 중 `@WorkspaceId()`
      를 소비하며 `@Roles()` 가 없는 것 **73건**(mutation 15 / read 58). 아래 원 서술 유지 —
      7차 리뷰
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
