---
title: "spec draft — NF-OB-07 `resource_type` \"실측 12종\" 오기산 정정 (→ 10종)"
worktree: .claude/worktrees/audit-record-factory
started: 2026-09-01
owner: project-planner
status: applied
completed: 2026-09-01
priority: P2
spec_impact:
  - spec/5-system/_product-overview.md
  - spec/data-flow/1-audit.md
---

> ✅ **적용 완료 (2026-09-01).** `--spec` 게이트(`review/consistency/2026/09/01/16_16_39`,
> **BLOCK: NO`) 통과 후 `spec/5-system/_product-overview.md` NF-OB-07 과
> `spec/data-flow/1-audit.md` §1.1 산문에 반영했다. 동반 정정 3곳(JSDoc·plan 2개)도 완료.

## Overview

`clemvion.audit.write_failed` 카운터를 등재하면서 `resource_type` 라벨의 카디널리티를
**"실측 12종"** 이라 적었다. `--impl-done` consistency 가 이를 WARNING 으로 잡았고
(`review/consistency/2026/09/01/16_02_03/`), **전수 재측정 결과 실제 distinct 값은 10종**이다.

12 는 라벨 값의 수가 아니라 **`AuditLogsService` 를 주입해 `record()` 를 부르는 파일의 수**였다.
개수를 세는 대상을 바꿔 놓고 같은 숫자를 라벨 카디널리티라고 적은 것이다.

## 실측

`codebase/backend/src/` 전수. 계산 근거를 함께 남긴다 — 이 오기산의 원인이 "무엇을 세는가"의
혼동이므로, 숫자만 고치면 같은 자리에서 재발한다.

| 세는 대상 | 값 | 측정 |
|---|---|---|
| `AuditLogsService` 를 주입하는 파일 | 13 | `grep -rln "private readonly auditLogsService: AuditLogsService"` |
| 그중 **감사 producer** | **12** | 위 13에서 `audit-logs.controller.ts` 제외 — 조회(`findAll`) 전용이라 `record()` 를 부르지 않는다 |
| `auditLogsService.record(` 호출 지점 | 27 | `grep -rn "auditLogsService\.record("` (`*.spec.ts` 제외) |
| **distinct `resourceType` 값** | **10** | 아래 목록 |

10종: `user` · `trigger` · `workflow` · `schedule` · `member` · `workspace` · `integration` ·
`model_config` · `auth_config` · `execution`.

상수 경유 5개는 실값으로 풀어 확인했다 — `TRIGGER_RESOURCE_TYPE='trigger'` ·
`WORKFLOW_RESOURCE_TYPE='workflow'` · `SCHEDULE_RESOURCE_TYPE='schedule'` ·
`MODEL_CONFIG_RESOURCE_TYPE='model_config'` · `AUTH_CONFIG_RESOURCE_TYPE='auth_config'`.

### 감사가 아닌 `resourceType` 을 갈라낸 것이 판정의 절반이다

`resourceType` 이라는 **식별자**는 알림(`NotificationsService.notify`)에서도 쓴다. 이름만 보고
세면 알림 값이 섞여 카디널리티가 부풀려진다. 실제로 검토 과정에서 두 값이 후보로 올라왔고,
둘 다 **알림 쪽**이라 제외했다:

- `workspace_invitation` (`workspace-invitations.service.ts:220`) — `notificationsService.notify`
- `alert_rule` (`alerts-evaluator.service.ts:216`) — 알림. 해당 파일은 `AuditLogsService` 를
  주입조차 하지 않는다

`workspace_invitation` 은 같은 파일에 감사 `record()`(`resourceType: 'member'`)가 함께 있어
**호출 근처만 보는 방식으로는 갈리지 않는다** — 주입 타입에서 출발해 호출 지점을 전수 열거해야
갈린다.

### 비-생성자 주입 경로 없음

`get(AuditLogsService)` / `resolve(...)` / `@Inject(AuditLogsService)` 는 전부 `*.spec.ts`
안에만 있다. 프로덕션 경로는 위 12개 파일이 전부다.

## 변경 제안

`spec/5-system/_product-overview.md` §5 NF-OB-07 카탈로그 표의 `clemvion.audit.write_failed`
행에서:

- `실측 12종` → `실측 10종`
- 세는 대상을 문장 안에 박는다 — `10종`이 **distinct 라벨 값**의 수이고 producer 파일 수(12)와
  다르다는 것을 표 안에서 읽히게 한다. 숫자만 고치면 다음 사람이 다시 파일 수를 세어 넣는다.

설계 결론(**클램핑**을 쓰고 닫힌 유니온을 쓰지 않는다)은 **바뀌지 않는다**. 근거는 개수가 아니라
`record()` 시그니처가 `resourceType: string`(열림)이라 컴파일러가 닫힘을 증명하지 못한다는
점이고, 10이든 12든 그 논증에 영향이 없다. 다만 근거로 인용한 실측이 틀렸다면 그 실측은 고친다.

## 동반 정정 (spec 밖 — 같은 오기산이 전파된 3곳)

`spec/` 쓰기와 별개로 developer 권한 안에서 고친다. 이 게이트(`--spec`)가 도는 동안 셋 다
적용했으므로 **실제 상태로 적는다** — 미적용은 spec 1곳뿐이다.

- [x] `codebase/backend/src/modules/metrics/business-metrics.service.ts` — `recordAuditWriteFailed`
      JSDoc "왜 클램핑인가" 절. 10종 목록 + "producer 파일 12 ≠ 라벨 10" 구분 명시
- [x] `plan/in-progress/spec-sync-auth-gaps.md` — "실측 12종" 및 **"17개 감사 producer"** ×2.
      후자는 12·27·10 어느 것과도 맞지 않았다 — 무엇을 센 숫자인지 복원되지 않아, 측정 가능한
      쪽은 실측값(감사 producer 12개)으로 바꾸고 **근거의 축이 애초에 개수가 아니던 쪽
      (`login_history` 유예 사유)은 숫자를 뺐다**
- [x] `plan/complete/spec-draft-audit-write-failed-metric.md` — 원 draft 2곳. 봉인된 `complete/`
      문서지만 **틀린 실측을 근거로 남긴 자리**라 정정 노트를 덧붙였다(원문은 기록으로 보존)
- [x] `spec/5-system/_product-overview.md` — 게이트(`--spec` `16_16_39`, **BLOCK: NO`) 통과 후 적용
- [x] `spec/data-flow/1-audit.md` — 게이트 INFO 1 이 찾아낸 **인접 문서의 같은 병**. 아래 참조

## 게이트가 하나를 더 찾았다 — `1-audit.md` 의 "8개 위치"

`--spec` INFO 1 이 `spec/data-flow/1-audit.md:55` 의 *"실제 호출자는 8개 위치(5개 service +
3개 controller)"* 를 지목했다. 직접 세어 확정했다:

