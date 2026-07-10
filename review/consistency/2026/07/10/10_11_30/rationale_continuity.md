# Rationale 연속성 검토 — auth-reauth-spec-accuracy

## 발견사항

- **[WARNING]** §2.3 정정 후 동일 문서 내 `§1.1.B`·`Rationale 1.1.B-4` 가 stale 해짐 (backward-reference 미갱신)
  - target 위치: `plan/in-progress/auth-reauth-spec-accuracy.md` 변경 1a/1b (`spec/5-system/1-auth.md §2.3` 표 행 + note 추가) — 변경 목록에 `§1.1.B`(L79)·`## Rationale 1.1.B-4`(L515-516) 갱신이 없음
  - 과거 결정 출처: `spec/5-system/1-auth.md` §1.1.B (L79) "이메일 OTP 배제: ... §2.3 의 '이메일 OTP' 대체 수단은 채택하지 않는다" / `## Rationale` 1.1.B-4 (L515-516) "§2.3 강제 종료 재인증은 OAuth-only 대안으로 '이메일 OTP' 를 언급하지만 ... §2.3 의 세션-revoke 재인증 정의 자체는 본 작업에서 변경하지 않는다"
  - 상세: target 은 §2.3 표 행에서 "이메일 OTP"/"WebAuthn" 대체 문구를 완전히 제거하고 password OR TOTP 로 정렬한다(변경 1a). 그런데 같은 문서의 두 backward-reference 는 그대로 남는다 — (1) L79 는 "§2.3 의 이메일 OTP 대체 수단"이 **존재함을 전제**로 그것과 email-change 정책을 "차등"시키는 문장인데, §2.3 정정 후에는 그 전제 자체가 사라진다. (2) Rationale 1.1.B-4 도 동일하게 "§2.3 강제 종료 재인증은 ... 이메일 OTP 를 언급하지만"이라는 현재-시제 서술과, "§2.3 의 세션-revoke 재인증 정의 자체는 본 작업(=email-change 스펙 작업)에서 변경하지 않는다"는 문장을 담고 있다 — 이 문장은 *그 당시엔* 맞았지만 지금 작업이 바로 그 §2.3 정의를 변경하므로 stale 해진다. 즉 "drift 를 없애는" 이번 작업이 같은 파일 안에 새로운 (작지만 실재하는) drift 를 하나 남기게 된다. 결정 자체(§2.3 정정 방향)는 Rationale 1.1.B-4 의 이미 확립된 사실(verifyReauth=password OR TOTP, WebAuthn 미지원)과 정확히 정렬되어 있어 "기각된 대안 재도입"이나 "원칙 위반"은 아니다 — 이는 순수하게 *동일 PR 내 backward-reference 동기화 누락*.
  - 제안: 변경 목록에 (a) `§1.1.B` L79 를 "§2.3 의 재인증 흐름은 이제 이메일 변경과 동형(password OR TOTP)이며, 이메일 변경만 그 안에서도 이메일 OTP 를 배제한다"는 취지로 재서술, (b) `Rationale 1.1.B-4` 제목의 "(§2.3 세션-revoke 재인증과 차등)"과 본문의 "언급하지만"/"본 작업에서 변경하지 않는다" 문장을 §2.3 이 이번 작업(`auth-reauth-spec-accuracy`)으로 정정되었음을 반영하도록 갱신하는 항목을 추가할 것을 권장.

- **[INFO]** §2.3 결정의 새 Rationale 이 결정이 실제로 속한 `1-auth.md` 가 아니라 `3-error-handling.md` 에만 추가됨
  - target 위치: 변경 2c (`spec/5-system/3-error-handling.md ## Rationale` 신규 bullet)
  - 과거 결정 출처: CLAUDE.md 정보 저장 위치 표 "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
  - 상세: §2.3 "강제 종료 재인증" 행을 아웃라이어에서 기존 합의(Rationale 1.1.B-4)로 정렬한다는 결정은 본질적으로 `1-auth.md` 의 결정이다(그 문서의 표 행을 바꾸는 것이므로). 그런데 그 근거를 설명하는 신규 Rationale bullet 은 `3-error-handling.md` 쪽에만 추가되고 `1-auth.md` 자체의 `## Rationale` 에는 신규 항목이 없다. 나중에 `1-auth.md` 만 읽는 사람은 왜 §2.3 표 행이 이렇게 서술됐는지의 근거를 그 문서 안에서 찾지 못하고(위 WARNING 처럼 오히려 stale 한 1.1.B-4 만 보게 됨), `3-error-handling.md` 까지 가야 알 수 있다.
  - 제안: `1-auth.md ## Rationale` 에도 짧은 신규 항목(예: "2.3.D — §2.3 재인증 흐름 정합화(1.1.B-4 정렬)") 을 추가하거나, 최소한 §2.3 표 직후 note 에서 3-error-handling.md 의 신규 bullet 을 상호 참조하도록 링크를 붙일 것.

