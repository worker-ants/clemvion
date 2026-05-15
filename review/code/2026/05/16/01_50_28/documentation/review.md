# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `TemplateContent` 함수에 독스트링 없음
  - 위치: `frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx` — `TemplateContent` 함수 선언부 (라인 1157)
  - 상세: `TemplateContent` 는 내부 함수이지만 동일 파일의 `CarouselContent`, `ChartContent` 등 다른 내부 렌더러도 독스트링이 없는 일관된 패턴이다. 단, 이번 변경으로 `TemplateContent` 의 책임이 "자체 Output Data 섹션 포함"에서 "preview 전용 반환"으로 명확히 달라졌음에도 이 계약 변경이 함수 상단 주석으로 표현되지 않는다.
  - 제안: 함수 선언 위에 한 줄 요약 주석 추가. 예: `// Returns only the rendered preview fragment; Output Data section and button bar are rendered by PresentationContent.`

- **[INFO]** `previewOnly` prop 이 `TemplateContent` 에서 제거되었으나 `PresentationContentProps` 인터페이스 JSDoc 은 여전히 `TemplateContent` 와 무관한 설명으로 남아 있음
  - 위치: `presentation-renderers.tsx` — `PresentationContentProps` 인터페이스 (라인 1236–1242)
  - 상세: `previewOnly` prop 의 JSDoc (`/** When true, only render the visual preview without the raw Output Data JSON section */`)은 이제 template 노드에 대해서도 정확히 작동하지만, 이전에 Template 이 이 prop 을 자체적으로 처리했다가 이제 공통 경로로 이관되었다는 사실이 주석 어디에도 기술되어 있지 않다. 주석만 보면 변경 이전과 동일하게 읽혀 혼동 여지가 있다.
  - 제안: JSDoc 을 `/** When true, only render the visual preview without the raw Output Data JSON section. Applies uniformly to all node types including template. */` 으로 보완.

- **[INFO]** `TemplateContent` 내부의 `if (!content) return null` 주석이 참조하는 spec 섹션 번호가 구체적이지 않음
  - 위치: `presentation-renderers.tsx` 라인 1169–1173
  - 상세: 주석에 `presentation 0-common §6.5` 만 언급하고 있으나, 실제 이 동작은 `5-template.md §5.4` 와도 연관된다. 한편 같은 설명이 테스트 파일(라인 56–58)의 `describe` 블록 헤더 주석에는 두 참조가 모두 명시되어 있어 불일치가 있다.
  - 제안: 코드 주석에도 `5-template.md §1, §5.4` 참조를 추가하여 테스트 주석과 일치시킴.

- **[INFO]** 테스트 파일의 `describe("Template global buttons")` 블록 도입 주석이 `describe("Carousel global buttons")` 블록과 형식적으로 비대칭
  - 위치: `presentation-renderers.test.tsx` 라인 54–58 (Template 블록) vs 라인 405 (Carousel 블록)
  - 상세: Carousel 블록에는 블록 도입 주석이 없고 Template 블록에만 상세한 spec 참조 주석이 있다. 이는 문서화 관점에서 오히려 좋은 패턴이지만, 새로 추가된 Template 블록이 Carousel 블록보다 문서화 수준이 높아 팀 컨벤션 정렬이 필요하다.
  - 제안: Carousel 블록에도 동일 수준의 spec 참조 주석을 소급 추가하거나, Template 블록 주석을 팀 컨벤션으로 공식화.

- **[INFO]** `plan/in-progress/template-preview-buttons-fix.md` 의 작업 항목이 모두 미체크(`[ ]`) 상태
  - 위치: `plan/in-progress/template-preview-buttons-fix.md` 라인 39–44
  - 상세: 실제 구현(렌더러 수정 + 테스트 추가)이 이미 완료된 상태로 PR 리뷰가 진행 중임에도 plan 의 체크박스가 전혀 업데이트되지 않았다. CLAUDE.md 의 "작업 이후: 결과를 해당 위치의 살아있는 문서에 반영" 규약 위반.
  - 제안: 완료된 항목(TDD 테스트 추가, early-return 제거, `TemplateContent` 조정, 기존 테스트 통과 확인)을 `[x]` 로 표시하고, 아직 미완인 항목(lint + unit test + build, /ai-review + RESOLUTION.md)만 `[ ]` 로 남김.

- **[WARNING]** `plan/in-progress/template-preview-buttons-fix.md` 의 "원인" 섹션이 구 코드 스니펫을 그대로 보존하고 있으나 해당 코드는 이미 삭제됨
  - 위치: `plan/in-progress/template-preview-buttons-fix.md` 라인 16–22
  - 상세: plan 문서가 변경 이전의 코드 스니펫을 "원인" 근거로 인용하는 것은 맥락 보존 목적으로는 정당하지만, 향후 독자가 현재 코드에서 해당 라인을 찾으려 할 때 혼선을 줄 수 있다. 라인 번호(`493-495`)가 리팩토링 후에는 더 이상 유효하지 않다.
  - 제안: 스니펫을 그대로 두되 "이미 제거됨" 또는 "fix 적용 전 코드" 라는 레이블을 추가하여 문서가 과거 상태를 기록한다는 점을 명시.

- **[INFO]** README 또는 CHANGELOG 업데이트 불필요 — 이번 변경은 내부 UI 버그 수정으로, 외부 API 변경이나 신규 설정 옵션 없음
  - 위치: 해당 없음
  - 상세: Template 버튼 바 표시는 spec 에 이미 정의된 기능의 버그 수정이므로 README 업데이트 필요성 없음. 프로젝트에 별도 CHANGELOG 가 존재하지 않는 패턴으로 보이므로 CHANGELOG 미작성도 정상.
  - 제안: 없음.

- **[INFO]** `markdownToHtml` 함수의 JSDoc 이 단순 한 줄 설명(`/** Basic markdown to HTML conversion for template preview */`)으로 한정됨
  - 위치: `presentation-renderers.tsx` 라인 882
  - 상세: 이 함수는 지원하는 마크다운 문법 범위(h1~h6, bold, italic, code, hr, 단락)가 표준 마크다운 대비 제한적이므로 "Basic"이라는 단어가 그 한계를 암시하기는 하지만, 지원되지 않는 문법(테이블, 링크, 이미지 등)에 대한 명시적 경고가 없다.
  - 제안: JSDoc 에 `// Note: Only a subset of markdown syntax is supported. Tables, links, and images are not converted.` 를 추가하면 향후 개발자가 이 함수를 확장하거나 교체할 때 판단 근거가 명확해진다.

## 요약

이번 변경의 문서화 수준은 전반적으로 양호하다. 핵심 변경 동기(spec 참조 포함)와 동작 설명이 코드 주석 및 테스트 블록 헤더에 충분히 기술되어 있고, plan 문서도 문제 정의와 접근 방식을 잘 담고 있다. 주요 지적 사항은 두 가지다: (1) plan 문서의 작업 항목 체크박스가 실제 진행 상태와 불일치하여 plan 라이프사이클 규약을 위반하고 있고, (2) `TemplateContent` 의 책임 변경(자체 Output Data 반환 제거)이 함수 상단 주석에 명시적으로 표현되지 않아 신규 기여자가 오해할 여지가 있다. 나머지는 spec 참조 일관성 개선이나 마이너 JSDoc 보강 수준으로 기능적 위험은 없다.

## 위험도

LOW
