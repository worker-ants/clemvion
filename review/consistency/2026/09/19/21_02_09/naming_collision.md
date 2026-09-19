# 신규 식별자 충돌 검토 — `spec/4-nodes/4-integration/`

## 검토 배경

`git diff origin/main -- spec/4-nodes/4-integration/` 결과 델타 0 — target 문서 4개(`0-common.md`,
`1-http-request.md`, `2-database-query.md`, `3-send-email.md`)는 이미 병합된 main 과 동일하다.
연계된 `plan/in-progress/ssrf-guard-integration-unify.md` 는 `spec_impact: none` 을 명시하고,
"코드를 spec 에 맞춘다 — spec 변경 없음" 이라고 작업 범위를 스스로 한정한다. 즉 이번 작업은
**신규 spec 식별자를 전혀 도입하지 않고**, 기존에 이미 정의된 식별자(`ALLOW_PRIVATE_HOST_TARGETS`,
`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`, `http-safety.ts`/`smtp-host-guard.ts` 파일 경로)를
재사용해 구현 3곳(HTTP Request·Database Query·Send Email)의 SSRF 가드 로직만 통일하는 리팩터다.
따라서 "새 식별자 충돌" 관점에서 볼 신규 표면 자체가 거의 없다.

## 확인한 식별자 재사용 정합성 (충돌 없음 확인)

- **`ALLOW_PRIVATE_HOST_TARGETS`** — `1-http-request.md`(§4 step 8, §4 callout), `2-database-query.md`(§4 SSRF 가드,
  §6.2), `3-send-email.md`(§4 step 7, §8.0), `spec/2-navigation/4-integration.md`(§1228 부근),
  `spec/5-system/3-error-handling.md`, 코드(`http-safety.ts:92`, `smtp-host-guard.ts:17`,
  `main.ts:141-160`, `production-guards.ts`)에서 **동일 의미(SSRF 사설망 차단 opt-out, 기본 ON)**로
  일관 사용된다. 플랜이 SMTP 가드를 이 플래그로 통합해도 의미 충돌 없음.
- **`HTTP_BLOCKED` / `DB_HOST_BLOCKED` / `EMAIL_HOST_BLOCKED`** — `spec/4-nodes/4-integration/*.md`
  3개 문서, `spec/2-navigation/4-integration.md` §1105-1232, `spec/5-system/3-error-handling.md`,
  `spec/conventions/chat-channel-adapter.md`, `spec/conventions/node-output.md` 전부에서 노드별
  prefix(`HTTP_`/`DB_`/`EMAIL_`) 로 명확히 구분되어 사용되며, 이번 통합 작업이 이 세 코드명을
  바꾸지 않으므로 (`error-codes.ts` 주석은 "이미 참" 이 되는 방향으로만 정정) 충돌 없음.
- **파일 경로** — `codebase/backend/src/nodes/integration/http-request/http-safety.ts`,
  `codebase/backend/src/common/utils/smtp-host-guard.ts`, 각각의 `.spec.ts` 는 모두 기존 파일이며
  plan 은 신규 파일 생성을 언급하지 않는다 (기존 `smtp-host-guard.ts` 내부 구현을 `ssrf.util` 참조 →
  `http-safety` 참조로 교체). 신규 spec 문서 경로도 없음(`spec_impact: none`).

## 발견사항

- **[INFO]** `SMTP_BLOCK_PRIVATE_HOSTS` 는 target 문서가 도입한 식별자가 아니며, 이번 plan 이 오히려
  제거 대상으로 지목한 기존 phantom 식별자
  - target 신규 식별자: 없음 (target 문서 `spec/4-nodes/4-integration/*.md` 어디에도
    `SMTP_BLOCK_PRIVATE_HOSTS` 문자열 없음)
  - 기존 사용처: `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts:176`,
    `codebase/backend/src/modules/integrations/integrations.service.ts:1594` (코드 주석에서
    "`SMTP_BLOCK_PRIVATE_HOSTS` 정책이 켜진 경우" 라고 마치 실재하는 opt-in 플래그처럼 서술) ·
    `spec/2-navigation/4-integration.md:1228` (괄호 안에서 "신설하는 대신" 이라며 기각된 대안 이름으로만 언급)
  - 상세: 저장소 전체에서 `SMTP_BLOCK_PRIVATE_HOSTS` 라는 실제 env var/코드 정의는 존재하지 않는다
    (`grep` 결과 코드 주석 2곳 + spec 각주 1곳뿐). 실제 동작은 `ALLOW_PRIVATE_HOST_TARGETS` opt-out 이며
    방향(opt-in vs opt-out)도 반대로 적혀 있다. `plan/in-progress/ssrf-guard-integration-unify.md` 항목 3
    ("주석 정정")이 정확히 이 두 코드 주석을 고치는 작업이므로, 이는 target 문서가 새로 만드는 충돌이
    아니라 **plan 이 스스로 해소하기로 한 기존 결함**이다.
  - 제안: naming-collision 관점에서 조치 불필요 — plan 항목 3 실행 시 이 두 주석에서
    `SMTP_BLOCK_PRIVATE_HOSTS` 문자열을 제거하고 `ALLOW_PRIVATE_HOST_TARGETS`(opt-out) 로 정정하면 된다.
    구현 시 이 phantom 이름을 실제 코드/설정 키로 "부활"시키지 않도록만 주의.

## 요약

Target 문서(`spec/4-nodes/4-integration/`)는 `origin/main` 대비 델타가 없고, 연계 plan 은
`spec_impact: none` 으로 신규 spec 식별자를 전혀 도입하지 않는다. 통합 대상 식별자
(`ALLOW_PRIVATE_HOST_TARGETS`, `HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`, 관련 코드
파일 경로)는 모두 기존 spec 전역에서 이미 동일 의미로 일관되게 정의돼 있어 재사용 시 충돌이 없다.
유일하게 눈에 띄는 이름 문제(`SMTP_BLOCK_PRIVATE_HOSTS` phantom 식별자)는 target 문서가 아니라
코드 주석과 별개 spec 파일(`2-navigation/4-integration.md`)에 있으며, 이번 plan 이 스스로 정정 대상으로
이미 지목한 기존 결함이라 새 충돌로 볼 수 없다. 신규 식별자 충돌 관점에서 이 작업은 안전하다.

## 위험도

NONE
