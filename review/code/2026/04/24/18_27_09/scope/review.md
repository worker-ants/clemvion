### 발견사항

- **[INFO]** `system-prompt.ts` – "Labels are globally unique" 불릿 끝에 cross-reference 문구 추가
  - 위치: diff line 297 (`-` → `+` 줄)
  - 상세: 기존 불릿에 **"Uniqueness is an `add_node` collision check only — it does NOT let you substitute a label for a UUID …"** 문장을 덧붙임. 새 기능의 핵심 규칙과 직접 연결되므로 독립적인 변경이 아니라 응집 강화 목적.
  - 제안: 의도된 변경으로 판단; 제거 불요.

- **[INFO]** `shadow-workflow.spec.ts` – 새 `describe` 블록이 기존 `error enrichment` describe 안쪽에 중첩 삽입
  - 위치: diff `@@ -1215,6 +1215,156 @@` 블록 끝 부분
  - 상세: 새 테스트들이 `error enrichment` describe 내부에 추가됨. label-lookalike 힌트가 cascading NODE_NOT_FOUND 힌트와 공유하는 맥락을 감안하면 배치가 적절하나, 독립 describe로 분리해도 무방한 수준.
  - 제안: 현재 구조 유지 가능. 필요 시 최상위 describe로 승격해 가독성 개선 가능.

---

### 요약

4개 파일의 변경 모두 단일 기능("LLM이 tool 인자에 node label을 UUID 자리에 넣는 실수 감지 및 hint 제공")에 집중되어 있다. `shadow-workflow.ts`의 `labelLookalikeHint` 메서드 추가, `updateNode`/`removeNode`/`addEdge` 세 경로의 fallback 연결, `system-prompt.ts`의 교육 문구 추가, 두 spec 파일의 대응 테스트가 일관되게 묶여 있다. 불필요한 리팩토링, 무관한 코드 정리, 포맷팅 전용 변경은 없으며, 기존 불릿에 추가된 cross-reference도 기능 변경의 의미 일관성을 위한 필수 보완으로 볼 수 있다.

### 위험도

**NONE**