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
- [x] `recordAudit` 공통 팩토리 (W4) — **won't-do 로 종결 (2026-09-01).** 추출하지 않는
      대신 **가드로 대체**했다. 다섯을 전부 읽어 이 plan 의 근거를 실측했고 **서술은 옳았다**:

      | 서비스 | action 타입 | 추가 필드 → details |
      |---|---|---|
      | triggers | `AuditActionFor<'trigger'>` | `type` → `{type}` |
      | workflows | `AuditActionFor<'workflow'>` | `details?` passthrough |
      | schedules | `AuditActionFor<'schedule'>` | 없음 |
      | model_config | `AuditActionFor<'model_config'>` | `kind` → `{kind}` |
      | auth_config | **맨 `AuditAction`** | `ipAddress` |

      **그런데 그 표가 이 plan 이 적지 않은 것을 드러냈다** — 넷은 리소스에 묶는데
      `auth_config` 만 맨 union 이었다. 판별 프로브로 실재를 확인했다:

      ```
      auth-configs 에 action: 'trigger.created'  → tsc 0 에러   ← 구멍
      schedules   에 action: 'trigger.created'  → TS2322       ← 대조군
      ```

      대조군이 없었다면 "`AuditActionFor` 가 원래 안 좁히나?" 와 구분되지 않았다.

      **처방을 바꾼 이유**: 얇은 공통분모를 억지로 뽑으면 그것을 **쓰는 곳만** 안전해진다.
      정작 문제는 그 공통분모(`resourceType` 바인딩)가 **균일하게 지켜지지 않은 것**이므로,
      지켜지는지를 검사하는 가드가 맞다 — 앞으로 생길 서비스도 잡는다.

      - `auth-configs` 를 `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>` 로 (실제 결함)
      - `repo-guards/__tests__/audit-action-binding{-guard,-fixture,}.ts` 신설. 판정은
        **값이 아니라 형태**로 한다(액션이 추가될 때마다 가드를 고치지 않아도 되고, 정작
        "묶이지 않았다" 는 구조적 사실을 놓치지 않는다)
      - 형태 커버리지는 **불변 fixture** 에. 라이브 소스에 걸면 가드가 없애려는 형태의
        존재를 단언하게 되어 자기반증 테스트가 된다
      - 뮤테이션 5축 (예측/실측 전부 RED): 원 결함 복원 · 스캔 경로 오지정 · 메서드 이름
        오탈자 · 접두 검사 느슨화 · `action` 부재 통과. 뒤 둘은 **가드가 아무것도 안 보는데
        통과하는** 상태를 잡는 전제 단언이다
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
- [x] **`audit_log` 적재 실패에 관측 수단이 없다** — **완료 (2026-09-01).**
      **삼키는 것 자체는 유지했다** — 감사 기록 실패가 본 요청(회전·삭제 같은 특권 작업)을
      깨뜨리면 안 되고, 그 판단은 옳다. 고친 것은 그 뒤가 조용했다는 점이다:

      - `BusinessMetricsService.recordAuditWriteFailed(resourceType)` 신설
        (`clemvion.audit.write_failed`). 선례 `recordRedisFailOpen` 과 **같은 결함
        클래스**라 그 모양을 그대로 따랐다 — 그쪽 주석이 이미 "warn 로그뿐이라 비율·추세로
        알람을 걸 수 없다" 고 적고 있다.
      - **로그가 무엇이 유실됐는지 안 적고 있었다.** 종전 메시지는 에러 문구뿐이라 어느
        감사가 사라졌는지 알 수 없었다 — 유실 사실만 알고 대상을 모르면 조사도 복구도
        시작할 수 없다. `action`·`resourceType`·`resourceId`·`workspaceId` 를 싣는다.
      - 주입은 `@Optional()` (선례 `idempotency.interceptor.ts`) — 관측이 없다고 감사가
        멈추면 본말이 뒤집힌다.
      - 라벨은 **클램핑**이다(닫힌 유니온이 아니라). `resourceType` 은 실측 12종으로
        유계지만 `record()` 시그니처가 `string`(열림)이라 컴파일러가 닫힘을 증명하지
        못한다 — 증명되지 않은 닫힘을 타입으로 주장하는 대신 `recordExecutionError` 와
        같은 클램핑으로 방어했다. `record()` 가 닫힌 유니온을 받게 되면 그때 좁힌다.
      - 뮤테이션 4축 (예측/실측 전부 RED): 원 상태 복원 · 성공 경로에서도 카운터 증가 ·
        로그에서 `resourceId` 만 제거 · `@Optional` 제거.

      아래는 착수 시점 서술로 남긴다.
      `AuditLogsService.record()` 는 DB 오류를 `logger.warn` 한 줄로 **삼킨다** — 알림도
      메트릭도 없다. 그래서 "회전은 200 으로 성공, 그런데 감사 행만 조용히 비어 있음" 이
      아무에게도 안 보인다. **이 PR 이 만든 회귀가 아니라** 17개 감사 producer 전체의
      기존 설계이고, 세 회전 메서드가 그 관례를 따른 것 자체는 옳다.
      다만 이번에 "계정 탈취 재구성" 이라는 신뢰 수준을 명시적으로 끌어올렸으므로, 그
      신뢰를 지탱하는 하부 메커니즘과의 갭을 등재해 둔다.
      - [x] **`audit_log` 축 — 완료 (2026-09-01).** `clemvion.audit.write_failed` 신설 +
            로그에 유실 대상 기재. 위 항목 참조. spec 반영은
            [`spec-draft-audit-write-failed-metric.md`](./spec-draft-audit-write-failed-metric.md).
      - [ ] **`login_history` 축 — 미결.** `login-history.service.ts` 의 `record` 는 여전히
            `Logger.error` 뿐이고 카운터가 없다. `audit_log` 쪽만 넓혀서 **두 producer 의
            관측 강도가 갈렸다** — `spec/data-flow/1-audit.md` 가 그 비대칭을 명시적으로
            적고 있으므로 숨어 있지는 않다.

            지금 안 붙이는 이유: "감사 실패 관측을 어디까지 넓히나" 는 17개 producer 전체에
            걸리는 결정이고, `audit_log` 는 "계정 탈취 재구성" 이라는 신뢰 수준을 명시적으로
            끌어올린 자리라 먼저 닫을 근거가 있었다. `login_history` 는 그 근거가 아직 없다.

            재개 신호: 로그인 이력 유실이 실제로 조사에 걸릴 때, 또는 producer 를 하나 더
            넓힐 일이 생겨 "어디까지" 를 한 번에 정하게 될 때.
