# 보안(Security) 리뷰 결과

## 발견사항

### [INFO] audit-logs 컨트롤러 — @Roles('admin') 가드 추가 (긍정적 변경)
- 위치: `codebase/backend/src/modules/audit-logs/audit-logs.controller.ts` L83
- 상세: 기존에 `@Roles` 데코레이터가 없어 전역 RolesGuard가 라우트를 통과시키는 보안 갭(V-03)이 수정됨. `@Roles('admin')` 추가로 Admin+ 한정 접근이 강제되며, RolesGuard가 멤버십 검증도 함께 수행하므로 X-Workspace-Id 위조에 의한 비멤버 열람도 차단.
- 제안: 양호. `@UseGuards(RolesGuard)`가 전역 또는 컨트롤러 레벨에서 실제로 적용되어 있는지 모듈 설정을 별도 확인 권장. 데코레이터만 존재하고 가드가 등록되지 않은 경우 무효화될 수 있음.

### [INFO] QueryAuditLogDto — userId 필드에 @IsUUID 검증 적용 (긍정적 변경)
- 위치: `codebase/backend/src/modules/audit-logs/dto/query-audit-log.dto.ts` L492
- 상세: userId 쿼리 파라미터에 `@IsUUID()` 검증자가 적용됨. 자유 문자열 입력을 UUID 형식으로 제한하여 ORM 파라미터 바인딩에 비정상 값이 전달되지 않도록 방어.
- 제안: 양호. TypeORM parameterized query(`al.user_id = :userId`)를 사용하므로 SQL 인젝션 위험 없음.

### [INFO] AuditLogsService — TypeORM 파라미터 바인딩으로 SQL 인젝션 방어 확인
- 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` L181-183
- 상세: userId 필터를 포함한 모든 where 절이 `:paramName` named parameter 방식으로 바인딩됨. 문자열 보간 없음.
- 제안: 양호.

### [INFO] getSortColumn — sort 컬럼 allowlist 화이트리스팅 적용 확인
- 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` L234-241
- 상세: sort 파라미터를 `Record<string, string>` allowlist로 검사하고 미허용 값은 `created_at` 기본값으로 폴백. 컬럼명 인젝션 방어 적절.
- 제안: 양호. 단, `orderBy`의 `order` 파라미터(`ASC`/`DESC`)에 대해서도 `'ASC' | 'DESC'` 타입 단언만 적용되어 있으므로 DTO 레벨에서 `@IsIn(['asc', 'desc'])` 검증이 있는지 확인 필요 (`PaginationQueryDto` 상속 DTO 범위).

### [WARNING] 초대 토큰 — raw 저장 정책의 위협 모델 재검토
- 위치: `spec/5-system/1-auth.md` Rationale §1.5.D (신규 추가 섹션)
- 상세: 이메일 인증·비밀번호 재설정 토큰은 SHA-256 해시 저장인 반면, 워크스페이스 초대 토큰은 raw 저장. spec의 Rationale §1.5.D가 이 결정을 정당화하고 있으나, DB 유출 시나리오에서 공격자가 초대 이메일과 토큰을 동시에 획득하면 "이메일 일치 강제" 방어가 우회될 수 있음. 공격자가 대상 사용자의 이메일 계정에 접근하지 못해도, 해당 초대 이메일 주소로 신규 가입하거나 기존 계정에서 이메일을 변경하는 시나리오가 존재하는지 검토 필요.
- 제안: 현재 설계에서 token 단독 lookup + 1회 사용 + 7일 만료가 위험을 완화하므로 즉각적인 취약점은 아님. 그러나 해시 저장으로의 전환 비용(lookup 방식 변경)이 크지 않다면 장기적으로 해시 저장 검토를 권장. 당장 차단 이슈는 아님.

### [INFO] notification secret rotation (C3 fix) — 평문을 config에 쓰지 않고 secret store rotate 경유
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` L734-750
- 상세: 기존 구현이 `signing.secret` 평문을 DB JSONB `config`에 기록하는 문제를 수정. 이제 `secrets.rotate(ref, workspaceId, secretV2)` 경유 후 `signing.secretRef`만 config에 저장하고 `delete updatedSigning.secret`으로 평문 키를 제거. SS-SE-01 준수 강화.
- 제안: 양호. `secrets.rotate`가 실패했을 때 예외가 상위로 전파되는지 확인 필요 — 실패 시 `notificationSecretV2`가 클리어되지 않아야 하며 재시도 idempotency가 유지되어야 함. 전체 파일 컨텍스트에서 `promoteRotatedNotificationSecrets`의 rotate 실패 처리가 별도 catch 없이 전파되는 구조이므로 스케줄러가 재시도를 커버할 수 있는지 확인 권장.

### [INFO] audit-log 레코드 — console.warn으로 실패 swallow 처리
- 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` L227-231
- 상세: `record()` 메서드가 감사 기록 실패를 `console.warn`으로 swallow. 의도적 설계(감사 로그 실패가 주 동작을 중단하지 않아야 함)이나, 에러 메시지(`err.message`)가 warn 로그로 노출됨. 실제 오류 내용(예: DB 연결 오류 세부 정보)에 민감 컨텍스트가 포함될 수 있으나, 서버 로그 레벨이므로 외부 노출이 아님.
- 제안: 서버 사이드 로그이므로 현재 수준 허용 가능. 단, 프로덕션 환경에서 로그 aggregation 시스템이 있는 경우 에러 내용에 PII가 포함되지 않는지 확인.

### [INFO] e2e 테스트 — 직접 DB INSERT로 감사 로그 시드
- 위치: `codebase/backend/test/audit-logs.e2e-spec.ts` L1619-1623
- 상세: `db.query(INSERT INTO audit_log ...)` 에 parameterized query(`$1, $2`)를 사용하여 SQL 인젝션 없음. 테스트 코드이나 패턴 자체는 안전.
- 제안: 양호.

### [INFO] 하드코딩된 시크릿 — 없음 확인
- 위치: 전체 변경 파일
- 상세: API 키, 비밀번호, 토큰이 코드에 하드코딩된 사례 없음. 테스트 코드의 UUID (`a3a3a3a3-1111-2222-3333-444444444444`)는 픽스처 식별자로 실제 시크릿 아님.
- 제안: 양호.

---

## 요약

이번 변경은 두 가지 보안 취약점을 수정하는 것이 핵심이다. (1) V-03: 감사 로그 API에 `@Roles('admin')` 가드를 추가하여 미인가 사용자의 감사 로그 열람을 차단하였고, userId 쿼리 필터는 `@IsUUID()` 검증으로 입력 값을 제한한다. TypeORM parameterized query 사용으로 SQL 인젝션 위험은 없다. (2) C3: notification secret rotation 승격 경로에서 평문을 DB config에 직접 기록하던 버그를 수정하여 secret store 경유 방식으로 전환, SS-SE-01을 준수한다. 초대 토큰의 raw 저장 정책은 spec에 Rationale이 추가되었으나 DB 유출 시나리오에서 장기적으로 해시 전환을 검토할 여지가 있다(현재 즉각 위협은 아님). 전반적으로 보안 방향이 올바르며 크리티컬 이슈는 없다.

## 위험도

LOW
