# 정식 규약 준수 검토 — `spec/2-navigation/13-user-guide.md` 및 연관 유저 가이드 문서

검토 대상: (1) 작업트리 미커밋 변경 `spec/2-navigation/13-user-guide.md` §2 IA tree — `03-workflow-editor/*` 신규 페이지 · `05-run-and-debug/validation-errors` · `06-integrations-and-config/web-chat-sdk` row 추가. (2) 이미 커밋된 `d7d920ef1`·`aaacb1701` — `codebase/frontend/src/content/docs/03-workflow-editor/*.{mdx,en.mdx}` 신규 8쌍(16파일) + 기존 가이드 페이지 5건 갱신(`01-getting-started/*`, `02-nodes/ai.mdx`, `06-integrations-and-config/mcp-servers.mdx`, `99-faq/faq.mdx`) + `lib/docs/links.ts`.

적용 규약: `spec/2-navigation/13-user-guide.md` §4(프론트매터 스키마)·§5(섹션 순서)·§6(딥링크)·§7(작성 정책)·§8(공용 MDX 컴포넌트)·§12(품질 체크), `spec/conventions/i18n-userguide.md` Principle 5/6/6-B/7, `codebase/frontend/src/content/docs/_glossary.md`, `PROJECT.md §유저 가이드 파일 컨벤션`.

자동 가드(`registry.test.ts`, `i18n.test.ts`, `no-internal-refs.test.ts`, `locale.test.ts` 등, `pnpm --filter frontend test -- docs` 2472 tests)는 이미 green — frontmatter 필드 존재·경로 실존·ko/en parity·결정성 있는 내부 SoT 패턴은 재검증하지 않고, **가드가 커버하지 않는 영역**(글로서리 문체·본문 정확성·IA tree 서술 정합)에 집중했다.

---

## 발견사항

### [WARNING] 신규 IA tree row 위치가 실제 `order:` 값과 불일치

- target 위치: `spec/2-navigation/13-user-guide.md` §2 IA tree — `05-run-and-debug/validation-errors` 행(67번 라인 부근), `06-integrations-and-config/web-chat-sdk` 행(79번 라인 부근)
- 위반 규약: 동일 문서 §5 "섹션 순서" — "페이지 내 순서는 `order`로 결정한다" + §2 "아래 트리는 canonical(...) 페이지를 나타낸다"(canonical 페이지 나열이 실제 표시 순서를 반영한다는 전제)
- 상세:
  - `05-run-and-debug/validation-errors.mdx`의 실제 frontmatter는 `order: 5`, `version-history.mdx`는 `order: 4`. 즉 실제 사이드바 렌더 순서는 `running-a-workflow(1) → run-results(2) → error-handling(3) → version-history(4) → validation-errors(5)`이다. 그런데 이번에 추가된 IA tree 행은 `validation-errors`를 `error-handling`과 `version-history` **사이**에 배치해, 실제 렌더 순서와 반대다.
  - `06-integrations-and-config/web-chat-sdk.mdx`의 실제 frontmatter는 `order: 12`(section 내 최대값 — `makeshop`=10, `agent-memory`=11 이후). 그런데 IA tree 행은 `web-chat`과 `makeshop` 사이에 배치해, 실제로는 섹션 맨 끝에 렌더되는 페이지를 중간처럼 서술한다.
  - 두 케이스 모두 "토픽 근접성(관련 개념끼리 묶어 보여주기)"으로 배치를 정한 것으로 보이나, §5 규약상 트리가 실제 표시 순서의 근사 표현이라는 전제를 깨 spec 독자에게 잘못된 사이드바 순서를 전달한다.
- 제안: 두 행을 실제 `order:` 값에 맞게 재배치하거나(`validation-errors`를 `version-history` 뒤로, `web-chat-sdk`를 `agent-memory` 뒤로), 반대로 실제 UX 상 지금 위치(토픽 근접)가 더 낫다고 판단되면 해당 `.mdx` frontmatter의 `order:` 값을 그 위치에 맞게 재부여한다(이 경우 `codebase/frontend` 변경이 필요하므로 별도 developer 작업). 문서만 고치는 최소 수정은 전자.

