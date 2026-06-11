# 신규 식별자 충돌 검토 결과

> 대상: G-01/G-02 audit 도메인 — `re_run_initiated→execution.re_run` 개명 + `AUDIT_ACTIONS` union 상수 강제(9 call site 전환) + spec §4.1 구현됨/Planned 구분

---

## 발견사항

### [INFO] `AUDIT_ACTIONS` / `AuditAction` — 기존 사용처 없음, 신규 도입 충돌 없음
- target 신규 식별자: `AUDIT_ACTIONS` (const object), `AuditAction` (TypeScript type alias), 모두 `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 에서 신규 정의
- 기존 사용처: 기존 코드베이스 전체에서 `AUDIT_ACTIONS` 및 `AuditAction` 이름으로 정의·사용된 심볼이 없음 (grep 0건 확인). spec 에도 해당 식별자 사전 등장 없음
- 상세: 신규 파일 신규 export 이며 충돌 없음. `audit-action.const.ts` 파일 경로도 `audit-logs/` 모듈 내 기존 컨벤션(`*.const.ts`)을 따른다
- 제안: 없음

### [INFO] `execution.re_run` — 기존 사용처 없음, 신규 action 값 충돌 없음
- target 신규 식별자: action 문자열 값 `execution.re_run`
- 기존 사용처: `execution.re_run` 문자열은 기존 spec, 코드, DB 어디에도 등장하지 않음 (기존 값은 `re_run_initiated`)
- 상세: 개명 대상인 `re_run_initiated` 와 새 값 `execution.re_run` 은 의미가 동일하고 신규 네임스페이스 충돌이 없다. `execution` prefix 는 `AUDIT_ACTIONS` 내 다른 키(`EXECUTION_RE_RUN`)에서만 사용되며 다른 resource 네임스페이스와 겹치지 않는다
- 제안: 없음

### [WARNING] spec `§4.1` Integration 구현 action 명칭 — 본 커밋 이전 `§4.1` 은 `integration.create/update/delete`(현재 시제)를 열거했으나 코드·data-flow SoT 는 `integration.created/updated/deleted`(과거분사형)
- target 신규 식별자: `AUDIT_ACTIONS` 의 `INTEGRATION_CREATED`, `INTEGRATION_UPDATED`, `INTEGRATION_DELETED` 등 과거분사형 값이 코드 SoT 로 확정됨
- 기존 사용처: `spec/5-system/1-auth.md` line 350 (origin/main 기준) — `integration.create, integration.update, integration.delete` (현재 시제). 그러나 `spec/data-flow/1-audit.md §1.1`, `spec/2-navigation/4-integration.md:1105` 는 이미 과거분사형을 명시하고 있었음
- 상세: origin/main 의 `spec/5-system/1-auth.md §4.1` 이 현재 시제 표기를 유지하고 있어 `AUDIT_ACTIONS` const 값과 표면적 불일치가 있다. 단, **본 커밋(HEAD)의 spec 변경이 §4.1 을 과거분사형 + Planned 구분으로 교체**하므로 HEAD 에서는 해소된다. 검토 대상 diff 가 코드 영역만 발췌했으므로 이 충돌이 누락처럼 보일 수 있으나, `git show HEAD -- spec/5-system/1-auth.md` 확인 결과 동일 커밋에서 §4.1 이 정정됐음
- 제안: 코드 diff 외 spec 갱신이 함께 반영됐는지 PR 설명에 명시할 것을 권장 (리뷰어가 코드 diff 만 볼 경우 §4.1 불일치를 잔류 충돌로 오판할 수 있음)

### [INFO] spec `§4.1` Planned 액션 명칭 사전 충돌 여부
- target 신규 식별자: `AUDIT_ACTIONS` const 의 코멘트에 열거된 Planned action들 (`workflow.*`, `trigger.*`, `schedule.*`, `member.*`, `llm_config.*`, `rerank_config.*`, `password_change`, `2fa_*`)
- 기존 사용처: 코드베이스 어디에도 이 action 문자열들이 `audit_log` 에 실제로 적재된 사례 없음 (grep 0건). 현재 `AUDIT_ACTIONS` const 에 포함되지 않으므로 `AuditAction` union type 에서도 제외됨
- 상세: Planned action 들은 const 본체에 없고 JSDoc 코멘트에만 언급됨 — 타입 충돌 없음
- 제안: 없음

### [INFO] `audit-action.const.ts` 파일 경로 컨벤션
- target 신규 식별자: 파일 경로 `codebase/backend/src/modules/audit-logs/audit-action.const.ts`
- 기존 사용처: 동일 경로에 기존 파일 없음. `audit-logs/` 내 기존 파일은 `audit-logs.service.ts`, `audit-logs.controller.ts`, `audit-logs.module.ts`, `audit-logs.spec.ts`. `*.const.ts` suffix 는 다른 모듈(예: `executions/constants/` 등)의 패턴과 일관됨
- 상세: 파일명 충돌 없음, 컨벤션 위반 없음
- 제안: 없음

---

## 요약

이번 변경이 도입하는 신규 식별자(`AUDIT_ACTIONS` const, `AuditAction` type, `execution.re_run` action 값)는 기존 코드베이스·spec 전체에서 동일 이름으로 다른 의미로 사용된 사례가 없어 명칭 충돌이 없다. 유일한 주의 사항은 origin/main `spec/5-system/1-auth.md §4.1` 이 Integration action 명칭을 현재 시제(`integration.create/update/delete`)로 열거하던 것이 `AUDIT_ACTIONS` const 의 과거분사형 값과 표면적으로 어긋나 보이나, 동일 커밋 HEAD 에서 §4.1 이 과거분사형 + Planned 구분으로 정정됐으므로 충돌이 해소된 상태다. PR 리뷰어가 코드 diff 만 보는 경우를 위해 스펙 갱신을 PR 설명에 명시하는 것이 권장된다.

---

## 위험도

LOW
