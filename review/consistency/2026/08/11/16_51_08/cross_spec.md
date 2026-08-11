# Cross-Spec 일관성 검토 — target: `spec/5-system/14-external-interaction-api.md`

## 검토 방법

target 은 `git diff HEAD~1 -- spec/5-system/14-external-interaction-api.md` 로 실제 diff 를 확인했다 (커밋
`77e0347d2` "트리거 시크릿/토큰 회전 3종을 감사에 기록" 의 **다음** 미커밋 변경, 즉 아직 커밋 안 된 워킹트리
diff). 변경 범위는:

1. §5.1 에러 코드 표(구 §3.3 표와 동일 표 — 실제로는 `### 5.1 인터랙션 명령 제출` 섹션 소속, L275~)에
   `TOKEN_REFRESH_NOT_IN_WINDOW`(400)·`TOKEN_REFRESH_FAILED`(400)·`TOKEN_REFRESH_FORBIDDEN`(403) 3행 추가,
   `EXECUTION_NOT_FOUND`(404)·`EXECUTION_TERMINATED`(410) 행에 §5.5 예외 캐비엇 추가.
2. §5.5 (`spec/5-system/14-external-interaction-api.md:508`) 응답 블록을 `401` 단일에서
   `400`×2 / `401` / `403` / `410` 5-branch 로 정정 + 3개 설명 콜아웃(순서·404 합류·구 토큰 무효 시점) 추가.
3. "토큰 실패 status 통일 근거" 콜아웃(L~348)을 "모든 토큰류 실패" → "모든 토큰 **검증** 실패"로 좁힘.

코드 변경은 실제로 0줄이었다 (`git diff HEAD~1 -- codebase/` 확인 — 빈 결과).

## 사실관계 검증 (orchestrator 요청 5항목)

코드를 직접 읽어 아래 5항목을 모두 실측했다. **전부 draft 서술과 일치**한다.

1. **분기 5종·순서** — `interaction.service.ts:216-261` `refreshToken()`:
   `ctx.tokenFamily !== 'iext'` → `ForbiddenException TOKEN_REFRESH_FORBIDDEN`(L222, 가장 먼저) →
   `tokenService.refreshPerExecution(bearerToken)` 호출 → 결과가 `valid:false` 면
   `BadRequestException TOKEN_REFRESH_NOT_IN_WINDOW`(L234) → `token` 키 부재(safety net) 면
   `BadRequestException TOKEN_REFRESH_FAILED`(L243) → 별도 `executionRepository.findOne` 재조회로
   `!execution || TERMINAL_STATUSES.has(status)` 면 `GoneException EXECUTION_TERMINATED`(L253) →
   그 외 `200 { token, expiresAt }`. draft 가 적은 "`TOKEN_REFRESH_FORBIDDEN` → `TOKEN_REFRESH_NOT_IN_WINDOW`
   → `EXECUTION_TERMINATED` 순"과 정확히 일치 (`TOKEN_REFRESH_FAILED` 는 safety-net 이라 draft 도 순서
   목록에서 별도 취급 — 표에서도 "safety net" 으로 명시돼 있어 모순 아님).
2. **`410` 이 미존재 execution 포함** — 코드가 정확히 `if (!execution || TERMINAL_STATUSES.has(execution.status))`
   (`interaction.service.ts:252`)이다. draft 서술과 리터럴 일치. 표의 `404 EXECUTION_NOT_FOUND` 행(L~341)과의
   모순 여부도 draft 가 두 자리(표 캐비엇 + §5.5 콜아웃) 모두에 "§5.5 는 예외" 를 명시해 처리했고, 실제로
   `interact`/`cancel`/`getStatus` 는 `loadAndAssertAlive()`(`interaction.service.ts:420-438`)를 통해
   미존재(404)·terminal(410) 을 **별도 분기**로 유지한다 — refresh-token 만 합류시키는 것이 코드 사실과 일치.
