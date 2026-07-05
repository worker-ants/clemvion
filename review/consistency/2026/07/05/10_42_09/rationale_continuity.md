# Rationale 연속성 검토 결과

## 대상

- target: `plan/in-progress/spec-draft-auth-webauthn-list-format.md`
- 검토 모드: spec draft 검토 (`--spec`)
- 관련 spec: `spec/5-system/1-auth.md`, `spec/5-system/2-api-convention.md`, `spec/conventions/swagger.md`, `spec/2-navigation/9-user-profile.md`

## 검토 방법

target draft 의 변경 1~5 및 그 근거(§ "실체(근거)" 섹션)를 다음과 대조했다:

- `spec/conventions/swagger.md` `## Rationale` §5 원문 (line 316-317)
- `spec/5-system/2-api-convention.md` §5.2 / `## Rationale` 원문
- `codebase/backend/src/common/interceptors/transform.interceptor.ts` (`'data' in data` pass-through 실제 구현)
- `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` (`webauthnList`, line 269-288 — 실제 `{ data: { items } }` 직접 반환 확인)
- `codebase/backend/src/modules/auth/sessions.controller.ts` (74/120/164 line — 동일 패턴 확인)
- `spec/5-system/1-auth.md` line 469, `spec/2-navigation/9-user-profile.md` line 329 원문

## 발견사항

### [INFO] swagger.md §5 Rationale "유일한 예외" 정정은 기각 대안 재도입이 아니라 사실 정정

- target 위치: 변경 4 (4a) — `spec/conventions/swagger.md` Rationale §5 (line 317) "유일한 예외" → "주요 pass-through 사례" 정정
- 과거 결정 출처: `spec/conventions/swagger.md` `## Rationale` §5 "ApiOkPaginatedResponse single-wrap (pass-through 예외)" — "§2-5 의 '성공 응답을 `{ data }` 로 감싼다'는 보편 규칙의 **유일한 예외**가 된다"
- 상세: 이 Rationale 항목이 실제로 기각한 대안은 `{ data: { data, pagination } }` double-wrap(과거 헬퍼 버그)이며, "유일한 예외"라는 표현은 그 결정을 서술하는 과정에서 pass-through 분기를 사용하는 다른 사례(sessions/webauthn)를 인지하지 못한 채 작성된 것으로 보인다. 코드 확인 결과 `webauthn.controller.ts:281-288`·`sessions.controller.ts:74/120/164` 모두 이미 `{ data: { items } }` 를 직접 반환해 동일 pass-through 분기(`transform.interceptor.ts:25` `'data' in data`)를 타고 있다. 따라서 target 의 "유일한 예외 → 주요 사례(2건)" 정정은 새 설계 결정을 도입하는 것이 아니라, 과거 Rationale 서술의 사실 오류(당시 존재했던 코드 현실을 놓친 진술)를 코드 근거로 바로잡는 것이다.
- 제안: 현재 target(변경 4a) 은 이미 이 정정을 명시적으로 수행하고 있으며 새 근거(코드 사실 표)까지 §5.2 note(변경 1)·api-convention Rationale(변경 3)에 병기하고 있어 "무근거 번복"에 해당하지 않는다. 추가 조치 불요. 다만 향후 유사 pass-through 사례가 더 발견되면 "주요 사례" 목록을 다시 확장해야 하므로, swagger.md §5 문구를 "유일한/주요 N개 예외"처럼 폐쇄적 열거로 두지 말고 "§5.2 note 를 따르는 비-페이징 고정 컬렉션 전반"처럼 개방형으로 일반화하는 편이 향후 유지보수에 유리하다는 점은 참고할 만하다.

### [INFO] swagger.md §6 "버그" 패턴과의 경계 구분은 Rationale 원칙(레거시 패턴 제거)과 정합

