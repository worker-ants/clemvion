# DB 리뷰 (fresh) — `getStatus()` projection 상수화 fix 반영

대상: `codebase/backend/src/modules/external-interaction/interaction.service.ts`
diff base: `origin/main` (commit `f2764f3a9`가 이번 fresh review 의 실질 변경분)
직전 리뷰: `review/code/2026/07/10/22_47_32/database.md` (위험도 LOW) — 이번 fix 로 W-2(리터럴 3중 SoT)가 상수화됨.

## 발견사항

- **[INFO]** `STATUS_PROJECTION_COLUMNS` 상수화가 TypeORM `select` 시맨틱을 바꾸지 않음
  - 위치: `interaction.service.ts:56-72` (상수 선언), `:272` (1단계 `select:` 사용부)
  - 상세: TypeORM 소스(`node_modules/typeorm/query-builder/SelectQueryBuilder.js` `applyFindOptions()` 1778-1781행, `node_modules/typeorm/util/OrmUtils.js` `propertyPathsToTruthyObject()`)를 직접 추적했다. `select` 배열은 `for (const path of paths)` 로 **읽기만** 되어 `propertyPathsToTruthyObject` 가 새 객체(`{id:true, status:true, ...}`)를 생성하는 데만 쓰인다 — push/splice/sort 등 원본 배열을 변형(mutate)하는 코드 경로 없음. 즉 모듈 스코프의 **단일 배열 인스턴스를 여러 동시 요청이 공유**해도 TypeORM 이 이를 훼손할 가능성은 없다(불변 참조로 안전).
  - 타이핑 검증: `npx tsc --noEmit -p tsconfig.json` 를 직접 실행해 `interaction.service.ts` 에 타입 에러가 없음을 확인했고, `'outputData'` → `'output_data'` 로 의도적으로 오기해 재실행하면 `TS2820: Type '"output_data"' is not assignable to type 'keyof Execution'. Did you mean '"outputData"'?` + `select:` 대입부에서 `TS2322`(두 번째 에러)로 **컴파일이 확실히 깨짐**을 재현·복구까지 확인했다(RESOLUTION.md 의 주장을 독립 재현). `satisfies (keyof Execution)[]` 는 배열 리터럴의 각 원소를 `keyof Execution` 유니온에 대해 contextual 하게 체크하므로 `FindOptionsSelectByString<Execution> = (keyof Execution)[]` 에 정상 대입된다.
  - 결론: 안전. 리스크 없음.

- **[INFO]** 컬럼 집합 — fix 전/후 정확히 동일, 응답 조립 전 필드 커버
  - 위치: `interaction.service.ts:60-67` (`STATUS_PROJECTION_COLUMNS`), 응답 조립부 `:353-390`
  - 상세: 상수 = `['id','status','workflowId','startedAt','finishedAt','outputData']`. 응답 조립에서 참조되는 `execution.*`: `execution.id`(354), `execution.workflowId`(355), `execution.status`(276/356/362/369), `execution.outputData`(363/370, result/error 조립), `execution.finishedAt`/`execution.startedAt`(377-378, `updatedAt` fallback 체인)까지 6개 전부 projection 에 포함된다. `execution.error`/`inputData`/`userVariables`/`resumeCallStack` 등 미선택 컬럼 접근은 없음(grep 확인). 특히 우려 대상이던 `updatedAt = finishedAt ?? startedAt ?? new Date()` 침묵 회귀 시나리오는 두 컬럼 모두 selected 라 발생하지 않는다. `interaction.service.spec.ts:760-767` `BASE_COLUMNS` (구현 상수 import 없는 독립 black-box 재기술) + 정확 집합 비교(`select.slice().sort()`, `:798`)로 이중 가드됨.

