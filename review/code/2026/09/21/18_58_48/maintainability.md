# 유지보수성(Maintainability) 리뷰 — WebAuthn credential 동시 삭제 (아홉 번째/마지막 자리, 3차 라운드)

## 검증 방법

`codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`(480~580행 부근),
`webauthn.service.spec.ts`(495~565행), `webauthn-credential-delete-concurrency.e2e-spec.ts`(전체
228줄), `CHANGELOG.md`(1~145행)를 저장소에서 직접 `Read`/`grep` 으로 열어 diff 게이트 번호가
실제 파일 줄 번호와 일치함을 확인했다. 이전 두 라운드(`review/code/2026/09/21/18_03_54/maintainability.md`,
`review/code/2026/09/21/18_31_57/maintainability.md`)가 지적한 WARNING(중복 `NotFoundException`
리터럴 4곳)이 실제로 해소됐는지 직접 코드로 재확인했다. 저장소에 뮤테이션은 가하지 않았다.

## 발견사항

- **[INFO]** 이전 라운드 WARNING(중복 `NotFoundException({code:'WEBAUTHN_CREDENTIAL_NOT_FOUND',...})`
  리터럴 4곳)이 `throwCredentialNotFound()` 헬퍼로 정확히 해소된 상태가 이번 라운드에서도 유지됨
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:517-522`(헬퍼 정의),
    호출부 `:497`(`renameCredential` 첫 번째), `:500`(두 번째), `:542`(`deleteCredential` 소유권
    체크), `:566`(`deleteCredential` `affected===0` 체크).
  - 상세: `grep -n WEBAUTHN_CREDENTIAL_NOT_FOUND webauthn.service.ts`로 직접 재확인한 결과
    리터럴 정의는 헬퍼 본문(`:519`)과, 예외 타입·상태 코드가 달라 의도적으로 분리된 401 자리
    (`:404`, `verifyAuthentication`) 두 곳뿐이다. 헬퍼 JSDoc(`:506-516`)의 `verifyAuthentication`
    (:403) 교차 참조도 실제 `throw new UnauthorizedException(...)` 위치(`:403`)와 정확히 일치한다 —
    이전 라운드가 다른 파일(plan 트래커)에서 지적했던 "같은 PR 의 후속 커밋이 줄 번호를
    stale 하게 만드는" 유형의 문제가 이 JSDoc 자체에는 재발하지 않았다.
  - 제안: 없음 — 조치 완료 확인, 재지적 불필요.

- **[INFO]** `deleteCredential()` 내부 결정 배경 주석(약 17줄)이 실제 변경 코드(약 8줄)보다 훨씬
  길다는 관찰은 이번 라운드에서도 그대로이며, 새로 악화되지 않음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:544-560`.
  - 상세: 두 차례 전 라운드가 이미 이 관찰을 INFO로 남겼고(같은 결함 시리즈의
    `auth-configs.service.ts`·`model-config.service.ts` 와 동일 분량·형식의 확립된 하우스
    스타일), 이번 diff 는 이 블록 자체를 편집하지 않았다. 함수의 실제 제어 흐름(`ownership 체크 →
    delete → affected 체크 → count → recovery 코드 처리`)은 5개 분기로 짧고 선형적이라
    순환복잡도 자체는 낮다 — 가독성 저해는 주석 밀도이지 로직 복잡도가 아니다.
  - 제안: 즉시 조치 불요. 시리즈(아홉 자리)가 CHANGELOG 상 공식 종료됐으므로, 이후 유사 패턴을
    또 추가할 계획이 있다면 "짧은 주석 + `plan/complete/` 링크"로 축약하는 컨벤션을 검토할
    시점이라는 기존 제안을 유지한다(비차단, 새 항목 아님).

