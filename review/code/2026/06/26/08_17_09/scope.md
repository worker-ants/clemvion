# 변경 범위(Scope) 리뷰 결과

## 발견사항

발견된 범위 이탈 없음.

## 요약

커밋 82e97d2 의 변경은 `codebase/packages/web-chat-sdk/src/` 내 4개 파일(`bridge.ts`, `bridge.spec.ts`, `index.ts`, `index.spec.ts`)과 `plan/in-progress/web-chat-loader-iframe-position.md` 신규 생성으로 구성된다. 모든 코드 수정은 "position:fixed 만 있던 iframe 에 bottom/side:0 + z-index 를 추가해 뷰포트 코너에 고정"하는 단일 버그 수정에 직결된다. 테스트는 변경된 동작만 커버하며, 불필요한 리팩토링·포맷팅 혼입·무관 파일 수정·임포트 정리·설정 파일 변경은 없다. plan 파일은 프로젝트 규약(worktree 작업 문서를 `plan/in-progress/` 에 생성)에 따른 정상 산출물이다.

## 위험도

NONE
