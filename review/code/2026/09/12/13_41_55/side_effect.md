# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING] 신규 테스트가 공유 `Logger.prototype.warn` 을 스파이하면서, 원복을 테스트 본문 마지막 줄의 수동 호출에만 의존 — 조기 실패 시 전역 상태가 누출된다**
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2028`(`jest.spyOn(Logger.prototype, 'warn')`) ~ `:2046`(`warn.mockRestore()`)
  - 상세: 새로 추가된 `'그 밖의 실패 → 502 + provider 원문은 응답이 아니라 warn 로그에만'` 테스트는 `Logger.prototype.warn` 을(인스턴스가 아니라 **클래스 프로토타입**을) `jest.fn()` 으로 교체한다. 복원은 테스트 본문 맨 끝의 `warn.mockRestore()` 한 줄뿐이고, `try/finally`도 `afterEach`도 감싸지 않는다. 이 테스트가 도중의 `expect(...)`(예: `getStatus()`가 502가 아니거나, `logged`에 `TRIGGER_ID`가 없는 경우)에서 throw 하면 `mockRestore()`는 실행되지 않고, `Logger.prototype.warn`은 이 spec **파일 전체의 나머지 실행 동안** `undefined`를 반환하는 mock 인 채로 남는다. 같은 파일 안에서 `triggers.service.ts`가 `this.logger.warn`을 호출하는 다른 지점들(`triggers.service.ts:828,1158,1237,1278` 등)을 거치는 후속 `describe` 블록(예: `Secret rotation`, `endpoint_path UNIQUE 충돌`, `감사 로깅` 등, 총 14개 describe가 이 파일에 있음)이 실제로는 warn 이 호출됐어야 할 자리에서 조용히 아무 로그도 없이 통과하거나, 진단 단서가 사라진 채로 실패해 원인 추적이 어려워진다.
    같은 저장소의 `codebase/backend/src/common/filters/http-exception.filter.spec.ts:40-42`가 정확히 이 실패 유형을 이미 문서화하고 방어하고 있다 — `afterEach(() => { jest.restoreAllMocks(); })` 옆에 "Logger spy 복원을 afterEach 로 통일(B-5) — **예외로 테스트가 중단돼도 spy 가 누설되지 않는다**" 라는 주석이 있다. 이번 PR의 새 테스트는 그 확립된 관례를 따르지 않는다. `triggers.service.spec.ts` 전체를 검색한 결과 이 파일에는 `afterEach`가 단 한 곳도 없고, `Logger.prototype` 스파이도 이 새 테스트가 유일하다(grep 확인) — 즉 기존 파일에 이미 있던 안전장치가 아니라 이번 변경이 새로 도입한 노출면이다.
  - 제안: `warn.mockRestore()`를 `finally` 블록으로 감싸거나, 이 `describe('TriggersService.rotateBotToken — 6단계 오케스트레이션', …)` 블록에 `afterEach(() => jest.restoreAllMocks())`를 추가해 `http-exception.filter.spec.ts`의 관례를 따른다.

## 확인 결과 문제 없음으로 판단한 항목 (참고용 기록)

- **[INFO] `rotateBotToken` 실패 응답의 HTTP status 축이 넓어짐 (400 단일 → 400/502 분기) — 의도된 계약 변경, 유일 호출자·필터·프론트 라벨 모두 갱신 확인**
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` `translateSetupChannelError` (반환 타입 `BadRequestException` → `BadRequestException | BadGatewayException`), 유일 호출자 `codebase/backend/src/modules/triggers/triggers.service.ts:1078`
  - 상세: 시그니처(반환 타입) 변경이지만 유일한 호출자가 즉시 `throw`하므로 내부적으로 안전. `codebase/backend/src/common/filters/http-exception.filter.ts`가 `HttpException` 서브클래스를 전부 제네릭하게 처리함을 확인했고(신규 `BadGatewayException` 전용 분기 불필요), frontend(`codebase/frontend/src/lib/api/triggers.ts`, `chat-channel-card.tsx`)에서 이 엔드포인트의 HTTP status 코드에 의존하는 분기 로직은 grep 결과 없음(에러 코드 문자열 기반 매핑만 사용). 응답 본문에서 제거된 `details.reason` 필드도 frontend 소비처가 없음을 확인. 다만 이 API를 호출하는 저장소 밖 외부 통합이 있다면(문서화된 소비자는 없음) "실패=항상 400" 가정이 깨지므로, 공개 API 계약 변경이라는 점은 기록해 둔다.
