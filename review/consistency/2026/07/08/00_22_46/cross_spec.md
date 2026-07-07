# Cross-Spec 일관성 검토 — `spec/2-navigation/13-user-guide.md`

검토 모드: `--spec` (draft). 대상 변경: `/docs` User Guide 의 §2 IA 트리에 `03-workflow-editor/*` 가이드 페이지, `05-run-and-debug/validation-errors`, `06-integrations-and-config/web-chat-sdk` 행 추가 (현재 working-tree 상태 기준). 데이터 모델·API 계약·요구사항 ID·상태 전이·권한 모델 변경은 없음(문서 전용 변경).

## 발견사항

- **[WARNING]** `NAV-UG-02` 요구사항의 섹션 목록이 현재 IA 트리와 불일치
  - target 위치: `spec/2-navigation/13-user-guide.md` §2 IA 트리 (전체 8개 최상위 섹션: `01-getting-started` ~ `07-workspace-and-team`, `99-faq`)
  - 충돌 대상: `spec/2-navigation/_product-overview.md` §3.11 `NAV-UG-02` — "매뉴얼은 '시작하기 · 노드 · 표현식 · 실행/디버깅 · 통합/설정 · FAQ' 섹션으로 구성" (✅ 완료 표시)
  - 상세: `NAV-UG-02`는 매뉴얼의 canonical 섹션 구성을 6개 카테고리로 명시하고 있으나, 현재 `13-user-guide.md` §2 의 실제 IA 트리는 8개 최상위 섹션(`03-workflow-editor` "워크플로우 에디터", `07-workspace-and-team` "워크스페이스와 팀" 포함)으로 구성되어 있다. 이 두 섹션은 `NAV-UG-02` 문구에 전혀 언급되지 않는다. `03-workflow-editor` 섹션은 커밋 `37fc7f621`(AI 어시스턴트 전용 가이드 신설 시)에, `07-workspace-and-team` 섹션은 그 이전(커밋 `4bbbb9338` 이전)에 이미 도입되었으나 `_product-overview.md` 의 `NAV-UG-02` 서술은 그 이후로 갱신되지 않아 현재 working tree 시점에도 drift 상태다. 금번 변경(§05/§06 신규 행 추가)이 이 drift 를 만든 것은 아니지만, "요구사항이 정의하는 canonical 섹션 목록" vs "실제 IA 문서" 간의 불일치는 검토 대상 target 문서가 여전히 안고 있는 상태다.
  - 제안: `NAV-UG-02` 문구를 "시작하기 · 노드 · 워크플로우 에디터 · 표현식 · 실행/디버깅 · 통합/설정 · 워크스페이스/팀 · FAQ" 등으로 갱신하거나, 구체 섹션 나열 대신 "`13-user-guide.md` §2 IA 트리를 따른다" 로 참조를 위임해 이중 관리(list duplication)를 없앤다.

- **[INFO]** 문서 슬러그와 spec 문서 `id:` 프런트매터의 문자열 중복
  - target 위치: `spec/2-navigation/13-user-guide.md` §2, 신규 행 `06-integrations-and-config/web-chat-sdk`
  - 충돌 대상: `spec/7-channel-web-chat/2-sdk.md` 프런트매터 `id: web-chat-sdk`
  - 상세: 두 값 모두 문자열 `web-chat-sdk` 를 사용하지만 네임스페이스가 다르다 — 하나는 `/docs` MDX 캐노니컬 슬러그(`registry.ts` 스캔 대상), 다른 하나는 spec 문서 자체의 `id:` 프런트매터(spec 파일 식별자, 요구사항 ID 체계와 무관). 실질 충돌은 없으며 오히려 두 문서가 같은 주제를 가리키는 의도된 네이밍 정합으로 보인다(레포 내 `cafe24`, `web-chat` 등 다른 슬러그도 동일 패턴). 다만 향후 grep/검색 기반 도구가 두 네임스페이스를 혼동할 여지가 있어 참고용으로 기록한다.
  - 제안: 조치 불요. 필요 시 `13-user-guide.md` §4(프론트매터 스키마) 나 컨벤션 문서에 "MDX 슬러그와 spec `id:` 네임스페이스는 별개" 라는 한 줄 코멘트를 추가하는 정도로 충분.

