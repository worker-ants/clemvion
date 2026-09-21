# 테스트(Testing) 리뷰 — WebAuthn credential 동시 삭제 중복 감사 수정 (아홉 번째/마지막 자리)

## 검증 방법

`webauthn.service.spec.ts`·`webauthn.service.ts`·신규 e2e
(`webauthn-credential-delete-concurrency.e2e-spec.ts`)를 저장소에서 직접 읽고, 형제 PR
(`auth-config-delete-concurrency.e2e-spec.ts`)과 대조해 패턴 일치 여부를 확인했다. 아울러
컨트롤러(`webauthn.controller.ts`)·엔티티(`webauthn-credential.entity.ts`)·감사 액션 상수
(`audit-action.const.ts`)를 열어 e2e 단언(라우트 204/`USER_2FA_DISABLED`='user.2fa_disabled'/
`details.credentialId`/`resource_id=user.sub`)이 실제 구현과 정확히 맞는지 교차 검증했다.
저장소 파일은 읽기만 했고 뮤테이션·수정은 하지 않았다 (`git status --short` 결과 본 세션의
변경 없음, 확인 완료).

## 발견사항

- **[INFO]** e2e 가 물리적 DB 삭제 상태를 직접 검증하지 않고 HTTP status + 감사 카운트만으로 판정한다
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` — 신규 파일
    diff 게이트 96~101행 (`results.map(...).toEqual([204, 404])` 부근)
  - 상세: `target` credential 이 실제로 `webauthn_credential` 테이블에서 삭제됐는지, `survivor`
    행이 그대로 남아 있는지를 SQL 로 재확인하는 단언이 없다 — API 응답 코드와 감사 로그 건수를
    대상 상태의 대리 지표(proxy)로만 쓴다. 다만 이는 이 PR 만의 결함이 아니라
    `auth-config-delete-concurrency.e2e-spec.ts` 를 포함한 형제 8개 전부가 공유하는 기존 관례다
    (직접 대조 확인). 새로 도입된 갭이 아니므로 이 PR 단독으로 막을 사안은 아니다.
  - 제안: 계열 전체를 손보는 김에(트래커에 이미 등재된 "동시성 e2e 공용 헬퍼 추출" 전용 PR)
    `SELECT id FROM webauthn_credential WHERE id = $1` 로 target 행 부재 + survivor 존재를
    같이 확인하는 옵션을 헬퍼 설계에 포함하면 좋다. 지금 당장 이 PR 을 막을 정도는 아니다.

## 확인된 강점 (긍정 소견)

- **대조군(control) 테스트가 명시 비교(`affected === 0`)의 필요성을 정확히 붙든다.**
  `it.each([[undefined], [null]])`(게이트 550~561행)는 `#1371` 에서 대조군 부재로 `!affected`
  뮤턴트가 32건을 통과했던 실패를 정확히 재발 방지하는 형태다 — `null`/`undefined`(드라이버
  미보고) 두 값을 모두 커버해 `!affected`(양쪽 다 truthy→false 오판) 회귀를 확실히 잡는다.
- **소유권 스코프 강화가 정확한 단언 형태로 잠겨 있다.** 게이트 517~527행
  (`소유자로 스코프한 DELETE 를 친다`)이 `credentialRepo.delete` 호출 인자를
  `{ id, userId }` 통짜 객체로 `toHaveBeenCalledWith` 하므로, `userId` 필드 하나만 빠뜨리는
  뮤턴트도 잡는다 (부분 매칭이 아니라 완전 일치 — 회귀 방지력이 높다).
  프로덕션 코드(`webauthn.service.ts:549~552`)와 정확히 일치.
- **진 쪽 short-circuit 이 음성 단언까지 커버한다.** 게이트 529~542행이
  `credentialRepo.count`·`usersService.update` 가 호출되지 않았음을 명시적으로 확인해,
  "404 를 던지긴 하는데 부수 쓰기가 여전히 실행되는" 형태의 회귀(§7.5 류 패턴)를 방지한다.
