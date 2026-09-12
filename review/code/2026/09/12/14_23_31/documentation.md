# 문서화(Documentation) 리뷰 — impl-setup-error-code (라운드 2)

## 발견사항

- **[WARNING]** `CHANGELOG.md` 의 "이 저장소의 첫 사용" 실측 문구 중 하나가 틀렸다 — `HttpStatus.BAD_GATEWAY` 는 여전히 0건이다
  - 위치: `CHANGELOG.md` 게이트 8~9줄 (`**502 는 이 저장소의 첫 사용**이다(`BadGatewayException`·`HttpStatus.BAD_GATEWAY`· `@ApiBadGatewayResponse` 각 0건 → 각 1건).`)
  - 상세: 실제로 `grep -rn "HttpStatus.BAD_GATEWAY" codebase/backend` 는 0건이다(`BAD_GATEWAY` 라는 문자열 자체가 코드베이스 어디에도 없음, 직접 확인). `BadGatewayException`(생성자 호출 1곳, `chat-channel-input-rules.ts:332`)과 `@ApiBadGatewayResponse`(데코레이터 1곳, `triggers.controller.ts:271`)는 "0건→1건" 주장이 맞지만, `HttpStatus.BAD_GATEWAY` 는 애초에 코드가 `BadGatewayException` 클래스를 쓰지 이 enum 리터럴을 직접 참조하지 않으므로 "0건→0건"이 맞다. `plan/in-progress/spec-draft-nullable-notation-followups.md`(게이트 2911~2918, "`getCodeFromStatus` 에 502 케이스가 없다")도 "지금 `BAD_GATEWAY` 를 발명하면 spec drift" 라고 스스로 적어 이 식별자가 코드에 없다는 사실과 일관된다 — 즉 CHANGELOG 자신의 다른 항목과도 모순된다. 이 저장소는 "실측했다"는 문구가 반복해서 프록시·시점 오차로 틀린 전례가 있는 만큼, 세 식별자를 한 문장으로 묶어 "각 0건→1건"이라 단언한 것이 과잉 일반화다.
  - 제안: `HttpStatus.BAD_GATEWAY` 를 문장에서 빼거나(`BadGatewayException`·`@ApiBadGatewayResponse` 두 식별자만 "0건→1건"으로 남기고), 정확히 표현하려면 "런타임 status 값으로는 502 가 처음 나가지만 `HttpStatus.BAD_GATEWAY` enum 리터럴은 직접 참조되지 않는다"고 구분해서 적는다.

