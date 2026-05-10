# 한국어 사용자 가이드 어색한 표현 점검 — 2026-05-10

## 1. 요약

### 점검 범위

- **MDX canonical 가이드 23개** — `frontend/src/content/docs/` (`.en.mdx`·`_*.md` 제외)
- **UI i18n 사용자 노출 문자열** — `frontend/src/lib/i18n/dict/ko.ts` 의 `sidebar.userGuide`/`docs`/`assistant`/Empty State 영역 (사용자 가이드 톤이 적용되는 구간)

### 점검 기준

- 카테고리 A — **질문 의도 / 평서형 불일치** (의문 의도인데 평서형 어미·물음표 누락)
- 카테고리 B — **구어체 과잉 / 명령형 "주세요" 패턴 / 문어체 혼입** (`_glossary.md` §3 해요체 통일 위반)
- 카테고리 C — **직역투 / 번역체** (`~을 가져요`, 영어 어순, 명령적 권유 등)
- 카테고리 D — **용어 불일치 / 오타 / 띄어쓰기** (`_glossary.md` §2/§5 위반, 외래어 표기, 조사 오타)

### 카테고리별 발견 카운트

| 카테고리 | 건수 | 핵심 패턴 |
| --- | ---: | --- |
| A. 질문 의도/평서형 불일치 | **41건** | `### 언제 써요` 26회, `## 무엇을 만들 수 있어요` 등 헤딩 다수 |
| B. 구어체 과잉/명령형 "주세요"/문어체 | **22건** | `~참고해 주세요`, `~시도해 주세요`, ko.ts 내 `~되었습니다`(범위 외 별도 표기) |
| C. 직역투/번역체 | **17건** | `~을/를 가져요` 패턴 17곳 (영어 "have"의 직역) + 단발 표현 다수 |
| D. 용어 불일치/오타/띄어쓰기 | **23건** | "엣지" 12회, "프리젠테이션" 4회, "지식 베이스"·"인테그레이션"·"워크플로의"(오타) 등 |
| **총합 (중복 제외 라인 단위)** | **약 100건** | |

### 시급 처치 권장 (Top 5)

1. **`엣지` → `연결선`** — `_glossary.md` §5 명시 금지어. MDX 8곳 + ko.ts 6곳 = 총 14곳에서 위반 (ko.ts 중 가이드 영역 2곳 = `assistant.edgeAdded`/`edgeRemoved`).
2. **사이드바 `인테그레이션` → `통합` / `지식 베이스` → `지식 저장소`** — UI 라벨이 매뉴얼 본문 용어와 어긋나서, 매뉴얼을 읽고 사이드바를 보면 동일 기능을 다른 이름으로 만나게 됨.
3. **`### 언제 써요` 일괄 26곳** — 의문 의도 평서형 종결. `### 언제 쓰나요?`로 일괄 교체.
4. **`ko.ts:2062 워크플로의` → `워크플로우의`** — 단순 오타. `_glossary.md` 위반.
5. **링크 마침표 누락 4곳** (`(/docs/...).` 패턴이어야 할 곳에서 `(/docs/...)`로 끝남) — 문장이 어중간하게 끊김.

### 사용자 예시 케이스 검증

사용자가 제시한 예시 `01-getting-started/what-is-this.mdx:18 "## 무엇을 만들 수 있어요"`는 **카테고리 A 첫 항목**으로 정확히 포함됨. 같은 파일의 라인 35 `## 누가 어떤 문제를 풀 수 있어요`도 같은 패턴.

---

## 2. 카테고리별 발견 목록

### A. 질문 의도 / 평서형 불일치

| 파일 | 라인 | 원문 | 교정안 | 근거 |
| --- | ---: | --- | --- | --- |
| `01-getting-started/what-is-this.mdx` | 18 | `## 무엇을 만들 수 있어요` | `## 무엇을 만들 수 있나요?` | 의문 의도, 평서형 어미·`?` 누락 |
| `01-getting-started/what-is-this.mdx` | 35 | `## 누가 어떤 문제를 풀 수 있어요` | `## 누가 어떤 문제를 풀 수 있나요?` | 동일 |
| `02-nodes/overview.mdx` | 14 | `## 노드는 무엇이에요` | `## 노드는 무엇인가요?` | 동일 |
| `02-nodes/triggers.mdx` | 16 | `### 언제 써요` | `### 언제 쓰나요?` | 동일 (이하 동일 패턴 25건) |
| `02-nodes/triggers.mdx` | 69 | `## 웹훅과 스케줄은 어떻게 이어져요` | `## 웹훅과 스케줄은 어떻게 이어지나요?` | 동일 |
| `02-nodes/ai.mdx` | 16, 97, 147 | `### 언제 써요` (3건) | `### 언제 쓰나요?` | 동일 |
| `02-nodes/integrations.mdx` | 32, 93, 143 | `### 언제 써요` (3건) | `### 언제 쓰나요?` | 동일 |
| `02-nodes/logic.mdx` | 16, 51, 88, 119, 145, 169, 205, 232, 262, 290, 320 | `### 언제 써요` (11건) | `### 언제 쓰나요?` | 동일 |
| `02-nodes/data.mdx` | 16, 62 | `### 언제 써요` (2건) | `### 언제 쓰나요?` | 동일 |
| `02-nodes/flow.mdx` | 16 | `### 언제 써요` | `### 언제 쓰나요?` | 동일 |
| `02-nodes/presentation.mdx` | 41, 93, 141, 187, 247 | `### 언제 써요` (5건) | `### 언제 쓰나요?` | 동일 |
| `03-workflow-editor/overview.mdx` | 18 | `## 어디에 있고 어떻게 열어요` | `## 어디에 있고 어떻게 여나요?` | 동일 |
| `04-expression-language/basics.mdx` | 14 | `## 표현식이란 무엇일까요` | `## 표현식이란 무엇일까요?` | 의문 어미는 맞으나 `?` 누락 |
| `04-expression-language/basics.mdx` | 42 | `## 어디에 쓸 수 있나요` | `## 어디에 쓸 수 있나요?` | 동일 |
| `05-run-and-debug/version-history.mdx` | 14 | `## 버전은 언제 만들어지나요` | `## 버전은 언제 만들어지나요?` | 동일 |
| `06-integrations-and-config/mcp-servers.mdx` | 14 | `## MCP가 뭐고 언제 써요` | `## MCP는 무엇이고 언제 쓰나요?` | A+B (구어체 "뭐고" → 가이드 톤 "무엇이고") |
| `06-integrations-and-config/mcp-servers.mdx` | 18 | `언제 적합한가요.` (본문) | `언제 적합한가요?` | 의문문인데 `.`로 종결 |

