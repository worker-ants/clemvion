# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] AuditLogsService.record — action 파라미터 타입 강화 (string → AuditAction)

- 위치: `audit-logs.service.ts` L72–L124
- 상세: `record({ action })` 의 `action` 타입이 자유 문자열 `string` 에서 `AuditAction` union 으로 좁혀졌다. 이는 **의도된 breaking change** 이며, 모든 기존 call site(9개)는 동일 PR 에서 `AUDIT_ACTIONS.*` 상수로 전환되어 컴파일 에러 없이 대응 완료. 레거시 DB 행(`re_run_initiated`)은 수정 없이 보존된다고 명확히 문서화되어 있다.
- 부작용 리스크: 이번 변경에 포함되지 않은 **미발견 call site**가 있다면 런타임이 아닌 컴파일 단계에서 TypeScript 오류가 발생해 조기 탐지된다. 런타임 부작용 없음. DB 스키마 변경 없음.
- 제안: 현재 9개 call site 전환이 완전한지 `grep -rn 'auditLogsService.record\|AuditLogsService.*record' codebase/backend/src` 로 한 번 더 확인 권장. 이미 타입 강제로 누락 시 빌드 실패하므로 CI 가드는 충분.

---

### [INFO] AUDIT_ACTIONS 상수 — 새 module-level const 도입

- 위치: `audit-action.const.ts` (신규 파일)
- 상세: `AUDIT_ACTIONS` 를 `as const` 로 선언해 값의 불변성을 보장한다. 전역 변수가 아닌 ES 모듈 export 이므로 전역 네임스페이스 오염 없음. 사이드이펙트 없는 순수 const 선언.
- 부작용 리스크: 없음.

---

### [INFO] action 문자열 값 변경 — 're_run_initiated' → 'execution.re_run'

- 위치: `executions.service.ts` L419, `executions-rerun.service.spec.ts` L827, `executions.module.ts` 주석, `executions.service.spec.ts` 주석
- 상세: 새로 INSERT 되는 `audit_log` 행의 `action` 컬럼 값이 `'re_run_initiated'` 에서 `'execution.re_run'` 으로 변경된다. DB 에 이미 적재된 과거 행은 **불변** — 이 점은 spec(data-flow/1-audit.md)과 주석에 명시되어 있다. 그러나 이 변경은 **외부 관찰 가능한 행동 변화**다:
  - `GET /audit-logs?action=re_run_initiated` 로 필터링하던 클라이언트는 신규 행을 더 이상 받지 못한다.
  - `GET /audit-logs?action=execution.re_run` 으로 필터링하면 과거 행을 볼 수 없다.
  - 즉, 마이그레이션 없이 단순 코드 변경이라 **두 action 값이 DB 에 혼재**하는 불연속 구간이 발생한다.
- 제안: 필터·쿼리 클라이언트(프론트엔드 등)가 `re_run_initiated` 문자열을 UI 에서 하드코딩하거나 쿼리 파라미터로 전달하는지 확인 필요. 내부 관리 도구나 알림 규칙이 특정 action 값을 구독한다면 추가 대응이 필요하다. 현재 이 PR 의 범위에서 프론트엔드 변경이 포함되었는지 별도 확인 권장.

---

### [INFO] AuditLogDto `@ApiProperty({ example })` 변경

- 위치: `audit-log-response.dto.ts` L259, L263
- 상세: Swagger 문서의 `example` 값이 `'workflow.update'` → `'integration.updated'`, `'workflow'` → `'integration'` 으로 변경. 실제 런타임 동작·API 계약·타입에는 영향 없음 — 순수 OpenAPI 스펙 문서 변경.
- 부작용 리스크: 없음.

---

### [INFO] 감사 로그 기록 시점 — 트랜잭션 외부 (workspaces.service.ts)

- 위치: `workspaces.service.ts` L2756–L2763
- 상세: `transferOwnership` 은 트랜잭션 커밋 이후 `auditLogsService.record()` 를 호출한다. 이는 이전 코드도 동일한 구조이며, 이번 변경은 action 문자열을 상수로 교체한 것뿐이다. 트랜잭션 외부 audit 기록이라는 설계는 변경되지 않았고, 실패 swallow 계약도 동일하다.
- 부작용 리스크: 이번 변경으로 인한 신규 부작용 없음.

---

### [INFO] 테스트 파일 action 문자열 갱신

- 위치: `executions-rerun.service.spec.ts` L827, `executions.service.spec.ts` L1409
- 상세: 테스트의 `expect` 단언과 주석 문자열을 새 action 값에 맞게 갱신했다. 테스트 동작 외의 부작용 없음.

---

### [INFO] spec·plan 문서 변경

- 위치: `spec/5-system/1-auth.md`, `spec/5-system/13-replay-rerun.md`, `spec/data-flow/1-audit.md`, `plan/in-progress/spec-code-cross-audit-2026-06-10.md`
- 상세: 문서 전용 변경. 런타임·API·DB 에 직접적인 부작용 없음.

---

## 요약

이번 변경은 인라인 문자열로 흩어져 있던 audit action 값들을 `AUDIT_ACTIONS` const union 으로 중앙화하고, `'re_run_initiated'` 를 `'execution.re_run'` 으로 개명하는 코드 위생 작업이다. 전역 변수 도입·파일시스템 부작용·환경 변수 조작·의도치 않은 네트워크 호출·이벤트 구조 변경은 없다. `AuditLogsService.record` 의 `action: string → AuditAction` 시그니처 변경은 이미 모든 9개 call site 가 동일 PR 내에서 일괄 전환되었으므로 런타임 회귀 없이 컴파일 단계에서 가드된다. 유일하게 주의할 실질적 부작용은 DB `audit_log.action` 값의 이중화(`re_run_initiated` 과거 행 + `execution.re_run` 신규 행 혼재)로, 해당 컬럼 값을 기준으로 필터·알림·BI 쿼리를 운영하는 시스템이 있다면 대응이 필요하다. 그러나 이는 이번 변경의 의도된 trade-off 이고 spec 과 코드 주석에 명문화되어 있으므로 미지의 부작용이 아닌 관리된 결정이다.

## 위험도

LOW
