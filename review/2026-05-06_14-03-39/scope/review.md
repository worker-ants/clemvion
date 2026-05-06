## 발견사항

### - **[INFO]** Plan 문서에 ai-review backlog 항목 추가
- **위치**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §재작성 시 함께 검토할 backlog (lines 45-51)
- **상세**: 이번 feature-out 커밋의 직접 범위(toolNodeIds/toolOverrides 제거)를 벗어난 ai-review 지적 항목(WARN #9 tool loop 중복, WARN #11 _resumeState 스프레드, WARN #17 classifyToolCalls 성능, WARN #20 toolCallCount 비대칭, INFO #5 endReason)이 plan 문서에 추가되었다. 코드 변경이 아닌 계획 문서의 범위 확장이며, 재작성 시 누락 방지 목적으로 추가된 것은 합리적이다.
- **제안**: 현재 plan 이 tool-connection-rewrite 에 국한된다는 점을 감안하면 해당 backlog 항목들을 별도 plan 파일(`plan/in-progress/ai-agent-handler-refactor.md`)로 분리하는 것이 plan 경계를 명확히 한다. 단, 기능적 문제는 없다.

---

### - **[INFO]** `buildConditionOutput`에서 `mode: 'multi_turn'` 하드코딩 — 단일 턴 경로에서도 동일
- **위치**: `ai-agent.handler.ts` line 1182
- **상세**: `buildConditionOutput`는 single-turn(`executeSingleTurn`) 과 multi-turn(`processMultiTurnMessageInner`) 양쪽에서 호출된다. 그러나 내부에서 항상 `config: { mode: 'multi_turn' as const, ... }`를 리턴한다. 이번 변경으로 도입된 코드가 아니라 pre-existing 이슈이며, 현재 제거 범위와 무관하다.
- **제안**: 이번 범위 밖이지만, 재작성 시 backlog WARN #9(tool loop 중복 추출)와 함께 정리를 고려.

---

### - **[INFO]** `mcpServerRefSchema.toolOverrides` 와 connection `toolOverrides` 의 동명 혼선 가능성
- **위치**: `ai-agent.schema.ts` lines 43-50
- **상세**: `mcpServerRefSchema` 내의 `toolOverrides`는 MCP 도구 description 오버라이드(MCP 전용)이며, feature-out된 tool-connection `toolOverrides`(nodeId 기반)와 완전히 다른 구조다. 이름이 같아 혼동 가능성이 있으나, 현재 변경 범위와 무관하고 spec 상 의도가 명확하다.
- **제안**: 재작성 시 `mcpToolOverrides` 등으로 명칭 구분을 고려할 수 있으나, 현재로서는 문제없다.

---

## 요약

이번 변경은 `toolNodeIds` / `toolOverrides` 도구 연결 입력 경로를 스키마·핸들러·테스트에서 제거하고, 관련 PRD·Spec·Plan 문서에 "재작성 예정" 표기를 추가하는 것으로 **범위가 매우 잘 통제되어 있다**. 코드 삭제 범위는 plan 문서에 기술된 항목과 일치하며, legacy DB 데이터 호환을 위한 `.passthrough()` 전략과 회귀 방지 테스트 블록이 함께 추가되어 안전하다. plan 문서에 ai-review backlog 항목이 추가된 것이 의도 범위를 소폭 넘지만, 기능적 위험은 없다.

## 위험도
**LOW**