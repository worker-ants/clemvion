# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan
Coherence / Naming Collision) 전원 성공 응답, Critical 0건.

## 전체 위험도
**MEDIUM** — Critical 은 없으나 cross_spec 이 지적한 두 WARNING(문서-실측 불일치: `details.field`
표기, `SecretResolver.store()` vs `.rotate()`)이 클라이언트 구현자를 오도할 수 있어 문서 신뢰도
저하 위험이 남는다. 나머지 checker 는 LOW~NONE.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드 Critical 0건.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `details.field` 가 target·자매 spec 모두 flat 표기(`'botTokenRef'`)로 "미확정" 상태인데, 이번 diff 의 unit 테스트·구현·swagger 문서가 실제 값은 전부 중첩 경로(`chatChannel.botTokenRef` 등)임을 확정 | `spec/5-system/15-chat-channel.md` §5.4.1 표 3행, §5.4.1.1 회전 행 | `spec/2-navigation/2-trigger-list.md` §2.3.1(line119-120)·PATCH 캐비엇(line176), `spec/5-system/3-error-handling.md`(line270, canonical: 중첩 경로 유지), `trigger-dto-validation.spec.ts` 실측 | `15-chat-channel.md` §5.4.1/§5.4.1.1 과 `2-trigger-list.md` 해당 3곳을 실측값(`chatChannel.botTokenRef` 등)으로 동시 정정. developer plan(`impl-chat-channel-patch-token.md`)이 이미 근거를 실어 둠 — planner 턴에서 즉시 반영 가능 |
| 2 | Cross-Spec | `SecretResolver.store()` 표기가 4개 spec 파일 7곳에 남아 있는데, canonical 정의(`secret-store.md §2`)와 실제 호출(6개 지점 전수 `rotate()`, `store()` 0건)은 모두 `rotate()`(UPSERT) | `spec/5-system/15-chat-channel.md:200,201,373,390` | `spec/conventions/secret-store.md §2`, target R-CC-21(`:764` 부근), `spec/conventions/chat-channel-adapter.md:354,359`, `spec/4-nodes/7-trigger/providers/telegram.md:58,219`, `.../slack.md:278` | 4개 파일 7곳의 `.store(...)` 를 `.rotate(...)` 로 일괄 정정. `data-flow/14-chat-channel.md` 의 "secret store UPSERT" 표현을 정답 표기 선례로 사용 |
| 3 | Plan Coherence | `spec-draft-nullable-notation-followups.md` 가 등재한 두 CRITICAL(chatChannel PATCH bot-token 우회, `ChatChannelCard` 상시 400)이 이번 diff 로 실제 해소됐는데 해당 plan 의 체크박스가 아직 미체크 | (spec 변경 없음 — 코드 diff `triggers.service.ts`/`chat-channel-config.dto.ts`) | `plan/in-progress/spec-draft-nullable-notation-followups.md:1894, :1991` (여전히 `- [ ]`) | 이 impl-done 통과에 맞춰 두 항목 체크 처리 + `impl-chat-channel-patch-token.md` 로 교차 링크. 다음 세션이 완료된 CRITICAL 을 미해결로 오판해 중복 조사하는 것 방지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec / Plan Coherence | PATCH 로 `chatChannel` 최초 부착 차단 + provider 전환 차단(신규 `assertChatChannelAlreadySetUp`)이 §5.4.1 표에 명시 행 없이 신설됨(모순 아닌 커버리지 갭, D-1의 구조적 귀결 + 기존 R-12 조합) | `spec/5-system/15-chat-channel.md` §5.4.1 표 | "PATCH 로 `chatChannel` 신규 부착" 행(→400, `field='chatChannel'`) 및 provider 전환 각주(→400, `field='provider'`, R-12 참조) 추가. planner 후속, 급하지 않음 |
| 2 | Rationale Continuity | §5.4.1/§5.4.1.1 "미확정 — 후속 e2e 확인 대기" 문구가 이번 diff 의 unit 테스트로 이미 실측 해소됨(테스트 주석이 스스로 planner 위임을 명시) | `spec/5-system/15-chat-channel.md` §5.4.1 표 3행, §5.4.1.1 표 2행 | 위 경고 #1 과 동일 정정 시 함께 반영. Rationale 위반이나 결정 번복 아님 — 계획된 후속 |
| 3 | Convention Compliance | 이번 PR 이 새로 발견한 "`store()` vs `rotate()`" drift(9곳)가 중앙 추적 파일(`spec-draft-nullable-notation-followups.md`)이 아니라 `impl-chat-channel-patch-token.md` 에만 기록됨 — 해당 plan 이 `complete/` 이동 시 누락 위험 | `plan/in-progress/impl-chat-channel-patch-token.md` "이 턴에 실측해 planner 로 넘길 것" 표 1행 | plan 이 `complete/` 이동 전에 `spec-draft-nullable-notation-followups.md` 에도 같은 발견(대상 라인 `15-chat-channel.md:200,201,373,390` 등)을 한 줄 등재해 두 문서가 같은 후속 항목을 가리키게 함 |
| 4 | Convention Compliance | `spec/5-system/15-chat-channel.md` frontmatter `code:` 가 이번 diff 의 신규/변경 보조 파일(`update-trigger.dto.ts` 등)을 아직 가리키지 않음(가드는 통과 — 강제 아님) | `spec/5-system/15-chat-channel.md` frontmatter `code:` | 특히 `update-trigger.dto.ts`(DTO 배선 핵심 연결점) 추가 권장, 선택 사항 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | telegram 서명 carve-out CRITICAL 은 이미 해소 확인(재확인). WARNING 2건(문서-실측 불일치: `details.field` 표기, `store()`/`rotate()`) 재확인, 실측으로 확정됐음에도 미정정 상태 지속 |
| Rationale Continuity | NONE | R-CC-10/R-CC-21 의 결정(D-1/D-2/D-3) 정확 구현, 기각된 대안 재도입 없음, telegram carve-out 준수, 과거 e2e 캐너리 결함 재현 문제도 해소 |
| Convention Compliance | LOW | `spec/conventions/**` 명시적 위반 없음. class JSDoc 이 OpenAPI 비노출임을 소스 레벨로 확인 후 정당 활용. INFO 2건은 완결성 차원 |
| Plan Coherence | LOW | 후속 plan 의 두 CRITICAL 이 구현으로 해소됐으나 체크박스 미갱신(WARNING). PATCH 최초부착 파생 규칙 표 미반영(INFO) |
| Naming Collision | NONE | spec/5-system 델타 0(코드 전용 PR). 신규 코드 심볼 7개 전수 grep 검증, 기존 사용처와 충돌 없음, 명명 관례(`Update` 접두) 일치 |

## 권장 조치사항

1. (BLOCK 해소 사유 없음 — 참고용 후속 조치)
2. planner 턴: `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1 의 `details.field` flat 표기를
   실측값(`chatChannel.botTokenRef` 등)으로, `SecretResolver.store()` 표기 7곳을 `.rotate()` 로
   동시 정정(`spec/2-navigation/2-trigger-list.md`, `chat-channel-adapter.md`,
   `providers/telegram.md`, `providers/slack.md` 포함) — developer plan 이 이미 근거 확보.
3. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 CRITICAL 체크박스 갱신 +
   `impl-chat-channel-patch-token.md` 로 교차 링크(마무리 커밋에서).
4. `impl-chat-channel-patch-token.md` 를 `complete/` 로 이동하기 전, "store()/rotate()" drift
   발견을 `spec-draft-nullable-notation-followups.md` 에도 한 줄 등재.
5. (선택, 급하지 않음) §5.4.1 표에 "PATCH 로 chatChannel 신규 부착" 행 + provider 전환 각주 추가,
   frontmatter `code:` 에 `update-trigger.dto.ts` 추가.
