# 테스트(Testing) 리뷰 — 2026-09-08 13:34:28

## 검증 방법

정적 코드 리딩 + 관련 원본 파일 직접 열람(diff 가 생략된 파일 포함: `endpoint-path-conflict-wrap-guard.ts`,
`endpoint-path-conflict-wrap.spec.ts`, `pg-error.ts`, `workspaces.service.ts` 전체, `triggers.service.ts`
실제 호출부). 저장소 파일은 읽기만 했고 뮤테이션은 하지 않았다 — 리뷰 종료 시점 `git status --short`
에는 이 세션의 review 산출물 디렉터리(`review/code/.../13_34_28`, `review/consistency/.../13_34_30`)만
untracked 로 남아 있고, 코드 트리에는 변경이 없다.

이번 diff 는 직전 라운드(`review/code/2026/09/08/12_53_08`)의 testing 리뷰가 지적한 두 INFO
(callsite wrap-surface 회귀 테스트 부재, `_cmd_typecheck_ratchets` 배선 미검증)에 대한 **후속 조치**를
포함한다 — 전자는 `it.each` 로 두 표면(flat/wrapped)을 파라미터화해 수정됐고, 후자는 "이 저장소의
다른 `cmd_*` 조합도 전부 동일하게 미검증" 이라는 근거로 won't-do 처리됐다(수동 실행 로그로 1회
검증). 두 처분 모두 근거를 실측(grep/로그)으로 뒷받침하고 있어 재론하지 않는다.

## 발견사항

