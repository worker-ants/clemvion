# Rationale 연속성 검토 결과

검토 범위: refactor 03 m-1 — backend NestJS `console.*` → Logger 전환 + eslint `no-console` 가드  
검토 시점: 구현 착수 전 (--impl-prep)  
검토일: 2026-06-25

---

## 발견사항

### 1. [WARNING] ai-agent spec §6.2.c.fallback 의 `console.warn` 원문 — 플래너 위임 상태이나 본 PR 면제 선언만 있고 별도 Rationale 부재

- **target 위치**: plan `m-1` 개선 방안 항목 3 — "(별건) ai-agent spec §6.2.c.fallback 의 'console.warn' spec 원문은 planner 정정 위임"
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §6.2.c.fallback` — spec 본문이 `console.warn('[processMultiTurnMessage] ...')` 를 진단 surface 수단으로 명시. 동 spec §12 Rationale 에 §6.2.c.fallback 설계 근거가 기록됨.
- **상세**: spec §6.2.c.fallback 은 invariant 예외 경로의 진단 수단으로 `console.warn` 을 코드 리터럴로 박아 두고 있다. 본 PR 은 NestJS 서비스 내 `console.*` 를 `Logger` 로 전환하는 것이 목적이면서, 동시에 `eslint no-console` 룰을 추가해 기계적으로 재발을 차단한다. 그런데 ai-agent 의 `processMultiTurnMessageInner`(또는 분해된 `handleMultiTurnUserMessageEntry`) 내부에 이 `console.warn` 이 잔류한 채 eslint 룰이 도입되면, 해당 줄이 lint error 가 되거나, `eslint-disable` 예외가 추가되거나, 이미 `this.logger.warn` 으로 교체되어 spec 원문과 불일치하는 세 가지 결과 중 하나가 발생한다. 어느 경로든 spec 이 명시한 `console.warn` 문구와 구현이 갈라진다. plan 은 이를 "별건 planner 위임" 으로 분리했으나, 위임이 완료되기 전에 eslint 룰을 도입하면 실질적으로 spec 이 명문화한 수단(`console.warn`)을 기각하는 효과가 생긴다 — 그 결정에 대한 새 Rationale 이 spec 에 작성되지 않은 채로.
- **제안**: 두 가지 중 하나를 선택한다.  
  (a) 본 PR 에서 해당 `console.warn` 을 `this.logger.warn` 으로 교체하는 경우, planner 에게 ai-agent.md §6.2.c.fallback 의 `console.warn` 리터럴을 `this.logger.warn(...)` 으로 정정하는 spec 갱신을 동시에 요청하거나 PR 병합 전 선행 완료시킨다. 교체 근거("NestJS Logger 통일 — m-1 refactor")를 spec §12 Rationale 에 한 줄 추가.  
  (b) ai-agent `console.warn` 한 줄만 예외 면제(`// eslint-disable-next-line no-console -- spec §6.2.c.fallback 원문; planner 정정 대기`)로 두고, 정정 완료 후 disable 주석을 제거한다. 이 경로는 spec 원문을 보존하면서 planner 위임 상태를 명시적으로 추적하게 한다.

---

### 2. [INFO] `eslint no-console` 룰 도입 — `scripts/` 및 `instrumentation.ts` override 정책이 spec Rationale 에 미기록

