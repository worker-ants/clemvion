# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** 같은 엔티티 파일 집합을 검출 함수 두 개가 각각 독립적으로 재파싱한다 (TS AST 파싱 중복)
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — `collectUserRelationNames`(파일 내 함수 선언부, `forEachUserTypedProperty(entityFiles, ...)` 호출 지점)와 `findEagerUserRelations`(마찬가지로 `forEachUserTypedProperty(entityFiles, ...)` 호출 지점). 소비처는 `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts` — `const userRelationNames = collectUserRelationNames(entityFiles);`(describe 블록 최상단, 컬렉션 시점 1회) 와 `expect(findEagerUserRelations(entityFiles, SRC_ROOT)).toEqual([]);`(그 아래 `it()` 블록, 실행 시점 1회).
  - 상세: `forEachUserTypedProperty` 는 두 함수가 "같은 순회를 필요로 한다" 는 이유로 순회 *로직*은 이미 하나로 합쳐 놨다(파일 상단 JSDoc — "순회를 각자 복제하면 한쪽만 고쳐지는 자리가 생긴다"). 그런데 그 공유 함수 자체가 매 호출마다 `entityFiles` 전체를 다시 `fs.readFileSync` + `ts.createSourceFile` 로 **처음부터 재파싱**한다. `collectUserRelationNames(entityFiles)` 와 `findEagerUserRelations(entityFiles, SRC_ROOT)` 는 같은 테스트 파일 안에서 같은 `entityFiles` 배열을 받아 각각 한 번씩 불리므로, 스펙 한 번 실행에 엔티티 파일 집합이 정확히 2회 파싱된다. TypeScript 전체 파싱(토큰화 + AST 빌드)은 파일당 상수 비용이 있고 엔티티 파일 수가 늘수록 그 중복이 그대로 배로 커진다 — 지금은 저장소 규모상 체감 지연은 미미하지만(테스트 스위트 실행 시간에만 영향, 프로덕션 런타임 경로 아님), "출처를 하나로 합친다" 는 이 파일의 설계 원칙(순회 로직 중복 제거)이 파싱 자체의 중복까지는 닫지 못한 상태다. 앞으로 같은 `entityFiles` 를 인자로 받는 검출 함수가 하나 더 생기면 파싱 횟수가 선형으로 늘어난다.
  - 제안: `forEachUserTypedProperty` 를 두 단계로 쪼갠다 — `entityFiles` 를 1회 파싱해 `{ file, sf }[]` (또는 프로퍼티 목록)를 반환하는 헬퍼와, 그 결과를 순회하며 콜백을 부르는 부분. `describe` 블록에서 파싱 결과를 한 번 만들어 `collectUserRelationNames`/`findEagerUserRelations` 양쪽에 넘기면 파싱은 1회로 줄고 두 함수의 "판정 로직"만 갈린 형태를 유지할 수 있다. 이 저장소가 이미 채택 중인 "SoT + 파생" 원칙을 파싱 단계에도 적용하는 것.

- **[INFO]** `findUserRelationLoads` 는 (DTO 전용 가드와 달리) 대상 필터링 없이 `src/modules` 전체 `.ts` 파일을 매번 완전 파싱한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — `export function findUserRelationLoads(files, srcRoot, userRelationNames)` 본문의 `for (const file of files) { const sf = ts.createSourceFile(...) ... }` 루프. 대조: 형제 파일 `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` 의 `findDtoJsDocCitations` 는 `if (!isResponseDtoFile(file)) continue;` 로 파싱 **이전에** 대상을 걸러낸다.
  - 상세: `user-entity-exposure.spec.ts` 는 `const moduleFiles = collectTsFiles(path.join(SRC_ROOT, 'modules'));` 로 얻은 전체 모듈 파일 목록(엔티티 포함, 서비스·DTO·컨트롤러 등 전부)을 그대로 `findUserRelationLoads(moduleFiles, ...)` 에 넘긴다. `relations`/`leftJoinAndSelect` 호출은 원리적으로 어떤 서비스 파일에도 있을 수 있어 `isResponseDtoFile` 같은 경로 기반 사전 필터를 걸 수 없다는 점은 타당하지만, 그 결과 이 가드는 `src/modules` 아래 파일 수만큼 무조건 완전 파싱을 수행한다 — 저장소가 커질수록 테스트 스위트 실행 시간에 선형으로 반영된다. CRITICAL/WARNING 급은 아니고(테스트 전용, 이미 저장소의 다른 형제 가드들도 같은 전수 스캔 패턴을 쓴다), 캐싱 관점에서 기록만 남긴다.
  - 제안: 현재로선 구조상 불가피하므로 조치 불요. 다만 저장소 전체 `.ts` 파일 수가 유의미하게 늘어나 테스트 스위트 실행 시간이 문제가 되면, 이런 전수 AST 스캔 가드들이 각자 `ts.createSourceFile` 을 부르는 대신 파일 경로 → `SourceFile` 캐시를 공유하는 것을 검토.

## 요약

이번 diff 의 실제 프로덕션 런타임 경로 변경은 두 곳뿐이다 — `TriggersService.create`/`update` 의 `save().catch(...)` 추가(단일 동기 분기 판정, 추가 쿼리·루프 없음)와 `WorkflowVersionsService.findOne` 에 `select` 투영(`CREATOR_PROJECTION`)을 추가한 것. 후자는 오히려 **성능이 개선**됐다 — 종전에는 `relations: ['creator']` 로 `User` 엔티티 전 컬럼(비밀번호 해시·2FA 복구 코드 배열·각종 토큰 포함)을 로드했는데, 이제 `id`/`name`/`email` 3컬럼만 select 하므로 DB 에서 실려 오는 바이트 수가 줄었다. N+1, 블로킹 I/O, 과도한 문자열 연산, 부적절한 자료구조 등 이번 점검 관점에서 지적할 CRITICAL/WARNING 급 결함은 프로덕션 코드에서 발견되지 않았다. 나머지 대부분의 변경(두 종류의 AST 기반 repo-guard, pg-error fixture, user-secret-absence 재귀 스캐너, 각종 e2e/unit 테스트)은 CI 테스트 스위트에서만 실행되는 정적 분석·검증 도구라 사용자 요청 경로에 영향이 없다. 그 안에서도 유일하게 기록할 만한 것은 `user-entity-exposure-guard.ts` 안에서 같은 엔티티 파일 집합이 두 검출 함수(`collectUserRelationNames`/`findEagerUserRelations`)에 의해 독립적으로 두 번 파싱된다는 점 — 순회 *로직* 중복은 이미 제거했지만 파싱 자체의 캐싱까지는 닫지 못했다. 지금 규모에서는 체감 영향이 없는 INFO 수준이다.

## 위험도

LOW