- **[WARNING]** 같은 커밋이 "고쳤다"고 선언한 자리를 "아직 안 고쳐졌다"고 서술하는 새 트래커 항목을 동시에 등재했다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:2926-2931` (`- [ ] **CCA frontmatter 의 *"§1.1.2 계약은 미구현"* 주석이 stale 이다**`), 대응 커밋 `3c47885a3`
  - 상세: `git blame` 결과 이 항목(2926~2931줄)은 커밋 `3c47885a3`("docs(spec): 구현이 반증한 '미구현' 서술을 정정한다")가 **직접 추가**했다. 그런데 바로 그 커밋이 같은 turn 에서 `spec/conventions/chat-channel-adapter.md` frontmatter 의 "§1.1.2 의 `code` 선언 계약은 **미구현**이다" 문구를 "**구현됐다** (2026-09-12 — telegram·slack·discord 3종 전부)"로 이미 정정했다(diff 로 직접 확인, `spec/conventions/chat-channel-adapter.md` 파일 59 게이트 6~13). 즉 트래커 항목 본문은 "spec/conventions/chat-channel-adapter.md 가 여전히 '미구현'이라 적고 있으니 planner 턴이 필요하다"고 현재형("라고 적는데")으로 서술하는데, 그 문장을 쓴 바로 그 커밋이 이미 그 문구를 고쳤다 — 항목이 등재되는 시점에 이미 반증된 상태로 태어났다. `- [ ]` 미체크 상태로 남아 있어 다음 세션이 이 항목을 열어 보면 "frontmatter 를 고쳐야 한다"는, 이미 끝난 작업을 다시 하려 들 위험이 있다("있지도 않은 작업을 쫓는다"는 이 저장소의 반복 실패 패턴과 같은 모양).
  - 제안: 이 항목에 "frontmatter 문구 자체는 같은 커밋(`3c47885a3`)에서 이미 정정했다 — 남은 것은 `pending_plans` 나머지 3개 항목이 여전히 미구현 목록으로 맞는지 확인뿐" 이라는 후속 각주를 추가하거나, 주 서술을 좁혀 체크박스를 부분 완료로 표시한다.

## 검증한 항목 (문제 없음)

- `CHANGELOG.md` 의 breaking-change 영향 표·"⚠️ 배포 시 확인" 콜아웃·`details.reason` 제거 서술은 실제 diff(`chat-channel-input-rules.ts`)와 문구가 정확히 일치.
- `spec/conventions/chat-channel-adapter.md` frontmatter/§1.1.2 정정(파일 59)은 draft(`plan/complete/spec-update-chat-channel-adapter-status.md`)의 "반영 결과" 서술과 실제 diff 가 1:1 일치하고, "제거 조건은 충분조건이 아니다"라는 실측 기반 좁힘도 근거(Slack 비-JSON 4xx 합성 응답)가 구체적이다.
- `codebase/frontend/src/content/docs/06-integrations-and-config/{discord,slack}{,.en}.mdx` 4개 파일의 신규 에러 문구는 telegram 문서(§6/§117)의 기존 400/502 안내와 의미상 일관되며(문체만 약간 다름 — "credential rejection… → 400… ; anything else → 502" vs telegram 의 나열형 "Errors: 400…, 404…, 502… 등" — 사소한 스타일 차이, 결함 아님), `backend-labels.ts` 의 `ERROR_KO.BOT_TOKEN_INVALID` 갱신과도 방향이 일치.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `getCodeFromStatus` 502 미처리 관련 서술(게이트 2911~2918, "지금은 도달 불가")은 `http-exception.filter.ts` 의 `getCodeFromStatus` switch 문에 502 케이스가 실제로 없음을 직접 확인해 정확함.
- 도메인 로직 파일(`discord.adapter.ts`/`slack.adapter.ts`/`telegram.adapter.ts`/`chat-channel/types.ts`/`chat-channel-input-rules.ts`/`triggers.service.ts`)의 신규 JSDoc·인라인 주석은 이전 라운드(`review/code/2026/09/12/13_41_55/documentation.md`)가 이미 상세 검증했고 이번 라운드의 diff(discord `code` 상수 추출 리팩터 등)로 그 정확성이 훼손되지 않았음을 재확인.
- `plan/in-progress/impl-setup-error-code.md` 체크리스트는 실제 완료 상태(`--impl-done`·트래커 종결·`plan/complete/` 이동 3개 항목만 미체크)와 일치 — 거짓 체크 없음.

## 요약

핵심 코드 변경(3-provider `code` 선언, 502 도입, `details.reason` 제거)에 대한 JSDoc·인라인 주석·CHANGELOG·유저가이드·spec frontmatter 정정은 전반적으로 정밀하고 근거가 구체적이다. 다만 이번 라운드에서 두 가지 문서 정확성 결함을 새로 발견했다: (1) `CHANGELOG.md`가 "이 저장소의 첫 사용" 근거로 든 세 식별자 중 `HttpStatus.BAD_GATEWAY`는 실측(0건)과 다르게 "0건→1건"이라 과장돼 있고, (2) spec frontmatter의 낡은 "미구현" 문구를 정정한 바로 그 커밋이 같은 문제를 "아직 해결 안 됨"으로 서술하는 새 트래커 항목을 동시에 만들어, 다음 세션이 이미 끝난 작업을 다시 쫓을 위험을 남겼다. 둘 다 코드 동작에는 영향이 없는 문서 정확성 문제이며 병합을 막을 사유는 아니다.

## 위험도

LOW
