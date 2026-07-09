# 변경 범위(Scope) 리뷰

## 발견사항

없음. 9개 파일 전부 "멀티턴 resume 턴 llm_usage_log attribution 오적재(IE)/누락(AI Agent) 수정"이라는 단일 의도에 직접 종속된 변경만 포함한다.

- **CHANGELOG.md**: 신규 Unreleased 항목 1건만 추가(기존 항목 무변경). 범위 내.
- **execution-engine.service.ts**: 로직 변경 없이 기존 `workflowId`/`nodeExecutionId` 필드가 IE/ai_agent resume 핸들러의 llm_usage_log attribution 소비처로도 쓰인다는 사실을 알리는 주석 2줄만 추가. 범위 내.
- **ai-turn-executor.ts**: `llmContext` 객체를 구성해 resume 턴의 메인 chat 호출(초기 1곳 + tool-call 루프 후속 1곳) 3번째 인자로 전달하도록 수정. 기존 `chat(a, b)` 호출을 `chat(a, b, llmContext)`로 바꾸며 인자가 3개로 늘어 멀티라인으로 재포맷된 것은 로직 변경에 종속된 필연적 포맷팅이지 별도 스타일 정리가 아니다. 인접 주석 재작성도 동일 변경을 설명하는 범위 내 수정.
- **ai-turn-executor.spec.ts**: 위 수정에 대응하는 회귀 테스트 1건 추가. 기존 테스트 무변경.
- **information-extractor.handler.ts**: `MultiTurnState`에 `workflowId?`/`nodeExecutionId?` 필드 추가, `hydrateState`에서 두 필드 역직렬화, resume `llmContext` 구성부에서 `state.nodeId`(정의 id) 대신 `state.nodeExecutionId`(row PK)+`state.workflowId` 소비로 교정. 버그 설명(오적재 FK)과 정확히 대응.
- **information-extractor.handler.spec.ts**: 위 수정에 대응하는 회귀 테스트 1건 추가.
- **plan/in-progress/resume-llm-usage-attribution.md**: 신규 plan 문서. 배경·변경 세트·테스트·워크플로 체크리스트·잔여 follow-up을 명시하고, `#877`과의 중복 구현을 rebase로 제거한 경위도 투명하게 기록. "잔여 follow-up" 섹션은 별도 project-planner 트랙으로 명시적으로 분리해 두어 본 PR 범위에 섞이지 않았음을 스스로 경계 짓고 있다.
- **spec/5-system/4-execution-engine.md**: `nodeExecutionId` 필드 표에 AI/멀티턴 핸들러의 llm_usage_log 소비 사실 한 문장 추가. 코드 변경과 1:1 대응.
- **spec/data-flow/7-llm-usage.md**: §1.3 캐탈로그 표(AI Agent/Text Classifier/IE 행 + attribution 콜아웃)·§4 외부 의존 표·Rationale의 "nullable context 컬럼들" 절을 "미채움"→"채움 완료"로 정정. 분량은 크지만 전부 이번 코드 수정으로 실제로 바뀐 attribution 채움 현황을 반영하는 정정이며, 새 개념·새 정책을 도입하지 않는다.

특이사항으로 짚을 만한 것은 CRITICAL/WARNING 수준이 아니라 참고용 INFO 하나뿐이다.

- **[INFO]** spec 문서 정정 범위가 코드 diff 대비 넓어 보일 수 있음
  - 위치: `spec/data-flow/7-llm-usage.md` (표 3곳 + Rationale 문단 전체 재작성)
  - 상세: 코드 diff 자체는 2개 소비 사이트의 필드 배선만 고치는 작은 변경이지만, spec 문서에서는 "AI 노드 attribution 이 전부 NULL"이라는 기존 서술이 이번 수정으로 완전히 뒤집혀 표 3곳과 Rationale 문단을 함께 고쳐야 했다. 표면적 diff 라인 수는 크지만, 각 수정 지점이 모두 "지금 무엇이 채워지는가"라는 동일 사실의 여러 서술처를 동기화하는 것이라 실질적으로는 하나의 정정이 반복 적용된 것뿐이다. plan 파일이 별도로 "잔여 follow-up 4건은 본 PR 범위 밖"이라고 명시적으로 선을 그어 두어, 이 정정이 인접 미해결 문서 갭까지 삼키지 않았음도 확인된다.
  - 제안: 조치 불필요. 리뷰어가 diff 크기만 보고 오인하지 않도록 참고 표기.

## 요약

9개 파일 변경 전부가 "AI Agent/Information Extractor resume 턴의 llm_usage_log attribution 배선" 이라는 단일 버그 수정 의도에 직접 종속되어 있다. 핵심 로직 변경은 2개 소비 사이트(ai-turn-executor.ts, information-extractor.handler.ts)로 국한되고, 나머지는 해당 로직 변경에 필연적으로 따르는 테스트·주석·CHANGELOG·plan·spec 문서 동기화다. 요청 범위를 벗어난 리팩토링, 불필요한 포맷팅, 무관한 임포트/설정 변경, over-engineering 은 발견되지 않았다. spec 문서(7-llm-usage.md) 수정 분량이 코드 diff 대비 상대적으로 크지만 이는 "attribution 이 전부 NULL"이라는 기존 서술을 실제 채움 현황으로 정정하는 동일 사실의 반복 동기화이며, plan 파일이 잔여 미해결 문서 갭(4건)을 별도 트랙으로 명시적으로 경계 짓고 있어 범위 오염이 아니다.

## 위험도

NONE
