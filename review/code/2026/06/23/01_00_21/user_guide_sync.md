# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

해당 없음.

## 요약

매트릭스 전체 18개 trigger 중 이번 변경 set 에 매칭되는 trigger 0개, 누락 0건. 변경 파일 6개는 모두 `codebase/backend/src/modules/workflow-assistant/` 하위에 위치한다. `codebase/backend/src/nodes/**` glob (new-node / node-schema-change), `codebase/backend/src/modules/auth/**` glob (auth-session-flow-change), `codebase/packages/expression-engine/**` glob (expression-language-change), docs/i18n/TSX semantic 등 어떤 trigger 에도 매칭되지 않는다. 본 커밋은 `streamMessage` 내 explore dispatch + kind 분류를 `AssistantToolRouter` 로 추출한 순수 내부 리팩터(verbatim 코드 이동, 동작 보존)이며 사용자 가시 기능·API·노드·i18n·실행 엔진에 영향이 없다.

## 위험도

NONE
