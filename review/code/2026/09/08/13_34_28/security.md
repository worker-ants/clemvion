# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** 전역 예외 필터의 unique-violation 판정 범위 확대 — 정보 노출 방지는 유지된 채 마스킹 로직만 SoT(`pg-error.ts`)로 일원화
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:12`(import), `:70`(`isPostgresUniqueViolation(exception)`)
  - 상세: 종전 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 먼저 요구해 raw 표면(`err.code`) 23505 를 놓치고 500 `INTERNAL_ERROR` 로 떨어뜨렸다. 신설 `isPostgresUniqueViolation`/`pgErrorConstraint`(`codebase/backend/src/common/db/pg-error.ts:18-47`)는 `err.code ?? err.driverError?.code` 두 표면을 함께 보므로 매핑 대상이 넓어진다. 다만 클라이언트 응답 `message` 는 여전히 고정 문구(`'Resource already exists or has been modified concurrently.'`, `http-exception.filter.ts:75`)이고 DB 드라이버 원문(제약명·SQL·`duplicate key value` 등)은 echo 되지 않는다 — CWE-209 마스킹 계약이 그대로 유지된다. 신규 e2e(`webhook-trigger.e2e-spec.ts:181-213`)가 `JSON.stringify(dup.body)` 에 `'duplicate key'` 부재를 명시적으로 단언해 이 계약을 실 DB 경로로 고정했다. 상태 코드가 500→409 로 넓어지는 동작 변경 자체는 계약 강화이지 취약점이 아니다.
  - 제안: 조치 불요. (참고: 이 분기에는 `mapHttpErrorLike`/미매핑 `Error` 분기와 달리 `logger.warn`/`logger.error` 호출이 없어 운영 가시성이 다소 떨어지지만, 이는 보안 결함이 아니라 관측성 이슈이므로 별도 트랙에서 검토할 사안이다.)

- **[INFO]** `WorkspacesService.listMembers` — `User` 민감 컬럼 노출을 DB 레벨 `select` 투영으로 강제(검출→방어 승격)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232`
  - 상세: 종전에는 `relations: ['user']` 로 `User` 전 컬럼(비밀번호 해시 등 민감 7컬럼 포함, `spec/1-data-model.md §2.1.1`)을 로드한 뒤 JS 단 `.map` 으로 6키만 골랐다. `user-entity-exposure-guard` 는 *로드 형태*만 검사하므로 이 자리는 방어가 "검출"(안전망은 e2e `workspace-rbac` J. 단 하나)에 그쳤고, `.map` 매핑이 넓어져도(`...m.user` 스프레드 등) 가드는 통과했을 것이다. 이번 변경은 `select: { id, userId, role, joinedAt, user: { id, email, name } }` 로 쿼리 자체를 좁혀 민감 컬럼이 애초에 메모리로 올라오지 않도록 했다 — 응답 wire 계약(6키)은 그대로다. `user-entity-exposure-guard` 화이트리스트에서도 이 자리가 빠져(`user-entity-exposure.spec.ts`) 래칫이 전환을 기계적으로 강제한다. 신규 단위 테스트(`workspaces.service.spec.ts:1177-1196`)가 `select` 옵션 자체를 단언해 "쿼리가 투영을 요청했는가" 를 응답 키 단언과 별도 축으로 고정했다(뮤테이션 검증 완료 — `select` 제거 시 새 단언 1건만 RED).
  - 제안: 조치 불요 — 긍정적 방어 심화. 유사한 `relations: [...]` + JS 후처리 패턴이 다른 서비스에도 남아 있는지는 이번 diff 범위 밖이므로, `user-entity-exposure-guard` 화이트리스트에 남은 `logout`/`refresh` 두 자리(반환 경로 없음, 위험 낮음)와 별개로 향후 standing audit 대상으로만 참고.

