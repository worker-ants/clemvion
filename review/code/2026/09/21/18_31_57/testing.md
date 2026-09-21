# 테스트(Testing) 리뷰 — WebAuthn credential 동시 삭제 (아홉 번째/마지막 자리) + 후속 조치(CHANGELOG·헬퍼 추출·WARNING #4 반증)

## 검증 방법

`webauthn.service.spec.ts`·`webauthn.service.ts`·`webauthn-credential-delete-concurrency.e2e-spec.ts`
를 저장소에서 직접 읽고, `beforeEach` 의 mock 재구성 방식(`jest.clearAllMocks()` +
`TestingModule` 매 테스트 재컴파일)까지 확인했다. `_test_logs/e2e-20260921-175842.log`·
`_test_logs/e2e-20260921-182519.log`·`_test_logs/unit-20260921-182123.log` 를 열어 plan/PR 이
주장하는 테스트 통과 수치(unit 9929 passed·e2e 377→378 passed, 신규 파일
`webauthn-credential-delete-concurrency.e2e-spec.ts` PASS 포함)를 실측 로그와 대조해 일치함을
확인했다. `webauthn.controller.spec.ts:258` 의 `does not record an audit log when
deleteCredential throws` 케이스도 직접 열어 docblock 의 교차 참조가 실제와 맞는지 확인했다.
`git show ebab5197f:...webauthn.service.ts` 로 착수 전 버전을 대조해 어떤 구조가 이번 diff
이전부터 있었는지(사전 존재 여부)를 가렸다. 저장소 파일은 읽기만 했고 뮤테이션·수정은 하지
않았다 (`git status --short` 로 세션 중 변경 없음 확인).

## 발견사항

