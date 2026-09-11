# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원이 CRITICAL 을 발견하지 못했다 (전문 확보: 5/5, 재시도 필요 없음).

## 전체 위험도
**MEDIUM** — Critical 은 없으나, `impl-chat-channel-binder` 리팩터가 `setupChatChannel` 등 2개
심볼을 `TriggersService` 밖으로 옮기면서 4개 타 영역 SoT 문서(`data-flow/14-chat-channel.md`,
`secret-store.md`, `chat-channel-adapter.md`, `discord.md`/`slack.md`)의 "TriggersService.X"
귀속 서술을 stale 하게 만드는데 `spec_impact: none` 이 이를 다루지 않는다 — build 가드가 못 잡는
조용한 drift. 여기에 이미 3라운드 연속 관측된 `code:` frontmatter 미등재 gap 이 이번 PR 로 더
커지고, 신규 에러코드 6종이 카탈로그에 미등재인 기존 상태도 함께 확인됐다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 CRITICAL 이 없어 인계 대상 없음. 단, 아래 WARNING #1·#2 의 해소 방식이
"spec 문서 서술 정정"으로 결론 나면, `developer` 는 `spec/` write 권한이 없으므로(자기-반증형
소정정 5조건 중 조건1 "developer 자신이 그 문장을 썼는가" 충족 여부를 먼저 확인) 조건 미충족
시 `project-planner` 턴이 필요하다. 이는 강제 인계가 아니라 향후 라운드에서 조건을 확인해 둘
것을 권고하는 참고 사항이다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, naming_collision | `setupChatChannel` 을 `TriggersService` 밖(T2, 신규 provider)으로 옮기는데, 3개 타 영역 문서와 target 자신의 §7이 이 메서드를 `TriggersService`/`triggers.service.ts` 소유로 명시 고정 — `spec_impact: none` 이 이 drift 를 처분하지 않음 | `spec/5-system/15-chat-channel.md` §7 "구현 파일 구조" (L508-540) | `spec/data-flow/14-chat-channel.md` L29, `spec/conventions/secret-store.md` L146/L357, `spec/conventions/chat-channel-adapter.md` L369 | 같은 PR에서 4곳 동기 갱신(클래스명 정정), 또는 plan에 "이 서술은 계약이 아니다"는 명시적 스코프 결정 기록 + 후속 트래커 등재 |
| 2 | naming_collision | `assertInboundSigningPlaintextByProvider` 가 클래스 메서드 → module-level 함수(T1)로 바뀌며 `TriggersService.X` 형태 귀속 서술이 문법적으로도 성립 불가 | `spec/4-nodes/7-trigger/providers/discord.md:297`, `slack.md:275` | T1 신규 모듈 `chat-channel-input-rules.ts` | 호출자/정의처를 분리한 문장으로 정정(예: "`TriggersService` 가 `chat-channel-input-rules` 의 …를 호출"), plan 체크리스트에 "인접 provider spec 귀속 표기 갱신" 한 줄 추가 |
| 3 | convention_compliance | 신규 `CHAT_CHANNEL_*`/`*BOT_TOKEN*` 최상위 에러 코드 6종이 카탈로그에 미등재 | `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표 | `spec/5-system/3-error-handling.md` §1 카탈로그 (`2-api-convention.md` §5.3 이 등재 의무 위임) | §1.9~§1.11 과 동형인 §1.12 신설해 6종 등재 + `15-chat-channel.md §5.4` cross-link |
| 4 | plan_coherence | `15-chat-channel.md` frontmatter `code:` 가 이미 3라운드 연속 관측된 미해소 gap(4개 파일 미등재)을 안고 있는데, 이번 리팩터가 신규 파일 2개(T1/T2)를 더 추가하며 등재 계획 없음 | `spec/5-system/15-chat-channel.md` frontmatter `code:` | `plan/in-progress/spec-draft-nullable-notation-followups.md:2194-2196` | plan 체크리스트에 "T1/T2 신규 파일 `code:` 추가" 항목 신설, 기존 미해소 4개+신규 2개를 한 배치로 planner 턴에서 등재 |
| 5 | plan_coherence | 트래커 열린 항목 2건(동시 PATCH lost-update, `setupChatChannel` 관심사 분해)이 참조하는 코드 위치가 이번 리팩터로 stale 해지는데 plan 종결 체크리스트가 이를 포함하지 않음 | `plan/in-progress/impl-chat-channel-binder.md` §체크리스트 항목7 | `plan/in-progress/spec-draft-nullable-notation-followups.md:2201-2217` | 체크리스트 항목7 을 "모듈 경계만 종결, 나머지 둘은 새 위치로 갱신"으로 확대하거나 PR 본문에 이동 사실 각주 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity, naming_collision | §7 "구현 파일 구조" 다이어그램에 신규 파일(T1/T2) 미반영 — 과거 유사 이동(`chat-channel-token-rotator.service.ts`, C-2)때는 즉시 갱신한 전례 있음 | `spec/5-system/15-chat-channel.md` §7 | 다이어그램에 신규 파일 2개 한 줄씩 추가, 또는 plan에 "이 다이어그램은 개별 helper 파일까지 추적 안 함" 스코프 결정 명시 |
| 2 | convention_compliance | `INVALID_BOT_TOKEN` ↔ `BOT_TOKEN_INVALID` 근접 명명(같은 엔드포인트 400 응답 표) — 규약 위반은 아니나 이 저장소가 `PASSWORD_INVALID`/`INVALID_PASSWORD` 사례에서 이미 겪은 패턴과 동형 | `spec/5-system/15-chat-channel.md` §5.4 | 표 아래 한 줄 각주로 두 코드 의미 차이 명시 |
| 3 | plan_coherence | `buildCallbackUrl` 이 실제로는 `rotateBotToken`(잔류)과도 공유되는데 plan 의존성 표에는 "T2 전용"처럼 등재 | `plan/in-progress/impl-chat-channel-binder.md` §실측 의존성 표 (T2 행) | T1/T2 착수 전 `buildCallbackUrl` 처리 방식(복제 vs 공유 주입) 한 문장 추가 |
| 4 | naming_collision | 신규 `chat-channel-input-rules.ts`(도메인 assert/throw) 와 기존 공유 패키지 `chat-channel-validation`(정규식 SoT)이 이름·문제공간이 인접해 역할 혼동 가능 | 신규 T1 파일 | 파일 상단 docstring 에 `@workflow/chat-channel-validation` 과의 역할 차이 한 줄 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `setupChatChannel` 이동이 3개 타 영역 문서의 "코드 진입점" 서술을 무효화하는데 `spec_impact: none` — 조용한 SoT drift |
| rationale_continuity | NONE | plan 이 과거 결정(C-2 순환 해소, `#1314` CRITICAL, R-CC-21 기각 대안 3건)을 정확히 재현·보존. CRITICAL/WARNING 없음 |
| convention_compliance | LOW | 신규 에러코드 6종 카탈로그 미등재(WARNING) 외엔 광범위 교차 검증에서 정합 확인 다수 |
| plan_coherence | MEDIUM | `code:` frontmatter 3라운드 연속 gap 확대 + 트래커 2개 항목 위치 stale화 |
| naming_collision | LOW–MEDIUM | 신규 식별자 자체는 충돌 없음. 단 `TriggersService.X` 형태로 못박은 기존 SoT 서술 3곳이 이동과 동시에 stale |