- **[INFO]** `integration-oauth.service.ts` 의 손-작성 constraint 추출을 `pgErrorConstraint()` 로 교체 — 순수 리팩터, 인가/검증 로직 변경 없음
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (게이트 `1268-1274`, `1822-1828`)
  - 상세: `err.constraint ?? err.driverError?.constraint` 추출 로직이 헬퍼 호출로 대체됐을 뿐 판정 조합(`isPostgresUniqueViolation(err) && pgErrorConstraint(err) === STORE_IDENTIFIER_UNIQUE_CONSTRAINT`)은 동일하다. cafe24/makeshop callsite 테스트가 flat/wrapped 두 표면을 모두 대조하도록 파라미터화되어(`integration-oauth.service.cafe24.spec.ts`, `.makeshop.spec.ts`) 회귀 방지 커버리지도 넓어졌다. race-window 에서의 UNIQUE 위반을 도메인 에러(`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 등)로만 변환하고 드라이버 원문은 노출하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 신규 AST 정적 가드(`endpoint-path-conflict-wrap-guard.ts`/`endpoint-path-conflict-wrap.spec.ts`) — 코드 자체의 인젝션 표면 없음, 스캔 대상이 저장소 소스 파일로 고정
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
  - 상세: `fs.readFileSync`/`ts.createSourceFile` 이 읽는 경로는 `collectTsFiles(TRIGGERS_DIR)` 로 저장소 내 `src/modules/triggers` 하위로 고정되어 있고 사용자 입력이 개입하지 않는다(경로 탐색 위험 없음). AST 판정 로직(`isWrappedByConflictCatch`)이 이름 매칭만 하고 실제 값 흐름은 추적하지 않는 한계는 파일 자신의 JSDoc(`/** 이름 해석은 하지 않는다 */`, `CONFLICT_WRAPPER` 오탈자 시 전부 미래핑 판정 = fail-safe 방향)에 명시돼 있다 — 테스트/CI 전용 코드이므로 런타임 보안 표면이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e `B4` — 트리거 `endpointPath` 충돌 시 §1.10 에러 봉투 계약(상태코드·`error.code`·`details` 객체·드라이버 원문 비노출)을 실 DB 경로로 검증
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts:181-213`
  - 상세: `dup.body.error.details` 를 `{ field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }` 객체 전체로 단언하고, `JSON.stringify(dup.body)` 에 `'duplicate key'` 문자열이 없는지 별도로 검사한다 — 정보 노출(CWE-209) 회귀를 실 DB UNIQUE 제약 경로에서 처음으로 고정한 유의미한 보강이다. `Authorization: Bearer ${token}` 은 테스트 셋업에서 동적으로 발급된 `owner.accessToken` 이며 하드코딩된 자격증명이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿 없음 / 명령·SQL·경로 인젝션 표면 없음 (전 diff 스캔)
  - 상세: `codebase/`·`plan/` diff 전체를 `password|secret|api[_-]?key|token|credential` 패턴으로 스캔한 결과 실제 자격증명 리터럴은 없었다(`'mk-client-secret'`·`notificationSecretV2` 등은 기존 테스트 픽스처/컬럼명이며 이번 diff 가 새로 도입한 것도 아니고 값도 아니다). 모든 DB 접근은 TypeORM `find()`/`select`/`relations` 선언형 옵션이며 raw SQL 문자열 조립이 없다. `.claude/test-stages.sh` 의 신규 `_cmd_typecheck_ratchets()` 는 `git rev-parse --show-toplevel` 로 얻은 고정 경로로 `python3 scripts/check-*.py` 를 호출할 뿐 사용자 입력을 셸에 보간하지 않는다.

## 요약

이번 diff 는 두 개의 실질적 보안 관련 개선(B-3: 전역 예외 필터의 unique-violation SoT 통합으로 raw 표면 23505 오분류를 409 로 정정하되 클라이언트 메시지 마스킹 계약은 그대로 유지, B-4: `listMembers` 의 `User` 민감 컬럼 노출을 DB 레벨 `select` 투영으로 검출에서 강제로 승격)와 다수의 테스트/harness/문서 변경으로 구성된다. 두 변경 모두 정보 노출 방지 원칙(CWE-209)을 강화하는 방향이며, 새 e2e·단위 테스트가 마스킹·투영 계약을 뮤테이션 검증까지 거쳐 고정했다. 하드코딩된 시크릿, SQL/커맨드/경로 인젝션, 인증·인가 우회, 안전하지 않은 암호화 사용은 발견되지 않았다. 리팩터(`pgErrorConstraint` 헬퍼 치환)는 동작 동치이며 신규 AST 가드는 저장소 내부 소스만 스캔하는 테스트 전용 코드라 보안 표면이 아니다. Critical/Warning 급 발견사항 없음.

## 위험도

NONE
