# 성능(Performance) 리뷰 결과

리뷰 대상: rag-rerank-followup 변경 세트 (26개 파일, 전량 spec/review 문서)  
리뷰 일시: 2026-06-05

---

## 발견사항

### [INFO] 대상 변경이 실행 코드 없음 — spec/docs 전용 diff
- 위치: 전체 26개 파일
- 상세: 이번 변경 세트는 `spec/`, `review/consistency/` 하위 마크다운 문서만 포함한다. TypeScript/JavaScript 실행 코드 변경이 없으므로 런타임 성능에 직접적인 영향을 주는 코드 경로는 존재하지 않는다.
- 제안: 해당 없음.

### [INFO] spec 에 기술된 설계 결정 중 성능 관련 아키텍처 의도 확인
- 위치: `spec/5-system/4-execution-engine.md` diff — §4.2, §6.2, §7.5, §8, §Rationale
- 상세: spec 변경이 기술하는 설계 의도는 다음 성능 특성을 명시적으로 다룬다.
  - **park 즉시 코루틴 해제 + slow-path 일원화 추진**: `runExecution` 코루틴이 park 중에도 in-process 로 살아 있어 park 수 증가 시 메모리 누적 위험이 있음을 spec 이 명시하고, Phase B 전환이 이를 해소함을 기록한다. 현재는 여전히 코루틴 누적 경로가 살아 있다는 점이 spec 에 솔직하게 기술됨.
  - **`Execution.conversation_thread` 단일 컬럼 last-write 스냅샷**: park 마다 thread 전체를 단일 row 로 덮어쓰는 방식이 O(1) 재개 로드를 보장한다고 spec §8.4 에 명시. NodeExecution 분산 저장 + derived-view 재구성 대안(N+1 가능)을 기각하고 채택한 근거가 문서화됨 — 올바른 성능 선택의 설계 의도가 spec 에 반영된 것.
  - **active-running 타임아웃 판정 비원자성 허용**: `assertActiveTimeWithinLimit` + `updateExecutionStatus` 사이 잠금 없는 read-check-then-act 가 있으나, `jobId=executionId` dedup 으로 동일 Execution 의 active 세그먼트가 항상 1개임을 이용해 실질 race 가 없다고 Rationale 에 기술됨. 이는 불필요한 잠금 오버헤드를 제거하는 성능 의도적 선택.
  - **`extractionModel` / `summaryModel` fallback 체인**: `extractionModel → model → llmConfig.defaultModel` fallback 체인이 optional 필드 미설정 시 기존 동작을 100% 보존하도록 설계됨. 추가 LLM 모델 선택 경로가 생겼으나 미설정 시에는 기존과 동일한 호출 경로를 타므로 성능 회귀 없음.
  - **메모리 추출 비동기 (hot path 비차단)**: spec §17-agent-memory `scheduleBackgroundBody` background 격리로 추출 LLM 콜이 응답 latency 에 얹히지 않음을 재확인. 이 invariant 는 spec 변경 전후로 유지됨.
- 제안: 해당 없음 (설계 의도가 올바르게 문서화됨).

### [INFO] Graceful Shutdown 시 `active_running_ms` under-count 허용 — trade-off 문서화
- 위치: `spec/5-system/4-execution-engine.md` — "Graceful Shutdown 시 active-running 시간 under-count 허용 (PR2a 결정)" 항목
- 상세: 진행 중 세그먼트가 SIGTERM 으로 중단되면 `segmentStartMs` 경과분이 DB flush 없이 소실될 수 있고, 재배달 워커가 그 구간을 누적하지 못해 enforcement 가 under-count 된다는 사실을 spec 이 명시적 trade-off 로 기록했다. flush 훅(`OnModuleDestroy`)을 추가하면 복잡도가 커지고 재배달 워커의 `segmentStart` 재기록과 경합 가능성이 있어 PR3 로 유보한 점도 기술됨. 실행 코드가 아닌 spec 이므로 현재 구현 동작에는 영향 없으나, PR3 구현 시 이 항목이 정확하게 참조될 수 있다.
- 제안: 해당 없음 (trade-off 이미 적절히 문서화됨).

---

## 요약

이번 변경 세트는 spec 문서·consistency review 문서 26개로 구성되며 실행 코드 변경이 없다. 성능 관점에서 직접적인 런타임 영향은 없다. spec 이 기술하는 설계 결정들(park 코루틴 누적 위험 + Phase B 전환 계획, `Execution.conversation_thread` O(1) last-write 스냅샷 채택, 타임아웃 판정 잠금 없는 비원자성의 의도적 허용, 메모리 추출 hot path 비차단 invariant 유지)은 모두 성능 최적화 방향으로 올바르게 문서화되어 있다. 구현 코드가 이 spec 의도를 따를 경우 성능 회귀 위험은 없다.

---

## 위험도

NONE
