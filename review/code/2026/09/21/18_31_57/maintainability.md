# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 직전 라운드(`review/code/2026/09/21/18_03_54/maintainability.md` WARNING)가 지적한
  `WEBAUTHN_CREDENTIAL_NOT_FOUND` `NotFoundException` 리터럴 4곳 중복이 이번 커밋으로 해소됨을
  확인했다.
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:517-522`
    (신규 `private throwCredentialNotFound(): never` 헬퍼), 호출부 `:497`, `:500`, `:542`, `:566`.
  - 상세: `grep -n WEBAUTHN_CREDENTIAL_NOT_FOUND`로 직접 확인한 결과 이제 리터럴 정의는
    헬퍼 본문 한 곳(`:519`)과, 예외 타입·상태 코드가 달라 의도적으로 별도인 401 자리
    (`:404`, `verifyAuthentication`) 뿐이다. 형제 파일(`auth-configs.service.ts`
    `throwAuthConfigNotFound()`, `model-config.service.ts` `notFound()`)과 네이밍·JSDoc
    분량·구조(단일 지점 설명 + "다른 자리와 다른 이유" 단락)까지 동일한 패턴을 따른다.
  - 제안: 없음 — 조치 완료 확인.

- **[INFO]** `deleteCredential()` 안의 결정 배경 주석(`webauthn.service.ts:544-560`, 약 17줄)이
  실제 변경 코드(약 8줄: delete 호출 + `affected === 0` 분기)보다 훨씬 길다.
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:544-560`.
  - 상세: 직전 라운드에서도 동일 관찰이 INFO로 기록됐고, 같은 결함 시리즈의 다른 두 파일
    (`auth-configs.service.ts`, `model-config.service.ts`)에서도 동일 분량·형식으로 이미
    확립된 하우스 스타일이다. 이번 라운드에서 새로 늘어나거나 악화되지 않았으므로 재지적할
    새 결함은 아니다.
  - 제안: 즉시 조치 불요. 다만 이 시리즈(아홉 자리)가 CHANGELOG상 공식 종료됐으므로, 이후
    유사 패턴을 또 추가할 계획이 있다면 "짧은 주석 + `plan/complete/` 링크"로 축약하는 컨벤션을
    한번 검토할 시점이라는 점만 남긴다(비차단).

- **[INFO]** 신규 e2e 파일 `webauthn-credential-delete-concurrency.e2e-spec.ts` 안에서 HTTP DELETE
  발사 헬퍼(`fireDelete`)가 두 `it` 블록에 거의 동일한 형태로 각각 로컬 정의돼 있다.
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:66-73`
    (첫 번째 `it`, 클로저로 `targetId` 참조) 및 `:168-175`(두 번째 `it`, `id` 파라미터 받음).
  - 상세: 두 버전은 반환 객체 형태가 달라(`{status, code}` vs `{status}`) 단순 하나로 합치기는
    어렵지만, `describe` 스코프로 끌어올려 파라미터화하면 중복을 줄일 여지는 있다. 다만 이
    파일이 속한 동시성 e2e 아홉 개 전체의 오케스트레이션 중복은 이미
    `plan/in-progress/webauthn-dup-delete.md` §0 결정 1이 실측(여덟 개 선례, 공허성 가드 공통)과
    함께 "전용 PR에서 공용 헬퍼(`raceUnderHeldLock`)로 추출"을 확정해 둔 상태이므로, 이 파일
    내부의 지역적 중복도 그 후속 PR 범위에서 함께 정리되는 편이 스코프 혼입을 피할 수 있다.
  - 제안: 이번 PR에서 조치 불요. 후속 "동시성 e2e 공용 헬퍼 추출" PR의 범위에 이 지역적
    중복도 포함해 검토할 것을 제안(비차단, 신규 트래커 항목 불필요 — 기존 항목 범위 안).

## 요약

이번 라운드는 직전 리뷰(WARNING 4건 중 유일한 Maintainability WARNING — `NotFoundException`
리터럴 4곳 중복)를 `throwCredentialNotFound()` 헬퍼 추출로 정확히 해소했다. 추출 방식·네이밍·
JSDoc 구조 모두 형제 서비스(`auth-configs.service.ts`, `model-config.service.ts`)와 동일 패턴을
따라 시리즈 내 일관성이 회복됐다. 핵심 로직(`affected === 0` 명시 비교, DELETE 조건절에 `userId`
추가)은 여전히 짧고 선형적이며 중첩·매직넘버·순환복잡도 문제가 없다. 신규 unit 테스트(`it.each`로
`undefined`/`null` 대조군 파라미터화)와 e2e 테스트도 가독성이 좋다. 남은 관찰은 모두 INFO 수준
(주석 분량, e2e 헬퍼 지역 중복)이며 기존에 이미 실측·근거와 함께 유예가 결정됐거나 다음 전용 PR
범위로 넘기는 것이 합리적인 항목들이다. 유지보수성 관점에서 이번 diff는 개선(중복 해소)이며 새로
차단할 사유가 없다.

## 위험도

LOW
