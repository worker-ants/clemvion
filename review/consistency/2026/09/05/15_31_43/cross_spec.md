# Cross-Spec 일관성 검토 — spec/5-system (impl-done)

## 검토 범위와 실측

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
- **scope(`spec/5-system`) 파일 델타: 0** — 이 브랜치는 spec 을 바꾸지 않았다(정상, 코드 전용 PR).
- 프롬프트에 실린 실제 diff 는 예산 절단으로 생략돼 있어, 워킹트리에서 직접
  `git diff origin/main...HEAD` 로 code_areas 를 재확인했다. 관련 코드 변경은 8개 파일:
  - `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` / `audit-logs.spec.ts`
    — `GET /api/audit-logs` 의 `user` 서브필드를 `leftJoinAndSelect`(User 전 컬럼)에서
    `leftJoin + addSelect(['user.id','user.name','user.email'])` 로 좁힘. 기존
    `AuditLogUserDto`(id/name/email 3필드, 변경 없음) 선언과 런타임을 맞추는 **보안 수정**.
  - `codebase/backend/src/shared/testing/response-contract.ts`(신규) / `.spec.ts` — "응답
    1건 vs DTO 선언" 을 일반 대조하는 테스트 유틸리티. `spec/5-system/2-api-convention.md
    §5.4`(부재 표현 규칙)를 코드화.
  - `codebase/backend/test/{audit-logs,session-revocation,workflow-crud,workflow-execution}.e2e-spec.ts`
    — 위 유틸을 4개 기존 엔드포인트에 배선(각 1줄 계약 대조 + 감사 로그는 독립 캐너리 추가).

이 변경들은 spec 문언을 새로 정의하지 않고, 기존에 이미 선언된 DTO 계약(`AuditLogUserDto`)과
규약(§5.4)에 런타임/테스트를 맞추는 정합화 작업이다.

## 발견사항

### [INFO] `response-contract.ts` 가 `2-api-convention.md` 의 `code:` frontmatter 에 미등재

- target 위치: `spec/5-system/2-api-convention.md` frontmatter `code:` (§5.4 를 정의하는 문서)
- 충돌 대상: `codebase/backend/src/shared/testing/response-contract.ts` (신규 파일, §5.4 를
  **시행**하는 유일한 코드)
- 상세: `2-api-convention.md` 의 `code:` glob 에 이 파일이 걸리지 않는다. 즉 이후 이 파일이
  바뀌어도(예: §5.4 판정 로직이 완화·왜곡되는 방향으로) `--impl-done` 의
  SPEC-CONSISTENCY 게이트가 `2-api-convention.md` 를 재검토 대상으로 잡지 못한다 — 이 항목
  자체는 새 발견이 아니라 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
  developer 가 2026-09-05 이미 등재한 backlog(`planner` 트랙)다.
- 제안: 조치 불필요(이미 추적 중) — 이 검토는 그 backlog 를 옆에서 재확인만 한다. planner 가
  다음에 `spec/5-system/2-api-convention.md` 를 만질 때 `code:` 에
  `codebase/backend/src/shared/testing/response-contract.ts` 를 추가하는 것을 권고.

## 교차 확인한 항목 (충돌 없음)

- **데이터 모델**: `AuditLogListItem`(`Omit<AuditLog,'user'> & { user: Pick<User,'id'|'name'|'email'>|null }`)
  은 새 엔티티/필드를 선언하지 않는다. 기존 `AuditLogUserDto`(변경 없음)·
  `spec/1-data-model.md` 의 `User`/`AuditLog` 정의와 모순 없음.
- **API 계약**: 엔드포인트·HTTP method·wrapper 형태(`{ data, pagination }`) 변경 없음.
  `spec/data-flow/1-audit.md §2.1` 의 "응답에 actor `user` join 포함" 서술과도 상충하지
  않는다(필드 목록을 규정하지 않으므로).
- **요구사항 ID**: 신규 ID 없음.
- **상태 전이**: 해당 없음(상태 머신 변경 없음).
- **RBAC**: `@Roles('admin')` 그대로 — `spec/5-system/1-auth.md §4.2`("관리자(Admin+)만
  조회")·`spec/data-flow/1-audit.md §2.1` 과 일치. 오히려 이번 수정은 이 RBAC 경계 **안**에서
  과다 노출되던 자격증명 필드(`passwordHash`·`totpRecoveryCodes`·`passwordResetToken` 등)를
  제거해 §3(인가) 의도에 더 부합하게 좁힌 것.
- **계층 책임**: 신규 테스트 유틸은 `codebase/backend/src/shared/testing/`(백엔드 테스트 인프라)
  에 위치 — 프런트/채널 등 다른 계층 경계를 침범하지 않음.

## 요약

이번 diff(8개 파일)는 `spec/5-system/` 을 새로 정의하지 않고, 기존에 이미 문서화된
`AuditLogUserDto` 선언·§5.4 부재 표현 규약·RBAC(§4.2 Admin+)에 런타임과 테스트를 맞추는
보안 정합화 작업이다. Cross-spec 관점에서 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·
계층 책임 어느 축에서도 다른 영역과의 직접 모순은 발견되지 않았다. 유일하게 짚을 점은
§5.4 를 시행하는 신규 코드가 `2-api-convention.md` 의 `code:` frontmatter 에 아직 걸려 있지
않다는 커버리지 갭인데, 이는 developer 가 이미 plan 에 planner 트랙 backlog 로 등재해 둔
상태라 이 검토에서 새로 조치할 것은 없다.

## 위험도

LOW
