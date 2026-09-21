# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `WEBAUTHN_CREDENTIAL_NOT_FOUND` `NotFoundException` 객체 리터럴이 한 파일에 5회
  중복되고, 그중 2회는 같은 함수 안에 25줄 간격으로 존재한다. 형제 PR(같은 결함 클래스, #1369~#1375)이
  고친 두 파일은 이미 이 중복을 헬퍼로 걷어냈는데, 이번 파일만 인라인을 유지해 시리즈 내
  일관성이 깨졌다.
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:497-500`,
    `:503-506` (`renameCredential`, 두 분기가 완전히 동일한 리터럴), `:527-530`
    (`deleteCredential` 기존 소유권 체크), `:554-557` (`deleteCredential` 신규 `affected===0`
    체크 — 이번 diff 로 추가된 5번째 사본).
  - 상세: 직접 grep 확인 결과 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드를 담은 객체 리터럴이
    파일 내 5곳(401 라인의 `UnauthorizedException` 1곳 포함)에 등장한다. 반면 같은 결함 클래스를
    고친 `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 는
    `private throwAuthConfigNotFound(): never { throw new NotFoundException({...}); }` 를 두고
    호출부 두 곳(`:137`, `:327`)에서 `this.throwAuthConfigNotFound()` 한 줄로 대체했고,
    `codebase/backend/src/modules/model-config/model-config.service.ts` 도 동일하게
    `this.notFound()` 헬퍼를 쓴다. 이번 PR 은 바로 그 두 형제와 같은 시리즈(같은 커밋 메시지
    패턴 "형제 여덟(#1369~#1375)")이고, `deleteCredential` 을 직접 편집하는 김에 헬퍼로 추출할
    자연스러운 기회였는데 놓쳤다. (다만 401 을 던지는 `verifyAuthentication` 자리는 예외 타입이
    달라 `NotFoundException` 전용 헬퍼로는 커버되지 않는다 — 이 401/404 불일치 자체는 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 별도 planner 항목으로
    등재돼 있으므로 여기서는 순수 `NotFoundException` 4곳의 중복만을 지적한다.)
  - 제안: `renameCredential`·`deleteCredential` 의 4개 `NotFoundException` throw 를
    `private throwCredentialNotFound(): never { throw new NotFoundException({ code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND', message: '인증기를 찾을 수 없어요.' }); }` 로 추출해 형제 두 파일과
    동일한 패턴으로 맞춘다. 비용이 낮고(문자열 리터럴 그대로 이동) 시리즈 전체의 일관성을
    회복한다.

- **[INFO]** `deleteCredential` 안에 17줄짜리 주석 블록(결함 배경·형제 비교·판정 근거·조건절
  변경 이유)이 실제 변경 코드(약 3~4줄)보다 훨씬 길어, 함수를 읽을 때 제어 흐름
  (`ownership 체크 → delete → affected 체크 → count → recovery 코드 처리`)이 한눈에 들어오지
  않는다.
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:532-548`.
  - 상세: 다만 이 스타일은 이번 PR 만의 문제가 아니라 같은 결함 시리즈의 다른 두 파일
    (`auth-configs.service.ts:302-326`, `model-config.service.ts:410-424`)에서도 동일한
    분량·형식(“위 `findOne`/`findById`/`findEntity` 는 잠그지 않으므로…”, “판정은 `affected === 0`
    명시 비교다…”)으로 이미 확립된 하우스 스타일이다. 새로 지적할 결함이라기보다는, 이 시리즈가
    끝난 지금이 “이 정도 분량의 인라인 결정 기록을 계속 남길지, 짧은 주석 + `plan/complete/`
    링크로 줄일지”를 정할 시점이라는 점만 남긴다. 즉시 조치를 요구하지 않는다.

- **[INFO]** `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` 는
  `BEGIN → 행 락 → 두 요청 동시 발사 → 공허성 가드(1.5s) → COMMIT → 정렬 → 단언 → finally
  ROLLBACK` 오케스트레이션을 9번째로 거의 동일하게 복제한다(형제 8개: `auth-config-`,
  `integration-`, `integration-rotate-`, `member-remove-`, `model-config-`, `schedule-`,
  `trigger-`, `workflow-`, `workspace-delete-concurrency.e2e-spec.ts`).
  - 위치: 파일 전체(특히 52-105줄의 `it(...)` 본문).
  - 상세: 순수 코드 관점에서는 추출 대상인 중복이 맞지만, 이 중복은 이미 측정되고 결정된
    상태다 — `plan/in-progress/webauthn-dup-delete.md` §0 결정 1 이 "여덟 개, 여섯은 행 락·둘은
    advisory lock, 여덟 전부 공허성 가드"라는 실측과 함께 "추출한다, 단 전용 PR 에서"로 결론
    내렸고 `raceUnderHeldLock()` 시그니처까지 설계해 트래커에 등재했다. 새로 지적할 미해결
    이슈가 아니라, 그 유예 근거가 실측을 동반한다는 점만 확인차 기록한다.

- **[INFO]** 신규 `describe('동시 삭제', ...)` 블록의 각 `it` 이
  `credentialRepo.findOne.mockResolvedValue({ id: 'cred-1', userId })` 를 반복한다
  (`webauthn.service.spec.ts:518, 530, 553`). `beforeEach` 로 호이스트하면 3줄을 줄일 수 있지만,
  같은 결함 클래스의 형제 스펙 파일(`model-config.service.spec.ts` `describe('remove — 동시
  삭제')`, `auth-configs.service.spec.ts` `describe('remove — 동시 삭제')`)도 각 `it` 안에서
  fixture 를 독립적으로 재구성하는 동일한 스타일을 쓴다 — 테스트 간 격리를 우선한 의도된
  컨벤션으로 보이며 지적할 문제가 아니다.

## 요약

핵심 로직(`deleteCredential` 의 `affected === 0` 명시 비교 도입, DELETE 조건절에 `userId` 추가)
자체는 짧고 선형적이며(중첩 없음, 분기 3개), 형제 8개 PR 과 동일한 검증된 패턴을 그대로 따른다.
유일하게 실질적인 지적은 `NotFoundException({ code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND', ... })`
리터럴의 중복인데, 바로 이 파일이 편집되는 이번 기회에 형제 두 파일(`auth-configs.service.ts`,
`model-config.service.ts`)이 이미 적용한 헬퍼 추출 패턴을 따르지 않아 시리즈 내 일관성이
깨졌다. 나머지 관찰(주석 분량, e2e 하네스 중복, 테스트 fixture 반복)은 이미 같은 PR 이 속한
결함 시리즈에서 확립됐거나 plan 문서에 실측과 함께 유예가 기록돼 있어 새 조치가 필요하지
않다.

## 위험도

LOW
