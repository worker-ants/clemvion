# Cross-Spec 일관성 검토 — `user-entity-column-defense`

검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
`spec/5-system/` 자체의 델타는 0(코드 전용 PR). 아래는 diff(12파일/1562+334줄, 코드+plan+CHANGELOG)가
`spec/**` 다른 영역의 기존 서술과 충돌하는지를 검토한 결과다.

## 발견사항

- **[WARNING]** §5.4 "두 검증자" 서술이 이번 diff 의 신규 코드로 이미 반증됨
  - target 위치: 코드 diff — `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`(신규, 구조 축) · `codebase/backend/src/shared/testing/user-secret-absence.ts`(신규, 이름 축). 두 파일 모두 `spec/5-system/` 델타에는 없다(스코프 밖 코드 변경).
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.4 "검증 층" (227~238행) — *"그 자리를 **두 검증자**가 나눠 맡는다"* + 정확히 2행짜리 표(`swagger-dto-contract-guard.ts` / `response-contract.ts`). 동일 문장이 `spec/conventions/swagger.md` §5-1(371행) *"두 검증자의 경계는 … 이 소유한다"* 에도 있음.
  - 상세: 이번 PR 이 만든 두 신규 검증자(`user-entity-exposure-guard.ts`, `user-secret-absence.ts`)는 §5.4 표가 다루는 "선언↔선언"·"값↔선언" 축과 다른 **세 번째(구조: TypeORM 관계 투영 여부)·네 번째(이름: 응답 본문 전체에서 민감 컬럼명 부재) 축**이다. 두 파일 모두 `spec/5-system/2-api-convention.md`·`spec/conventions/swagger.md` 어느 쪽 frontmatter `code:` 글롭에도 걸리지 않음을 직접 확인했다(두 spec 파일의 `code:` 는 `swagger-dto-contract*.ts`/`response-contract*.ts`/`swagger-probe*.ts` 정확 매치 패턴뿐, `repo-guards/__tests__/user-entity-exposure*` 나 `shared/testing/user-secret-absence*` 를 포함하지 않음). 즉 (a) "두 검증자" 라는 개수 서술이 지금 시점에 거짓이고, (b) 이 두 신규 가드를 약화·삭제해도 `--impl-done` SPEC-CONSISTENCY 게이트가 걸리지 않는 사각지대가 생겼다.
  - 제안: `spec/5-system/2-api-convention.md` §5.4 검증 층 표에 두 축을 추가 행으로 등재하고 "두 검증자" 개수 서술을 개수 대신 나열형으로 고친다(같은 문서가 이미 개수-드리프트를 두 번 겪었다는 점을 스스로 지적하므로 숫자 재기입은 피할 것). `spec/conventions/swagger.md` §5-1 의 대응 문장도 함께. 두 spec 의 `code:` 에 신규 파일 패턴을 추가. 이 항목은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 대상 후속 항목으로 등재돼 있으나(§"신규 검출 2축을 §5.4…"), **spec 본문 자체는 아직 고쳐지지 않았으므로** 현재 checked-in 상태 기준으로는 살아있는 모순이다.

- **[WARNING]** `User` 민감 컬럼의 응답 노출 금지가 spec 에 명문화되지 않아 형제 도메인과 비대칭
  - target 위치: 코드 diff 신규 상수 `USER_SECRET_KEYS`(`codebase/backend/src/shared/testing/user-secret-absence.ts`) — `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken` 7개(값 자체는 `spec/1-data-model.md` §2.1 User 필드 목록과 정확히 대응해 데이터 모델과의 필드 매핑 자체는 문제 없음).
  - 충돌 대상: `spec/conventions/secret-store.md` §1(AuthConfig/Trigger 비대상 예외 서술 — "비대상이어도 근거를 따로 세운다" 식으로 필드 단위 노출 정책을 문서화하는 관행) vs `spec/1-data-model.md` §2.1 User(민감 컬럼에 상응하는 노출 금지 규범 문장 없음).
  - 상세: Trigger·AuthConfig 계열 시크릿은 `secret-store.md` 가 스킴·비대상 예외·근거를 명문 규범으로 갖는 반면, `User` 의 7개 민감 컬럼은 이번 PR 이 코드 레벨 검출기(`USER_SECRET_KEYS` 배열)로만 방어선을 세웠고, 이 불변식의 SoT 를 선언하는 spec 문장이 `1-data-model.md`/`secret-store.md` 어디에도 없다. `select:false`·`@Exclude()`·전역 시리얼라이저를 모두 채택하지 않기로 한 설계 결정(구조 근거는 diff 주석·CHANGELOG 에 있음)도 spec `## Rationale` 이 아니라 `plan/`·`CHANGELOG.md` 에만 남아 있어, 이 영역만 "코드가 스펙" 상태로 남는다.
  - 제안: `spec/1-data-model.md §2.1` 또는 `secret-store.md §1.1` 에 "User 민감 7컬럼은 응답 바디 어디에도 노출되지 않는다" 규범 문장을 추가하고 `code:` 로 신규 두 가드 파일을 연결한다. 이 항목도 동일 plan 파일에 planner 대상으로 이미 등재돼 있음(§"`User` 민감 7컬럼의 응답 노출 금지를 규약 문장으로") — 등재만 됐고 spec 반영은 아직.