3. **`410` 시점에 구 토큰 이미 무효** — `interaction-token.service.ts:276-316` `refreshPerExecution()` 내부
   순서: `verifyPerExecution` → window 검사(`remainingSec > IEXT_REFRESH_WINDOW_SEC` 면 조기 return,
   blacklist 이전) → **통과하면** `revokePerExecution(decoded.jti, ...)`(구 jti blacklist, L305) +
   `executionTokenRepository.delete`(L308) → `issuePerExecution`(신규 발급, L315). 이 전체가
   `interaction.service.ts` 의 terminal 재조회(L248-252)보다 **먼저** 끝난다 — 즉 terminal 이면 신규 토큰은
   버려지지만 구 토큰은 이미 blacklist 된 뒤다. draft 의 "terminal 검사가 토큰 회전 뒤에 온다" 주장과 정확히
   일치.
4. **`data-flow/15-external-interaction.md` §1.2 (L120-122)와의 정합** — 기존 문서가 이미 "`iext_*` 만
   대상(`itk_*` 는 403)"·"30분 이내"·"구 jti 즉시 blacklist+DELETE 후 신규 jti"·"terminal execution 은 410"을
   적고 있었고, target 의 정정은 이 서술과 **완전히 부합**한다. 새 불일치를 만들지 않았다.
5. **§5.5 응답을 뜻으로 인용하는 다른 자리** — 아래 "발견사항" 참조. `spec/7-channel-web-chat/3-auth-session.md`
   (L82-89, `#### 3.1` 재로드 시퀀스 + `### R4`)는 이미 **2026-08-11 정정**이라는 동일 날짜 캐비엇과 함께
   `401`/`410`/`400`(간접) 분기를 정확히 반영하고 있어 target 과 정합. `0-architecture.md:78` 은 status 코드를
   재서술하지 않는 단순 참조 표라 영향 없음. **`spec/5-system/3-error-handling.md` §1.6 은 미동기화** — 아래
   참조.

## 발견사항

- **[WARNING]** `spec/5-system/3-error-handling.md §1.6` "EIA REST 외부 표면 에러 코드" 카탈로그가 이번
  정정으로 늘어난 3개 코드(`TOKEN_REFRESH_FORBIDDEN`/`TOKEN_REFRESH_NOT_IN_WINDOW`/`TOKEN_REFRESH_FAILED`)를
  반영하지 못했고, 같은 표의 "모든 토큰류 실패는 단일 401" 문구가 이제 부정확하다
  - target 위치: `spec/5-system/14-external-interaction-api.md:336-343` (§5.1 에러 표에 신규 3행 추가),
    `:508-533`(§5.5)
  - 충돌 대상: `spec/5-system/3-error-handling.md:157-171` (§1.6, `EIA §5.1 에러 표` 를 SoT 로 명시 인용하는
    "공용 카탈로그")
  - 상세: §1.6 은 스스로 "정의·status·트리거 조건의 SoT 는 EIA §5.1 에러 표" 라 선언하고 그 표를 그대로
    옮겨 등재한 카탈로그다(L159). target 의 diff 가 EIA §5.1 표에 3개 refresh 전용 코드를 새로 추가했지만
    §1.6 표(L163-169)에는 반영되지 않았다. 또한 L168 의 `TOKEN_REVOKED`/`TOKEN_SCOPE_MISMATCH`/
    `TOKEN_AUDIENCE_MISMATCH` 행 설명 "모든 토큰류 실패는 **단일 401**([EIA §R14] 인용)" 은, target 이 같은
    diff 에서 EIA 본문 콜아웃을 "모든 토큰 **검증** 실패는 401" 로 좁혔음에도(§5.1 L~348) 그 좁힌 표현을
    반영하지 못한 채 예전 blanket 문구를 그대로 유지한다 — `403 TOKEN_REFRESH_FORBIDDEN` 이 실존하는 지금
    "모든 토큰류 실패는 단일 401" 은 문자 그대로는 반례를 가진 문장이 됐다(target 자신도 이를 인지해
    §5.1 L343 에서 "§R14 의 '토큰류 실패는 401 로 통일' 대상이 아니다" 라고 명시적으로 예외 처리했다 —
    다만 그 예외 처리가 §1.6 미러에는 전파되지 않았다).
  - 제안: `3-error-handling.md §1.6` 표에 3개 refresh 전용 코드 행 추가 + "모든 토큰류 실패는 단일 401" →
    "모든 토큰 **검증** 실패는 단일 401(`403 TOKEN_REFRESH_FORBIDDEN` 은 검증 통과 후 표면 오용이라 예외)"
    로 동일하게 좁히거나, 최소한 각주로 예외를 명시. 우선순위 결정은 불요 — 단순 미러 동기화.

