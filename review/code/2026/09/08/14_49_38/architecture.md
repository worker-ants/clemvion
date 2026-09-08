# 아키텍처(Architecture) 코드 리뷰

## 발견사항

- **[INFO]** `pg-error.ts` 를 SoT 로 완전히 수렴 — 의존성 역전이 올바른 방향으로 개선됨
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (로컬 `isUniqueViolation` 제거, `isPostgresUniqueViolation` 로 교체), `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (두 자리 손-작성 constraint 추출 → `pgErrorConstraint()`)
  - 상세: 종전 `http-exception.filter.ts` 는 `typeorm` 의 `QueryFailedError` 를 직접 import 해 `instanceof` 검사를 했다 — 전역 예외 필터(횡단 관심사 레이어)가 ORM 구현 세부(드라이버 wrap 여부)에 직접 결합돼 있었다. 이번 변경으로 `QueryFailedError` import 가 완전히 사라지고 `common/db/pg-error.ts` 의 `isPostgresUniqueViolation`/`pgErrorConstraint` 라는 추상화 뒤로 숨었다 — 필터는 이제 "PG 유니크 위반인가"만 알고 "어떻게 판정하는가"는 모른다. `integration-oauth.service.ts` 의 두 자리(라인 1268 부근, 1822 부근)에 있던 동일한 5줄짜리 `constraint` 추출 블록도 같은 헬퍼 호출로 대체돼 중복이 제거됐다. 계층 책임 분리와 DRY 양쪽에서 개선.
  - 제안: 조치 불요 — 긍정적 변경으로 기록.

- **[INFO]** 형제 AST 가드 간 중복 로직(`enclosingName`)을 공유 모듈로 승격 — SRP·DRY 개선이나 모듈 응집도는 계속 낮아지는 추세
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (`enclosingScopeName` 신설), 소비처 `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`, `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
  - 상세: 이전 라운드(`review/code/2026/09/08/13_34_28` architecture WARNING#1)가 지적한 "같은 책임의 AST 워커가 두 가드 파일에 각자 손으로 있다"는 결함을 정확히 해결했다 — 알고리즘을 한 곳(`source-scan.ts`)으로 모으고 두 가드가 그것을 소비하도록 배선했다. 다만 `source-scan.ts` 는 이미 주석 스트리핑, 리터럴 스트리핑, 호출 카운팅, raw SQL 탐지, null-cast 탐지, 파일 수집, 경로 정규화, 그리고 이번에 추가된 스코프 이름 해석까지 서로 다른 8개 축의 책임을 한 파일에 모으고 있다. 파일 자신의 docstring 이 "왜 공유하나"를 매번 설명하며 "한쪽만 하드닝하면 나머지에 같은 결함이 남는다"는 근거를 드는데, 이 근거는 "발산 방지"에는 유효하지만 모듈 자체의 응집도(cohesion) 저하를 상쇄하지는 못한다 — SQL 탐지 로직을 고치려는 사람이 스코프 이름 해석·파일 수집 로직까지 한 파일에서 함께 읽어야 한다.
  - 제안: 지금 당장 급하지 않음(테스트 전용 모듈이고 각 함수가 독립적으로 export/테스트되어 실질적 결합은 낮다). 축이 더 늘어나면(예: 아홉 번째 스캔 관심사) `ast-scan.ts`/`sql-scan.ts`/`fs-scan.ts` 등으로 파일을 축 기준 분리하는 것을 고려할 만하다.

- **[INFO]** `tsconfig.build.json` exclude 목록이 세 번째로 반복 확장 — 확장에 열려 있지만(Open) 매번 중앙 설정 수정이 필요(Closed 위반 소지)
  - 위치: `codebase/backend/tsconfig.build.json` (`"**/__test-utils__/**"` 추가)
  - 제안 아님, 관찰: 같은 성격의 항목이 `repo-guards/**` → `src/shared/testing/**` → `**/__test-utils__/**` 순으로 세 번 늘었고, 파일 자신의 주석이 "네 번째 자리가 생기면"이라고 재발을 이미 예견하고 있다. 새 테스트 전용 디렉터리가 devDependency 를 import 하기 시작할 때마다 `tsconfig.build.json`(빌드 설정)·`production-build-devdep.spec.ts`(가드 스펙)·docstring 세 자리를 함께 고쳐야 하는 구조라, 개방-폐쇄 원칙 관점에서는 "새 디렉터리 추가"라는 확장이 기존 중앙 파일의 수정을 요구한다. 다만 이 저장소는 이미 `it.each` 로 가드 쪽 확장 비용을 낮췄고(파일 39/`maintainability.md` 참조 완료), exclude 자체를 일반화(예: 명명 규칙 기반 단일 글롭)하려면 "테스트 전용 디렉터리"를 식별하는 안정적인 명명 규약이 저장소 전역에 먼저 서야 하므로 이번 diff 범위를 넘는 문제다. 조치 불요, 다음에 네 번째 자리가 실제로 생기면 일반화를 검토할 근거로 남긴다.

- **[INFO]** 프런트엔드/백엔드 wire 계약이 여전히 손-미러 상태로 남음 — 타입 개명은 증상(이름 충돌)만 해소, 근본 원인(공유 스키마 부재)은 의도적으로 유예
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`WorkflowVersionDetail` → `WorkflowVersionDetailProjection`), `codebase/frontend/src/lib/api/workflows.ts` (`WorkflowVersionDetail` 유지, docstring 만 갱신)
  - 상세: 개명은 실제 결함(grep 이 두 자리를 "유일 정의"로 오판해 세 라운드 연속 리뷰가 잘못된 결론을 낸 것)을 해소하는 정확한 처방이다. 다만 아키텍처 관점에서 근본 원인 — 백엔드/프런트엔드가 같은 wire 계약을 공유 타입 패키지 없이 각자 손으로 선언하고 있다는 사실 — 은 그대로 남는다. 두 선언은 이미 `creator` nullability·`createdAt` 타입(`Date` vs `string`)에서 실제로 갈려 있고, 지금은 백엔드가 더 좁아 런타임 오류가 없지만 다음에 누군가 한쪽만 넓히면 조용히 계약이 깨질 수 있는 구조다. docstring 이 이 사실을 정확히 인지하고 있고 "합치려면 wire 계약을 한쪽으로 맞춰야 해서 이 PR 범위 밖" 이라고 명시적으로 유예했으므로 이번 diff 의 결함은 아니다.
  - 제안: 조치 불요(이미 다른 plan 항목/PR 범위로 문서화됨). 공유 패키지화 시 `Date` vs `string`, `creator` optionality 통일이 선행 과제임을 재확인.

