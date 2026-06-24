# 변경 범위(Scope) 리뷰 — M-3 3단계: AssistantTurnPersistenceService 분리

## 발견사항

### [INFO] review/consistency 산출물이 동일 커밋에 포함됨
- 위치: `review/consistency/2026/06/24/09_39_46/SUMMARY.md`, `_retry_state.json`, `convention_compliance.md`, `cross_spec.md` 등 (파일 6~9 이상)
- 상세: impl-prep consistency check 산출물이 구현 커밋과 동일한 커밋에 묶여 있다. 이는 "리뷰 선행 후 구현" 흐름에서 관례적으로 발생하는 패턴이나, 엄밀히는 리뷰 산출물과 구현 변경이 하나의 커밋으로 혼합된 형태다. 기능상 문제는 없으며 프로젝트 규약상 review/** 전용 커밋 분리 정책이 명시되어 있지 않은 경우 허용 가능한 수준이다.
- 제안: 향후에는 consistency-check 산출물 커밋 → 구현 커밋을 분리해 이력 명확성을 높이는 것을 고려할 수 있다. 현 커밋은 차단 불요.

### [INFO] `makeResumeMeta`가 `workflow-assistant-stream.service.ts` 임포트에 잔류
- 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` — import 블록 (`makeResumeMeta` import 유지)
- 상세: `makeResumeMeta`는 `AssistantTurnPersistenceService`로 이동되었으나, `streamMessage` 내 4곳의 `persistAssistantTurn` 호출부에서 `makeResumeMeta(totalStallCount)`를 인자로 직접 전달하기 때문에 스트림 서비스가 이 헬퍼를 계속 import한다. 이는 의도된 설계 — "turn-scoped 카운터(`totalStallCount`) 소유권은 `streamMessage` 잔류"라는 무상태 collaborator 원칙의 결과다. import가 실제로 사용되고 있으므로 불필요한 임포트가 아니다. 정상.

## 요약

M-3 3단계 변경은 선언된 범위(영속 로직 분리)를 정확히 준수한다. 신규 파일 2개(`assistant-turn-persistence.service.ts`, 동 spec 파일), 기존 파일 3개(`workflow-assistant-stream.service.ts`, 동 spec, `workflow-assistant.module.ts`) 수정이 전부이며, 각각 (1) 로직 이동, (2) 위임 호출로의 교체, (3) DI 등록으로 범위가 명확히 구분된다. 기능 확장·무관한 리팩토링·포맷팅 혼입·임포트 정리 목적 변경은 없다. review/ 산출물의 동일 커밋 포함은 관습적으로 발생하는 패턴으로 범위 이탈이 아니다.

## 위험도

NONE
