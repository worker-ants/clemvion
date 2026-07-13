# 테스트(Testing) 리뷰

대상: F-2 (plan `eia-command-waiting-surface-guard`) — `surfaceMismatch` 안내 메시지 도입
(`language-hint-defaults.{ts,spec.ts}`, `hooks.service.{ts,spec.ts}`, telegram 문서 2종, chat-channel spec)

## 발견사항

- **[WARNING]** `sendSurfaceMismatchNotice` 의 발송 실패(swallow) 경로가 테스트되지 않음
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:1019` (`sendSurfaceMismatchNotice`), 테스트는 `codebase/backend/src/modules/hooks/hooks.service.spec.ts:884`
  - 상세: `sendSurfaceMismatchNotice` 의 JSDoc 은 "발송 실패는 swallow (안내 자체가 재시도 루프를 유발하면 안 됨)" 을 명시적 설계 불변식으로 서술하고, 구현도 `try { adapter.sendMessage(...) } catch (err) { this.logger.warn(...) }` 로 이를 구현한다. 그런데 신규 테스트(`표면 불일치(STATE_MISMATCH) 시 surfaceMismatch 안내를 채널로 발송`)는 `adapter.sendMessage` 가 **성공**하는 happy-path 만 검증하고, 실패 시에도 `handleWebhook` 이 throw 하지 않고 정상 반환되는지는 검증하지 않는다.
    같은 파일에는 구조적으로 동일한 "best-effort 안내, 실패 swallow" 패턴을 가진 형제 메서드 `sendExecutionStillRunningNotice` 에 대해 정확히 이 실패 경로를 검증하는 선례 테스트가 이미 존재한다 (`hooks.service.spec.ts:1198` `sendExecutionStillRunningNotice — sendMessage 실패해도 throw 없이 ignored 반환`, `mockAdapter.sendMessage.mockRejectedValueOnce(...)` 후 `handleWebhook` 이 resolve 됨을 단언). `surfaceMismatch` 안내는 이 선례와 나란히 두면 비대칭적으로 커버리지가 빠져 있다.
  - 제안: `mockAdapter.sendMessage.mockRejectedValueOnce(new Error('network'))` 를 추가한 별도 테스트(또는 기존 신규 테스트에 케이스 추가)로 "sendMessage 실패해도 `forwardToInteractionService`/`handleWebhook` 이 throw 하지 않고 정상 202 로 끝난다" + `logger.warn` 호출을 검증할 것. `sendExecutionStillRunningNotice` 테스트를 템플릿으로 재사용 가능.

- **[INFO]** 신규 테스트와 인접한 기존 테스트 간 setup 중복
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:884-921` (신규 `표면 불일치(STATE_MISMATCH) 시 surfaceMismatch 안내를 채널로 발송`) vs 같은 파일의 기존 `표면 불일치(409 STATE_MISMATCH) forwarding 은 warn 후 삼킴` 테스트 (동일 diff 컨텍스트에 인접)
  - 상세: 두 테스트가 `triggerRepo`/`parseUpdate`/`conversationService.lookup`/`execRepo.findOne`/`interactionService.interact.mockRejectedValueOnce(ConflictException STATE_MISMATCH)` 셋업을 거의 동일하게(idempotencyKey 값만 다름) 반복한다. 기능적으로는 "같은 트리거 조건에서 서로 다른 side-effect(warn 로그 vs sendMessage 호출)를 검증"하는 것이므로 독립 테스트로 남겨도 무방하지만, 이후 셋업이 바뀔 때 두 곳을 동시에 갱신해야 하는 drift 위험이 있다.
  - 제안: 두 단언(`warnSpy` 호출 + `mockAdapter.sendMessage` 호출)을 한 테스트로 합치거나, 공통 셋업을 로컬 헬퍼 함수로 추출해 중복을 줄이는 것을 고려.

- **[INFO]** `resolveSurfaceMismatchMessage` 에 "unknown locale 방어" 테스트 부재 (기존 패턴과의 일관성 갭)
  - 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.spec.ts:52-81` (`resolveSurfaceMismatchMessage` describe 블록)
  - 상세: `resolveLanguageHint` 는 `'(3) ko fallback when locale is unknown value (defensive)'` 테스트로 `languageLocale` 이 `'ko'|'en'` 이 아닌 임의 값(`'fr'`)일 때도 ko 로 안전하게 fallback 함을 명시적으로 검증한다. 반면 `resolveSurfaceMismatchMessage`(및 이미 존재하는 `resolveSessionExpiredMessage`/`resolveFormOpenLabel`)에는 이 defensive 케이스가 없다. `hooks.service.ts` 에서 `config.languageLocale as LanguageLocale | undefined` 로 강제 캐스팅해 호출하므로(런타임에 DTO validator 를 우회한 이상값이 들어올 여지가 이론상 있음), 구현이 `=== 'en'` 비교 후 그 외 전부 ko 폴백이라는 안전한 구조이긴 하나 테스트로 명시하면 회귀 방지에 도움된다.
  - 제안: 필수는 아니나(기존 `sessionExpired`/`formOpenLabel` 도 동일 갭이라 이번 diff 만의 신규 결함은 아님), 3종 모두에 `'unknown locale → ko fallback'` 케이스를 일괄 추가하면 `resolveLanguageHint` 수준의 방어 테스트 커버리지로 통일된다.

## 요약

핵심 신규 로직인 `resolveSurfaceMismatchMessage` (3-level lookup: override → locale default → ko fallback)는 `language-hint-defaults.spec.ts` 에서 default/override/빈 문자열/locale 미설정 케이스를 빠짐없이 커버하고, 특히 telegram MarkdownV2 특수문자 미포함을 정규식으로 검증하는 테스트는 "control-plane raw 발송이라 escape 를 거치지 않는다"는 실제 운영 실패 시나리오(telegram 400 거부)를 코드 레벨 불변식으로 고정한 좋은 회귀 가드다. `hooks.service.ts` 의 `sendSurfaceMismatchNotice` 도입과 `forwardToInteractionService` 시그니처 확장(`config`, `adapter` 추가)에 대해 신규 통합 테스트가 happy-path(안내 발송 + 정확한 body/conversationKey)를 검증하고, 기존 "STATE_MISMATCH warn 후 삼킴" 회귀 테스트도 시그니처 변경에 영향받지 않고 그대로 유효하다. 다만 이 메서드의 핵심 안전 속성인 "발송 실패는 swallow 하여 재시도 루프를 만들지 않는다"는 같은 파일의 형제 메서드(`sendExecutionStillRunningNotice`)에는 명시적으로 테스트되어 있는데 `sendSurfaceMismatchNotice` 에는 대응 테스트가 빠져 있어, 가장 실질적인 커버리지 갭으로 판단된다. 나머지는 기존 코드베이스 관례와 일관된 경미한 갭(unknown locale 방어 테스트 부재, 인접 테스트 셋업 중복)이라 이번 변경만의 새로운 결함은 아니다. mock 구성·테스트 격리·가독성은 기존 파일의 확립된 패턴을 잘 따르고 있다.

## 위험도
LOW
