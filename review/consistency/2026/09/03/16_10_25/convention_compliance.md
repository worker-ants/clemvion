# 정식 규약 준수 검토 — `spec/5-system/`

## 범위·방법 메모

- 프롬프트 예산상 `spec/5-system/` 하위 20개 문서 중 **`1-auth.md`·`2-api-convention.md`** 만
  전문이 제공되었고, 나머지 16개(`3-error-handling.md`·`4-execution-engine.md`·
  `6-websocket-protocol.md` 등)는 절단됐다. 절단된 문서는 필요한 범위에서 워크트리 절대경로로
  직접 열어 교차검증했다(`3-error-handling.md §1.2.1`, `error-codes.md`, `swagger.md`,
  `audit-actions.md` 전문 확인).
- 이 branch 의 `spec/5-system/` 델타는 0개 파일이다(코드 전용 PR — nullable 엔티티 타입
  캐스트 정리). 따라서 본 검토는 "이 PR 이 spec 을 어겼는가" 가 아니라 **target 문서
  (`spec/5-system/1-auth.md`·`2-api-convention.md`) 가 현재 `spec/conventions/**` 를
  따르는가**의 standing 점검이다.
- 코드 diff(14파일/764줄)는 전부 `null as unknown as X` 이중 캐스트 제거 + 신규 repo-guard
  (`nullable-type-lie-cast-guard.ts`/`.spec.ts`)이며, API endpoint·DTO·감사 액션·에러 코드
  wire 표기를 건드리지 않는다. `codebase/backend/src/common/__test-utils__/source-scan.ts` 의
  신규 `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast` 는 기존
  `countRawUpdateReturning`/`hasRawUpdateReturning` 과 동일한 `count*`/`has*` 명명 쌍을
  따르고, 신규 guard 파일명(`<name>-guard.ts`/`<name>.spec.ts`)도 `repo-guards/__tests__/`
  의 기존 12개 guard 와 동일 패턴이다 — 이 부분은 위반 없음.

## 발견사항

