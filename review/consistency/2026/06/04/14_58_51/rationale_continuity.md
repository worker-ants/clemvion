# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-update-pr2a-timeout.md`

---

## 발견사항

### [CRITICAL] `execution-run` 큐 추가가 확립된 "두 큐 전용" Rationale 과 충돌

- **target 위치**: 제안 변경 §2 — `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그에 `execution-run` 행 추가, 및 큐 목록 인라인 문자열 삽입
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` § Rationale "Phase 2 cont 후속 정리" 항목 1 (`task-queue` 미존재 확정 §9.3), 그리고 §9.3 BullMQ 큐 목록 각주: *"실제 BullMQ 큐는 `background-execution` 과 `execution-continuation` 두 개뿐이고, 일반 노드 실행은 `runExecution` 의 in-process while-loop 에서 직접 dispatch 한다. 별도 `task-queue` 는 존재하지 않는다."*
- **상세**:
  - 현 spec §9.3 과 Rationale 은 "두 큐만 존재" 를 **확정(not aspirational)** 으로 명시한다. `execution-run` 이라는 intake 큐는 codebase 어디에도 존재하지 않으며(검색 결과 0건), spec 어느 문서에도 등장하지 않는다.
  - target 은 이 큐를 PR1(`impl-exec-intake-queue`) 에서 추가됐다고 주장하지만, `spec/5-system/4-execution-engine.md §4` 미구현 배너(line 348)는 "별도 BullMQ 큐는 `background-execution`(§3.3) 과 `execution-continuation`(§7.4) 둘뿐이고, per-node Worker 는 어느 것도 구현돼 있지 않다" 라고 현재 시점 기준으로 재확인한다. `plan/in-progress/spec-sync-execution-engine-gaps.md`(미구현 추적)도 §8 항목에서 `execution-run` 큐 도입을 구현 완료로 기록하지 않는다.
  - target 의 `execution-run` 큐 행 설명 ("Execution row `pending` 저장 후 발행", `ExecutionRunProcessor`, `ExecutionEngineService.execute`) 은 모두 현재 코드에 대응 구현이 없는 aspirational 패턴이다. 이를 구현 완료된 큐로 카탈로그에 추가하면 "현재 큐 = 두 개" 의 Rationale-backed invariant 를 이유 명시 없이 번복한다.
  - `spec/0-overview.md §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"` 도 `execution-continuation` / `background-execution` 만 언급하며 `execution-run` 을 합의 아키텍처로 기록하지 않는다.
- **제안**:
  - `execution-run` 큐가 실제로 구현·머지된 사실을 코드에서 먼저 확인한다. 확인되면 `spec/5-system/4-execution-engine.md §9.3` 의 "두 큐 전용" 각주와 Rationale 항목을 함께 갱신해야 한다(새 Rationale 항목: "execution-run intake 큐 도입 — PR1, in-process dispatch loop 에서 BullMQ intake 큐로 전환된 이유").
  - 구현이 확인되기 전까지 target 의 §2 변경(큐 카탈로그 추가)은 적용을 보류해야 한다.

---

### [WARNING] §8 "설정 위치" 변경 (`Workflow.settings` → env 상수) 시 Rationale 항목 부재