- **[INFO]** `workspace-rbac.e2e-spec.ts` 파일 헤더의 `spec/5-system/1-auth.md §1.3` 참조가 RBAC 절과 어긋남 (이번 diff 밖, 참고용)
  - target 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` 20행 파일 헤더 주석 — 이번 diff 는 이 파일에 신규 테스트(J)만 추가했고 헤더 자체는 건드리지 않았다.
  - 충돌 대상: 현재 `1-auth.md` §1.3 은 "셀프 호스팅 추가 인증(LDAP/SAML, 미구현)" 이고, RBAC 매트릭스는 §3.1/§3.2 다.
  - 상세: 이번 PR 이 이 파일에 새 RBAC/노출 방지 테스트(J)를 추가하면서 파일 상단의 오래된 `§1.3` 포인터를 그대로 두어, 신규 리더가 그 포인터를 따라가면 엉뚱한 절(셀프 호스팅 인증)을 보게 된다. 이번 PR 이 만든 결함은 아니지만 이 파일을 건드린 김에 정정 대상.
  - 제안: 다음에 이 파일을 편집할 때 헤더의 `§1.3` → `§3` 로 정정 (scope 이탈 방지 차원에서 이번 PR 필수 항목은 아님).

## 요약

이번 PR 은 `spec/5-system/` 문서 자체를 바꾸지 않은 코드 전용 방어 강화(User 엔티티 민감 컬럼의 응답 유출 검출)이며, 새로 도입한 투영·DTO 필드(`WorkflowVersionListItem`/`Detail.creator`, `WorkspaceMemberDto.joinedAt`)는 `spec/1-data-model.md`(User·WorkspaceMember 필드 정의)·`spec/5-system/2-api-convention.md` §5.4(null vs 키 생략 기본형 규칙)·`spec/3-workflow-editor/5-version-history.md` §7 과 모두 정합적이다. 다만 이번 diff 가 새로 들여온 두 개의 검출 축(구조 축·이름 축)이 `spec/5-system/2-api-convention.md` §5.4 및 `spec/conventions/swagger.md` §5-1 이 못박은 "두 검증자" 서술을 현재 시점에 사실과 다르게 만들었고, 두 신규 가드 파일이 어느 spec 의 `code:` 글롭에도 걸리지 않아 향후 이 가드가 약화돼도 SPEC-CONSISTENCY 게이트가 못 잡는 사각지대가 생겼다. 또한 `User` 민감 컬럼 노출 금지 불변식이 형제 도메인(Trigger/AuthConfig)과 달리 spec 규범 문장 없이 코드에만 존재한다. 두 사항 모두 PR 작성자가 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 대상 후속 항목으로 이미 등재해 두었으나, spec 본문 자체는 아직 갱신되지 않았으므로 현재 checked-in 상태 기준으로는 실재하는 cross-spec drift 다.

## 위험도

MEDIUM — CRITICAL 급 모순은 없음(코드가 spec 을 어긴 것이 아니라, spec 의 서술이 코드에 뒤처짐). 두 WARNING 은 이미 plan 에 planner 턴 대상으로 등재돼 있어 즉시 차단 사유는 아니나, `spec/5-system/2-api-convention.md`·`spec/conventions/swagger.md` 의 "두 검증자" 문장은 현재 거짓 진술이므로 다음 planner 턴에서 반드시 정정 필요.
