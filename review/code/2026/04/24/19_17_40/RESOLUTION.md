# Review Resolution — 2026-04-24_19-17-40

리뷰 대상: 커밋 `c2a838e` (ED-AI-40 런타임 포트 hint + retry-recovered 배지).
Critical 0 + Warning 10 + Info 15 중 **Warning 전건 + 주요 Info** 조치. backend 1926 / frontend 1098 / lint / build clean.

## Warning

| ID | 조치 |
|----|------|
| **W-1** | `portResolver` 에서 `p.label` 을 `sanitizeLlmProvidedString(p.label, 80)` 통과 후 실어 tool_result 에 동봉. dynamic-ports 버튼의 한글 label 등 사용자 자유 입력이 개행·꺾쇠·제어문자를 포함해도 프롬프트 인젝션 표면으로 노출되지 않는다. |
| **W-2** | `shadow-workflow.spec` 의 `update_node` describe 에 `ED-AI-40 runtime ports on success` 블록 신설. resolver 주입 시 ports 반환, resolver 없으면 생략, 50 상한 + `portsTruncated` 3 케이스가 `add_node` 블록을 mirror. |
| **W-3** | `toRuntimePortDescriptor` helper 를 `workflow-assistant-stream.service.ts` 에 export. `'error'` 만 그대로 보존하고 `'data'`/`'system'`/`'control'`/미래 타입은 모두 `'data'` 로 매핑하는 정규화 + label sanitize + 빈 `{}` spread 제거 로직을 한 함수로 모음. stream.service.spec 의 최하위 describe `toRuntimePortDescriptor — runtime port type 정규화` 에서 4가지 타입 매핑·label sanitize·label-less omit 을 고정. |
| **W-4** | `tool-call-badge.test` 에 "[fail_A→success_A→fail_B→success_B] 시퀀스가 각각 독립된 retried 그룹으로 축약" 회귀 케이스 추가. `count=2` 가 아니라 2 그룹임을 어서션. |
| **W-5** | `ShadowResult` 에 `portsTruncated?: boolean` 필드 추가. `buildRuntimePorts` 가 50 상한에 걸려 잘린 경우 `true` 를 함께 리턴, `add_node` / `update_node` 성공 경로가 그 값을 `result.portsTruncated` 로 싣는다. shadow-workflow.spec 의 add_node 50 상한 케이스와 신규 update_node 50 상한 케이스에서 `expect(result.portsTruncated).toBe(true)` 고정. |
| **W-6 / W-9** | `RECOVERABLE_ERROR_CODES` 를 `tool-call-badge.tsx` 모듈 최상위 `const` 로 승격. 렌더마다 Set 재생성 제거 + 에러 코드 문자열이 한 곳에서 관리된다. |
| **W-7** | `frontend/src/lib/api/assistant.ts` 에 `RuntimePortDescriptor` / `RuntimePorts` 인터페이스 export. `AssistantToolCallRecord.result` 의 `unknown` 은 유지하되, 소비자가 narrow cast 할 때 표준 타입을 참조할 수 있도록. |
| **W-8** | `system-prompt.spec.ts` 파일 상단 docblock 1번 항목을 `"get_node_schema 선행 호출 필수"` → "`result.ports` 를 바로 사용, `get_node_schema` 는 스냅샷에만 있는 노드 연결 시만" 으로 갱신 (ED-AI-40 기조와 일치). |
| **W-10** | 타입 계약 breaking change 전수 확인 — `grep -rn "NodePortResolver\|ResolvedNodePorts" backend/src` 결과 `shadow-workflow.ts` 내부 4곳 외 다른 소비자 없음. `tsc --noEmit` (nest build) 와 122 test suites / 1926 tests 통과로 hidden consumer 없음 확인. |

## 선택 반영한 Info

| ID | 조치 |
|----|------|
| **I-1** | `buildRuntimePorts` 의 `.slice()` 를 `length > MAX ? slice : array` 분기로. 99% 케이스 (포트 수 ≤ 50) 에서 불필요한 배열 복사 회피. |
| **I-2** | `toRuntimePortDescriptor` 가 `label` 없을 때 `{...spread}` 대신 필드 자체 생략 — `'label' in result === false`. |
| **I-3** | `ToolCallBadge` 의 `t('assistant.toolCallBadgeRetryRecovered')` 를 `retried ? t(...) : null` 단락평가로 교체. |
| **I-4** | `isSameEditTarget` 에서 `add_node` 분기 제거 — add_node 는 LABEL_CONFLICT 성공 복구 (suggested 반영) 와 섞여 false-positive 를 만들 수 있어 recovery 축약 대상에서 제외. 관련 테스트 1건 "does NOT collapse add_node ..." 로 회귀 고정. |
| **I-5** | `remove_node` NODE_NOT_FOUND → 같은 id 성공 축약 회귀 케이스 추가. |
| **I-6** | `toDesc` 헬퍼를 `shadow-workflow.spec` 파일 최상위로 통합. 이전에 두 describe 스코프에 나뉘어 있던 inline 정의 제거. |
| **I-7 / I-8** | `ShadowRuntimePort.type` JSDoc 에 정규화 규칙 명시, `ShadowResult.ports` JSDoc 에 "운영 경로에선 항상 present + truncated 필드 의미" 명시. |
| **I-11** | `isSameEditTarget` 의 주석을 "I-4 에서 add_node 제외" 설명으로 갱신 (label 매칭 경로 자체를 삭제). |
| **I-12** | `{...(title ? { title } : {})}` conditional spread → `title={title}` 단순 prop 으로 단순화. `undefined` 는 React 가 attribute 를 생략. |
| **I-13** | `readEdgeEndpoint` 에 JSDoc 1단락 추가 — snake_case / camelCase 양쪽 수용 이유 (provider 간 arg 케이스 편차) 명시. |

## Follow-up (이번 범위 밖)

- **Arch I-9 + W-6 후반부**: `ResolvedNodePorts` validation/response 이중 역할 완전 분리, backend↔frontend 에러 코드 shared 패키지화. 규모 커지면 후속 PR.
- **INFO-14**: `buildRuntimePorts` null 반환 시나리오 (registry 미등록 타입) 문서화 — 기존 주석으로 충분하다고 판단.
- **INFO-15**: 히스토리 메시지 배지 재렌더 QA — 자동화 범위 밖.

## 재검증 결과

- `backend/npm run lint && npm test && npm run build` — clean (1926/1926 passed).
- `frontend/npm run lint && npm test && npm run build` — clean (1098/1098 passed).
- `grep -rn "NodePortResolver\|ResolvedNodePorts" backend/src` — external consumer 없음.
