# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `TemplateContent` 의 `previewOnly` prop 제거
  - 위치: `presentation-renderers.tsx` — `TemplateContent` 함수 시그니처 및 내부 조건 분기 전체
  - 상세: 기존 `previewOnly` prop 과 이를 사용하는 "Output Data" 디버그 섹션 렌더링이 `TemplateContent` 에서 삭제됐다. 이는 버그 수정의 직접적 결과로서 — Template 을 공유 렌더링 경로(switch 분기)로 합류시키면서 자체 Output Data 섹션이 공통 경로에서 처리되기 때문이다 — plan 에도 "TemplateContent 시그니처/책임 조정" 항목으로 명시돼 있다. 범위 내 정당한 변경.
  - 제안: 특이사항 없음. 의도된 책임 분리.

- **[INFO]** `TemplateContent` fallback 동작 변경 (`return <JsonContent data={data} />` → `return null`)
  - 위치: `presentation-renderers.tsx` — `TemplateContent` 내 `if (!content)` 분기
  - 상세: `rendered` 가 없을 때 기존에는 `JsonContent` 를 직접 반환했지만 이제 `null` 을 반환한다. 이로 인해 공유 경로의 "Output Data" 섹션이 해당 JSON 을 처리하게 된다. 동작이 변경되지만 목적(콘텐츠 표시)은 동등하며, 버튼 바가 렌더링되려면 이 변경이 필수적이다. 범위 내.
  - 제안: 특이사항 없음.

- **[INFO]** `if/else if/else` → `if/if/return` 흐름 변환
  - 위치: `presentation-renderers.tsx` — `TemplateContent` 내 outputFormat 분기
  - 상세: 기존 `else if` / `else` 체인이 early-return 패턴으로 리팩토링되었다. 동작은 동일하며, 코드 구조가 단순해지는 효과가 있다. 이 리팩토링은 `previewOnly` prop 제거 과정에서 중간 변수 `preview` 가 사라지면서 자연스럽게 발생한 것으로 의도된 변경 범위로 볼 수 있다.
  - 제안: 경계상 허용 가능한 리팩토링이지만, 엄격히 보면 버그 수정에 꼭 필요한 변경은 아니다. 리뷰어의 판단에 따라 별도 커밋으로 분리할 수 있음.

- **[INFO]** Template 노드에 `previewHeader` 분기 추가
  - 위치: `presentation-renderers.tsx` — `PresentationContent` 함수 내 `previewHeader` 상수 선언부
  - 상세: 기존 Template early-return 제거로 인해 Preview 헤더가 단순 "Preview" 로 표시되는 regression 이 발생할 수 있다. 이를 방지하기 위해 `previewHeader` 변수를 통해 Template 에서는 `"Preview (text/html/markdown)"` 형태를 유지한다. plan 의 검증 항목("기존 Template 테스트 통과")에 부합하는 UX 동등성 보전 조치다.
  - 제안: 특이사항 없음. 적절한 regression 방지 처리.

- **[INFO]** 테스트 파일 임포트에 `vi`, `fireEvent` 추가
  - 위치: `presentation-renderers.test.tsx` 1-2행
  - 상세: 새로 추가된 버튼 클릭 인터랙션 테스트(`invokes onPortButtonClick`, `invokes onLinkButtonClick`)에서 `vi.fn()` 과 `fireEvent.click()` 이 사용된다. 기능 변경에 필요한 테스트를 위한 임포트 추가로 정당하다.
  - 제안: 특이사항 없음.

- **[INFO]** 기존 테스트 주석 수정
  - 위치: `presentation-renderers.test.tsx` 43-45행 (diff 기준)
  - 상세: `"TemplateContent 가 JsonContent 로 fallback"` 설명이 `"TemplateContent 가 null 반환 → 공유 Output Data 섹션의 JsonContent 만 표시"` 로 갱신됐다. 구현 변경(fallback 동작 변경)을 정확하게 반영한 주석 갱신으로 필요한 수정이다.
  - 제안: 특이사항 없음.

- **[INFO]** `plan/in-progress/template-preview-buttons-fix.md` 신규 생성
  - 위치: `plan/in-progress/template-preview-buttons-fix.md`
  - 상세: 프로젝트 규약(CLAUDE.md)에 따라 신규 작업은 반드시 `plan/in-progress/` 에 plan 문서를 두어야 한다. frontmatter(`worktree`, `started`, `owner`) 도 올바르게 기재되어 있다. 규약 준수.
  - 제안: 특이사항 없음.

## 요약

이번 변경의 핵심은 Template 노드의 글로벌 버튼 바 미표시 버그 수정으로, 작업 범위는 `plan/in-progress/template-preview-buttons-fix.md` 에 명시된 항목과 정확히 일치한다. 수정된 파일은 `presentation-renderers.tsx`(구현), `presentation-renderers.test.tsx`(테스트), `plan/in-progress/template-preview-buttons-fix.md`(plan) 세 개이며, 각각 버그 수정 의도에 직결되는 변경만 포함하고 있다. `TemplateContent` 내부의 `if/else if/else` → early-return 패턴 전환은 `previewOnly` prop 제거와 함께 발생한 부수적 리팩토링이지만, 동작이 동등하고 코드 단순화 효과가 있어 범위 이탈로 보기 어렵다. 무관한 파일 수정, 불필요한 임포트 추가, 의미 없는 포맷팅 변경은 발견되지 않았다.

## 위험도

NONE
