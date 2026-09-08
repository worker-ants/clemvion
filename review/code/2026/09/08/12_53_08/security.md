# 보안(Security) Review

## 발견사항

없음 (CRITICAL/WARNING 급 보안 결함 미발견).

### 참고 (INFO, 비차단)

- **[INFO]** `isPostgresUniqueViolation` 이 `instanceof QueryFailedError`/`instanceof Error` 요구를 제거해 판정 범위가 넓어졌다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` — `catch()` 메서드의 `else if (isPostgresUniqueViolation(exception))` 분기 (게이트 라인 70)
  - 상세: 종전 로컬 `isUniqueViolation`은 `err instanceof QueryFailedError`를 먼저 요구했으나, 새 `isPostgresUniqueViolation`(`codebase/backend/src/common/db/pg-error.ts`)은 `err`가 객체이고 `code`/`driverError.code`가 `'23505'`이기만 하면 참이 된다. 즉 `Error`가 아닌 임의의 객체도 이 분기를 탈 수 있다. 다만 이 분기가 클라이언트에 반환하는 `message`는 하드코딩된 고정 문구(`'Resource already exists or has been modified concurrently.'`)이고 `details`는 이 분기에서 설정되지 않으므로, 판정 범위가 넓어져도 정보 노출로 이어지지는 않는다(CWE-209 관점에서 안전). 이 확장은 의도된 수정(raw 표면 23505가 이전에는 500으로 새던 것을 409로 바로잡음)이며 신규 spec의 회귀 테스트(`http-exception.filter.spec.ts` L127, L147)가 양쪽 방향(23505 확장 / non-23505 비확장)을 모두 캐너리로 고정하고 있다. 실질적 위험은 없다고 판단하나, 향후 이 분기에 `details`나 원본 메시지를 싣는 방향으로 확장할 경우 이 넓어진 판정 범위를 함께 재검토할 필요가 있다.
  - 제안: 조치 불요(현재 안전). 다음에 이 분기의 응답 페이로드를 확장할 때는 `isPostgresUniqueViolation`이 `Error`가 아닌 값도 통과시킨다는 점을 함께 고려할 것.

## 항목별 평가 요약

- **B-3 (`pg-error.ts` SoT 통합)** — `http-exception.filter.ts`가 로컬 `isUniqueViolation`(불완전한 QueryFailedError-only 판정) 대신 공유 `isPostgresUniqueViolation`을 쓰도록 변경. 두 표면(`err.code`/`err.driverError.code`)을 모두 검사하는 SoT로 옮긴 것은 올바른 방향이며, 노출되는 메시지는 여전히 고정 문구라 CWE-209 관점에서 안전. 신규 spec 테스트 2건이 raw 표면 23505(409)와 non-23505(500, 마스킹 유지)를 모두 검증해 회귀를 잘 잠갔다.
- **B-4 (`listMembers` DB-level projection)** — `workspaces.service.ts`가 `relations: ['user']`로 `User` 전 컬럼을 로드하던 것을 `select: { id, userId, role, joinedAt, user: { id, email, name } }`로 좁혀, DB 레벨에서 `User`의 민감 컬럼(비밀번호 해시 등 §2.1.1 7컬럼)이 애초에 로드되지 않도록 만들었다. 이는 "JS 단 매핑만 좁히고 로드는 전체"였던 기존 구조(방어가 검출이지 강제가 아니었음)를 강제(enforcement)로 승격한 데이터 최소화(data minimization) 개선이며, `.map()` 응답 매핑도 그대로 6키로 좁혀 이중 방어를 유지한다. `workspaces.service.spec.ts`의 신규 테스트가 "쿼리가 실제로 `select`로 좁혀 요청하는지"를 별도 축으로 단언해, 투영을 되돌려도 매핑만으로는 잡히지 않는 회귀 형태를 커버한다. 보안 관점에서 순수 개선.
- **B-6/B-7 (`endpointPath` UNIQUE 충돌 래핑 래칫 + e2e)** — 신규 AST 정적 가드(`endpoint-path-conflict-wrap-guard.ts`)는 `triggerRepository.save()` 호출이 전부 `rethrowEndpointPathConflict`로 래핑됐는지(또는 명시적으로 예외 목록에 사유와 함께 등재됐는지)를 강제해, 향후 새 저장 경로가 생겨도 raw DB 에러가 그대로 500으로 새는 것을 막는다. 신규 e2e(`webhook-trigger.e2e-spec.ts` B4)는 실제 DB UNIQUE 제약을 밟아 409 + 안전한 `details`(`field`/`code`)를 반환하고 `'duplicate key'`(드라이버 원문) 문자열이 응답 바디에 없는지 명시적으로 단언한다 — CWE-209(에러 메시지를 통한 정보 노출) 방지 계약을 실제 DB 경로에서 검증하는 유일한 테스트로, 보안 회귀 방지에 기여한다.
- **B-2 (`__test-utils__` 를 프로덕션 빌드에서 제외)** — `tsconfig.build.json` exclude에 `**/__test-utils__/**` 추가로 테스트 전용 헬퍼 5파일이 dist에 실리지 않도록 함. 현재는 devDependency를 끌어오지 않아 즉각적 지뢰(런타임 크래시)는 아니지만, 불필요한 코드가 프로덕션 아티팩트에 포함되는 것 자체를 줄여 공급망/아티팩트 최소화 관점에서 방어적 개선이다.
- **B-5 (`pgErrorConstraint()` 치환)** — `integration-oauth.service.ts`의 손-작성 constraint 추출 로직을 공유 헬퍼로 교체한 순수 리팩터. 두 표면(`err.constraint`/`err.driverError.constraint`)을 동일하게 검사하므로 동작 동등성 확인됨. `throw err`로 fallback되는 미매칭 케이스는 상위 전역 필터가 여전히 마스킹하므로 정보 노출 경로 없음.
- **B-1(harness), B-8(타입 리네임), PROJECT.md/plan 문서 변경** — 코드 실행 경로에 영향 없는 dev-tooling/문서/타입 이름 변경으로 보안 영향 없음.
- 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증/인가 우회, 안전하지 않은 암호화 알고리즘은 diff 전체에서 발견되지 않음(`git diff` 시크릿 패턴 스캔 포함 확인).

## 요약

이번 변경분(배치 B, 8항목)은 신규 기능이 아니라 이전 라운드에서 식별된 보안·정합성 갭을 봉인하는 후속 조치들로 구성되어 있다. 핵심은 (1) 전역 예외 필터가 raw postgres 에러 표면을 놓쳐 409여야 할 응답이 500으로 새던 것을 공유 SoT(`pg-error.ts`)로 바로잡았고 — 메시지는 여전히 고정 문구라 정보 노출 없이 상태 코드만 정정됨, (2) `listMembers`가 `User` 엔티티를 전 컬럼 로드한 뒤 JS 단에서만 필드를 좁히던 구조(방어가 검출 수준)를 DB 레벨 `select` 투영(강제 수준)으로 승격해 민감 컬럼이 애초에 메모리에 올라오지 않도록 했으며, (3) 트리거 `endpointPath` UNIQUE 충돌에 대해 AST 정적 래칫과 실 DB e2e를 새로 갖춰 "드라이버 원문이 클라이언트로 새지 않는가"를 회귀 테스트로 고정했다. 이 세 항목 모두 기존 결함을 좁히거나 검출 수준의 방어를 강제 수준으로 끌어올리는 방향이며, 새로 도입된 위험은 관찰되지 않았다. `isPostgresUniqueViolation`의 판정 범위 확장(비-Error 객체도 매치)은 이론적으로 넓어졌으나 반환 메시지가 고정 문구라 실질적 정보 노출 위험은 없다(INFO 기록). 하드코딩된 시크릿, 인젝션, 인증/인가 우회, 취약한 암호화는 발견되지 않았다.

## 위험도

NONE
