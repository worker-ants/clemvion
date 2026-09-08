# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** `listMembers` 를 JS 단 매핑에서 DB 레벨 `select` 투영으로 전환 — 방어 심화(검출→강제), 긍정적 변경
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`listMembers`, `memberRepository.find` 의 `select` 절)
  - 상세: 종전에는 `relations: ['user']` 로 `User` 엔티티 전 컬럼(민감 7컬럼 포함, 데이터 모델 §2.1.1)을 로드한 뒤 `.map()` 으로 6키만 골랐다. 응답 자체는 안전했지만 `user-entity-exposure-guard` 는 "로드 형태"만 감시하므로 그 매핑이 넓어져도(`...m.user` 스프레드 등) 가드가 초록으로 남는 구조적 취약점이었다(방어가 검출이지 강제가 아니었음). 이번 변경은 `select: { id, userId, role, joinedAt, user: { id, email, name } }` 로 쿼리 자체를 좁혀 민감 컬럼이 애초에 DB에서 올라오지 않도록 했다. 실제로 컬럼을 확인했다 — `user: { id: true, email: true, name: true }` 는 객체 형태(불리언 아님)라 컬럼을 정확히 3개로 제한한다. 신규 단위 테스트(`workspaces.service.spec.ts`)가 "select 가 객체인가"를 별도로 단언해, `.map()` 만으로 좁혀지는 상태로 회귀해도(투영을 되돌려도) 잡히도록 두 축을 모두 고정했다.
  - 제안: 없음 — 방어 심화가 정확히 이루어졌음을 코드 레벨에서 확인.

- **[INFO]** 전역 예외 필터가 raw-surface(`err.code`) 23505 를 409 로 승격 — 오분류 수정, 정보 유출 방향은 아님
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (`isPostgresUniqueViolation(exception)` 분기)
  - 상세: 종전 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 먼저 요구해, TypeORM 이 감싸지 않은 raw 표면의 unique violation 은 이 분기를 타지 못했다. 그 결과가 어디로 갔는지 직접 추적했다 — `exception instanceof Error` 분기의 `mapHttpErrorLike`(HTTP status/statusCode 필드 요구)에도 안 걸려 `null` 을 반환하고, 최종적으로 `logger.error` 로 내부 로깅만 되고 클라이언트에는 고정 문구 `UNHANDLED_ERROR_MESSAGE`("An unexpected error occurred. Please try again later.")가 담긴 **500** 으로 나갔다. 즉 종전 결함은 **정보 유출이 아니라 상태 코드 오분류**(500 vs 409)였다 — 드라이버 원문은 그때도 지금도 클라이언트로 나가지 않는다. 신설 분기의 메시지도 `'Resource already exists or has been modified concurrently.'` 로 고정 문구이며 `err.message`/`constraint` 등 원문을 echo 하지 않는다(CWE-209 계약 유지). 회귀 테스트(`http-exception.filter.spec.ts`)가 `body.error.message`에 `'duplicate key value'` 가 없음을 명시적으로 단언한다.
  - 제안: 없음 — 마스킹 계약이 그대로 유지됨을 확인.

