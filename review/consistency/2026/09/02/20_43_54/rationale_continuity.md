# Rationale 연속성 검토 — `plan/in-progress/spec-draft-api-convention-status-and-password-codes.md`

## 발견사항

- **[WARNING]** 결정 ③(`INVALID_PASSWORD` §3 등재)이 `error-codes.md §2` 의 절반만 인용하고, 같은 절이 명시하는 "의미 분기 시 신규 코드 신설" 원칙과 형제 코드 선례를 다루지 않음
  - target 위치: `plan/in-progress/spec-draft-api-convention-status-and-password-codes.md:110-119`(`### rename 하지 않는 근거`)
  - 과거 결정 출처: `spec/conventions/error-codes.md` §2("이름 정확성 향상만을 위한 rename 은 **하지 않는다**. **의미가 분기되거나 새 조건이 생기면 새 코드를 신설한다.**") 및 §5 Rationale "그 2분법에 없던 제3상태를 §5 표 등급 B 로 명문화했다" 항(저장소 밖 호출자를 원리적으로 배제할 수 없는 표면에서는 *등록만 하고 방치*가 아니라 *잔여 위험을 명시 인수하며 실제로 정정*하는 것이 이 카탈로그의 확립된 패턴 — grade A/B 프레임)
  - 상세: `INVALID_PASSWORD` 는 `users.service.changePassword` 에서 **두 개의 다른 조건**(OAuth-only 로 `passwordHash` 부재 / 현재 비밀번호 불일치)에 같은 코드를 던진다(`codebase/backend/src/modules/users/users.service.ts:266,282-294` 의 docstring·구현으로 확인). §2 원문은 바로 이 상황("의미가 분기") 에 대해 **"새 코드를 신설한다"** 고 명시하며, 실제로 형제 흐름 두 곳(`verifyPasswordForUser`→`PASSWORD_REQUIRED`/`PASSWORD_INVALID`, `verifyReauth`→`REAUTH_REQUIRED`/`PASSWORD_INVALID`)은 정확히 이 원칙대로 조건별로 코드를 갈랐다(이 형제 분리 자체가 target 문서 §3 표에 이미 인용돼 있다). target 은 §2 의 **"rename 금지"** 절반만 인용해 "그러니 고치지 않는다" 로 귀결하고, §2 의 **"신설"** 절반과 이 형제 선례를 다루지 않는다. 또한 §5 Rationale 이 명문화한 grade A/B 프레임 — "저장소 밖 호출자를 원리적으로 배제 못하는 표면은 *영구 등록* 이 아니라 *잔여 위험을 인수하며 정정*한다" — 도 언급 없이 지나간다. `INVALID_PASSWORD` 는 인증된 최종사용자 REST 엔드포인트(Bearer 토큰)로, §5 가 grade B 사례로 든 "워크스페이스 JWT 로 호출 가능한 내부 REST 엔드포인트" 와 구조적으로 유사하다 — 그런데 그 정확한 상황을 위해 이 카탈로그가 이미 마련해 둔 완화 경로(신규 코드 추가 + 위험 인수, grade B)를 검토조차 하지 않고 §3(영구 예외 등록)으로 직행한다.
  - 추가 사실 오류: 근거로 든 e2e 2곳 중 하나가 틀렸다. `users-email-change.e2e-spec.ts:101` 는 `expect(wrongPw.body.error.code).toBe('PASSWORD_INVALID')` 를 단언한다(형제 코드) — `INVALID_PASSWORD` 가 아니다(실측: `grep -n INVALID_PASSWORD codebase/backend/test/users-email-change.e2e-spec.ts` 0건). `INVALID_PASSWORD` 를 실제로 단언하는 곳은 `users-change-password.e2e-spec.ts:96` 한 곳뿐이며, 그마저 **불일치(mismatch) 분기만** 커버한다(`it('rejects wrong current password → 401 INVALID_PASSWORD, ...)`). 즉 "missing password(OAuth-only)" 조건에 **새 코드를 추가**하고 mismatch 조건은 기존 `INVALID_PASSWORD` 그대로 두는 §2 "신설" 경로를 택해도, 인용된 e2e 자산은 깨지지 않는다 — target 이 제시한 breaking-비용 근거가 실측과 어긋난다.
  - 제안: 다음 중 하나로 target 을 보강한다. (a) §2 의 "신설" 절반과 형제 코드 선례·§5 grade A/B 프레임을 인용해 **왜 이 케이스는 신설 대신 §3 등록이 맞는지**(예: mismatch/missing 두 조건을 클라이언트가 실제로 구분해야 할 필요가 없다는 제품 판단 등) 새 Rationale 문장을 추가하거나, (b) 형제 패턴을 따라 missing-password 조건에 신규 코드(예: `PASSWORD_NOT_SET`)를 신설하고 §5 Rationale 형식(grade 표기)에 맞춰 등재한다. 어느 쪽이든 `users-email-change.e2e-spec.ts:101` 인용은 `PASSWORD_INVALID` 로 정정하거나 제거한다.

