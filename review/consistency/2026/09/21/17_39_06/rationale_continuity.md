# Rationale 연속성 검토 — spec/5-system (--impl-prep, WebAuthn credential 동시 삭제 대비)

## 검토 맥락

target 스코프는 `spec/5-system`(번들: `1-auth.md` 외 다수)이며, 착수 예정 작업은
`plan/in-progress/webauthn-dup-delete.md` — `WebAuthnService.deleteCredential()` 의 동시 DELETE
두 건이 `user.2fa_disabled` 감사를 두 번 남기는 결함을, 같은 계열(auth-configs·integrations·
model-config·workspaces·schedules·triggers·workflows) 여덟 건과 동일한 패턴(무락 원자적 `DELETE`
의 `affected` 로 승자/패자 판정, 패자는 404)으로 고치는 아홉 번째·마지막 자리다. 여덟 선행
PR 은 전부 `spec_impact: none` 이었고 실제로 `spec/` 파일을 건드리지 않았다 — 이 정정을
"spec 이 이미 약속한 계약(존재하지 않는 리소스 DELETE → 404)에 구현을 맞추는 버그 수정"으로
취급해 온 선례다.

## 발견사항

- **[INFO]** 동일 계열 9번째 적용이 기존 WebAuthn 동시성 패턴과 병존 가능한지 스펙이 침묵
  - target 위치: `spec/5-system/1-auth.md` §1.4.2 "동시성 보호" 문단(`SELECT ... FOR UPDATE` 트랜잭션 락, `verifyAuthentication` 대상) 및 §5 DELETE `/credentials/:id` 행
  - 과거 결정 출처: `1-auth.md` `## Rationale` 없음(본문 §1.4.2, 계정 잠금·감사 근처) — 해당 문단은 Rationale 섹션이 아니라 본문에 있으나, WebAuthn credential 조작의 동시성 안전장치로 "단일 트랜잭션 + pessimistic lock"을 명시한 유일한 자리다
  - 상세: 이번 fix 는 `deleteCredential()` 에 락을 추가하지 않고 형제 다섯(대조군 테스트로 이미 방어된 `affected === 0` 판별자)과 같은 "무락 원자적 DELETE" 기법을 그대로 적용한다(plan §0 결정 2, §B). 이는 대상 오퍼레이션이 다르다(카운터 역행이라는 보안 크리티컬 vs 감사 로그 중복이라는 정합성 버그)는 점에서 실질적 모순은 아니며, 이미 8회 선례가 있어 "기각된 대안의 재도입"은 아니다. 다만 `1-auth.md` 자체가 "WebAuthn credential 관련 동시성은 락으로 처리한다"는 인상을 줄 수 있는 유일한 서술을 담고 있어, 같은 서비스(WebAuthnService) 안에서 왜 두 오퍼레이션이 다른 동시성 기법을 쓰는지에 대한 명시적 설명이 spec 에는 없다
  - 제안: 필수는 아니다(선행 8건 모두 `spec_impact: none` 으로 처리됐고 이번도 그 선례를 따르는 것이 합리적). 다만 이후 리뷰어 재질문을 줄이려면 plan 문서(이미 §B 에 실측 표로 정리됨)의 근거를 커밋 메시지에 한 줄 요약하거나, `1-auth.md` §1.4.2 동시성 보호 문단 끝에 "credential 삭제(§5 DELETE)는 카운터 역행이 아닌 감사 중복 방지가 목적이라 별도로 원자적 `affected` 판정을 쓴다"는 각주 1줄을 추가하는 정도로 충분하다 — 새 Rationale 항목 신설을 요구하는 수준은 아니다.