- **[INFO]** 신규 AST 가드의 커스텀 fixture 가 실제 발견된 회귀 형태(`const x = await repo.save(...).catch(wrapper)`)를 재현하지 않는다 — 규율은 지금 **암묵적으로 프로덕션 파일의 우연한 모양**에 의존한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/endpoint-path-save.fixture.ts` (양성/음성 대조군 전체), 관련 문서: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` 함수 `enclosingMethodName`(그 함수 바로 위 JSDoc 이 이 버그를 직접 서술)
  - 상세: `enclosingMethodName` 의 JSDoc 은 첫 판 결함을 정확히 지목한다 — "저장소의 두 정답 사이트(`const saved = await repo.save(t).catch(...)`)가 메서드 이름이 아니라 `saved` 로 키가 잡혔다." 실제로 `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `create`(약 423행)·`update`(약 510행 부근) 두 곳 모두 정확히 그 형태(`const saved = await this.triggerRepository.save(trigger).catch(...)`)다. 그런데 이 회귀를 방지하는 정적 대조군 `endpoint-path-save.fixture.ts` 에는 이 형태의 케이스가 **없다** — `wrappedSave()` 는 `await this.triggerRepository.save(t).catch(...)` 로 곧장 쓰여 있어 중간에 변수 선언이 끼지 않는다. 즉 "VariableDeclaration 의 initializer 가 화살표 함수일 때만 이름으로 삼는다"는 가드 로직의 핵심 분기(파일 44~53행께)가 커스텀 fixture 만으로는 **직접 재현되지 않고**, `endpoint-path-conflict-wrap.spec.ts` 가 `TRIGGERS_DIR` 실제 소스를 스캔하는 것을 통해서만 **간접적으로** 걸린다(그 두 실제 파일이 우연히 `const saved =` 형태이기 때문에 지금은 잡힌다). 프로덕션 코드가 나중에 `const saved = ` 패턴 없이 직접 `await ...save().catch()` 로 리팩터되면, 이 회귀 클래스의 유일한 안전망이 조용히 사라진다 — 이 저장소가 이미 겪은 "커스텀 corpus 가 형태를 못 잡는다"는 클래스(MEMORY: 생성 입력 vs 큐레이션 corpus)와 같은 결이다.
  - 제안: fixture 에 `async wrappedViaLocalConst(t: unknown): Promise<void> { const saved = await this.triggerRepository.save(t).catch((err: unknown) => this.rethrowEndpointPathConflict(err)); }` 형태의 양성 케이스를 추가해, `enclosingMethodName` 의 variable-declaration 분기가 프로덕션 파일의 우연한 모양이 아니라 fixture 자체로 고정되게 한다.

- **[INFO]** `.claude/test-stages.sh` 의 `_cmd_typecheck_ratchets → cmd_build` 배선은 harness 자동 테스트로 보호되지 않는다 (직전 라운드에서 이미 지적·won't-do 로 처분됨 — 참고용 재기재)
  - 위치: `.claude/test-stages.sh` 함수 `_cmd_typecheck_ratchets`, 호출부 `cmd_build()` 안의 `_cmd_typecheck_ratchets &&`
  - 상세: `scripts/_typecheck_ratchet.py` 코어는 `test_typecheck_ratchet.py` 로 두텁게 커버되지만 "`cmd_build` 가 실제로 이 함수를 호출하고 실패를 전파하는가"라는 배선 자체는 어떤 harness 테스트도 실행하지 않는다. `review/code/2026/09/08/12_53_08/RESOLUTION.md` INFO#8 이 "이 저장소의 다른 `cmd_*` 조합 전부가 동일하게 미검증"이라는 근거로 won't-do 처리했고, 실측 로그(`OK: backend 타입 진단 197건`, `OK: frontend 타입 진단 52건`)로 1회 수동 검증했다는 점도 확인했다. 근거가 합리적이라 차단 사유로 재상정하지 않는다.
  - 제안: 조치 불요(기존 처분 유지). 향후 `cmd_build` 를 다시 만질 기회에 `RUN_TEST_CONFIG` 스텁 패턴(`test_run_test_watchdog.py`)을 고려할 수 있다는 기존 제안을 유지.

## 잘 된 점 (참고)

- `http-exception.filter.spec.ts` 의 두 신설 테스트(raw 23505 / raw non-23505)는 기존 `QueryFailedError`(wrap) 케이스와 의도적으로 분리되어 판정이 넓어지거나 좁아지는 두 방향을 모두 잡는다. `afterEach(jest.restoreAllMocks)` 로 spy 누설도 없다.
- `workspaces.service.spec.ts` 의 `listMembers` 투영 테스트는 "반환 키가 좁다"(매핑 축)와 "쿼리가 `select` 로 요청했다"(DB 축)를 의도적으로 분리했다 — 직접 코드를 읽어 확인한 결과, `select` 를 제거해도 `.map()` 이 여전히 6키로 좁히므로 반환 키 단언만으로는 회귀를 못 잡는 구조가 맞고, 새로 추가된 `select` 단언이 정확히 그 갭을 메운다.
- `integration-oauth.service.{cafe24,makeshop}.spec.ts` 의 `it.each(raceErrorSurfaces)` 파라미터화는 flat/wrapped 두 표면을 명시적 대조쌍으로 만들어, `pgErrorConstraint()` 로의 리팩터가 callsite 배선까지 정확한지 직접 검증한다(직전 라운드 INFO#7 후속 조치, 코드 확인 결과 정확히 반영됨).
- `production-build-devdep.spec.ts` 의 `it.each` 파라미터화(`repo-guards`/`shared/testing`/`__test-utils__`)는 세 번째 반복 복사를 막고, `buildFiles` 를 `describe` 최상단에서 1회만 계산해 `tsconfig.build.json` 재파싱·800여 파일 glob 재해석 반복을 없앴다.
- `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/`fixture.ts` 3분할은 "현재 저장소가 규칙을 지킨다"와 "이 함수가 위반을 실제로 잡는다"를 대조군(`catchButNotWrapping`, `mentionsButDoesNotCall`, `otherRepositorySave`, `twoSaves`)으로 정확히 갈랐다 — vacuous guard 방지 패턴이 잘 적용됨(단, 위 INFO#1 이 지적하듯 정확히 하나의 실제 회귀 형태만 fixture 밖에 남아 있다).
- `webhook-trigger.e2e-spec.ts` B4 는 단위 mock 이 원리적으로 검증 못 하는 실 DB UNIQUE 제약 경로를 짚었고, `details` 키를 부분이 아니라 객체 전체로 단언해 부분 유실을 방지하며, 드라이버 원문 비노출까지 함께 검사한다.
- `WorkflowVersionDetail → WorkflowVersionDetailProjection` 개명은 순수 리네임이라 별도 테스트가 필요 없고, 실제로 `grep` 확인 결과 이 타입을 참조하는 `.spec.ts` 는 저장소에 없어 회귀 위험이 없다.

## 요약

이번 배치는 프로덕션 코드 변화(전역 예외 필터 raw-surface 회귀 수정, `listMembers` DB 투영 전환, 트리거 `endpointPath` 충돌 래핑 AST 래칫, `__test-utils__` 빌드 제외) 전부에 대응하는 신규·갱신 테스트를 동반하고, 직전 라운드 리뷰가 지적한 두 갭 중 실질적인 하나(callsite wrap-surface 회귀)는 `it.each` 파라미터화로 정확히 메웠다. 이번 라운드에서 직접 소스를 열어 확인한 결과 새로 발견한 갭은 하나뿐이다 — AST 가드의 커스텀 fixture 가 실제 이력에 있는 회귀 형태(`const x = await save().catch()`)를 스스로 재현하지 않고 프로덕션 파일의 우연한 모양에 의존해 간접적으로만 커버된다는 점(INFO). 나머지 하나는 직전 라운드에서 이미 근거와 함께 won't-do 처리된 항목의 재확인이다. Mock 사용은 실제 TypeORM 에러 표면(flat/wrapped) 두 축을 정확히 반영하고, 테스트 격리(매 테스트 `beforeEach` 로 fresh `TestingModule`)와 가독성(주석이 "무엇을 놓칠 뻔했는지"를 명시)도 이 저장소의 확립된 관례를 잘 따른다. Critical/Warning 급 발견사항 없음, 차단 사유 없음.

## 위험도

LOW
