# Cross-Spec 일관성 검토 — spec/5-system/15-chat-channel.md (F-2 surfaceMismatch, impl-done)

## 검토 범위 및 방법

대상 diff 는 `plan/in-progress/eia-command-waiting-surface-guard.md` F-2 항목 구현으로, `HooksService.forwardToInteractionService` 가 409 `STATE_MISMATCH` (표면 불일치)를 삼킬 때 `languageHints.surfaceMismatch` best-effort 안내를 발송하도록 추가한다. target 문서(`spec/5-system/15-chat-channel.md`, HEAD 워킹트리 기준 이미 반영됨)와 다음 관련 spec 을 대조했다: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/5-system/4-execution-engine.md` §7.5.1, `spec/5-system/14-external-interaction-api.md` (§5.1 / R13 매핑 표), `spec/4-nodes/7-trigger/providers/{telegram,slack,discord}.md`, `spec/conventions/chat-channel-adapter.md`, `spec/2-navigation/2-trigger-list.md`, `spec/data-flow/14-chat-channel.md`.

## 발견사항

- **[INFO]** `spec/2-navigation/2-trigger-list.md` 의 `languageHints` 편집 필드 예시 키 목록이 stale
  - target 위치: `spec/5-system/15-chat-channel.md` §4.1 / §4.1.1 (`languageHints` 8키 카탈로그 — `surfaceMismatch` 신규 포함)
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` (Chat Channel 상세 필드 매트릭스) — "`groupChatRefusal` / `executionStarted` / `executionCompleted` / `executionStillRunning` / `help` 등 봇 자체 안내 메시지 i18n"
  - 상세: 이번 diff 로 프론트 i18n dict help text(`codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts`)는 8개 키(`... / formOpenLabel / sessionExpired / surfaceMismatch`)로 갱신됐지만, navigation spec 의 예시 목록은 5개 키에 머물러 있다. "등" 표기라 명시적 모순(허위 진술)은 아니고, `formOpenLabel`/`sessionExpired` 도입 시점부터 이미 갱신되지 않은 기존 drift 의 연장이라 이번 diff 가 새로 만든 문제는 아니다.
  - 제안: `spec/2-navigation/2-trigger-list.md` 의 예시 키 목록을 실제 8키 카탈로그(또는 "`spec/5-system/15-chat-channel.md §4.1.1` 참조"로 대체)로 동기화 권장. 차단 사유는 아님.

- **[INFO]** provider별 상세 spec 문서 커버리지 비대칭 (telegram.md 만 surfaceMismatch 섹션 보유)
  - target 위치: `spec/4-nodes/7-trigger/providers/telegram.md` §5.8 "Surface Mismatch — 표면 불일치 안내"(신규, target PR 의 일부)
  - 충돌 대상: `spec/4-nodes/7-trigger/providers/slack.md`, `spec/4-nodes/7-trigger/providers/discord.md` — 두 문서 모두 §5.6 "Execution Failed" 까지만 있고 `sessionExpired`/`surfaceMismatch` 매핑 섹션이 없음
  - 상세: `SURFACE_MISMATCH_DEFAULTS` 코드 주석은 "세 provider (telegram / slack / discord) 모두에서 raw 로 안전하게 렌더되도록" 설계했다고 명시하므로 기능 자체는 3-provider 공통이다. 그런데 provider별 상세 매핑 문서는 telegram.md 만 §5.7(`sessionExpired`, 기존)·§5.8(`surfaceMismatch`, 이번 diff)를 갖고 slack.md/discord.md 는 없다. 이는 telegram.md 를 "가장 상세한" provider 문서로 취급해온 기존 패턴의 연장(`sessionExpired` 도 telegram.md 에만 있었음)이라 이번 diff 가 새로 만든 비대칭은 아니며, 어댑터 인터페이스(`sendMessage`)가 공통이라 기능적 모순도 없다. 명명·서술 완결성 측면의 동기화 권고 사항.
  - 제안: 필요 시 후속 PR 에서 slack.md/discord.md 에도 §"Execution Cancelled"/"Surface Mismatch" 대응 섹션을 추가해 3-provider 문서 완결성을 맞추는 것을 고려 (본 PR 범위 밖으로 두어도 무방).

## 점검했으나 충돌 없음으로 확인된 항목

- **에러 코드 정합**: `STATE_MISMATCH`(EIA REST) ↔ `INVALID_EXECUTION_STATE`(WS) 의 표면별 코드 분리는 `spec/5-system/4-execution-engine.md §7.5.1` / `spec/5-system/14-external-interaction-api.md` §5.1·R13 이 이미 authoritative 로 정의해 두었고, `15-chat-channel.md` §4.1.1 의 서술("409 `STATE_MISMATCH`")이 정확히 일치한다.
- **요구사항 ID**: 신규 `CCH-*` ID 는 추가되지 않았고, `surfaceMismatch` 는 기존 `CCH-ERR-04`("silently swallow 금지")의 연장 서술로 §4.1/§4.1.1 에 inline 배치됐다 — 이는 `sessionExpired` 도입 시의 기존 배치 패턴(§3 requirement row 미신설, §4 데이터모델 절에 서술)과 동일해 내부 일관성이 있다.
- **계층 책임**: `HooksService.sendSurfaceMismatchNotice` 가 `renderNode` 를 우회해 `adapter.sendMessage` 를 직접 호출하는 구조는 `CCH-CV-05`(groupChatRefusal, "안내 발송 책임 = 어댑터 X, 호출자 O")·`CCH-CV-03`(executionStillRunning) 의 기존 in-process 직접발송 선례와 동형이며, `conventions/chat-channel-adapter.md` 의 6-함수 인터페이스 확장 없이 처리되어 R2(인터페이스 최소화) 원칙과도 충돌하지 않는다.
- **데이터 모델**: `surfaceMismatch` 는 `Trigger.config.chatChannel.languageHints` JSONB 의 신규 키일 뿐 DB 컬럼/마이그레이션 변경이 없다 — `spec/1-data-model.md` §2.8 Trigger 정의와 모순 없음(마이그레이션 diff 도 없음과 일치).
- **RBAC**: 별도 권한 변경 없음. 기존 트리거 편집(Editor+) 권한 범위 안에서 `languageHints` 의 하나로 편집되므로 `spec/2-navigation/9-user-profile.md` RBAC 매트릭스와 충돌 없음.
- **MarkdownV2 non-escape 예외**: `telegram.md` §5.8 이 이 예외를 `executionStillRunning`/`groupChatRefusal` 과 "동일 경로"로 명시하며, 단위 테스트(`escapeMarkdownV2` 불변식)로도 뒷받침되어 코드·spec·기존 관례 3자 정합.

## 요약

target 문서(`spec/5-system/15-chat-channel.md`)의 F-2 `surfaceMismatch` 추가는 `4-execution-engine.md` §7.5.1 및 `14-external-interaction-api.md` 의 `STATE_MISMATCH` 에러 계약, 기존 `CCH-ERR-04`/`CCH-CV-03`/`CCH-CV-05` 관례, `1-data-model.md` 의 Trigger 엔티티 정의와 모두 정합하며, 신규 요구사항 ID·RBAC·상태 전이 충돌은 발견되지 않았다. 발견된 2건은 모두 INFO 등급의 문서 동기화 권고(`2-navigation/2-trigger-list.md` 의 stale 키 목록, slack/discord provider 문서의 telegram 대비 상세도 격차)이며 둘 다 이번 diff 이전부터 존재하던 패턴의 연장이라 이번 변경이 새로 만든 모순이 아니다.

## 위험도

LOW
