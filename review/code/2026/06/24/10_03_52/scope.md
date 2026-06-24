# 변경 범위(Scope) 리뷰 — M-3 3단계 ai-review fix: 타입 alias·JSDoc·테스트 보강

## 발견사항

### [INFO] review/** 산출물이 구현 fix 커밋에 포함됨
- 위치: `review/code/2026/06/24/09_51_30/RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`, 에이전트 보고서 13개
- 상세: ai-review 산출물(SUMMARY·에이전트 보고서)과 resolution 적용 구현 변경이 단일 커밋(8426d829)에 묶여 있다. 프로젝트 규약상 "마지막은 review/** 전용 커밋으로 종결"(MEMORY: Review gate loop avoidance) 지침과 다소 다르나, resolution-applier가 구현 fix + RESOLUTION.md를 동일 커밋으로 생성하는 패턴은 관습적으로 허용되어 온 흐름이다. 기능·이력 명확성 측면의 경미한 관찰이며 차단 불요.
- 제안: 현 커밋 구조는 허용 가능. 향후 구현 fix 커밋과 review/** 산출물 커밋 분리를 고려할 수 있다.

## 요약

ai-review fix 커밋(8426d829)의 변경 범위는 선언된 조치 항목(RESOLUTION.md의 INFO 적용 5건 + W#1 deliberate-defer 처리)과 정확히 일치한다. 수정된 파일은 `assistant-turn-persistence.service.ts`(UsageSnapshot·ResumeMeta 인터페이스 export, persistAssistantTurn JSDoc, makeResumeMeta 의도 주석), `assistant-turn-persistence.service.spec.ts`(whitespace appendMessage 단언·thinkingTokens·length finishReason 3케이스 추가), `workflow-assistant-stream.service.ts`(makeResumeMeta import 의도 주석 4줄)로 한정되며, 런타임 동작·DI 그래프·DB 쓰기 순서·퍼블릭 API 계약은 변경되지 않았다. 기능 확장·무관한 리팩토링·포맷팅 혼입·사용하지 않는 임포트 추가는 없다.

## 위험도

NONE