### [WARNING] 글로서리 금지어 "엣지"가 `summary` 프론트매터(사용자 가시 필드)에 노출

- target 위치: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx` frontmatter `summary:` (6번 라인)
- 위반 규약: `codebase/frontend/src/content/docs/_glossary.md` §5 금지어·지양어 표 — `"엣지" → "연결선"`. `spec/2-navigation/13-user-guide.md §4`는 `summary`를 "사이드바 미리보기 및 OG 설명"으로 정의해 사용자 가시 텍스트로 규정한다(`spec:`/`code:` 같은 빌드 전용 metadata와 다름).
- 상세: `summary: "...연결 유효성 규칙·엣지 색상·순환 경고를 정리해요."`에 "엣지"가 그대로 남아 있다. 같은 페이지 본문(예: "## 연결선 읽기" 절, "연결선은 시작 포트의 종류에 따라 색이 달라서...")은 일관되게 "연결선"을 쓰고 있어 `summary`만 예외적으로 어긋난다. 이 필드는 자동 글로서리 가드(`no-internal-refs.test.ts`)의 검증 대상이 아니라(§6 자동 가드 요약 표 — 글로서리·문체는 "manual / reviewer") 빌드에서 걸러지지 않는다.
- 제안: `summary`를 "...연결 유효성 규칙·연결선 색상·순환 경고를 정리해요." 등으로 수정. `summary_en`은 영문이라 대상 아님.

### [WARNING] 워크플로우 에디터 "영역" 개수 서술 불일치 (4 vs 5)

- target 위치: `spec/2-navigation/13-user-guide.md §2` IA tree — `overview` 행 주석 "`# 워크플로우 에디터 개요 (4영역 · 진입/이탈 · 저장 모델 · 서브페이지 인덱스)`" (49번 라인). 연관: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx` "## 팁 & 참고" 절("...4개 작업 영역이 궁금하다면...", 88번 라인) 및 `connecting-nodes.en.mdx`(77번 라인, "four work areas").
- 위반 규약: 명시적 "정식 규약" 조항은 아니나, spec IA tree 주석이 실제 가이드 페이지 내용을 정확히 요약해야 한다는 문서 정확성 기대(§2 "canonical 페이지를 나타낸다") 및 §7 "랜딩 → 상세" 구조에서 랜딩 페이지가 스스로 선언한 구조와 다른 곳에서 다르게 서술되는 내부 불일치.
- 상세: 실제 `03-workflow-editor/overview.mdx`는 "## 에디터의 **다섯** 영역" 이라는 헤딩 아래 Header·노드 팔레트·캔버스·설정 패널/AI 어시스턴트 패널·Run Results 드로어 **5개** 항목을 나열한다(`overview.en.mdx`도 "The editor's **five** regions"). 그런데 (a) 이번에 갱신된 spec IA tree 주석은 "4영역"이라 적고, (b) 같은 커밋에서 신설된 `connecting-nodes.mdx`/`.en.mdx`는 "4개 작업 영역"/"four work areas"로 교차 참조한다. 세 곳 중 두 곳이 "4", overview 본문 자신은 "5"로 서로 다른 숫자를 말해 독자에게 혼란을 준다.
- 제안: 실제 영역 수(5)를 기준으로 spec IA 주석과 `connecting-nodes.{mdx,en.mdx}` 교차 참조 문구를 "5영역"/"five work areas"로 통일하거나, 반대로 "설정 패널 / AI 어시스턴트 패널"을 한 슬롯으로 묶어 개념적으로 4개라 정의할 생각이면 overview.mdx 헤딩 자체를 "네 영역"으로 낮추고 나머지도 맞춘다. 어느 쪽이든 3곳을 한 번에 동기화해야 한다.

### [INFO] `ai-assistant-walkthrough.mdx` 마지막 섹션 헤딩이 관례("팁 & 참고")와 다름

