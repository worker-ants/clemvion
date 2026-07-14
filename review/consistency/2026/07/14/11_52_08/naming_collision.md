# 신규 식별자 충돌 검토 결과

대상: `spec/5-system/15-chat-channel.md` (impl-done, diff-base `origin/main`)
관련 변경: `plan/in-progress/eia-command-waiting-surface-guard.md` F-1~F-6 (nodeId 표면 가드 + surfaceMismatch 안내 + F-5 raw-send MarkdownV2 검증)

검토 방법: 대상 spec 문서(HEAD 워킹트리 절대경로)를 직접 열람하고, 새로 도입되는 식별자 각각을
`git -C <워킹트리> grep`으로 전체 코드베이스(`codebase/`, `spec/`, `plan/`)에서 교차 검색해
기존 사용처와의 의미 충돌 여부를 확인했다.

## 발견사항

- **[WARNING]** plan 작업항목 라벨(`F-5`/`F-6`)이 도메인 prefix 없이 formal spec 본문에 영구 삽입됨 — 이미 다른 plan 에서 동일 라벨 재사용 전례(`F-3`) 존재
  - target 신규 식별자: `spec/5-system/15-chat-channel.md:263,265` 의 `(F-5)`, `spec/5-system/4-execution-engine.md:1056` 의 `(F-6)` — 둘 다 `plan/in-progress/eia-command-waiting-surface-guard.md` 의 작업항목 번호를 괄호 인용으로 spec 본문에 그대로 박아넣음. plan 파일이 아닌 표 안에는 어떤 plan 을 가리키는지 명시하는 슬러그가 없음 (코드 주석에는 `F-5 (plan eia-command-waiting-surface-guard)` 처럼 항상 plan 명을 동봉하지만 spec 본문은 `(F-5)` bare)
  - 기존 사용처: `spec/2-navigation/4-integration.md:1538` — `(F-3 으로 격상)` 이 **완전히 다른 plan**(cafe24 에러코드 거버넌스, `spec/conventions/error-codes.md` 승격)의 작업항목을 가리킨다. 즉 이 저장소에는 이미 "F-N" 짧은 라벨이 서로 다른 plan 에서 다른 의미로 중복 사용된 선례가 있다 (`F-3` 사례로 실증)
  - 상세: `F-1`~`F-6`, `C-1`, `I-16`, `R9`, `D5` 류의 plan-scoped 짧은 번호는 이 프로젝트 전반에서 관례적으로 쓰이지만 CCH-*/R-CC-*/EIA-* 처럼 도메인 prefix 로 네임스페이스가 분리되지 않는다. 지금 당장 `F-5`/`F-6` 자체가 spec 전역에서 중복되지는 않지만(확인 완료 — 다른 위치에 `F-5`/`F-6` bare 사용 없음), `F-3` 사례가 보여주듯 이 명명 스타일은 새 plan 이 같은 번호를 다시 쓸 때 독자가 어느 plan 을 가리키는지 spec 본문만으로 구별할 수 없는 구조적 위험을 갖는다. 특히 `plan/in-progress/` 문서는 완료 후 `plan/complete/`로 이동하거나 archive 되므로(`plan-lifecycle.md`), spec 에 남은 bare `(F-5)`/`(F-6)` 참조는 시간이 지나면 어느 작업을 가리켰는지 추적이 더 어려워진다
  - 제안: spec 본문에 남기는 plan 작업항목 참조는 코드 주석과 동일하게 `(F-5, plan eia-command-waiting-surface-guard)`처럼 plan 슬러그를 동봉하거나, 이 프로젝트의 기존 관례(R-CC-19 처럼 도메인 prefix 있는 영구 Rationale ID)를 따라 별도 Rationale 항목으로 승격해 plan 완료/archive 이후에도 자명하게 추적 가능하게 할 것. 최소한 이번 라운드는 실사용 충돌이 없으므로 즉시 수정 필수는 아니지만, 다음 spec-sync 패스에서 정리 권장

