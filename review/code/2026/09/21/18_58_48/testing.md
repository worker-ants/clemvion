# 테스트(Testing) 리뷰 — WebAuthn credential 동시 삭제 (아홉 번째/마지막 자리) + 후속 WARNING 3건 조치

## 검증 방법

`codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`·`webauthn.service.spec.ts`·
`codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` 를 저장소에서 직접
Read 로 전문 열람했다(뮤테이션 없음, `git status --short` 로 세션 중 변경 0건 확인). 이번 라운드
직전 두 리뷰 산출물(`review/code/2026/09/21/18_03_54/testing.md`, `review/code/2026/09/21/18_31_57/testing.md`)
도 열어 이미 지적된 항목이 이번 diff(스코프에 포함된 커밋들: `89566e3d5`·`ee6fd5d56`·`7b71e9a4a`)에서
실제로 해소됐는지 코드와 직접 대조했다. `webauthn.controller.spec.ts:258` 의 교차 참조 테스트,
`_test_logs/e2e-20260921-185322.log` 의 실측 수치(`Tests: 378 passed, 378 total`,
`PASS test/webauthn-credential-delete-concurrency.e2e-spec.ts`)도 직접 확인했다.

## 발견사항

- **[INFO]** 직전 라운드(`18_31_57/testing.md`)가 WARNING 으로 지적한 "두 번째 e2e 의 판별력
  (vacuity) 가드 부재"가 이번 diff 로 실제로 해소됨을 확인 — 회귀 없음
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` 함수
    `it('서로 다른 credential 두 개를 동시 삭제해도 복구 코드는 NULL 로 수렴한다 (WARNING #4 반증)')`
  - 상세: 이전 라운드에서는 이 테스트가 `Promise.all([fireDelete(idA), fireDelete(idB)])` 만
    발사하고 실제로 두 DELETE 가 겹쳤는지 확인하는 장치가 없어, "e2e 로 고정한다"는 docblock
    서술이 실제 보장 수준보다 강했다. 현재 코드는 `locker.query('SELECT id FROM webauthn_credential
    WHERE id = ANY($1::uuid[]) FOR UPDATE', [[idA, idB]])` 로 두 대상 행을 모두 잠근 뒤,
    첫 번째 테스트와 동일한 `Promise.race` 기반 1.5초 공허성 가드(`expect(raced).toBe('pending')`)를
    추가해 락을 놓기 전 두 요청이 실제로 아직 끝나지 않았음을 관측한다. docblock 도 "이 논증은
    두 요청이 실제로 겹칠 때만 검증력이 있다"·"겹침을 강제한 상태에서 e2e 로 고정한다"로
    갱신되어 실제 보장 범위와 서술이 일치한다. 이 가드가 없다면 락 대기 없이 즉시 처리되어
    `raced` 가 `'settled'` 가 되고 그 자리에서 `expect(raced).toBe('pending')` 이 실패해
    스위트를 FAIL 로 만들었을 것 — 즉 이 가드는 그 자체로 반증 가능한 형태다.
  - 제안: 없음 — 이미 적절히 해소됨. 새로 지적할 사항 아님.

- **[INFO]** `renameCredential`/`deleteCredential` 의 "credential 자체가 존재하지 않음"
  (`findOne` → `null`) 분기가 단위 테스트로 직접 커버되지 않음 — 이번 diff 이전부터 있던 갭,
  이미 `18_31_57/testing.md` 에 동일 내용이 INFO 로 등재돼 비차단 처리됨
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` 함수
    `deleteCredential`(`if (!credential || credential.userId !== userId)`) / `renameCredential`
    (분리된 두 개의 `if (!credential)`·`if (credential.userId !== userId)`)
  - 상세: `webauthn.service.spec.ts` 의 `deleteCredential`·`renameCredential` 각 describe 블록은
    모두 "존재하지만 소유자가 다름"(`findOne` 이 `{ id, userId: 'someone-else' }` 반환) 케이스만
    재현하고, `findOne` 이 진짜 `null` 을 반환하는 케이스를 명시적으로 세팅하는 테스트가 없다.
    `deleteCredential` 은 단일 OR 조건이라, `!credential` 좌변을 항상 `false` 로 만드는 뮤턴트가
    있어도 우측(소유자 다름 케이스에서 참)만으로 같은 404 로 수렴해 이 뮤턴트를 잡지 못한다(다만
    실제로 `null` 이 오는 상황에서는 `credential.userId` 접근에서 TypeError 가 나 다른 방식으로
    드러날 가능성이 높아 silent pass 는 아니다). 이번 diff 는 이 조건 구조 자체를 바꾸지 않고
    인라인 `throw` 를 `throwCredentialNotFound()` 호출로 추출했을 뿐이므로 새로 도입된 회귀는
    아니지만, 그 추출로 "네 호출 지점이 공유하는 단일 지점"이 됐다는 점에서 그 네 지점 모두를
    커버하는 좋은 기회였다.
  - 제안: 필수 아님(이번 PR 착수/병합 차단 사유 아님, 이미 이전 라운드에서 동일 판정) —
    다음에 이 영역을 만질 때 `credentialRepo.findOne.mockResolvedValue(null)` 케이스를
    `deleteCredential`·`renameCredential` 양쪽에 추가할 것을 고려.

## 확인된 강점 (긍정 소견, 회귀 없음 확인)

- **핵심 판정 조건의 대조군 테스트가 여전히 견고하다.** `it.each([[undefined], [null]])`
  (`webauthn.service.spec.ts` `describe('동시 삭제')`)가 `#1371` 에서 대조군 부재로 `!affected`
  뮤턴트 32건이 통과했던 실패를 정확히 재발 방지하는 형태로 남아 있다.
- **소유권 스코프 강화 단언이 완전 일치(`toHaveBeenCalledWith`)로 잠겨 있다.** `userId` 필드
  하나만 빠뜨리는 뮤턴트도 검출 가능한 형태이고, 실제 프로덕션 코드(`credentialRepo.delete({
  id: credentialUuid, userId })`)와 정확히 일치함을 직접 대조했다.
  - 다만 이 assertion 은 mock 호출 인자만 검증하는 단위 테스트 차원의 보증이며, 실제 DB
    조건절이 `userId` 불일치 시 실제로 행을 지우지 못하게 하는지는 e2e/통합 레벨에서 별도로
    검증되지 않는다(다른 사용자 소유 credential 삭제 시도는 이미 `findOne` 뒤 JS 비교에서
    먼저 걸려 DB 조건절의 `userId` 값이 실제로 방어선 역할을 하는 시나리오까지는 도달하지
    않는다). TOCTOU 창이 극히 좁아 실무적 우선순위는 낮다고 판단해 INFO 로도 별도 등재하지
    않았다 — 다만 이 자리를 다시 만질 사람을 위해 기록만 남긴다.
- **진 쪽 short-circuit 이 음성 단언까지 커버한다.** `credentialRepo.count`·`usersService.update`
  가 호출되지 않았음을 명시적으로 확인해 "404 를 던지긴 하는데 부수 쓰기가 여전히 실행되는"
  형태의 회귀를 방지한다. 실제 코드(`affected === 0` 이면 `countCredentials` 호출 전에 throw)와
  일치함을 직접 확인했다.
- **감사 책임 소재 교차 참조가 실제와 맞는다.** `describe('동시 삭제')` docblock 이 인용하는
  `webauthn.controller.spec.ts:258` `does not record an audit log when deleteCredential
  throws` 테스트가 실제로 존재하고 의도한 시나리오(서비스가 던지면 컨트롤러가 감사에 도달하지
  않음)를 검증함을 확인했다.
- **회귀 안전성.** 기존 `deleteCredential` 테스트 3건·`renameCredential` 테스트 2건은
  `beforeEach` 의 기본 `delete: jest.fn().mockResolvedValue({ affected: 1 })` 덕분에 새 `affected`
  판정 분기와 충돌하지 않고 그대로 통과한다.
- **테스트 격리.** `jest.clearAllMocks()`(전역 `beforeEach`)와 `TestingModule` 매 테스트 재컴파일로
  `mockResolvedValueOnce` 같은 1회성 override 가 다른 테스트로 새지 않는다. e2e 쪽도 별도
  사용자(`uniqueEmail`)로 격리해 첫 번째 테스트의 `survivor` credential 과 섞이지 않는다.
- **측정 수치 정합성.** RESOLUTION 이 주장하는 "e2e 378 PASS" 를 `_test_logs/e2e-20260921-185322.log`
  로 직접 대조해 일치함을 확인했다(과장된 측정 주장 없음).

## 요약

이번 라운드의 diff(WARNING#1~#3 조치: 두 번째 e2e 공허성 가드 추가, plan 줄 번호 인용 정정,
CHANGELOG 취소선 보강)는 테스트 관점에서 직전 라운드가 지적한 유일한 WARNING(판별력 없는
"논증 반증형" e2e 캐너리)을 코드로 정확히 해소했다 — 실제로 가드가 반증 가능한 형태로
구현됐음을 확인했다. 핵심 결함 수정(`affected === 0` 명시 비교, DELETE 조건절 `userId` 스코프)에
대한 단위·e2e 테스트는 대조군·공허성 가드·부수 쓰기 음성 단언·감사 책임 소재 교차 참조까지
포함해 여전히 견고하며 회귀도 없다. 유일하게 남은 것은 이전 라운드에서 이미 INFO 로 기록되고
비차단 처리된 사전 존재 갭(`!credential` 완전 부재 분기의 명시적 단위 테스트 부재)뿐이며, 이번
diff 가 새로 만든 문제가 아니다. 이번 PR 을 테스트 관점에서 막을 사유는 없다.

## 위험도

NONE