## 확인된 정합 사항 (참고, 발견사항 아님)

- `spec/3-workflow-editor/_product-overview.md` §10, `spec/4-nodes/3-ai/_product-overview.md` §3.6 의 사용자 가이드 딥링크가 이미 `03-workflow-editor/overview.mdx` → `03-workflow-editor/ai-assistant.mdx` (및 `walkthrough.mdx` → `ai-assistant-walkthrough.mdx`) 로 갱신되어 있어, target 의 IA 개편(§2 `ai-assistant`/`ai-assistant-walkthrough` 분리)과 정확히 일치한다. 레포 전체에 구 슬러그(`overview.mdx`/`walkthrough.mdx`) 잔존 참조 없음.
- `containers-and-tools` 행의 설명("설정 패널 기반 도구 연결")은 `spec/3-workflow-editor/0-canvas.md` §12·`spec/4-nodes/3-ai/1-ai-agent.md` 가 명시하는 "일반 도구(`tool_*`)/Tool Area 는 현재 제거·재작성 예정" 상태와 모순되지 않는다 — 실제로는 MCP(`mcpServers`)·KB(`knowledgeBaseIds`) 도구가 config 필드(설정 패널)로 연결되는 별개의 현재 유효한 경로를 가리키며, 실제 MDX 본문도 이 경로만 설명한다.
- `web-chat-sdk` 신규 행("웹채팅 SDK 직접 통합")은 `spec/7-channel-web-chat/2-sdk.md` §2(npm 패키지 `@workflow/web-chat`, 개발자용) 및 §R2(스니펫+npm 이원화 결정)와 정확히 대응하며, 기존 `web-chat` 행(스니펫/운영 콘솔 경로)과 책임이 분리되어 중복이 없다.
- `validation-errors` 신규 행("그래프 검증 오류 (저장 거부·경고)")이 가리키는 개념(`CONTAINER_CYCLE`, `CONTAINER_INVALID_CHILD` 등)은 `spec/3-workflow-editor/0-canvas.md` §11.2.1 류 및 `spec/1-data-model.md` §2.6 제약 조건과 용어가 일치하며, 기존 `error-handling`(실행 중 에러 정책) 과 스코프가 겹치지 않는다.
- 신규 IA 행이 가리키는 실제 `.mdx`/`.en.mdx` 파일은 `codebase/frontend/src/content/docs/{03-workflow-editor,05-run-and-debug,06-integrations-and-config}/` 아래 전부 존재를 확인했다(참고용 — spec-impl coverage 는 본 리뷰 범위 밖).
- 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 모델 자체를 정의하는 내용이 target 에 없으므로 해당 4개 관점에서는 다른 영역과 직접 충돌할 소지가 없다.

## 요약

이번 변경은 `/docs` 사용자 가이드의 사이드바 IA(정보 구조) 트리에 3개 신규 캐노니컬 페이지 행을 추가하는 순수 문서 변경으로, 데이터 모델·API 계약·상태 전이·RBAC 등 시스템적으로 강한 결합을 가진 영역과는 충돌하지 않는다. 다른 영역 spec(`3-workflow-editor`, `4-nodes/3-ai`, `7-channel-web-chat`)과의 상호 참조·딥링크·개념 정합은 모두 확인됐고 문제가 없다. 유일한 실질적 발견은 `spec/2-navigation/_product-overview.md` 의 `NAV-UG-02` 요구사항 서술이 IA 트리의 최상위 섹션 구성(특히 `워크플로우 에디터`·`워크스페이스와 팀` 섹션)을 반영하지 못하고 있다는 pre-existing drift이며, 이는 금번 diff 가 만든 문제는 아니지만 target 문서의 현재 상태를 검토하는 과정에서 여전히 유효한 불일치로 확인됐다. 시스템 작동을 저해하는 CRITICAL 충돌은 없다.

## 위험도

LOW