- **target 위치**: plan `m-1` 개선 방안 항목 2 — "eslint `no-console` 을 backend src 에 추가(scripts override 제외)"
- **과거 결정 출처**: 관련 기각 결정 없음. `spec/5-system/3-error-handling.md §6` 의 Rationale 은 로그 레벨·형식·마스킹에 대한 결정만 다루며, 도구(Logger vs console) 선택에 대한 explicit 기각 항목은 없다.
- **상세**: `scripts/` 및 `instrumentation.ts` 가 `console.*` 예외로 남는 설계 판단(pre-bootstrap 단계에서 NestJS Logger DI 컨텍스트가 미초기화)은 기술적으로 타당하나, 현재 어떤 spec Rationale 에도 "bootstrap 이전 진입점은 console 허용" 원칙이 문서화되어 있지 않다. 이 부분은 면제 5곳의 `main.ts:204/206`, `code.handler.ts:44/50/121` 에 inline eslint-disable + 사유 주석으로 처리되므로 코드 수준 근거는 있지만, spec Rationale 수준의 invariant("pre-bootstrap console 허용 예외")로 격상되어 있지 않다.
- **제안**: spec 본문 갱신 의무는 아니다(코드 레벨 주석으로 충분한 수준). 단, 향후 다른 파일이 같은 이유로 면제를 요청할 때 판단 기준이 있도록 `3-error-handling.md §6` Rationale 에 "pre-bootstrap 단계(main.ts, IIFE module loader) 는 NestJS DI 컨텍스트 미초기화로 `console.*` 면제 허용" 한 줄을 INFO 수준으로 추가하는 것을 권장한다.

---

### 3. [INFO] `chat-channel-adapter.md §swallow(logger.warn)` 과의 정합 — 기각된 대안 없음, 정렬 확인

- **target 위치**: plan `m-1` spec 대조 — "`chat-channel-adapter.md:84` 는 'swallow (logger.warn)' 명시"
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md` line 84 — `revokeBotToken?` 의 "실패는 swallow (logger.warn)" 명문.
- **상세**: 본 PR 의 `telegram-message.renderer.ts:427` `console.warn` → `Logger.warn` 교체는 chat-channel-adapter.md 의 합의 원칙("swallow — logger.warn")과 정렬되는 방향이다. 기각된 대안을 재도입하거나 합의 원칙을 위반하는 요소 없음. 단순 확인 사항.
- **제안**: 해당 없음. 정합 확인.

---

### 4. [INFO] `3-error-handling.md §6.2` 구조화 JSON 로그 형식과의 정합 — 기각된 대안 없음, 정렬 확인

- **target 위치**: plan `m-1` spec 대조 — "`3-error-handling.md §6.2` 구조화 JSON 로그 형식을 우회"
- **과거 결정 출처**: `spec/5-system/3-error-handling.md §6.2` 로그 형식 — NestJS Logger 가 생성하는 구조화 JSON 을 규약으로 명시.
- **상세**: `console.warn` → NestJS `Logger.warn` 전환은 §6.2 규약과 정렬되는 방향이다. 함수형 컨텍스트(`telegram-message.renderer.ts:427`, `language-hint-defaults.ts:75`) 에서 모듈레벨 `new Logger('ContextName')` 를 사용하는 패턴은 NestJS Logger DI 를 사용하는 클래스와 출력 형식이 동일하므로 §6.2 규약 위배 없다. 기각된 대안을 재도입하거나 합의 원칙을 위반하는 요소 없음.
- **제안**: 해당 없음. 정합 확인.

---

## 요약

본 target(refactor 03 m-1)은 전반적으로 spec Rationale 과의 연속성을 유지한다. `3-error-handling.md §6.2` 구조화 로그 규약 및 `chat-channel-adapter.md` 의 `logger.warn` swallow 합의와 정렬되는 방향이며, 기각된 대안의 재도입이나 invariant 직접 위반은 발견되지 않는다. 다만 ai-agent spec §6.2.c.fallback 이 `console.warn` 을 코드 리터럴로 명시한 상태에서 eslint `no-console` 룰이 도입되면, 구현과 spec 원문이 조용히 갈라지는 경로가 생긴다. 이 지점이 유일한 WARNING 수준 항목으로, plan 이 "planner 위임 별건"으로 분리한 처리가 구현 완료 전에 정착되지 않으면 spec 기록과 코드 사이에 무근거 번복이 발생할 수 있다. 두 INFO 항목은 후속 보완 제안이며 차단 사유가 아니다.

## 위험도

LOW
