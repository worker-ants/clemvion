분석이 완료됐습니다. 리뷰를 작성합니다.

---

## 문서화 코드 리뷰 — AI Agent 모듈

### 발견사항

---

**[WARNING] 스키마 주석 위치 오인 위험**
- **위치**: `ai-agent.schema.ts:275–279`
- **상세**: "도구 연결 입력 경로 — 재작성 예정으로 스키마에서 제거" 블록 주석이 `conversationHistory` 필드 선언 바로 위에 배치되어 있어, 후독자가 `conversationHistory`도 제거된 필드라고 오해할 소지가 있다. 주석이 설명하는 내용(이미 제거된 `toolNodeIds`/`toolOverrides`)은 코드에 존재하지 않는데, 바로 다음에 오는 활성 필드를 가리키는 것처럼 보인다.
- **제안**: 주석을 `conversationHistory` 선언부에서 분리하거나, `// ── [제거됨] 도구 연결 입력 경로 ──` 같은 섹션 구분선으로 명확히 분리. 또는 관련 필드가 완전히 없으므로 주석 전체를 파일 상단이나 `passthrough()` 호출 근처로 이동.

---

**[WARNING] PRD 요구사항 상태(✅)가 '제거됨'과 충돌**
- **위치**: `prd/3-node-system.md:185, 189, 200` / `prd/6-phase2-ai.md:66, 70, 81`
- **상세**: ND-AG-06, ND-AG-10, ND-AG-21 요구사항이 상태 컬럼에 ✅를 표기하고 있다. 통상 ✅는 "구현 완료"를 뜻하는데, 본문에는 _(제거됨 — 재작성 예정)_ 라고 명시되어 있어 상충된다. 새로운 팀원이 PRD 상태 컬럼만 훑으면 해당 기능이 정상 동작한다고 잘못 해석할 수 있다.
- **제안**: 상태 컬럼을 `🚧` 또는 별도 기호(예: `⊘`)로 변경하거나, 열 값을 `제거됨`처럼 텍스트로 표기.

---

**[INFO] `buildMultiTurnFinalOutput` — public 메서드에 JSDoc 없음**
- **위치**: `ai-agent.handler.ts:1103`
- **상세**: 테스트에서 직접 호출하고 실행 엔진에서도 참조하는 public 메서드이나 JSDoc이 없다. 바로 위 `endMultiTurnConversation`(line 1077)은 JSDoc이 있어 일관성이 깨진다. 파라미터 `turnDebugHistory`가 선택적인 이유, `turnDebug`와의 관계가 불명확하다.
- **제안**: `endMultiTurnConversation`과 동일 스타일로 한 줄 summary + 주요 파라미터 설명 추가.

---

**[INFO] `ConditionDef` / `ConditionClassification` 인터페이스 — JSDoc 없음**
- **위치**: `ai-agent.handler.ts:91–102`
- **상세**: `ConditionDef`는 스키마·핸들러·테스트 전체를 관통하는 핵심 타입임에도 불구하고 JSDoc이 없다. `ConditionClassification`의 `matchedCondition`이 왜 배열이 아닌 단일 값인지(conditions 배열 순서 기준 첫 winner 정책) 문서화가 누락되어 있다.
- **제안**: 두 인터페이스에 "조건 배열에서 첫 번째로 정의된 조건이 우선한다"는 정책 설명과 `matchedCondition: null`의 의미를 한 줄 주석으로 추가.

---

**[INFO] `conversationHistory` / `historyCount` 필드 — 핸들러 미구현 미표기**
- **위치**: `ai-agent.schema.ts:280–308` / `spec/4-nodes/3-ai-nodes.md` 설정 표
- **상세**: 스키마에는 `conversationHistory` / `historyCount` 필드가 정의되어 있고 spec 설정 표에도 기술되어 있으나, `ai-agent.handler.ts`에서는 이 두 필드를 읽는 코드가 전혀 없다. 실제로 동작하지 않는 설정이지만 사용자·개발자가 이를 인지할 방법이 없다.
- **제안**: 스키마 필드 주석에 `// TODO: 핸들러 미구현 — 대화 이력 주입 로직 추가 필요` 추가. spec 표에도 구현 여부 표기.