- **[INFO]** `SURFACE_MISMATCH_DEFAULTS` / `resolveSurfaceMismatchMessage` / `makeLocaleResolver` / `MARKDOWN_V2_SPECIAL_CHARS` / `firstUnescapedMarkdownV2Special` / `TELEGRAM_RAW_SEND_HINT_KEYS` / `LanguageHintsRawSendValidator` / `UNSAFE_TELEGRAM_MARKDOWN` / `expectedNodeId` / `languageHints.surfaceMismatch` — 충돌 없음, 참고로 교차검증 기록
  - target 신규 식별자: 위 9개 전부 이번 diff(F-1/F-2/F-4/F-5/F-6, `plan/in-progress/eia-command-waiting-surface-guard.md`)에서 신규 도입
  - 기존 사용처: `git -C <워킹트리> grep -n "<식별자>"` 로 `codebase/`, `spec/`, `plan/` 전수 검색한 결과, 각 식별자는 새로 만든 파일(`chat-channel/shared/markdown-v2.ts`, `language-hint-defaults.ts` 신규 export, `chat-channel-config.dto.ts` 신규 validator)과 그 직접 소비처(`hooks.service.ts`, `interaction.service.ts`, `execution-engine.service.ts`, 대응 spec/plan 문서)에만 나타나며 다른 의미로 이미 쓰이는 곳은 없음
  - 상세:
    - `languageHints.surfaceMismatch` 신규 config 키는 기존 5키(`groupChatRefusal`/`executionStarted`/`executionCompleted`/`executionStillRunning`/`help`) + `formOpenLabel`/`sessionExpired` 와 겹치지 않는 새 키. §4.1 예제 JSON·§4.1.1 표·telegram 유저가이드(KO/EN §7.4)·i18n dict(`triggers.ts` KO/EN) 4곳 모두 일관되게 반영됨
    - `STATE_MISMATCH`(EIA) / `INVALID_EXECUTION_STATE`(WS) 에 "nodeId 불일치" 사유가 추가됐지만, 이는 **기존 코드를 새 의미로 재정의**한 것이 아니라 `spec/5-system/14-external-interaction-api.md:342` 표에 이미 "다른 nodeId" 가 STATE_MISMATCH 사유로 명시돼 있었는데 구현이 누락돼 있던 것을 정합시킨 케이스 (동 spec 라인 350 의 "**`STATE_MISMATCH` 강제 정합 (2026-07)**" 단락이 이 경위를 정확히 기록) — 신규 식별자 충돌이 아니라 계약-구현 정합화
    - `formValidationFailed`/`formNextField` (F-5 raw-send 키 목록에 포함)는 이번 diff 로 신규 도입된 것이 아니라 이전 작업에서 이미 존재하던 `languageHints` 키였음을 `hooks.service.ts` 기존 코드(비-diff 라인)로 확인 — F-5 목록에 포함시킨 것은 기존 키를 새 검증 규칙 대상에 편입한 것뿐, 명명 충돌 아님
  - 제안: 없음 (현행 유지)

- **[INFO]** 파일 경로 컨벤션 — 신규 파일 `codebase/backend/src/modules/chat-channel/shared/markdown-v2.ts` (+ `.spec.ts`)
  - target 신규 식별자: `chat-channel/shared/markdown-v2.ts`
  - 기존 사용처: 없음 — `git ls-files`로 저장소 전체에서 유일한 경로 확인. `chat-channel/shared/` 디렉터리의 기존 파일(`language-hint-defaults.ts`, `form-mode.ts`)과 명명 패턴(kebab-case, 단일 책임 SoT 모듈) 일치
  - 상세: telegram MarkdownV2 escape 문자 집합이 `providers/telegram/telegram-message.renderer.ts` 의 `escapeMarkdownV2`/`MD_V2_ESCAPE_REGEX` 와 별도 정의로 존재하지만, 이는 파일 경로/식별자 충돌이 아니라 "같은 개념의 두 SoT" 구도이며 spec 본문(§4.1.1 F-5 단락)과 코드 주석 양쪽이 이를 인지하고 contract test(`markdown-v2.spec.ts` 의 "SoT drift 가드")로 동등성을 강제한다고 명시함 — 의도된 설계로 판단, 명명 충돌 지적 대상 아님
  - 제안: 없음

## 요약

target 문서(`spec/5-system/15-chat-channel.md`)가 이번 라운드에 새로 도입한 실질 식별자(config 키 `languageHints.surfaceMismatch`, 함수/상수 9종, 신규 파일 1쌍)는 전수 교차검색 결과 기존 사용처와 의미가 겹치는 CRITICAL 급 충돌이 없다. 새 CCH-* 요구사항 ID 도 추가되지 않아 요구사항 ID 네임스페이스 충돌 위험도 없다. 유일한 주의점은 이번 diff 와 인접 spec(`4-execution-engine.md`)이 도메인 prefix 없는 plan 작업항목 라벨(`F-5`/`F-6`)을 formal spec 본문에 bare 로 남긴 것으로, 현재는 실제 충돌이 없지만 저장소에 이미 동일 스타일의 실충돌 전례(`F-3`, 완전히 다른 plan)가 있어 향후 재사용 시 혼동 소지가 있다 — 차단 사유는 아니고 명명 명확화 권장 수준.

## 위험도

LOW