- target 위치: 변경 4 (4c) — swagger.md §6 (line 305) 각주 추가
- 과거 결정 출처: `spec/conventions/swagger.md` §6 "레거시 패턴 제거" — "`{ data: { items, totalItems, page, limit } }` 처럼 서비스 실제 반환 형태(`{ data, pagination }`) 와 다른 스키마는 버그입니다"
- 상세: §6 이 기각한 것은 "pagination 메타(`totalItems`/`page`/`limit`)를 `items` 형제로 뒤섞어 `{ data, pagination }` 형태와 어긋나는" 특정 오용 패턴이다. target 이 도입하려는 비-페이징 고정 컬렉션(`{ data: { items } }`, pagination 필드 자체가 없음)은 이 오용 패턴의 정의역(페이지네이션 메타 포함 여부)에 애초에 속하지 않는다. draft 는 이 구분을 각주로 명시해 두 패턴이 혼동되지 않도록 하고 있어, §6 원칙(정상 pass-through 사례를 legacy 버그로 오분류하지 않기)을 침해하지 않는다.
- 제안: 없음 (정합).

### [INFO] api-convention Rationale 신규 subsection 은 형식 요건 충족

- target 위치: 변경 3 — `spec/5-system/2-api-convention.md` `## Rationale` 에 신규 subsection 추가
- 과거 결정 출처: 없음 (신규 결정에 대한 최초 Rationale 기록)
- 상세: target 은 §5.2 본문 변경(변경 1)과 짝을 이루는 "왜 이 형태를 유지하는가"·"기각한 대안(bare-array 정규화, Option B)"·"defer 사유"를 Rationale 에 함께 기록하고 있다. 이는 CLAUDE.md 의 "결정의 배경·근거는 spec 문서 끝의 `## Rationale`" 원칙과 "결정의 무근거 번복" 방지 요건을 정확히 충족한다.
- 제안: 없음.

### [INFO] 9-user-profile.md 변경은 canonical spec(1-auth.md)과의 기존 위임 관계를 유지

- target 위치: 변경 5 — `spec/2-navigation/9-user-profile.md` line 329
- 과거 결정 출처: 해당 문서에 세션 API 의 canonical 정의는 없음 (문서 자체가 표에서 "canonical: 인증 spec" 위임 패턴을 이미 사용 중 — 예: line 328 `enable-2fa`/`confirm-2fa` 행)
- 상세: 변경 5 는 새 원칙을 도입하지 않고 기존 표 서술에 응답 shape 참조를 추가하는 보강이며, 다른 spec 의 Rationale 과 충돌하지 않는다.
- 제안: 없음.

## 검토 범위 밖 확인 사항

- `install_token`/Cafe24 관련 Rationale, `Attention 가상 필터값` 등 프롬프트에 포함된 다른 영역 Rationale 발췌는 본 target 의 변경 범위(WebAuthn/세션 목록 응답 포맷)와 무관하여 충돌 여지가 없음을 확인했다.
- target 의 "범위 밖 (follow-up)" 절이 지적한 `webauthn-response.dto.ts:77` stale 주석("SessionListDto 의 이중 중첩 패턴은 피한다")은 정확히 이번 draft 가 정정하는 사실(SessionListDto 도 이미 단일 `{items}` 패턴)과 모순되는 구 코드 주석이다. 이는 코드 주석이라 spec Rationale 연속성 위반은 아니지만, target 이 이를 follow-up 으로 명시 등록한 점은 "결정 번복 시 관련 흔적 정리" 관점에서 적절하다.

## 요약

target draft 는 코드가 이미 채택하고 있는 실제 계약(`{data:{items}}`)을 spec 텍스트에 반영하는 문서 정직화(non-breaking) 작업이며, 초기 draft 가 받은 cross_spec CRITICAL("swagger.md Rationale §5 '유일한 예외' 단정과 충돌")을 원인 소급 정정(변경 4)으로 흡수했다. swagger.md §5 Rationale 이 실제로 기각한 대안은 pagination double-wrap 버그이지 비-페이징 pass-through 자체가 아니므로, "유일한 예외 → 주요 사례" 정정은 기각된 대안의 재도입이 아니라 과거 서술의 사실 오류를 코드 근거로 바로잡는 것이다. §6 "버그" 패턴과의 경계도 각주로 명확히 구분해 두 원칙(§2-5 pass-through 정당성 vs §6 pagination 메타 오용 금지)이 혼동되지 않도록 처리했다. 새 결정(현 shape 유지, bare-array 정규화는 defer)에 대한 근거·기각 대안 모두 api-convention Rationale 에 신규 기록되어 "결정의 무근거 번복" 요건도 충족한다. Rationale 연속성 관점에서 문제가 되는 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

NONE
