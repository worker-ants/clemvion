# Rationale 연속성 검토 — spec/5-system/14-external-interaction-api.md

## 조사 방법

- `git diff HEAD -- spec/5-system/14-external-interaction-api.md spec/7-channel-web-chat/3-auth-session.md plan/in-progress/spec-sync-external-interaction-api-gaps.md` 로 target 변경분을 정확히 격리.
- `git log -S"TOKEN_REFRESH_FORBIDDEN"` (spec 파일 / 코드 파일 양쪽), `git show HEAD:...`(변경 전 §5.5 원문), `git log -1 907616c61`(R14 도입 커밋) 으로 §R14 도입 당시 실제로 무엇을 기각했는지 추적.
- `interaction.service.ts` (`refreshToken`), `interaction.guard.ts` (`deny()`), `interaction-token.service.ts` (`IEXT_PREFIX`/`ITK_PREFIX`) 를 코드 SoT 로 직접 확인.
- `spec/data-flow/15-external-interaction.md` (본 세션에서 미수정) 와 대조.

## 발견사항

- **[WARNING]** §R14 본문이 §5.1/§5.5 의 `403 TOKEN_REFRESH_FORBIDDEN` 신설을 스스로 설명하지 않음 — 인라인 캐비엇만 존재, 캐노니컬 Rationale 미갱신
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.1 에러 표(`403 TOKEN_REFRESH_FORBIDDEN` 행) + "토큰 실패 status 통일 근거" 콜아웃(§5.1 하단) — 두 곳 모두 인라인으로 "§R14 대상 아님" 이라 주석
  - 과거 결정 출처: 같은 문서 `## Rationale` → `### R14. 토큰 실패 status 통일 — 모두 401 (403 미사용)` (커밋 `907616c61`, #604)
  - 상세: R14 는 제목·서두에서 "모두 401 (403 미사용)" 이라고 단정하지만, 본 diff 이후 같은 문서 안에 실제로 `403 TOKEN_REFRESH_FORBIDDEN` 이 존재한다. 본문 §5.1 에는 이를 "R14 통일 대상이 아니다" 라는 타당한 근거(검증 통과 후 표면 오용, family 는 이미 호출자가 앎)가 인라인으로 붙었지만, **그 예외를 R14 항목 자체에는 추가하지 않았다.** CLAUDE.md 의 저장 원칙("결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`")과 이 문서 자체의 기존 관례(R16 이 "2026-08-10 정정" 식 날짜 부기 addendum 을 Rationale 항목 안에 직접 남긴 선례) 에 비춰보면, R14 를 단독으로 읽는 미래의 독자·자동화(예: 다음 Rationale 연속성 체크)가 "403 이 §5.1/§5.5 에 있다 = R14 위반" 으로 오판할 위험이 남는다.
  - 제안: R14 항목 끝에 R16 스타일의 짧은 addendum 을 추가 — 예: "**범위 명확화(2026-08-11)**: 본 결정은 `InteractionGuard.deny()` 가 판정하는 5종 토큰 **검증** 실패(§5.1 401 행)에 한정된다. §5.5 `refresh-token` 의 `403 TOKEN_REFRESH_FORBIDDEN` 은 Guard 통과 후 서비스 계층에서 판정하는 **표면 오용**(itk_* 로 갱신 시도)이며, family 는 토큰 문자열 접두사(`iext_`/`itk_`) 로 호출자가 이미 아는 값이라 노출 이득이 없어 본 결정의 적용 대상이 아니다." 필요하면 제목의 "(403 미사용)" 괄호도 "(검증 실패는 403 미사용)" 등으로 좁혀 재기술을 고려.

## 확인했으나 문제 없다고 판단한 항목 (근거 명시)

1. **§R14 가 기각한 대안의 재도입 여부 — 아니다.** R14 가 명시적으로 기각한 대안은 "**scope/audience 불일치**를 403 으로 세분" 뿐이다 (`TOKEN_SCOPE_MISMATCH`/`TOKEN_AUDIENCE_MISMATCH`). target diff 는 이 두 코드를 전혀 건드리지 않았고 여전히 401 이다. R14 의 근거 메커니즘도 "`interaction.guard.ts` `deny()` = `UnauthorizedException`" 로 명시적으로 Guard 한정이며, 실제로 `deny()` 소스를 확인한 결과 지금도 `UnauthorizedException` 만 던진다(403 분기 없음) — R14 가 보호하는 invariant 는 그대로 유지된다. `TOKEN_REFRESH_FORBIDDEN` 은 Guard 를 통과한 **뒤** `interaction.service.ts` 의 `refreshToken()` 이 던지는 별개의 `ForbiddenException` 이며, `git log -S"TOKEN_REFRESH_FORBIDDEN" -- codebase/.../interaction.service.ts` 로 확인하면 **원 구현 커밋(`35ff9c19b`, #230, PR2)부터 지금까지 코드에 존재**했다 — R14(#604, 2026-06-14)가 도입되던 시점에도 이미 있었다. 즉 이번 target 은 "새로 403 을 도입" 한 게 아니라, 오래전부터 있던 구현 사실을 문서에 처음 반영한 것이다.
2. **정당한 구분인가, 사후 재해석인가 — 정당한 구분으로 판단.** `interaction-token.service.ts` 의 `IEXT_PREFIX='iext_'` / `ITK_PREFIX='itk_'` 를 확인한 결과, 토큰 family 는 **토큰 문자열 자체의 리터럴 접두사**로 호출자가 이미 보유·인지하는 값이다. 반면 R14 가 401 로 묶은 scope/audience mismatch 는 "이 토큰이 다른 execution 의 것인가" 라는, 호출자가 스스로는 확정할 수 없는 관계형 정보다. 두 경우의 정보 노출 성격이 실제로 다르므로, target 의 "검증 실패 vs 표면 오용" 구분은 근거 없는 사후 합리화가 아니라 코드로 뒷받침되는 구분이다.
3. **§R14 갱신 필요성 — 필요(위 WARNING 항목).**
4. **다른 Rationale(§R4 웹채팅 등)과의 모순 — 없음.** `spec/7-channel-web-chat/3-auth-session.md §R4`("재차 실패는 `401`/`410` 만 뜻한다")는 이번 diff 에서 "EIA §5.5 가 아직 410 을 안 담는다" 캐비엇만 제거되고 핵심 논리는 무변경이다. 웹채팅 위젯은 `§R3`("per_execution 단일, per_trigger 미지원")에 따라 `itk_*` 토큰을 애초에 보유하지 않으므로 신설된 `403 TOKEN_REFRESH_FORBIDDEN` 경로에 도달할 수 없다 — R4 의 "401/410 아니면 종료 아님" 판정 로직도 이미 그 외 상태 코드(400 계열 포함)를 "종료 아님" 버킷으로 자연스럽게 흡수하므로 파손되지 않는다. 또한 `spec/data-flow/15-external-interaction.md §1.2`(이번 세션 미수정, R14 와 **같은 커밋 `907616c61`** 에서 도입)가 "`itk_*` 는 403" 을 **처음부터** 정확히 서술해왔다는 사실도 확인했다 — 즉 R14 저자 자신이 이 예외를 인지한 상태로 R14 범위를 Guard 한정으로 좁혀 적었을 가능성이 높고, 이번 target 은 그 갭(§5.5·§5.1 표 vs data-flow 문서 간 drift)을 해소하는 spec-sync 다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에도 동일한 발견("표 아래 note 가 403 TOKEN_REFRESH_FORBIDDEN 과 정면 반례" → "검증 실패로 범위를 좁히고 예외를 적었다")이 이미 self-report 되어 있어, target 작성자도 이 긴장을 인지하고 조치했음을 확인했다.

## 요약

target 의 `403 TOKEN_REFRESH_FORBIDDEN` 신설은 §R14 가 명시적으로 기각한 대안("scope/audience 불일치를 403 으로 세분")을 되살리는 것이 **아니다** — R14 가 보호하는 Guard-레벨 invariant(`deny()`=401 전용)는 코드·문서 양쪽에서 그대로 유지되며, 신설된 403 은 R14 도입 당시부터 코드와 sibling data-flow 문서에 이미 존재하던 별개의 서비스-레벨 분기를 처음으로 §5.1/§5.5 본문에 반영한 spec-sync 다. "토큰 family 는 호출자가 이미 아는 값" 이라는 노출-이득 없음 근거도 코드(`iext_`/`itk_` 리터럴 접두사)로 뒷받침된다. 다만 이 스코프 좁히기가 R14 항목 **자체**에는 반영되지 않고 표/콜아웃에만 인라인으로 남아 있어, R14 를 단독으로 읽으면 "모두 401(403 미사용)" 이라는 문구가 문서 자신의 다른 부분과 충돌하는 것처럼 보일 수 있다 — Rationale 캐노니컬 위치 원칙에 따라 R14 에 범위 명확화 addendum 을 추가할 것을 권고한다.

## 위험도
LOW

BLOCK: NO
STATUS: OK
