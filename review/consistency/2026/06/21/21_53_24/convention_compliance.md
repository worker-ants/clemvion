# 정식 규약 준수 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`

실제 변경 범위: `spec/data-flow/2-auth.md` (이메일 변경 흐름 §1.7.1 추가 및 §2.1 스키마 표 갱신, §2.3 외부 의존 갱신)

`spec/5-system/1-auth.md` 는 main 과 동일(변경 없음) — 번들에 포함된 기존 내용 기준으로 검토.

---

## 발견사항

- **[INFO]** `spec/data-flow/2-auth.md` — 이메일 변경 throttle 이 §2.2 공식 표에 누락
  - target 위치: `spec/data-flow/2-auth.md` §2.2 Redis / throttle 표 (lines 292-297)
  - 위반 규약: 해당 표는 convention 규약 파일이 아닌 internal data-flow 표 일관성 사항이므로 공식 규약 위반은 아님. 단 §1.7.1 (line 237) 에서 `(request/resend 5 req/min)` 으로 throttle 을 언급하고 있으나, §2.2 throttle 요약 표에는 `email-change/request` · `email-change/resend` 행이 없다.
  - 상세: 동일 파일 §1.7 의 다른 흐름(`forgot-password`, `resend-verification`, `check-email`)은 §2.2 표에 대응 행이 있다. 이메일 변경 엔드포인트만 산문 언급으로 끝나 일관성이 낮다.
  - 제안: §2.2 표에 `email-change/request` · `email-change/resend` | IP 당 5 req/min | `users.controller.ts` 행을 추가. 규약 갱신은 불필요, target 표 보강만으로 해결.

---

### 긍정 확인 사항 (규약 준수)

**1. 감사 액션 명명 (`spec/conventions/audit-actions.md §1, §2, §3`)**

`user.email_changed` 는 `<resource>.<verb>` 구조 준수, `user` 도메인 과거분사 패턴(`§2.1`) 준수, `audit-actions.md §3` 레지스트리에 `구현` 상태로 등재되어 있다. `spec/5-system/1-auth.md §4.1` 카탈로그 및 §Rationale 1.1.B-6 이 이를 정확히 참조한다. 규약 위반 없음.

**2. 에러 코드 명명 (`spec/conventions/error-codes.md §1`)**

이메일 변경 흐름에서 신규 도입된 에러 코드는 모두 `UPPER_SNAKE_CASE` 준수: `REAUTH_NOT_AVAILABLE`, `VALIDATION_ERROR`, `RESOURCE_CONFLICT`. `invitation_*`/`forbidden`/`rate_limited` (§3 historical-artifact 레지스트리 예외)는 그대로 인용만 하며 신규 코드로 답습하지 않는다.

**3. 출력 포맷 규약 (`spec/conventions/node-output.md §3.2`)**

`spec/5-system/1-auth.md §1.1.B` 표의 verify 응답 `{ accessToken }` 은 논리 페이로드로 표기되고 "전역 `TransformInterceptor` 가 `{ data: ... }` 로 래핑" 참조가 `§1.4.3` 와 동일 패턴으로 기술되어 있다. API 규약 `spec/5-system/2-api-convention.md §5` 포인터를 유지한다.

**4. 문서 구조 규약 (CLAUDE.md 명명·3섹션 권장)**

`spec/5-system/1-auth.md` — frontmatter `id: auth`, `status: partial`, `code:` 배열, `pending_plans:` 배열 모두 `spec/conventions/spec-impl-evidence.md §2` 스키마 준수. Overview / 본문 / Rationale 3섹션 구조 준수.

`spec/data-flow/2-auth.md` — `spec/data-flow/` 경로는 `spec-impl-evidence.md §1` 적용 대상에서 제외(`spec/5-system/**` 등 inclusive list 에 없음)이므로 frontmatter 없는 것이 정상. Overview / 본문 / Rationale 3섹션 구조 유지.

**5. `user.email_changed` 도메인 레지스트리 동기 (`spec/conventions/audit-actions.md §3`)**

이메일 변경이 이번 구현으로 추가된 시점에 맞게 `audit-actions.md §3` 레지스트리의 `user` 행이 `email_changed` 를 포함하고 상태가 `구현` 으로 기록되어 있다. 레지스트리와 spec 카탈로그(`1-auth.md §4.1`) 간 일치 확인.

**6. 단일 진실 원칙 준수**

이메일 변경 엔드포인트(`/api/users/me/email-change/*`) SoT 는 `spec/2-navigation/9-user-profile.md §6.1` 으로 포인터 처리되고, 흐름·토큰·재인증·세션·감사 소유는 `1-auth.md §1.1.B` 로 명확히 분리되어 있다. 중복 정의 없음.

---

## 요약

검토 범위(`spec/5-system/`, `spec/data-flow/2-auth.md`)에서 정식 규약(`spec/conventions/**`)을 직접 위반하는 CRITICAL/WARNING 항목은 발견되지 않았다. 에러 코드 명명(`UPPER_SNAKE_CASE`), 감사 액션 구조(`<resource>.<verb>` + 과거분사), 레지스트리 동기, 문서 3섹션 구조, 단일 진실 분리, frontmatter 스키마 모두 정식 규약을 따른다. 유일한 발견은 `spec/data-flow/2-auth.md §2.2` throttle 표에 이메일 변경 엔드포인트 행이 산문 기술에서 승격되지 않은 INFO 수준 문서 불일관성이다 — 규약 파일 갱신 없이 target 표 보강으로 해결 가능하다.

## 위험도

NONE