- **[INFO]** 트리거 `endpointPath` 409 e2e 가 DB 드라이버 원문 비노출을 실제 DB 경로로 고정
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` (`B4. 같은 워크스페이스에 같은 endpointPath → 409 …`)
  - 상세: `expect(JSON.stringify(dup.body)).not.toContain('duplicate key')` 로, mock 이 아니라 실 Postgres UNIQUE 제약을 밟는 경로에서 제약 이름·SQLSTATE 같은 드라이버 원문이 봉투 밖으로 새지 않는지 확인한다. CWE-209(에러 메시지를 통한 정보 노출) 방지 계약을 실경로로 검증하는 긍정적 추가다.
  - 제안: 없음.

- **[INFO]** `tsconfig.build.json` 에 `**/__test-utils__/**` exclude 추가 — 프로덕션 번들에서 테스트 전용 코드·잠재적 devDependency 경로 제거
  - 위치: `codebase/backend/tsconfig.build.json`
  - 상세: 종전에는 `__test-utils__` 디렉터리(5파일)가 어떤 exclude 패턴에도 안 걸려 `dist` 로 나가고 있었다. 현재는 devDependency 를 끌어오지 않아(`production-build-devdep.spec.ts` 로 확인됨) 런타임 크래시 위험은 없었지만, 죽은 코드가 배포 아티팩트에 포함되는 것 자체가 공급망/감사 측면에서 바람직하지 않다. 이번 변경은 그 표면을 닫는다. `plan/in-progress/auth-guard-reflection-hardening.md` 에 있던 조건부 유예 항목(devDependency import 트리거)과는 별개 사유(죽은 코드)로 처리됐고, 문서 상호참조도 이번 배치에 함께 갱신됐다.
  - 제안: 없음.

- **[INFO]** cafe24/makeshop 유니크 제약 충돌 처리가 raw/wrapped 두 에러 표면 모두에서 검증되도록 테스트가 확장됨 — 방어 회귀 없음 확인
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts`, `integration-oauth.service.makeshop.spec.ts` (`raceErrorSurfaces` it.each), 생산 코드는 `integration-oauth.service.ts` 의 `pgErrorConstraint(err)` 치환
  - 상세: `pgErrorConstraint`/`isPostgresUniqueViolation` 은 `err.code`/`err.constraint` 와 `err.driverError.code`/`err.driverError.constraint` 두 표면을 동일하게 흡수하는 SoT(`pg-error.ts`)로 통합됐다. 이 헬퍼를 실제로 쓰는 두 callsite(비공개 앱 store_identifier 충돌 → `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 409)가 두 표면 모두에서 올바르게 동작함을 새 테스트가 고정한다. 손으로 짠 constraint 추출식(중복 로직)을 제거해 향후 표면 불일치로 인한 오분류(예: 409 대신 500 마스킹) 위험을 줄인다.
  - 제안: 없음.

- **[INFO]** 리뷰 대상 diff 전반에서 하드코딩된 시크릿·자격증명 없음, 인젝션(SQL/커맨드/경로 탐색) 표면 없음
  - 상세: 변경분에 새로 추가된 SQL 은 없다(TypeORM `select`/`where` 객체 리터럴만 사용, raw query 신설 없음). 신규 AST 스캐너(`endpoint-path-conflict-wrap-guard.ts` 등)는 저장소 내 고정 소스 파일만 읽는 빌드/테스트 전용 도구라 사용자 입력을 다루지 않는다. `.claude/test-stages.sh` 변경은 고정된 스크립트 경로(`git rev-parse --show-toplevel` 기반)만 실행하며 외부 입력을 셸에 전달하지 않는다. API 키·비밀번호·토큰 등 시크릿 리터럴은 diff 어디에도 없다.
  - 제안: 없음(확인 사항).

## 요약

이번 배치(B-1~B-8, harness/테스트/문서 다수 + 소수의 런타임 변경)에서 CRITICAL/WARNING 급 보안 결함은 발견되지 않았다. 런타임에 실질적으로 영향을 주는 두 변경 — `GlobalExceptionFilter` 의 unique-violation 판정 통합(`pg-error.ts` SoT)과 `WorkspacesService.listMembers` 의 DB 레벨 `select` 투영 — 을 직접 열어 대조한 결과, 전자는 정보 유출이 아니라 상태 코드 오분류(500→409)를 고친 것이고 클라이언트로 나가는 메시지는 이전과 동일하게 고정 문구로 마스킹된다(CWE-209 계약 유지, 회귀 테스트로 고정). 후자는 `User` 민감 컬럼에 대한 방어를 "검출"(응답 형태 감시)에서 "강제"(쿼리 레벨 컬럼 제한)로 심화시킨 순수 개선이며, 컬럼 제한이 객체 형태로 정확히 걸려 있음을 코드와 신규 단위 테스트 양쪽에서 확인했다. 신규 AST 리포지토리 가드·픽스처·e2e 테스트는 모두 저장소 내부 소스만 다루는 빌드/테스트 전용 도구이거나, 드라이버 원문 비노출을 실제 DB 경로로 검증하는 방어적 테스트로 새로운 공격 표면을 추가하지 않는다. `tsconfig.build.json` 의 `__test-utils__` exclude 추가는 배포 산출물에서 불필요한 테스트 전용 코드를 제거하는 위생적 개선이다. 하드코딩된 시크릿, 신규 인젝션 표면, 인증/인가 우회, 안전하지 않은 암호화/해시 사용은 diff 전체에서 관찰되지 않았다.

## 위험도

NONE
