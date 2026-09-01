# 요구사항(Requirement) 리뷰

## 컨텍스트

이 changeset 은 이미 6라운드의 코드 리뷰·수정 사이클을 거쳤다(`review/code/2026/09/01/{14_31_12,15_10_38,15_25_56,15_49_24,16_29_11,16_53_16}`). 각 라운드의 RESOLUTION 을 실측 대조했고(12개 producer 파일 수, 10종 `resourceType` distinct 값, spec 3파일 정정 내용, 가드/fixture/spec 3파일 전문, `AuditLogsService.record`/`recordAudit`/`recordAuditWriteFailed` 전문, `audit-logs.spec.ts` 전문), 기존 6라운드가 잡은 항목들은 모두 코드에 반영돼 있음을 확인했다 — 별도로 재기재하지 않는다. 아래는 **7라운드에서 처음 발견한 것** 위주로 적는다.

## 발견사항

- **[WARNING]** 새 AST 가드(`audit-action-binding-guard.ts`)가 "감사 액션 바인딩 구멍"을 잡는 범위가 `recordAudit` 이름 패턴에만 좁게 걸려 있어, 실제 `AuditLogsService.record()` 호출의 **대다수**가 가드 밖에 남는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:21` (`AUDIT_HELPER_NAMES = new Set(['recordAudit'])`), 대조 대상 `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:79`(`record()`의 `action: AuditAction` — 여전히 맨 union)
  - 상세: 이번 PR 이 고친 것은 "5개 `recordAudit` 헬퍼 중 `auth_config` 만 `AuditActionFor`로 안 묶여 있었다"는 구체적 결함이고, 그 처방(공통 팩토리 대신 AST 가드)의 명시적 근거는 "가드는 **앞으로 생길 서비스도 잡는다**"(`CHANGELOG.md`, `audit-action-binding.spec.ts:23` JSDoc, `plan/in-progress/spec-sync-auth-gaps.md`)다. 그런데 `AuditLogsService.record()` 자체의 시그니처는 여전히 리소스에 묶이지 않은 `action: AuditAction`(bare union) 그대로이고, 가드는 **메서드 이름이 정확히 `recordAudit`인 선언**만 스캔한다(`auditHelperParams()`). 실측(grep, 이번 라운드에서 직접 확인):
    - `recordAudit` 래퍼를 통해 기록하는 5개 파일(triggers/workflows/schedules/model_config/auth_config)은 각각 `record()` 호출이 **정확히 1곳**(래퍼 내부)뿐이라 전부 가드가 본다.
    - 반면 `executions.service.ts`(1) · `integrations.service.ts`(6) · `users.controller.ts`(2) · `workspaces.service.ts`(8) · `workspace-invitations.service.ts`(1) · `auth.controller.ts`(2) · `webauthn.controller.ts`(2) — **7개 파일, 22개 호출 지점**이 래퍼 없이 `this.auditLogsService.record({...})`를 인라인으로 직접 호출한다. 이 22곳은 `AuditActionFor`를 전혀 쓰지 않고 `action: AUDIT_ACTIONS.XXX`(맨 union의 한 멤버)를 그대로 넘긴다 — `auth_config`가 고쳐지기 전과 **동일한 구조적 취약점**(TS 가 `action`↔`resourceType` 불일치를 못 잡는다)이 그대로 열려 있다. 전체 27개 `record()` 호출 중 22개(약 82%)가 이번 가드의 스캔 대상(`recordAudit`이라는 메서드 선언)에 아예 걸리지 않는다.
    - 현재 이 22곳의 값 자체는 (직접 대조 확인 결과) 전부 `resourceType`과 일치하는 올바른 action 이 들어가 있어 **지금 당장 살아있는 버그는 아니다.** 다만 향후 이 22곳 중 한 곳에서 복붙 실수로 다른 리소스의 action 을 넣어도, `record()`의 시그니처도 이 가드도 잡지 못한다 — 이번 PR 이 "닫았다"고 서술하는 결함 클래스가 이 22개 지점에서는 그대로 재현 가능하다.
  - 제안: (a) `AUDIT_HELPER_NAMES` 기반 스캔을 `recordAudit`류 래퍼가 아니라 **`auditLogsService.record(` 호출식 전체**로 넓혀, 호출부의 `resourceType` 리터럴과 `action` 리터럴의 접두사를 직접 비교하는 쪽으로 확장하거나, (b) 최소한 CHANGELOG/가드 JSDoc/plan 에 "이 가드는 `recordAudit` 명명 패턴을 쓰는 producer 에만 적용되고, 직접 `record()`를 호출하는 나머지 7개 파일·22개 지점은 범위 밖"이라는 스코프 한계를 명시해 "앞으로 생길 서비스도 잡는다"는 문장이 과장으로 읽히지 않게 한다. 이 PR 자체를 되돌릴 필요는 없다(회귀가 아니라 기존에도 있던 조건이고, 처리한 대상 자체는 정확히 처리됐다) — 다음 사람이 "바인딩 구멍은 이제 없다"고 오해하지 않도록 스코프를 문서화하는 정도로 충분하다.

- **[INFO]** 코드 주석의 producer 개수 표현이 "12개+"로 spec 의 정확한 수치(12)와 표기가 다르다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:105`, `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:204` (둘 다 "12개+ 특권 CRUD producer")
  - 상세: `spec/data-flow/1-audit.md`는 이번 PR 에서 "실제 호출자는 **12개 위치**"로 정확히 정정됐고(2026-09-01 실측, 5라운드 이전 "8개"의 오기를 바로잡음), plan 도 "**12개 모듈**"로 정확한 수치를 쓴다. 반면 서비스 코드 주석 2곳만 "12개+"(12 이상이라는 뉘앙스)로 남아 있다. 기능에는 영향 없고, 정확한 수치가 이미 확정된 상태에서 근사 표현을 쓸 이유가 약하다는 점만 기록한다.
  - 제안: "12개+" → "12개"로 통일(선택 사항, 우선순위 낮음).

- **[INFO]** spec fidelity 재검증 결과 — 이번 PR 이 갱신한 3개 spec 파일(`spec/5-system/_product-overview.md` NF-OB-07 카탈로그, `spec/data-flow/1-audit.md` §1.1, `spec/data-flow/9-observability.md` Rationale)은 코드와 **line-level 로 일치**를 재확인했다
  - 위치: 세 파일 전체(git diff 로 대조)
  - 상세: "producer 파일 12개" 클레임을 `grep -rl "auditLogsService\.record\("`로 직접 재검증(12개 파일, spec 과 정확히 일치) · "resourceType distinct 10종" 클레임도 `alert_rule`/`workspace_invitation`이 `NotificationsService.notify()`에만 쓰이고 `AuditLogsService.record()`에는 안 온다는 것을 직접 확인해 재검증(12 파일 유래 리터럴에서 이 둘을 빼면 정확히 10종) · `clampLabel`/`PROMETHEUS_LABEL_MAX_LEN` 공유화 · `recordAuditWriteFailed` JSDoc 의 "닫힌 유니온 대신 클램핑" 근거 서술이 실제 `record()` 시그니처(`resourceType: string`)와 일치함을 확인했다. 이번 PR 의 spec 갱신 자체는 결함이 없다.
  - 제안: 없음.

- **[INFO]** `AuditLogsService.record()`의 JSDoc(72-75행)이 이번 diff 로 추가된 관측 동작(카운터·확장 로그 필드)을 서술하지 않는다 — plan 에 이미 등재된 이월 항목(3~4라운드 연속)이며 신규 발견 아님
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-75`
  - 상세: `plan/in-progress/spec-sync-auth-gaps.md`의 "`clampLabel` 대칭 테스트 + `record()` JSDoc" 항목(미조치, 우선순위 판단으로 명시)과 동일 건. 재확인만 하고 새로 기재하지 않는다.
  - 제안: 조치 불요(이미 plan 트래킹).

## 요약

핵심 요구사항 두 가지 — (1) `auth_config` `recordAudit`의 리소스-액션 바인딩 구멍을 컴파일 타임에 막기, (2) 삼켜지던 감사 적재 실패를 관측 가능하게 하기 — 는 코드·테스트·spec 세 층위 모두에서 정확히 구현됐고, 6라운드에 걸친 뮤테이션 검증(원 구멍 복원·화살표 필드·오귀속·클램핑 제거·`@Optional` 제거 등 전부 RED)으로 vacuous 하지 않음이 실측됐다. spec 3파일(NF-OB-07 카탈로그, `data-flow/1-audit.md`, `data-flow/9-observability.md`)은 이번 라운드에서 producer 파일 수(12)·`resourceType` distinct 값(10)을 코드와 직접 대조해 line-level 일치를 재확인했다. 이번 라운드의 새 발견은 하나다 — 신설된 AST 가드가 명명 패턴(`recordAudit`)에 의존해 스캔 대상을 정하는데, 실제 감사 producer 27개 호출 지점 중 22개(7개 파일)가 그 패턴 없이 `record()`를 직접 호출해 가드 범위 밖에 있다. 현재 그 22곳의 값 자체는 올바르지만, 이 PR 이 "닫았다"고 서술하는 결함 클래스(TS 가 액션-리소스 불일치를 못 잡는 문제)는 그 22곳에서 구조적으로 여전히 열려 있다 — 살아있는 버그는 아니지만 가드의 커버리지 주장과 실제 범위 사이에 괴리가 있어 WARNING 으로 기록한다. 나머지는 표기 일관성 수준의 INFO 뿐이다.

## 위험도

LOW