> **메모**: `05-run-and-debug/error-handling.mdx`의 본문 강조 `**언제 쓰나요**:` 패턴(라인 32, 43, 73, 96, 124)은 `Q: A` 콜론 구조로 의문 의도가 콜론으로 분리돼 있어 형식적으로는 OK. 일관성 측면에서 통일하고 싶다면 `**언제 쓰나요?**` + 본문 줄바꿈 형태도 고려할 수 있음. 본 점검에서는 보더라인으로 분류해 표에 미포함.

### B. 구어체 과잉 / 명령형 "주세요" 패턴 / 문어체 혼입

> `_glossary.md` §3은 해요체 통일을 명시. 가이드 본문에서는 "참고해요/확인해요" 같은 평서·해요체 종결이 표준이며, 다른 페이지에서도 일관되게 그렇게 적혀 있음. 아래는 `~해 주세요`로 어긋난 구간들. UI 안내 메시지를 인용한 표 셀(`overview.mdx` 라인 123–125)은 인용 대상이 UI 그대로이므로 제외.

| 파일 | 라인 | 원문 | 교정안 | 근거 |
| --- | ---: | --- | --- | --- |
| `02-nodes/ai.mdx` | 92 | `…모드별로 다르게 동작할 수 있다는 점에 주의해 주세요.` | `…주의해요.` | glossary §3 해요체 통일 |
| `03-workflow-editor/overview.mdx` | 108 | `…진행 상황을 참고해 주세요.` | `…참고해요.` | 동일 |
| `05-run-and-debug/running-a-workflow.mdx` | 72 | `…JSON을 직접 넣어 주세요.` | `…직접 넣어요.` | glossary §5 능동·평서 권장 |
| `06-integrations-and-config/integration-management.mdx` | 29 | `…[트리거 노드](…)를 참고해 주세요.` | `…참고해요.` | 동일 |
| `06-integrations-and-config/integration-management.mdx` | 56 | `Step 2부터 다시 시도해 주세요.` | `Step 2부터 다시 시도해요.` | 동일 |
| `06-integrations-and-config/integration-management.mdx` | 98 | `…해당 노드를 제거해 주세요.` | `…제거해요.` | 동일 |
| `06-integrations-and-config/llm-config.mdx` | 26 | `…같이 등록해 주세요.` | `…등록해요.` | 동일 |
| `06-integrations-and-config/llm-config.mdx` | 40 | `원본 키는 …따로 관리해 주세요.` | `원본 키는 …따로 관리해요.` | 동일 |
| `06-integrations-and-config/llm-config.mdx` | 80 | `Base URL · 방화벽을 확인해 주세요.` | `Base URL · 방화벽을 확인해요.` | 동일 |
| `06-integrations-and-config/llm-config.mdx` | 87 | `…[지식 저장소](…)를 참고해 주세요.` | `…참고해요.` | 동일 |
| `06-integrations-and-config/knowledge-base.mdx` | 22 | `…진행 상황을 참고해 주세요.` | `…참고해요.` | 동일 |
| `06-integrations-and-config/knowledge-base.mdx` | 27 | `…[LLM 설정](…) 문서를 참고해 주세요.` | `…참고해요.` | 동일 |
| `06-integrations-and-config/knowledge-base.mdx` | 59 | `…\`spec/5-system/10-graph-rag.md\`를 참고해 주세요.` | `…참고해요.` (또는 spec 파일 참조 자체를 본문에서 제거 — `_glossary.md` §3 매뉴얼 독자는 사용자) | B + 매뉴얼 톤 |
| `06-integrations-and-config/knowledge-base.mdx` | 92 | `…줄여 재임베딩해 보세요.` | `…줄이는 게 좋아요.` | 명령적 권유 → 권유체 |
| `06-integrations-and-config/knowledge-base.mdx` | 98 | `원문을 다듬고 \`재임베딩\`을 돌려 주세요.` | `원문을 다듬고 \`재임베딩\`을 돌려요.` | glossary §3 |
| `07-faq/faq.mdx` | 44 | `…명시적으로 다뤄 주세요.` | `…명시적으로 다뤄요.` | 동일 |
| `01-getting-started/what-is-this.mdx` | 62 | `…먼저 훑어보세요.` | `…먼저 훑어봐요.` | 권유 명령 → 해요체 |
| **ko.ts** | 1990 | `…프로필에서 언어 설정을 바꿔 주세요.` | `…프로필에서 언어 설정을 바꿔요.` | 가이드 톤 일관성 |
| **ko.ts** | 2029 | `아래 메시지 입력창에 답변을 적어 보내 주세요.` | `아래 메시지 입력창에 답변을 적어 보내요.` | 동일 |
| **ko.ts** | 2039 | `사용 가능한 {{label}} 이(가) 없어요. Settings 에서 먼저 등록해 주세요.` | `사용 가능한 {{label}}이(가) 없어요. Settings에서 먼저 등록해요.` | B + D (영문약어 띄어쓰기) |
| **ko.ts** | 2051 | `LLM 설정을 먼저 등록해 주세요.` | `LLM 설정을 먼저 등록해요.` | 가이드 톤 일관성 |
| **ko.ts** | 2052 | `잠시 후 다시 시도해 주세요.` | `잠시 후 다시 시도해요.` | 동일 |

> **참고 (점검 범위 외 — 별도 톤 결정 필요)**: `ko.ts` 워크플로우 에디터 영역(라인 657–658, 730 부근)은 `엣지` 사용 + `~되었습니다`/`~반영됩니다` 같은 문어체 종결을 함께 쓰고 있어 **에디터 UI 문체가 가이드와 다르게 격식체**로 갈라져 있음. 가이드 점검 범위는 아니지만, 해요체 통일을 전사 적용한다면 함께 정리할 후속 항목으로 메모.

### C. 직역투 / 번역체