## 권장 조치사항
1. (최우선) `setupChatChannel`/`assertInboundSigningPlaintextByProvider` 이동 시, 4개 SoT 문서
   (`data-flow/14-chat-channel.md`, `secret-store.md`, `chat-channel-adapter.md`,
   `discord.md`/`slack.md`)의 `TriggersService.X` 귀속 서술을 같은 PR에서 정정하거나, plan에
   "이 서술은 구현 세부이며 갱신 대상이 아니다"는 근거를 명시한다.
2. `spec/5-system/3-error-handling.md` §1 에 `CHAT_CHANNEL_*`/`BOT_TOKEN_*` 6종을 등재하는
   §1.12 를 신설한다 (이번 리팩터와 무관하게 이미 존재하는 갭).
3. `15-chat-channel.md` frontmatter `code:` 에 T1/T2 신규 파일을 추가하고, 기존 미등재 4개
   파일(`update-trigger.dto.ts` 등)과 한 배치로 planner 턴에서 정리한다.
4. `impl-chat-channel-binder.md` 체크리스트 항목7 범위를 넓혀 트래커의 동시 PATCH lost-update·
   관심사 분해 항목이 참조하는 코드 위치 이동을 반영한다.
5. (낮은 우선순위) §7 다이어그램에 신규 파일 반영, `INVALID_BOT_TOKEN`/`BOT_TOKEN_INVALID`
   근접 명명 각주, `buildCallbackUrl` 공유 방식 명시, `chat-channel-input-rules.ts` docstring
   역할 차이 명시.
