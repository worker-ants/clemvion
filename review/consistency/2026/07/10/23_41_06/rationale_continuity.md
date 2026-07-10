# Rationale 연속성 검토 (사후, `--impl-done` 재확인) — `getStatus()` 2단계 컬럼 projection

## 검토 대상

- Spec: `spec/5-system/14-external-interaction-api.md` §5.3 (line 427-471), §R17 (line 1104-1177)
- Convention: `spec/conventions/conversation-thread.md` §8.4 (line 339-357)
- Changeset: `git diff origin/main...HEAD`
  - `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`getStatus()`)
  - `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`
  - `plan/complete/eia-getstatus-column-projection.md`
- **코드 내용 재확인**: `git diff f2764f3a9 HEAD -- codebase/` → 빈 결과. 직전 impl-done(`review/consistency/2026/07/10/23_20_43/`, `BLOCK: NO`) 이후 코드 내용 변경 없음(mtime 만 갱신) — 독립적으로 처음부터 재검증.

## 발견사항

### [INFO] 기각 대안 (a)/(b) — 재도입 없음 (코드로 확인)

- target 위치: `interaction.service.ts:264-364` (`getStatus()` 전체)
- 과거 결정 출처: EIA §R17 "기각 대안" (line 1136-1139)
  - (a) *SSE 전용 유지 + buffer 만료 시 위젯이 재조회* — 순환이라 기각
  - (b) *`NodeExecution.output_data` 분산 저장에서 thread 재구성* — 무손실 복원 불가로 기각 (conversation-thread §8.4 와 동일 사유로 재기각)
- 상세: 2단계 조회의 2단계(`interaction.service.ts:294-298`)는 `this.executionRepository.findOne({ where: { id: ctx.executionId }, select: ['id', 'conversationThread'] })` — 여전히 **durable `Execution.conversation_thread` 컬럼**을 직접 재조회한다. `NodeExecutionRepository.findOne`(line 299-306)은 대기 노드의 `currentNode`/`buttonConfig`/`nodeOutput` 조립 전용이며 thread 재구성에는 전혀 관여하지 않는다(line 315-362 에 `conversationThread` 조립 로직 없음, `threadRow.conversationThread` 만 사용). REST 응답은 여전히 waiting 시 `context.conversationThread` 를 실값으로 포함(line 347). "조회 시점을 status 조건부로 미룬 것"과 "SSE-only 로 회귀"는 다르다 — 후자는 REST 표면에서 필드 자체를 제거하는 것이지만, 본 변경은 필드를 유지한 채 fetch 타이밍만 바꿨다.
- 제안: 없음(문제 없음).

### [INFO] "REST·SSE 공유 단일 helper" 불변식 — 코드 수준 성립 확인

- target 위치: `interaction.service.ts:39`(import), `:312-314`(재조회 결과 적용) / `form-interaction.service.ts:138`, `button-interaction.service.ts:422`, `ai-turn-orchestrator.service.ts:466,793`
- 과거 결정 출처: EIA §R17 "표면 제약(보안)" line 1145-1149 — "REST `getStatus` 와 SSE `waiting_for_input` emit 이 **공유하는 단일 helper `redactThreadForPublic`**"
- 상세: `grep -rn "redactThreadForPublic" codebase/backend/src/` 결과 정의처는 `shared/conversation-thread/thread-renderer.ts` 단일 함수뿐이고, 호출부는 (1) `interaction.service.ts` `getStatus()` — 2단계 재조회 결과 `threadRow.conversationThread` 에 적용, (2) SSE `waiting_for_input` 페이로드를 구성하는 3개 emit-site(`form-interaction.service.ts:138`, `button-interaction.service.ts:422`, `ai-turn-orchestrator.service.ts:466`) — 모두 `context.conversationThread` 를 마스킹해 `this.eventEmitter.emitExecution(...)` (R10 단일 sink `WebsocketService.emit*` facade)로 전달. 두 표면이 코드 수준에서 동일 helper·동일 소스 컬럼(`Execution.conversation_thread`)을 거치는 것이 확인됨. 소스 객체가 "1단계 execution row" → "2단계 재조회 row" 로 바뀌었을 뿐 마스킹 호출 지점은 그대로다.
- 실증: `interaction.service.spec.ts` 신규 `describe('... 컬럼 projection (2단계 조회)')` 블록의 `'2단계 재조회 결과의 thread 도 redactThreadForPublic 를 통과'` 테스트가 secret(`Bearer sk-live-...`)을 심어 마스킹 여부를 직접 단언 — 회귀 가드로 고정됨.
- 제안: 없음(문제 없음).

### [INFO] durable 노출 → buffer/재시작 무관 복원 — waiting-only fetch 로 훼손되지 않음

- target 위치: `interaction.service.ts:264-364`
- 과거 결정 출처: EIA §R17 "`conversationThread` 노출로의 재조정(2026-07-09)" (line 1125-1139) / conversation-thread §8.4 "소비처 갱신(2026-07-09)" (line 351)
- 상세: R17 이 정의한 노출 경계는 애초부터 "**`waiting_for_input` 상태에서만** durable thread 를 `context.conversationThread` 에 동봉"이다(§5.3 line 430, conversation-thread §8.4 line 351 "waiting_for_input 한정"). 즉 "waiting 일 때만 2단계로 재조회"는 R17 이 이미 정의한 **응답 계약상의 노출 조건**을 **조회 타이밍**으로 그대로 옮긴 것이다 — 노출 범위를 축소하지 않는다. non-waiting 상태(running/pending/completed/failed/cancelled)에서는 애초 응답에 `conversationThread` 필드가 없었으므로 그 상태들에서 DB fetch 자체를 생략하는 것은 R17 이 채택한 "복원 지원 범위"(waiting 시 전체 히스토리 무손실 복원)를 줄이지 않는다.
- race 처리: 1단계와 2단계 사이 execution 이 종료되거나 row 가 사라져도(극히 드묾) `threadRow?.conversationThread ? ... : undefined` 로 "durable thread 없음" graceful 경로에 흡수된다(line 312-314) — 이는 §5.3 이 이미 문서화한 "durable thread 가 없는 경우(배포 이전 row·park 이력 없음)에는 키 생략" 폴백과 동일 메커니즘이며 별개의 새 상태·에러 표면을 만들지 않는다.
- 제안: 없음(문제 없음).

### [INFO] 신규 구현 결정 3~4건 — 기존 Rationale·합의 원칙과 충돌 없음, 기록 위치 적절

- target 위치: `interaction.service.ts:56-73`(`STATUS_PROJECTION_COLUMNS`, `outputData` 1단계 포함), `:288-314`(2단계 null → 404 미승격), `:294`(`Promise.all` 병렬)
- 과거 결정 출처: 해당 spec Rationale 에 직접 충돌하는 기존 항목 없음 — plan `eia-getstatus-column-projection.md` "결정 메모"(line 34-41) + `review/code/2026/07/10/22_47_32/RESOLUTION.md` (W2/W4) 가 근거 기록처
- 상세 검증:
  1. **`outputData` 1단계 유지**: `completed`/`failed` 의 `result`/`error` 조립(line 373-386)이 `execution.outputData` 를 상태 무관하게 필요로 하므로, 2단계로 미루면 절감 없이 왕복만 늘어난다는 근거가 코드와 정확히 일치. §R17 이 정의한 "terminal outputData 도 공개 표면(마스킹 적용)" 원칙(line 371-372 주석)과도 충돌 없음 — `deepRedactSecrets` 마스킹 그대로 적용됨.
  2. **2단계 재조회 `null` → 404 미승격**: 1단계에서 이미 `NotFoundException`(EXECUTION_NOT_FOUND)으로 존재를 확정했고(line 274-278), 2단계는 순수 thread 재조회이므로 결과가 `null` 이어도 §5.3 이 이미 정의한 "durable thread 없음" 폴백 경로(위 항목 참조)로 흡수한다. `EXECUTION_NOT_FOUND`(404)·`EXECUTION_TERMINATED`(410) 등 §5.1 에러 코드 표와도 새 충돌이 없다.
  3. **`Promise.all` 병렬**: thread 재조회와 대기 `NodeExecution` 조회가 서로 독립이라 병렬화 — "쿼리 수 2→3, 왕복 depth 는 2 유지"라는 근거가 RESOLUTION.md W4 에 명시. EIA-NF-01/02 (latency 예산) 원칙에 순방향으로 부합(왕복 증가를 상쇄).
  4. **`STATUS_PROJECTION_COLUMNS` 상수화 + `satisfies (keyof Execution)[]`**: 컬럼명 오기를 컴파일 타임에 잡는 방어적 설계로, 기존 spec 원칙과 직접 관련된 결정이라기보다 순수 구현 하드닝 — 충돌 대상 자체가 없음.
  - 네 결정 모두 (i) wire 계약을 바꾸지 않고, (ii) 기존 spec 원칙(§5.3 폴백 규칙, §R17 마스킹 강제, EIA 에러 코드 표)과 상충하지 않으며, (iii) plan "결정 메모"·`RESOLUTION.md` 에 근거가 이미 명시적으로 남아 있다. 같은 파일의 다른 3개 호출부(`interact` refresh, `refreshToken`, `loadAndAssertAlive`)도 spec Rationale 항목 없이 코드 주석·select 배열만으로 관리돼 온 선례가 있어, 이번 결정에만 spec Rationale 승격을 요구할 근거는 없다.
- 제안: 조치 불필요. plan/RESOLUTION 기록 수준으로 충분 — spec Rationale 승격은 이 규모(순수 내부 쿼리 전략, wire 무변경)에는 과잉이다.

### [INFO] spec `## Rationale` 추가 불요 — 판단 재확인

