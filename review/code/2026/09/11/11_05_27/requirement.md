# 요구사항(Requirement) 리뷰 — impl-details-code-wiring

## 검증 방법

diff 8개 코드 파일(`password.util.ts`/`.spec.ts`, `chat-channel-rejection-messages.const.ts`,
`chat-channel-config.dto.ts`, `trigger-dto-validation.spec.ts`, `triggers.service.ts`/`.spec.ts`,
`chat-channel-trigger-create.e2e-spec.ts`)을 프롬프트 게이트 번호 기준으로 대조했고, 프롬프트에
전문이 잘린 파일 5·6·7·8은 `Read`로 직접 열어 확인했다. `grep -rn "field:"`로 `codebase/backend/src`
전체를 훑어 diff가 명시한 15자리(`triggers.service.ts` 13 + `password.util.ts` 2) 밖에 `details:
{ field, ... }` 형태인데 `code`가 빠진 에러 봉투 자리가 남아있는지 확인했다(`workspaces.service.ts`의
2곳은 `AuditLog.details`라 §5.3 규약의 명시적 비대상 — 정상). 관련 spec(`spec/5-system/
2-api-convention.md §5.3`, `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.2/R-CC-21)을 Read로
대조했다. `npx jest`로 `password.util.spec.ts`·`trigger-dto-validation.spec.ts`·
`triggers.service.spec.ts`를 직접 실행해 GREEN을 확인했다(88+123 tests, 1 skipped는 무관 기존
skip). 저장소에 뮤테이션을 가하지 않았다 — `git status --short`에는 이 리뷰가 만든 변경 없음
(사전 존재하던 `plan/in-progress/impl-details-code-wiring.md`의 미커밋 diff 1건은 오케스트레이터가
이 리뷰 라운드 결과를 보기 전에 추가한 "정지 규칙" 섹션으로, 리뷰 대상 코드가 아니라 관찰만 하고
손대지 않았다).

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` `spec/5-system/15-chat-channel.md` §5.4.1.2가 "`chatChannel`/
  `provider` 거부는 **현재** `details[].code`를 싣지 않는다 — 배선은 **뒤따르는 developer PR**이
  한다"고 서술하는데, 바로 그 PR(`triggers.service.ts:730`,`:741`에 `code: 'INVALID_FIELD'` 배선)이
  이번 diff에 포함돼 있다. 코드는 spec이 스스로 선언한 계약값(`INVALID_FIELD`)을 정확히 구현했으므로
  **코드는 옳다** — 문제는 spec 문단이 "이 PR이 머지되기 전까지"라는 시제로 쓰여 있어, 머지 후에도
  그대로 남으면 "아직 안 실린다"는 문장이 거짓이 된다.
  - 위치: `spec/5-system/15-chat-channel.md:411-416` (§5.4.1.2, "details[].code 는 현재 두 항목
    모두 서비스 가드 갈래라 싣지 않는다 … 그 PR 이 머지되기 전까지 이 문단은 …" 문단)
  - 상세: 같은 절 §5.4.1(표 위 문단, 라인 375)은 "위 `code` 없음은 **배선 전 관측값**이다 …
    배선 뒤에는 두 갈래 모두 `code`를 싣는다"처럼 시제-중립적으로 이미 정정돼 있어 이번 PR 착지와
    무관하게 참이지만, §5.4.1.2는 그 정정이 빠져 있다. 이 PR의 plan(`plan/in-progress/
    impl-details-code-wiring.md`)과 consistency-check INFO #3(`review/consistency/2026/09/11/
    10_28_52/SUMMARY.md`)는 `2-trigger-list.md`의 "미등재" 서술 최신성만 후속 각주로 잡아뒀고,
    `15-chat-channel.md §5.4.1.2` 자체의 시제 정정은 이 PR의 체크리스트 어디에도 명시돼 있지 않다
    (plan `spec_impact: none`).
  - 제안: 코드는 유지하고, `spec/5-system/15-chat-channel.md` §5.4.1.2의 해당 문단을 §5.4.1과
    동일한 패턴("배선 전 관측값" vs "배선 뒤 계약값")으로 정정한다(project-planner 턴). 이번 PR의
    developer 체크리스트에도 "§5.4.1.2 시제 정정" 항목을 추가해 다음 세션이 놓치지 않게 한다.

- **[INFO]** `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`의 `botToken`에
  신설된 `@MinLength(1)`(빈 문자열 거부)이 `SecretResolver.rotate` 자체의 빈 값 가드 부재라는
  선행 결함(주석·plan §C에 명시)을 닫지 않는다는 점이 코드 주석·plan·테스트 JSDoc에 이미 정확히
  기록돼 있다 — 신규 발견 아님, 추적 상태만 확인.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:187-192`
  - 상세: `@MinLength(1)`은 DTO 계층에서 빈 문자열을 조기 거부해 "빈 시크릿이 먼저 저장되는" 경로를
    차단하지만, `SecretResolver.rotate` 자체는 여전히 빈 값 가드가 없다(다른 호출 경로가 생기면
    재발 가능). Plan이 "별개 항목"으로 명시했으므로 이번 PR의 스코프 밖이 맞다.
  - 제안: 처분 없음(추적 확인용 기록).

## 관점별 확인 결과

1. **기능 완전성** — `details[].code` 배선 15자리(`triggers.service.ts` 13 + `password.util.ts` 2)
   전수를 grep으로 재현했고 diff와 정확히 일치. 완전하다.
2. **엣지 케이스** — `botToken: ''`(생성)·`null`/`''`(PATCH, 서비스 가드 flat 경로) 양쪽 다 새
   테스트로 커버(`[C]`, `[실측]`). `inboundSigningPlaintext` 5개 소스 자리 각각 캐너리로 개별
   커버(707/794/809/821/830).
3. **TODO/FIXME** — 신규 diff에 TODO/FIXME/HACK/XXX 없음(`git diff origin/main -- codebase/`
   grep 확인).
4. **의도와 구현 간 괴리** — 없음. `chat-channel-rejection-messages.const.ts`의 "왜 상수인가" 설명
   (등가성, DRY 아님)과 실제 사용처(DTO 3곳 + `ChatChannelUpdateConfigDto` 2곳 + service 5곳)가
   일치.
5. **에러 시나리오** — 각 거부 지점이 `BadRequestException({code, message, details})` 형태를
   일관되게 유지, top-level `code`(`VALIDATION_ERROR`/`AUTH_CONFIG_NOT_FOUND`)와 `details[].code`
   (`INVALID_FIELD`)를 겹쳐 쓰지 않는 §5.3 "둘을 겹쳐 쓰지 않는다" 규칙 준수.
6. **데이터 유효성** — `botToken` 선언(`minLength:1` in Swagger)과 검증 체인(`@MinLength(1)`)의
   불일치가 이번 PR로 해소됨 — 선언이 구현보다 넓던 기존 결함의 정정.
7. **비즈니스 로직** — R-CC-21의 5필드 거부 로직·PATCH vs POST 분기 로직에 동작 변경 없음(D는
   메시지 리터럴만 상수로 이동, 바이트 동일성을 등가성 테스트로 고정).
8. **반환값** — `validatePasswordStrength`는 void 함수로 모든 실패 경로에서 예외를 던지고 통과
   경로는 값 없이 반환 — 기존 계약 유지, 회귀 없음. 서비스 가드 함수들도 전부 예외 또는 무반환.
9. **spec fidelity** — `2-api-convention.md §5.3`(2026-09-11 규약화, `94e19be8d`)의 "field 있으면
   code 필수" 규칙과 code가 line-level로 일치. `15-chat-channel.md` R-CC-21·§5.4.1·§5.4.1.2와도
   필드 목록·메시지·차단 조건이 일치하나, §5.4.1.2의 시제 표현이 이번 PR 착지로 stale해짐(위
   SPEC-DRIFT 참조).

## 요약

`details[].code` 배선 15자리 전수, `botToken` `@MinLength(1)`, 거부 메시지 5쌍의 상수화가 diff·
grep 재현·테스트 실행(GREEN) 모두에서 계획서·spec(`2-api-convention.md §5.3`,
`15-chat-channel.md`)과 line-level로 일치했다. TODO/FIXME 없음, 반환값·에러 시나리오·엣지 케이스
처리 모두 정상이며 새 테스트가 각 변경 지점을 개별적으로 판별한다(`toEqual`로 payload 전체 고정,
`toMatchObject`의 재귀 부분일치 함정을 회피). 유일한 실질 발견은 `15-chat-channel.md §5.4.1.2`가
"이 PR이 머지되기 전까지"라는 시제로 §5.4.1.2의 `code` 미배선을 서술하는데, 정작 이 PR이 그 배선을
포함해 머지되면 해당 문단이 stale해진다는 SPEC-DRIFT(WARNING) — 코드는 spec이 선언한 계약값을
정확히 구현했으므로 코드를 되돌릴 사안이 아니라 spec 문단의 시제 정정이 필요하다.

## 위험도

LOW
