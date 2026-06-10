# Convention Compliance — impl-prep 검토

**검토 모드**: `--impl-prep`
**검토 대상**: 승인 백로그 묶음 구현
- `03 M-6·m-2`: dead code 제거 — `registerContinuationHandlers`/`on()`/`toEiaEvent`/`system-status` 상수
- `06 M-5`: parallel branch `nodeOutputCache` dev/test deep freeze
- `04 m-4`: integration credential 회전 pub/sub Pool 무효화
- `06 M-1`: WS `resumed` ack spec 문구 정리 (planner)
- `review_guard _porcelain_path` off-by-one fix

**검토 일시**: 2026-06-10

---

## 발견사항

### **[WARNING]** 06 M-1 — planner 작업이 developer 구현 묶음에 혼재
- **target 위치**: 구현 범위 명세 "06 M-1(WS resumed ack spec 문구 정리 — planner)"
- **위반 규약**: `CLAUDE.md` §Skill 체계 — "`spec/` 변경 → `project-planner`. `developer` 는 `spec/` read-only"
- **상세**: `06 M-1` 의 확정안(A)은 `spec/5-system/6-websocket-protocol.md §4.2` 의 `resumed` 정의 문구 + `spec/5-system/4-execution-engine.md §7.5` 문장을 정정하는 **spec 변경**이다. `plan/in-progress/refactor/06-concurrency.md M-1` 이 명시적으로 "spec 갱신: 본 항목의 본체 (planner)" 로 표기하고 있다. 이 작업이 developer 구현 묶음 범위로 포함돼 있으면, developer turn 에서 spec 파일을 직접 수정하게 될 위험이 있다.
- **제안**: `06 M-1` 을 이번 developer 구현 묶음에서 분리하고, project-planner 에게 별도 위임하거나 현재 구현 묶음을 두 단계(planner 먼저 → developer 후속)로 순서화한다. 단, `use-execution-events.ts` 의 프론트 가드 확인(step 2)은 developer 작업이므로 분리 포함.

### **[WARNING]** 04 m-4 — pub/sub 구현 시 spec 갱신 의무(planner 선행 미완)가 미해소
- **target 위치**: 구현 범위 명세 "04 m-4(integration credential 회전 pub/sub Pool 무효화)"
- **위반 규약**: `CLAUDE.md` §Skill 체계 — `spec/` 변경은 project-planner 의무; `spec/conventions/spec-impl-evidence.md §3` — `status: partial → implemented` 전이 시 code 경로 일치 필요
- **상세**: `plan/in-progress/refactor/04-security.md m-4` 가 "spec 갱신: §2 에 멀티 인스턴스 무효화 + Rationale(MTTR 트레이드오프) 추가 (planner)" 를 명시한다. 즉 `spec/4-nodes/5-data/2-database-query.md` 에 pub/sub 무효화 동작의 명시적 서술이 추가돼야 하는데, 이는 developer 가 자기 구현 전에 spec 이 갱신되지 않으면 구현이 spec 밖 동작을 도입하는 구조가 된다. developer 단독으로 착수하면 CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 규칙을 위반할 가능성이 있다.
- **제안**: developer 착수 전에 project-planner 가 `spec/4-nodes/5-data/2-database-query.md §2` 에 멀티 인스턴스 무효화 서술과 `## Rationale` 항을 추가하도록 순서화한다. 또는 spec 갱신이 impl 완료 후 즉시 플래너에게 위임됨을 plan 에 명기한다.

### **[INFO]** 06 M-5 — `spec/4-nodes/1-logic/10-parallel.md` shallow copy 결정 불변 확인 필요
- **target 위치**: 구현 범위 "06 M-5(parallel branch nodeOutputCache dev/test deep freeze)"
- **위반 규약**: `spec/4-nodes/1-logic/10-parallel.md:14` (shallow copy 명시 설계 결정)
- **상세**: 확정안은 dev/test 한정 `Object.freeze` 로 production 런타임 동작 불변을 유지한다. plan 이 "spec 불변" 임을 명기하고, `structuredClone` 전환이 승인 범위 밖임을 명기한 점은 규약과 정합된다. 단, freeze 적용 지점이 branch clone 직후(parallel-executor.ts 내)로 한정돼야 하며, 엔진 전역 `setNodeOutput` 까지 번지면 spec :14 의 shallow-copy 결정과 충돌하는 부수 효과가 생길 수 있다.
- **제안**: 구현 시 freeze 범위를 `parallel-executor.ts:166-176` 의 branch clone 직후로 정확히 한정하고, 그 범위를 단위 테스트의 assertion 으로 잠근다.

### **[INFO]** 03 M-6·m-2 — `types.ts:102` @deprecated 주석 정리 vs spec §4.1 breaking-change 안내 보존
- **target 위치**: 구현 범위 "03 m-2(deprecated 심볼 4건 잔류)" — `chat-channel/types.ts:102`
- **위반 규약**: `spec/conventions/error-codes.md §2` — 에러 코드 rename 은 breaking change (본 항목은 에러 코드가 아니지만, 하위 호환 마이그레이션 가이드 보존의 동일 정신이 적용)
- **상세**: plan 이 "심볼 제거" 와 "주석 정리" 를 구분해 `types.ts:102` 는 심볼이 아닌 주석 정리로 다루기로 결정한 점은 올바르다. `types.ts §4.1 마이그레이션 가이드`(:86-96) 가 외부 소비자(채널 어댑터)를 위한 하위 호환 안내라면 이를 삭제하면 안 된다. plan 의 권장안(A)이 "§4.1 breaking change 안내(본문 :86-96 마이그레이션 가이드)는 보존" 으로 명기한 점은 규약과 정합된다.
- **제안**: 구현 시 `:86-96` 의 마이그레이션 가이드 본문이 실수로 제거되지 않도록 PR diff 에서 명시 확인한다.

### **[INFO]** review_guard `_porcelain_path` 수정 — `spec/conventions/` 적용 범위 밖
- **target 위치**: 구현 범위 "review_guard _porcelain_path off-by-one fix"
- **위반 규약**: 해당 없음
- **상세**: `.claude/hooks/_lib/review_guard.py` 는 tooling 내부 코드로 `spec/conventions/**` 대상 규약이 직접 적용되지 않는다. `.claude/tests/test_review_guard_hardening.py` 에 `_porcelain_path` 의 케이스가 이미 정의돼 있으므로 수정 후 기존 테스트를 통과하는 것이 적합성 기준이다.
- **제안**: 별도 조치 불필요. 수정 후 `test_review_guard_hardening.py` 전량 통과 확인으로 충분.

---

## 요약

이번 구현 묶음에서 규약 관점의 주요 리스크는 역할 경계 혼재다. `06 M-1`(WS resumed ack spec 문구 정리)은 plan 이 "(planner)" 로 명기한 spec 변경 작업이고, `04 m-4`(pub/sub Pool 무효화)는 spec 갱신을 planner 선행으로 요구한다 — 두 항목 모두 developer 단독 착수 시 `spec/` read-only 규칙(`CLAUDE.md` Skill 체계)을 위반할 수 있다. `03 M-6·m-2`(dead code 제거) 및 `06 M-5`(dev/test freeze)는 spec 불변 구현으로 규약 위반이 없으며, `review_guard` 수정은 conventions 적용 범위 밖이다. 전반적으로 구현 시작 전에 planner 선행 작업(06 M-1 spec 정정, 04 m-4 spec §2 보강)의 완료 여부를 확인하는 것이 필요하다.

---

## 위험도

MEDIUM
