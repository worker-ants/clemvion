# Cross-Spec 일관성 검토 — `spec-draft-change-password-code-alignment.md`

> 참고: `_prompts/cross_spec.md` 에 번들된 `spec/5-system/1-auth.md`·`spec/5-system/3-error-handling.md`·
> `spec/2-navigation/9-user-profile.md` 는 컨텍스트 예산 초과로 **본문이 전량 절단**되어 있었고,
> `spec/conventions/error-codes.md` 는 번들에 아예 포함되지 않았다(직접 인용된 §3 임에도). 이 네
> 파일이 정확히 이 draft 의 `spec_impact` 대상이라 번들만으로는 검토가 불가능해, 저장소의 실제
> spec 파일 4종 전문을 직접 읽어 검토했다.

## 발견사항

- **[WARNING]** `1-auth.md §2.3` "재인증 에러 코드" note 가 `changePassword` 를 새 공유자로 반영하지 않음
  - target 위치: `plan/in-progress/spec-draft-change-password-code-alignment.md` "변경안" 표 (항목 1~3, `spec/5-system/1-auth.md` 대상 라인 `:339`/`:521`/`:750` 만 편집 대상으로 명시)
  - 충돌 대상: `spec/5-system/1-auth.md:337` (§2.3 바로 위 문단, `verifyReauth` 전용 note)
    > "`PASSWORD_INVALID` 는 2FA 비활성화·WebAuthn credential 관리의 비밀번호 재확인(`AuthService.verifyPasswordForUser`)과 ... **동일 코드**를 공유한다."
  - 상세: draft 결정①은 `changePassword` 를 `PASSWORD_INVALID`/`PASSWORD_REQUIRED` 의 세 번째 발행처로 만든다. 이 변경은 바로 아래 §5 note(`:521`, 항목 2) 와 `3-error-handling.md` 카탈로그 행(`:66`/`:67`, 항목 5·6)에는 반영되지만, **한 문단 위의 `:337` note 는 changeset 목록에 없다.** `:337` 은 "PASSWORD_INVALID 를 공유하는 발행처"를 명시적으로 열거하는 문장이라(현재는 `verifyPasswordForUser` 하나만 적혀 있음), 이 draft 가 반영되면 그 열거가 실제 발행처보다 좁아진다 — 이 PR 전체의 동기(`INVALID_PASSWORD` 가 "이름이 실제 조건보다 좁다")와 같은 종류의 결함을 같은 문서, 같은 절에 새로 만드는 셈이다. `:70`(error-handling.md 근접 명명 주석, 항목 7) 은 이런 열거를 정확히 갱신하는 사례로 이미 draft 안에 있어, 이 프로젝트가 이런 열거의 정확성을 실제로 관리한다는 선례가 있다.
  - 제안: 변경안 표에 `1-auth.md:337` 행을 추가하거나(가장 안전), `:339` 편집 시 `:337` 문장 말미에 "(및 아래 비밀번호 변경 note)" 식의 상호 참조를 덧붙여 열거가 완결되게 한다.

- **[INFO]** `error-codes.md §5` "Rename 이력" 표는 지금까지 1(구 코드) : 1(대체 코드) 매핑만 있었다
  - target 위치: 변경안 표 항목 10 (`error-codes.md §5 표` — 신규 행 "구 `INVALID_PASSWORD` → 대체 `PASSWORD_REQUIRED`+`PASSWORD_INVALID`")
  - 충돌 대상: `spec/conventions/error-codes.md` §5 기존 행 3건(`LLM_CONFIG_NOT_FOUND`→`MODEL_CONFIG_DEFAULT_MISSING` 등) — 전부 1:1 매핑
  - 상세: 모순은 아니지만, 이 표가 처음으로 "구 코드 1개 → 조건별 대체 코드 2개" 형태를 갖게 된다. 표 스키마(구 코드 | 대체 코드 | HTTP | PR | 비고) 자체는 이 shape 를 명시적으로 예상하고 있지 않다 — "대체 코드" 셀에 조건-코드 매핑(미설정→A / 불일치→B)을 풀어 쓰지 않으면 다음 사람이 "언제 어느 코드로 갔는지"를 표만 보고 못 읽는다.
  - 제안: 새 행의 "대체 코드" 셀에 조건별 매핑을 `PASSWORD_REQUIRED`(미설정) / `PASSWORD_INVALID`(불일치) 처럼 조건과 함께 표기.