- [ ] **회전 감사 mutation 잔여 갭 1건** (2026-08-11, ai-review `12_37_14` testing INFO).
      `rotateBotToken` 의 실패경로 회귀는 실패를 **4단계(`setupChannel`)** 에 주입한다.
      그래서 감사를 **5→6 구간**으로 옮기는 뮤턴트는 아직 GREEN 으로 산다. 그 테스트의
      docstring 이 스스로를 4단계로 한정하고 있어 **거짓 서술은 아니고**, 닫으려면 secret
      store mock 을 한 겹 더 세워야 한다. 자매 두 메서드의 같은 축(검증 예외만 흉내 내던
      실패 테스트)은 `save()` 실패 주입으로 **닫았다** — 남은 것은 이 한 구간뿐이다.
- [ ] **`audit-action.const.ts` 주석 비대화** (2026-08-11, ai-review `12_56_06`
      maintainability INFO ×2). 141줄 중 60%+ 가 주석이고 회전 3종 도입으로 또 늘었다.
      서술형 논거는 이미 `spec/conventions/audit-actions.md §3` 이 SoT 이므로, 코드에는
      짧은 포인터만 남기는 편이 스케일한다. 함께: 주석의 **자기 이력 서술**이 비일관하다
      (첫 사실 오류는 각주로 남겼는데 두 번째 정정은 무각주). 소스 주석은 "지금 맞는
      사실" 만 진술하고 정정 이력은 git/CHANGELOG/plan 에 맡기는 쪽으로 정리한다.
      **다음에 이 파일을 확장할 때** 함께 처리 — 지금 단독으로 건드릴 이유는 없다.
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
      기존 결함**(`origin/main` 에도 동일, diff 밖 — 실측 확인). ~~특히 `triggers.controller.ts`
      `rotateBotToken` 은 mutation 인데 `@Roles()` 가 없다.~~ → **이 예시는 더 이상 사실이
      아니다 (2026-08-08 `#1103` 로 해소).** `triggers.controller.ts:239` 에 `@Roles('editor')`
      가 붙어 있다(2026-08-11 실측). 인용된 원 서술은 보존하되 **취소선으로 묘비를 남긴다** —
      살아 있는 예시로 읽히면 이미 닫힌 구멍을 다시 조사하게 된다. **전수 조사 선행 필요** — 확인된
      11곳은 7차 배치의 4개 컨트롤러만 훑은 결과다. 근거: `review/code/2026/08/01/13_46_48/security.md`
- [x] 컨트롤러 `userId` 배선 spec (W8) — **6차 리뷰에서 종결**. 감사 기록 대상 배선 15곳 전수
      단언 + 뮤턴트 13종 RED. 유예 근거였던 "타입이 강제한다" 가 반증됐다 (TS2554 는 인자
      누락만 잡고 동일 타입 스왑은 못 잡는다 — 실측 오류 0건).

> `status: implemented` 승격은 여전히 불가 — §1.3 LDAP/SAML 이 남아 있다.

## 추가 발견 (2026-08-30, `--impl-done` `21_59_41` cross_spec)

무관한 PR(`claude/review-artifact-header-leak`)의 `--impl-done` 이 `spec/data-flow/` 스냅샷을
다른 영역과 대조하다 드러낸 **기존** 불일치다. 그 PR 의 diff 가 유발한 것이 아니고,
checker 가 **`plan/**` 어디에도 추적되지 않음**을 확인해 여기 등재한다.