- **[INFO]** `spec/conventions/error-codes.md` 가 이번 checker 의 Rationale 번들에 전혀 포함되지 않음 (orchestrator 측 갭)
  - target 위치: 프롬프트 번들 — `spec/conventions/error-codes.md` 는 "생략된 파일 77개" 목록에도 없고 `<!-- @bundle-file -->` 헤더로도 등장하지 않음(완전 부재)
  - 과거 결정 출처: 해당 없음(번들 구성 문제)
  - 상세: target 의 `spec_impact` 3개 파일 중 정작 결정 ③의 직접 대상인 `spec/conventions/error-codes.md` 의 `## Rationale`(§2 rename 정책·§3 등재 기준·§5 grade A/B)가 번들에 없어, 이 checker 가 `Read` 로 직접 열지 않았다면 위 WARNING 을 놓쳤을 것이다. 실제로 이 파일은 `spec/5-system/2-api-convention.md`·`3-error-handling.md`·`0-overview.md`·`1-data-model.md`·`2-navigation/*` 등 여러 파일 뒤에도 등장하지 않는다.
  - 제안: 향후 이 checker 호출을 조립하는 스크립트가 `spec_impact` 목록의 각 파일이 번들에 실제로 포함됐는지(헤더 존재 여부) 자체 점검하도록 보강할 가치가 있음.

## 요약

결정 ①·②(`202`/`410` §6 표 등재, §5.3 "410 기본값 없음" 명시)는 실측이 탄탄하고, target 문서 자체의 `## Rationale` 절에서 대안("§6 을 대표 예시로 격하")을 명시적으로 검토·기각해 이 checker 의 3번 관점("결정 번복 시 새 Rationale 동반")을 스스로 충족한다 — 특히 §5.3 관련 결정은 이 저장소가 반복 지적해 온 "문서한 보장이 구현보다 넓다" 함정을 정확히 피하고 있어 Rationale 연속성 관점에서 모범적이다. 다만 결정 ③(`INVALID_PASSWORD` §3 등재)은 자신이 인용하는 바로 그 `error-codes.md §2` 조항의 절반("의미 분기 시 새 코드 신설")과, 같은 카탈로그가 이미 형제 코드(§1.2.1 PASSWORD_REQUIRED/PASSWORD_INVALID, REAUTH_REQUIRED/PASSWORD_INVALID)에 적용한 선례, 그리고 §5 가 명문화한 "잔여 위험 인수형 정정"(grade A/B) 경로를 다루지 않은 채 "rename 하지 않는다" 결론으로 직행했고, 그 결론을 뒷받침하는 e2e 근거 하나가 실측과 다르다(다른 코드를 단언). 명시적으로 기각된 대안을 되살린 것은 아니므로 CRITICAL 은 아니지만, 원칙 적용이 편향돼 있고 이를 메울 새 Rationale 이 없어 WARNING 수준의 연속성 결함으로 판단한다.

## 위험도
MEDIUM