- target 위치: 해당 없음 — `git diff origin/main...HEAD -- spec/` 확인 결과 대상 spec(`14-external-interaction-api.md`) 본문/Rationale 변경 없음
- 상세: 본 변경은 §5.3 응답 JSON 스키마·필드·키 생략 규칙 중 어느 것도 바꾸지 않는다 — `context.conversationThread` 는 여전히 waiting 시에만 동일 wire shape 으로 동봉되고, 부재 시 키가 생략된다(코드 line 347, 372-386 확인). Rationale 은 "제품·계약에 영향 주는 판단의 배경"을 위한 절인데, 본 PR 은 "언제 DB 를 몇 번 왕복하는가"라는 순수 서버 내부 쿼리 전략이므로 §R17 의 기존 서술을 무효화·확장하지 않는다.
- 제안: spec Rationale 신설 불요. 현재처럼 `getStatus()` JSDoc(line 241-263, "조회는 2단계" 문단)에 근거를 남기고 plan/RESOLUTION 으로 추적하는 현 상태가 적절.

## 요약

`git diff f2764f3a9 HEAD -- codebase/` 가 빈 결과로 코드 내용은 직전 clean impl-done 검토(`review/consistency/2026/07/10/23_20_43/`, `BLOCK: NO`) 이후 전혀 바뀌지 않았음을 재확인한 뒤, 완성된 `getStatus()` 2단계 projection 구현을 spec §R17 의 결정 계보(경위 → race 배경 → 2026-07-09 재조정 → 기각 대안 → 표면 제약(보안))에 대해 처음부터 독립적으로 재추적했다. EIA §R17 이 명시적으로 기각한 두 대안((a) SSE 전용 회귀, (b) `NodeExecution.output_data` 분산 재구성) 중 어느 쪽도 재도입되지 않았다 — 2단계 조회는 여전히 durable `Execution.conversation_thread` 컬럼을 직접 재조회한다. "REST `getStatus` 와 SSE `waiting_for_input` emit 이 `redactThreadForPublic` 단일 helper 를 공유한다"는 합의된 런타임 invariant 는 재조회 경로에서도 코드·grep·테스트 3중으로 확인되며 그대로 유지된다. R17 이 채택한 "durable thread 노출 → buffer 만료·재시작 무관 복원"은 R17 자체가 애초부터 "waiting_for_input 한정" 노출로 정의했으므로, "waiting 일 때만 fetch"라는 조회 최적화가 그 원칙을 축소시키지 않는다. 새로 도입된 구현 결정(`outputData` 1단계 유지·2단계 null 의 404 미승격·`Promise.all` 병렬·`STATUS_PROJECTION_COLUMNS` 상수)은 기존 spec 원칙·에러 코드 표와 충돌하지 않고 plan "결정 메모"와 `RESOLUTION.md` 에 근거가 이미 명시적으로 남아 있어, 별도 조치나 spec Rationale 신설이 필요하지 않다는 판단을 재확인했다. Critical/Warning 급 발견사항 없음.

## 위험도

NONE

STATUS: OK
