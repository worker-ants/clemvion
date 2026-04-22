# Review Resolution — 2026-04-22 22:52

대상: A(프롬프트 강화) + B(stream service leak 감지·복구) 변경분. 리뷰 `SUMMARY.md` 가 지적한 **CRITICAL 0 + WARNING 12 + INFO 14** 에 대한 조치 결과.

## CRITICAL

없음.

## WARNING

### W1. 복구 스캔 범위를 turn 누적 → round 한정 — 해결

**문제**: `assistantText` 는 턴 전체 누적이라 과거 라운드의 설명용 예시 JSON 이 마지막 라운드에서 오탐 복구를 트리거할 수 있었음.

**조치**: stream service 의 leak 스캔을 `roundText` (라운드 스코프 변수) 대상으로 변경. 이후 `assistantText` 는 `matched` 서브스트링 기반으로 스크럽해 최종 persist 에만 반영.

### W2. `VALID_STEP_ACTIONS` 타입 동기화 누락 — 해결

**조치**:
- `entities/workflow-assistant-message.entity.ts` 에 `PLAN_STEP_ACTIONS` tuple + `AssistantStepAction` 타입 export 추가.
- `AssistantPlanStep.action` 은 `AssistantStepAction` 을 참조하도록 변경 (기존 inline 유니온 제거, 값 동일).
- `recover-leaked-plan.ts` 의 `VALID_STEP_ACTIONS` 는 `new Set(PLAN_STEP_ACTIONS)` 로 파생 + `ReadonlySet<AssistantStepAction>` 타입.
- 새 action 추가 시 타입·validator 가 단일 소스에서 자동 확산됨.

### W3. O(n²) 최악 케이스 — 해결

**조치**:
- `recoverLeakedPlan` 상단에 fast-path: `text.includes('"title"') && text.includes('"steps"')` 조건 불충족이면 즉시 null 반환.
- 후보 `{` 에서 매칭 실패 시 `i = end + 1` 로 점프해 내부 `{` 재방문 제거. 최악 O(n).

### W4. 간접 prompt injection 표면 — 부분 해결

**조치**: `isProposePlanShape` 엄격 검증(title + 비어있지 않은 steps + 모든 step 이 `{id, action(enum), description}` 형태) 으로 노드 config 나 다른 prose 의 오탐 경로 차단. **UI 시각 구분** (복구된 plan 임 표시) 은 프론트엔드 변경이 필요해 본 작업 범위 밖 (option C 에 해당). `memory/` 에 후속 과제로 기록.

### W5. leak + edit 동시 발생 시 상태 불일치 — 해결

**조치**: 복구 블록에 **edit 공존 가드** 추가. 이 턴에 `kind === 'edit'` 인 tool call 이 하나라도 있으면 복구를 건너뛰고 `ASSISTANT_PROPOSE_PLAN_LEAK_DETECTED_WITH_EDITS` 경고 로그만 남긴다. 이유: edit 은 이미 캔버스에 applied 인데 복구로 plan 을 세우면 "승인 대기" 상태가 되어 일관성이 깨짐.

### W6. 위치 기반 mock 어서션 → role 기반 탐색 — 해결

**조치**: `workflow-assistant-stream.service.spec.ts` 의 leak-recovery describe 블록에 `findAssistantPersist(mocks)` 헬퍼 추가. `mocks.sessionService.appendMessage.mock.calls.find(...)` 로 role 기반 탐색. 기존 `mock.calls[1][1]` 사용처를 모두 교체.

### W7. `steps: []` 빈 배열 케이스 미테스트 — 해결

**조치**: stream service spec 에 `ignores a plan-shaped JSON with an empty steps array` 테스트 추가. `isProposePlanShape` 가 `steps.length === 0` 을 거부하므로 복구가 발동하지 않아야 함을 고정.

### W8. 멀티-delta 분할 스트리밍 미테스트 — 해결

**조치**: stream service spec 에 `handles JSON split across multiple text_delta chunks (real streaming pattern)` 테스트 추가. JSON 을 4개 청크로 쪼개 전송 → 누적된 `roundText` 에서 복구가 성공함을 고정.

### W9. SSE plan 이벤트 `openQuestions` 미검증 — 해결

**조치**: `emits a synthetic plan SSE event` 테스트의 `toMatchObject` 에 `openQuestions` 필드 + `summary` 필드 + id 접두사 `/^leak_/` 매칭을 추가. 계약 shape 전체 고정.

### W10. `recoverLeakedPlan` JSDoc 누락 — 해결

**조치**: 함수에 `@param text` + `@returns` JSDoc 추가. 반환 null 조건과 스캔 대상 명시.

### W11. `streamMessage` 클래스 JSDoc 에 복구 단계 미반영 — 해결

**조치**: 기존 4→5 흐름에 **"4.5 턴 종료 직전 propose_plan JSON leak 복구"** 항목 삽입. edit 공존 가드 동작도 한 줄 기술.

### W12. spec 파일 상단 JSDoc 에 신규 테스트 그룹 미반영 — 해결