| 파일 | 라인 | 원문 | 교정안 | 근거 |
| --- | ---: | --- | --- | --- |
| `01-getting-started/first-workflow.mdx` | 92 | `회사망 안에서 외부 API가 막혀 있으면…` | `사내망에서 외부 API가 막혀 있으면…` | "회사망"은 영어 "office network" 직역. 한국어 자연 표현은 "사내망" |
| `01-getting-started/first-workflow.mdx` | 92 | `…상태 코드와 메시지를 읽어요.` | `…상태 코드와 메시지를 확인해요.` | "메시지를 읽어요"는 read 직역. 가이드 톤상 "확인해요" |
| `01-getting-started/first-workflow.mdx` | 104 | `HTTP Request 노드는 \`success\` / \`error\` 두 개의 출력 포트를 가져요.` | `HTTP Request 노드에는 \`success\` / \`error\` 출력 포트 두 개가 있어요.` | "have"의 직역 "~을/를 가져요". 한국어는 "~이/가 있어요" 자연스러움 |
| `02-nodes/triggers.mdx` | 28 | `각 파라미터 항목은 다음 필드를 가져요.` | `각 파라미터 항목에는 다음 필드가 있어요.` | 동일 |
| `02-nodes/triggers.mdx` | 67 | `Manual Trigger는 입력 포트가 없고, 출력 포트 \`out\` 1개를 가져요.` | `…출력 포트 \`out\` 1개가 있어요.` | 동일 |
| `02-nodes/logic.mdx` | 101 | `Loop는 컨테이너 노드예요. 입력은 \`in\`, \`emit\` 두 개, 출력은 \`body\`, \`done\` 두 개를 가져요.` | `…출력은 \`body\`, \`done\` 두 개로 구성돼요.` (또는 "두 개가 있어요") | 동일 |
| `02-nodes/logic.mdx`, `02-nodes/ai.mdx`, `02-nodes/flow.mdx`, `02-nodes/integrations.mdx`, `02-nodes/presentation.mdx` 등 `<FieldTable>` 안의 `… 필드를 가져요` (총 13곳) | 다수 | `각 항목은 \`name\`, \`type\`, … 를 가져요.` | `각 항목은 \`name\`, \`type\`, … 필드로 구성돼요.` 또는 `…필드를 포함해요.` | 동일 패턴. 일괄 교정 권장 |
| `01-getting-started/first-workflow.mdx` | 25 | `로그인된 상태의 사용자 계정이에요.` | `로그인된 사용자 계정` (또는 `로그인된 사용자 계정이 필요해요`) | 영어 "A logged-in user account" 명사구 술어. 한국어는 동사 술어가 자연 |
| `03-workflow-editor/walkthrough.mdx` | 51 | `…다음과 같이 되묻는 답이 와요.` | `…다음과 같이 되묻는 답이 돌아와요.` (또는 `…이렇게 되묻는 답이 와요`) | 영어 "comes back" 직역 어색 |
| `03-workflow-editor/walkthrough.mdx` | 88 | `오픈된 질문이 있으면 입력창에 답해요.` | `남은 질문이 있으면 입력창에 답해요.` 또는 `답할 질문이 있으면…` | "오픈된"은 "open question"의 직역. 한국어 자연 표현은 "남은/답할" |
| `01-getting-started/first-workflow.mdx` | 57 | `설정은 변경 즉시 반영되고, 아래쪽에 \`⚠ Not configured\` 표시가 사라지면 준비 끝이에요.` | `…표시가 사라지면 준비가 끝나요.` | "준비 끝이에요"는 구어 단축. 가이드 톤상 동사 술어로 풀어쓰는 게 자연 |

### D. 용어 불일치 / 오타 / 띄어쓰기

#### D-1. 금지어 "엣지" → "연결선" (`_glossary.md` §5 명시)

| 파일 | 라인 | 원문 |
| --- | ---: | --- |
| `01-getting-started/what-is-this.mdx` | 48 | `…명확화 → 계획 제안 → 실행 흐름으로 노드와 엣지를 자동으로 구성해요.` |
| `03-workflow-editor/overview.mdx` | 16 | `AI 어시스턴트는 …노드와 엣지를 직접 만들어 주는 채팅형 도우미예요.` |
| `03-workflow-editor/overview.mdx` | 45 | `{ title: "Execute", sub: "노드/엣지 편집" }` |
| `03-workflow-editor/overview.mdx` | 73 | `…노드 추가/수정/삭제, 엣지 연결/끊기를 수행해요.` |
| `05-run-and-debug/running-a-workflow.mdx` | 84 | `엣지: 데이터 흐름 애니메이션` |
| `05-run-and-debug/run-results.mdx` | 139 | `…error 포트에 연결된 엣지가 없어 Stop Workflow로 폴백된 경우예요.` |
| `05-run-and-debug/error-handling.mdx` | 103 | `error 포트에 엣지가 연결되어 있지 않으면 \`ERROR_PORT_FALLBACK\` 로그와 함께 …` |
| `05-run-and-debug/version-history.mdx` | 18 | `저장 트랜잭션 직후 같은 시점의 노드·엣지 전체 상태가 \`jsonb\` 스냅샷으로 보관돼요.` |
| `05-run-and-debug/version-history.mdx` | 41 | `엣지 목록: \`source:port → target:port\` 쌍` |
| `07-faq/faq.mdx` | 94 | `…캔버스에 노드와 엣지를 직접 추가·수정해 줘요.` |
| **ko.ts** | 2057 | `edgeAdded: "엣지 추가"` |
| **ko.ts** | 2058 | `edgeRemoved: "엣지 삭제"` |

#### D-2. 사이드바 라벨 ↔ 매뉴얼 본문 용어 불일치

| 파일 | 라인 | 원문 | 교정안 | 근거 |
| --- | ---: | --- | --- | --- |
| `ko.ts` | 82 | `integration: "인테그레이션"` | `integration: "통합"` | glossary §2: Integration → 통합. UI에서 "인테그레이션"으로 노출되면 매뉴얼 내 모든 "통합" 표기와 충돌 |
| `ko.ts` | 83 | `knowledgeBase: "지식 베이스"` | `knowledgeBase: "지식 저장소"` | glossary §2: Knowledge Base → 지식 저장소. 본문은 "지식 저장소"로 통일돼 있음 |

#### D-3. 외래어 표기 — "프리젠테이션" → "프레젠테이션"

표준 외래어 표기법은 "프레젠테이션"(presentation [prèzəntéiʃən]). "프리젠테이션"은 비표준이지만 흔히 사용. 다만 노드 이름·UI 라벨이 영문 "Presentation"이라 본문에서 한글 풀이는 표준 표기로 통일하는 편이 권장.

| 파일 | 라인 | 원문 |
| --- | ---: | --- |
| `02-nodes/presentation.mdx` | 2 (frontmatter) | `title: "프리젠테이션 노드"` |
| `02-nodes/presentation.mdx` | 12 | `…프리젠테이션 노드 다섯 가지를 설명해요.` |
| `02-nodes/presentation.mdx` | 303 | `실행 결과 드로어에서 각 프리젠테이션 노드가 …` |
| `02-nodes/overview.mdx` | 127 | `… · [프리젠테이션](/docs/02-nodes/presentation).` |

