# 테스트(Testing) 리뷰 — Swagger DTO 계약 가드 + 공유 픽스처 헬퍼 (3R)

이번 라운드는 1R/2R 에서 이미 지적·수정된 항목(W1~W5)이 반영된 이후 상태를 리뷰한다.
`codebase/backend`에서 관련 spec 을 직접 실행해 회귀 여부를 실측했다(`npx jest
src/repo-guards/__tests__/ src/common/__test-utils__/` → **12 suites / 218 tests 전부 PASS**,
`npx jest` 대상에 `swagger-dto-contract.spec.ts`·`source-scan.spec.ts`·`temp-fixture.spec.ts`·
`nullable-type-lie-cast.spec.ts` 포함해 **4 suites / 94 tests PASS** 별도 확인). 저장소 트리는
건드리지 않았다(`git status --short` 로 확인 — 다른 reviewer 산출물 외 변경 없음).

## 발견사항

- **[WARNING]** `temp-fixture.spec.ts` 의 "async 콜백이 실패해도…" 테스트가 실제로는 **실패(reject)를 한 번도 일으키지 않는다** — 진짜 reject 시 발생하는 unhandled rejection 경로가 미검증
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.spec.ts:63-72` (`it('async 콜백이 실패해도 tmpdir 은 그대로 지워진다 — finally 는 여전히 돈다', …)`), 관련 구현: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:56-68` (`withFiles` 의 `try { … isThenable(result) … } finally { rmSync }`)
  - 상세: 이 테스트의 콜백은 `async (paths) => { capturedDir = paths['a.ts']; return 1; }` 다 — `throw`/`reject` 를 전혀 하지 않는다. `async` 함수는 성공적으로 `return` 해도 항상 `Promise` 로 감싸 반환하므로, `isThenable(result)` 는 성공/실패와 무관하게 항상 참이 되고 `withFiles` 는 곧바로 "동기 콜백만 지원" 에러를 던진다. 즉 이 테스트는 **바로 위 테스트("async(thenable 반환)…")와 동일한 코드 경로**(성공적으로 resolve 되는 thenable)를 이름만 바꿔 다시 도는 것이고, 테스트 이름이 약속하는 "콜백이 실패해도" 라는 시나리오(콜백이 실제로 `throw`/reject 하는 경우)는 어디에서도 실행되지 않는다.
    `isThenable` 체크가 콜백의 반환값을 **await 하지 않고 동기적으로** 검사하기 때문에, 실제로 reject 하는 async 콜백(`async () => { throw new Error('진짜 실패') }`)을 넘기면 두 가지가 동시에 일어난다 — (1) `withFiles` 는 여전히 "동기 콜백만 지원" 이라는 **엉뚱한** 에러로 동기 throw 하고, (2) 콜백이 실제로 낸 원인 에러는 아무도 `.catch()` 하지 않아 **unhandled promise rejection** 으로 남는다. 이 두 번째 결과는 `node`(및 실측상 동일 로직을 복제한 스크립트)로 직접 재현해 확인했다 — `withFiles` 가 동기적으로 throw 한 *뒤에* `UNHANDLED REJECTION observed: 진짜 실패 사유` 가 별도로 관측된다. Jest 환경에서 이는 다른(나중) 테스트에 귀속되는 경고/실패로 새는 전형적 패턴이다. 이 부작용은 어떤 테스트도 겨누지 않는다.
  - 제안: 테스트 이름과 시나리오를 분리한다. (1) 지금 있는 테스트는 "성공 반환값이 숫자여도 thenable 이면 동일하게 막힌다" 정도로 이름을 정정하거나 삭제(이미 앞 테스트와 중복)하고, (2) `async (paths) => { capturedDir = paths['a.ts']; throw new Error('진짜 실패'); }` 처럼 실제로 reject 하는 콜백을 별도 케이스로 추가해, `withFiles` 가 여전히 (엉뚱한 메시지로) throw 하는지 + `process.on('unhandledRejection', …)` 로 원인 에러가 새는지(또는 새지 않도록 향후 `.catch(() => {})` 를 콜백 반환값에 붙여 억제하는지)를 명시적으로 검증한다. 최소한 `temp-fixture.ts` 의 JSDoc(32-42행)에 "reject 하는 콜백은 원인 에러가 unhandled rejection 으로 새고, `withFiles` 는 그와 무관하게 항상 '동기 콜백만 지원' 메시지로 throw 한다" 를 명시하면 다음 소비처가 디버깅할 때 헤매지 않는다.

- **[INFO]** `swagger-dto-contract-guard.ts` 의 `readBooleanOption` 이 non-literal boolean(상수 참조)을 테스트하지 않음 — 1R/2R 부터 이어지는 기지(既知) 갭, 재확인만
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:58-74` (`readBooleanOption`), 소비 spec: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` 전체(해당 케이스 없음)
  - 상세: `nullable: SOME_CONST` 처럼 `TrueKeyword`/`FalseKeyword` 가 아닌 표현식이면 `undefined` 로 처리돼 조용히 미판정된다. 이전 라운드(`api_contract.md`/`maintainability.md` INFO)에서 이미 지적됐고 "저장소 실사례 0건이라 급하지 않음" 으로 처분된 항목이라 이번 라운드에서 새로 발견한 것은 아니다 — 상태 변화 없음을 확인하는 차원에서만 재기재한다.
  - 제안: 기존 처분(급하지 않음) 유지. 재부팅 불필요.

