# Rationale 연속성 검토 결과

검토 대상: G-01/G-02 audit (rebase onto #542 후 재검) — `execution.re_run` + `AUDIT_ACTIONS` union + spec §4.1 구현

---

## 발견사항

### 발견 없음 — 모든 변경이 기존 Rationale 결정과 정합

이번 diff 는 다음 두 기존 Rationale 결정을 **이행(implementation)**하는 변경만 포함한다.

#### G-01: `AuditLogsService.record({ action })` 를 `AuditAction` union 으로 강제

- **근거 출처**: `spec/data-flow/1-audit.md ## Rationale` — "Action 은 application union 으로 강제(DB 는 자유 문자열)" 항. "새 action 은 const 에 추가하지 않으면 호출 자체가 컴파일되지 않는다 (cross-audit G-01)."
- **결정 내용**: DB CHECK 대신 application-level `AuditAction` union + `AUDIT_ACTIONS` const 를 SoT 로 삼아 인라인 임의 문자열을 금지. DB CHECK 를 쓰지 않는 이유도 명문화됨 (액션 추가가 잦아 마이그레이션 비용을 피하기 위함).
- **diff 행동**: `action: string` → `action: AuditAction` 타입 강화 + 각 call site 에서 리터럴 문자열 → `AUDIT_ACTIONS.*` 상수 치환. 이는 Rationale 가 결정한 방향의 직접 구현이며, 기각된 대안(인라인 문자열, DB CHECK) 을 재도입하지 않는다.

#### G-02: `re_run_initiated` → `execution.re_run` 개명

- **근거 출처**:
  - `spec/5-system/1-auth.md §4.1` — "`<resource>.<verb>` — resource dot-prefix 가 필수다 ... execution 은 `re_run` 을 쓴다."
  - `spec/data-flow/1-audit.md ## Rationale` — "과거 `re_run_initiated` 가 dot-prefix 를 이탈해 과거분사형 integration 액션과 혼재 적재됐으나, cross-audit G-02 에서 `execution.re_run` 으로 정정됐다."
  - `spec/5-system/13-replay-rerun.md §11` — `execution.re_run` 이 공식 action 으로 명시됨.
- **결정 내용**: naming 규약 `<resource>.<verb>` 를 합의 원칙으로 채택하고, `re_run_initiated` 를 규약 이탈로 판정해 `execution.re_run` 으로 정정하기로 결정함. 이 결정은 spec 과 Rationale 에 이미 명문화되어 있다.
- **diff 행동**: `executions.service.ts`, `executions-rerun.service.spec.ts`, `executions.service.spec.ts`, `executions.module.ts` 의 `re_run_initiated` → `AUDIT_ACTIONS.EXECUTION_RE_RUN` (`'execution.re_run'`) 치환. Rationale 결정의 코드 반영이며 기각된 대안(`re_run_initiated` 유지, 단일 표기 없이 혼재) 을 재도입하지 않는다.

#### `audit-log-response.dto.ts` example 값 정정

- `@ApiProperty({ example: 'workflow.update' })` → `'integration.updated'`, `'workflow'` → `'integration'`.
- naming 규약 (`<resource>.<verb>`, 과거분사형) 및 AUDIT_ACTIONS 실제 값과 일관성 있는 예시로 갱신. 기각된 대안 재도입 없음.

---

## 요약

이번 diff 는 `spec/data-flow/1-audit.md`, `spec/5-system/1-auth.md §4.1`, `spec/5-system/13-replay-rerun.md §11` 의 Rationale 에 이미 명문화된 두 결정(G-01: application union 강제 / G-02: `execution.re_run` 개명)을 코드로 이행하는 변경만 포함한다. 기각된 대안(인라인 문자열, `re_run_initiated` 유지, DB CHECK enum) 을 재도입하거나 합의된 invariant(`<resource>.<verb>` dot-prefix 필수, 인라인 문자열 금지) 를 우회하는 설계는 없다. Rationale 연속성 관점의 충돌이 없다.

---

## 위험도

NONE