---

**[INFO] `§12. AI Agent Tool Area` 섹션 헤더에 폐기 표시 없음**
- **위치**: `spec/3-workflow-editor/0-canvas.md:660`
- **상세**: 섹션 본문에 ⚠ 박스가 있지만, 헤더 자체(`## 12. AI Agent Tool Area`)에는 폐기 표시가 없다. 목차(ToC)를 통해 섹션으로 이동하는 독자는 폐기 사실을 놓칠 수 있다.
- **제안**: 헤더를 `## 12. AI Agent Tool Area _(재작성 예정 — 현재 제거됨)_`로 변경.

---

**[INFO] `mcpServerRef.toolOverrides`와 제거된 `config.toolOverrides` 명칭 혼동**
- **위치**: `ai-agent.schema.ts:43–51` / `spec/4-nodes/3-ai-nodes.md` McpServerRef 표
- **상세**: `McpServerRef` 내부의 `toolOverrides`(MCP 서버별 tool description 오버라이드, 현재 활성)와 config 레벨에서 제거된 `toolOverrides`(일반 도구 이름·설명 커스터마이징)가 동일한 이름을 공유한다. plan 문서와 PRD 경고 박스를 읽은 개발자가 이 필드도 제거된 것으로 오해할 수 있다.
- **제안**: `McpServerRef.toolOverrides` 필드에 `// MCP tool-level description override (활성 기능, config-level toolOverrides와 무관)`처럼 명시적으로 구분.

---

**[INFO] `KB_TOOL_GUIDANCE` 상수 — 주입 조건 설명 없음**
- **위치**: `ai-agent.handler.ts:114–117`
- **상세**: 상수 자체는 읽으면 내용을 알 수 있으나, "언제, 왜 이 문자열이 system prompt에 추가되는지"(knowledgeBases.length > 0 조건 시), 그리고 "이전 prefill 방식 대비 무엇이 바뀌었는지"가 핸들러 내 주석(`// KB 검색은 더 이상 prefill 하지 않는다.`)에만 언급되고 상수 정의 위치에는 없다.
- **제안**: 상수 위에 한 줄 요약 주석 추가 — 기존 prefill 방식과의 차이점, LLM 능동 호출 방식으로 전환된 배경.

---

**[INFO] `readSingleTurnMeta` 헬퍼 함수 위치**
- **위치**: `ai-agent.handler.spec.ts:1975–1978`
- **상세**: 파일 최하단에 정의된 helper가 파일 중반부(`describe('execute - single_turn')` 내)에서 사용된다. 후독자가 이 함수를 발견하지 못하고 인라인으로 같은 로직을 재작성할 위험이 있다. JSDoc은 존재하지만 위치가 직관적이지 않다.
- **제안**: `describe('AiAgentHandler')` 내부 상단으로 이동하거나, 최소한 `describe('execute - single_turn')` 블록 바로 위에 위치.

---

### 요약

전반적으로 이 모듈의 문서화 수준은 동급 프로젝트 대비 우수하다. 공개 인터페이스(`ToolCallTrace`, `RagAccumulator`, `TOOL_RESULT_PREVIEW_CHARS` 등)에는 보안 동기·UI 계약까지 기술한 JSDoc이 있고, plan·spec·PRD 간 "재작성 예정" 경고 박스 체인도 일관성 있게 유지되고 있다. 다만 `schema.ts:275`의 주석 위치 오인 문제와 PRD의 ✅ 상태 표기 혼란이 가장 시급한 개선 포인트다. `conversationHistory`/`historyCount`의 핸들러 미구현 사실이 문서에 명시되지 않은 것도 현업 혼란을 초래할 수 있어 함께 처리를 권장한다.

### 위험도

**LOW**