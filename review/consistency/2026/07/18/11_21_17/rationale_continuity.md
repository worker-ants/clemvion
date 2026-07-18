# Rationale 연속성 검토 — `spec/conventions/interaction-type-registry.md`

## 조사 방법 메모

target 문서는 이번 작업(`resumable-handler-generic-typing`, 커밋 `463aee139` "ResumableNodeHandler
제네릭화 — endReason 계약을 타입으로 잠금 (#975)")에서 **변경되지 않았다** (`git log -- spec/conventions/interaction-type-registry.md` 상 마지막 변경은 #968). 커밋 메시지와 `plan/complete/resumable-handler-generic-typing.md`
모두 "spec 변경 없음 · interaction-type-registry §4 의 '패키지가 SoT' 경계를 그대로 따른다"를
명시적으로 선언한다. 따라서 본 검토는 (a) target 문서 자체가 내적으로 과거 Rationale과 정합한지,
(b) 실제 코드 변경(§4 가 규정한 `@workflow/ai-end-reason` 패키지·`ResumableNodeHandler`)이
target 문서가 서술하는 경계·불변식을 우회하지 않는지 두 축으로 진행했다.

payload 로 제공된 "관련 Rationale 발췌" 번들(`spec/0-overview.md`·`spec/1-data-model.md`·
`spec/2-navigation/*.md` 다수)은 target 문서가 실제로 cross-reference 하는 spec
(`execution-engine.md §7.5/§7.5.1`, `1-ai-agent.md §6.1.d.ii/§12.5/§7`,
`conversation-thread.md §1.1/§8.3/§8.6/§9.x`, `information-extractor.md`, `node-output.md`)과
거의 겹치지 않는다 — 검토는 이 번들 대신 위 실제 cross-reference 문서들을 직접 읽어 수행했다
(아래 발견사항 참조).

## 발견사항

- **[INFO]** 점검 payload 의 "관련 Rationale 발췌" 번들이 target 의 실제 cross-reference 문서와 불일치
  - target 위치: 전체 문서 (특히 §1.1/§1.2/§4 의 execution-engine.md·ai-agent.md·conversation-thread.md 참조)
  - 과거 결정 출처: 해당 없음 (프로세스 관찰)
  - 상세: 이번 호출에 첨부된 "관련 Rationale 발췌"는 `0-overview.md`·`1-data-model.md`·다수의
    `2-navigation/*.md` Rationale로, target 문서가 실제로 링크하는 `5-system/4-execution-engine.md`,
    `4-nodes/3-ai/1-ai-agent.md`, `conventions/conversation-thread.md`, `conventions/node-output.md`
    는 포함돼 있지 않았다. 이번 검토는 이 문서들을 직접 열람해 보완했으나, 번들 조립 로직이
    target 문서의 실제 참조 그래프가 아니라 다른 기준(예: 최근 편집일)으로 Rationale을 선별하고
    있다면 향후 검토에서 실제 관련 Rationale이 누락돼 거짓 음성(false negative)을 낼 위험이 있다.
  - 제안: orchestrator 의 Rationale 번들 조립 로직이 target 문서의 인바운드/아웃바운드 링크
    (`[...](../5-system/4-execution-engine.md#...)` 류)를 우선 활용하도록 점검 (본 세션의 결론에는
    영향 없음 — 직접 열람으로 커버됨).

- **[INFO]** target §5 Rationale 의 자기 정정 서술 — 연속성 모범 사례로 확인
  - target 위치: `spec/conventions/interaction-type-registry.md` §5 "강도 정정 (2026-07-17 실측)"
  - 과거 결정 출처: 동일 문서 §5 옛 문구 "영구히 차단한다"
  - 상세: target 은 과거 자신의 과장된 주장("AST 가드가 영구히 차단한다")을 실측 결과로
    스스로 정정하며, 정정 사유(테스트 파일이 `tsconfig.json` exclude 에 걸려 tsc 가 읽지
    않았던 사실)와 해소 방법(`lib/conversation/interaction-type-registry.ts` 소스 이전 +
    양방향 `satisfies`/`Exclude` 잠금)을 명시적으로 남겼다. 이는 "결정의 무근거 번복"이 아니라
    새 Rationale 을 동반한 정당한 번복의 모범 사례다.
  - 제안: 없음 (참고용 기록).

- **[INFO]** `@workflow/ai-end-reason` 패키지·`ResumableNodeHandler` 제네릭화가 target §4 의
  선언(강제 방식 = `satisfies`/`Exclude` 양방향 잠금, 매트릭스·AST 가드 불필요)과 정합함을 실측 확인
  - target 위치: `spec/conventions/interaction-type-registry.md` §4
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md:465` ("`'out'` 이 `AiAgentEndReason` 에 없는
    것은 누락이 아니므로 추가하지 말 것" — 근거: `plan/complete/is-conversation-output-restructure.md`)
  - 상세: `codebase/packages/ai-end-reason/src/index.ts` 를 직접 확인한 결과 `'out'` 은 어느
    유니온에도 추가되지 않았고(명시적으로 기각된 대안 재도입 없음), `UniversalEndReason` 파생
    교집합·`CONVERSATION_END_REASONS` 양방향 잠금이 target §4 표의 서술과 정확히 일치한다.
    `ResumableNodeHandler<TEndReason>` 제네릭화는 spec 에 문서화된 적 없는 backend 내부 타입
    구조(`grep -rn "ResumableNodeHandler" spec/` 0건)라 이번 변경이 spec 상의 어떤 Rationale도
    번복하지 않는다 — `plan/complete/resumable-handler-generic-typing.md` 의 `spec_impact: none`
    선언과 부합한다.
  - 제안: 없음 (검증 완료, 조치 불요).

- **[INFO]** target §1.2 의 `render_form`/`ai_form_render` 서술이 `1-ai-agent.md §12.5` 의
  기각 이력과 정합
  - target 위치: `spec/conventions/interaction-type-registry.md` §1.2 표 `ai_form_render` 행
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md` §12.5 "Active form 을 별도 ConversationTurn
    source 로 분리하는 안은 source enum 확장 영향이 커서 배제"
  - 상세: target 은 "별도 formPreview stack 아님 — drawer·page 공용"이라고 서술해 §12.5 가
    기각한 대안(별도 표면 분리)을 재도입하지 않고 있음을 확인. `resumeFromAiRenderForm` action의
    서술도 §12.5 결정과 일치.
  - 제안: 없음.

## 요약

target 문서(`spec/conventions/interaction-type-registry.md`)는 이번 작업에서 수정되지 않았고,
연계된 코드 변경(#975, `ResumableNodeHandler` 제네릭화)은 커밋·plan 양쪽에서 명시적으로 target
§4 의 "패키지가 SoT" 경계를 준수한다고 선언했으며, 패키지 소스(`@workflow/ai-end-reason`)를
직접 대조한 결과 `AiAgentEndReason` 에 `'out'` 을 추가하지 말라는 `1-ai-agent.md` 의 명시적
기각 결정을 위반하지 않았다. target 문서 자체의 §5 는 과거 과장된 주장을 실측 근거로 정정한
모범적 Rationale 갱신 사례이며, §1.2 의 `render_form`/`ai_form_render` 서술도 `1-ai-agent.md
§12.5` 가 기각한 "별도 표면 분리" 대안을 재도입하지 않는다. 다만 이번 검토에 제공된 "관련
Rationale 발췌" 번들이 target 의 실제 참조 그래프(execution-engine.md·ai-agent.md·
conversation-thread.md)와 크게 어긋나 있어(대신 무관한 0-overview/1-data-model/2-navigation
Rationale 다수가 포함), 향후 유사 점검에서 번들 조립 로직 개선이 필요하다 — 이번 세션은 해당
문서들을 직접 열람해 커버했다.

## 위험도
NONE