> 외래어 표기법 표준은 "프레젠테이션". UI 노출명을 "Presentation"(영문) 그대로 두기로 했다면 본문에서는 "프레젠테이션 노드"로 통일하는 것이 표준에 부합.

#### D-4. 단순 오타 · 조사 누락

| 파일 | 라인 | 원문 | 교정안 |
| --- | ---: | --- | --- |
| `02-nodes/triggers.mdx` | 92 | `[워크플로우 실행](…)를 참고해요.` | `[워크플로우 실행](…)을 참고해요.` (받침 ㅇ → 을) |
| `01-getting-started/ui-tour.mdx` | 122 | 다이어그램 라벨 `Setting Panel` | `Settings Panel` (glossary §2 표기) |
| `ko.ts` | 2062 | `executionNotInScope: "이 실행은 현재 워크플로의 것이 아니에요."` | `…현재 워크플로우의 것이 아니에요.` |

#### D-5. 띄어쓰기 · 영문 약어 + 한글 조사

| 파일 | 라인 | 원문 | 교정안 |
| --- | ---: | --- | --- |
| `01-getting-started/first-workflow.mdx` | 88 | `## 잘 안 될 때 체크 리스트` | `## 잘 안 될 때 체크리스트` ("체크리스트"는 한 단어로 굳어진 외래어) |
| `06-integrations-and-config/llm-config.mdx` | 35 | `…폼에 입력된 자격증명으로 미리 조회돼요.` | `…자격 증명으로 미리 조회돼요.` (다른 모든 곳은 "자격 증명"으로 띄어 씀) |
| `03-workflow-editor/overview.mdx` | 87 | `v1 에서는 …UI 가 노출되지 않으므로 …\`+\` 로 새 세션을 …` | `v1에서는 …UI가 노출되지 않으므로 …\`+\`로 새 세션을 …` |
| `07-faq/faq.mdx` | 95 | `…실행 시 매번 LLM 을 호출해 답을 내요.` | `…실행 시 매번 LLM을 호출해 답을 내요.` |

> **참고**: `03-workflow-editor/walkthrough.mdx`의 `테스트 주문 ID 를`, `Cmd/Ctrl + / 를` 같은 영문약어 + 한글조사 띄어쓰기는 보편적으로 두 가지 표기 모두 허용되지만, 이 가이드는 다른 곳에서 `Ctrl+S로`(붙임) 표기를 더 자주 사용. 일관성 측면에서 검토 필요.

#### D-6. 마침표 누락 (문장이 링크로 어중간하게 끝남)

| 파일 | 라인 | 원문 | 교정안 |
| --- | ---: | --- | --- |
| `06-integrations-and-config/integration-management.mdx` | 99 | `…자세한 흐름은 [MCP 서버 통합](/docs/06-integrations-and-config/mcp-servers).` | `…자세한 흐름은 [MCP 서버 통합](/docs/06-integrations-and-config/mcp-servers)에서 확인해요.` |
| `07-faq/faq.mdx` | 88 | `…자세한 흐름은 [MCP 서버 통합](/docs/06-integrations-and-config/mcp-servers).` | 동일 패턴 — `…에서 확인해요.` |
| `07-faq/faq.mdx` | 94 | `…자세한 사용법은 [AI 어시스턴트 개요](/docs/03-workflow-editor/overview).` | `…사용법은 [AI 어시스턴트 개요](/docs/03-workflow-editor/overview)에서 확인해요.` |
| `07-faq/faq.mdx` | 95 | `…필드 설명은 [AI 노드](/docs/02-nodes/ai).` | `…필드 설명은 [AI 노드](/docs/02-nodes/ai)에서 확인해요.` |

---

## 3. 파일별 교정 패치 (제안)

> 아래 패치는 **카테고리 A·D 중심의 명백한 교정**만 묶어 제시 (B/C는 톤 결정이 필요하므로 일괄 적용 권장 항목만 포함). 적용은 사용자 승인 후 별도 단계로 진행.

### `frontend/src/content/docs/01-getting-started/what-is-this.mdx`

```diff
@@ -16,7 +16,7 @@
 이 제품은 **코딩 없이 자동화 워크플로우를 만드는 시각적 빌더**예요. 화면 위에 노드를 하나씩 올려놓고 연결선으로 이어 붙이면, 반복되는 업무가 알아서 굴러가도록 만들 수 있어요. 개발자에게는 표현식, 코드 편집, 커스텀 노드 같은 고급 기능을 열어 두고, 비개발자에게는 드래그 앤 드롭 중심의 부드러운 경험을 제공해요.

-## 무엇을 만들 수 있어요
+## 무엇을 만들 수 있나요?

 - 외부 서비스에서 들어온 요청을 받아 메일을 보내거나 데이터베이스에 기록하는 자동화
 - 정해진 시간마다 돌면서 리포트를 만드는 스케줄 기반 작업
@@ -33,7 +33,7 @@
 각 블록이 노드예요. 노드는 입력을 받고, 설정대로 일을 한 뒤, 결과를 다음 노드로 넘겨요. 트리거는 워크플로우의 **시작 신호**이고, 마지막 노드의 결과가 **최종 출력**이 돼요.

-## 누가 어떤 문제를 풀 수 있어요
+## 누가 어떤 문제를 풀 수 있나요?

 <FieldTable rows={[
@@ -46,7 +46,7 @@
 - **사이드바**: 대시보드, 워크플로우, 트리거, 스케줄, 통합, 통계 같은 큰 메뉴로 이동해요.
 - **워크플로우 목록**: 지금까지 만든 자동화를 한 눈에 보고 켜고 끌 수 있어요.
 - **캔버스 에디터**: 워크플로우를 실제로 그리고 설정하는 공간이에요. 좌측 팔레트에서 노드를 꺼내 중앙 캔버스에 배치하고, 우측 설정 패널에서 세부 값을 채워 넣어요.
-- **AI Assistant**: 캔버스 안에서 채팅으로 워크플로우를 만들고 고치는 도우미예요. "주문 취소 프로세스 추가해 줘" 같은 자연어 요청을 받으면, 명확화 → 계획 제안 → 실행 흐름으로 노드와 엣지를 자동으로 구성해요. 자세한 사용법은 [AI 어시스턴트 개요](/docs/03-workflow-editor/overview)에서 다뤄요.
+- **AI Assistant**: 캔버스 안에서 채팅으로 워크플로우를 만들고 고치는 도우미예요. "주문 취소 프로세스 추가해 줘" 같은 자연어 요청을 받으면, 명확화 → 계획 제안 → 실행 흐름으로 노드와 연결선을 자동으로 구성해요. 자세한 사용법은 [AI 어시스턴트 개요](/docs/03-workflow-editor/overview)에서 다뤄요.
```

