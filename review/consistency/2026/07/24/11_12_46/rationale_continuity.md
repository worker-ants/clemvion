# Rationale 연속성 검토 — spec/4-nodes/6-presentation (--impl-done)

## 검토 방법

target 페이로드에 포함된 `0-common.md` / `1-carousel.md` / `2-table.md` 본문·Rationale 과, 그 안에서
cross-ref 하는 타 spec 문서(`spec/5-system/4-execution-engine.md` §7.4/§7.5/§7.5.1/§Rationale,
`spec/4-nodes/3-ai/1-ai-agent.md` §4.1/§6.1.d.ii/§6.2/§7.4/§7.10/§12.4~§12.7,
`spec/conventions/node-output.md` §4.2/§4.5, `spec/conventions/conversation-thread.md` §2.4,
`spec/4-nodes/6-presentation/{4-form.md §1.5, 5-template.md §Rationale R-1}`)의 실제 `## Rationale`
섹션을 worktree 절대경로로 직접 열어 대조했다. 이번 세션의 실 코드 diff(`git diff origin/main..HEAD`)는
`codebase/frontend/.../output-shape.ts`(JSDoc 재구성, 로직 변경 없음) 한 건뿐이며 `spec/4-nodes/6-presentation/`
자체는 origin/main 대비 diff 가 없다 — 즉 본 target 은 이미 병합된 안정 상태이고, 검토는 그 문서가
자신이 인용하는 타 spec 의 Rationale과 지금도 정합한지를 점검하는 데 집중했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** carousel/table 의 "번복 아님" 프레이밍 정합 확인
  - target 위치: `1-carousel.md` §Rationale R-1(레이아웃 two-surface 분리), `2-table.md` §Rationale
    R-1(§1 라벨 서술 정정)
  - 과거 결정 출처: `2-navigation/1-workflow-list.md` §"태그 필터는 단일 free-text 로 하향" 의
    "정정이지 번복이 아니다" 프레이밍 선례
  - 상세: 두 항목 모두 "이전 spec 서술이 실제 코드와 애초에 어긋난 drift 였다" 는 논지로 스스로를
    번복(reversal)이 아닌 정정(correction)으로 명시 구분하고, 기각된 대안(carousel: 옵션 A/C)까지
    적어 두었다. Rationale 연속성 관점에서 모범적인 패턴이며 결함은 아니다.
  - 제안: 없음 (참고용 기록).

## 교차검증 결과 (문제 없음으로 확인된 항목)

- **`previousOutput` 과도기 예외**(`0-common.md` §4.2 하단 경고 블록) — `node-output.md` §4.2 의
  "단 Phase 3 완료 전 과도기 예외: presentation resume 경로(`ButtonInteractionService`)는
  `previousOutput`을 transitional legacy 필드로 보존" 서술과 정확히 일치. Form 배제 서술도 동일.
  (참고: 커밋 `3d0bcd69b`가 과거 이 지점의 불일치를 이미 교정한 이력이 있음 — 현재는 정합.)
- **§10.9 internal bus sentinel wrap** (`{type:'form_submitted', formData}`) — `execution-engine.md`
  §Rationale "Durable Continuation & Graceful Shutdown"(Redis pub/sub 폐기 → BullMQ 채택, "항상
  publish" 원칙 보존)과 §Rationale "park 즉시 해제 + slow-path 일원화"(in-memory
  `pendingContinuations`/resolver 제거, 모든 재개는 §7.5 rehydration)의 서술과 완전히 부합. `!('type'
  in action)` 휴리스틱 폐기는 새 Rationale("form submission wire format wrap")을 동반한 정당한 번복.
- **§10.9 "buttons 대기 중 이종 명령 거부"** — `execution-engine.md` §Rationale "대기 표면 ↔ 명령
  매트릭스 publisher 사전 검증 (§7.5.1)"의 `resolveButtonInteraction` else(d) fallback legacy-row
  한정 서술과 일치.
- **§4.6 Conversation Thread opt-out 2층위 분리**(런타임 게이트 전 노드 공통 vs schema 선언 AI
  3노드 한정) — `conversation-thread.md` §2.4 의 "게이트 적용 범위 ≠ 필드 선언 범위" 박스와 문구
  수준까지 대칭으로 맞물려 있음(양쪽 문서가 서로를 cross-ref, 동일 PR #1004 계열로 함께 갱신된
  것으로 보임).
- **AI Agent 관련 cross-ref**(`userMessage` schema-위반 silent fallback 정합성 §12.4, `render_form`
  timeline 인라인 §12.5, 재호출 차단 가드 §12.6, formData cap §12.7) — 모두 `1-ai-agent.md` 실제
  Rationale 서술과 문구·근거 일치. "LLM reasoning autonomy" 원칙과의 충돌도 없음(§12.6이 명시적으로
  §12.5 원칙과의 정합을 자체 검증해 둠).
- **버튼 cap 5+5 정책, `button.id` UUID backfill, form option value 결정적 backfill** — 모두 기각된
  대안(zod required 필드화, slug 기반 fallback, UUID 값)을 본문 Rationale 에 명시하고 채택 이유를
  구체적으로 서술 — "말없이 재도입" 패턴 없음.
- **cross-anchor 존재성**: `5-template.md#rationale`(R-1), `4-form.md#15-file-타입-ui-동작`,
  `ai-agent.md` §6.1.d.ii/§6.2/§7.4/§7.10/§12.4~§12.7 앵커 모두 실제로 해당 위치에 존재.

## 요약

target 문서(`spec/4-nodes/6-presentation/{0-common,1-carousel,2-table}.md`)는 자신이 인용하는 모든
타 spec(`execution-engine.md`, `1-ai-agent.md`, `node-output.md`, `conversation-thread.md`,
`4-form.md`, `5-template.md`)의 실제 `## Rationale` 서술과 대조한 결과 기각된 대안의 재도입, 합의
원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다. 오히려 결정마다 "기각된 대안 +
채택 근거 + 4-layer SSOT 정렬" 패턴을 일관되게 반복하고, 과거 오류(§7.5.1 이종 명령 오처리,
`previousOutput` 폐기 서술 불일치, `!('type' in action)` silent drop)를 정정할 때도 새 Rationale
항목을 반드시 동반해 연속성을 유지하고 있다. 이번 세션의 실제 코드 diff는 presentation 영역과 무관한
`isConversationOutput` JSDoc 재구성뿐이라 이 target 자체에 대한 신규 회귀 위험도 낮다.

## 위험도

NONE