- **[INFO]** 2단계 `select: ['id','conversationThread']` 는 인라인 유지 — 의도적, 일관성 문제 아님
  - 위치: `interaction.service.ts:283-286`
  - 상세: 2단계는 재사용되는 조회 지점이 이 한 곳뿐이라(구조가 다른 컬럼 세트 2개) 별도 상수로 뽑아도 얻는 이득(오타 방지)이 낮고, 오히려 상수 두 개를 유지보수하는 비용이 더 크다. 1단계 상수화는 "3중 SoT"(직전 리뷰 W-2, 구현 리터럴이 여러 자리에서 반복)를 없애기 위함이었는데 2단계는 애초에 단일 사용처였으므로 같은 근거가 적용되지 않는다. `'id'`/`'conversationThread'` 는 `Execution` 엔티티 프로퍼티명과 정확히 일치(오기 없음, 직접 대조 확인). 인라인으로 남겨도 위험·불일치 없음.

- **[INFO]** 커넥션 점유·TOCTOU — fix 로 달라진 것 없음
  - 위치: `interaction.service.ts:289-302`
  - 상세: `Promise.all([executionRepository.findOne, nodeExecutionRepository.findOne])` 은 상수화 이전과 동일한 구조(순수 리팩터는 `select:` 값의 리터럴→식별자 치환뿐, 쿼리 로직·병렬화·트랜잭션 경계 무변경). 두 `findOne` 은 `QueryRunner` 를 공유하지 않는 독립 풀 커넥션 획득/반환이라 교착 위험 없음. TOCTOU 는 1단계↔2단계 사이 상태 변화 시에도 `threadRow?.conversationThread` 의 optional-chaining 이 "durable thread 없음" 경로로 graceful 하게 흡수(`interaction.service.spec.ts` 의 재조회 null 테스트로 커버). 직전 리뷰의 결론이 그대로 유효.

- **[INFO]** 인덱스 / 마이그레이션 — 영향 없음
  - 상세: 이번 fix 커밋(`f2764f3a9`)은 `interaction.service.ts` 45줄 변경 전부가 (a) 인라인 배열 리터럴 → 모듈 상수 치환, (b) JSDoc/주석 정밀화, (c) 신규 테스트 2건 뿐이다. 컬럼/인덱스/마이그레이션 파일 변경 없음. `git diff origin/main...HEAD --stat` 로 마이그레이션 디렉터리(`codebase/backend/src/migrations` 등) 변경분이 없음을 재확인.

- **[INFO]** SQL 인젝션 — 해당 없음
  - 상세: 모든 조회가 TypeORM `Repository.findOne({ where: { id }, select: [...] })` 파라미터화 API. raw SQL 조립 없음. 상수화는 문자열 배열의 출처만 바꿨을 뿐 조회 API 자체는 무변경.

## 요약

이번 fix 는 직전 라운드(위험도 LOW) 에서 지적된 "projection 리터럴 3중 SoT" 를 모듈 상수 `STATUS_PROJECTION_COLUMNS`(`satisfies (keyof Execution)[]`)로 승격한 순수 리팩터다. TypeORM 소스를 직접 추적해 `select` 배열이 읽기 전용으로만 소비됨을 확인했고(모듈 스코프 공유 배열이 요청 간 안전), `satisfies` 타이핑이 실제로 컬럼명 오기를 컴파일 타임에 차단하는지 독립적으로 tsc 재현까지 완료했다. 컬럼 집합은 fix 전후 정확히 동일하며 응답 조립에 쓰이는 모든 `execution.*` 필드(`updatedAt` fallback 포함)를 여전히 전량 커버한다. 2단계 조회의 인라인 `select` 유지는 단일 사용처라 상수화 비대상이며 문제가 아니다. `Promise.all` 두 쿼리의 커넥션 점유·TOCTOU 특성, 인덱스·마이그레이션 영향은 이번 fix 로 전혀 달라지지 않았다(직전 리뷰의 LOW 결론이 그대로 유효). Critical/Warning 없음.

## 위험도

NONE
