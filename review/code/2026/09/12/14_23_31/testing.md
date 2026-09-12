# 테스트(Testing) 리뷰 — setupChannel 실패 분류 (재검토, 이전 라운드 fix 검증)

이번 라운드는 직전 리뷰(`review/code/2026/09/12/13_41_55/testing.md`)의 WARNING 2건에 대한
`resolution-applier` 조치(`8847b6736`, `eda10e051`) 를 포함한 diff다. 조치가 실제로 적용됐는지
소스를 직접 열어 확인했고, 그 외 신규로 도입된 테스트 경로도 함께 점검했다.

## 발견사항

- **[INFO]** (검증 완료, 재조치 불요) 직전 라운드 WARNING #1 — `Logger.prototype.warn` spy 누출 위험 — 해소 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `it('그 밖의 실패 → 502 + provider 원문은 응답이 아니라 warn 로그에만', ...)` (`spyOn` ~ `finally { warn.mockRestore(); }`)
  - 상세: 직전 라운드가 지적한 "인라인 `mockRestore()` 하나에만 의존해 앞선 `expect` 실패 시 spy 가 파일 전체로 누출된다"는 문제가 `try { ... } finally { warn.mockRestore(); }` 구조로 정정됐다. 소스를 직접 열어 `try`/`finally` 블록이 실제로 감싸고 있음을 확인했다 — `discord-client.spec.ts` 의 `global.fetch` 복원 패턴과 동일한 형태로 통일됐다.
  - 제안: 없음 (positive 확인).

- **[INFO]** (검증 완료, 재조치 불요) 직전 라운드 WARNING #2 — `GlobalExceptionFilter` 의 5xx `HttpException` 통과 회귀 테스트 부재 — 해소 확인
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` — `it('passes through a 502 BadGatewayException without masking (chat-channel setupChannel §5.4)', ...)`
  - 상세: 신설된 테스트는 기존 `mockHost`/`bodyOf` 헬퍼(409/401/413 케이스에서 이미 쓰이던 것)를 재사용해 `new BadGatewayException({code:'CHAT_CHANNEL_SETUP_FAILED', ...})` 를 필터에 통과시키고 `status===502`, `body.error.code==='CHAT_CHANNEL_SETUP_FAILED'` 를 단언한다. 필터 구현(`http-exception.filter.ts`)을 직접 열어 `instanceof HttpException` 분기가 `exception.getStatus()` 를 그대로 forward 함을 확인했고(다른 분기 `mapHttpErrorLike` 가 5xx-ish 를 500 으로 마스킹하는 것과 달리 이 분기엔 마스킹이 없음), 새 테스트가 헬퍼를 그대로 재사용해 vacuous 하지 않다. 지적됐던 회귀 캐너리 부재가 정확히 메워졌다.
  - 제안: 없음 (positive 확인).

- **[INFO]** (검증 완료) 직전 라운드 INFO — `triggers.service.spec.ts` 의 타입 캐스팅 불일치도 함께 정정됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 502 테스트 — `(caught as BadGatewayException).getStatus()`
  - 상세: 직전 라운드는 "`caught` 가 실제로는 `BadGatewayException` 인스턴스인데 `BadRequestException` 으로 캐스팅해 읽는 사람을 혼동시킨다"고 지적했다. 이번 소스는 `BadGatewayException` 으로 정확히 캐스팅되어 있다(400 케이스는 여전히 `BadRequestException` 으로 올바르게 캐스팅) — 필수 조치 대상은 아니었지만 함께 고쳐졌다.

- **[INFO]** 미해소 — Slack fixture 문구가 여전히 `describe` 블록의 provider(telegram)와 불일치
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `it('setupChannel 이 자격 증명 거부(code) 로 실패 → 400 BOT_TOKEN_INVALID', ...)` 안의 `credentialRejectedError('Slack auth.test failed: invalid_auth')`
  - 상세: 직전 라운드 INFO 로 지적된 이 항목은 이번 라운드에도 그대로 남아 있다(`RESOLUTION.md` 가 INFO 는 자동 조치 대상이 아니라고 명시한 대로 미조치). adapter 자체를 mock 하므로 테스트 정확성에는 영향 없으나, 이 테스트 블록의 fixture(`beforeEach`)가 구성하는 trigger 의 provider 는 `'telegram'` 인데 주입 메시지는 `'Slack ...'` 이라 "이 테스트가 telegram 경로를 검증한다"는 오독 여지가 여전히 남는다.
  - 제안: 급하지 않음 — 다음에 이 근처를 손댈 때 `'Telegram setWebhook failed: ...'` 류로 정정하거나 provider 무관성을 주석으로 명시.

- **[INFO]** 미해소 — telegram `error_code 400 / 부재` 테스트가 여전히 `for` 루프로 두 fixture 를 한 `it` 에 묶어 둠
  - 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.spec.ts` — `it('error_code 400 / 부재 → code 미부착 (호출자가 502)', ...)`
  - 상세: 바로 위 `it.each([401, 403])` 케이스는 개별 테스트로 분리돼 있는데, 이 테스트만 `for (const res of [...])` 로 두 입력을 순회해 실패 시 어느 fixture 가 깨졌는지 테스트 이름만으로 구분이 안 된다. 직전 라운드 INFO 그대로 남아 있음(자동 조치 대상 아님).
  - 제안: `it.each` 로 승격해 두 케이스를 독립 테스트로 분리하면 실패 원인이 즉시 드러난다.

