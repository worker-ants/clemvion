# Code Review 통합 보고서

## 전체 위험도
**LOW** — 두 보안 픽스(V-03 audit-logs Admin+ 가드, C3 notification secret rotation 무효)가 의도대로 구현됐다. Critical 이슈 없음. WARNING 3건(초대 토큰 raw 저장 위협 모델, notification config 부재 trigger 의 v2 평문 잔류, 테스트 모듈 설정 중복)은 운영 즉각 위협이 아니며 개선 권고 수준이다. SPEC-DRIFT 2건은 spec 텍스트 갱신 누락으로 코드 revert 없이 spec 수정으로 해소한다.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 초대 토큰 raw 저장 정책 — DB 유출 시 공격자가 대상 이메일로 가입·변경 후 토큰 사용 시나리오 잔존. 현재 1회 사용 + 7일 만료 + token 단독 lookup 이 완화하므로 즉각 취약점 아님. | `spec/5-system/1-auth.md` Rationale §1.5.D | 장기적으로 해시 저장 전환 검토. 당장 차단 이슈 아님. |
| 2 | Side Effect | `promoteRotatedNotificationSecrets` — notification config 없는 trigger 에 v2 컬럼이 채워진 비정상 데이터가 존재할 경우, 매 cron 주기마다 skip 되어 `notification_secret_v2` 평문이 DB 에 영구 잔류. 정상 운영 경로에서 발현 가능성 낮음. | `codebase/backend/src/modules/triggers/triggers.service.ts` — `promoteRotatedNotificationSecrets` 루프 | `continue` 전에 v2/rotatedAt 컬럼 null 클리어 + save 수행하거나, 최소 경고 로그 추가. |
| 3 | Maintainability | `triggers.service.spec.ts` 신규 describe 블록 — 기존 테스트 파일의 모듈 프로바이더 설정을 거의 동일하게 중복 작성. 향후 프로바이더 변경 시 한쪽 누락 위험. | `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (신규 describe 블록 L582–638 부근) | 공통 프로바이더 설정을 `createBaseProviders()` 헬퍼로 추출하거나 기존 `beforeEach` 재사용. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/data-flow/15-external-interaction.md` §3.3 상태 전이 마지막 줄에 구 갭 참조 `` `v2 승격·클리어` (§1.5 구현 갭 주의 포함). `` 가 잔류. C3 fix 로 갭 해소됐으나 §3.3 텍스트 갱신 누락. | `spec/data-flow/15-external-interaction.md` 라인 283 | 코드 유지 + §3.3 텍스트를 `` `v2 승격·클리어`. `` (갭 주의 문구 제거)로 갱신. |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/data-flow/15-external-interaction.md` §Rationale "§1.5 구현 갭을 본문에 남긴 이유" 가 현재 시제로 기술되어 C3 fix 후 역사 서술이 됨. | `spec/data-flow/15-external-interaction.md` 라인 324–329 | 코드 유지 + 해당 Rationale 섹션을 "2026-06-10 C3 해소" 사실로 갱신하거나 과거 시제로 전환. |
| 3 | Documentation | `AuditLogsController.findAll` — `@ApiForbiddenResponse` Swagger 선언 누락. `@Roles('admin')` 적용 시 403 반환되나 Swagger 문서에 403 응답 미등록. 기능 동작 영향 없음. | `codebase/backend/src/modules/audit-logs/audit-logs.controller.ts` `findAll` 핸들러 | `@ApiForbiddenResponse({ description: '권한 부족 (Admin 미만) 또는 비멤버' })` 추가. |
| 4 | Security | `getSortColumn` — `order` 파라미터(`ASC`/`DESC`)에 DTO 레벨 `@IsIn` 검증이 있는지 확인 필요. 컬럼명은 allowlist 처리 양호. | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` L234–241 | `PaginationQueryDto` 상속 DTO 에 `@IsIn(['asc','desc'])` 검증 여부 확인. |
| 5 | Security | `notification secret rotation (C3)` — `secrets.rotate` 실패 시 예외가 호출자(BullMQ job)로 전파되는 구조. 실패 후 v2 잔류로 재시도 idempotency 는 유지되나, 스케줄러 재시도 정책이 커버하는지 명시 문서 없음. | `codebase/backend/src/modules/triggers/triggers.service.ts` L734–750 | JSDoc 에 "secret store rotate 실패 시 예외 전파로 job retry 유도" 의도 명시. |
| 6 | Maintainability | `AuditLogsService.record` 에서만 `console.warn` 사용 — 코드베이스 전반이 NestJS `Logger` 사용하는 것과 불일치. | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` L228–231 | `private readonly logger = new Logger(AuditLogsService.name)` 추가 후 `this.logger.warn(...)` 교체. |
| 7 | Maintainability | `AuditLogsService.getSortColumn` — `allowed` 객체 키·값이 동일 문자열 중복 표현. | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` L235–240 | `Set<string>` 으로 교체하고 `SORT_ALLOWLIST` 상수 추출. |
| 8 | Maintainability | `normalizeNotificationSecretRef` 와 `promoteRotatedNotificationSecrets` 가 동일한 canonical ref 생성 파라미터를 분산 보유. 향후 한쪽만 수정하는 실수 위험. | `codebase/backend/src/modules/triggers/triggers.service.ts` L1220–1225, L734–738 | `private notificationSigningRef(triggerId: string)` 헬퍼 추출. |
| 9 | Maintainability | `triggers.service.spec.ts` 에서 `as never` 타입 단언으로 TypeScript 타입 검사 우회. DTO 변경 시 컴파일 오류로 감지 불가. | `codebase/backend/src/modules/triggers/triggers.service.spec.ts` L323–325, L331 | `Partial<QueryAuditLogDto>` 등 정확한 타입 단언 사용. |
| 10 | Scope | `spec/1-data-model.md` User 테이블 필드 10개 추가 — V-03/C3와 직접 무관하나, `--impl-prep` Critical 차단 해소 요건이므로 규약 내 허용 범위. 별도 커밋 분리 시 traceability 향상. | `spec/1-data-model.md` §2.1 User 테이블 | 향후 drift 수정은 독립 커밋으로 분리 권장. |
| 11 | Documentation | `spec/data-flow/1-audit.md` §2.1 본문에 변경 날짜(`2026-06-10 V-03 갭 해소`) 인라인 기재 — 다른 spec 스타일과 불일치. spec 은 현재 상태 기술, 이력은 git/plan 이 담당. | `spec/data-flow/1-audit.md` §2.1 마지막 줄 | 인라인 날짜 텍스트 제거 또는 Rationale 섹션 참조로 대체. |
| 12 | Documentation | `plan/in-progress/security-fixes-audit-guard-secret-rotation.md` frontmatter `spec_impact` 에 `spec/1-data-model.md` 와 `spec/5-system/1-auth.md` 누락. | `plan/in-progress/security-fixes-audit-guard-secret-rotation.md` frontmatter | `spec_impact` 목록에 두 파일 추가. |
| 13 | Documentation | `AuditLogsService.findAll` JSDoc 전무. `userId` 필터 추가로 파라미터 의미가 확장됐으나 주석 없음. | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` `findAll` 메서드 | 한 줄 JSDoc 추가 — 필터 종류·Admin+ 전용 명시. |
| 14 | Side Effect | e2e 테스트 `beforeAll` 직접 INSERT 후 `afterAll` 에서 cleanup 없음. 동일 DB 재사용 환경에서 시드 누적 위험. | `codebase/backend/test/audit-logs.e2e-spec.ts` `beforeAll`/`afterAll` | per-run schema isolation 보장 시 현재 구조 충분. 아닌 경우 `afterAll` 에 DELETE 추가. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | V-03·C3 보안 수정 방향 올바름. 초대 토큰 raw 저장 장기 검토 권고(WARNING). |
| requirement | LOW | V-03·C3 요구사항 완전 구현. SPEC-DRIFT 2건(spec 텍스트 후처리 누락)·Swagger 403 누락(INFO) 잔류. |
| scope | LOW | 변경 범위 의도 내. User 필드 추가는 --impl-prep 게이트 해소 목적으로 규약 내 허용. |
| side_effect | LOW | notification config 부재 trigger 의 v2 평문 잔류 가능성(WARNING). 정상 운영 경로 발현 가능성 낮음. |
| maintainability | LOW | console.warn 불일치, 테스트 모듈 설정 중복(WARNING), ref 생성 로직 분산 등 개선 여지. |
| testing | 재시도 필요 | output_file(`testing.md`) 디스크에 부재 — 결과 읽기 불가. |
| documentation | LOW | spec 본문 날짜 인라인 기재, plan spec_impact 누락, findAll JSDoc 부재 등 소규모 개선 여지. |

---

## 발견 없는 에이전트

없음 (모든 결과 수신 에이전트에 발견사항 존재).

---

## 권장 조치사항

1. **[spec 수정] SPEC-DRIFT 2건 해소** — `spec/data-flow/15-external-interaction.md` §3.3 갭 주의 문구 제거 + §Rationale 섹션 과거 시제/C3 해소 날짜로 갱신. 코드 revert 없이 spec 편집으로 종결.
2. **[코드 수정] `promoteRotatedNotificationSecrets` notification config 부재 skip 경로** — `continue` 전에 v2/rotatedAt null 클리어 + save 수행 또는 경고 로그 추가.
3. **[코드 수정] `AuditLogsController.findAll`** — `@ApiForbiddenResponse` Swagger 데코레이터 추가.
4. **[코드 수정] `AuditLogsService.record`** — `console.warn` → `this.logger.warn` (NestJS Logger 일관성).
5. **[테스트 수정] `triggers.service.spec.ts`** — 신규 describe 블록 프로바이더 설정 중복 제거 (헬퍼 추출 또는 기존 beforeEach 재사용).
6. **[문서 수정] `plan/in-progress/security-fixes-audit-guard-secret-rotation.md`** — frontmatter `spec_impact` 에 `spec/1-data-model.md`, `spec/5-system/1-auth.md` 추가.
7. **[코드 수정] `triggers.service.ts`** — `notificationSigningRef` private 헬퍼 추출로 ref 생성 파라미터 단일화.
8. **[문서 수정] `spec/data-flow/1-audit.md`** — §2.1 본문 인라인 날짜 텍스트 제거 또는 Rationale 참조 대체.
9. **[테스트 수정] `triggers.service.spec.ts`** — `as never` 타입 단언 → `Partial<QueryAuditLogDto>` 등 정확한 타입으로 교체.
10. **[장기] 초대 토큰 해시 저장 검토** — 즉각 취약점 아니나 DB 유출 시나리오 위험 완화를 위해 별도 plan 백로그 등록 권장.

---

## 라우터 결정

라우터가 reviewer 를 선별(`routing=done`)함.

- **실행 (강제 포함)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명 — 전원 router_safety 강제 포함)
- **제외**: 7명

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |

**강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (전원 강제 포함)

> 비고: `testing` reviewer 는 manifest 에 `status=success` 로 기록됐으나 output_file(`testing.md`)이 디스크에 존재하지 않아 결과를 읽을 수 없었음 — "재시도 필요" 처리.