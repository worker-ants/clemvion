# Rationale 연속성 검토 — spec/4-nodes/6-presentation

## 사전 확인 (검토 범위 메타)

`git diff origin/main -- spec/4-nodes/6-presentation/` 결과 **0줄** — target 으로 제시된
`0-common.md` / `1-carousel.md` / `2-table.md` 내용은 현재 `origin/main` 과 완전히 동일한,
이미 병합·정착된 spec 이다 (최근 커밋: `3d0bcd69b docs(spec): presentation previousOutput
"폐기" 서술 정정`, `946b59cf6 fix(execution-engine): §7.5.1 표면 매트릭스 가드`,
`efb63d11f feat(carousel): 실행이력 프리뷰 텍스트 포워드`). 즉 이번 턴에 "새로 도입되는 결정"은
없으며, 본 검토는 **이미 안정화된 spec 텍스트가 교차 참조하는 다른 spec 문서들의 Rationale 과
정합한가**를 사후 검증하는 형태가 된다. (현재 브랜치의 실제 diff 는
`codebase/frontend/.../output-shape.ts` 등 `isConversationOutput` 리팩터로, presentation
spec 과 무관 — orchestrator 가 이 target 을 지정한 사유는 이 checker 의 알 바 아니나, "diff
없음"이라는 사실 자체는 판정에 영향을 준다.)

## 발견사항

검토한 교차 참조와 실측 대조 결과, target 문서가 과거 기각된 대안을 재도입하거나 합의 원칙을
위반하는 지점은 발견되지 않았다.

- **[INFO] 검토 대상이 실질적으로 "무변경" 상태**
  - target 위치: `spec/4-nodes/6-presentation/{0-common,1-carousel,2-table}.md` 전체
  - 과거 결정 출처: 해당 없음 (diff 부재)
  - 상세: `--impl-done, diff-base=origin/main` 모드로 호출됐으나 대상 파일은 origin/main 대비
    diff 가 없다. Rationale 연속성 위반 여부를 판단할 "신규 결정"이 없으므로 본 checker 는
    기존 spec 텍스트의 교차-정합성만 사후 검증했다.
  - 제안: orchestrator 측에서 이 세션의 실제 코드 변경 범위(frontend output-shape 리팩터)와
    무관한 presentation spec 을 target 으로 지정한 경위를 확인. 반복되면 스코프 산정 로직 점검
    권고 (허위 양성 방지 차원의 참고 사항이며 spec 자체의 결함은 아님).

- **교차검증 1 — execution-engine.md §7.4/§7.5.1/Rationale 과 정합**: target `0-common.md
  §10.9`(internal continuation bus sentinel)가 인용하는 `execution-engine.md` §7.4 의 BullMQ
  메시지 타입 6종(`continue/cancel/button_click/ai_message/ai_end_conversation/retry_last_turn`),
  §7.5.1 publisher 사전검증(표면 매트릭스), Rationale "Durable Continuation"(Redis pub/sub
  폐기 근거) · "park 즉시 해제 + slow-path 일원화"(in-memory resolver Map 제거)를 실제 파일에서
  대조한 결과 문구·근거 모두 일치. 특히 `execution-engine.md` Rationale "대기 표면 ↔ 명령
  매트릭스"(§7.5.1, 2026-07-11) 항목이 역으로 `Presentation §10.9` 를 stale `button_click`
  graceful re-park invariant 의 근거로 인용하고 있어, 두 문서가 상호 참조하는 닫힌 루프를
  이룬다 — 어느 한쪽이 다른 쪽의 결정을 뒤집는 정황 없음.
  - 근거 위치: `spec/5-system/4-execution-engine.md:886-931`(§7.4), `:1039-1067`(§7.5.1),
    `:1297-1323`(Rationale "대기 표면 ↔ 명령 매트릭스"), `:1462-1533`(Rationale "Durable
    Continuation" / "park 즉시 해제 + slow-path 일원화")

- **교차검증 2 — ai-agent.md §12.4~§12.7 과 정합**: target 의 `button.id` UUID backfill,
  `render_*` user-message 하이브리드 합성, `form option.value` backfill, `render_form`
  타임라인 인라인 통합, 동일 form 재호출 회귀 차단(`ok`/`message` 가드 필드) 결정 모두
  `ai-agent.md` §12.4~§12.7 Rationale 의 "schema 위반 silent fallback", "LLM reasoning
  autonomy 침해 회피(강제 prompt 미주입)" 원칙과 정합. `§12.6`은 명시적으로 "기각된 추가
  필드"(`rendered:false`, `status:'form_submitted'`) 를 문서화하고 있으며 target 은 그
  기각안을 재도입하지 않는다.
  - 근거 위치: `spec/4-nodes/3-ai/1-ai-agent.md:1207-1266`(§12.4~§12.6)

- **교차검증 3 — node-output.md §4.2/§4.5 과 정합**: target `0-common.md` §4.2 의
  `previousOutput` "폐기 예정이지만 아직 제거되지 않았다 + 적용 범위(Form 제외)" 서술이
  `node-output.md` §4.2 "과도기 예외" 문구와 정확히 일치(해당 커밋 `3d0bcd69b` 로 두 문서가
  같은 turn 에 정합화됨). §4.5 `interaction.type` 4값(`form_submitted/button_click/
  button_continue/message_received`) 중 target 의 §4.2 표가 3값만 나열하는 것은 결함이
  아니라 `message_received` 가 `ai_agent`/`information_extractor` 전용이라 presentation
  카테고리에는 해당 없음 — node-output.md §4.5 "적용 노드" 열과 일치.
  - 근거 위치: `spec/conventions/node-output.md:190-198`(§4.2), `:253-260`(§4.5)

- **교차검증 4 — conversation-thread.md §1.2 과 정합**: target `0-common.md` §10.7 의
  `presentations[]` top-level 필드(`data?` 와 별개), `render_form` 활성 form 판정 predicate
  (`pendingFormToolCall.toolCallId === payload.toolCallId`) 서술이 `conversation-thread.md`
  §1.2 `ConversationTurn.presentations?` 정의와 문구 단위로 동일.
  - 근거 위치: `spec/conventions/conversation-thread.md:73`

- **내부 연속성 — 1-carousel.md R-1, 2-table.md R-1**: `1-carousel.md` Rationale R-1 은
  "기각된 대안"(옵션 A: 프리뷰 시각 재현, 옵션 C: layout 값 강등·제거)을 명시하고 target
  `0-common.md §6.1`(텍스트 포워드 데이터 뷰 + layout 배지)은 그 기각 대안을 재도입하지 않는다.
  `2-table.md` R-1 은 과거 서술 오류 정정을 "번복이 아니라 최초 확정"으로 명시적으로 프레이밍해
  §3(결정의 무근거 번복) 기준을 충족한다.

## 요약

target 문서(`spec/4-nodes/6-presentation/{0-common,1-carousel,2-table}.md`)는 origin/main
대비 diff 가 없는 이미 정착된 spec 이며, 자체 Rationale 항목들과 교차 참조하는
execution-engine.md·ai-agent.md·node-output.md·conversation-thread.md 의 Rationale 을
실측 대조한 결과 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 사례를
찾지 못했다. 문서 간 상호 인용(특히 execution-engine.md ↔ presentation §10.9)이 닫힌 루프를
이루며 서로의 결정을 정확히 반영하고 있어 연속성이 양호하다. 유일한 지적은 검토 스코프 자체가
현재 브랜치의 실제 코드 변경과 무관해 보인다는 프로세스적 관찰(INFO)이다.

## 위험도

LOW