- **[INFO]** 9번째 자리까지 반복된 "무락 원자적 DELETE + `affected` 판정" 패턴이 spec/conventions 에 아직 정착되지 않음
  - target 위치: 없음(패턴 자체가 spec/conventions 어디에도 명문화돼 있지 않음) — `spec/5-system/1-auth.md`, `2-api-convention.md` 등 번들 전체를 검색해도 이 패턴을 서술한 Rationale·convention 문서가 없다
  - 과거 결정 출처: `plan/in-progress/webauthn-dup-delete.md` §0 결정 2 (spec 이 아니라 plan/tracker 수준의 기록) — 형제 여덟 커밋(`c9f0e1a75`·`890fcd9b7`·`3ba663db2`·`4d9064740`·`fc5ea6b76`·`4067bf777`·`4a9828afe`) 모두 `spec/` 미변경으로 확인(실측: 각 커밋 `git show --stat -- spec/` 공백 출력)
  - 상세: Rationale 연속성 관점에서 문제는 아니다(과거 결정을 뒤집는 것도, 기각된 대안을 되살리는 것도 아니고 오히려 8회 일관되게 지켜온 선례를 그대로 잇는다). 다만 아홉 번이나 반복된 설계 결정이 spec 어디에도 SoT 로 정착돼 있지 않다는 점은, 이 검토가 근거로 삼을 "합의된 원칙"의 출처가 plan 문서 산문에만 있다는 뜻이라 다음 자리(있다면)에서 같은 근거를 또 반증해야 하는 구조다
  - 제안: plan 체크리스트 항목 "결정 2 를 트래커에 등재"는 이미 계획돼 있다. 이번 계열이 "마지막"으로 선언된 만큼, 트래커 등재 시점에 `spec/conventions/` 에 짧은 패턴 문서(또는 기존 convention 문서의 한 절)로 승격할지 여부를 별도 판단하면 되고, 이번 PR 자체가 그것을 하지 않아도 Rationale 연속성 위반은 아니다

- **[INFO]** `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드가 `3-error-handling.md` 공용 카탈로그에 미등재
  - target 위치: `spec/5-system/1-auth.md` §5 DELETE/PATCH `/credentials/:id` 행 — "본인 소유 아니면 404"/"`WEBAUTHN_CREDENTIAL_NOT_FOUND`" 표현은 있으나 공용 에러 카탈로그(`3-error-handling.md`)에는 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 항목이 없음
  - 과거 결정 출처: `1-auth.md` §"읽기측 계약"/에러 카탈로그 인접 서술 — "같은 경로의 `USER_NOT_FOUND`·`WORKSPACE_NOT_FOUND` 는 ... generic 코드라 직접-추가 distinctive 가 아니어서 본 절 미등재"(§1.5 부근 각주)와 "`*_NOT_FOUND` 는 전부 404"(§ webhook 에러 카탈로그 각주) 원칙
  - 상세: 이는 이번 fix 가 만드는 문제가 아니라 기존 spec 의 갭이며(코드는 이미 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 를 던지고 있었다 — plan §B "404 코드" 행), 기존 convention("generic `*_NOT_FOUND` 는 카탈로그 미등재 허용")과 정합적으로 해석 가능해 Rationale 위반으로 보기 어렵다
  - 제안: 조치 불요. 필요하면 별도 spec-coverage 트랙에서 다룰 사안이며 이번 Rationale 연속성 판단에는 영향 없음

## 요약

이번 착수 대상(WebAuthn credential 동시 삭제 감사 중복 수정)은 동일 계열 여덟 건의 선행 수정과
기법·`spec_impact: none` 판단·에러 코드 재사용(`WEBAUTHN_CREDENTIAL_NOT_FOUND`, 기존 발행 코드)
모두에서 일관되며, `1-auth.md` 의 명시적 Rationale 항목(1.4.A~1.4.K, 2.3.A~D, 4.1.A~B 등) 중
어느 것도 기각된 대안의 재도입이나 합의 원칙 위반으로 걸리지 않는다. 유일하게 눈에 띄는 지점은
같은 서비스 안에 이미 서술된 "동시성 보호"(pessimistic lock, `verifyAuthentication` 대상) 문단과
이번에 적용할 "무락 + `affected` 판정" 기법이 병존하게 된다는 점인데, 대상 오퍼레이션의 위협
모델이 달라(보안 카운터 vs 감사 중복) 실질적 모순은 아니고 8회 선례가 이미 이 판단을 검증했다.
전반적으로 Rationale 연속성 관점의 리스크는 낮다.

## 위험도
LOW
