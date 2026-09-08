# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-followups-batch-a.md`

## 검토 방법

target 이 새로 도입하는 식별자를 6개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·
환경변수/설정키·파일 경로)으로 추출하고, 프롬프트에 포함되지 않은 대상 spec 파일 9개
(`CLAUDE.md`, `.claude/skills/developer/SKILL.md`, `spec/2-navigation/2-trigger-list.md`,
`spec/5-system/15-chat-channel.md`, `spec/5-system/2-api-convention.md`,
`spec/5-system/3-error-handling.md`, `spec/conventions/swagger.md`,
`spec/conventions/secret-store.md`, `spec/1-data-model.md`)를 직접 `Read`/`grep` 하여
기존 사용처와 대조했다.

## 발견사항

이번 target 은 성격상 **신규 식별자를 거의 만들지 않는다** — 기존에 코드에는 이미 존재하지만
spec 문서에 아직 등재되지 않은 이름(§1.10 카탈로그 행, `code:` glob 2건)을 문서에 "등재"하거나,
기존 헤딩의 제목을 수정(취소선+정정)하는 작업이 대부분이다. 실측 결과 **CRITICAL/WARNING 급
충돌은 발견되지 않았다.**

### 확인한 항목과 실측 결과 (충돌 없음)

- **A-3(b) `3-error-handling.md` 신설 `### 1.10`** — 현재 파일의 `## 1. 에러 분류` 하위 절은
  `### 1.9 워크스페이스 멤버 직접 추가...`(220행)가 마지막이고 그다음은 `## 2. 에러 응답 형식`
  (234행)이다. `§1.10` 슬롯은 **비어 있다** — 충돌 없음.
- **A-3(b) `TRIGGER_ENDPOINT_PATH_CONFLICT`** — `grep -rn` 결과 이미
  `2-trigger-list.md:94,164`(spec)와 `triggers.controller.ts`/`triggers.service.ts`/
  `triggers.service.spec.ts`(구현)에서 **동일한 의미**(409 `RESOURCE_CONFLICT` 의
  `details.code`, `endpoint_path` UNIQUE 충돌)로만 쓰이고 있다. 새 카탈로그 등재는 기존 사용을
  그대로 옮겨 적는 것이라 의미 충돌 없음.
- **A-4(b) `code:` glob 신규 2줄** (`user-entity-exposure*.ts` · `user-secret-absence*.ts`) —
  `ls codebase/backend/src/repo-guards/__tests__/` · `shared/testing/` 로 대상 파일이 실재함을
  확인했고, `grep -rln "user-entity-exposure\|user-secret-absence" spec/` 결과 **0건** — 현재
  어떤 spec 의 `code:` 에도 등재돼 있지 않다(그래서 spec-linked 판정에서 빠졌다는 target 의
  전제와 일치). 다른 spec 의 `repo-guards/__tests__/**`·`shared/testing/**` 광역 glob 과도
  겹치지 않는다(유일한 인접 사례는 `review-citations.md` 의 `dto-jsdoc-citation*.ts` — 다른
  파일명, 충돌 아님).
- **A-4(a) "두 검증자" → "검증자들"** — `2-api-convention.md:227`·`swagger.md:371` 실측 문구가
  target 인용과 정확히 일치하고, 현재 §5.4 검증 층 표는 정확히 2행이라 target 의 4행 확장이
  기존 표와 모순되지 않는다.
- **A-2-1 앵커 rename (`R-2` → `...v1--v11--폐기`)** — `grep -rn "r-2-webhook-hmac-secret" spec/`
  결과 인입 링크는 `15-chat-channel.md:610` **1건뿐**이며 target 이 그 1건을 동시 갱신하는 것으로
  적혀 있어 누락이 없다. GitHub 슬러그 규칙(구두점 삭제·공백→하이픈, 연속 하이픈 유지)으로
  직접 재계산한 결과 target 이 적은 새 앵커
  `r-2-webhook-hmac-secret-입력-vs-rotate-분리-v1--v11--폐기` 는 정확했다.
- **A-1 `.claude/**` 신규 두 행** — `CLAUDE.md:60-67`·`developer/SKILL.md` 「경로별 권한」 표
  실측 결과 현재 **`.claude/**` 행이 정말 없다**(target 의 전제와 일치). 새로 추가하는 두 행
  (`harness 실행물` / `거버넌스 문서`)은 기존 축(`spec/**`·`plan/**`·`codebase/**`·`review/**`)
  어느 것과도 겹치지 않는 새 축이라 충돌 없음.
- **A-5 `1-data-model.md §2.1 User` 규범 블록** — 대상 절(54~85행)에 현재 그런 블록이 없고,
  나열된 7개 camelCase 필드명(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·
  `webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)은
  `shared/testing/user-secret-absence.ts` 의 `USER_SECRET_KEYS` 배열과 **정확히 일치**한다
  (문서가 코드보다 넓게/좁게 주장하지 않음). `§2.21.1 SecretStore`(별도 엔티티, 774행)와 이름이
  인접하지만 지칭 대상이 다르고 target 은 이를 참조하지 않는다 — 혼동 소지는 낮다.
- **A-5(c) `secret-store.md §1.1` 상호 참조** — 대상 절(86~104행)이 현재 다루는 필드는
  `AuthConfig.config`·`Trigger.config.interaction.triggerToken`·
  `Trigger.notification_secret_v2`·`Trigger.chat_channel_token_v2` 등 **Trigger/AuthConfig
  계열뿐**이고 `User` 컬럼은 언급하지 않는다 — target 이 그 문서의 관할을 넓히지 않고 한 줄
  상호 참조만 추가한다는 설명과 실측이 일치, 의미 충돌 없음.

### 참고 (충돌은 아니나 기록)

- **로컬 Rationale ID 네임스페이스 차이** — `2-trigger-list.md` 는 `R-N`(plain), 인접 문서
  `15-chat-channel.md` 는 `R-CC-N`(prefix) 을 쓴다. 두 접두사는 서로 다른 파일에 스코프된
  로컬 ID 라 충돌은 아니며, `15-chat-channel.md` 자신이 「Rationale ID 컨벤션」 절(600행 부근)에
  이 분기 이유를 이미 설명해 두었다 — target 이 새로 만든 혼선이 아니다.
- **§1.10 섹션 번호의 문서 간 재사용** — `data-flow/12-workspace.md` 에도 로컬 `§1.10`(자가
  탈퇴)이 있으나 완전히 다른 파일의 로컬 절 번호이며, 두 문서를 함께 참조하는 교차 인용도 없어
  실질적 혼동 위험은 없다.

## 요약

target 이 새로 부여하는 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수/설정키·파일 경로는
사실상 없으며, 대부분은 **이미 코드/구현에 존재하는 이름을 spec 문서에 등재하거나 기존 헤딩
제목을 정정**하는 작업이다. 9개 대상 spec 파일을 직접 읽고 핵심 신규 식별자(§1.10 카탈로그,
`TRIGGER_ENDPOINT_PATH_CONFLICT`, 신규 `code:` glob 2건, `.claude/**` 신규 권한 행, `User` 7컬럼
규범 블록, R-2 앵커 rename)를 각각 기존 사용처와 대조한 결과 의미가 다른 기존 사용과 부딪히는
사례는 발견되지 않았다. CRITICAL/WARNING 없음.

## 위험도

NONE