- [x] **계정 잠금 시 이메일 알림 — 두 spec 이 다르다** (`21_59_41` cross_spec W1).
      `data-flow/2-auth.md` §3.2·§2.3 과 실코드(`mail.service.ts`·`auth.service.ts`)는
      **알림 없음**으로 일치하는데, `5-system/1-auth.md` §1.1 표만 "이메일 알림" 을 요구한다.
      - 처방 둘 중 하나: (a) §1.1 표에서 그 문구 제거, (b) 알림을 실제로 원하면 구현 티켓 +
        `data-flow/2-auth.md` 동반 갱신.
      - **project-planner 턴 필요** — 제품 요구사항 텍스트라 developer 자기-반증형 소정정
        예외(예고·트리거 문장 한정) 대상이 아니다.

- [x] **`alert_rule`(V016) 이 데이터 모델 SoT 에 없다** (`21_59_41` cross_spec W2).
      컬럼 정의가 `data-flow/9-observability.md` §2.1 에만 있고 `1-data-model.md` §2 에는
      엔티티 섹션 자체가 없다.
      - 처방: `1-data-model.md` §2 에 `AlertRule`(V016) 섹션 신설, `9-observability.md` §2.1
        은 발췌로 축약.
      - ~~이 파일은 auth 트래커라 주제가 맞지 않는다 — 임시로 여기 둔다.~~ **해소돼 위치
        문제도 사라졌다.**

> **위 두 건 완료 (2026-08-31, planner 턴).** `--spec` 2회(`10_37_51`·`10_46_44`) 모두
> BLOCK:NO, WARNING 7건 전량 반영. 반영 내용:
>
> - `5-system/1-auth.md` §1.1 표에서 "이메일 알림" 제거 + `## Rationale` 에 **실측 4행**
>   (`MailService` 발송 메서드 6종 전수 · 잠금↔메일 연결 0건 등)으로 정정 근거
> - `1-data-model.md` **§2.25 AlertRule** 신설(문서 관례대로 `필드|타입|설명` 3컬럼,
>   추상 타입) + §1 ER 트리 + `## Rationale` 에 기각한 대안
> - **곁가지로 §2.19 `Notification.type` drift 도 고쳤다** — 닫힌 목록에
>   `alert_failure_rate`/`alert_duration`/`alert_llm_cost` 가 빠져 있어 "이 enum 이 전부다"
>   가 거짓이었다(`10_37_51` cross_spec W1 이 발견)
> - 상호참조 양방향: `9-observability.md` 링크에 anchor, `9-user-profile.md` §6.3 에 역참조
>
> **내가 틀렸던 것 둘**: 컬럼 표를 raw DDL 2컬럼으로 옮겼다(24개 엔티티가 예외 없이
> 3컬럼) · 타입에 **`Number` 를 발명**했다(어휘는 `Float`/`Int`/`BigInt` 뿐 — `Float` 로
> 정정하고 DB 고정소수를 설명에 남겼다).

- [x] **`ACCOUNT_LOCKED` 상태 코드가 spec 간 다르다** (`10_46_44` cross_spec INFO 1).
      `5-system/1-auth.md` · `3-error-handling.md` · `data-flow/2-auth.md` · `auth.service.ts`
      사이에서 **423 vs 401** 이 갈린다. 위 ① 작업 중 인접해서 드러났으나 **범위 밖**이라
      건드리지 않았다 — 어느 쪽이 맞는지 실측이 먼저다.
- [x] **`ALERT_RULE_NOT_FOUND` 가 에러 코드 중앙 카탈로그에 없다** (`10_46_44` cross_spec
      INFO 2). `alerts.service.ts:49,66` 이 발행하는데 `3-error-handling.md` 미등재.
      `9-user-profile.md:387-388` 에만 있다.

> **위 두 건 완료 (2026-08-31, planner 턴).** `--spec`(`11_05_44`) BLOCK:NO, WARNING 2건 반영.
>
> - `ACCOUNT_LOCKED` **423 → 401**. `UnauthorizedException` 실측 + `data-flow` 두 곳과 일치.
>   **낡은 게 아니라 처음부터 틀렸다** — `git log -S "LockedException"` **0건**이고 그 행은
>   최초 spec 초안(`05089d5a6`)부터 남아 있었다. "구현을 423 으로" 는 API 계약 변경이라 기각.
> - `ALERT_RULE_NOT_FOUND` **§1.3 직접 등재**(404). `MODEL_CONFIG_NOT_FOUND` 선례를 따랐고,
>   워크스페이스 스코프 조회라 **타 워크스페이스 접근도 같은 404**(존재 누설 방지)임을 명시.
> - **부수 효과를 함께 닫았다**: 423 이 §1.2 에서 사라지면서 같은 문서 Rationale 두 곳의
>   "401/403/423" 서술이 낡는다 → 함께 갱신(`11_05_44` W1).