- **[WARNING]** `/api/auth/*` 액션형 엔드포인트가 API URL 명명 규칙(§2.2)의 어느 패턴에도
  명시적으로 포섭되지 않는다
  - target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트` (예:
    `POST /api/auth/register`·`/login`·`/logout`·`/refresh`·`/verify-email`·
    `/resend-verification`·`/check-email`·`/forgot-password`·`/reset-password`·
    `/2fa/setup`·`/2fa/verify`·`/2fa/disable`·
    `/2fa/webauthn/register/options`·`/2fa/webauthn/authenticate/verify`·
    `/2fa/webauthn/recovery-codes/regenerate` 등 15개 이상)
  - 위반 규약: 같은 문서군의 `spec/5-system/2-api-convention.md §2.2 명명 규칙` —
    ① "리소스는 복수형 명사", ② "중첩은 2단계까지 / 3단계 이상은 최상위로 분리",
    ③ 명시된 예외는 "RPC-style sub-channel action"(`/api/{resource}/{id}/{channel}/{action}`
    — `{id}` 필수)와 "인증 family 전용 네임스페이스"(`/api/external/*`) **두 가지뿐**이다.
  - 상세: 위 `/api/auth/*` 엔드포인트들은 `{id}` 가 없는 액션-verb 경로(`login`·`register`·
    `refresh` 등)이거나, `{id}` 없이 4~5단계까지 중첩된다
    (`/api/auth/2fa/webauthn/register/options` = `auth/2fa/webauthn/register/options`
    5단계). §2.2 의 두 예외 항목 모두 조건(`{id}` 존재, 또는 `/api/external/*` 네임스페이스)을
    충족하지 못해, 문서 스스로 정한 규칙표만 보면 이 15개 엔드포인트가 규칙 위반처럼 보인다.
    이 문서는 다른 모든 예외(예: 트리거 시크릿 회전 3종, `workspace/:id/switch`)를 §2.2 에
    개별 열거할 만큼 촘촘한데, 정작 카탈로그상 가장 큰 엔드포인트 군(`/api/auth/*`)에는
    대응하는 예외 문구가 없다 — "action-namespace(비-리소스 컨트롤러)" 패턴 자체가
    §2.2 표에 빠져 있다. `/api/users/me/avatar` 같은 `/me/` 서브패턴도 동일하게 미포섭.
  - 제안: (a) §2.2 표에 세 번째 예외 행 추가 — 예: "인증/세션 액션 네임스페이스:
    `/api/auth/{verb}` 는 리소스가 아닌 인증 동작(controller-style RPC)이라 복수형 명사·
    `{id}` 전제 규칙 밖" — 이미 §2.2 에 있는 "RPC-style sub-channel action" 예외 서술 방식과
    동형으로 적으면 이 문서의 기존 패턴과 일관된다. (b) 또는 `/api/auth/2fa/webauthn/*` 처럼
    5단계까지 깊어지는 경로에 한해 "2단계 상한은 리소스 컬렉션에 적용되며 action-only
    네임스페이스는 제외" 라는 일반 원칙을 추가한다. 이 gap 은 이번 PR 이 만든 것이 아니라
    기존 상태이므로 CRITICAL 이 아니라 WARNING — 다만 이 문서가 예외를 "선언되지 않으면
    위반" 으로 취급하는 스타일이라(§2.2 자체가 그렇게 조밀하게 예외를 나열), 다음 리뷰에서
    같은 gap 이 다시 지적될 가능성이 높다.

- **[INFO]** 컨텍스트 예산으로 생략된 16개 `spec/5-system/*.md` 는 이번 검토에서 미검증
  - target 위치: `spec/5-system/3-error-handling.md`·`4-execution-engine.md`·
    `6-websocket-protocol.md`·`12-webhook.md`·`14-external-interaction-api.md` 등 16개
  - 위반 규약: 해당 없음(위반 보고 아님)
  - 상세: 프롬프트 예산 절단으로 본문이 전달되지 않아 본 checker 가 직접 워크트리에서
    필요한 부분만 발췌 확인했다(`3-error-handling.md §1.2.1`). 나머지 15개 문서의
    `spec/conventions/**` 준수 여부는 이번 회차에서 전수 검토되지 않았다 — "발견 없음" 을
    "위반 없음" 으로 오독하지 말 것.
  - 제안: 다음 standing 점검 시 이 16개 문서를 별도 배치로 나눠 전문 검토.

## 확인된 준수 사항 (참고 — 위반 아님)

- `spec/5-system/1-auth.md §4.1` 의 감사 액션 카탈로그(`user.*`·`auth_config.*`·
  `execution.re_run`·`workspace.transfer_ownership`·`trigger.*` 등)는
  `spec/conventions/audit-actions.md §3` 도메인별 분류 레지스트리와 **완전히 일치**한다
  (verb 시제 3분류·언더스코어 토큰 구분자·dot-prefix 모두 정합).
- `PASSWORD_REQUIRED`/`PASSWORD_INVALID`(§2.3 note·§5 note) ↔ `spec/conventions/error-codes.md
  §5` 은퇴 이력(`INVALID_PASSWORD` → 조건별 2종, 등급 B) ↔ `spec/5-system/3-error-handling.md
  §1.2.1` 카탈로그 3곳이 `UPPER_SNAKE_CASE`·HTTP status·발행 헬퍼까지 상호 정합적이다. 이번
  PR 이 정렬한 `change-password` 실패 코드(커밋 `af41a3c6e`)는 이미 세 SoT 문서 모두에 반영돼
  있다.
- `1-auth.md §1.5.4` 의 `lower_snake_case` 초대 에러 코드(`invitation_not_found` 등)는
  `error-codes.md §3` historical-artifact 레지스트리에 정식 등재돼 있어 §1 `UPPER_SNAKE_CASE`
  원칙 위반이 아니라 명시된 예외다.
- `2-api-convention.md` 의 `Overview`(프론트매터 하단 서술) → 본문(§1~§12) → `## Rationale`
  구조, `1-auth.md` 의 동일 3섹션 구조는 CLAUDE.md 의 "Overview / 본문 / Rationale" 3섹션
  권장과 프론트매터(`id`/`status`/`code`) 스키마를 모두 준수한다. `_product-overview.md`·
  `0-overview.md` 참조 경로도 명명 컨벤션(`_` prefix·`0-` prefix)과 일치.
- 이번 PR 의 코드 diff(엔티티 nullable 타입 정리)는 API 응답 포맷·DTO·swagger 데코레이터·
  감사 액션·에러 코드 wire 표기 어느 것도 건드리지 않아 `spec/conventions/swagger.md`·
  `error-codes.md`·`audit-actions.md` 의 출력 포맷 규약에 저촉될 표면이 없다.

## 요약

이번 PR 자체(nullable 엔티티 타입 캐스트 정리 + repo-guard 추가)는 API·DTO·이벤트·에러코드
wire 표면을 전혀 건드리지 않아 `spec/conventions/**` 관점에서 위반 표면이 없다. target 문서
`spec/5-system/1-auth.md`·`2-api-convention.md` 자체는 `audit-actions.md`·`error-codes.md`
와의 정합성이 매우 높고(특히 최근 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 정렬이 세 SoT에
모두 반영됨), 문서 구조·프론트매터·명명 컨벤션도 CLAUDE.md 규칙을 따른다. 유일한 실질
발견은 `2-api-convention.md §2.2` 의 URL 명명 규칙표가 `/api/auth/*` 액션형 엔드포인트
15개 이상을 포섭하는 예외 조항을 두지 않은 채로 두고 있다는 점으로, 신규 결함이 아니라
기존 문서 상태의 gap 이다. 컨텍스트 예산으로 spec/5-system 의 16개 문서는 이번 회차에서
전문 검토되지 못했다.

## 위험도

LOW
