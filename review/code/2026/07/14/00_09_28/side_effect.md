# 부작용(Side Effect) 리뷰

대상: F-2 (plan `eia-command-waiting-surface-guard`) — chat-channel 표면 불일치(409 `STATE_MISMATCH`) 시
사용자에게 `languageHints.surfaceMismatch` best-effort 안내를 발송하는 기능 추가.
(`language-hint-defaults.ts`/`.spec.ts`, `hooks.service.ts`/`.spec.ts`, telegram 문서 2종, spec 1종)

## 발견사항

- **[INFO]** 로그 전용 경로에 신규 외부 네트워크 호출(`adapter.sendMessage`) 추가 — webhook 응답 critical path 상주
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `forwardToInteractionService` catch 블록 (신규 `await this.sendSurfaceMismatchNotice(update, config, adapter);`) 및 신규 `private async sendSurfaceMismatchNotice(...)`
  - 상세: 종전엔 `STATE_MISMATCH` 를 흡수할 때 `logger.warn` 만 호출하고 반환했으나, 이번 변경으로 provider(Telegram/Slack/Discord) Bot API 로 `sendMessage` 를 호출하는 네트워크 I/O 가 같은 동기 경로에 추가됐다. 호출 지점(`handleChatChannelWebhook`)은 `forwardToInteractionService` 완료 후 `adapter.ackInteraction` 을 호출하고 202 를 반환하므로, 이 신규 네트워크 호출은 fire-and-forget 이 아니라 webhook 응답을 지연시키는 동기 대기 경로다. 같은 파일 상단 주석은 "본 메서드는 200ms 안에 202 Accepted 응답해야 함 (WH-NF-01)" 이라 명시하는데, 신규 외부 API 호출(특히 provider 측 지연/rate-limit 상황)은 이 예산을 잠식할 수 있다.
  - 다만 이 패턴 자체는 신규가 아니다 — 같은 파일의 `maybeNotifyIgnored`/`sendExecutionStillRunningNotice`/`reNoiseFormModal` 이 이미 동일하게 reject/ignore 경로에서 동기적으로 `adapter.sendMessage` 를 호출하는 기존 관례이며, 실패는 모두 try/catch + warn 으로 swallow 되어 예외 전파나 재시도 루프 유발은 없다(§10.9 "silent skip 금지" 관례와 일치, 발송 실패가 webhook 실패로 전파되지 않음). 따라서 "의도치 않은" 부작용이라기보다는 기존 설계 관례를 새 경로로 확장한 것에 가깝다.
  - 제안: 현재 설계(기존 관례를 따름)를 그대로 두어도 무방하나, WH-NF-01 예산이 실측으로 지켜지는지(특히 provider 다중 notify 가 겹치는 다른 실패 경로와 합산됐을 때) 별도 관찰/모니터링 대상으로 삼는 것을 권장. 필요시 향후 이런 best-effort 안내류는 공통으로 fire-and-forget(microtask/큐잉)화하는 리팩터를 고려할 수 있음(본 PR 범위 밖).

- **[INFO]** private 메서드 시그니처 변경 (`forwardToInteractionService`)
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `forwardToInteractionService(trigger, executionId, update, config, adapter)` 로 파라미터 2개(`config: ChatChannelConfig`, `adapter: ChatChannelAdapter`) 추가.
  - 상세: `private` 메서드이며 클래스 내부 단일 호출 지점(`handleChatChannelWebhook` 내 `else` 분기)만 존재, diff 에서 해당 호출부도 동일 커밋에서 `config, adapter` 를 추가로 전달하도록 함께 갱신되어 있어 컴파일 타임에 다른 호출자가 남아있을 가능성은 없다. 테스트(`hooks.service.spec.ts`)도 `service.handleWebhook` 공개 API 를 통해서만 검증하므로 시그니처 변경에 의한 외부 영향은 없다.
  - 제안: 없음 (안전한 변경).

- **[INFO]** 공개 API 추가 — `SURFACE_MISMATCH_DEFAULTS`, `resolveSurfaceMismatchMessage` (신규 export)
  - 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts`
  - 상세: 기존 `resolveSessionExpiredMessage`/`SESSION_EXPIRED_DEFAULTS` 와 동일한 3-level lookup 패턴을 그대로 복제한 순수 추가(additive)이며, 기존 export/함수 시그니처는 전혀 변경되지 않았다. `hooks.service.spec.ts` 에서 새 import 로 재사용하는 것도 순수 참조일 뿐 부작용 없음.
  - 제안: 없음.

- **[INFO]** 전역 상태 변경 없음 확인
  - 상세: 두 변경 함수(`resolveSurfaceMismatchMessage`, `sendSurfaceMismatchNotice`) 모두 인자로 전달된 `config`/`update`/`adapter` 를 읽기만 하고 변형(mutate)하지 않는다. 모듈 스코프의 `logger = new Logger(HooksService.name)` 재사용 외에 신규 전역 변수/모듈 레벨 mutable state 도입 없음.

- **[INFO]** 예외 흡수(swallow) 정책 일관성 확인
  - 상세: `sendSurfaceMismatchNotice` 내부에서 `adapter.sendMessage` 실패를 자체 try/catch 로 흡수(`logger.warn`)하므로, 이 신규 호출로 인해 `forwardToInteractionService` 의 catch 블록에서 새로운 예외가 상위로 전파될 경로는 생기지 않는다 — 기존 "제어 평면 안내가 재시도 루프를 유발하면 안 됨" 요구사항과 부합.

- **[INFO]** 환경 변수 읽기/쓰기, 파일시스템 부작용, 이벤트/콜백 계약 변경 없음
  - 상세: 검토 대상 5개 코드 변경 파일(spec/prod 코드) 어디에도 `process.env` 접근, 파일 I/O, EventEmitter/콜백 등록 방식 변경이 없다. `codebase/backend/.../hooks.service.spec.ts` 의 기존 `process.env.TRUST_CF_CONNECTING_IP` 조작 테스트는 이번 diff 범위 밖(기존 코드, 변경 없음).

- **[INFO]** 문서(mdx)/spec(md) 변경은 순수 서술 추가
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.{en,}.mdx`, `spec/5-system/15-chat-channel.md`
  - 상세: 신규 §7.4 섹션/테이블 행 추가뿐이며 기존 문서 내용·구조·anchor 변경 없음. 런타임 부작용과 무관.

## 요약

이번 변경은 chat-channel 표면 불일치(409 `STATE_MISMATCH`) 흡수 경로에 사용자 대상 best-effort 안내(`languageHints.surfaceMismatch`) 발송을 추가하는 기능으로, 신규 코드 대부분은 기존 `language-hint-defaults.ts` 의 3-level lookup 패턴과 `hooks.service.ts` 내 이미 존재하는 "reject 시 안내 발송(swallow)" 관례(`maybeNotifyIgnored`, `sendExecutionStillRunningNotice`)를 그대로 복제한 것이라 전역 상태·환경 변수·파일시스템·이벤트 계약에 대한 의도치 않은 부작용은 발견되지 않았다. 유일하게 주목할 지점은 종전엔 로그만 남기던 경로에 외부 Bot API 호출(`adapter.sendMessage`)이 동기적으로 추가되어 webhook 응답 critical path 의 지연 요인이 늘었다는 점인데, 이는 같은 파일의 기존 설계 관례를 확장한 것이고 실패는 안전하게 흡수되므로 심각도는 낮다고 판단한다. private 메서드 시그니처 변경(`forwardToInteractionService`)과 신규 public export 는 모두 단일 호출부/추가 전용이라 호출자 영향이 없다.

## 위험도

LOW
