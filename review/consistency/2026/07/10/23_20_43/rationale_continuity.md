# Rationale 연속성 검토 (사후, `--impl-done`) — `getStatus()` 2단계 컬럼 projection

## 검토 대상

- Spec: `spec/5-system/14-external-interaction-api.md` §5.3 (line 427-471), §R17 (line 1104-1177)
- Convention: `spec/conventions/conversation-thread.md` §4, §8.4
- 구현(실제 diff, `git diff origin/main...HEAD`):
  - `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`getStatus()`)
  - `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`
- 커밋: `0e80bd4a1`(구현) → `f2764f3a9`(ai-review Warning 4건 fix)
- Plan: `plan/in-progress/eia-getstatus-column-projection.md` (체크리스트 9a 까지 완료, 9b/9c 는 본 검토가 그 일부)
- 참고: `review/code/2026/07/10/22_47_32/{SUMMARY,RESOLUTION}.md`, 선행 impl-prep 검토
  `review/consistency/2026/07/10/22_25_21/rationale_continuity.md` (동일 변경의 착수 전 판단)

## 발견사항

### [INFO] 기각 대안 (a)/(b) — 완성된 코드에서도 재도입 없음 (코드로 확인)

- target 위치: `interaction.service.ts:264-364` (`getStatus()` 전체)
- 과거 결정 출처: EIA §R17 "기각 대안" 문단 (line 1136-1139)
  - (a) *SSE 전용 유지 + buffer 만료 시 위젯이 재조회* — 순환이라 기각
  - (b) *`NodeExecution.output_data` 분산 저장에서 thread 재구성* — 무손실 복원 불가로 기각
- 상세: 완성된 코드는 여전히 `this.executionRepository.findOne({ where: { id: ctx.executionId }, select: ['id', 'conversationThread'] })` 로 **`Execution.conversation_thread` durable 컬럼을 직접 재조회**한다(line 294-298). `NodeExecutionRepository` 는 별도로 `NodeExecutionStatus.WAITING_FOR_INPUT` 대기 노드(`currentNode`/`buttonConfig`/`nodeOutput` 조립용)만 조회하며 thread 재구성에는 관여하지 않는다(line 299-306, 315-362). REST 응답도 여전히 waiting 시 `context.conversationThread` 를 실값으로 포함한다(line 347) — SSE-only 로 되돌아가지 않았다.
- 제안: 없음(문제 없음). 2단계 분리는 "언제(status 조건) fetch 하는가"만 바꾼 순수 조회 최적화이고, "무엇을 노출 소스로 삼는가"(durable Execution 컬럼)는 R17 채택안 그대로다.

### [INFO] "공유 단일 helper" 불변식 — 코드 수준에서 성립 확인

- target 위치: `interaction.service.ts:39`(import), `:308-314`(재조회 결과에 적용)
- 과거 결정 출처: EIA §R17 "표면 제약(보안)" line 1145-1149 — "REST `getStatus` 와 SSE `waiting_for_input` emit 이 **공유하는 단일 helper `redactThreadForPublic`**"
- 상세: `grep -rn "redactThreadForPublic"` 결과, `getStatus()` 는 재조회한 `threadRow.conversationThread` 에 여전히 `redactThreadForPublic(...)` 을 통과시키고(line 312-314), SSE 측 emit-site 3곳(`button-interaction.service.ts:422`, `form-interaction.service.ts:138`, `ai-turn-orchestrator.service.ts:466,793`)도 같은 `thread-renderer.ts` 의 동일 함수를 호출한다. 소스 객체가 "1단계 execution row" → "2단계 재조회 row" 로 바뀌었을 뿐 마스킹 호출 경로는 그대로 유지된다.
- 실증: `interaction.service.spec.ts:873-897` 신규 테스트가 2단계 재조회 결과에 secret(`Bearer sk-live-...`)을 심어 마스킹(`***`) 여부를 직접 단언 — 이 불변식을 회귀 가드로 고정했다(RESOLUTION W1 대응).
- 제안: 없음(문제 없음).

### [INFO] durable 노출을 통한 buffer/재시작 무관 복원 — waiting-only fetch 로 훼손되지 않음

- target 위치: `interaction.service.ts:288-364`
- 과거 결정 출처: EIA §R17 "conversationThread 노출로의 재조정(2026-07-09)" line 1125-1139
- 상세: R17 이 정의한 노출 경계는 애초부터 "**`waiting_for_input` 시** durable thread 를 동봉"이며(§5.3 line 430 "waiting_for_input 상태에서는 ... 채워진다"), `conversation-thread.md` §8.4 도 "waiting_for_input 한정" 으로 명시한다. 즉 "waiting 일 때만 재조회"는 R17 이 이미 정의한 노출 조건과 **동일 경계**를 조회 시점 최적화로 옮긴 것뿐이다. non-waiting 상태(running/pending/completed/failed/cancelled)에서는 애초 응답에 `conversationThread` 를 담지 않았으므로, 그 상태들에서 thread 를 아예 fetch 하지 않는 것은 R17 이 채택한 "복원 지원 범위"를 축소하지 않는다. race window(1단계와 2단계 사이 상태 전이·row 삭제)에 대해서도 plan(`결정 메모`)이 "응답은 스냅샷이라 무해", "row 삭제 시 undefined → 기존 'durable thread 없음' graceful 경로(키 생략)로 흡수"를 명시했고, 이는 §5.3 이미 서술한 "durable thread 가 없는 경우 ... 키를 생략" 폴백의 자연스러운 확장이다.
- 제안: 없음(문제 없음).

### [INFO] 신규 구현 결정 3건 — 원칙 충돌 없음, 기록 위치는 plan/RESOLUTION 으로 충분

- target 위치: `interaction.service.ts:34-42`(`STATUS_PROJECTION_COLUMNS` 에 `outputData` 포함), `:294-298`(2단계 null → 404 미승격), `:294`(`Promise.all`)
- 과거 결정 출처: 해당사항 없음(spec Rationale 에 이 세 결정과 충돌하는 기존 항목 없음) — plan `eia-getstatus-column-projection.md` "결정 메모" 3항목 + `RESOLUTION.md` W2/W4 가 근거를 기록
- 상세:
  1. **`outputData` 를 1단계에 유지**: `completed`/`failed` 의 `result`/`error` 는 `execution.outputData` 에서 조립되며(line 373-386) 상태 무관하게 필요하므로 2단계로 미루면 절감 없이 왕복만 는다는 plan 의 근거가 코드와 일치.
  2. **2단계 재조회가 `null`(row 소멸)이어도 404 로 승격하지 않음**: 1단계에서 이미 execution 존재를 확인했고(line 274-278 `NotFoundException`), 2단계는 순수 thread 재조회이므로 그 결과가 `null` 이면 "durable thread 없음" 기존 graceful 경로(§5.3 이미 문서화)로 흡수한다(`interaction.service.spec.ts:922-940` 테스트로 고정). 새로운 에러 표면을 만들지 않는다 — EIA-IN-12(410 Gone)·EXECUTION_NOT_FOUND(404) 등 기존 에러 코드 표와도 충돌하지 않는다.
  3. **`Promise.all` 병렬**: thread 재조회와 대기 NodeExecution 조회는 서로 독립이라 병렬화했고, "쿼리 수 2→3, 왕복 depth 는 2 로 유지"라는 정밀화된 근거가 `RESOLUTION.md` W4 에 기록됐다.
  - 세 결정 모두 (i) wire 계약을 바꾸지 않고, (ii) 기존 spec 원칙(§5.3 폴백 규칙, EIA 에러 코드 표)과 상충하지 않으며, (iii) plan "결정 메모" + `RESOLUTION.md` 에 근거가 명시적으로 남아 있다. `interaction.service.ts` 내 다른 3개 호출부(`interact` refresh:175, `refreshToken`:228, `loadAndAssertAlive`:399)도 이미 동일하게 partial `select` 를 쓰면서 spec Rationale 항목 없이 코드 주석만으로 관리돼 온 선례가 있어(같은 모듈의 일관된 관행), 이번 결정만 별도 기준을 적용할 근거는 없다.
- 제안: 조치 불필요. plan/RESOLUTION 기록으로 충분 — spec Rationale 승격은 과잉.

### [INFO] spec `## Rationale` 추가 불요 — 내부 구현 결정이라는 예상과 합치