- **target 위치**: 제안 변경 §1 — `spec/5-system/4-execution-engine.md §8` 표의 "설정 위치" 컬럼을 `Workflow.settings` → `(1단계) env EXECUTION_MAX_ACTIVE_RUNNING_MS; (2단계, 후속) per-workflow Workflow.settings` 로 교체
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §8` 원본 표 line 932: `| 단일 Execution 최대 실행 시간 | 30분 | Workflow.settings |`. §8 Rationale 에는 이 설정 위치 선택의 근거 항목이 없다(전체 절이 "Planned" aspirational 로만 마킹됨).
- **상세**:
  - 원본 §8 는 전체가 aspirational (미구현) 이므로 `Workflow.settings` 자체가 확정된 설계 결정이 아니었다. 따라서 env 상수로의 변경은 "확립된 Rationale 번복" 보다는 "aspirational 항목의 실제 구현 반영" 에 가깝다.
  - 그러나 target 은 1단계(env 상수)와 2단계(per-workflow) 분리를 도입하면서 **왜 per-workflow 를 1단계에서 제외했는지** 에 대한 Rationale 을 작성하지 않는다. `spec/0-overview.md §Rationale "실행 엔진"` 과 `spec/5-system/4-execution-engine.md §Rationale` 모두 이 선택 근거를 담지 않게 된다.
  - 향후 per-workflow 설정 구현 시 이 분리 결정의 배경(예: 초기 단순화, 시스템 상수로 검증 후 세분화)이 추적 불가능해진다.
- **제안**: `spec/5-system/4-execution-engine.md §Rationale` 에 항목 추가: "§8 단일 Execution 타임아웃 — 1단계 env 상수, 2단계 per-workflow 분리". 내용: per-workflow 설정을 즉시 도입하지 않은 이유(예: intake 큐 미완성 상태에서 per-workflow 가드 도입이 불완전) + `EXECUTION_TIME_LIMIT_EXCEEDED` 코드를 `EXECUTION_TIMEOUT` 과 분리한 이유를 함께 명시.

---

### [WARNING] `EXECUTION_TIMEOUT` → `EXECUTION_TIME_LIMIT_EXCEEDED` 코드 변경이 §8 기존 표기를 이유 없이 번복

- **target 위치**: 제안 변경 §1 — "제한 초과 시 동작" 텍스트에서 `EXECUTION_TIMEOUT` 을 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 변경; 제안 변경 §3 — EIA §6.4 페이로드 예시에 `EXECUTION_TIME_LIMIT_EXCEEDED` 추가
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §8` line 937: `"최대 실행 시간 초과 → \`EXECUTION_TIMEOUT\` 에러"`. 코드명 자체가 spec 에 명시되어 있다.
- **상세**:
  - target 본문(§1 변경 후 텍스트)에 "(엔진 레벨 누적 타임아웃 전용 신규 코드. Code 노드 스크립트 타임아웃 `EXECUTION_TIMEOUT` 과 의미가 달라 코드 분리 — §3-error-handling §1.4)" 라는 이유가 인라인으로 적혀 있다. 이는 충분한 근거이다.
  - 그러나 이 근거가 **target plan 본문에만 존재하고**, 변경되는 spec 문서(`spec/5-system/4-execution-engine.md §Rationale`, `spec/5-system/3-error-handling.md`, `spec/5-system/14-external-interaction-api.md §Rationale`) 어디에도 기록되지 않는다. spec 을 읽는 사람은 왜 `EXECUTION_TIMEOUT` 이 아닌 새 코드를 쓰는지 알 수 없다.
  - `spec/5-system/3-error-handling.md §1.4` 에도 이 두 코드의 의미 차이 및 분리 결정이 추가되어야 한다고 target 이 언급(괄호 참조)하지만, 실제 §3 갱신 제안은 target 에 없다.
- **제안**: `spec/5-system/4-execution-engine.md §Rationale` 의 §8 타임아웃 항목(위 WARNING 항목과 병합 가능)에 "`EXECUTION_TIME_LIMIT_EXCEEDED` vs `EXECUTION_TIMEOUT` 코드 분리" 소절 추가. `spec/5-system/3-error-handling.md §1.4` 에 두 코드의 적용 범위 구분 명시를 target 변경 범위에 포함시켜야 한다.

---

### [INFO] `spec/data-flow/0-overview.md §4` 인라인 텍스트 큐 순서 변경

- **target 위치**: 제안 변경 §2 — 인라인 큐 열거에서 `execution-run` 을 `execution-continuation` **앞**이 아닌 **뒤**에 삽입 (After 텍스트: `execution-continuation`, `execution-run` 순서)
- **과거 결정 출처**: `spec/data-flow/0-overview.md` line 182 각주: "큐가 늘어나면 본 표와 해당 도메인 spec 의 `외부 의존` 섹션 모두 갱신한다."
- **상세**: 인라인 텍스트의 큐 열거 순서가 CRITICAL 이슈와 무관하게 minor inconsistency 를 내포한다. target After 텍스트에서 `execution-run` 은 알파벳순으로 `execution-continuation` 뒤에 위치하는데, 표 에서는 첫 행에 추가한다고 명시한다. 이는 인라인 열거와 표 순서가 달라지는 사소한 비일관성이다. CRITICAL 항목이 해소된 후 적용 시 인라인과 표 순서를 통일하면 된다.
- **제안**: `execution-run` 이 실제 구현 확인 후 추가될 경우, 인라인 열거와 표 행 순서를 동일 기준(알파벳순 또는 생성 시점순)으로 통일한다.

---

## 요약

target 문서의 §8 구현 상태 배너 갱신(W1)·설정 위치 컬럼 갱신(W2·W3)·EIA §6.4 error code 추가(W9)는 코드 현실을 spec 에 반영하는 SPEC-DRIFT 수정으로 방향 자체는 타당하다. 그러나 `execution-run` intake 큐 추가(W8)는 `spec/5-system/4-execution-engine.md §Rationale` 이 "두 큐 전용" 을 명시적으로 확정한 invariant 와 직접 충돌하며, 해당 큐가 codebase 및 spec 어디에서도 현재 구현으로 확인되지 않는다. 이 항목은 CRITICAL 수준의 Rationale 연속성 위반이다. 추가로 `EXECUTION_TIMEOUT` → `EXECUTION_TIME_LIMIT_EXCEEDED` 코드명 변경과 "설정 위치 1단계/2단계 분리" 는 충분한 이유가 있으나 변경 대상 spec 문서의 Rationale 에 해당 근거가 기록되지 않아 향후 추적 불가능성이 남는다.

---

## 위험도

**HIGH**

(CRITICAL 항목 1건: 구현 미확인 큐를 "구현 완료" 로 spec 에 등재하여 기존 확정된 "두 큐 전용" Rationale invariant 를 번복. WARNING 항목 2건: 새 Rationale 미작성 상태의 결정 번복.)