| 출처 | 값 |
|---|---|
| §1.1 Writer 표의 distinct `*.ts` 모듈 | **12** (9 service + 3 controller) |
| 코드 실측 (`AuditLogsService` 주입 producer) | **12** (동일 명단) |
| 산문이 주장한 값 | 8 (5 + 3) |

**산문이 자기 바로 아래 표와 모순이었다.** 2026-08-01 CRUD 확장 이전 수치가 남은 것으로 보인다.
`_product-overview.md` 와 같은 changeset 안의 파일이고 같은 실측이 판정하므로 함께 고친다.

여기서 한 번 좁게 셀 뻔했다 — §1.1 범위를 `sed` 로 뜨면 바로 아래 §1.2 `login_history` writer
표까지 딸려 와 모듈이 **15개**로 보인다. 그 셋(`auth.service`·`sessions.service`·
`webauthn.service`)은 `login_history` writer라 `AuditLogsService` 를 주입조차 하지 않는다.
반대로 컬럼 형태로 거른 정규식은 `auth.controller`·`webauthn.controller` 를 **놓쳐 10** 이 나왔다.
표를 전수 열거해야 12 로 수렴한다 — 이 문서가 고치는 오류와 정확히 같은 종류(세는 대상의 교체)다.

## Rationale

**왜 숫자 하나에 planner 턴을 쓰는가.** 이 문장은 예고·트리거가 아니라 **사실 서술**이라
developer 의 자기-반증형 소정정 예외(CLAUDE.md §자기-반증형 소정정, 조건 2)에 해당하지 않는다.
그리고 이 PR 자체가 "거짓 근거를 남기면 다음 사람이 그걸 믿고 같은 판단을 반복한다" 를
3라운드에 걸쳐 겪은 changeset 이다 — 그 changeset 이 검증되지 않은 숫자를 spec 에 남기고 닫히면
PR 본문이 자기 반증이 된다.

**왜 근거를 표로 남기는가.** 원인이 산술 실수가 아니라 **세는 대상의 교체**다. "10" 만 적으면
다음 사람이 `resourceType` 을 grep 해 알림 값까지 세거나 파일 수를 세어 같은 오기산을 만든다.
