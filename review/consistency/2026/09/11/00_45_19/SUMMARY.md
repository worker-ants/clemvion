# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 최고 위험도는 `plan_coherence` 의 MEDIUM(WARNING 2건)이며 모두 developer 권한 밖(spec 쓰기 불가) planner 후속 트래커에 이미 등재돼 있다.

## 전체 위험도
**LOW** — CRITICAL 없음. 신규 WARNING 1건(JSDoc 내부 서사, convention_compliance) + 기존 WARNING 2건의 지속(플랜 트래커 등재 상태 유지)만 발견.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — CRITICAL 자체가 없어 인계 대상 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance (신규) | `ChatChannelUpdateConfigDto` 클래스 JSDoc 에 "왜 `OmitType` 인가"·"왜 `Patch` 아니라 `Update` 인가" 같은 구현·명명 경위 서사가 실려 `introspectComments: true` 로 공개 OpenAPI `description` 에 그대로 노출됨 | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:347-371` | `spec/conventions/swagger.md` §3 ("내부 서사는 JSDoc 이 아니라 바로 위 `//` 주석에") — `schedule-response.dto.ts`(53행)·`workspace-response.dto.ts`(89행)는 이미 이 패턴을 올바로 분리한 선례 | 두 단락을 클래스 JSDoc 에서 빼서 클래스 선언 바로 위 `//` 블록으로 이동. JSDoc 에는 소비자용 정보(필드 표, PATCH 400 계약, rotate 엔드포인트 안내, `@see` spec 링크)만 남긴다. 자동 가드(`dto-jsdoc-citation-guard.ts`)는 리뷰 인용만 스캔해 이 형태(일반 설계 서사)를 탐지 못하므로 이번 라운드에서 사람이 확인해 등재 |
| 2 | cross_spec + plan_coherence (지속, 트래커 등재됨) | `details.field` 표기가 SoT 에는 여전히 "미확정"인데, 실측(단위 테스트)은 이미 두 갈래(비어있지 않은 값→중첩 `chatChannel.<field>`, `null`/`''`→flat)를 확정했고, 이번 라운드에 새로 작성된 사용자 가이드(`triggers.mdx`, `telegram.mdx`, 이전 라운드는 slack/discord)가 그 확정값 중 한 갈래를 SoT 보다 먼저 사용자에게 공지해 SoT-역전 폭이 계속 넓어지는 중 | `spec/5-system/15-chat-channel.md:375,392`(§5.4.1/§5.4.1.1), `spec/2-navigation/2-trigger-list.md:120,176` | `spec/5-system/3-error-handling.md` §2.1(중첩 경로 canonical) vs `trigger-dto-validation.spec.ts` `[실측]` 5필드 vs 신규 사용자 가이드 mdx 4개(`chatChannel.botToken` 확정 노출) | planner 턴에서 실측 두-갈래 표를 §5.4.1/§5.4.1.1, `2-trigger-list.md:120,176` 에 즉시 반영 — 선행조건(e2e/실측) 이미 충족돼 지연 사유 없음. 부수로 근거 매체 표현을 "e2e 확인"이 아니라 "단위 테스트(`CustomValidationPipe` 직접 호출) 확인"으로 정정(실제 HTTP round-trip 400 계약 자체는 아직 e2e 미검증). 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재됨 — 신규 등재 불요, 지연 방지 강조만 |
| 3 | cross_spec + plan_coherence (지속, 트래커 등재됨) | `SecretResolver.store()` vs 실제 호출 `.rotate()` 명명 불일치가 이번 PR 이 두 라운드에 걸쳐 직접 편집한 §5.4.1 표 바로 그 절 안(L373,L390)에 그대로 남음 | `spec/5-system/15-chat-channel.md:201,373,390` (+ 예산 밖: `spec/conventions/chat-channel-adapter.md:354,359`, `spec/4-nodes/7-trigger/providers/telegram.md:58,219`, `providers/slack.md:278` — 총 9곳) | 실제 코드 호출부(`triggers.service.ts`)는 전부 `.rotate()` | 이미 `spec-draft-nullable-notation-followups.md` 에 대상 9곳 열거돼 있음 — 다음 planner 턴에서 §5.4.1 정정과 함께 일괄 반영. 신규 등재 불요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `assertChatChannelAlreadySetUp` 신규 400 분기(`details.field='chatChannel'`/`'provider'`)가 SoT 표에 구체적 에러 계약으로 미반영(정책 자체와 모순은 없음, 완결성 갭) | `spec/5-system/15-chat-channel.md` §5.4.1 표, `spec/2-navigation/2-trigger-list.md` PATCH 註 | 이미 `spec-draft-nullable-notation-followups.md` 에 `--impl-done 00_21_57 W3` 근거로 등재됨 — 조치 불요, 참고만 |
| 2 | convention_compliance | `spec/5-system/15-chat-channel.md` frontmatter `code:` 목록이 5라운드째 이번 PR 의 신규 배선 파일(`update-trigger.dto.ts`, `trigger-dto-validation.spec.ts`, `triggers.service.spec.ts`, `trigger-workflow-ref.e2e-spec.ts`)을 반영하지 않음(가드는 이미 통과 — 비강제 완결성 항목) | `spec/5-system/15-chat-channel.md` frontmatter | 자연 소멸하지 않으므로 다음 planner 턴에서 `spec-draft-nullable-notation-followups.md` 에 한 줄 명시 등재 권고 |
| 3 | naming_collision | 신설 slack/discord 사용자 가이드 절 번호가 소수점 표기(`## 6.5`, `## 5.5`)인데 형제 문서 telegram 은 정수 표기(`## 6.`) — 식별자 충돌 아니고 표기 관례 차이 | `discord.mdx`/`discord.en.mdx`/`slack.mdx`/`slack.en.mdx` 신설 절 | 등급 부여 대상 아님. 원한다면 차후 정수 표기로 통일 검토(선택) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 신규 CRITICAL/WARNING 없음. 기존 2건 WARNING(SoT 미확정 vs 실측/가이드 확정값 역전, `.store()`/`.rotate()` 명명)이 트래커에 계속 정확히 추적 중임을 재확인 |
| rationale_continuity | NONE | 이번 신규 커밋은 production 코드 무변경(테스트 판별력 강화 + 사용자 가이드 신설뿐) — R-CC-10/R-CC-21/telegram carve-out 등 기존 Rationale 과 문자 그대로 일치, 기각된 대안 재도입 없음 |
| convention_compliance | LOW | 신규 WARNING 1건 발견(`ChatChannelUpdateConfigDto` JSDoc 내부 서사가 공개 OpenAPI 로 유출, swagger.md §3 위반). 그 외 사용자 가이드 4파일은 i18n-userguide.md 준수 확인, writeOnly/secret-store/review-citations 전부 준수 |
| plan_coherence | MEDIUM | WARNING 2건 지속(SoT-역전 확대, `.store()`/`.rotate()` 명명 미정정) — 둘 다 developer 권한 밖이나 CRITICAL 아님. 직전 라운드 WARNING 1건·INFO 1건은 이번 커밋에서 해소 확인 |
| naming_collision | NONE | 신규 코드 심볼·endpoint·환경변수·spec 파일 도입 없음. 직전 라운드가 검토한 7개 식별자 전수 재검증 결과도 충돌 없음(7번째 독립 재검증) |