- **감사(audit) 책임 소재를 문서화된 교차 참조로 명확히 했다.** 새 `describe('동시 삭제')`
  블록 바로 위 docblock(게이트 509~515행)이 "감사는 서비스가 아니라 컨트롤러가 남기므로
  서비스 단위 테스트에서는 검증 대상이 아니다"라고 설명하며
  `webauthn.controller.spec.ts` 의 기존 테스트(`does not record an audit log when
  deleteCredential throws`, 258행)를 근거로 명시한다. 실제로 해당 컨트롤러 테스트가 존재하고
  의도한 시나리오(서비스가 던지면 감사 미기록)를 검증하고 있음을 직접 확인했다 — 문서화된
  교차 참조가 실제와 어긋나지 않는다.
- **e2e 판별력(discriminating power)이 확보돼 있다.** "공허성 가드"(게이트 86~94행,
  `Promise.race` 로 1.5초 안에 두 요청이 아직 끝나지 않았음을 확인)가 있어, 겹침을 만들지
  못하는 fixture 회귀를 스스로 탐지한다 — 이 가드가 없으면 고치기 전 코드도 우연히 통과할 수
  있다는 점을 docblock 이 정확히 인지하고 있다(계열 8개 형제와 동일 규율).
- **fixture 설계가 관심사를 하나로 좁혔다.** `target`+`survivor` 두 credential 을 넣어
  `remaining === 0` 분기(복구 코드 NULL 화)가 함께 타지 않도록 격리한 것(게이트 53~55행 주석)은
  "감사 중복" 판별자 하나에만 집중하게 만드는 좋은 설계다.
- **e2e 단언이 실제 구현과 필드 단위로 정확히 맞는다.** `resource_type='user'`,
  `resource_id=userId`(=`user.sub`), `action='user.2fa_disabled'`,
  `details->>'credentialId'` 전부 `webauthn.controller.ts:331~348`·
  `audit-action.const.ts:74` 와 직접 대조해 일치를 확인했다 — mock 이 아닌 실제 DB/컨트롤러
  경로를 타는 e2e 이므로 이 정합성이 중요한데, 어긋난 곳이 없다.
- **회귀 안전성.** 기존 `deleteCredential` 테스트 3건(마지막 credential 시 recovery code
  NULL 화·다른 credential 존재 시 유지·타인 소유 404)은 새 코드 경로(`affected` 판정 추가)와
  충돌하지 않는다 — `beforeEach` 기본 mock 이 `delete: jest.fn().mockResolvedValue({ affected: 1 })`
  이므로 새 분기가 조용히 통과하고 기존 로직 그대로 동작함을 확인했다.
- **테스트 격리.** `jest.clearAllMocks()`(전역 `beforeEach`)로 인해 새 `it.each` 테스트가
  `credentialRepo.count.mockResolvedValue(1)` 를 로컬로 덮어써도 다른 테스트를 오염시키지
  않는다. e2e 쪽도 `uniqueEmail` 기반 격리 + 감사 조회를 `resource_id`+`details.credentialId`
  로 좁혀 다른 테스트의 잔여 데이터와 충돌하지 않는다.

## 요약

WebAuthn credential 동시 삭제 중복 감사 결함 수정에 대한 테스트는 전 계층(unit + e2e)에서
견고하다. 특히 `#1371` 에서 실제로 놓쳤던 "명시 비교 vs `!affected`" 뮤턴트를 대조군 테스트로
정확히 봉쇄했고, 소유권 스코프 강화·부수 쓰기 미실행·감사 책임 소재(컨트롤러)까지 단언·문서화
양쪽으로 커버한다. e2e 는 형제 8개와 동일한 검증된 패턴(공허성 가드·행 락 기반 겹침 생성)을
그대로 따르며 실제 컨트롤러/엔티티/감사 상수와 필드 단위로 대조해도 어긋나는 곳이 없다. 유일한
아쉬운 점은 e2e 가 실제 DB 행 삭제 상태를 직접 조회하지 않고 HTTP status 를 대리 지표로 쓴다는
점인데, 이는 형제 계열 전체가 공유하는 기존 관례이고 이 PR 이 새로 도입한 갭이 아니므로 차단
사유가 아니다. 테스트 관점에서 이 변경을 막을 이유는 없다.

## 위험도

NONE