- target 위치: 해당 없음 (spec 변경 안 됨 — 실제로 `git diff` 상 `spec/**` 변경분 없음)
- 상세: 본 변경은 §5.3 응답 JSON 스키마·필드·키 생략 규칙 중 **어느 것도 바꾸지 않았다** — `context.conversationThread` 는 여전히 waiting 시에만, 동일 wire shape 으로 동봉되고 부재 시 키가 생략된다(line 347, 372-379 확인). Rationale 섹션은 "결정의 배경·근거"(제품·계약에 영향 주는 판단)를 위한 것인데, 본 PR 은 "언제 DB 를 몇 번 왕복하는가"라는 순수 서버 내부 쿼리 전략이라 §R17 의 기존 서술("waiting_for_input 시 durable thread 를 동봉한다")을 무효화하거나 확장하지 않는다. 동일 파일의 기존 3개 select-projection 호출부도 spec Rationale 항목 없이 유지돼 온 선례와 일치한다.
- 제안: spec Rationale 신설 불요. 현재처럼 `getStatus()` JSDoc(line 240-263, "조회는 2단계" 문단)에 근거를 남기고 plan/RESOLUTION 으로 추적하는 것으로 충분.

## 요약

완성된 `getStatus()` 2단계 projection 구현을 코드 수준에서 직접 추적한 결과, EIA §R17 이 명시적으로 기각한 두 대안((a) SSE 전용 회귀, (b) NodeExecution 분산 재구성) 중 어느 쪽도 재도입되지 않았고, "REST·SSE 가 `redactThreadForPublic` 단일 helper 를 공유해 egress 마스킹한다"는 합의된 invariant 도 재조회 경로에서 그대로 유지되며 신규 테스트로 회귀 가드까지 걸렸다. durable thread 노출을 통한 buffer/재시작 무관 복원이라는 R17 채택 원칙은 "waiting 일 때만 fetch" 로 축소되지 않는다 — R17 자체가 애초에 waiting-only 노출을 정의했기 때문이다. 새로 도입된 3개 구현 결정(outputData 1단계 유지, stage-2 null 의 404 미승격, `Promise.all` 병렬)은 기존 spec 원칙과 충돌하지 않고, plan "결정 메모"와 `RESOLUTION.md` 에 근거가 이미 명시적으로 남아 있어 별도 조치가 필요 없다. spec `## Rationale` 추가도 wire 계약 무변경(순수 내부 쿼리 최적화)이라 불필요하다는 판단이 코드 검증으로 뒷받침된다. Critical/Warning 급 발견사항 없음.

## 위험도

NONE

STATUS: OK
