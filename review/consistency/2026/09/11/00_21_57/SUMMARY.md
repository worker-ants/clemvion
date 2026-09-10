# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 최고 위험도는 cross_spec·plan_coherence 의 MEDIUM(WARNING) 이며 모두 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속으로 등재되어 있어 즉시 차단 사유가 아니다.

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 코드 전용 PR(spec/5-system 델타 0)이 스스로 실측해 드러낸 두 개의 기존 spec 문면 오류(`store()`/`rotate()` 표기, `details.field` flat/중첩 표기)가 여전히 미정정 상태로 남아 있고, 신규 검증 분기 2건이 spec 표에 미등재.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — CRITICAL 이 없으므로 인계 대상 없음. 단, 아래 WARNING 항목들의 근본 원인은 모두 `spec/` 쓰기 권한 밖(developer 는 spec 을 직접 고칠 수 없음)이라 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속으로 정식 등재되어 있음을 참고로 남긴다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, plan_coherence | `SecretResolver.store()` vs 실제 `.rotate()` 호출 — spec 9곳이 chat-channel 비밀 저장 호출을 `store()`(중복 시 throw)로 표기하나 실제 코드(`triggers.service.ts`)는 전수 `rotate()`(UPSERT) 호출. `setupChatChannel` 멱등 재호출(생성/활성화/PATCH) 동작과 문면이 불일치 | `spec/5-system/15-chat-channel.md:200,201,373,390` (+ `spec/conventions/chat-channel-adapter.md:354,359`, `spec/4-nodes/7-trigger/providers/telegram.md:58,219`, `providers/slack.md:278`) | `spec/conventions/secret-store.md` §2/§2.1(`rotate()` 권장), 실제 호출부 | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속으로 등재됨(9곳 일괄 `.store()`→`.rotate()` 정정). 다음 planner 턴에서 처리 |
| 2 | cross_spec, plan_coherence | `details.field` 실측이 끝났는데 SoT 3곳은 여전히 "미확정"이고, 같은 PR 이 함께 고친 공개 문서(mdx)는 이미 확정값을 노출 — SoT-파생문서 역전 | `spec/5-system/15-chat-channel.md` §5.4.1(L375)·§5.4.1.1(L392), `spec/2-navigation/2-trigger-list.md:119-120,176` | `spec/5-system/3-error-handling.md` §2.1(중첩 경로 규약) + `trigger-dto-validation.spec.ts` `[실측]` 2건(값 비어있음→flat, 비어있지 않음→중첩) + 이미 정정된 `triggers.mdx`/`telegram.mdx` | `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 2026-09-11 실측표로 이미 등재. 선행 조건(e2e 확인) 충족됐으므로 지연 사유 없음 — planner 턴 우선 반영 권장 |
| 3 | cross_spec(INFO)→상향, plan_coherence | 신규 검증 분기(chatChannel 최초 부착 차단·provider 전환 차단)의 `details.field` 값(`'chatChannel'`, `'provider'`)이 SoT 표에 미등재 | `codebase/backend/src/modules/triggers/triggers.service.ts` `assertChatChannelAlreadySetUp`, `triggers.controller.ts` `@ApiBadRequestResponse` | `spec/2-navigation/2-trigger-list.md` PATCH 에러 표, `spec/5-system/15-chat-channel.md` §5.4.1 표(둘 다 기존 유사 위반은 `details.field` 값까지 명시하는 관례가 있음) | provider 불변식 자체는 `2-trigger-list.md` R-12 와 상충 없음(오히려 강제 구현). planner 턴에서 두 케이스와 `details.field` 값을 표에 추가 등재 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `15-chat-channel.md` frontmatter `code:` 목록이 이번 PR 신규 배선 파일(`update-trigger.dto.ts`·`trigger-dto-validation.spec.ts`·`triggers.service.spec.ts`·`trigger-workflow-ref.e2e-spec.ts`)을 반영 안 함 (3라운드째 지속, 가드 통과에는 영향 없음) | `spec/5-system/15-chat-channel.md` frontmatter | followups.md 의 store/rotate 항목 옆에 "`code:` 배선 갱신" 한 줄 병기 |
| 2 | convention_compliance | 사용자 문서 이중 공백 오타 ("항상  rotate API 만") | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` | 다음 편집 시 정리 (비차단) |
| 3 | plan_coherence | `spec-draft-nullable-notation-followups.md` L1976·L2031 이 `plan/complete/impl-chat-channel-patch-token.md` 를 인용하나 실제 경로는 아직 `plan/in-progress/`(체크리스트 미완료) | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 이 리뷰가 BLOCK:NO 로 닫히고 plan 이 실제 `complete/` 로 이동한 뒤 참조 확정, 지금은 "in-progress(완료 임박)" 로 표기 |
| 4 | rationale_continuity | 직전 라운드가 "`details.field` 5필드 전부 중첩"이라 확정 인계했던 실측을 이번 커밋이 스스로 "값 형태에 따라 두 갈래"로 정밀도를 좁혀 정정 — 이미 해소됨, rationale 위반 아님 | `triggers.controller.ts` Swagger, `spec-draft-nullable-notation-followups.md` 각주 | 없음(처리 완료). planner 턴에서 이 두 갈래 표를 그대로 옮기면 됨 |
| 5 | naming_collision | `ChatChannelConfig`/`ChatChannelConfigDto`/`ChatChannelUpdateConfigDto`/`ChatChannelInput` 네 이름이 시각적으로 유사(충돌은 아님, JSDoc 이 관계 명시) | `codebase/backend/src/modules/triggers/triggers.service.ts` 상단 JSDoc | 조치 불요, 반복 관찰만 (등급 상향 근거 없음) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `store()`/`rotate()` 표기 drift(2), `details.field` flat/중첩 미확정(2) 재확인 + 신규 분기 문서화 갭 INFO |
| rationale_continuity | NONE | R-CC-21/R-CC-10 번복 없음. 직전 라운드 실측을 스스로 정밀화(정상 절차) |
| convention_compliance | LOW | 규약 위반 0. 완결성 INFO 2건(frontmatter code:, mdx 오타)만 잔존 |
| plan_coherence | MEDIUM | `details.field` 실측 완료했으나 SoT 미반영+파생문서 역전, store/rotate drift 재확인, 신규 분기 미등재 — 3건 WARNING |
| naming_collision | NONE | 신규 식별자 없음(오버로드·테스트 파라미터화·문서 정정뿐). 기존 7개 심볼 6번째 독립 재검증도 충돌 없음 |

## 권장 조치사항
1. (최우선, 비차단) planner 턴에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재된 `details.field` 실측표(값 형태별 flat/중첩 두 갈래)를 `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1 과 `spec/2-navigation/2-trigger-list.md:119-120,176` 에 반영 — SoT가 이미 공개된 파생문서보다 뒤처진 상태를 우선 해소.
2. 같은 planner 턴에서 `SecretResolver.store()` → `.rotate()` 9곳 일괄 정정(`15-chat-channel.md`, `chat-channel-adapter.md`, `providers/telegram.md`, `providers/slack.md`).
3. 신규 검증 분기(`chatChannel` 최초 부착 차단, `provider` 전환 차단)의 `details.field` 값을 `2-trigger-list.md` PATCH 에러 표와 `15-chat-channel.md` §5.4.1 표에 추가 등재.
4. (선택, 비차단) `15-chat-channel.md` frontmatter `code:` 목록에 신규 배선 파일 추가, `triggers.mdx` 이중 공백 정리, followups.md 의 `plan/complete` 조기 참조 정정.
