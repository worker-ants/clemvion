---
worktree: template-buttons-fix-362d73
started: 2026-05-16
owner: developer
---

# Template Preview 버튼 미표시 버그 수정

## 문제

Presentation 5종 중 **Template** 노드만 Run Results Drawer / Executions 페이지의 Preview 탭에 글로벌 ButtonDef 버튼 바가 표시되지 않는다.

### 원인

`frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx:493-495`

```tsx
// Template already includes its own debug data section
if (result.nodeType === "template") {
  return <TemplateContent data={data} config={envelopeConfig} previewOnly={previewOnly} />;
}
```

이 early-return 이 함수 하단(라인 555–586) 의 글로벌 버튼 바 렌더링을 스킵.

### Spec 근거 (Template 도 버튼 지원)

- `spec/4-nodes/6-presentation/0-common.md` §1 — "Carousel / Table / Chart / **Template** 노드가 공통으로 사용하는 버튼 정의"
- `spec/4-nodes/6-presentation/0-common.md` §6.5 — Template "버튼 대기 중 … 렌더링된 콘텐츠 아래 **버튼 바** 표시"
- `spec/4-nodes/6-presentation/5-template.md` §1 — `buttons: ButtonDef[]` 필드, 1개 이상 시 Blocking Mode
- `spec/4-nodes/6-presentation/5-template.md` §5.4 — waiting 시 `config.buttonConfig.buttons` 페이로드

## 접근

Template 도 다른 4종과 동일한 `preview + 글로벌 버튼 바` 합성 구조로 통합한다. 단, Template 의 기존 자체 "Output Data" 디버그 섹션은 보존한다.

### 옵션

1. **(채택)** `TemplateContent` 의 자체 "Output Data" 섹션 분리 — `TemplateContent` 는 콘텐츠 preview 만 반환하게 단순화하고, Template 도 switch 분기에 합류시켜 글로벌 버튼 바와 Output Data 섹션을 공유 경로에서 처리.
2. 거부 — `TemplateContent` 안에 버튼 바 렌더링 코드를 복제 (DRY 위반, allButtons/buttonItemMap 로직 중복).

## 작업 항목

- [ ] (TDD) 실패하는 테스트 추가: Template + buttonConfig 케이스에서 글로벌 버튼이 표시되어야 함
- [ ] `presentation-renderers.tsx` 의 Template early-return 제거, switch 분기에 합류
- [ ] `TemplateContent` 시그니처/책임 조정 (자체 Output Data 섹션 → 공통 경로 사용)
- [ ] 기존 Template 테스트(`renders text/html/markdown preview`, `shows Output Data section`, `falls back to JsonContent`) 가 여전히 통과하는지 확인
- [ ] frontend lint + unit test + build
- [ ] /ai-review + RESOLUTION.md

## 영향 범위

- frontend only (UI 렌더링)
- backend handler 출력 형식 변경 없음 (Template 핸들러는 이미 `config.buttonConfig.buttons` 를 그대로 출력하고 있음 — spec 5-template.md §5.4 가 그 증거)
- 기존 Template 테스트와의 호환 유지 필요

## 검증

- Template + buttons 케이스: 버튼 클릭 가능 + onPortButtonClick/onLinkButtonClick 호출
- Template + buttons + selectedButtonId: resumed 상태에서 선택된 버튼 highlight
- Template without buttons: 기존 렌더링 그대로 (regression 방지)
- 다른 Presentation 노드 (carousel/table/chart/form): 영향 없음