- **[INFO]** 컨트롤러→필터 전 구간을 잇는 e2e/통합 테스트는 없음 — 단위+필터 테스트 조합으로 커버
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken` (신규 `@ApiBadGatewayResponse`)
  - 상세: 실제 HTTP 요청이 컨트롤러→서비스→어댑터→필터를 거쳐 502 를 반환하는지 확인하는 e2e 스펙은 이 diff 에 없다(`find codebase/backend -iname '*.e2e-spec.ts' | xargs grep -l rotate-bot-token` 결과 0건). 다만 이번 라운드가 메운 `triggers.service.spec.ts`(서비스가 `BadGatewayException` 을 던지는지) + `http-exception.filter.spec.ts`(필터가 그 예외를 마스킹 없이 통과시키는지) 두 테스트를 합치면 두 경계 모두 개별적으로 실측되므로, e2e 부재로 인한 실질 커버리지 공백은 낮다.
  - 제안: 선택 사항 — 여유가 있으면 `rotate-bot-token` e2e 스펙에 502 케이스 1건을 추가해 전 구간을 한 번에 고정할 수 있으나, 지금 당장 필요한 항목은 아니다.

- **[INFO]** Discord `getApplicationMe` 가 순수 5xx(예: 500, 재시도 소진)로 실패하는 경로는 전용 테스트가 없음
  - 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord-client.ts` — `res.status >= 400 && res.status < 500` 분기 밖(5xx는 `lastError` 로 쌓여 재시도 소진 후 reject)
  - 상세: 신규 `discord-client.spec.ts` 는 401/404/403(JSON 파싱 실패) 세 가지 4xx 케이스만 다룬다. 5xx 경로는 `getApplicationMe` 가 reject 하는 일반 `Error` 로 흘러 `translateSetupChannelError` 의 default 502 분기로 떨어지는데, 이는 `chat-channel-input-rules.spec.ts` 의 provider-무관 "네트워크 실패는 502" 테스트가 이미 그 최종 분기를 커버하므로 기능적 공백은 아니다. Discord 고유의 5xx→retry-exhausted→reject 흐름 자체를 겨냥한 테스트는 없다는 점만 기록.
  - 제안: 급하지 않음. 이 파일이 뮤테이션으로 이미 실증한 목적(`status` 배선 회귀 방지)에는 영향 없음.

## 강점 (이번 라운드 재확인)

- 직전 라운드가 WARNING 으로 지적한 두 항목이 정확히 그 지적 형태 그대로(try/finally, 실제 필터 통과 테스트) 고쳐졌다 — 임시방편이 아니라 저장소 기존 관례(`discord-client.spec.ts` 의 `global.fetch` 복원, 409/401/413 필터 테스트 패턴)를 그대로 재사용했다.
- `chat-channel-input-rules.spec.ts` 의 캐너리 뒤집기(discord verify_key → 502 를 400 으로 교체)와 `code` 화이트리스트 정확 일치 테스트(DNS `ENOTFOUND` 오분류 방지)는 여전히 뮤테이션 관점에서 견고하며, 이번 라운드의 사소한 리팩터(`DISCORD_CREDENTIAL_REJECTED_STATUSES` 상수 추출, `a07c91b64`)에도 어떤 단언도 바뀌지 않고 그대로 GREEN 임을 소스 대조로 확인했다.
- 이번 라운드가 추가한 신규 assert 는 모두 프로덕션 헬퍼(`credentialRejectedError`)를 직접 import 해 사용하며 손으로 재현한 fixture 가 없다 — mock 과 실제 동작의 괴리가 낮다.

## 요약

이번 라운드는 새 기능보다 **직전 리뷰 WARNING 2건의 정확한 해소**가 핵심이다 — 소스를 직접 열어
`Logger.prototype.warn` spy 의 `try/finally` 복원과 `http-exception.filter.spec.ts` 의 502
패스스루 회귀 테스트가 지적된 형태 그대로 반영됐음을 확인했고, 곁들여 타입 캐스팅 INFO 도 함께
정리됐다. CRITICAL/WARNING 급 신규 결함은 발견되지 않았다. 남은 항목은 전부 INFO 수준 —
provider 문구 불일치·telegram for-loop 테스트 미분리(둘 다 직전 라운드부터 자동 조치 대상
제외로 남아있음), 컨트롤러→필터 전 구간 e2e 부재(단위+필터 테스트 조합으로 실질 커버), Discord
5xx 재시도-소진 경로 전용 테스트 부재(provider-무관 generic 502 테스트가 최종 분기를 이미 커버)
정도이며 모두 병합을 막을 사유가 아니다.

## 위험도

LOW
