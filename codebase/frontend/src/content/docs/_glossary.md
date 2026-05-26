# 매뉴얼 용어 사전

이 문서는 사용자 매뉴얼(`/docs`)의 **용어 표기 기준**이에요. 매뉴얼 본문 작성자와 검수자는 모두 이 사전을 따라요. 이 파일은 `_glossary.md`(언더스코어 접두)로 `registry`에서 자동 제외돼요.

## 1. 기본 원칙

- **해요체로 통일**해요. "~합니다", "~한다"는 쓰지 않아요.
- 영문 고유명사를 한글로 옮길 때, UI 표기와 동일한 말을 우선 써요.
- 코드/식별자는 그대로 영문으로 써요. 예: `manualTrigger`, `if-else`, `{{ node.result }}`.

## 2. 용어 표기

| 영문 | 한글 | 비고 |
| --- | --- | --- |
| Workflow | 워크플로우 | "작업 흐름" 금지 |
| Node | 노드 | |
| Edge | 연결선 | "엣지" 금지. 다만 UI에 "Edge"가 노출된다면 "연결선(Edge)"로 병기 가능 |
| Canvas | 캔버스 | |
| Trigger | 트리거 | |
| Manual Trigger | 수동 트리거 | |
| Schedule | 스케줄 | |
| Webhook | 웹훅 | |
| Integration | 통합 | 로그인·계정 연동 맥락에서는 "연동" 병기 가능 |
| Expression | 표현식 | 예시 고정: `{{ expression }}` |
| Expression Language | 표현식 언어 | |
| Variable | 변수 | |
| Run / Execution | 실행 / 실행 이력 | 동사는 "실행해요", 명사는 "실행" |
| Node Result | 노드 결과 | "output" 대신 |
| Error Policy | 에러 정책 | "실패 정책" 금지 |
| Fallback | 폴백 | |
| Palette | 팔레트 | 에디터 좌측 노드 목록 |
| Settings Panel | 설정 패널 | 노드 선택 시 우측에 열리는 패널 |
| AI Agent | AI 에이전트 | 노드 이름은 대문자 그대로도 가능 |
| Text Classifier | 텍스트 분류기 | 노드 이름은 "Text Classifier" 원문 유지, 본문에서는 "텍스트 분류기" 사용 가능 |
| Information Extractor | 정보 추출기 | 위와 동일한 규칙 |
| Knowledge Base | 지식 저장소 | 메뉴명과 동일 |
| RAG | RAG | 한글화하지 않고 그대로. 본문에서는 "RAG(검색 보강)" 식으로 풀이 가능 |
| Vector RAG | Vector RAG | KB의 기본 검색 모드. "벡터 모드"로 풀어 쓸 수 있어요 |
| Graph RAG | Graph RAG | KB가 entity·relation까지 추출해 그래프와 벡터를 함께 검색하는 모드. "그래프 모드"로 풀어 쓸 수 있어요 |
| LLM | LLM | 한글화하지 않고 그대로 사용 |
| LLM Config | LLM 설정 | 메뉴명과 동일. AI 노드가 호출할 프로바이더·기본 모델·파라미터를 보관 |
| Prompt | 프롬프트 | |
| Tool | 도구 | AI Agent의 tool 개념 |
| MCP | MCP | Model Context Protocol. 한글화하지 않고 그대로 사용 |
| MCP Server | MCP 서버 | MCP를 통해 도구·리소스를 제공하는 외부 서버. AI Agent의 `MCP Servers` 필드로 연결 |
| Version History | 버전 히스토리 | |

## 3. 문장 스타일

- **도입 문장**: "이 페이지에서는 ···을 설명해요."
- **행동 안내**: "···을 클릭해요.", "···을 입력해요."
- **주의**: `<Callout type="warn">` 박스에 담고, 본문에서는 "주의" 표현 자제.
- **팁**: `<Callout type="tip">` 박스 사용.
- **파워유저 팁**: 표현식 고급 사용, JSON/코드 편집 모드, 외부 API 호출 등 이 제품을 숙련되게 쓰는 팁을 페이지 끝 "팁 & 참고" 섹션에 모아요. **매뉴얼의 독자는 이 제품의 사용자**이므로, 서비스 내부 구현(백엔드 함수명·사용 라이브러리·DB 이름 등)은 노출하지 않아요.

## 4. 예시 관례

- 표현식 예시는 반드시 `{{ }}`로 감싸요. 예: `{{ $run.input.email }}`.
- 코드 블록 언어 태그는 TypeScript는 `ts`, JSON은 `json`, 쉘은 `bash`로 고정.
- 스크린샷이 필요한 자리는 ASCII 다이어그램 또는 `> 설명 문단`으로 대체해요. 이미지 캡처는 후속 작업이에요.

## 5. 금지어·지양어

| 금지/지양 | 대체 |
| --- | --- |
| "엣지" | "연결선" |
| "작업 흐름" | "워크플로우" |
| "실패" (단독) | "실행 실패" 또는 "에러" |
| "아웃풋" | "결과" 또는 "출력" |
| "인풋" | "입력" |
| "서브미션" | "제출" |
| "옵션 값을 넣어주세요" 류 수동태 | "···을 입력해요" 능동태 |
| `spec/...` · `/spec/...` 경로, `plan/in-progress/...` · `plan/complete/...` 경로 (본문 내) | 같은 사실을 사용자 가시 표현으로 다시 적어요. frontmatter 의 `spec:` 필드는 빌드 검증용 metadata 라 별개. (가드: `no-internal-refs.test.ts`) |
| 내부 식별자 `CCH-XX-NN` · `R-XX-N` 등 | 사용자에게 의미 있는 동작 설명으로 풀어 적어요. |
| i18n 매핑 테이블 이름 (`ERROR_KO`·`WARNING_KO`·`LABEL_KO`·`HINT_KO`·`GROUP_KO`·`ITEM_LABEL_KO`·`OPTION_LABEL_KO`), 매핑 파일명 (`backend-labels.ts`) | 매핑은 내부 구현이라 사용자 안내에 등장할 이유가 없어요. 동작/한계만 서술. |
| "v2 (후속)" · "v2 (planned)" · "향후 ~ 예정" · "별 plan `<name>`" · "별도 plan" · "separate plan" · "후속 PR" 등 로드맵성 문구 | 현재 동작 상태만 서술. 변경이 합쳐지면 그 시점에 같은 PR 에서 본문을 갱신. |
