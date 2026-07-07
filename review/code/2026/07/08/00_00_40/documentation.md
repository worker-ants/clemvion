# 문서화(Documentation) 리뷰 결과

대상: `feat(docs): 워크플로우 에디터 사용자 가이드 8종 신규 + IA 재편` — 34개 파일(대부분 `codebase/frontend/src/content/docs/**/*.mdx` 신규/수정, `links.ts`, spec 3개 파일 링크 동기화).

## 발견사항

- **[WARNING]** 새 `containers-and-tools.mdx` 가 "AI Agent 도구 영역은 더 이상 캔버스에 없다"고 명시하는데, 같은 diff 에 포함된 `02-nodes/ai.mdx`/`ai.en.mdx` 는 여전히 "캔버스의 Tool Area 에 노드를 드래그하면 도구로 등록된다"고 서술 — 서로 링크로 연결된 두 문서가 정반대 사실을 말한다
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/containers-and-tools.mdx:1495-1500`(및 `.en.mdx:1373-1380`) vs `codebase/frontend/src/content/docs/02-nodes/ai.mdx:40,326`(및 `.en.mdx:29,315`)
  - 상세: `containers-and-tools.mdx`: "지금은 캔버스에 AI Agent 전용 도구 영역이 따로 표시되지 않아요 ... 노드 설정 패널에서 관리해요." 반면 `ai.mdx` 는 FieldTable 행 `"도구 노드 (Tool Area)"` 와 본문 "도구 등록은 캔버스의 **Tool Area**에 노드를 끌어다 놓으면 끝이에요"를 그대로 유지. `spec/3-workflow-editor/0-canvas.md §12` 는 이미 "재작성 예정 (현재 제거됨)"으로 명시하고 있어 `containers-and-tools.mdx` 쪽이 현재 구현과 일치하고, `ai.mdx`/`ai.en.mdx` 쪽 FieldTable 행은 스키마에서 이미 제거된 `toolNodeIds`/`toolOverrides` 필드를 마치 살아있는 설정처럼 문서화하고 있다. 커밋 메시지 자체가 "02-nodes/ai·mcp-servers·faq 의 잔여 Tool Area 서술 정합은 후속 작업으로 분리"라고 명시해 알려진 부채이나, 이번 PR이 `ai.mdx`/`ai.en.mdx` 를 다른 목적(링크 수정)으로 **직접 건드리면서도** 바로 옆 줄의 모순은 고치지 않았고, 새로 추가한 `containers-and-tools.mdx` 는 오히려 이 모순을 더 눈에 띄게 만든다(두 페이지가 "AI 노드"/"AI node" 링크로 서로를 가리킴).
  - 제안: 최소한 `ai.mdx`/`ai.en.mdx` 의 Tool Area FieldTable 행과 해당 문장에 "현재 비활성화됨" 주석(Callout)을 붙이거나, 이번 PR 범위에서 함께 정정. 최소 조치가 어렵다면 후속 작업 PR 링크/이슈를 커밋 메시지 수준이 아니라 문서 내(TODO 주석 등)에도 남겨 추적성을 높이는 것을 권장. `mcp-servers.mdx/.en.mdx`, `faq.mdx/.en.mdx` 도 동일한 잔여 서술이 있음(이번 diff 밖이지만 동일 근본 원인).

- **[INFO]** 위와 동일한 Tool Area 잔여 서술이 이번 diff에 포함되지 않은 인접 문서에도 남아있음
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.mdx:16,100`, `.en.mdx:5,89`; `codebase/frontend/src/content/docs/99-faq/faq.mdx:88`, `.en.mdx:77`
  - 상세: `containers-and-tools.mdx` 신규 작성으로 "정답" 서술이 생겼으니, 후속 정합 작업 시 이 4개 파일을 함께 스코프에 넣으면 좋음.
  - 제안: 후속 plan 항목으로 명시적으로 등록해 두면 spec-coverage 류 감사에서 재탐지·재보고되는 낭비를 줄일 수 있음.

## 정합성 검증 (통과)

- `links.ts` 에서 제거된 `workflowEditor.walkthrough` 키의 잔여 참조 없음 (grep 확인).
- 신규/수정 문서 34개의 프런트매터 `code:` 배열이 가리키는 소스 파일 22개 전부 실존 확인.
- 신규 문서 간 내부 링크(`/docs/03-workflow-editor/*`, `/docs/05-run-and-debug/*`, `/docs/06-integrations-and-config/*`, `/docs/07-workspace-and-team/*`, `/docs/04-expression-language/*`, `/docs/02-nodes/*`) 대상 파일 전부 실존 확인. 특히 `overview.mdx` 로의 링크들은 슬러그 재배정(AI 어시스턴트 → 에디터 개요) 이후에도 의도대로 "에디터 개요"를 가리켜 올바름.
- 사실 정확성 스팟체크 3건 모두 코드와 일치: 줌 범위 25–200%(`zoom-controls.tsx` `MIN_ZOOM=0.25/MAX_ZOOM=2`), 팔레트 "최근 사용" 최대 5개·Manual Trigger 제외·세션 한정(비영속)(`recent-nodes-store.ts`), 설정 패널 저장 버튼 라벨 "변경 저장"/"JSON 적용"(`i18n/dict/ko/editor.ts` `saveChanges`/`applyJsonBtn`).
- `.en.mdx` 파일들이 프런트매터(title/spec/code)를 갖지 않는 것은 기존에도 있던 정상 패턴(예: 기존 `first-workflow.en.mdx`)이며 이번 신규 페이지들도 동일 컨벤션을 따름 — 문제 아님.
- `03-workflow-editor/*.mdx` 의 `order` 필드 1~10 연속·중복 없음, `spec/2-navigation/13-user-guide.md` 의 IA 트리 갱신이 실제 8개 신규 페이지 + 재배치와 1:1 대응.
- 커밋 메시지가 "즉시 반영" → "변경 저장 클릭 필요", "2초 자동 저장 없음 → 실행 직전 자동 저장만 존재" 같은 기존 문서의 부정확 서술을 정정한 근거를 상세히 남겨, 이번 first-workflow/ui-tour 텍스트 변경의 배경이 추적 가능함(우수 사례).
- 이번 PR은 순수 문서 변경이라 `CHANGELOG.md` 미갱신이 프로젝트 관례와 일치(과거 `feat(docs)` 커밋들도 CHANGELOG 미갱신 확인).

## 요약

이번 변경은 워크플로우 에디터 사용자 가이드 8종을 신규 작성하고 AI 어시스턴트 섹션을 분리하는 대규모 문서화 작업으로, 내부 링크·프런트매터 `code:` 참조·핵심 수치(줌 범위, 최근 노드 최대 개수 등)가 실제 구현과 정확히 일치하고 en/ko 쌍의 구조적 정합성도 잘 유지되어 있어 전반적 품질이 높다. 다만 새로 작성한 `containers-and-tools.mdx` 가 "AI Agent 캔버스 Tool Area 는 더 이상 없다"고 정확히 서술하는 반면, 같은 PR에서 손을 댄 `02-nodes/ai.mdx`/`.en.mdx` 는 여전히 옛 Tool Area 드래그앤드롭 방식을 현재형으로 설명하고 있어 두 문서가 서로 링크된 채 모순되는 상태로 배포된다는 점이 유일한 실질적 흠이며, 이는 커밋 메시지에서도 "후속 작업"으로 인지된 기존 부채다.

## 위험도

MEDIUM
