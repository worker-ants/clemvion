### 발견사항

---

**[INFO]** `STATIC_BLOCK_1/2/3` 상수에 JSDoc 없음
- 위치: `system-prompt.ts` — `STATIC_BLOCK_1_ROLE_AND_TURN_OP`, `STATIC_BLOCK_2_CONTRACTS`, `STATIC_BLOCK_3_EDIT_PLAYBOOK` 선언부
- 상세: 세 상수는 C-style 구분선(`// ====...====`)만 있고 JSDoc(`/** */`)이 없다. 나머지 함수(`renderNodeCatalog`, `getExpressionReferenceSection`, `renderActivePlanSection`)와 스타일이 불일치하며, 특히 `STATIC_BLOCK_3_EDIT_PLAYBOOK`에 레이아웃 상수(`${LAYOUT_FALLBACK_WIDTH}` 등)가 모듈 로드 시점에 인터폴레이션된다는 사실이 문서화되어 있지 않다.
- 제안: 짧은 JSDoc 한 줄이면 충분. 예: `/** 정적 블록 3: 마감 메시지·pendingUserConfig·기존 노드 수정 루틴·레이아웃 가이드·예시. 레이아웃 상수는 모듈 로드 시 1회 인터폴레이션. */`

---

**[WARNING]** `renderActivePlanSection` JSDoc의 "프롬프트 최상단 근처" 문구가 남아 있을 수 있음 → 확인 필요
- 위치: `system-prompt.ts`, `renderActivePlanSection` JSDoc 첫 줄
- 상세: diff에서 "프롬프트 최상단 근처에 고정 섹션을 삽입한다" → "동적 블록에 고정 섹션을 삽입한다"로 업데이트된 것은 맞다. 그러나 JSDoc 나머지 문장("목표는 LLM이 매 턴 … 이어가도록")은 여전히 정확하므로 이 부분은 완결됐다. 단, `renderActivePlanSection`은 `null`이면 빈 문자열을 반환한다는 사실이 JSDoc에 언급되지 않는다(`@returns` 없음).
- 제안: `@returns {string}` 한 줄 추가: `"" when ctx is null (section entirely omitted from the prompt)`.

---

**[WARNING]** `memory/workflow-assistant-prompt-restructure.md`에서 구버전 라인 번호 참조
- 위치: `memory/workflow-assistant-prompt-restructure.md` — "이전 구조의 문제" 섹션, `L84/L85/L129/L138–153/L251`
- 상세: 재구조 이후 파일 라인 번호가 완전히 바뀌었으므로, 이 숫자로 파일을 탐색하면 잘못된 위치를 보게 된다. 미래 유지보수자가 혼란을 겪을 수 있다.
- 제안: 라인 번호 대신 섹션 이름이나 함수명으로 표기. 예: "`## Conversation loop`, `Plan-only turn` 단락, `Workflow assembly rules` 목록 등 5곳".

---

**[INFO]** pre-existing 이슈에 추적 링크 없음
- 위치: `memory/workflow-assistant-prompt-restructure.md` — "이번 작업에서 발견한 pre-existing 이슈" 섹션
- 상세: optional chaining 파서 실패(`validate-expressions.spec.ts`, `shadow-workflow.spec.ts`)가 명시됐지만, 이를 추적할 이슈/티켓 번호나 별도 plan 파일 경로가 없다.
- 제안: `plan/` 하위에 별도 파일을 생성하거나 Github Issue 번호를 기재해 follow-up이 누락되지 않도록 연결.

---

**[INFO]** `getExpressionReferenceSection` 캐시 동작이 JSDoc·변수 JSDoc 양쪽에 중복 설명
- 위치: `system-prompt.ts` — `EXPRESSION_REFERENCE_CACHE` 변수 JSDoc 및 `getExpressionReferenceSection` 함수 JSDoc
- 상세: 두 JSDoc 모두 "프로세스 수명 동안 1회만 문자열화"를 설명한다. 중복이 가독성을 저해하지는 않지만, 유지보수 시 한 곳만 수정하는 실수가 발생할 수 있다.
- 제안: 변수 JSDoc은 "캐시 홀더" 역할만 서술하고, 함수 JSDoc에서 "이 변수를 통해 1회 캐시"를 설명하는 단방향 참조 구조로 정리.

---

**[INFO]** 테스트 `describe` 블록의 `activePlan` 상수가 한 테스트에서만 사용됨 — 주석 부재
- 위치: `system-prompt.spec.ts`, `5-block structural layout` `describe` 블록 상단
- 상세: `activePlan` 상수가 선언됐지만 실제로는 두 번째 테스트(`places the active plan context block after...`)에서만 사용된다. 나머지 세 테스트는 `activePlan` 없이 `buildSystemPrompt(defs, emptySnapshot)`을 호출한다. "왜 여기서 선언했나"에 대한 짧은 주석이 없어 처음 읽는 사람이 의아해할 수 있다.
- 제안: 상수 선언 위에 한 줄 주석: `// active plan 블록의 위치 테스트에만 사용; 나머지는 plan 없이 호출`.

---

### 요약

전반적인 문서화 수준은 높다. `buildSystemPrompt`의 JSDoc이 5블록 구조를 명확히 설명하고, 새로 추출된 `renderNodeCatalog`·`getExpressionReferenceSection` 함수는 적절한 JSDoc을 갖췄다. `memory/workflow-assistant-prompt-restructure.md`는 "왜 변경했나 → 새 구조 → 테스트 계약 → 유지보수 주의점"을 망라하는 우수한 아키텍처 결정 기록이다. 다만 `STATIC_BLOCK_*` 상수의 JSDoc 부재, `renderActivePlanSection`의 반환 타입 미기재, 메모리 문서의 구버전 라인 번호·이슈 추적 링크 누락이 미미한 약점으로 남는다.

### 위험도

**LOW**