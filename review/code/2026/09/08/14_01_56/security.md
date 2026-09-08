# 보안(Security) 코드 리뷰

## 검토 범위 메모

프롬프트 번들 82개 항목 중 실제 애플리케이션/하네스 코드·plan 문서는 26개(파일 1~26)이고,
나머지 56개(파일 27~82)는 이 배치 이전 두 라운드(`review/code/2026/09/08/{12_53_08,13_34_28}`)와
`review/consistency/2026/09/08/{12_21_11,13_22_38,13_34_30}`가 산출한 **리뷰/컨시스턴시 보고서
자체**다. 이 저장소 관례상 `review/**`는 커밋되는 프로세스 증빙이라 diff 에 포함되지만, 보안
관점에서 점검할 실행 코드가 아니다. 훑어본 결과 비밀값·자격증명 유출은 없었다. 아래 발견사항은
파일 1~26(실제 코드 변경)에 대한 것이다.

## 발견사항

- **[INFO]** 전역 예외 필터의 unique-violation 판정을 SoT(`pg-error.ts`)로 통합 — 정보 노출 없이 상태 코드 정확도만 개선
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:70` (`isPostgresUniqueViolation(exception)`)
  - 상세: 종전 로컬 `isUniqueViolation`은 `err instanceof QueryFailedError`를 먼저 요구해 TypeORM이 감싸지 않은 raw 표면(`err.code === '23505'`)의 unique 위반을 놓치고 500 `INTERNAL_ERROR`로 마스킹했다. 신설 분기는 `pg-error.ts`의 `isPostgresUniqueViolation`(구조적 duck-typing, `err.code ?? err.driverError?.code`)을 써서 두 표면 모두 409로 정확히 매핑한다. 클라이언트에 반환되는 `message`는 고정 문자열 `'Resource already exists or has been modified concurrently.'`이며(파일 전체를 직접 열어 확인, 코드 75번째 줄) 드라이버 원문(제약명·SQLSTATE·SQL)은 여전히 응답에 실리지 않는다 — CWE-209 마스킹 계약이 그대로 유지된다. 회귀 테스트(`http-exception.filter.spec.ts` 신설 2건, 게이트 127~159)가 raw 23505→409 와 raw 23502(non-unique)→500(과확대 방지)을 양방향으로 고정한다. 순수 상태코드 정확도 개선이며 새로운 노출 표면은 없다.
  - 제안: 조치 불요.

- **[INFO]** `WorkspacesService.listMembers` — `User` 민감 컬럼 로드를 JS 매핑(검출)에서 DB `select` 투영(강제)으로 전환, 방어 심화
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232`
  - 상세: 종전에는 `relations: ['user']`로 `User` 엔티티 전 컬럼(비밀번호 해시 등 민감 7컬럼 포함, `spec/1-data-model.md §2.1.1`)을 로드한 뒤 `.map`으로 6키만 골라 응답했다 — 응답 자체는 안전했지만 `user-entity-exposure-guard`가 *로드 형태*만 검사하므로 매핑이 넓어져도(예: `...m.user` 스프레드) 정적 가드는 이를 잡지 못하는 사각이었다(검출이지 강제가 아님). 이번 변경은 쿼리에 `select: { id, userId, role, joinedAt, user: { id, email, name } }`를 추가해 DB 레벨에서 컬럼을 좁혀, 민감 컬럼이 애초에 메모리로 올라오지 않게 한다. 직접 소스를 열어 확인한 결과 인가 체크(`assertMembership(workspaceId, requesterId)`, 213번째 줄 바로 앞)는 그대로 유지되어 있어 이 변경이 인가 로직에 영향을 주지 않는다. 응답 wire 계약(6키)도 동일하게 유지된다. 방어 심화로 긍정적 변경이다.
  - 제안: 조치 불요.