- **[INFO]** 신규 e2e 파일의 두 `it` 블록이 `BEGIN → 행 락(FOR UPDATE) → Promise.all 동시 발사 →
  1.5초 공허성 가드(`Promise.race`) → COMMIT → 정렬 → 단언 → finally ROLLBACK` 오케스트레이션과
  `fireDelete` 클로저를 거의 동일한 형태로 파일 내에서 두 번, 그리고 형제 8개 e2e 파일과 합쳐
  아홉 번째로 반복한다
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:66-105`(첫
    번째 `it`)와 `:178-220`(두 번째 `it`) — `fireDelete` 정의(`:66-73`, `:178-185`), 락+공허성
    가드+커밋 시퀀스(`:75-105`, `:187-220`), 매직 넘버 `1_500`(ms 공허성 가드)과 `60_000`(테스트
    타임아웃)이 파일 안에서만 각 2회씩 반복된다.
  - 상세: 순수 코드 중복 관점에서는 추출 대상이 맞지만, 이 중복(파일 내부 지역 중복 포함)은
    이미 측정·결정된 상태다 — `plan/in-progress/webauthn-dup-delete.md` §0 결정 1이 "형제
    여덟 개 + 이번 파일, 공허성 가드 공통"이라는 실측과 함께 "전용 PR 에서 `raceUnderHeldLock()`
    공용 헬퍼로 추출한다"로 결론 내렸고, 직전 라운드(`review/code/2026/09/21/18_31_57/maintainability.md`)
    도 같은 파일 내부 두 `it` 간 중복을 이미 INFO로 짚어 같은 후속 PR 범위에 포함해 두었다.
    이번 diff 는 그 판단을 바꿀 새 정보를 추가하지 않았다.
  - 제안: 이번 PR 에서 조치 불요. 이미 등재된 "동시성 e2e 공용 헬퍼 추출" 후속 PR 범위에서
    `1_500`/`60_000` 같은 반복 매직 넘버도 상수화 대상으로 함께 검토할 것(비차단, 새 트래커
    항목 불필요).

- **[INFO]** `CHANGELOG.md` 의 취소선(strikethrough) 처리가 이전 라운드 WARNING#3 지적대로
  전면 정정되어, "아홉 자리 전부 종료" 결론과 더 이상 모순되지 않음을 직접 확인
  - 위치: `CHANGELOG.md:133-139`(`auth_config`/일곱 번째 섹션의 "남는 것" 단락).
  - 상세: 직전 라운드(`review/code/2026/09/21/18_31_57/documentation.md` WARNING)가 "여덟 번째
    (`ModelConfigService.remove()`) 부분이 취소선 없이 남아 '아직 미해소'로 오독될 수 있다"고
    지적했는데, 현재 HEAD 를 직접 열어보니 `<del>같은 결함 클래스의 남은 두 자리는
    \`ModelConfigService.remove()\`(여덟 번째, …)와 WebAuthn credential 삭제(아홉 번째, …) —
    … 등재.</del>` 형태로 문장 전체가 하나의 `<del>` 블록으로 감싸져 있다(commit `7b71e9a4a`).
    이제 "해소 (2026-09-21)" 각주가 두 자리(여덟 번째·아홉 번째)의 해소 위치를 각각 명시해
    시각적 모순이 사라졌다.
  - 제안: 없음 — 조치 완료 확인.

## 요약

이번 3차 라운드에서 새로 지적할 유지보수성 결함은 없다. 1차 라운드가 지적한 유일한 실질
WARNING(`NotFoundException` 리터럴 4곳 중복)은 2차 라운드에서 `throwCredentialNotFound()` 헬퍼로
해소됐고, 이번 라운드에서 헬퍼 정의·호출부 4곳·JSDoc 교차 참조 줄 번호까지 실제 소스와 재대조해
정확함을 확인했다. 핵심 로직(`deleteCredential()` 의 `affected === 0` 명시 비교 + DELETE 조건절
`userId` 추가)은 여전히 짧고 선형적이며(분기 5개, 중첩 없음, 매직 넘버 없음) 형제 8개 PR 과 동일한
검증된 패턴을 그대로 따른다. 남은 관찰(주석 분량, e2e 오케스트레이션·`fireDelete`·타이밍 상수의
파일 내부/시리즈 전체 중복)은 모두 이전 라운드에서 이미 실측과 함께 근거 있게 유예된 항목이며
새로 악화되지 않았다 — 재지적하지 않는다. 문서 측면에서는 직전 라운드 WARNING(CHANGELOG 취소선
비일관 처리)이 이번 diff 에서 완전히 정정됐음을 직접 대조로 확인했다.

## 위험도

NONE