- **[INFO]** `WorkspacesService.listMembers` — 방어를 애플리케이션 레이어 검출에서 데이터 접근 레이어 강제로 이동 (레이어 책임 분리 개선)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`listMembers`, `select` 투영 추가)
  - 상세: 종전에는 `relations: ['user']` 로 `User` 엔티티 전 컬럼을 로드한 뒤 서비스 레이어의 `.map` 이 6키로 좁혔다 — 민감 데이터 최소화 책임이 비즈니스 레이어의 매핑 로직 정확성에 전적으로 의존했고, 정적 가드(`user-entity-exposure-guard`)는 그 매핑을 검증할 수 없어(로드 형태만 관찰) 방어가 "강제"가 아니라 "검출도 안 되는 사각"이었다. 이번 변경은 TypeORM 의 `select` 옵션으로 투영 경계를 리포지토리 쿼리(데이터 접근 레이어)로 끌어올렸다 — 최소권한 원칙이 올바른 레이어에 안착했고, 가드의 화이트리스트에서도 해당 자리가 빠져 "표에서 사라지는 것 자체가 전환 완료의 증거"가 되는 좋은 자기검증 구조다. `WorkflowVersionsService.findOne` 이 먼저 도입한 패턴을 두 번째 자리에 일관되게 적용한 것으로, 저장소 전체에 "User 관계는 항상 select 투영으로 로드한다"는 암묵적 컨벤션이 자리잡아 가는 것으로 보인다.
  - 제안: 조치 불요 — 긍정적 변경으로 기록. (남은 두 항목 `logout`/`refresh` 는 반환 경로가 없어 성격이 다름을 docstring 이 이미 명시.)

