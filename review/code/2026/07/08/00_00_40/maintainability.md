# 유지보수성(Maintainability) 리뷰

## 범위 요약

34개 변경 파일 중 33개는 `codebase/frontend/src/content/docs/**` (MDX 사용자 가이드, EN/KO 쌍) 및 `spec/**` 문서이고, 실제 애플리케이션 코드 변경은 `codebase/frontend/src/lib/docs/links.ts` 1개뿐(정적 링크 레지스트리에 9개 상수 추가/1개 rename). 기존의 단일 `03-workflow-editor/overview.mdx`(AI Assistant 안내를 포함해 비대했던 문서)를 9개 세부 페이지로 분리하고, 상호 참조를 갱신한 대규모 콘텐츠 리팩터링이다. 함수 길이·중첩 깊이·순환 복잡도·매직 넘버 등 코드형 체크리스트는 대부분 해당 사항이 없어, 콘텐츠 구조 일관성과 `links.ts` 변경 위주로 점검했다.

## 발견사항

- **[INFO]** 영문 페이지 간 "Tips" 섹션 제목이 3갈래로 갈라짐 (한국어 원문은 전부 통일)
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/*.en.mdx` 말미 섹션 헤딩
  - 상세: 신규/개정된 9개 한국어(`.mdx`) 문서는 마지막 섹션이 전부 `## 팁 & 참고`로 통일돼 있는데, 대응하는 영문(`.en.mdx`) 번역은 `## Tips & notes`(canvas-basics, editing-nodes, settings-panel, saving-and-sharing, ai-assistant), `## Tips & references`(connecting-nodes, containers-and-tools, 기존 overview), `## Tips and related pages`(keyboard-shortcuts, 이번에 신규 작성) 세 가지로 제각각이다. 동일 섹션(`03-workflow-editor`) 내 형제 페이지들이 같은 의미의 섹션을 서로 다른 이름으로 노출해, 향후 새 페이지를 복사-붙여넣기 템플릿으로 만들 때 어떤 문구가 "정답"인지 혼란을 줄 수 있다.
  - 제안: 영문 쪽도 `## Tips & notes` 등 한 가지로 통일. 문서 템플릿/스타일 가이드가 있다면 해당 규칙에 고정 문구를 명시.

- **[INFO]** `links.ts`에 추가된 `workflowEditor.*` 신규 키가 애플리케이션 코드에서 아직 미사용
  - 위치: `codebase/frontend/src/lib/docs/links.ts:28-37`
  - 상세: `canvasBasics`/`editingNodes`/`connectingNodes`/`settingsPanel`/`containersAndTools`/`savingAndSharing`/`keyboardShortcuts`/`aiAssistant`/`aiAssistantWalkthrough` 9개 상수를 추가했으나, `grep` 결과 `codebase/frontend/src` 전체에서 `DOCS.workflowEditor.*`를 실제로 참조하는 `.tsx`/`.ts` 코드는 없다(기존 `overview` 키도 마찬가지로 미사용이었음 — 이 파일의 사전 존재 패턴). MDX 본문 내부 상호링크는 이 상수 대신 `/docs/03-workflow-editor/...` 하드코딩 문자열을 직접 쓰고 있어, 레지스트리의 타입-세이프 이점이 실질적으로 활용되지 않는 영역이 넓다.
  - 제안: 파일 상단 주석("새 페이지/앵커를 추가하면 이 파일에 등록") 취지를 유지하려면 애플리케이션 코드(예: canvas-empty-state 류의 CTA)에서도 점진적으로 `DOCS.workflowEditor.*`를 사용하도록 유도하거나, 순수 문서-간 링크는 레지스트리 등록 대상에서 제외하는 규칙을 명확히 하는 편이 파일의 목적을 분명히 한다. 이번 diff 자체가 만든 회귀는 아니므로 차단 사유는 아님.

- **[INFO]** `plan/in-progress/ai-agent-tool-connection-rewrite.md`에 개명 전 경로(`03-workflow-editor/walkthrough.mdx`) 참조가 남아 있음
  - 위치: `plan/in-progress/ai-agent-tool-connection-rewrite.md:91`
  - 상세: 이번 diff로 AI Assistant 안내가 `overview.mdx` → `ai-assistant.mdx`/`ai-assistant-walkthrough.mdx`로 분리·개명되면서 옛 `walkthrough.mdx` 경로는 더 이상 존재하지 않는다. 해당 plan 문서(리뷰 대상 diff 밖의 파일)는 여전히 옛 경로를 TODO 항목으로 가리키고 있어, 추후 그 plan을 이어받는 사람이 존재하지 않는 파일을 찾게 될 수 있다.
  - 제안: 해당 plan 항목의 파일 경로를 `ai-assistant-walkthrough.mdx`로 갱신(이번 PR 범위 밖이면 별도 후속 커밋으로).

## 요약

이번 변경은 사실상 전부가 사용자 가이드 MDX 문서 재구성(비대한 단일 페이지를 책임 단위로 쪼갠 9개 페이지 신설)이며, 코드 변경은 `links.ts`의 정적 상수 추가/rename 1건뿐이라 전통적인 코드 유지보수성 지표(함수 길이·중첩·매직 넘버·순환 복잡도)는 대체로 적용 대상이 아니다. 문서 분리 자체는 오히려 기존의 "overview.mdx가 AI Assistant 안내까지 떠안던" 단일 책임 위반을 해소하는 긍정적 리팩터링이며, frontmatter의 `order` 값(2~10)도 충돌 없이 순차 배정돼 있고 EN/frontmatter 관례(한국어 canonical에만 frontmatter, 영문은 본문만)도 기존 컨벤션을 그대로 따른다. `code:`/`spec:` frontmatter가 가리키는 파일들도 모두 실재를 확인했다. 유일하게 실질적인 흠은 영문 페이지 간 "Tips" 섹션 제목이 3가지로 갈라진 것으로, 번역 SoT인 한국어 원문은 완전히 통일돼 있는 것과 대비된다 — 사소하지만 다음 페이지 작성 시 템플릿 혼란을 유발할 수 있는 소소한 일관성 이슈다.

## 위험도

LOW
