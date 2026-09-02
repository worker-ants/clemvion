# Rationale 연속성 검토 — `spec-draft-change-password-code-alignment.md`

## 발견사항

- **[WARNING]** "근접 명명" 카운트가 자기 인용한 "4중"과 어긋난다
  - target 위치: `plan/in-progress/spec-draft-change-password-code-alignment.md` 변경안 표 항목 #7
    ("〃 `:70` 근접 명명 주석 | **4중 → wire 2종 + 감사값 1종**")
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` `## Rationale`
    "§1 카탈로그 완결성 종결 — #882/#887 deferred 잔여 등재" 항목의
    "**4중** 근접명명(`INVALID_PASSWORD`≠`PASSWORD_INVALID`≠`PASSWORD_REQUIRED`≠`REAUTH_REQUIRED`)"
  - 상세: target 이 스스로 인용한 "4중" 은 `INVALID_PASSWORD` · `PASSWORD_INVALID` ·
    `PASSWORD_REQUIRED` · `REAUTH_REQUIRED` 네 개의 wire 코드다. 본 draft 의 결정 ①·②로
    `INVALID_PASSWORD` 만 wire 에서 은퇴(감사값으로만 잔존)하고, 나머지 세 개
    (`PASSWORD_INVALID`·`PASSWORD_REQUIRED`·`REAUTH_REQUIRED`)는 전부 wire 코드로 그대로 남는다
    — `REAUTH_REQUIRED` 는 이 draft 의 정렬 대상(`changePassword`)이 아니라 손대지 않으므로
    없어지지 않는다. 따라서 산수가 맞으려면 "wire **3**종 + 감사값 1종" (합 4, 원래 "4중"과
    정합)이어야 하는데, target 은 "wire **2**종" 이라 적어 `REAUTH_REQUIRED` 가 누락된 채로 하나가
    빈다. 이 프로젝트는 정확히 이런 근접-명명 표기의 수치 오류로 반복 학습했다 —
    `WORKER_HEARTBEAT_TIMEOUT` 항목(`error-codes.md §3`)이 "구체적 수치는 여기 적지 않는다 —
    라우트가 늘고 줄면 변하는 스냅샷이라 spec 에 박으면 조용히 stale 해진다" 고 명시적으로
    경고한 사례가 바로 이 문서 계보 안에 있다. 근접 명명 주의문 자체의 존재 이유가 "혼동 방지"인데,
    그 문구가 부정확하면 목적을 스스로 훼손한다.
  - 제안: 변경안 항목 #7 실행 시 "4중 → wire 3종(`PASSWORD_INVALID`·`PASSWORD_REQUIRED`·
    `REAUTH_REQUIRED`) + 감사값 1종(`INVALID_PASSWORD`)" 으로 정정하거나, 만약 `:70` 위치의
    지역적 "근접 명명 주의" 문단이 애초에 `REAUTH_REQUIRED` 를 포함하지 않는 3항목 클러스터를
    가리킨 것이었다면 시작 숫자를 "3중" 으로 낮춰 일관시킬 것 — 어느 쪽이든 실제로 다시 세어
    (`grep`) 산식이 맞물리는지 편집 직전에 확인.

## 검토 배경 — 확인한 연속성 (참고용, 문제 아님)

target 은 이례적으로 자기 자신의 선행 이력을 정밀 추적하고 있어 아래 항목들은 위반이 아니라
**연속성이 잘 지켜진 사례**로 확인됨:

- **결정 ①(형제 코드 재사용, 신규 코드 0)** 은 `spec/conventions/error-codes.md §2`("이름 정확성
  향상만을 위한 rename 은 하지 않는다")를 우회하지 않는다 — target 은 이를 "rename" 이 아니라
  §5 의 은퇴/대체 메커니즘으로 정확히 채널링했고, 그 메커니즘은 이미 `INVALID_INPUT` →
  `INVALID_TRIGGER_PARAMETERS`(`#1193`) 선례로 확립돼 있다.
- **등급 B 판정**은 `error-codes.md §5` 의 "A 는 영향 부재 확인, B 는 잔여 위험 인수" 정의를
  정확히 인용하고 "두 번째 B 사례" 라는 사실 자체를 §5 에 남기겠다고 명시한다 — §5 Rationale 의
  "B 는 예외로 세어야지 관행으로 굳혀선 안 된다" 경고를 그대로 이행하는 모범 사례.
  `plan/in-progress/spec-draft-api-convention-status-and-password-codes.md` 가 이미 한 차례
  같은 실수(`#1193`에서 "위험 부재" 선례를 "위험 인수" 로 잘못 읽음)를 자백하고 정정한 이력이
  있는데, 이번 target 은 그 정정된 기준을 올바르게 적용한다.
- **§5 머리말 전제("구 코드는 코드베이스에서 완전 제거") 충돌**을 target 스스로 감지해
  (`login_history.failure_reason='INVALID_PASSWORD'` 가 `auth.service.ts:347` 에서 실제로 계속
  발행됨을 실측 확인) §5 신규 행에 그 예외를 명시하겠다고 계획한다 — 이는 은폐가 아니라
  Rationale 을 능동적으로 갱신하는 올바른 처리다.
- **`1-auth.md` Rationale 2.3.C 의 스테일 라인** ("`passwordHash` 가 없으면 ... `INVALID_PASSWORD`
  로 차단되므로(현행)", 실제 파일 `:750`)을 target 의 변경안 항목 #3 이 정확히 그 줄 번호로
  짚어 `PASSWORD_REQUIRED` 로 갱신하겠다고 계획한다 — 결정 번복 시 과거 Rationale 라인을
  방치하지 않는 연속성 처리.
- **선행 draft**(`spec-draft-api-convention-status-and-password-codes.md`)가 "rename 하지 않는다"
  고 결론지었던 것은 영구 금지가 아니라 "B 등급 = 사용자 결정 필요" 라는 **조건부 유예**였고,
  후속 plan(`auth-change-password-oauth-only-code-split.md`)이 그 사용자 결정(2026-09-02)을
  실제로 받아 조건을 충족했다 — 기각된 대안의 무단 재도입이 아니라 유예 조건이 충족된 뒤의
  정상 집행이다.
- **결정 ③**(OAuth-only 사용자를 reset-password 경로로 안내)은 `1-auth.md §1.1.A` 의 기존 문서화된
  "opt-in 비밀번호 추가" 경로, 그리고 Rationale `1.1.B-5`(OAuth-only 는 재인증 수단이 없어 이메일
  변경이 막히고 비밀번호/TOTP 설정이 먼저 필요하다는 기존 원칙)와 상호 보강 관계이지 충돌이 아니다.

## 요약

target 은 `#1268`(→ `error-codes.md §3` 등재) → `spec-draft-api-convention-status-and-password-codes.md`(rename 유예 + 후속 plan 이관) → `auth-change-password-oauth-only-code-split.md`(사용자 결정 획득)로 이어지는 3단계 이력을 정확히 추적하며, 과거에 유예됐던 조건(B 등급 wire 변경엔 사용자 결정 필요)이 실제로 충족된 뒤에 집행하는 draft 다. §5 등급 체계·§3/§5 목적 레이어 분리·§2 rename 금지 원칙을 모두 올바르게 적용했고, §5 머리말 전제가 이 케이스에서 깨지는 지점까지 스스로 짚어 Rationale 갱신 계획에 반영했다. 유일하게 발견된 흠은 근접 명명 개수를 다시 세는 편집(항목 #7)에서 "4중"으로 인용한 출발점과 "wire 2종"이라는 결과가 산술적으로 맞지 않는다는 점으로, `REAUTH_REQUIRED`가 이 정렬 대상이 아니면서도 여전히 wire 코드로 남는다는 사실이 누락된 것으로 보인다. 전반적으로 Rationale 연속성 관점에서는 매우 견고한 draft다.

## 위험도

LOW