## 권장 조치사항
1. (BLOCK 없음이나 최우선 후속) planner 턴에서 `details.field` 실측 두-갈래 표를 `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1 및 `spec/2-navigation/2-trigger-list.md:120,176` 에 반영 — 선행조건(단위 테스트 실측) 이미 충족, 근거 표현은 "단위 테스트"로 정확히 기재.
2. 같은 planner 턴에서 `SecretResolver.store()` → `.rotate()` 명명 정정을 9곳 일괄 반영(`spec-draft-nullable-notation-followups.md` 대상 목록 그대로 사용).
3. developer 다음 세션에서 `chat-channel-config.dto.ts:347-371` 의 `ChatChannelUpdateConfigDto` 클래스 JSDoc 중 "왜 `OmitType`"/"왜 `Update`" 두 단락을 클래스 선언 위 `//` 주석으로 이동(swagger.md §3 준수, 공개 API 문서에서 내부 서사 제거).
4. planner 트래커에 `15-chat-channel.md` frontmatter `code:` 배선 누락 4파일을 한 줄 등재(5라운드째 미해소, 자연 소멸 안 함).
5. (선택, 비차단) `assertChatChannelAlreadySetUp` 신규 400 분기의 SoT 반영은 이미 트래커에 있으므로 planner 턴에서 위 1번과 함께 처리.
