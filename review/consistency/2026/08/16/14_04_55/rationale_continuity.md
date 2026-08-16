# Rationale 연속성 검토 — spec-draft-eia-error-masking-catalog.md

## 발견사항

- **[CRITICAL]** "내부 REST 는 마스킹하지 않는다(비대칭 — 의도)" 정당화가 인용한 R17 `ai_message` 불릿을 반대로 인용하고, 이미 트래커에 열려 있는 미결 항목을 그 트래커를 언급조차 하지 않고 일방 확정한다
  - target 위치: `plan/in-progress/spec-draft-eia-error-masking-catalog.md` — "① §R17 — 5번째 불릿 신설" 안의 마지막 sub-bullet
    > `**내부 REST 는 마스킹하지 않는다(비대칭 — 의도)**: ... 워크스페이스 인증을 거친 **내부 관찰자 표면**이고, 위 `ai_message` 불릿이 문서화한 *"내부 표면은 원문 유지"* 방향과 같은 판단이다.`
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` `## Rationale` R17 "표면 제약(보안)" 의 `execution.ai_message` 불릿, 특히 sub-bullet "내부 WS·Chat Channel 도 마스킹됨(수용된 trade-off)"
  - 상세:
    - 인용된 원문은 정확히 반대로 말한다 — *"이 마스킹은 emit-site 라 **내부 WS(에디터) wire envelope 과 Chat Channel 능동 발송에도 적용된다**... 보안 우선으로 이 rare FP 를 수용하며... **participant-vs-observer 분리 egress(예: 관찰자 표면만 마스킹)는 후속 개선 여지**"*. 즉 R17 의 실제 결정은 "내부 표면도 마스킹한다(우선 보안, split 은 아직 안 함)" 이지 target 이 인용한 "내부 표면은 원문 유지" 가 아니다. target 은 **아직 채택되지 않은("후속 개선 여지") 대안을 이미 확정된 판단인 것처럼** 근거로 삼고 있다.
    - 이 지점은 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:180-184` 에 **열려 있는 미결 항목**으로 등재돼 있다: *"내부 REST 와 WS 가 같은 `Execution.error` 에 다른 값을 말한다 ... **의도된 비대칭이면 R17 의 `llmCalls` 선례처럼 caveat 로 명시**하고, 아니면 REST 에도 적용을 검토한다 — **둘 중 하나를 고르는 것이 이 항목이다**"*. 이 파일은 target 문서 frontmatter `pending_plans` 에도 명시돼 있고 본문에서 두 번 인용되는데, 정작 이 미결 항목 자체는 target 의 "범위 밖" 절에도 언급이 없고 R17 신설 불릿에서 아무 참조 없이 조용히 "의도" 로 확정해버린다.
    - 트래커가 제안한 올바른 선례는 `ai_message` 불릿이 아니라 **`llmCalls` 선례**(같은 nodeOutput 불릿의 "에디터는 external-only strip 되지 않는 `llmCalls` 디버그로 원문을 확인할 수 있다") 다 — external 표면만 strip 하고 internal 은 debug 목적으로 원문을 남기는 형태로, target 이 만들려는 비대칭과 실제로 부합하는 유일한 기존 선례다. target 은 이 선례를 쓰지 않고 반대 결론의 `ai_message` 불릿을 오인용했다.
  - 제안: (a) `ai_message` 인용을 제거하고 `llmCalls` 선례로 교체해 정확히 근거를 재작성, (b) `spec-sync-external-interaction-api-gaps.md:180-184` 항목을 이 결정으로 **해소(체크)** 표시하고 target 문서에서도 해당 트래커 항목을 명시적으로 참조, (c) 만약 실제로는 내부 REST 도 마스킹하는 편이 R17 의 "보안 우선" 원칙과 더 정합적이라면 그 방향으로 설계를 재검토.

## 요약

target 은 새 R17 5번째 불릿의 핵심 설계 판단(내부 REST 원문 유지 vs 외부 마스킹 비대칭)을 정당화하며 R17 `ai_message` 불릿을 "내부 표면은 원문 유지" 방향의 선례로 인용했으나, 그 불릿의 실제 결론은 정반대(내부 WS 도 마스킹, participant/observer 분리는 아직 미도입)다. 게다가 이 정확한 질문("내부 REST vs WS 비대칭을 의도로 문서화할지, REST 도 마스킹할지")은 이미 `spec-sync-external-interaction-api-gaps.md` 에 미결 항목으로 등재돼 있고 그 항목은 `llmCalls` 를 올바른 선례로 명시적으로 제안한다. target 은 이 트래커 항목을 언급도 해소도 하지 않은 채 반대 방향 선례를 오인용해 조용히 확정하고 있어, Rationale 연속성 관점에서 CRITICAL 로 판정한다. 다른 부분(egress-only 원칙 준수, conversationThread 불릿 재사용, 단일 chokepoint 헬퍼 패턴 등)은 기존 R17 Rationale 과 정합적으로 잘 이어진다.

## 위험도
CRITICAL