- **[INFO]** 신규 가드 `endpoint-path-conflict-wrap-guard.ts` — 기존 가드 패밀리와 구조적으로 일관됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (순수 스캔/판정 로직), `endpoint-path-conflict-wrap.spec.ts` (소비 스펙), `fixtures/endpoint-path-save.fixture.ts` (대조군)
  - 상세: "파서 순수 로직 / 소비 spec / fixture 대조군" 3분할 구조가 `user-entity-exposure-guard.ts`·`swagger-dto-contract-guard.ts` 와 동일한 패턴을 따른다. 술어 설계도 건전하다 — 처음 시도한 "`endpointPath` 를 다루는 save 만 좁혀서 검사"라는 술어가 실측 결과 두 정답 사이트(`create`/`update`, 둘 다 스프레드로 필드를 나름) 모두를 놓치는 vacuous 술어임을 확인하고, "모든 `triggerRepository.save()` 를 세고 화이트리스트+래핑 여부로 완전 분류"라는 완전성 있는 술어로 전환했다(개방된 열거가 아니라 닫힌 전수 분류 — 새 save 자리가 생기면 반드시 어느 한쪽 목록에 들어가야 한다). 이름 해석 없이 호출식 텍스트만 보는 한계(named export 의 alias re-export 등은 못 봄)를 docstring 이 명시적으로 인정하고 fail-safe 방향(미검출 시 "미래핑"으로 분류해 시끄럽게 실패)을 택한 점도 형제 가드들의 관례와 일치한다.
  - 제안: 조치 불요.

- **[INFO]** `CONFLICT_WRAPPER` 상수가 프로덕션 private 메서드 이름을 문자열 리터럴로 하드코딩 — 컴파일러가 보증하지 않는 결합
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:21` (`export const CONFLICT_WRAPPER = 'rethrowEndpointPathConflict';`)
  - 상세: 이 상수는 `TriggersService` 의 private 메서드 이름과 문자열로만 연결돼 있다(타입 시스템이 이 매핑을 검증하지 않음). 프로덕션 코드가 그 메서드를 리네임하면 TS 컴파일러는 아무 경고도 주지 않고, 이 가드는 모든 자리를 "미래핑"으로 재분류해 테스트가 실패한다 — docstring 이 이를 "fail-safe 방향으로 시끄러워진다"고 명시적으로 인지하고 있어 설계 실수는 아니다. 다만 이 결합 방식(문자열 상수 vs 실제 심벌) 자체는 형제 가드들(`user-entity-exposure-guard.ts` 의 화이트리스트 키 등)과 동일한 기존 관례이므로 이번 diff 가 새로 도입한 패턴은 아니다.
  - 제안: 조치 불요(기존 관례와 일관됨, fail-safe 방향이라 위험도 낮음). 참고용 기록.

## 요약

이번 배치(B-1~B-8)는 순수 추가 기능보다 **기존 아키텍처 결함의 정리**에 집중되어 있다. 핵심 개선 세 가지 — (1) `http-exception.filter.ts` 가 `typeorm` 직접 의존을 걷어내고 `pg-error.ts` 추상화 뒤로 숨은 것, (2) 형제 AST 가드 두 곳에 중복돼 있던 스코프 이름 해석 로직을 공유 모듈로 승격한 것, (3) `WorkspacesService.listMembers` 의 민감 데이터 최소화 책임을 비즈니스 레이어 매핑에서 데이터 접근 레이어(`select` 투영)로 끌어올린 것 — 모두 의존성 역전·SRP·레이어 책임 분리 방향으로 정확히 움직인다. 신규 가드(`endpoint-path-conflict-wrap-guard.ts`)는 기존 가드 패밀리(파서/소비 spec/fixture 3분할)와 구조적으로 완전히 일관되고, vacuous 술어를 실측으로 먼저 반증한 뒤 완전 분류 술어로 전환한 설계 과정도 건전하다. 순환 의존성은 발견되지 않았고(`common` → `repo-guards` 역참조 없음), 모듈 경계도 명확하다. 남은 항목은 전부 사전에 문서화되어 유예된 기존 부채(FE/BE 손-미러 타입, `tsconfig.build.json` exclude 목록의 반복 확장 패턴, `source-scan.ts` 모듈의 점증하는 책임 수)로, 이번 diff 가 새로 만든 결함이 아니라 관찰 기록 수준이다.

## 위험도

NONE