- **[INFO] `TriggersService.rotateBotToken` catch 블록에 새 `this.logger.warn(...)` 호출 추가 — provider 원문 에러 메시지가 서버 로그에 남는다. 시크릿(봇 토큰) 유출 경로는 확인되지 않음**
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1073-1077`
  - 상세: 세 provider adapter(`discord.adapter.ts`, `slack.adapter.ts`, `telegram.adapter.ts`)가 던지는 `Error.message`를 직접 인용해 logger.warn으로 남긴다. 각 adapter의 메시지 조립부(`Discord getApplicationMe failed: ${app.message}`, `Slack auth.test failed: ${reason}`, `Telegram ${method} failed: ${res.description}`)를 전부 확인한 결과 provider 응답 바디의 `message`/`error`/`description` 필드만 사용하고, bot token 값 자체(Authorization 헤더에만 실림)는 어디에도 문자열로 결합되지 않아 로그를 통한 토큰 유출 경로는 없음.
- **[INFO] `discord-client.spec.ts`의 `global.fetch` mock/restore — `try/finally`로 안전하게 원복되는 대조 사례**
  - 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord-client.spec.ts:16-26`
  - 상세: `global.fetch`를 교체하고 `finally`에서 원본으로 복원하므로 assertion 실패 시에도 다음 테스트로 mock 이 새지 않는다. 위 WARNING 항목의 `Logger.prototype` 스파이가 따라야 할 정확한 패턴이 바로 이 파일에 이미 존재한다.
- **[검증 완료, 무해] `SLACK_CREDENTIAL_REJECTED_ERRORS`(`slack.adapter.ts`) / `TELEGRAM_CREDENTIAL_REJECTED_STATUSES`(`telegram.adapter.ts`) 모듈 레벨 상수** — `ReadonlySet`/`readonly number[]`로 선언되어 런타임 변경(mutation) 지점 없음. 새 전역이지만 상태를 갖지 않는 순수 조회용 상수.
- **`chat-channel/types.ts`의 신규 export(`CREDENTIAL_REJECTED_CODE`, `CredentialRejectedError`, `credentialRejectedError`, `isCredentialRejectedError`)** — import 그래프 확인 결과 `chat-channel/types.ts`는 `shared/conversation-thread` 외 다른 모듈을 참조하지 않아 신규 `triggers/` → `chat-channel/types` import 로 인한 순환 의존 없음.

## 뮤테이션 검증 관련 메모

이번 라운드에서는 저장소 파일을 수정하는 뮤테이션 검증을 수행하지 않았다(정적 분석 + `grep`/`Read` 대조로 충분히 재현·확인됨). `git status --short` 로 저장소가 clean 상태임을 최종 확인했다.

## 요약

이번 변경(Chat Channel setupChannel 실패를 자격 증명 거부(400)/그 외(502)로 재분류)은 순수 함수(`translateSetupChannelError`)·프로퍼티 기반 판별자(`credentialRejectedError`)·provider별 화이트리스트 상수로 구성이 깔끔하고, 응답 계약 변경(400→502 분기, `details.reason` 제거)의 영향 범위(호출자·필터·프론트 라벨·시크릿 유출 가능성)를 모두 실측으로 확인한 결과 실질적 위험은 낮다. 유일한 실질적 부작용 우려는 `triggers.service.spec.ts`에 새로 추가된 테스트가 공유 `Logger.prototype.warn`을 스파이하면서 원복을 `try/finally`나 `afterEach` 없이 테스트 본문 마지막 줄의 수동 호출에만 맡긴 점이다 — 같은 저장소의 다른 spec 파일(`http-exception.filter.spec.ts`)이 정확히 이 실패 유형("예외로 테스트가 중단돼도 spy 가 누설되지 않는다")을 이미 `afterEach(jest.restoreAllMocks)`로 방어하고 있어, 이번 테스트는 그 확립된 관례에서 벗어난 새로운 노출면을 만든다.

## 위험도

LOW
