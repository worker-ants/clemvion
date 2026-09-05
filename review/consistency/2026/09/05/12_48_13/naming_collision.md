# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-prep)

## 검토 범위와 방법

프롬프트 번들은 컨텍스트 예산 초과로 `spec/5-system/` 15개 중 3개(`1-auth.md` ·
`2-api-convention.md` · `3-error-handling.md`)만 전문이 실렸고, 나머지 및 검색 코퍼스
(다른 `spec/` 영역, `plan/in-progress/**`, `spec/conventions/**`)는 대부분 생략 고지였다.
번들의 "여기 없다는 사실을 없음의 근거로 삼지 말라" 지시에 따라 실제 저장소 파일
(`spec/5-system/1-auth.md`, `2-api-convention.md`, `3-error-handling.md`, `1-data-model.md`)을
직접 `Read`/`grep` 하고, 이 스코프에 대한 **가장 최근 두 커밋의 diff**(`cce8a188b`, `7979d7daf`)로
"target 이 실제로 새로 도입한 식별자가 무엇인가"를 실측했다.

## 실측 — 최근 변경분이 도입한 것은 신규 식별자가 아니라 기존 식별자의 재분류/명시화

- `cce8a188b`: `1-data-model.md` `Schedule.next_run_at` 타입 표기 정정(`Timestamp`→`Timestamp?`),
  `2-api-convention.md` §2.2 에 **이미 존재하던** `/api/auth/*` 20~22개 엔드포인트를 위한 예외
  문구 추가("인증 상태 전이·capability 액션"), §5.4 범위 한정 문구 추가. 새 엔드포인트·새
  DTO·새 코드는 0건 — 전부 이미 구현된 표면의 **명명 근거 성문화**다.
- `7979d7daf`: §2.2 에 "자원 액션" 예외 행 추가(`run-now`/`transfer-ownership`/`set-default` 등
  **이미 쓰이던** 케밥 동사구를 규칙으로 명문화), §5.4 적용범위 각주, §12.1 과의 경계 각주,
  `3-error-handling.md` §1.4 표에 "앵커" 열 추가(코드 자체는 전부 기존 10종, 새 코드 0건).

이 두 커밋 어느 쪽도 새 요구사항 ID·새 엔티티/DTO·새 endpoint·새 이벤트명·새 env var·새 파일
경로를 만들지 않았다 — 기존 표면의 소속·근거를 사후에 문서화한 것이다. 따라서 "신규 식별자
충돌"의 좁은 정의(§요구사항 ID/§엔티티명/§endpoint/§이벤트명/§env var/§파일경로) 관점에서는
검토 대상이 되는 신규 항목이 사실상 없다.

## 정적 스캔 — 3개 전문 파일 내 식별자 자기충돌 여부

`1-auth.md`(§1~§5, Rationale), `2-api-convention.md`, `3-error-handling.md`(§1.1~§1.9)의
에러 코드·엔드포인트·env var 목록을 상호 대조했다. 결과:

- **에러 코드**: `RATE_LIMITED`(REST 기본/§1.1) vs WS `RATE_LIMITED`(§1.5) vs EIA 기본
  `RATE_LIMITED`(§1.6) — 동일 문자열이 3개 표면에 나타나지만 문서가 **매번 "표면·전송이
  다른 별개 발행"** 이라고 명시적으로 각주를 달아 구분한다. `INVALID_EXECUTION_STATE`
  (WS) / `INVALID_STATE`(REST core, 422) / `STATE_MISMATCH`(EIA REST, 409) 도 동일 패턴 —
  같은 의미의 서로 다른 wire 이름을 의도적으로 분리했다고 명시. `PASSWORD_INVALID` /
  `PASSWORD_REQUIRED` / `TOTP_INVALID` / `REAUTH_REQUIRED` / `REAUTH_NOT_AVAILABLE` 는
  §1.2.1 한 표에 공용 카탈로그로 정리되어 있고 1-auth.md §2.3/§5 의 서술과 코드·HTTP status
  가 1:1 로 일치한다. 은퇴 코드 `INVALID_PASSWORD` 는 wire 에서 제거되고 `login_history.
  failure_reason` 감사값으로만 남는다는 것도 양쪽 문서(§1.2.1, 1-auth.md §2.3)가 동일하게
  기술한다 — 불일치 없음.
