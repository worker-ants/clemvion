### 발견사항

발견된 CRITICAL / WARNING 등급 항목 없음.

아래는 확인 과정에서 검토한 주요 Rationale 항목과 대조 결과를 기록한다.

---

**[INFO] `PARK_RELEASED` / `ProcessTurnResult` 모듈 이관 — Rationale 설명 범위에서 소폭 이탈 (문서화 공백)**
- target 위치: `codebase/backend/src/shared/execution-resume/process-turn-result.ts` (신규), `execution-engine.service.ts` 상단 주석 "이관됨" 1줄
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)"` — `PARK_RELEASED` 는 "B1·B2 분리 불가 / park-site 단위 sentinel" 로 소개되나, 위치(파일)에 대한 언급은 없음. spec §4.x 메모에서도 `PARK_RELEASED` 를 `execution-engine.service` 내부 상수로 묵시적 전제.
- 상세: `PARK_RELEASED` 심볼을 `shared/execution-resume/process-turn-result.ts` 로 이관한 것은 top-level(`driveResumeAwaited`)·중첩(`driveResumeFrame`) 양쪽 공유가 강제된 구조적 이유(exec-park B-1 dispatch 일원화)에서 비롯됐다. Rationale 에서 기각된 대안("per-node task queue", "sticky fast-path", "in-memory resolver 재등록", "분리 컬럼 신설" 등) 과 충돌하지 않으며, 의미론(Symbol sentinel 반환 → 호출 루프가 세그먼트 종료 처리)은 완전 보존된다. 단, spec Rationale 에 "sentinel 의 파일 위치를 shared 모듈로 격상한다"는 서술이 없어 추후 spec 독자가 "왜 shared 에 있는가"를 파악하려면 코드 주석(`process-turn-result.ts` 파일 헤더)에 의존해야 한다.
- 제안: `spec/5-system/4-execution-engine.md §Rationale "park 즉시 해제"` 또는 신규 `exec-park B-1` 항에 "B-1 follow-up 으로 sentinel 을 `shared/execution-resume/process-turn-result.ts` 로 이관해 top-level·중첩 dispatch 공유를 허용했다"는 한 문장을 추가해 추적성을 완성하면 좋다 (필수 아님; 코드 주석이 이를 설명하고 있어 운영 지장은 없음).

---

**[INFO] `resumeTurnRegistry` 지연 초기화(lazy `??=`) — 기존 Rationale 원칙과 정합하나 명시 부재**
- target 위치: `execution-engine.service.ts` `private _resumeTurnRegistry?: readonly ResumeTurnDispatch[]` / `get resumeTurnRegistry()`
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "per-node task queue → execution-level intake 큐"` — "dispatch 는 in-process, service-bound 가 전제"라는 맥락
- 상세: registry 가 `this.processFormResumeTurn` 등 서비스 메서드를 closure 로 캡처하므로 생성자 호출 후 첫 접근 전에 registry 를 빌드하는 지연 초기화 전략은 합리적이다. 기각된 대안("외부에서 독립 구성하는 registry") 은 `resume-turn-dispatch.ts` 주석(ai-review W6)에서 명시 기각됐고, 코드와 일치한다. Rationale 에서 이 세부 결정을 요구하지는 않으므로 갭은 아니지만, 테스트 `afterEach` 에서 `_resumeTurnRegistry = undefined` 로 리셋하는 점(단일 인스턴스 singleton 재사용 가정 파괴 방지)이 장기적으로 관리 포인트가 될 수 있다.
- 제안: `afterEach` 리셋 패턴은 ai-review W4 피드백으로 이미 도입된 것이므로 현 상태 유지. 별도 Rationale 갱신 불요.

---

### 확인 완료 항목 (위반 없음)

| Rationale 항목 | 확인 결과 |
|---|---|
| per-node task queue 기각 (§Rationale) | registry 는 in-process dispatch 유지, 분산 변환 없음 |
| Sticky fast-path 제거 / 항상 rehydration (Phase B) | 새 dispatch 도 rehydration 경로 내에서만 호출, in-memory resolver 미등록 |
| 선택 우선순위 form → buttons → ai (§7.5) | registry 배열 순서가 정확히 동일 |
| 에러 코드 `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` | 동일 코드·동일 케이스에서 throw |
| `PARK_RELEASED` 반환 시 세그먼트 종료 (Phase B, D4) | `dispatchResumeTurn` 가 `PARK_RELEASED` 를 그대로 전파, 호출측이 `return` |
| D3 — fresh-config-per-turn (`buildRetryReentryState`) | `handleAiResumeTurn` 에서 여전히 turn 마다 호출 |
| `buildRetryReentryState` 재구성기 공유 (§Rationale Multi-turn 재시작) | 공유 계속 |
| direct-drive vs `executeInline` 재호출 (W2 SPEC-DRIFT) | `driveResumeFrame` 동작 변경 없음 |
| `_continuationCheckpoint` 컬럼 신설 기각 (§Rationale) | 새 컬럼 없음, 기존 `outputData` JSONB 유지 |
| WS 신규 이벤트 도입 안 함 (§Rationale Durable Continuation) | 새 이벤트 없음 |
| `waitForX` 가 기각된 "waitForX('await') 폴링" 재도입 여부 | 재도입 없음; `processFormResumeTurn`/`processButtonResumeTurn`/`processAiResumeTurn` 직접 호출 유지 |

### 요약

이번 변경(exec-park B-1 follow-up)은 `driveResumeAwaited`·`driveResumeFrame` 두 곳에 동일하게 하드코딩돼 있던 form/buttons/ai_conversation if/else 분기를 `resumeTurnRegistry`(ordered first-match-wins 배열) + `dispatchResumeTurn` 단일 진입점으로 추출한 순수 리팩터링이다. spec `## Rationale` 에서 명시적으로 기각된 대안(per-node task queue, sticky fast-path, in-memory resolver 재등록, 분리 컬럼 신설, 장수 루프 재도입 등) 은 어느 것도 재도입되지 않았다. 선택 우선순위·에러 코드·`PARK_RELEASED` 반환 의미론·fresh-config-per-turn 등 합의 invariant 가 모두 동작 보존됐다. INFO 등급 두 건은 모두 spec 문서화 공백("왜 shared 모듈로 이관했는가"의 Rationale 기록 부재)에 해당하며, 코드 주석이 보완하고 있어 운영상 위험은 없다.

### 위험도

NONE