- **[INFO]** target 자신의 Rationale `### R14. 토큰 실패 status 통일 — 모두 `401` (`403` 미사용)` 제목·
  도입부가 같은 파일의 새 §5.1 표 행(`403 TOKEN_REFRESH_FORBIDDEN`)과 표면적으로 어긋난다
  - target 위치: `spec/5-system/14-external-interaction-api.md:1134-1140` (R14 제목·"채택" 문단)
  - 충돌 대상: 같은 문서 `:343`(§5.1 표의 `403 Forbidden | TOKEN_REFRESH_FORBIDDEN` 행) — self 문서
    내부지만, 위 WARNING 의 근본 원인(§1.6 카탈로그가 인용하는 SoT 텍스트 자체가 좁혀지지 않음)이라 함께
    적는다
  - 상세: R14 제목의 괄호 "(`403` 미사용)" 과 도입 문장 "EIA inbound 의 모든 토큰류 실패 ... 를 단일
    `401` 로 표기" 는 리터럴하게 읽으면 이제 거짓이다. §5.1 표의 새 행 자체는 "TOKEN_REFRESH_FORBIDDEN
    은 **토큰 검증 실패가 아니라 표면 오용**이라 R14 의 401-통일 대상이 아니다" 라고 스코프를 정확히
    구분해 자기모순을 회피했지만, R14 절 본문은 그 구분을 아직 반영하지 않은 예전 문구 그대로다. 실질
    엔지니어링 영향은 없다(§5.1 표·§5.5 가 실제 SoT 이고 이미 정확함) — 순수 rationale 문서의 표제/도입부
    갱신 누락.
  - 제안: R14 제목을 "토큰 **검증** 실패 status 통일 — 모두 `401`" 로, 도입 문장에 "TOKEN_REFRESH_FORBIDDEN
    (표면 오용, §5.1) 은 본 통일 대상이 아니다" 한 줄만 추가하면 §1.6 미러와도 함께 해소된다.

## 요약

target 의 §5.5/§3.3(§5.1) 정정은 코드(`interaction.service.ts`·`interaction-token.service.ts`·
`interaction.guard.ts`)를 직접 대조한 결과 **5개 확인 항목 전부 사실과 일치**했고, 이미 같은 사실을 적고
있던 `data-flow/15-external-interaction.md §1.2` 와도 새 불일치를 만들지 않았으며, `7-channel-web-chat/
3-auth-session.md` 의 캐비엇 제거도 그 문서 자체의 동일 날짜 정정(§3.1·R4)과 정합한다. 유일한 실질 갭은
`spec/5-system/3-error-handling.md §1.6` 의 "공용 에러 코드 카탈로그" 가 이번에 추가된 3개 코드와 좁혀진
"검증 실패" 문구를 미러링하지 못한 것 — 데이터 모델/API 계약 자체의 모순이 아니라 SoT→미러 동기화 누락이며,
target 문서 내 R14 rationale 절도 같은 이유로 표제만 stale 하다. 둘 다 클라이언트 동작이나 타 영역 구현에
영향을 주지 않는 문서 동기화 항목이라 WARNING/INFO 로 충분하다.

## 위험도
LOW

BLOCK: NO
STATUS: OK
