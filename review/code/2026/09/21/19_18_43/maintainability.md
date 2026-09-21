# 유지보수성(Maintainability) 리뷰 — WebAuthn credential 동시 삭제 (아홉 번째/마지막 자리, 4차 라운드)

## 검증 방법

`codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`(380~580행 부근),
`webauthn.service.spec.ts`(505~562행), `webauthn-credential-delete-concurrency.e2e-spec.ts`(전체
228줄), `plan/in-progress/webauthn-dup-delete.md`, `CHANGELOG.md` 를 저장소에서 직접 `Read`/`grep`
으로 열어 대조했다. 이전 세 라운드(`review/code/2026/09/21/18_03_54/maintainability.md`,
`18_31_57/maintainability.md`, `18_58_48/maintainability.md`)의 판정과 이번 diff(`15da527e7`,
JSDoc·plan 의 줄 번호 인용 제거)가 새 유지보수성 결함을 만들지 않았는지 확인했다. 저장소에
뮤테이션은 가하지 않았고, 리뷰 종료 시 `git status --short` 로 변경 없음을 확인했다.

## 발견사항

- **[INFO]** 이번 diff(`15da527e7`)는 순수 문서 정정으로, 코드 로직·구조에 영향 없음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` — `throwCredentialNotFound()` JSDoc 블록(`verifyAuthentication()` 교차 참조 문구)
  - 상세: 라운드 2 수정이 plan 문서의 stale 줄 번호를 메서드명으로 바꾸면서, 같은 커밋이 JSDoc 에 `verifyAuthentication(:403)` 이라는 **새** 줄 번호 인용을 남겼다. 이번 커밋은 그 문구를 `verifyAuthentication()` (줄 번호 없이 메서드명만)으로 바꿔, 앞으로의 리팩터가 그 줄을 밀어내도 stale 해지지 않게 했다. `plan/in-progress/webauthn-dup-delete.md` 도 같은 이유로 `:403`·`:497`·`:504`·`:527` 인용을 메서드명 기반 서술로 교체하고, "왜 줄 번호로 적지 않는지"까지 본문에 남겨 재발을 막았다 — 직접 `grep` 확인 결과 저장소 전체에서 이 네 줄 번호가 라이브 인용으로는 더 이상 남아 있지 않다(plan 문서의 유일한 잔존 표기는 "처음엔 이렇게 적었었다"는 과거형 인용이다).
  - 제안: 없음 — 조치 완료 확인, 재지적 불필요.

- **[INFO]** 핵심 로직(`deleteCredential()` 의 `affected === 0` 명시 비교 + DELETE 조건절 `userId` 추가, `throwCredentialNotFound()` 헬퍼)은 3차 라운드 이후 변경되지 않았고 여전히 짧고 선형적
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:506-522`(헬퍼), `:533-572`(`deleteCredential`)
  - 상세: 함수 제어 흐름은 `조회 → 소유권 체크(404) → delete → affected===0 체크(404) → count → remaining===0 이면 NULL화 → 반환` 5단계로 중첩 없이 선형이다. `NotFoundException` 리터럴은 헬퍼 1곳에만 존재하고 401 자리(`verifyAuthentication`)만 의도적으로 분리되어 있음을 재확인했다. 이전 라운드가 지적했던 유일한 실질 WARNING(리터럴 중복)은 이미 해소된 상태로 유지된다.
  - 제안: 없음.

- **[INFO]** `deleteCredential` 내부 결정 배경 주석(약 17줄)이 실제 변경 코드보다 긴 구조, e2e 파일의 `fireDelete`/락/공허성 가드 오케스트레이션 중복(파일 내 2회 + 형제 8개 파일과 합쳐 9회째), 매직 넘버 `1_500`(ms)·`60_000`(테스트 타임아웃) 반복은 이번 diff 로 새로 생기거나 악화되지 않음
  - 위치: `webauthn.service.ts:544-560`(주석 블록), `webauthn-credential-delete-concurrency.e2e-spec.ts:66-105`·`178-220`(오케스트레이션 중복), `:91`·`:118`·`:207`·`:227`(매직 넘버)
  - 상세: 이 세 관찰은 1~3차 라운드에서 이미 INFO 로 기록됐고, `plan/in-progress/webauthn-dup-delete.md` §0 결정 1 이 실측(형제 8개 + 이 파일, 공통 공허성 가드 패턴)과 함께 "전용 후속 PR 에서 `raceUnderHeldLock()` 헬퍼로 추출"하기로 결론 내렸다. 이번 라운드의 diff(문서 정정 커밋 1건)는 이 파일들을 편집하지 않았으므로 상태가 그대로다 — 재지적하지 않는다.
  - 제안: 조치 불요(비차단). 후속 추출 PR 범위에 `1_500`/`60_000` 상수화도 포함하는 기존 제안을 유지.

## 요약

이번 4차 라운드가 다루는 diff 의 실질 내용은 JSDoc 한 줄과 plan 문서 서술을 "줄 번호 인용"에서 "메서드명 인용"으로 바꾼 순수 문서 정정(`15da527e7`)뿐이며, 애플리케이션 로직·구조·복잡도에는 아무 변화가 없다. 핵심 코드(`deleteCredential()` 의 `affected === 0` 명시 비교, DELETE 조건절 `userId` 스코프, `throwCredentialNotFound()` 헬퍼)는 1~3차 라운드에서 이미 검증된 상태 그대로 유지되고 있고, 유일했던 실질 WARNING(리터럴 중복)은 여전히 해소돼 있다. 남은 관찰(주석 분량, e2e 하네스 중복, 매직 넘버)은 모두 이전 라운드에서 실측과 함께 근거 있게 후속 PR 로 유예된 항목이라 이번에도 재지적하지 않는다. 새로 도입된 유지보수성 결함은 없다.

## 위험도

NONE