- **엔드포인트**: `1-auth.md` §5 표(28개 auth 엔드포인트)를 `2-api-convention.md` §2.2 의
  예외 목록·`3-error-handling.md` §1.2~§1.9 인용과 대조했다. 세션/프로필·초대·AuthConfig 관련
  "인접 엔드포인트"는 전부 포인터로만 언급되고 본문 정의는 각 SoT 문서(`2-navigation/
  9-user-profile.md`, `2-navigation/6-config.md`)로 위임되어 있어 중복 정의가 없다(1-auth.md
  Overview 의 "중복 정의 금지" 원칙이 실제로 지켜짐).
- **env var**: `WEBAUTHN_RP_ID`/`WEBAUTHN_RP_NAME`/`WEBAUTHN_ORIGIN`/`WEBAUTHN_ALLOW_FALLBACK`
  (§1.4.3), `TRUST_CF_CONNECTING_IP`/`COOKIE_SAMESITE`(§2.3), `JWT_SECRET`/`ENCRYPTION_KEY`
  (Rationale). 저장소 전체에서 별도 의미로 재정의된 동명 env var 는 발견되지 않았다.

## 발견사항

- **[INFO]** `PATCH /notifications/:id/read` — 두 명명 패턴의 경계에 걸친 기존 엔드포인트
  - target 신규 식별자: 없음 (기존 엔드포인트를 `2-api-convention.md` §2.2 신규 각주가
    처음으로 명시 지목)
  - 기존 사용처: `spec/5-system/2-api-convention.md` §12.1(Boolean 토글 패턴, `is_read` 를
    `PATCH /:id { field: value }` 로 규정) vs 같은 문서 §2.2 신규 "자원 액션" 행(`/:id/{action}`
    형 동사 경로)
  - 상세: 문서가 스스로 "§12.1 이 `is_read` 를 토글 필드로 명시하는데 구현은 전용 액션
    경로다"라고 인지하고 있으며, 판정을 보류한 채 "새 행의 경계 문장이 이 자리를 정당화하지
    않는다"고 명시했다. 신규 식별자 충돌은 아니지만, **향후 `is_read` 류 필드에 새 전용
    액션 엔드포인트를 추가하는 plan 이 나오면** 이 미해결 경계가 재발 지점이 된다.
  - 제안: 결정 자체(경로 변경 여부)는 이번 스코프의 판단 대상이 아니므로 별도 처리 불요.
    다만 이후 유사 신규 엔드포인트를 설계하는 plan 은 이 각주를 인용해 §12.1 vs §2.2 중
    어느 쪽을 따르는지 명시하도록 권고.

- **[INFO]** 초대(invitation) 에러 코드의 `lower_snake_case` 예외는 신규가 아니라 기존 등재
  - target 신규 식별자: 없음
  - 기존 사용처: `1-auth.md` §1.5.4 (`invitation_not_found`, `forbidden`, `rate_limited` 등)
    vs 저장소 전역 `UPPER_SNAKE_CASE` 규약(`conventions/error-codes.md` §1)
  - 상세: `forbidden`/`rate_limited` 는 다른 도메인의 `FORBIDDEN`/`RATE_LIMITED`(UPPER) 와
    표기만 다른 동의어라 언뜻 충돌로 보이지만, 문서가 `error-codes.md §3` historical-artifact
    레지스트리에 "초대 API 한정" 예외로 이미 등재해 뒀고 1-auth.md 자체에 그 근거·범위가
    명시되어 있다 — **신규 충돌 아님**, 기존 문서화된 의도적 예외.
  - 제안: 조치 불요. 신규 코드 작성 시 이 lowercase 표기를 선례로 삼지 말라는 문구가 이미
    있으므로 그대로 유지.

## 요약

이번 스코프(`spec/5-system/`)에서 가장 최근 두 커밋의 실제 diff 를 추적한 결과, 새로 도입된
요구사항 ID·엔티티/DTO·API endpoint·이벤트명·env var·파일 경로는 없었다 — 변경분은 전부 기존
표면의 소속·근거를 사후 문서화한 것이었다. `1-auth.md`/`2-api-convention.md`/
`3-error-handling.md` 세 문서를 상호 대조한 결과 표면상 동일해 보이는 에러 코드
(`RATE_LIMITED`, `INVALID_STATE`/`INVALID_EXECUTION_STATE`/`STATE_MISMATCH` 등)는 전부 문서
자체가 명시적으로 "표면이 다른 별개 발행"이라고 각주를 달아 구분해 두고 있어 실질적인 의미
충돌은 없다. 발견한 두 건은 모두 이미 문서가 인지·등재한 기존 경계/예외이며 신규 식별자 충돌이
아니라 INFO 수준의 주의 환기다.

## 위험도

NONE
