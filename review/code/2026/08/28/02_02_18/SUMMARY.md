# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. `testing` reviewer 가 뮤테이션으로 실증한 WARNING 1건(테스트 커버리지 갭)이 유일한 실질 이슈이며, 나머지 6개 reviewer(security/requirement/scope/side_effect/maintainability/documentation)는 전부 NONE 판정(side_effect 만 별건 INFO 로 LOW 부여). forced(router_safety) 화이트리스트 7명 전원 정상 실행·결과 확보됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `isMultiTurnAiContext` 의 "이전 대화 없음(`conversationMessages.length > 0` → `false`)" 분기가 이번 PR 의 `extractNodeErrorPayload` 시그니처 변경 이후 **어떤 테스트로도 검증되지 않음**. `"AI node failure without prior conversation context does NOT APPEND (single-turn case)"` 테스트는 `output` 필드 자체를 싣지 않아 `errorPayload` 가 `isMultiTurnAiContext` 호출 이전에 이미 `null`(`&&` 단락 평가로 조기 차단) — `isMultiTurnAiContext` 를 `return true` 로 뮤테이션(확인 후 즉시 원복)해도 89/89 GREEN 유지로 실증. 직전 라운드(`01_44_22`)가 "공허 테스트 아님"으로 내린 판정은 이 단락 평가 순서를 놓친 오판이었음(이번 라운드가 반증) | `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:2323` (소스: `use-execution-events.ts:150-153`, 호출부 `:814`·`:910`) | fixture 에 `output: wrapNodeHandlerOutput({ error: { code: "LLM_RATE_LIMIT", message: "429" } })` 를 추가해 `errorPayload` 를 non-null 로 만들고, `seedConversation()` 은 호출하지 않은 채 유지해 "이전 대화 없음 → 배너 억제" 분기를 실제로 태우도록 수정. 여력이 되면 `handleNodeCompleted`(`:814`) 쪽에도 동일 케이스 1건 추가 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing / Requirement | 형제 fixture(`node.failed on a NON-AI node also carries output into outputData`)가 이번 PR 이 세운 "fixture = production shape(문자열 `error`)" 원칙을 적용받지 못하고 여전히 객체 `error` 를 사용 — 직전 라운드가 정정한 인접 2건과 별개의 세 번째 잔여 사례. 비-AI 노드라 `system_error` 로직 자체와 무관해 기능적 위험은 없음(`errorMessage` 계산에만 쓰이고 문자열/객체 결과 동일) | `use-execution-events.test.ts:2136` | 급하지 않음 — 여유 있을 때 `error: "Internal Server Error"` 로 통일해 스위트 전체 fixture 일관성 확보 |
| 2 | Requirement | `handleNodeCompleted` 분기가 실제 프로덕션에서 `output.output.error` 를 싣고 도달하는 트리거를 이번 조사에서도 특정 못함 — 신규 갭 아니고 이전 라운드(`01_26_11`)가 이미 "회귀 아님"으로 판정한 사항의 승계 | `use-execution-events.ts:813-814` | 조치 불요, 필요 시 별건으로 백엔드 도달 가능성 조사 |
| 3 | Security / Side Effect | 종전 결함으로 죽어 있던 `system_error` 배너 렌더 + `addConversationMessage` 경로가 이번 수정으로 라이브 프로덕션에서 처음 발동. 렌더 싱크는 JSX 텍스트 자식 전용(`dangerouslySetInnerHTML` 미사용 확인)이라 XSS 위험 없음, 스토어 갱신은 순수 불변 `set` 스프레드라 부가 부작용(네트워크·전역변수·타이머) 없음. CHANGELOG·plan 문서에 "회귀 아님(의도된 기능 복구)" 명시 | `use-execution-events.ts:807-935`, `conversation-timeline-item.tsx`, `execution-store.ts:844-847` | 조치 불필요 — 배포 후 배너 노출 급증을 회귀로 오판하지 않도록 온콜 공유 권장(선택) |
| 4 | Security / Side Effect / Scope | `extractNodeErrorPayload` 시그니처를 2-인자→1-인자로 좁히고 `direct`(객체 `error`) 분기 제거 — 입력 수용 표면 축소(방어 강화)이자 동시에 계약 축소. 두 호출부 동반 수정으로 즉시 영향 없고, 백엔드 emit 4곳 전수 실측(이전 라운드 RESOLUTION)으로 현재 도달 불가 근거 있음 | `use-execution-events.ts:84-100` | 조치 불필요 — 향후 백엔드가 객체 `error` 를 다시 보내는 버전이 혼재 배포되면 이 좁아진 계약이 배너를 조용히 억제한다는 점만 유념 |
| 5 | Security | `details` 필드는 `retryable`/`retryAfterSec` 화이트리스트 2개만 소비(나머지는 조용히 버려짐), ID 는 `UUID_REGEX` 화이트리스트로 새니타이즈 유지, 하드코딩 시크릿·API키·토큰 없음 | `use-execution-events.ts:47-49, 95-98, 815-822, 911-918` | 조치 불필요 |
| 6 | Maintainability | 이전 두 라운드에서 이미 지적·사유와 함께 유예된 3항목(핸들러 간 ~20줄 중복, `asRecord(asRecord(...)?.error)` 이중 언래핑 밀도, `handleNodeFailed` payload 타입의 객체-형태 잔존)이 이번 라운드에도 동일하게 존재 — 신규 발견 아니며 유예 사유 유효성 재확인만 함 | `use-execution-events.ts:807-835`/`904-931`(중복), `:89-90`(밀도), `:855-861`(타입) | 현 판정 유지 — 세 번째 호출부 추가 등 재차 건드릴 사유가 생기면 그때 헬퍼 추출 재검토 |
| 7 | Documentation | diff 범위 밖 untracked `.bak` 잔여 파일(52KB)이 워크트리에 남아 있음 | `codebase/frontend/src/lib/websocket/use-execution-events.ts.bak` | push 전 삭제 권장(`rm codebase/frontend/src/lib/websocket/use-execution-events.ts.bak`) — 리뷰 위험도엔 영향 없음 |
| 8 | Documentation | README/API/설정 문서 변경 불요 확인 — 새 env/공개 API/엔드포인트 없음, `spec/5-system/6-websocket-protocol.md` §4.1-a 는 이미 2026-08-24 정정되어 있어 이번 코드 변경은 그 spec 을 뒤늦게 따라잡는 것뿐(`spec_impact: none`) | `plan/in-progress/system-error-banner-live-ws.md` | 조치 불필요 |
| 9 | Testing | 이번 라운드 신규 캐너리·가드 테스트(`[가드]`, `[캐너리]`)가 실제로 뮤테이션에 반응함을 직접 재확인 — 직전 라운드 WARNING(가드 커버리지 0)이 실제로 닫혔음을 검증 | `use-execution-events.test.ts:2236` 등 | 조치 불필요 — 확인 기록 |
| 10 | Scope | 원 결함(2줄 배선 오류) 대비 표면상 넓어 보이는 요소(CHANGELOG 추가, `direct` 분기 제거, 신규 테스트 3건, `asRecord`/`wrapNodeHandlerOutput` 헬퍼, review 산출물 22개 동반 커밋)가 전부 이전 두 리뷰 라운드 WARNING 에 대한 문서화된 대응이며 plan 체크리스트와 1:1 대응 — 스코프 이탈 없음. 리뷰 산출물 동반 커밋도 저장소 관례(선례 존재)와 일치 | `git diff --stat origin/main...HEAD` (26 files, +1616/−62) | 조치 불필요 |
| 11 | 전반(Security/Requirement/Scope/Maintainability/Documentation) | 이전 두 라운드(`01_26_11`, `01_44_22`)의 documentation/maintainability WARNING 전건이 현재 소스에 실제 반영돼 있음을 5개 reviewer 가 각자 직접 소스 대조로 재확인 | `use-execution-events.ts` JSDoc/주석 전반, `CHANGELOG.md`, 테스트 제목 | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿/인증우회 없음, 렌더 경로 XSS 안전 확인, `details` 화이트리스트 소비, 입력 검증 강화 |
| requirement | NONE | spec §4.1-a·`node-output.md` Principle 0 을 정확히 구현(백엔드 emit 4곳 소스 대조로 검증), INFO 2건(fixture shape 잔류, 도달가능성 미확증 승계) |
| scope | NONE | 표면상 넓어 보이는 확장 요소 전부 이전 리뷰 피드백에 근거해 정당화, 스코프 이탈 없음 |
| side_effect | LOW | 죽어있던 배너/스토어 경로가 의도대로 활성화(안전 확인됨), `direct` 분기 제거로 계약이 다소 좁아짐(현재 도달 불가 실측) |
| maintainability | NONE | 신규 발견 없음 — 이전에 유예된 3항목만 재확인 |
| testing | LOW | **WARNING 1건**: `isMultiTurnAiContext` "이전 대화 없음" 분기 커버리지 0 을 뮤테이션으로 실증, 직전 라운드 오판을 반증 |
| documentation | NONE | 이전 WARNING 전건 반영 확인, INFO: untracked `.bak` 잔여 파일 |