- **[INFO]** `hasTopLevelNull` 의 `ParenthesizedTypeNode` 미언랩 — 동일하게 기지 갭, 재확인만
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:83-90` (`hasTopLevelNull`)
  - 상세: `field: (string | null);` 형태는 최상위 노드가 `ParenthesizedTypeNode` 라 `ts.isUnionTypeNode` 가 거짓이 되어 위음성이 난다. 이전 라운드에서 이미 지적·확인(실사례 0건)된 항목으로, 이번 diff 에서 변화 없다.
  - 제안: 기존 처분(급하지 않음) 유지.

## 회귀·격리·가독성·Mock 평가 (양호 — 새로 지적할 결함 없음)

- `swagger-dto-contract.spec.ts`·`nullable-type-lie-cast.spec.ts`·`temp-fixture.spec.ts`·`source-scan.spec.ts` 전부 mock 없이 실제 `typescript` AST 파서 + 실제 `fs`/tmpdir 로 동작한다. 판정 로직과 실제 컴파일러/파일시스템 동작 사이의 괴리 위험이 없다.
- 신규 `[캐너리] @nestjs/swagger 별칭 가정이 살아있는가`(`swagger-dto-contract.spec.ts:256-276`)는 `effectiveRequired` 계산이 딛고 선 "`ApiPropertyOptional` = `ApiProperty({required:false})` 별칭" 가정을 **실제 데코레이터를 호출**해 `Reflect` 메타데이터로 검증한다 — 1R WARNING(architecture, canary 부재)이 정확히 반영됐다.
- 신규 `[대조군] 실패 위치(line/file) 보고`(`swagger-dto-contract.spec.ts:219-238`)는 `ContractMismatch.line`/`.file` 을 `axis` 만이 아니라 직접 단언하며, 데코레이터 줄과 필드 선언 줄을 픽스처에서 일부러 분리해 `node.getStart(sf)` 가 데코레이터 줄을 반환한다는 사실 자체를 고정한다 — 1R WARNING(testing W5)이 정확히 반영됐다.
- `source-scan.spec.ts` 의 신규 `toPosixPath`/`toPosixRelative` 대조군(`:350-370`)은 뮤테이션으로 실측 검증됐다(2R RESOLUTION: 뮤턴트 주입 시 RED 3스위트 7건, 원복 시 GREEN). 윈도우 분기(`toPosixRelative(...,'\\')`)가 POSIX `path.relative` 로는 겨눌 수 없다는 실패 경험을 문자열 변환(`toPosixPath`) 분리로 해결한 설계도 근거가 명확하다.
- `nullable-type-lie-cast.spec.ts` 의 로컬 `withFiles` 제거 → 공유 `temp-fixture.ts` 위임은 골격이 동일해 회귀가 없다(직접 실행 확인, 40여 케이스 전부 PASS).
- 각 테스트가 독립된 `mkdtempSync` 디렉터리를 받고 `finally` 로 정리하므로 테스트 간 격리가 보장된다. 순서 의존 없음.
- `[전제]`(vacuous-test guard) 패턴이 `swagger-dto-contract.spec.ts`·`nullable-type-lie-cast.spec.ts` 양쪽에 일관 적용돼 "빈 목록이라 통과했다" 는 거짓 GREEN을 구조적으로 차단한다.
- `swagger-dto-contract.spec.ts` 의 전수 스캔 단언(`findSwaggerContractMismatches(files, SRC_ROOT)).toEqual([])`)이 `background-run-response.dto.ts`·`create-assistant-session.dto.ts` 두 DTO 파일 각각에 대한 별도 유닛 테스트를 대신하는 구조다 — 신규 DTO 파일 전용 테스트가 없다고 해서 커버리지 갭은 아니다(실측: 두 DTO 를 원상태로 되돌리면 이 스캔 테스트가 즉시 RED — 별도 검증은 생략, 1R RESOLUTION 의 실측치와 정합).

## 요약

3R 시점 상태는 1R/2R 에서 지적된 실질 결함(비공개 구현 canary 부재, line/file 미검증, 경로 정규화 미테스트) 을 모두 뮤테이션 검증까지 곁들여 반영했다. 이번 라운드에서 새로 발견한 것은 `temp-fixture.spec.ts` 의 "async 콜백이 실패해도…" 테스트 1건뿐이다 — 이름이 약속하는 시나리오(콜백이 실제로 reject)를 실행하지 않고 앞 테스트와 같은 "성공적으로 resolve 되는 thenable" 경로를 다시 돌아, 실제 reject 시 발생하는 unhandled promise rejection(원인 에러가 새는 문제)이 무방비 상태로 남아 있다. 나머지는 이전 라운드에서 이미 저위험으로 처분된 기지 갭(non-literal boolean, 괄호-유니온)의 상태 무변화 확인뿐이다. 블로킹할 결함은 없다.

## 위험도

LOW