- **[WARNING]** 신규 e2e 두 번째 테스트("WARNING #4 반증")에 판별력(vacuity) 가드가 없어 —
  "캐너리" 라는 서술이 실제 보장 수준보다 강하다
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:140-188`
    (특히 `177-178` 행의 `Promise.all([fireDelete(idA), fireDelete(idB)])`)
  - 상세: 같은 파일의 첫 번째 테스트(`52-118`행)는 `SELECT ... FOR UPDATE` 로 겹침을 강제로
    만들고, `Promise.race`(`88-94`행)로 "락을 놓기 **전에** 둘 다 아직 끝나지 않았음"을 관측하는
    공허성 가드를 둔다 — 이 가드가 없으면 fixture 가 겹침을 못 만들어도 조용히 초록이 된다는
    점을 그 파일 자신의 주석이 명시한다. 반면 두 번째 테스트는 서로 다른 두 credential 을
    대상으로 하므로 "공유 락으로 줄 세울 지점이 없다"(177행 주석)는 이유로 이 가드를 아예
    생략했다. docblock(`120-138`행)은 이를 "이 테스트는 그 산술을 e2e 로 **고정한다**" · "위
    순서 논증의 전제를 깨면 그때 **RED 가 되는 캐너리**" 라고 결정론적으로 서술하지만, 실제로는
    두 DELETE 요청이 DB 레벨에서 실제로 겹치는지(서로의 미커밋 상태를 관측하는지)를 이 테스트가
    전혀 강제하거나 확인하지 않는다.
    docblock 의 수학적 증명 자체는 "어떤 인터리빙이든" 최종적으로 NULL 로 수렴함을 보이므로
    현재 구현에 대해서는(완전 순차 처리든 겹치든) 테스트가 항상 통과하는 것이 맞다. 문제는 반대
    방향이다 — 이 테스트가 캐너리로 잡으려는 회귀(예: `deleteCredential` 을 트랜잭션으로 감싸
    delete 커밋을 count 시점까지 지연)는 **두 요청이 실제로 겹칠 때만** 재현되는데, 이벤트
    루프·커넥션 풀 스케줄링에 의해 두 요청이 우연히 순차 처리되면(R1 이 delete+count+update 를
    전부 커밋한 뒤 R2 가 시작) 회귀가 실제로 존재해도 이 테스트는 여전히 통과할 수 있다. 즉
    "고정한다"·"RED 가 되는 캐너리" 라는 표현이 이 테스트가 실제로 제공하는 보장(순차 처리 시
    수렴은 항상 참, 겹침 시에만 회귀를 잡을 수 있음)보다 강하게 서술돼 있다 — 통과가 "그 순서
    논증이 유지되고 있음" 의 증거가 아니라 "우연히 순차 처리됐거나 겹쳐도 아직 안전함" 의
    증거일 수 있다는 뜻이라 결정론성이 부족하다.
  - 제안: (1) 최소한 docblock 의 표현을 "겹칠 경우에 한해 고정한다"·"결정론적 재현이 아니라
    확률적 캐너리" 로 낮춰 실제 보장 범위를 정확히 서술하거나, (2) 두 요청이 유의미하게
    겹쳤음을 사후에라도 관측하는 장치(예: 각 요청 시작/종료 타임스탬프를 응답에 실어 겹치는
    구간이 있었는지 별도로 로그·soft-assert)를 추가할 것. 완전한 강제가 어렵다면 최소 이
    한계를 명시적으로 인정해 다음 사람이 "이 테스트가 초록 == 트랜잭션 회귀 없음" 으로
    과신하지 않게 해야 한다.

- **[INFO]** `deleteCredential`/`renameCredential` 의 순수 "credential 자체가 존재하지 않음"
  (`findOne` → `null`) 분기가 단위 테스트로 직접 커버되지 않음 — 이번 diff 이전부터 있던 갭
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:541`
    (`if (!credential || credential.userId !== userId) { this.throwCredentialNotFound(); }`,
    `deleteCredential`) / `:495`·`:499` (`renameCredential` 의 분리된 두 `if`)
  - 상세: `git show ebab5197f:...webauthn.service.ts` 로 착수 전 코드를 대조하면 이 조건
    구조(`deleteCredential` 은 단일 OR, `renameCredential` 은 분리된 두 `if`)는 이번 PR 이전부터
    동일하고, 이번 diff 는 그 안의 인라인 `throw` 를 `this.throwCredentialNotFound()` 호출로
    바꿨을 뿐이다. 그런데 기존 단위 테스트(`webauthn.service.spec.ts` 의 "throws NotFound for
    other user credential" 계열, `deleteCredential`/`renameCredential` 각 describe 블록)는
    두 메서드 모두 **"존재하지만 소유자가 다름"** 케이스(`findOne` 이 `{id, userId: 'someone-else'}`
    를 반환)만 재현하고, `findOne` 이 진짜 `null` 을 반환하는 **"credential 자체가 없음"** 케이스는
    어느 describe 블록에도 없다. `deleteCredential` 은 `!credential || credential.userId !== userId`
    가 단일 OR 조건이라, `!credential` 좌변을 뒤집는(항상 `false` 로 만드는) 뮤턴트가 있어도
    우측 조건(소유자 다름 테스트에서 참)만으로 여전히 같은 404 분기를 타 이 뮤턴트를 검출하지
    못한다(다만 실제 null 케이스가 오면 `credential.userId` 접근에서 TypeError 가 나 다른
    방식으로 드러날 가능성이 높다 — silent pass 는 아니다).
    이번 PR 이 새로 만든 코드 경로는 아니지만, 이번 PR 이 정확히 이 두 지점의 `throw` 문을
    공유 헬퍼로 추출해 "네 곳이 공유하는 단일 지점"(JSDoc 에 명시)으로 만들었으므로, 그 단일
    지점이 실제로 네 가지 호출 상황 모두에서 검증됐는지 점검할 좋은 기회였다.
  - 제안: 필수 아님(이번 PR 착수/병합 차단 사유 아님) — 다음에 이 영역을 만질 때
    `credentialRepo.findOne.mockResolvedValue(null)` 을 명시하는 케이스를
    `deleteCredential`·`renameCredential` 양쪽에 추가해 `!credential` 분기 자체도 뮤턴트로
    반증 가능하게 만들 것을 고려.

## 확인된 강점 (긍정 소견, 회귀 없음 확인)

- **단위 테스트 통제군·판정 조건 커버리지는 여전히 견고하다.** `it.each([[undefined], [null]])`
  (게이트 550~561행)가 `#1371` 재발 방지 규율을 정확히 지키고, `소유자로 스코프한 DELETE 를
  친다`(517~527행)는 `toHaveBeenCalledWith({ id, userId })` 완전 일치로 `userId` 누락 뮤턴트까지
  잡는다. plan 체크리스트(`webauthn-dup-delete.md` §체크리스트)의 뮤턴트 예측(대조군 2건
  RED·404 분기 제거 1건 RED)도 실측과 일치함을 확인했다.
- **`throwCredentialNotFound()` 헬퍼 추출은 테스트 부담을 오히려 줄인다.** 네 호출 지점이 하나의
  private 메서드를 공유하게 되어, 그 중 하나(`동시 삭제` 진 쪽 테스트, `534~538`행)의
  `code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND'` 단언이 사실상 네 곳 모두의 에러 페이로드를 대표
  검증한다 — 각 호출부마다 코드 문자열을 반복 단언할 필요가 없어졌다(단, 위 INFO 의 `!credential`
  분기 자체는 여전히 별도 커버리지가 필요).
- **회귀 확인.** 기존 `deleteCredential` 테스트 3건(480~507행)과 `renameCredential` 테스트
  2건(566~586행)은 `beforeEach` 의 기본 `delete: jest.fn().mockResolvedValue({ affected: 1 })`
  덕분에 새 `affected` 판정 분기와 충돌하지 않고 그대로 통과한다 — 실측 로그(unit 9929 passed,
  실패 0)로도 확인.
- **테스트 격리.** `beforeEach` 가 `credentialRepo` 등 모든 mock 객체를 매번 새로 만들고
  `TestingModule` 도 매 테스트 재컴파일하므로, `mockResolvedValueOnce` 같은 1회성 override 가
  다른 테스트로 새는 경로가 없다.
- **측정 수치 정합성.** plan/RESOLUTION 이 주장하는 "e2e 377→378 PASS", "unit 통과" 등의 수치를
  실제 로그(`_test_logs/e2e-20260921-175842.log:599`, `_test_logs/e2e-20260921-182519.log:612`,
  `_test_logs/unit-20260921-182123.log:1236`)와 대조해 모두 일치함을 확인했다 — 과장된 측정
  주장은 없다.
- **감사 책임 소재 교차 참조가 실제와 맞는다.** 신규 unit describe 블록의 docblock(게이트
  509~515행)이 인용하는 `webauthn.controller.spec.ts` 의 `does not record an audit log when
  deleteCredential throws`(258행)를 직접 열어 실제로 존재하고 의도한 시나리오를 검증함을
  확인했다.

## 요약

이번 diff(CHANGELOG 추가·`throwCredentialNotFound()` 헬퍼 추출·JSDoc `@throws` 보강·WARNING #4
반증 e2e 추가)는 직전 라운드(`review/code/2026/09/21/18_03_54`)가 지적한 WARNING 들을 코드·테스트
양쪽에서 실제로 해소했고, 핵심 결함 수정 자체의 단위/e2e 커버리지는 대조군·공허성 가드·뮤턴트
검증까지 포함해 여전히 견고하다. 다만 새로 추가된 두 번째 e2e 테스트("서로 다른 credential 두
개를 동시 삭제해도 복구 코드는 NULL 로 수렴한다")는 같은 파일의 첫 번째 테스트와 달리 실제 DB
레벨 겹침을 강제하거나 확인하는 장치가 없어, docblock 이 주장하는 "e2e 로 고정한다"는 결정론적
캐너리 효과를 실제로 보장하지 못할 수 있다 — 이는 이 PR 을 막을 사안은 아니지만 다음에 유사한
"논증 반증형" 캐너리를 쓸 때 반복될 수 있는 방법론적 갭이라 WARNING 으로 남긴다. 그 외에는
`!credential` 단독 분기의 커버리지 부재(사전 존재, 비차단)를 INFO 로 기록한다.

## 위험도

LOW
