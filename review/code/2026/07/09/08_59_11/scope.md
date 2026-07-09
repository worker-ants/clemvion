# 변경 범위(Scope) 리뷰

## 검증 방법 메모

리뷰 payload 에 포함된 4개 파일 외에 로컬 `main...HEAD` diff 에는 `plan/in-progress/spec-sync-canvas-gaps.md`,
`spec/3-workflow-editor/0-canvas.md`, `spec/conventions/cross-node-warning-rules.md` 도 함께 나타났으나,
이는 로컬 `main` 브랜치 ref 가 stale(원격에 이미 머지된 PR #863 을 fetch 하지 않은 상태)해서 생긴 착시다.
`git diff origin/main...HEAD --stat` 로 재확인한 결과 이 브랜치(`607bba715 fix(editor): 미니맵이 맵 토글 버튼을
가리지 않도록 위로 띄움`)의 실제 변경분은 payload 에 제시된 4개 파일과 정확히 일치한다. 아래 평가는 이 4개
파일만을 대상으로 한다.

## 발견사항

발견된 범위 이탈 사항 없음.

- **[INFO]** 변경 범위가 커밋 목적(미니맵-토글 버튼 겹침 버그 수정)에 정확히 부합
  - 위치: 전체 4개 파일
  - 상세: `canvas-minimap.tsx` 의 핵심 수정(Panel/MiniMap 렌더 순서 교체, `mb-[168px]` 동적 margin 방식을
    양쪽 모두 고정 `!bottom-*` 오프셋으로 교체)은 버그의 근본 원인(가변 margin 기반 위치 계산)을 직접
    겨냥한다. 테스트 파일의 추가분(겹침 방지 회귀 테스트 2건, `twSpacingPx` 헬퍼, mock 확장)은 모두 이
    수정을 검증하기 위한 목적으로만 존재한다. 두 mdx 문서(en/ko)의 1줄 변경은 "토글 버튼이 미니맵 위에
    있다" → "미니맵 아래에 있다"로, 실제 동작 변경을 정확히 반영한 필수 동기화이며 언어 페어(en/ko) 모두
    누락 없이 갱신됐다.
  - 제안: 없음 (조치 불필요)
- **[INFO]** 주석/JSDoc 변경도 모두 동작 변경과 1:1 대응
  - 위치: `canvas-minimap.tsx:12-16` (컴포넌트 JSDoc), `canvas-minimap.test.tsx` 상단 mock 주석 및 신규
    테스트 케이스 주석
  - 상세: 기존 주석이 서술하던 "토글 버튼이 미니맵 위에서 위로 lift" 동작이 더 이상 사실이 아니게 되어
    코드와 함께 갱신된 것으로, 불필요한 주석 변경이 아니라 코드 변경을 정확히 따라간 필수 갱신이다. 새로
    추가된 주석(회귀 테스트 목적 설명, tailwind spacing 규칙 설명)도 테스트 의도를 명확히 하는 데 기여하며
    범위 밖 내용이 아니다.
  - 제안: 없음 (조치 불필요)

## 요약

4개 파일(구현 1 + 테스트 1 + 문서 en/ko 각 1)의 변경 전부가 "미니맵이 토글 버튼을 가리는 버그 수정"이라는
단일 목적에 정확히 수렴한다. 요청 이상의 리팩토링, 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅/주석/임포트
변경, 설정 변경 등 범위 이탈 신호는 발견되지 않았다. `git diff main...HEAD` 상에 나타난 spec/plan 관련 3개
파일 변경분은 이 브랜치의 실제 diff 가 아니라 로컬 `main` ref 의 stale 상태(원격에 이미 머지된 별도 PR
#863)로 인한 착시였음을 `origin/main` 기준 재확인으로 배제했다.

## 위험도

NONE
