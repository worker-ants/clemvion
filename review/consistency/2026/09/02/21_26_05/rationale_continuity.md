# Rationale 연속성 검토 — `spec-draft-change-password-code-alignment.md`

## 발견사항

이번 target 은 `spec/conventions/error-codes.md` §3/§5, `spec/5-system/1-auth.md` Rationale
(2.3.C 포함), `spec/5-system/3-error-handling.md` §1.2/§1.2.1 등 관련 Rationale 을 전수
대조한 결과 **CRITICAL/WARNING 급 위반을 찾지 못했다.** 아래는 INFO 수준 보완 제안 1건뿐이다.

- **[INFO]** `error-codes.md §5` 신규 행의 "레이어 caveat" 서술 위치를 명확히
  - target 위치: 변경안 표 #11b (`error-codes.md` §5 머리말)
  - 과거 결정 출처: [`error-codes.md §5` 머리말](../../../../../spec/conventions/error-codes.md#5-rename-이력-retired-codes) — *"구 코드는 더 이상 발행되지 않으며(코드베이스에서 완전 제거)"*
  - 상세: target 은 이 전제가 `INVALID_PASSWORD` 행에서는 성립하지 않는다는 것(감사 사유값
    `login_history.failure_reason` 로 존속)을 §5 **머리말**에 caveat 한 문장으로 추가하겠다고
    적었다(`--spec` INFO#3 인계). 타당한 처리이나, 머리말에 caveat 을 넣으면 이후 §5 에 추가되는
    "완전 제거"가 실제로 참인 다른 행들까지 매번 "정말 완전 제거인지" 를 되짚게 만들 수 있다.
  - 제안: caveat 을 머리말이 아니라 **해당 행의 "비고" 셀**에 국한해 적는 것도 대안으로 검토할
    가치가 있다 — 머리말은 일반 규칙으로 남기고 예외는 행 단위로 격리하면, 다른 완전-제거 행의
    신뢰도를 매번 재검증하게 만들지 않는다. (target 이 이미 머리말 caveat 을 "이 행이 첫
    사례" 로 명시하겠다고 적어 두어 실질 위험은 낮음 — 채택/기각 어느 쪽이든 CRITICAL 은 아니다.)

## 교차 검증한 항목 (위반 없음 확인)

- **§1 의미 기반 명명 원칙** — "구현 세부·전이적 맥락을 이름에 박지 않는다" (`error-codes.md §1`,
  `spec/conventions/error-codes.md:41-42`). target 결정①이 `PASSWORD_REQUIRED`/`PASSWORD_INVALID`
  를 `verifyPasswordForUser` 전용에서 `changePassword` 로 확장 재사용하는 것은 이 원칙을 그대로
  따른 것이지 위반이 아니다.
- **§2 rename 정책 + §5 A/B 등급 체계** — target 은 `INVALID_PASSWORD` 를 신규 코드로 rename 하지
  않고 §5 의 기존 A/B 이분법 중 **등급 B**(잔여 위험 인수)로 명시 분류했고, 그 근거(워크스페이스
  JWT 로 호출 가능한 내부 REST)가 §5 의 B 등급 정의(`error-codes.md:157`)와 정확히 일치한다.
  "두 번째 B 사례" 로 스스로 표시하겠다는 계획도 §5 Rationale 의 경고("B 는 예외로 세어야 하지
  관행으로 굳혀선 안 된다", `error-codes.md:162`)의 취지(가시성 확보)를 그대로 이행한다.
- **기각된 대안 재도입 여부** — `PASSWORD_NOT_SET` 신설안은 `auth-change-password-oauth-only-code-split.md`
  의 결정 기록에서 이미 기각됐고(감사값과의 wire/audit 동명 충돌 재생산 우려), target 은 이
  기각을 다시 채택하지 않고 그대로 유지한다.
- **`error-codes.md §3` 행의 조건부 서술과의 정합** — 현재 §3 의 `INVALID_PASSWORD` 행은
  "미설정 조건을 별도 코드로 분리할지는 **미결**이며 [`auth-change-password-oauth-only-code-split.md`]
  에서 결정한다" 라고 명시한다(`error-codes.md:82`). target 은 정확히 그 미결 사항을 해소하는
  후속 draft이며, §3→§5 이관도 §3 머리말의 경계 정의("§3 은 *유지*되는 active 코드, 은퇴는 §5",
  `error-codes.md:84`)를 그대로 따른다.
- **`1-auth.md` Rationale 2.3.C 와의 정합** — 2.3.C 는 "OAuth-only 사용자: `passwordHash` 가
  없으면 `POST /users/me/change-password` 자체가 `INVALID_PASSWORD` 로 차단되므로(**현행**)
  본 정책은 비밀번호 보유 사용자에만 적용된다" 라고 적고 있다(`1-auth.md:750`). target 의 코드
  변경(OAuth-only → `PASSWORD_REQUIRED`)이 이 문장을 stale 하게 만들 위험이 있었으나, target 의
  변경안 표 **#3**(`1-auth.md:750` "OAuth-only 정책 note" → `PASSWORD_REQUIRED` 로 차단 서술 갱신)
  이 정확히 이 위치를 겨냥하고 있어 **누락이 아니다** (라인 번호·문맥 모두 대조 확인).
- **`spec/1-data-model.md §2.18.2` · `data-flow/2-auth.md` 의 `INVALID_PASSWORD` audit 값** —
  두 문서의 `INVALID_PASSWORD` 언급은 모두 **로그인 실패**(`login_failed` 이벤트) 문맥이며
  `changePassword` wire 코드와 무관하다. target 이 이 두 문서를 변경 범위에 넣지 않은 것은 정확한
  범위 판단이다(레이어가 다르다는 target 자신의 논거와도 일치).
- **`spec/2-navigation/9-user-profile.md` Rationale "편집 인터랙션 분리"** — 전용 sub-route 패턴
  자체에는 target 이 손대지 않으며, 안내 문구 추가(변경안 #12)는 그 패턴의 틀 안에서의 본문 보강일
  뿐 Rationale 이 규정한 "고위험 항목은 sub-route" 원칙과 충돌하지 않는다.
- **범위 한정(`USER_NOT_FOUND` 404 미변경)** — 이 저장소 Rationale 전반에 반복되는 "정렬 대상만
  좁혀 별도 breaking 을 만들지 않는다" 관행(예: §4.1.B "범위 한정", 1.1.B-4 "본 작업에서는 손대지
  않았고" 등)과 결을 같이한다.

## 요약

target 문서는 `error-codes.md §3/§5`, `1-auth.md`(본문 note 4곳 + Rationale 2.3.C), `3-error-handling.md`
(§1.2·§1.2.1·근접명명 주석)에 걸쳐 있는 모든 과거 결정·Rationale 참조 지점을 정확한 라인 단위로
찾아 변경안 표에 반영했고, 기각된 대안(`PASSWORD_NOT_SET` 신설)을 되살리지 않았으며, 결정을
번복하는 지점(§3→§5 이관, `INVALID_PASSWORD` 은퇴)마다 새 Rationale 문구(#8, #11, #11b)를 함께
작성하도록 계획했다. 특히 이 draft 자체가 선행 `--spec` 라운드에서 나온 CRITICAL(폐기된 B안이
표에 남아있던 문제)을 이미 해소한 이력이 있고, 남아 있는 각주까지 스스로 추적하고 있어 Rationale
연속성 관점에서는 이례적으로 정합적이다. 유일한 언급 사항은 §5 머리말 caveat 삽입 위치에 대한
경미한 대안 제안(INFO)뿐이며 실질적 위험은 낮다.

## 위험도

NONE