## 발견 없는 에이전트

없음 — 전 reviewer 가 최소 INFO 이상을 보고함(대부분 조치 불요 확인 기록).

## 권장 조치사항

1. **(WARNING 대응)** `"AI node failure without prior conversation context does NOT APPEND (single-turn case)"` 테스트(`use-execution-events.test.ts:2323`)에 `output: wrapNodeHandlerOutput({ error: { code: "LLM_RATE_LIMIT", message: "429" } })` 를 추가해 `errorPayload` 를 non-null 로 만들고, `seedConversation()` 은 호출하지 않은 채 유지 — `isMultiTurnAiContext` 의 "이전 대화 없음 → 배너 억제" 분기가 실제로 검증되도록 수정. 여력이 되면 `handleNodeCompleted` 쪽에도 동일 케이스 1건 추가.
2. push 전 untracked 잔여 파일 삭제: `rm codebase/frontend/src/lib/websocket/use-execution-events.ts.bak`.
3. (선택, 낮은 우선순위) `use-execution-events.test.ts:2136` fixture 의 `error` 를 문자열(`"Internal Server Error"`)로 통일해 이 PR 이 세운 "fixture = production shape" 원칙을 스위트 전체에 일관 적용.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, forced(router_safety) 화이트리스트로 전체 reviewer 강제 실행.
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명) — 전원 성공, 결과 파일 확보됨.
  - **제외**: 없음.
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — forced 전원 결과 확보됨(미이행 없음).