**조치**: `workflow-assistant-stream.service.spec.ts` 최상단 JSDoc 에 `- propose_plan JSON leak recovery (server-side): ...` bullet 추가. 4개 테스트 케이스 핵심을 한 문장으로 요약.

## INFO — 선별 조치

### I1. `findMatchingBrace` 단일 따옴표 처리 제거 — 해결

JSON 은 double quote 만 string delimiter. `inString` 상태를 boolean 으로 단순화하고 `'"'` 만 경계로 인정. 주석으로 JSON 전용임을 명시.

### I2, I3, I5, I6~I14 — 의도적 보류

- **I2** (`replace` first-occurrence): 복구 대상이 이미 "첫 유효 블록" 이므로 의도와 일치. 주석으로 명시.
- **I3** (`leak_` id prefix): 진짜 tool call vs 복구 경로를 프론트/로그에서 구분하는 의도된 시그니처. 이 리뷰 반영 시 테스트에도 assertion 추가됨(W9).
- **I5** (code fence 잔류 문자열): 실사례에서 matched 가 `{` 부터 시작하므로 code fence 마커는 주변 prose 로 남을 뿐이며 새로 발생하는 문제 아님. W4 의 프론트 UI 개선에 함께 다룰 수 있음.
- **I6** (`expressionReferenceCache` mutable singleton): 현재 단일 스레드 Node 환경에서 안전. worker_threads 도입 시 재검토.
- **I7** (`describe('option B')` 구현 디테일 노출): 완료 — `server-side plan leak recovery` 로 리네이밍.
- **I8, I9** (파일 크기): stream service 와 spec 이 커지긴 했지만 단일 책임이므로 분리 기준 모호. 지금 쪼개면 import 경로만 늘어남.
- **I10** (self-check regex 관대함): 해당 테스트에는 BAD 패턴 + STOP + propose_plan + GOOD/BAD marker 여러 개를 요구해 이미 복합 매칭. 더 엄격하게 묶으면 문구 리팩토링에 취약.
- **I11** (복구 plan + finish guard 상호작용): 복구 plan 은 `approvedAt` 없이 `approved: false` 로 저장되어 기존 guard 가 그대로 처리. 별도 회귀 위험은 낮아 후속.
- **I12** (`openQuestions` 타입 런타임 가드): `buildPlanFromArgs` 는 여러 경로에서 공용이라 이 PR 범위에서는 건드리지 않음. 별도 작업 권장.
- **I13, I14** (테스트 내부 최적화 / cast): 기능 영향 없음.

## TEST WORKFLOW 재실행 결과

| 단계 | 결과 |
|------|------|
| lint | ✅ clean |
| unit — `recover-leaked-plan.spec.ts` | ✅ 9/9 |
| unit — `system-prompt.spec.ts` | ✅ 29/29 |
| integration — `workflow-assistant-stream.service.spec.ts` | ✅ 36/36 (기존 32 + leak recovery 4→6) |
| module 전체 — `src/modules/workflow-assistant/` | ✅ 157/157 |
| build — `nest build` | ✅ 성공 |

## 변경된 파일

- `backend/src/modules/workflow-assistant/prompts/system-prompt.ts` — self-check BAD/GOOD 섹션 추가
- `backend/src/modules/workflow-assistant/prompts/system-prompt.spec.ts` — self-check 검증 테스트 추가
- `backend/src/modules/workflow-assistant/tools/recover-leaked-plan.ts` — 신규 (leak 감지·shape 검증)
- `backend/src/modules/workflow-assistant/tools/recover-leaked-plan.spec.ts` — 신규 (9개 케이스)
- `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` — 복구 블록 + 클래스 JSDoc 업데이트
- `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts` — 통합 테스트 6개 + 파일 JSDoc 업데이트
- `backend/src/modules/workflow-assistant/entities/workflow-assistant-message.entity.ts` — `PLAN_STEP_ACTIONS` tuple + `AssistantStepAction` 타입 export
- `review/2026-04-22_22-52-00/RESOLUTION.md` — 이 파일

## 후속 과제 (별도 처리 필요)

- **Option C — 프론트엔드 sanitizer 확장 (W4 의 UI 부분)**: spec §3.2 가 주장하는 "원시 JSON 은 노출되지 않는다" 는 여전히 라이브 스트림 중에는 거짓. 최소한 `harmony-filter.ts` 에 propose_plan 형태 JSON 을 감지해 "복구된 plan" 배지와 함께 렌더 직전 스크럽하는 로직 추가가 필요.
- **Recovery plan UI 표시**: 사용자가 "LLM 이 올바르게 툴을 호출한 plan" 과 "서버가 복구한 plan" 을 구분 인지할 수 있도록 plan card 에 아이콘·툴팁. 빈도 관측 후 판단.
- **Indirect prompt injection 시나리오 테스트**: 공유 워크플로우 노드 데이터에 plan-shaped JSON 을 심는 공격 벡터 (W4). 현재는 text → LLM echo 경로만 차단되어 있고, 실제 공격 시나리오 end-to-end 테스트는 없음.