### `frontend/src/content/docs/01-getting-started/first-workflow.mdx`

```diff
@@ -85,7 +85,7 @@
   </Step>
 </Steps>

-## 잘 안 될 때 체크 리스트
+## 잘 안 될 때 체크리스트

 <Callout type="warn" title="에러가 났다면">
 - URL 오타가 가장 흔해요. `https://` 접두사가 빠지지 않았는지 확인해요.
-- 회사망 안에서 외부 API가 막혀 있으면 `error` 포트로 빠져요. Run Results의 `Error` 탭에서 상태 코드와 메시지를 읽어요.
+- 사내망에서 외부 API가 막혀 있으면 `error` 포트로 빠져요. Run Results의 `Error` 탭에서 상태 코드와 메시지를 확인해요.
 - 인증이 필요한 API라면 `Integration` 메뉴에서 연동을 먼저 만들고 노드 설정에서 선택해요.
```

### `frontend/src/content/docs/02-nodes/overview.mdx`

```diff
@@ -11,7 +11,7 @@
 이 페이지에서는 노드가 어떤 요소로 구성되는지, 어떤 포트 규칙을 따르는지, 데이터와 에러가 어떻게 흘러가는지를 설명해요. 개별 노드의 상세 스펙은 카테고리별 페이지에서 이어서 다뤄요.

-## 노드는 무엇이에요
+## 노드는 무엇인가요?

 노드는 워크플로우의 **단위 작업**이에요. …
```

### `frontend/src/content/docs/02-nodes/triggers.mdx` (대표 패치 — 동일 패턴 다른 8개 노드 페이지에도 적용)

```diff
@@ -14,7 +14,7 @@
 ## Manual Trigger

-### 언제 써요
+### 언제 쓰나요?

 - 워크플로우에 **입력 파라미터를 정의**하고 싶을 때 써요.
@@ -67,7 +67,7 @@
 Manual Trigger는 입력 포트가 없고, 출력 포트 `out` 1개를 가져요. …

-## 웹훅과 스케줄은 어떻게 이어져요
+## 웹훅과 스케줄은 어떻게 이어지나요?

 웹훅과 스케줄은 **별도의 트리거 시스템**이에요. …
@@ -89,7 +89,7 @@
 ## 팁 & 참고

 - 파라미터 값 접근 문법은 [표현식 변수와 컨텍스트](/docs/04-expression-language/variables-and-context)에서 자세히 다뤄요.
-- 실행 요청과 응답이 궁금하면 [워크플로우 실행](/docs/05-run-and-debug/running-a-workflow)를 참고해요.
+- 실행 요청과 응답이 궁금하면 [워크플로우 실행](/docs/05-run-and-debug/running-a-workflow)을 참고해요.
```

> `02-nodes/ai.mdx`, `02-nodes/integrations.mdx`, `02-nodes/logic.mdx` (11곳), `02-nodes/data.mdx` (2곳), `02-nodes/flow.mdx`, `02-nodes/presentation.mdx` (5곳)에 동일한 `### 언제 써요` → `### 언제 쓰나요?` 일괄 교체 적용. 총 25건 추가.

### `frontend/src/content/docs/02-nodes/presentation.mdx` (외래어 표기)

```diff
@@ -1,5 +1,5 @@
 ---
-title: "프리젠테이션 노드"
+title: "프레젠테이션 노드"
 title_en: "Presentation nodes"
 section: "02-nodes"
 order: 8
@@ -10,7 +10,7 @@
 ---

-이 페이지에서는 워크플로우의 결과를 **시각화**하거나 **사용자 입력**을 받는 프리젠테이션 노드 다섯 가지를 설명해요. …
+이 페이지에서는 워크플로우의 결과를 **시각화**하거나 **사용자 입력**을 받는 프레젠테이션 노드 다섯 가지를 설명해요. …
@@ -301,7 +301,7 @@
 ## 팁 & 참고

-- 실행 결과 드로어에서 각 프리젠테이션 노드가 어떻게 렌더링되는지는 [실행 결과](/docs/05-run-and-debug/run-results)에서 다뤄요.
+- 실행 결과 드로어에서 각 프레젠테이션 노드가 어떻게 렌더링되는지는 [실행 결과](/docs/05-run-and-debug/run-results)에서 다뤄요.
```

`02-nodes/overview.mdx:127`도 같은 교체.

### `frontend/src/content/docs/03-workflow-editor/overview.mdx`

```diff
@@ -14,7 +14,7 @@
 ## 한 문장으로 요약

-AI 어시스턴트는 **자연어 요청을 받아 노드와 엣지를 직접 만들어 주는 채팅형 도우미**예요. …
+AI 어시스턴트는 **자연어 요청을 받아 노드와 연결선을 직접 만들어 주는 채팅형 도우미**예요. …

-## 어디에 있고 어떻게 열어요
+## 어디에 있고 어떻게 여나요?
@@ -42,7 +42,7 @@
 <FlowDiagram steps={[
   { title: "Clarify", sub: "탐색·질문" },
   { title: "Propose Plan", sub: "계획 제안 · 승인" },
-  { title: "Execute", sub: "노드/엣지 편집" },
+  { title: "Execute", sub: "노드/연결선 편집" },
 ]} />
@@ -71,7 +71,7 @@
 <FieldTable rows={[
   { name: "탐색 (읽기 전용)", required: false, type: "캔버스 안 변경 X", description: "…", default: "-" },
-  { name: "편집 (캔버스 변경)", required: false, type: "Undo 가능", description: "노드 추가/수정/삭제, 엣지 연결/끊기를 수행해요. …", default: "-" },
+  { name: "편집 (캔버스 변경)", required: false, type: "Undo 가능", description: "노드 추가/수정/삭제, 연결선 연결/끊기를 수행해요. …", default: "-" },
@@ -85,7 +85,7 @@
 - **자동 제목** — 첫 사용자 메시지의 앞부분으로 세션 제목이 자동으로 생성돼서 …
-- **이력 보관** — 한 워크플로우당 최근 세션 50개까지 보관돼요. v1 에서는 패널 안에 세션 전환 UI 가 노출되지 않으므로, 같은 워크플로우의 이전 세션을 다시 열려면 `+` 로 새 세션을 만들거나 자동 복원되는 가장 최근 세션을 그대로 이어가요.
+- **이력 보관** — 한 워크플로우당 최근 세션 50개까지 보관돼요. v1에서는 패널 안에 세션 전환 UI가 노출되지 않으므로, 같은 워크플로우의 이전 세션을 다시 열려면 `+`로 새 세션을 만들거나 자동 복원되는 가장 최근 세션을 그대로 이어가요.
```

