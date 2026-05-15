## 발견사항

### **[INFO]** E2E 테스트 인프라 수정이 기능 변경과 혼재
- **위치**: `backend/test/app.e2e-spec.ts`, `backend/test/jest-e2e.json`
- **상세**: `describe.skip()` 추가 및 `transformIgnorePatterns`/`moduleNameMapper` 설정은 병렬 실행·batch truncate 핵심 기능과 직접적 관계가 없는 별도 관심사. 다만 git log 상 별도 커밋(`test(e2e): jest 설정에 transformIgnorePatterns 추가 + placeholder 스킵`)으로 분리되어 있어 추적성은 확보됨.
- **제안**: 이 변경은 그 자체로 타당하나 PR 설명에 "test infra fix 포함" 명시를 권장.

### **[INFO]** `KB_TOOL_GUIDANCE` 변경과 병렬 실행이 한 커밋에 포함됨
- **위치**: `ai-agent.handler.ts:113–119`, `kb-tool-provider.ts:126–135`
- **상세**: 프롬프트 유도(agentic RAG 의도 분해)와 실행 레이어 변경(Promise.all)은 다른 관심사지만, 기능적으로 강결합되어 있음 — 병렬 실행의 실질적 효과는 LLM이 같은 turn에 여러 tool_use를 emit해야 발생하므로, 프롬프트 변경 없이는 의미가 희박. 결합이 의도적이고 합리적.
- **제안**: 무조치. 단, 커밋 메시지가 두 변경을 별개(`a659c631`, `daeaa1f3`)로 나눈 점에서 이미 히스토리 분리가 되어 있음.

### **[INFO]** 스펙 문서 양쪽 동기화 완료, 누락 없음
- **위치**: `spec/4-nodes/3-ai-nodes.md`, `spec/5-system/9-rag-search.md`
- **상세**: 병렬 실행(Promise.all), batch truncate, 결과 분리 유지, chunkId dedup 정책이 양쪽 스펙에 일관되게 반영됨. `RagSearchService.search()`의 multi-KB 병합 동작에 대한 주석(`> 참고:`)이 추가된 것은 구현·스펙 간 오해를 방지하는 유용한 명세 보완.

### **[INFO]** 테스트 코드 범위가 구현 변경과 1:1 대응
- **위치**: `ai-agent.handler.spec.ts` +278 lines
- **상세**: 추가된 5개 테스트(병렬 실행 확인, batch truncate, chunkId dedup, 부분 실패 격리, multi-turn resume 병렬)가 handler.ts 변경사항과 정확히 대응. over-testing 없음.

---

## 요약

변경 범위는 전반적으로 잘 통제되어 있다. 핵심 변경(agentic RAG 프롬프트 유도 → LLM의 다중 tool_use 생성 → Promise.all 병렬 실행 → batch truncate → chunkId dedup)은 서로 인과적으로 연결된 하나의 기능 묶음이며, 구현·테스트·스펙이 일관되게 갱신됐다. 유일한 범위 이탈은 E2E 테스트 인프라 수정이지만, 이는 별도 커밋으로 분리되어 있고 테스트 실행 가능성을 보장하기 위한 타당한 동반 수정이다.

## 위험도

**LOW**