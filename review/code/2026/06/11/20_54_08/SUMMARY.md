# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `re_run_initiated` → `execution.re_run` DB 저장 값 변경에 대한 마이그레이션 문서·backfill 계획 부재, 테스트 계층에서 상수 미참조(인라인 문자열 잔존), `integration.updated`/`reauthorized` audit 경로 테스트 누락이 핵심 리스크. 보안·아키텍처·범위는 전원 NONE으로 변경 자체는 건전하다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 기존 테스트가 `AUDIT_ACTIONS` 상수 대신 raw 문자열 리터럴로 action 값을 검증 — 상수 값이 변경되어도 드리프트 미감지, SoT 단일화 효과 무력화 | `integrations.service.spec.ts` L920·1054·1236·1282·1437, `workspaces.service.spec.ts` L719, `auth-configs.service.spec.ts` L472 | 각 파일에 `import { AUDIT_ACTIONS } from '../audit-logs/audit-action.const'` 추가 후 `action: AUDIT_ACTIONS.*` 형식으로 교체 |
| 2 | Testing | `integration.updated` 및 `integration.reauthorized` audit action 검증 테스트 부재 — 서비스 코드에서 두 경로가 사용되지만 assert 없음 | `integrations.service.spec.ts` (해당 케이스 전무) | `update()`·`reauthorize()` 호출 후 `audit.record`가 각 상수로 호출됨을 검증하는 테스트 케이스 추가 |
| 3 | Documentation | `AuditLogDto.action` Swagger 문서에 허용 값 범위(`enum`) 없음 — API 소비자가 가능한 action 값을 알 수 없음 | `audit-log-response.dto.ts` L301 | `@ApiProperty({ example: 'integration.updated', enum: Object.values(AUDIT_ACTIONS), description: '...' })` 추가 또는 최소한 description 에 값 목록 링크 |
| 4 | Documentation / Side Effect | `re_run_initiated` → `execution.re_run` DB 저장 값 변경 — 기존 레코드와 신규 레코드 간 action 값 불일치, 마이그레이션 문서·backfill SQL 부재 | `executions.service.ts` audit record 호출부 | plan 또는 spec 감사 로그 섹션에 "레거시 값 `re_run_initiated`는 OR 조건 처리 필요" 노트 추가; 필요 시 backfill 마이그레이션 스크립트 작성 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `AuthConfigsService` CRUD 메서드(`create/update/remove/regenerate`)에 `userId` 파라미터 없어 audit 기록 추가 불가 — 기존 기술부채, `plan/in-progress/auth-config-webhook-followups.md` backlog 등재됨 | `auth-configs.service.ts` L452–L514 | 추후 `userId` 추가 + `AUDIT_ACTIONS.AUTH_CONFIG_CREATE` 등 상수 선추가 |
| 2 | Maintainability | 테스트 파일이 `action: 'execution.re_run'` raw 문자열 사용 — 현재는 정확하나 장기 드리프트 위험 | `executions-rerun.service.spec.ts` L982·985 | `AUDIT_ACTIONS.EXECUTION_RE_RUN` 상수 참조로 교체 |
| 3 | Maintainability | 응답 DTO `action: string` 느슨한 타입 — OpenAPI schema 에 union 값이 드러나지 않음 | `audit-log-response.dto.ts` L301 | `action: AuditAction` + `@ApiProperty({ enum: ... })` (WARNING #3 과 동일 조치) |
| 4 | Maintainability | `auth-configs.service.ts` 에 `crypto` 이중 import 혼용 (`import * as crypto` + named `randomBytes`) | `auth-configs.service.ts` L362–363 | named import 또는 namespace import 중 하나로 통일 |
| 5 | Maintainability | `create`/`regenerate` 메서드에 secret 생성 로직 중복 | `auth-configs.service.ts` L462–509 | `private generateSecret(type)` 헬퍼 추출 |
| 6 | Maintainability | `limit = 20` 매직 숫자 여러 곳 반복 | `audit-logs.service.ts` L155, `auth-configs.service.ts` findAll | 공통 `DEFAULT_PAGE_SIZE` 상수로 일원화 |
| 7 | Maintainability | `serviceWithRealAudit` 생성자 인자 수 불일치 (`workspaces` 누락) | `executions-rerun.service.spec.ts` L1243–1251 | `workspaces as never` 명시적으로 포함 |
| 8 | Documentation | Planned 액션 목록 주석이 수동 동기화 — spec 변경 시 const 주석이 stale 될 위험 | `audit-action.const.ts` L45–47 | 주석에 "구현 시 spec §4.1 Planned 항목을 본 const 와 독스트링에 동시 추가" 절차 명시 |
| 9 | Requirement | `AuditLogDto.action` 타입 `string` 유지 — 응답 레이어 타입 좁히기 미적용 (현 변경 범위 외) | `audit-log-response.dto.ts` L302 | 향후 `@IsIn(Object.values(AUDIT_ACTIONS))` 검증 또는 `AuditAction` 좁히기 고려 |
| 10 | Security | `AUDIT_ACTIONS` 상수화로 `AuditAction` union 강제 → 컴파일 타임에 임의 action 문자열 삽입 차단 (긍정적 변경) | `audit-action.const.ts` + `audit-logs.service.ts` L207 | 없음 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 리팩토링, 신규 취약점 없음. `AuditAction` union 강제로 보안 개선 |
| architecture | NONE | 단방향 의존, 단일 책임, 개방-폐쇄 원칙 모두 충족. 구조적 갭(CRUD `userId` 누락)은 기존 기술부채 |
| requirement | NONE | spec §4.1 과 const 값 전수 일치. Planned action 누락은 의도된 상태 |
| scope | NONE | 10개 파일 전체가 G-01·G-02 목표 내에 수렴, 범위 이탈 없음 |
| side_effect | LOW | `re_run_initiated` → `execution.re_run` DB 값 불일치(기존 레코드·신규 레코드 혼재), backfill 필요 여부 검토 필요 |
| maintainability | LOW | 테스트 raw 문자열 잔존, DTO `string` 타입 느슨함, crypto 이중 import 등 위생 이슈 다수. 치명적 문제 없음 |
| testing | MEDIUM | 기존 테스트 raw 문자열 미교체 + `integration.updated`·`reauthorized` 테스트 부재 |
| documentation | MEDIUM | Swagger enum 미문서화, `re_run_initiated` 값 변경 마이그레이션 노트 부재 |

---

## 발견 없는 에이전트

- **security**: Critical/Warning 발견사항 없음 (NONE)
- **architecture**: Critical/Warning 발견사항 없음 (NONE)
- **requirement**: Critical/Warning 발견사항 없음 (NONE)
- **scope**: Critical/Warning 발견사항 없음 (NONE)

---

## 권장 조치사항

1. **(우선 HIGH)** `re_run_initiated` → `execution.re_run` DB 값 불일치 대응 — plan 문서 또는 spec 감사 로그 섹션에 레거시 값 OR 조회 주의사항 추가, 필요 시 backfill SQL 작성 (side_effect WARNING #4, documentation WARNING #4 통합)
2. **(우선 HIGH)** 기존 테스트 raw 문자열 → `AUDIT_ACTIONS` 상수 참조로 일괄 교체 — `integrations.service.spec.ts`, `workspaces.service.spec.ts`, `auth-configs.service.spec.ts`, `executions-rerun.service.spec.ts` (testing WARNING #1)
3. **(우선 MEDIUM)** `integration.updated`·`integration.reauthorized` audit 경로 테스트 케이스 추가 (testing WARNING #2)
4. **(우선 MEDIUM)** `AuditLogDto.action` Swagger 문서에 `enum: Object.values(AUDIT_ACTIONS)` 추가 (documentation WARNING #3)
5. **(우선 LOW)** `auth-configs.service.ts` crypto 이중 import 통일, `generateSecret` 헬퍼 추출 (maintainability INFO)
6. **(우선 LOW)** `executions-rerun.service.spec.ts` `serviceWithRealAudit` 생성자에 `workspaces as never` 누락 보완 (maintainability INFO #7)
7. **(우선 LOW)** `audit-action.const.ts` 독스트링에 Planned 항목 갱신 절차 한 줄 추가 (documentation INFO #8)

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행** (8명, 전원 강제 포함): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`
- **강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (6명):

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 제외 (변경이 상수화 리팩토링으로 성능 영향 없음으로 판단) |
| dependency | 라우터 제외 |
| database | 라우터 제외 |
| concurrency | 라우터 제외 |
| api_contract | 라우터 제외 |
| user_guide_sync | 라우터 제외 |