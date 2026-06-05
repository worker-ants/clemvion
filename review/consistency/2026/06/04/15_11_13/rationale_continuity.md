# Rationale 연속성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
대상 spec: `spec/5-system/4-execution-engine.md`
검토 범위: PR2a active-running 누적 타임아웃 구현 diff (origin/main...HEAD)

---

### 발견사항

- **[INFO]** `>=` vs `>` — 판정 연산자의 spec 표현과 구현의 미묘한 차이
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `assertActiveTimeWithinLimit()` (`activeNow >= this.maxActiveRunningMs`)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §8` 본문 ("초과 시 `EXECUTION_TIME_LIMIT_EXCEEDED`"), `§11 env 표` ("초과 시"), `## Rationale "타임아웃을 active-running 누적 기준으로"` (동일하게 "초과" 사용)
  - 상세: spec 은 일관되게 "초과(strictly greater than, `>`)" 로 표현하지만, 구현(`assertActiveTimeWithinLimit`)은 `>=`(이상)로 트리거한다. `V073` 마이그레이션 주석도 `≥`를 사용해 구현 의도가 명확하다. 실질 차이는 누적값이 한도와 *정확히* 같을 때(ms 단위에서 극히 드문 경계 케이스) 발동 여부이며, `>=`가 보수적 선택이다. 그러나 spec Rationale 어디에도 `>=` 선택 근거가 없다.
  - 제안: spec `## Rationale "타임아웃을 active-running 누적 기준으로"` 항에 "판정은 `>=` (누적 == 한도 시점도 초과로 간주 — 경계 포함이 안전)" 한 줄을 추가하거나, spec §8 본문의 "초과" 표현을 "한도 이상(≥ EXECUTION_MAX_ACTIVE_RUNNING_MS)" 으로 정렬한다.

- **[INFO]** Graceful Shutdown under-count 허용 결정이 코드 주석에만 존재, spec Rationale 부재
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 클래스 JSDoc ("`Graceful Shutdown under-count 허용 (W4 명시)`" 블록)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §11 Graceful Shutdown` 및 `## Rationale "Durable Continuation & Graceful Shutdown"`
  - 상세: "SIGTERM 이후 진행 중 세그먼트가 재배달되면 `activeRunningMs` 가 DB 에 누락(under-count)될 수 있고, 이는 over-count(조기 종료)보다 덜 위험하므로 의도적 허용" 이라는 설계 결정이 코드 주석(W4)으로만 문서화돼 있다. spec Rationale 의 "Durable Continuation & Graceful Shutdown" 항은 WAITING_FOR_INPUT 보존에 집중하며 active-running 누적의 under-count 트레이드오프를 언급하지 않는다. PR3 에서 flush 훅 검토 예고까지 포함되어 있어 미래 번복 가능성이 있는 결정임에도 spec 단일 진실에 기록이 없다.
  - 제안: `spec/5-system/4-execution-engine.md ## Rationale "타임아웃을 active-running 누적 기준으로"` 항(또는 `"Durable Continuation & Graceful Shutdown"` 항)에 under-count 허용 결정과 PR3 에서 flush 훅 검토 예정을 명시한다.

- **[INFO]** `segmentStartMs` 직렬화 불변식(W5)이 코드 주석에만 존재, spec Rationale 부재
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 클래스 JSDoc ("`설계 불변식 (W5 명시)`" 블록)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §4.2 작업 단위 — execution-level 세그먼트`, `## Rationale "per-node task queue → execution-level intake 큐"`
  - 상세: "단일 Execution 은 한 번에 하나의 active 세그먼트만 처리된다(직렬화 불변). `execution-run`/`execution-continuation` 큐는 동일 Execution 에 대해 동시 job 을 발행하지 않으므로 `segmentStartMs` in-memory Map 의 상호 배제가 보장된다"는 invariant 가 구현 JSDoc 에는 명확히 기술돼 있으나, spec Rationale 에는 이 invariant 가 명시적 항목으로 등재되지 않았다. `segmentStartMs`의 정확성 전체가 이 invariant 에 의존하므로 spec SoT 에도 기록할 필요가 있다.
  - 제안: `spec/5-system/4-execution-engine.md §4.2` 또는 `## Rationale "타임아웃을 active-running 누적 기준으로"` 항에 "동일 Execution 에 동시 active 세그먼트가 존재하지 않음(큐 설계 보장) — `activeRunningMs` in-memory 누적의 정확성 전제" 불변식을 명시한다.

---

### 요약

이번 PR2a 구현은 `spec/5-system/4-execution-engine.md §8 ## Rationale "타임아웃을 active-running 누적 기준으로"` 의 핵심 결정들(wall-clock 아닌 active-running 누적, `waiting_for_input` 제외, `EXECUTION_TIME_LIMIT_EXCEEDED` 신규 코드 분리, env 1단계/per-workflow 2단계 구조, per-node task queue 기각 및 execution-level 세그먼트 채택)을 충실히 따르고 있으며, 기각된 대안의 재도입·합의 원칙 위반은 발견되지 않는다. 다만 (1) spec 이 "초과(`>`)"로 표현한 판정 조건을 구현이 `>=`로 처리하면서 그 근거가 Rationale 에 없고, (2) Graceful Shutdown 하에서의 under-count 허용 및 (3) `segmentStartMs` 안전성의 전제 불변식이 구현 코드 주석에는 잘 문서화됐으나 spec Rationale 단일 진실에는 미반영 상태다. 기각된 결정의 재도입이나 invariant 위반은 없으며 전반적으로 Rationale 연속성이 유지된다.

### 위험도

LOW

---

STATUS: SUCCESS
