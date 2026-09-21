# 문서화(Documentation) 리뷰 — WebAuthn credential 동시삭제 (아홉 번째이자 마지막 자리)

## 발견사항

- **[WARNING]** 새로 추가된 plan 트래커 항목의 실측 줄 번호 인용이 **같은 PR 의 후속 리팩터 커밋으로 즉시 stale 이 됨**
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4980`
    (`` `:497`·`:504`·`:527` 이 `NotFoundException`(**404**). `` — 항목 제목: `` `3-error-handling.md` §1.11 의 «`_NOT_FOUND`≠404 는 이 저장소에서 유일한 예외» 가 거짓이다 ``)
  - 상세: 이 인용은 커밋 `49ebd6632`(초기 구현) 시점의 `webauthn.service.ts` 줄 번호를 그대로 박아 넣은 것이다. 그 시점엔 497·504·527 이 실제로 `throw new NotFoundException({...})` 블록의 일부였다(직접 `git show 49ebd6632:...` 로 확인). 그런데 **바로 다음 커밋** `d3127c8a6`(이 PR 자신의 리팩터, SUMMARY#3 — `throwCredentialNotFound()` 헬퍼 추출)이 같은 파일의 줄 배치를 바꿔, 최종 커밋 상태(HEAD)에서는:
    - `:497` → `this.throwCredentialNotFound();` (헬퍼 호출, `NotFoundException` 리터럴 아님)
    - `:504` → `}` (닫는 중괄호 — `NotFoundException` 과 무관)
    - `:527` → JSDoc 주석 한 줄(`* (WebAuthnController)가 remaining === 0 일 때...`) — 코드가 아님

    즉 이 트래커 항목은 **자신이 속한 바로 이 PR 의 다른 파일 변경 때문에**, 커밋되는 순간 이미 틀린 줄 번호를 가리킨다. 핵심 주장(같은 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드가 401 과 404 두 status 로 나간다)은 여전히 사실이고 `grep` 으로 재확인 가능하지만, "집행 시 할 일" 목록을 실행할 다음 사람이 이 줄 번호로 코드를 열면 엉뚱한 줄(닫는 괄호·주석)을 보게 되어 근거를 재확인하는 데 혼선을 준다. `:403`(`verifyAuthentication` 의 `UnauthorizedException`)만은 이 PR 이 건드리지 않은 영역이라 현재도 정확하다.
  - 제안: 그 문장을 실측 시점 기준으로 정정하거나("리팩터 전 기준 `:497`·`:504`·`:527`" 등 시점 명시), 헬퍼 추출 후의 현재 호출부 줄 번호(`:497`·`:500`·`:542`·`:566`, 전부 `this.throwCredentialNotFound()` 호출)로 갱신할 것. 근본적으로는 같은 세션의 다른 커밋이 편집 중인 파일의 줄 번호를 plan 문서에 그대로 박아 넣는 패턴 자체가 재발 소지가 있다.

- **[WARNING]** `CHANGELOG.md` 의 스트라이크스루 처리가 이 diff 안에서 절반만 적용되어, "아홉 자리 전부 종료" 결론과 시각적으로 모순되는 문장이 남음
  - 위치: `CHANGELOG.md:133-138` (`auth_config` — 일곱 번째 자리 — 섹션의 `**남는 것**` 단락)
  - 상세: 해당 단락 원문은 "같은 결함 클래스의 남은 두 자리는 `ModelConfigService.remove()`(여덟 번째, …)와 WebAuthn credential 삭제(아홉 번째, …) — 트래커에 등재." 라는 한 문장으로 두 항목을 나열한다. 이번 diff 는 이 중 **WebAuthn 부분만** 취소선(`~~…~~`)으로 감싸고 "**해소 (2026-09-21, 아홉 번째 PR)**: WebAuthn 자리는 맨 위 항목이 닫았다 — 이 결함 클래스는 아홉 자리로 종료됐다." 를 덧붙였다. 그런데 같은 문장 앞부분의 `` `ModelConfigService.remove()`(여덟 번째, …) `` 는 취소선 없이 그대로 남아, 문자 그대로 읽으면 "여덟 번째 자리는 아직 남아 있다" 는 인상을 준다 — 바로 이어지는 "이 결함 클래스는 아홉 자리로 종료됐다" 와 모순된다.
    같은 파일 안에 이미 두 가지 다른 관례가 존재한다: (a) `model_config` 섹션(90-94행)은 "남는 것" 전체가 WebAuthn 하나뿐이라 전체를 취소선 처리했고, (b) `trigger` 섹션(스케줄 잔여 해소, 약 262-266행 부근)은 취소선 없이 원문을 그대로 두되 "원문은 그때의 상태 기록으로 남긴다" 는 명시적 각주를 붙였다. 이번 auth_config 단락은 이 둘 중 어느 쪽 관례도 따르지 않고, 문장 절반만 취소선 처리해 남은 절반이 마치 미해소인 것처럼 보이는 세 번째 형태를 만들었다.
  - 제안: `ModelConfigService.remove()(여덟 번째, …)` 부분도 함께 취소선 처리하거나(이미 90-94행에서 별도로 해소가 선언돼 있으므로), 아니면 trigger 섹션처럼 "원문은 그때의 상태 기록" 각주를 붙여 왜 그 부분만 취소선이 없는지 명시할 것.

## 요약

핵심 코드 변경(`webauthn.service.ts` 의 `throwCredentialNotFound()` 헬퍼 JSDoc, `deleteCredential()` 의 `@throws` 태그와 인라인 주석, `webauthn.service.spec.ts`/e2e 스펙의 판별력 설명 주석)은 실제 구현과 정확히 일치하며, 이전 리뷰 라운드(`review/code/2026/09/21/18_03_54`)가 지적한 CHANGELOG 누락·JSDoc `@throws` 미기재·404 헬퍼 미추출 WARNING 3건은 모두 제대로 해소됐다(코드·주석 대조 완료). 다만 이번 diff 자체가 두 군데에서 새로운 소소한 문서 정합성 문제를 만들었다: (1) 새로 추가된 plan 트래커 항목이 같은 PR 의 리팩터 커밋으로 인해 커밋 시점에 이미 틀리게 되는 줄 번호를 인용하고 있고, (2) CHANGELOG 의 취소선 처리가 같은 단락 안에서 비일관적으로 적용돼 "완전 종료" 선언과 모순되는 문구를 남겼다. 둘 다 기능에는 영향이 없고 내용의 핵심 주장 자체는 사실이지만, 이 저장소가 plan/CHANGELOG 를 다음 사람이 그대로 신뢰하고 실행하는 SoT 로 쓰는 문화인 만큼 정정이 필요하다.

## 위험도
LOW
