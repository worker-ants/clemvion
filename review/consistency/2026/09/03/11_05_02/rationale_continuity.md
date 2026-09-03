# Rationale 연속성 검토 — `spec/5-system/` (impl-done, diff-base `origin/main`)

## 발견사항

없음 (CRITICAL/WARNING/INFO 전부 미발견).

검토 범위 델타 2파일(`spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md`)이
공통으로 다루는 결정 — `changePassword` 의 `INVALID_PASSWORD` wire 코드를 형제 흐름
(`AuthService.verifyPasswordForUser`)과 동일한 `PASSWORD_REQUIRED`/`PASSWORD_INVALID`
2종으로 정렬 — 을 대상으로 아래 네 관점을 모두 점검했다.

### 1. 기각된 대안의 재도입 여부
target 은 바로 전날 커밋(`2ff000a6a`, `#1268`)이 `error-codes.md §3`(유지 예외 레지스트리)에
등재한 `INVALID_PASSWORD` 행을 오늘 **제거**하고 `§5`(은퇴 이력)로 옮긴다. 이것이 "기각된
결정의 재도입"처럼 보일 수 있으나, 실제로는 그 반대 방향이다 — `#1268` 자신이 "신설 여부는
미결이며 별도 plan(`auth-change-password-oauth-only-code-split.md`)에서 결정한다"고 명시적으로
이월해 두었고, 그 plan 이 오늘 결정을 내렸다. §3 행 제거 근거도 target 내 별도 주석
(`error-codes.md` 는 target 범위 밖이지만 교차 확인함)에 "어제 넣은 행을 오늘 빼는 게 낭비가
아니다 — §3 등재는 '유지한다'는 판단이었고 사용자 결정이 그 전제를 바꿨다. 판단의 이력은
§5 행이 이어받는다"로 적혀 있어, 번복이 아니라 **이월된 미결 사항의 완결**이다.

`PASSWORD_NOT_SET` 신설안(plan 상 "원안 B")은 명시적으로 검토되고 기각되었으며(근접 명명
3→4종 확대, `login_history.failure_reason` 감사값과의 동명 충돌 재생산 우려), 채택안(D — 형제
코드 재사용, 신규 코드 0)이 그 대안이 아니라는 점도 분명하다. 기각된 대안이 이유 명시 없이
재도입된 사례는 없다.

### 2. 합의된 원칙 위반 여부
`error-codes.md §2`("이름 정확성 향상만을 위한 rename 은 하지 않는다")를 이 변경이 위반하는지
검토했다. plan(`auth-change-password-oauth-only-code-split.md`)이 스스로 이 원칙을 인용하며
"정정 이득이 이름 정확성뿐이면 rename 금지"임을 확인한 뒤, 실제 채택안은 순수 rename 이 아니라
**이미 존재하던 두 개의 구분된 semantic 조건(미설정 vs 불일치)을 이미 존재하는 형제 코드로
정렬**한 것임을 근거로 진행했다. 신규 코드를 만들지 않았고, wire 코드 변경이 수반하는 breaking
리스크는 `§5` 의 "등급 B(잔여 위험 인수)" 프레임을 그대로 적용해 사용자 결정(2026-09-02)을
받는 절차를 밟았다 — 이는 `#1193`(`INVALID_INPUT`→`INVALID_TRIGGER_PARAMETERS`)이 확립한
선례와 동일한 절차를 재사용한 것으로, 원칙에서 벗어나지 않는다.

### 3. 결정의 무근거 번복 여부
아래 항목 모두 새 Rationale/근거 서술을 동반한다.
- `1-auth.md` §2.3 note·§5 note·§2.3.C(`OAuth-only` 문단): `INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 교체 근거와 §1.1.A 안내 경로 링크를 함께 기술.
- `3-error-handling.md` §1.2(행 제거)·§1.2.1(헤더·표·근접명명 주석): 종전 서술(`~~INVALID_PASSWORD~~` 취소선 보존 + "2026-09-02 갱신" 시점 명시)과 현재 상태를 나란히 적어 이력이 끊기지 않게 했다.
- `3-error-handling.md` 말미 `## Rationale`의 기존 bullet("§1 카탈로그 완결성 종결 — #882/#887 deferred 잔여 등재")도 **삭제·치환이 아니라 "(2026-09-02 후속)" 문단을 추가**하는 방식으로 갱신 — 원 계보가 보존된다.
번복된 결정마다 그 자리에서 근거가 함께 기록되어 있어 "무근거 번복"에 해당하는 사례는 없었다.

### 4. 암묵적 가정 충돌 여부
- 관련 invariant("`login_history.failure_reason` 감사값과 wire 코드는 별개 레이어") 를 이번
  변경이 우회하지 않는지 확인 — `1-auth.md` note·`3-error-handling.md` 근접명명 주석·plan
  모두 "문자열은 남는다(감사값으로 존속) — 다만 그것을 남기는 것은 로그인 실패이지
  비밀번호 변경이 아니다"를 명시하며, 실제로 `spec/1-data-model.md:710`·
  `spec/data-flow/2-auth.md:76` 의 `INVALID_PASSWORD` 참조는 손대지 않고 그대로 두었다(grep
  확인 — 두 곳 다 로그인 실패 감사 경로 서술).
- `1.1.B-5`(이메일 변경, `REAUTH_NOT_AVAILABLE`)와 이번 변경(`change-password`,
  `PASSWORD_REQUIRED`)은 서로 다른 엔드포인트·다른 코드로 명확히 분리되어 있어 혼동이나 충돌
  없음.
- 구현(`codebase/backend/src/common/utils/password.util.ts`, `users.service.ts:267-269`)을
  절대경로로 직접 확인 — `changePassword` 가 더 이상 `INVALID_PASSWORD` 를 발행하지 않고
  `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 만 발행함을 실측했다. spec 서술과 코드가 정확히
  일치한다.

## 요약

target 2파일(`1-auth.md`, `3-error-handling.md`)이 다루는 유일한 실질 변경 —
`change-password` 실패 코드를 형제 흐름과 정렬하며 `INVALID_PASSWORD` 를 wire 은퇴시키는
결정 — 은 바로 전날 등재된 `error-codes.md §3` 행을 스스로 명시적 근거와 함께 뒤집고,
그 뒤집음이 "이월된 미결 사항의 완결"임을 계보 문서(plan 두 건)와 spec 양쪽에서 일관되게
추적 가능하게 남겼다. 기각된 대안(`PASSWORD_NOT_SET` 신설)은 근거를 갖춰 명시적으로
기각되었고, `error-codes.md §2`(rename 금지 원칙)·§5(등급 B 리스크 인수 절차) 등 기존
합의 원칙은 우회가 아니라 정확히 그 원칙이 요구하는 절차(사용자 결정 확보)를 밟아 적용됐다.
과거 Rationale 문구는 삭제 대신 취소선·시점 주석으로 보존되어 이력 연속성이 유지되고, 감사
사유값 레이어와 wire 코드 레이어를 섞지 않는 기존 invariant 도 그대로 지켜졌다. 구현
코드 실측도 spec 서술과 정확히 일치해, Rationale 연속성 관점에서 이 변경은 모범적으로
처리되었다.

## 위험도
NONE