- **[INFO]** 배경 서술이 이번 작업의 실제 결정 계보(`spec-draft-email-change.md` 의 명시적 보류)를 인용하지 않음
  - target 위치: `plan/in-progress/auth-reauth-spec-accuracy.md` "## 배경 (후속 종결)" 절
  - 과거 결정 출처: `plan/complete/spec-draft-email-change.md` L102 "**§2.3 의 기존 '강제 종료 재인증' 행(이메일 OTP 문구 포함)은 건드리지 않는다** — 그 reauth 정합은 `plan/in-progress/refactor-auth-reverify-unify.md` 영역(§범위 밖/후속)" 및 `plan/complete/refactor-auth-reverify-unify.md` (완료, 그러나 실제 범위는 bcrypt 헬퍼 통합뿐이었고 §2.3 문구 정정은 수행하지 않음 — "범위 밖 / 후속" 목록에도 미등재)
  - 상세: target 의 "배경" 은 이번 작업을 "#882(에러코드 카탈로그 SoT) 완결" 의 후속으로만 설명하지만, 실제로는 그보다 이전에 `spec-draft-email-change.md` 가 §2.3 문구 수정을 명시적으로 범위 밖으로 미루면서 `refactor-auth-reverify-unify` 영역으로 위임했고, 그 위임된 작업은 (완료됐음에도) 문구 정정을 다루지 않은 채 "범위 밖 / 후속" 목록에도 올리지 않아 사실상 유실됐다. 이번 target 은 그 유실된 후속을 결과적으로 완결하는 셈이라 방향은 옳지만, 이 계보를 배경에 명시하지 않으면 "왜 지금 와서야 손대는가"의 이력 추적이 어려워진다.
  - 제안: 배경 절에 한 문장("`spec-draft-email-change.md` R7/§범위밖 이 §2.3 문구 정정을 `refactor-auth-reverify-unify` 로 미뤘으나 해당 작업 완료 시 반영되지 않아 유실됐고, 본 작업이 이를 완결한다")을 추가.

## 요약

target 이 제안하는 §2.3 "강제 종료 재인증" 행 정정은 `Rationale 1.1.B-4`(이미 확립: `verifyReauth`=password OR TOTP, WebAuthn 미지원)와 `9-user-profile.md`(L341/342, "비밀번호/TOTP 재인증"), `3-error-handling.md §1.2.1`(L62, `REAUTH_NOT_AVAILABLE` 가 이미 "§2.3 세션-revoke 재인증 상류 공용"으로 등재), 실제 코드(`sessions.service.ts` `verifyReauth`)와 정확히 정렬되어 있다 — 기각된 대안의 재도입도, 합의 원칙 위반도 아니며, 오히려 §2.3 자체가 유일한 아웃라이어였던 drift 를 기존에 이미 문서화된 Rationale 로 되돌리는 작업이다. 다만 이 fix 가 §2.3 텍스트만 바꾸고 같은 문서 내 두 backward-reference(`§1.1.B` L79, `Rationale 1.1.B-4` L515-516)를 갱신하지 않아 "§2.3 이 이메일 OTP 를 언급한다"는 이제-틀린 전제가 남는 점, 그리고 §2.3 결정의 새 Rationale 이 `1-auth.md` 가 아닌 `3-error-handling.md` 에만 적재되는 점은 동일 PR 내에서 정리하는 것이 바람직하다. 두 사안 모두 결정 자체의 정당성과 무관한 "정합 마무리" 성격이라 CRITICAL 로 볼 근거는 없다.

## 위험도

LOW