- **[INFO]** `error-codes.md §5` 표의 `PR` 열은 지금까지 "이미 병합된 구현"만 기록해 왔다
  - target 위치: 변경안 표 항목 10
  - 충돌 대상: `spec/conventions/error-codes.md §5` 기존 행들(`PR4b`, `#1193`, `#566` — 모두 완료된 구현 참조)
  - 상세: 이 draft 는 spec-first 로 codebase 변경(`users.service.ts` 등)을 developer 턴에 인계한다. §5 행이 spec 승인 시점에 먼저 생기면 `PR` 열에 채울 값이 아직 없다 — 사소하지만, 표 관례상 이 열은 "완료된 변경의 사후 기록"이라는 암묵적 전제가 있었다.
  - 제안: PR 미정 상태를 나타내는 placeholder(예: 계획 문서 링크) 사용을 명시하거나, §5 행 추가를 developer 턴 완료 후로 미루는 대안도 검토 가치가 있다(단, planner 재승인 부담과 트레이드오프).

## 교차 검증 요약 (모순 없음을 확인한 항목)

- `1-auth.md:339`·`:521`·`:750`, `3-error-handling.md §1.2`(`:50`,`:66`,`:67`,`:70`), `9-user-profile.md:147` — draft 가 인용한 모든 라인 번호·본문이 저장소 현재 상태와 정확히 일치.
- `1-data-model.md §2.18.2 LoginHistory` — `event` enum 에 `change_password` 류가 없고 `failure_reason=INVALID_PASSWORD` 는 오직 `login_failed` 이벤트(§1.2 로그인 흐름)에서만 쓰인다는 draft 의 "감사값은 레이어가 다르다" 주장과 정확히 일치(`data-flow/2-auth.md:76` 시퀀스가 이를 뒷받침).
- `spec/**` 전체 grep 결과 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 를 참조하는 파일은 draft 의 `spec_impact` 4개뿐 — FE 코드-매핑 표(`10-auth-flow.md`, `11-error-empty-states.md`)에는 이 코드들에 대한 별도 참조가 없어 다른 화면 spec 과의 숨은 결합 없음.
- `error-codes.md §3` `INVALID_PASSWORD` 항목이 이미 `PASSWORD_REQUIRED`/`PASSWORD_INVALID`/미결정임을 정확히 서술하고 있어(2026-09-02 이전부터), draft 의 결정①·②·③ 은 그 기존 서술이 예고한 그대로를 확정하는 것 — 새로운 모순을 만들지 않는다.
- RBAC 매트릭스(§3.2) 에 `change-password` 관련 행 없음 — 워크스페이스 역할과 무관한 본인-인증 액션이라 이번 변경이 RBAC 규칙과 접촉하지 않음.
- §5 grade B(잔여 위험 인수) 재사용 — `error-codes.md` 원칙문의 "B 는 예외로 세어야" 요구와 draft 의 "두 번째 B" 명시가 일치.

## 요약

번들 파일이 예산 초과로 정확히 이 draft 의 대상 4개 spec 파일 본문을 전량 누락시켰기 때문에 저장소 원문을 직접 읽어 검토했다. 그 결과 draft 가 인용하는 모든 라인·본문은 현재 spec 상태와 정확히 일치했고, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 모두에서 CRITICAL 급 모순은 발견되지 않았다. 유일한 실질적 갭은 `1-auth.md:337`(§2.3 재인증 note) 이 `changePassword` 를 새 `PASSWORD_INVALID`/`PASSWORD_REQUIRED` 발행처로 반영하지 않아, changeset 이 적용된 뒤 이 문장 자체가 "발행처 목록이 실제보다 좁은" — 이 PR이 고치려는 결함과 동형인 — 상태가 된다는 점이다. 나머지 두 건은 `error-codes.md §5` 표의 관례(1:1 매핑, 완료-PR 전제)가 이번 행에서 처음 깨진다는 문서 스타일 수준의 INFO다.

## 위험도

LOW
