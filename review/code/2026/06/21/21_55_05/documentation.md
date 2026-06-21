# 문서화(Documentation) 리뷰

## 발견사항

### [WARNING] spec frontmatter `code:` 에 `ai-memory-manager.ts` 미등재
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter
- 상세: `AiMemoryManager` 는 M-1 2단계에서 handler 에서 추출된 공개 클래스이나, spec frontmatter `code:` 필드에 `ai-memory-manager.ts` 가 등재되지 않았다. 이전 리뷰(21_43_55 SUMMARY WARNING #4)에서도 동일하게 지적된 사항으로, spec-coverage audit 시 갭으로 검출된다. RESOLUTION.md 에 planner 위임 defer 확정으로 명기되어 있으나 현재 PR 에서 잔존 상태다.
- 제안: M-1 전체 완료 후 planner 가 `ai-condition-evaluator.ts` + `ai-memory-manager.ts` 일괄 등재 및 §6.1/§6.2 구현 참조 갱신. developer 해소 불가 도메인이므로 비차단 잔존.

### [INFO] 테스트 파일 모듈 수준 JSDoc 존재하나 픽스처 헬퍼 함수에 JSDoc 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-memory-manager/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.spec.ts` — `threadFake`, `agentMemFake`, `baseInject`, `baseSched` 함수
- 상세: 파일 최상단 `/** AiMemoryManager unit — ... */` 블록 주석은 모듈 목적을 잘 설명한다. 그러나 `threadFake(turns, fullTurns)` 의 두 파라미터가 각각 `getThreadExcludingNode` / `getThread` 에 매핑됨을 파라미터 이름만으로는 알기 어렵다. 이는 maintainability 관점과도 중복되나, 문서화 관점에서 짧은 JSDoc 1줄이 있으면 가독성이 높아진다.
- 제안: `threadFake` 에 `/** @param turns getThreadExcludingNode 반환값, @param fullTurns getThread.turns 반환값 */` 1줄 JSDoc 추가. 비차단.

### [INFO] 신규 테스트 케이스 인라인 주석 적절 — 추가 설명 불필요
- 위치: `ai-memory-manager.spec.ts` lines 74, 103–104, 126–128 (추가된 3개 케이스)
- 상세: 신규 추가된 3개 `it()` 블록 내부에 각각 동작 근거를 설명하는 인라인 주석이 포함되어 있다. `exec:exec-1` 변환 경로, `system_text` 모드의 messages 길이 불변 이유, `§12.12` 참조 등 복잡한 로직에 충분한 설명이 있다.
- 제안: 없음. 현재 수준 적절.

### [INFO] RESOLUTION.md 문서 자체의 완성도 양호
- 위치: `review/code/2026/06/21/21_43_55/RESOLUTION.md`
- 상세: WARNING별 조치 내용, defer 이유, INFO 비차단 판정 근거가 구조적으로 명확하게 기술되어 있다. "수렴 판정" 섹션도 조건을 명확히 서술한다.
- 제안: 없음.

### [INFO] `_retry_state.json` 에 개발 머신 절대 경로 포함 — 문서/설정 노출 우려
- 위치: `review/code/2026/06/21/21_43_55/_retry_state.json` — `session_dir`, `summary_output_file` 등 전 필드
- 상세: `/Volumes/project/private/clemvion/` 개발 머신 로컬 절대 경로가 git 이력에 포함된다. 문서·설정 관점에서 개발 환경 구조가 외부에 노출되는 것은 바람직하지 않다. 앞선 리뷰(21_43_55 SUMMARY INFO #4)에서도 동일 지적이 있다.
- 제안: `review/**/_retry_state.json` 을 `.gitignore` 에 추가. 이번 PR 범위 밖이나 별도 위생 작업으로 처리 권장.

## 요약

이번 변경은 테스트 파일 3개 케이스 추가와 review 산출물(RESOLUTION.md, SUMMARY.md, _retry_state.json) 신설로 구성된다. production 코드 변경이 없어 API 문서·README 업데이트 필요성은 없다. 가장 중요한 문서화 갭은 `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 `ai-memory-manager.ts` 가 미등재된 점이나, 이는 planner 도메인으로 developer 해소 불가한 비차단 잔존 WARNING 이다. 테스트 파일 자체에는 모듈 수준 주석과 케이스별 인라인 주석이 충분히 갖춰져 있으며, 헬퍼 함수 파라미터 JSDoc 부재는 비차단 INFO 수준이다.

## 위험도

LOW