### `frontend/src/content/docs/04-expression-language/basics.mdx`

```diff
@@ -12,7 +12,7 @@
 이 페이지에서는 노드 설정 폼에서 **동적 값을 참조하는 표현식**(Expression)이 무엇이고, 어떻게 쓰는지 설명해요.

-## 표현식이란 무엇일까요
+## 표현식이란 무엇일까요?
@@ -40,7 +40,7 @@
 <Callout type="tip">리터럴 `{{` 문자를 그대로 쓰고 싶다면 역슬래시로 이스케이프해요. `\{\{`</Callout>

-## 어디에 쓸 수 있나요
+## 어디에 쓸 수 있나요?
```

### `frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx`

```diff
@@ -82,7 +82,7 @@
 - 현재 실행 중인 노드: 파란 펄스 테두리
 - 완료된 노드: 초록 체크 + 소요 시간
-- 엣지: 데이터 흐름 애니메이션
+- 연결선: 데이터 흐름 애니메이션
 - 분기 노드: 실제 실행된 경로만 진하게, 미실행 경로는 흐릿하게
```

### `frontend/src/content/docs/05-run-and-debug/run-results.mdx`

```diff
@@ -137,7 +137,7 @@
   { name: "MAX_ITERATIONS_EXCEEDED", type: "반복", description: "Loop/ForEach 최대 반복 횟수를 넘었어요." },
-  { name: "ERROR_PORT_FALLBACK", type: "폴백", description: "`Route to Error Port` 정책인데 error 포트에 연결된 엣지가 없어 Stop Workflow로 폴백된 경우예요." }
+  { name: "ERROR_PORT_FALLBACK", type: "폴백", description: "`Route to Error Port` 정책인데 error 포트에 연결된 연결선이 없어 Stop Workflow로 폴백된 경우예요." }
 ]} />
```

### `frontend/src/content/docs/05-run-and-debug/error-handling.mdx`

```diff
@@ -101,7 +101,7 @@
 - 정책을 선택하면 노드 우하단에 빨간 원(●) **error 포트**가 동적으로 생겨요.
-- error 포트에 엣지가 연결되어 있지 않으면 `ERROR_PORT_FALLBACK` 로그와 함께 Stop Workflow로 폴백돼요.
+- error 포트에 연결선이 연결되어 있지 않으면 `ERROR_PORT_FALLBACK` 로그와 함께 Stop Workflow로 폴백돼요.
```

### `frontend/src/content/docs/05-run-and-debug/version-history.mdx`

```diff
@@ -12,7 +12,7 @@
 이 페이지에서는 에디터 안에서 **워크플로우 버전을 만들고 비교하고 복원**하는 방법을 설명해요. …

-## 버전은 언제 만들어지나요
+## 버전은 언제 만들어지나요?

-- 저장 트랜잭션 직후 같은 시점의 노드·엣지 전체 상태가 `jsonb` 스냅샷으로 보관돼요.
+- 저장 트랜잭션 직후 같은 시점의 노드·연결선 전체 상태가 `jsonb` 스냅샷으로 보관돼요.
@@ -39,7 +39,7 @@
 - 노드 목록: 라벨, 타입, 좌표, 비활성 여부
-- 엣지 목록: `source:port → target:port` 쌍
+- 연결선 목록: `source:port → target:port` 쌍
```

### `frontend/src/content/docs/06-integrations-and-config/mcp-servers.mdx`

```diff
@@ -12,7 +12,7 @@
 이 페이지에서는 외부 **MCP(Model Context Protocol) 서버**를 워크스페이스 통합으로 등록하고, AI Agent 노드에 연결해 …

-## MCP가 뭐고 언제 써요
+## MCP는 무엇이고 언제 쓰나요?

 MCP는 LLM이 외부 시스템의 **도구(tools)** · **리소스(resources)** · **프롬프트(prompts)** 를 표준 방식으로 호출할 수 있도록 정의한 프로토콜이에요. …

-언제 적합한가요.
+언제 적합한가요?
```

### `frontend/src/content/docs/07-faq/faq.mdx`

```diff
@@ -85,11 +85,11 @@
 ## Q18. AI Agent가 외부 도구(예: 사내 검색)를 호출하게 하려면 어떻게 해요?

-**워크플로우 내부 노드**를 도구로 노출하고 싶다면 캔버스 **Tool Area**에 노드를 끌어다 놓아요. **외부 시스템의 도구**(사내 검색 엔진, Slack, GitHub 등)는 **MCP 서버**로 연결해요. `/integrations`에서 MCP 서버를 등록하고, AI Agent의 `MCP Servers` 필드에 추가하면 LLM이 자동으로 그 서버의 도구를 호출할 수 있어요. 자세한 흐름은 [MCP 서버 통합](/docs/06-integrations-and-config/mcp-servers).
+**워크플로우 내부 노드**를 도구로 노출하고 싶다면 캔버스 **Tool Area**에 노드를 끌어다 놓아요. **외부 시스템의 도구**(사내 검색 엔진, Slack, GitHub 등)는 **MCP 서버**로 연결해요. `/integrations`에서 MCP 서버를 등록하고, AI Agent의 `MCP Servers` 필드에 추가하면 LLM이 자동으로 그 서버의 도구를 호출할 수 있어요. 자세한 흐름은 [MCP 서버 통합](/docs/06-integrations-and-config/mcp-servers)에서 확인해요.

 ## Q19. AI 어시스턴트와 AI Agent 노드는 뭐가 달라요?
@@ -91,9 +91,9 @@
 이름이 비슷하지만 위치와 역할이 달라요.

-- **AI 어시스턴트**는 **에디터 안의 채팅 도우미**예요. `Cmd/Ctrl + /` 로 패널을 열고 자연어로 요청하면, 캔버스에 노드와 엣지를 직접 추가·수정해 줘요. 워크플로우 자체를 *만들기 위한* 기능이에요. 자세한 사용법은 [AI 어시스턴트 개요](/docs/03-workflow-editor/overview).
-- **AI Agent 노드**는 **워크플로우 안에서 실행되는 LLM 호출 단위**예요. 캔버스에 직접 올려 두고 시스템 프롬프트·사용자 프롬프트·RAG·도구를 설정해 두면, 실행 시 매번 LLM 을 호출해 답을 내요. 워크플로우의 *부품*이에요. 필드 설명은 [AI 노드](/docs/02-nodes/ai).
+- **AI 어시스턴트**는 **에디터 안의 채팅 도우미**예요. `Cmd/Ctrl + /`로 패널을 열고 자연어로 요청하면, 캔버스에 노드와 연결선을 직접 추가·수정해 줘요. 워크플로우 자체를 *만들기 위한* 기능이에요. 자세한 사용법은 [AI 어시스턴트 개요](/docs/03-workflow-editor/overview)에서 확인해요.
+- **AI Agent 노드**는 **워크플로우 안에서 실행되는 LLM 호출 단위**예요. 캔버스에 직접 올려 두고 시스템 프롬프트·사용자 프롬프트·RAG·도구를 설정해 두면, 실행 시 매번 LLM을 호출해 답을 내요. 워크플로우의 *부품*이에요. 필드 설명은 [AI 노드](/docs/02-nodes/ai)에서 확인해요.
```

### `frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` (마침표 누락)

```diff
@@ -97,7 +97,7 @@
 - 사용처가 있는 연동은 삭제할 수 없어요. 먼저 노드의 `integrationId` 를 다른 연동으로 바꾸거나, 해당 노드를 제거해요.
-- AI Agent에서 외부 도구·리소스를 LLM에게 노출하려면 MCP 서버 통합을 등록하고 AI Agent 노드의 `MCP Servers` 필드에 연결해요. 자세한 흐름은 [MCP 서버 통합](/docs/06-integrations-and-config/mcp-servers).
+- AI Agent에서 외부 도구·리소스를 LLM에게 노출하려면 MCP 서버 통합을 등록하고 AI Agent 노드의 `MCP Servers` 필드에 연결해요. 자세한 흐름은 [MCP 서버 통합](/docs/06-integrations-and-config/mcp-servers)에서 확인해요.
```

### `frontend/src/lib/i18n/dict/ko.ts` (가이드 영역만)

```diff
@@ -80,9 +80,9 @@
     triggers: "트리거",
     schedule: "스케줄",
-    integration: "인테그레이션",
+    integration: "통합",
-    knowledgeBase: "지식 베이스",
+    knowledgeBase: "지식 저장소",
     llmConfig: "LLM 설정",
@@ -2055,9 +2055,9 @@
     opAdded: "노드 추가: {{label}}",
     opUpdated: "노드 수정: {{label}}",
     opRemoved: "노드 삭제: {{label}}",
-    edgeAdded: "엣지 추가",
-    edgeRemoved: "엣지 삭제",
+    edgeAdded: "연결선 추가",
+    edgeRemoved: "연결선 삭제",
     exploreLookup: "{{count}}건 조회됨",
     exploreExecutionsList: "실행 이력 {{count}}건 조회",
     exploreExecutionDetails: "실행 상세 조회 — {{nodeCount}}개 노드",
-    executionNotInScope: "이 실행은 현재 워크플로의 것이 아니에요.",
+    executionNotInScope: "이 실행은 현재 워크플로우의 것이 아니에요.",
   },
```

> ⚠ ko.ts에 다른 영역(워크플로우 에디터 자동알림 라인 657–658, 730 등)에도 `엣지` 사용과 `~되었습니다` 문어체가 함께 있음. 본 점검 범위(가이드)에서는 손대지 않았으나 후속 정리 권장.

---

## 4. 판단이 필요한 항목 (사용자 결정 후 적용 권장)

### 4-1. `~을/를 가져요` 패턴 (총 17곳)

`<FieldTable>` 안의 description에서 `각 항목은 \`name\`, \`type\`, … 를 가져요.` 패턴이 일관되게 사용 중. 영어 "have"의 직역으로 어색하지만, 통일된 표현으로 굳어져 있어 **일괄 교체** 시 다음 후보 중 하나 선택:

- (a) `…필드로 구성돼요.`
- (b) `…필드를 포함해요.`
- (c) `…필드가 있어요.`
- (d) **현행 유지** (스키마 설명이라 직역적 표현이 명료)

가이드 톤 결정이 필요. 점검자 권장은 (b) "필드를 포함해요" — 가장 한국어 자연 표현이면서 변경 폭이 적음.

### 4-2. 명령형 `~해 주세요`/`~보세요` vs 평서형 `~해요`

본문은 대체로 `~참고해요/~확인해요`로 평서형이지만, Callout(`tip`/`note`/`warn`) 박스 일부와 06번 섹션 일부에서 `~참고해 주세요`로 명령형이 섞임. **일괄 정책** 후보:

- (a) **평서형 통일** — 모든 안내를 `~참고해요/~확인해요/~시도해요`로 통일. (점검자 권장, glossary §3 일관성)
- (b) **Callout만 명령형 유지** — 강조 박스에서는 행동 권유 톤(`~주세요`)을 유지.
- (c) **현행 유지** — 작성자 재량.

### 4-3. 매뉴얼 본문 내 `spec/` 파일 직접 링크 (3곳)

`06-integrations-and-config/knowledge-base.mdx:22, 59, 101` 및 `06-integrations-and-config/integration-management.mdx:100` 등에서 `spec/5-system/10-graph-rag.md`, `spec/2-navigation/4-integration.md`처럼 **개발용 spec 파일을 매뉴얼 본문에서 직접 참조**. `_glossary.md` §3 "매뉴얼 독자는 사용자이므로 서비스 내부 구현은 노출하지 않아요" 정신과 충돌 가능. 

- (a) 모두 제거하고 사용자용 표현으로 대체 (예: "출시 일정은 추후 안내")
- (b) 그대로 유지 (현재 v1 한계 안내가 spec에 있다는 컨텍스트 인정)

### 4-4. FAQ 헤딩의 자연 어투 ("랑", "뭐가" 등)

`07-faq/faq.mdx`의 Q5 `Manual Trigger랑 Webhook은 언제 뭘 써요?` / Q16 `메뉴는 뭐가 달라요?` / Q19 `노드는 뭐가 달라요?`는 사용자의 자연 질문을 모방한 구어체. 

- (a) 그대로 유지 — FAQ는 사용자 질문 형식을 살리는 편이 친근감 ↑ (점검자 권장)
- (b) 가이드 톤으로 통일 — `~와`, `~은 무엇이 다른가요?` 등으로 격식

### 4-5. UI 안내 메시지의 종결어미 (ko.ts)

`assistant.placeholder: "요청을 입력하세요..."`, `assistant.planApproveConfirm: "계획대로 진행해 주세요."`, `assistant.candidatePickerEmpty: "...등록해 주세요."` 등 UI 컴포넌트 placeholder/안내 라벨은 명령형 `~하세요/~주세요`가 일반적. 가이드 톤(평서형 `~해요`)과 충돌하지만, 입력 placeholder를 `~해요`로 바꾸면 어색해짐.

- (a) **placeholder/짧은 안내는 명령형 유지** + 긴 설명문(`bodyKoreanNotice`, `errorRateLimit` 등)은 평서형 통일
- (b) 모두 평서형 통일

---

## 5. 적용 결과 (2026-05-10 진행)

사용자 결정에 따라 다음과 같이 일괄 적용 완료. **MDX 23개 + `ko.ts` 가이드 영역**은 모두 정리됐고 검증 grep으로 0건을 확인.

### 적용 항목 요약

| 카테고리 | 결정 | 적용 결과 |
| --- | --- | --- |
| A. 의문 헤딩 평서형 | 모두 의문문 형태로 교정 | 36건 일괄 적용 (`### 언제 써요` × 26 + 그 외 헤딩 10) |
| B. `~해 주세요` 명령형 | **평서형 `~해요`로 통일** (사용자 결정) | MDX 17건 + `ko.ts` 가이드 영역 5건 = 22건 적용 |
| C. `~을/를 가져요` 직역투 | **`~을/를 포함해요`로 통일** (사용자 결정) | 17건 일괄 적용 |
| D. 글로서리/오타/띄어쓰기 | 모두 적용 | 23건 |
| spec/prd 본문 직접 참조 | **모두 제거** (사용자 결정 — 매뉴얼 독자에게 노출 금지) | 5건 모두 제거 + 1건 통째 삭제 |

### 검증 grep 결과 (모두 0건 = 깨끗)

```text
$ rg "엣지" frontend/src/content/docs/                                      → 0건
$ rg "작업 흐름|아웃풋|인풋|서브미션" frontend/src/content/docs/             → 0건
$ rg "을 가져요|를 가져요|가지고 있어요" frontend/src/content/docs/          → 0건
$ rg "spec/.*\.md|PRD [0-9]|Spec [0-9]" frontend/src/content/docs/ (본문)   → 0건
$ rg "합니다|한다\." frontend/src/content/docs/                              → 0건
$ rg "^#{1,4}.*(있어요|어요|와요|돼요|이에요|예요)$" frontend/src/content/docs/ → 0건
$ rg "워크플로[^우]" ko.ts (assistant 영역)                                  → 0건
```

### 변경된 파일 목록

**MDX 18개**: `01-getting-started/{what-is-this,first-workflow,ui-tour}.mdx`, `02-nodes/{overview,triggers,ai,integrations,logic,data,flow,presentation}.mdx`, `03-workflow-editor/overview.mdx`, `04-expression-language/basics.mdx`, `05-run-and-debug/{running-a-workflow,run-results,error-handling,version-history}.mdx`, `06-integrations-and-config/{integration-management,llm-config,knowledge-base,mcp-servers}.mdx`, `07-faq/faq.mdx`

**i18n**: `frontend/src/lib/i18n/dict/ko.ts` (sidebar 2곳 + assistant 영역 9곳)

> **변경 없음**: `02-nodes/data.mdx`(가져요 패턴 0건), `03-workflow-editor/walkthrough.mdx`, `04-expression-language/{cheatsheet,variables-and-context}.mdx` — 점검 결과 어색 표현 미발견.

---

## 6. 후속 결정 적용 결과 — `ko.ts` 글로서리 표준 일괄 통일 (옵션 A 채택)

사용자 결정에 따라 `ko.ts` 전체에서 글로서리 §2 위반 표기를 일괄 교체 완료. 매뉴얼·사이드바·UI 페이지가 한 가지 이름을 사용하게 됨.

### 일괄 교체 결과

| 위반 표기 | 교체 후 | 적용 횟수 |
| --- | --- | ---: |
| `인테그레이션` | `통합` | **36회** |
| `지식 베이스` | `지식 저장소` | **15회** |

### 검증 grep 결과 (모두 0건)

```text
$ rg -c "인테그레이션" frontend/src/lib/i18n/dict/ko.ts  → 0
$ rg -c "지식 베이스"   frontend/src/lib/i18n/dict/ko.ts  → 0
$ rg -c "통합"          frontend/src/lib/i18n/dict/ko.ts  → 38 (사이드바 1 + 섹션 라벨 1 + 신규 36)
$ rg -c "지식 저장소"   frontend/src/lib/i18n/dict/ko.ts  → 16 (사이드바 1 + 신규 15)
```

### 노출 효과

- 사이드바 `통합`/`지식 저장소` → 페이지 진입 → 페이지 제목·생성·수정·삭제·토스트·확인 다이얼로그까지 모두 동일 라벨.
- 사용자 가이드의 모든 본문(`02-nodes/integrations.mdx`, `06-integrations-and-config/{integration-management,knowledge-base}.mdx` 등)에서 부르는 이름과 UI가 정확히 일치.

### 그 외 ko.ts에서 발견된 글로서리/문체 위반 (점검 범위 외, 후속 정리 권장)

- `엣지` — `ko.ts:657, 658, 730, 737, 748, 749` (워크플로우 에디터 자동 알림·버전 비교 영역). glossary §5 금지어
- `~되었습니다`/`~반영됩니다`/`~차단됩니다` — 같은 영역. glossary §3 해요체 통일 위반
- `~해 주세요` — 인증/auth 영역(라인 39 부근부터 다수). 가이드 영역만 정리됐고 그 외는 잔존

위 세 항목은 본 점검 범위가 아니라 손대지 않았음. 일관성 정리를 원하면 별도 작업으로 진행 권장.

---

## 점검 완료 파일 목록

**MDX (23/23)**: `01-getting-started/{what-is-this,ui-tour,first-workflow}.mdx`, `02-nodes/{overview,triggers,ai,integrations,logic,data,flow,presentation}.mdx`, `03-workflow-editor/{overview,walkthrough}.mdx`, `04-expression-language/{basics,variables-and-context,cheatsheet}.mdx`, `05-run-and-debug/{running-a-workflow,run-results,error-handling,version-history}.mdx`, `06-integrations-and-config/{integration-management,llm-config,knowledge-base,mcp-servers}.mdx`, `07-faq/faq.mdx`

**ko.ts**: `sidebar.userGuide`(L87) 인근, `docs`(L1976–1991), `assistant`(L2015–2063), Empty State(L702–703), `errors`(L2005–2013) 사용자 가이드 영역
