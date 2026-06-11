# 신규 식별자 충돌 검토 결과

검토 대상: `AUDIT_ACTIONS` const + `AuditAction` type 도입 (diff-base: origin/main)
검토 모드: --impl-done, scope=G-01/G-02 audit (rebase 후 재검)

---

## 발견사항

### 발견사항 1

- **[CRITICAL]** `execution.re_run` — spec SoT 와 다른 action 문자열 도입
  - target 신규 식별자: `AUDIT_ACTIONS.EXECUTION_RE_RUN = 'execution.re_run'`
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/spec/5-system/13-replay-rerun.md` §11 (line 394, 400): `re_run_initiated` 로 명시. 표의 `action` 컬럼 값 = `re_run_initiated`
    - `/Volumes/project/private/clemvion/spec/data-flow/1-audit.md` §1.1 (line 52): `re_run_initiated` 가 현재 구현 SoT 표의 값
    - `executions/executions-rerun.service.spec.ts` (diff 내): 테스트도 `execution.re_run` 으로 갱신됨 — 즉 코드와 테스트는 일관되게 변경됐으나 spec 2개 파일이 `re_run_initiated` 를 그대로 유지
  - 상세: DB 에는 이미 `re_run_initiated` 로 적재된 기존 레코드가 있을 수 있으며, spec §11 과 data-flow §1.1 은 아직 갱신되지 않아 코드 ↔ spec 사이에 action 문자열 불일치가 발생. 운영 환경에서 `action = 'execution.re_run'` 으로 필터하면 이전 `re_run_initiated` 레코드가 누락되고, spec 기준으로 쿼리하면 vice-versa. 감사 로그는 불변 이력이므로 기존 값과 신규 값이 혼재하면 조회 정합성이 깨진다.
  - 제안:
    1. (권장) spec 2개 파일(`spec/5-system/13-replay-rerun.md §11`, `spec/data-flow/1-audit.md §1.1`)을 `execution.re_run` 으로 갱신해 코드와 일치시킨다. data-flow §1.1 의 Rationale 섹션(`re_run_initiated` 표기 이탈 서술)도 함께 정정한다.
    2. (대안) 구현을 `re_run_initiated` 로 롤백하고 spec 표기를 SoT 로 유지. 단, dot-prefix 규약 이탈 문제는 Rationale 에서 이미 미해결 과제로 인정하고 있어 권장하지 않음.

---

### 발견사항 2

- **[WARNING]** `integration.create/update/delete` (spec §4.1) vs `integration.created/updated/deleted` (구현 및 AUDIT_ACTIONS)
  - target 신규 식별자: `AUDIT_ACTIONS.INTEGRATION_CREATED = 'integration.created'`, `AUDIT_ACTIONS.INTEGRATION_UPDATED = 'integration.updated'`, `AUDIT_ACTIONS.INTEGRATION_DELETED = 'integration.deleted'`
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/1-auth.md` §4.1 (line 350): `integration.create, integration.update, integration.delete` (현재형 동사). `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` line 1105 및 `/Volumes/project/private/clemvion/spec/data-flow/1-audit.md` §1.1은 이미 과거분사형(`integration.created/updated/deleted`) 을 사용 — 즉 spec 내부에서도 §4.1 vs 나머지 문서 사이에 불일치가 존재.
  - 상세: `AUDIT_ACTIONS` const 가 과거분사형을 채택한 것은 기존 data-flow 및 integration spec 과 일치하지만, 1-auth.md §4.1 "기록 대상 액션" 표는 현재형(create/update/delete) 을 사용해 혼선을 유발한다. const 도입 자체는 문제없으나 spec §4.1 이 동기화되지 않으면 "목표 커버리지 카탈로그" 의 가독성이 저하된다.
  - 제안: `spec/5-system/1-auth.md §4.1` 의 Integration 행을 `integration.created, integration.updated, integration.deleted, integration.rotated, integration.scope_changed, integration.reauthorized` 로 갱신해 구현·data-flow spec 과 표기를 통일한다. (다른 카테고리의 현재형 동사는 아직 미구현이므로 Planned 표기로 유지 가능)

---

### 발견사항 3

- **[INFO]** `AUDIT_ACTIONS` 상수명 — 기존 코드에 동명 심볼 없음, 충돌 없음
  - target 신규 식별자: `AUDIT_ACTIONS` (exported const), `AuditAction` (exported type), 파일 경로 `codebase/backend/src/modules/audit-logs/audit-action.const.ts`
  - 기존 사용처: grep 결과 `AUDIT_ACTIONS`/`AuditAction` 는 해당 파일 외부 어디에도 정의된 바 없음. 파일명 `audit-action.const.ts` 는 이 모듈 폴더의 기존 컨벤션(`audit-logs.service.ts`, `audit-log.entity.ts`)과 일관됨.
  - 상세: 식별자 충돌 없음. 신규 파일 경로·이름도 기존 명명 컨벤션(`<entity>-<aspect>.const.ts`)을 따름.
  - 제안: 없음.

---

## 요약

이번 diff 가 도입하는 `AUDIT_ACTIONS` const / `AuditAction` type 자체는 코드베이스 내 기존 심볼과 충돌하지 않는다. 그러나 `EXECUTION_RE_RUN = 'execution.re_run'` 은 `/Volumes/project/private/clemvion/spec/5-system/13-replay-rerun.md §11` 과 `/Volumes/project/private/clemvion/spec/data-flow/1-audit.md §1.1` 에 명시된 `re_run_initiated` 와 다른 문자열을 도입해 코드-spec 간 직접 충돌이 발생한다. 이는 불변 감사 로그 이력의 조회 정합성에 영향을 주므로 CRITICAL 로 분류한다. Integration action 의 현재형/과거분사형 혼재는 spec 내부 비일관 문제로 WARNING 수준이다.

## 위험도

HIGH