- target 위치: `codebase/frontend/src/content/docs/03-workflow-editor/ai-assistant-walkthrough.mdx` 155번 라인 "## 다음으로" (및 `.en.mdx`의 대응 섹션)
- 위반 규약: `spec/2-navigation/13-user-guide.md §7` "각 페이지 랜딩 → 상세 → 팁/참고 3층 구조" — 본 섹션 내 다른 9개 신규 페이지는 모두 마지막 섹션을 "## 팁 & 참고"로 통일했다.
- 상세: 내용상으로는 관련 페이지로 안내하는 포인터 목록이라 "팁/참고" 레이어의 역할을 하고 있어 구조 자체는 위반이 아니지만, 헤딩 라벨만 유일하게 다르다(walkthrough 특성상 "다음으로"가 더 자연스럽다는 의도적 선택일 수 있음).
- 제안: 의도된 예외라면 넘어가도 무방. 일관성을 원하면 "## 팁 & 참고"로 맞추거나, `user-guide-writer` 체크리스트에 "walkthrough류 페이지는 다음으로 허용" 예외를 명시.

### [INFO] (참고용, diff 범위 밖) `06-integrations-and-config` 섹션의 기존 `order` 드리프트

- target 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.mdx`(`order: 5`) · `cafe24.mdx`(`order: 5`, 중복) — 두 파일 모두 이번 diff에서 `order` 필드가 바뀌지 않았고(내용만 일부 수정) `spec/2-navigation/13-user-guide.md`의 `telegram`(6)·`slack`(7)·`discord`(8) IA 순서도 실제 `order` 값과 반대다.
- 위반 규약: 위 WARNING 항목과 동일 성격(§5) — 다만 이번 리뷰의 diff(스펙 두 행 추가 + 3-workflow-editor 신규 페이지)가 만든 문제는 아니라 별도 사전 존재 이슈.
- 상세: `registry.ts`의 정렬은 `pages.sort((a,b) => a.frontmatter.order - b.frontmatter.order)`로 2차 정렬 키가 없어(`codebase/frontend/src/lib/docs/registry.ts:232`), `order` 값이 같은 `mcp-servers`/`cafe24`는 JS stable sort 특성상 파일 열거 순서에 좌우되는 암묵적 동작에 의존한다.
- 제안: 이번 PR 범위는 아니므로 후속 정리 과제로 별도 티켓/plan에서 처리 권장. 같은 섹션을 편집하는 김에 함께 고치면 좋지만 필수는 아님.

---

## 요약

이번 변경은 기존에 이미 구현·배포된 `validation-errors`·`web-chat-sdk` 페이지를 spec IA tree에 뒤늦게 반영하고, 워크플로우 에디터 사용 가이드 8종(16파일)을 신설하는 문서 전용 변경이다. 프론트매터 스키마·en 로케일 sibling 규칙·Callout `type` enum·딥링크 canonical 형식·내부 링크 slug 실존·내부 SoT(spec/plan/anchor id) 비노출·해요체 등 자동 가드가 커버하는 항목은 전부 정확히 지켜졌다. 다만 자동 가드가 커버하지 않는 두 영역에서 실질적 정합성 문제를 발견했다 — (1) 새로 추가된 두 IA tree row의 배치가 실제 페이지 `order:` 값과 반대 순서라 spec이 실제 사이드바 표시 순서를 오도하고, (2) `_glossary.md` 금지어 "엣지"가 `connecting-nodes.mdx`의 사용자 가시 `summary` 필드에 남아 있으며, (3) 에디터 "영역" 개수가 overview 본문(5)과 spec IA 주석·교차 참조 문구(4) 사이에서 불일치한다. 세 건 모두 빌드를 깨뜨리지 않는 문서 정확성 이슈이므로 WARNING으로 분류했고, CRITICAL 급 규약 위반(빌드 invariant 파괴)은 발견되지 않았다.

## 위험도

LOW