- **[INFO]** `tsconfig.build.json`에 `**/__test-utils__/**` exclude 추가 — 죽은 테스트 헬퍼 코드가 프로덕션 dist 번들에 실리던 것을 차단
  - 위치: `codebase/backend/tsconfig.build.json` (게이트 20~28)
  - 상세: `__test-utils__` 디렉터리(순수 함수만 두는 관례이나 devDependency import는 없음)가 기존 세 exclude 패턴 어디에도 걸리지 않아 dist로 나가고 있었다(실측 5파일, `common/`·`modules/integrations/` 두 곳). devDependency를 끌어오지 않으므로 `production-build-devdep.spec.ts`의 누출 축(런타임 크래시)에는 안 잡히지만, 프로덕션 아티팩트에 불필요한 코드가 포함되는 것 자체는 공급망/아티팩트 위생 관점에서 축소할 가치가 있는 표면이다 — 실제로 그 방향으로 축소했다.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e(`webhook-trigger.e2e-spec.ts` B4)가 409 응답에서 드라이버 원문 미노출을 명시적으로 단언
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` (게이트 181~213, 특히 212번째 줄 `expect(JSON.stringify(dup.body)).not.toContain('duplicate key')`)
  - 상세: 실 Postgres UNIQUE 제약을 밟는 경로에서 상태 코드·`error.code`·`details` 형태뿐 아니라 원문 문자열(`'duplicate key'`) 부재까지 함께 검증한다. 이는 위 필터 변경이 실제 운영 환경에서도 정보 노출 없이 동작함을 e2e 레벨에서 고정하는 좋은 회귀 방지 테스트다.
  - 제안: 조치 불요.

- **[INFO]** 신규 정적 AST 가드(`endpoint-path-conflict-wrap-guard.ts`)·기존 `user-entity-exposure-guard.ts` 리팩터 — 둘 다 저장소 자체 소스만 읽는 빌드/테스트 시점 도구, 런타임 공격 표면 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (신규), `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` (`enclosingName` → `enclosingScopeName` 승격)
  - 상세: `fs.readFileSync` + TypeScript compiler API로 저장소 자신의 `.ts` 파일을 파싱한다. 입력이 사용자 제어값이 아니라 CI/로컬 빌드 시점의 소스 트리 자체이므로 인젝션·경로 탐색 표면이 없다. `findTriggerRepositorySaves`는 `triggerRepository.save()` 호출에 UNIQUE 충돌 래핑이 빠진 자리를 정적으로 잡아, DB 제약 위반이 미가공 500(또는 향후 원문 유출)으로 새는 것을 구조적으로 방지하는 래칫이라 보안 관점에서도 긍정적이다.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩 시크릿 스캔 — 발견 없음
  - 상세: diff 전체에서 `secret`/`password`/`token`/`apiKey` 계열 리터럴을 확인했다. `'mk-client-secret'`(`integration-oauth.service.makeshop.spec.ts`)은 이번 diff 이전부터 있던 테스트 픽스처 값이며(unified diff 상 `-`/`+` 양쪽에 동일하게 존재, 이번 변경은 `it.each` 파라미터화일 뿐), `Bearer ${token}`(`webhook-trigger.e2e-spec.ts`)은 테스트 setup 에서 발급받은 변수 참조다. 실제 자격증명·API 키 리터럴은 없다.

- **[INFO]** SQL 인젝션 표면 — 없음
  - 상세: 이번 diff의 모든 DB 접근은 TypeORM `find()`의 선언형 `where`/`select`/`relations` 옵션을 사용하며 raw SQL 문자열 조립이 없다. `integration-oauth.service.ts`의 리팩터(`pgErrorConstraint()` 도입)도 에러 객체의 고정 프로퍼티(`code`/`constraint`/`driverError.*`)만 읽는 순수 함수라 인젝션과 무관하다.

## 요약

이번 배치(B-1~B-8, 실제 코드/plan 변경 26개 파일)는 보안 관점에서 **회귀가 아니라 개선**이다.
전역 예외 필터의 unique-violation 판정을 SoT로 통합해 raw 표면 23505가 500으로 새던 상태 코드
오류를 닫았고(응답 메시지는 여전히 고정 문자열이라 정보 노출 증가 없음), `listMembers`의 `User`
민감 컬럼 로드를 검출(정적 가드)에서 강제(DB 레벨 `select` 투영)로 승격했으며, 프로덕션 빌드에서
테스트 전용 코드(`__test-utils__`)가 dist로 새던 것을 막았다. 신규 e2e·유닛 테스트는 정보 노출
방지(CWE-209) 계약을 실제 DB 경로까지 포함해 명시적으로 고정한다. 하드코딩된 시크릿, SQL/커맨드
인젝션, 인증·인가 우회, 안전하지 않은 암호화 알고리즘 사용은 발견되지 않았다. 리뷰 번들의 절반
이상을 차지하는 `review/**` 산출물은 이전 라운드의 보고서 자체이며 애플리케이션 코드가 아니다.

## 위험도

NONE
