# Rationale 연속성 검토 결과

## 검토 대상 (target)

구현 착수 전 (--impl-prep) 백로그 묶음:
- 03 M-6 · m-2: dead code 제거 (`registerContinuationHandlers` / `on()` / `toEiaEvent` / `system-status` 상수)
- 06 M-5: parallel branch `nodeOutputCache` dev/test deep freeze
- 04 m-4: integration credential 회전 pub/sub Pool 무효화
- 06 M-1: WS resumed ack spec 문구 정리 (planner)
- `review_guard _porcelain_path` off-by-one fix

---

## 발견사항

### [INFO] 03 M-6 — `registerContinuationHandlers` / `on()` 제거: Rationale 와 완전 정합

- **target 위치**: `plan/in-progress/refactor/03-maintainability.md` M-6
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` §7.4·§7.5 Rationale "park 즉시 해제 + slow-path 일원화", 구현 메모 "full B3 완전 제거" 문단
- **상세**: `registerContinuationHandlers` 와 deprecated `on()` 는 in-memory 머신(`pendingContinuations`/`firstSegmentBarriers` 일가)의 잔해다. spec §7.5 Rationale 이 "in-memory 머신 완전 제거(full B3) — §7.5 단일 경로 일원화" 를 이미 완료된 결정으로 기술하고, 코드 주석도 "후속 정리 시 제거 예정" 을 명시한다. 제거는 spec 결정의 마무리 집행이며 새 설계를 도입하지 않는다.
- **제안**: 없음. spec·코드·plan 삼자 정합. 제거 후 "registerContinuationHandlers" 테스트 훅 2곳(:524,:14214) 동반 삭제 필수 — 이미 plan 에 명기.

### [INFO] 03 m-2 — `toEiaEvent` / `system-status` 상수 제거: Rationale 와 완전 정합

- **target 위치**: `plan/in-progress/refactor/03-maintainability.md` m-2
- **과거 결정 출처**: `plan/in-progress/refactor/03-maintainability.md` m-2 spec 대조 결과(A), `spec/5-system/6-websocket-protocol.md` §4.1 breaking change 안내
- **상세**: `toEiaEvent` alias 와 상수 2건은 "외부 참조 0건 grep 확인" + "후속 PR 에서 제거" 주석 예약 상태다. `chat-channel/types.ts:102` 의 @deprecated 태그만은 "심볼 제거" 가 아닌 "주석 정리" 가 올바른 액션임을 plan 이 명시한다 — §4.1 breaking change 안내(본문 :86-96 마이그레이션 가이드)를 보존하는 것이 Rationale 일치.
- **제안**: types.ts 행은 spec §4.1 의 폐기 안내 보존 원칙(Rationale C 옵션 기각 근거)을 준수해 "@deprecated 태그만 정리, 마이그레이션 가이드 본문 보존" 로 진행한다. plan 에 이미 명기돼 있음.

### [INFO] 06 M-5 — parallel branch `nodeOutputCache` dev/test deep freeze: Rationale 와 정합, structuredClone 금지 경계 준수 필요

- **target 위치**: `plan/in-progress/refactor/06-concurrency.md` M-5
- **과거 결정 출처**: `spec/4-nodes/1-logic/10-parallel.md` :14 (:69, :149 동일) "variables 는 structuredClone, **nodeOutputCache 는 shallow copy 로 격리**" — deep clone 비용 회피 명시 결정
- **상세**: 승인된 방향(A — dev/test 한정 deep freeze)은 spec :14 의 shallow copy 결정을 그대로 유지하고, production 런타임 비용 0이다. structuredClone 전환(C안)은 "spec :14 명시 결정의 번복 — 성능 측정 + planner spec 개정 선행 필수 (단독 구현 금지)" 로 plan 에 명기돼 있어 기각 경계가 명확하다. freeze 적용 지점을 "branch clone 직후" 로 한정해야 엔진 자체의 합법적 cache 갱신을 차단하지 않는다는 제약도 plan 에 기록.
- **제안**: 구현 시 `Object.freeze` 를 `parallel-executor.ts:166-176` 의 branch clone 직후 범위로 엄격히 한정한다. 엔진 `setNodeOutput` 저장 시점으로 확대하면 B안에 해당해 추가 측정이 선행돼야 한다.

### [INFO] 04 m-4 — credential 회전 pub/sub Pool 무효화: Rationale 갭 명시 및 spec 갱신 의무

- **target 위치**: `plan/in-progress/refactor/04-security.md` m-4
- **과거 결정 출처**: `spec/4-nodes/4-integration/2-database-query.md` :77 "credential 회전 시 stale 풀 evict 후 새 풀 생성" — 단일 프로세스 동작 정합. 멀티 인스턴스 캐시 무효화 조율은 spec 미언급.
- **상세**: pub/sub(Redis) 전파는 기존 spec 이 기술하지 않은 새 인프라 행위를 추가한다. plan 에 "spec §2 에 멀티 인스턴스 무효화 + Rationale(MTTR 트레이드오프) 추가 (planner)" 를 명시했으나, 구현 착수 전 이 spec 갱신이 플래너 워크플로로 위임·완료되지 않으면 구현이 spec 선행(spec-less 구현) 상태가 된다.
- **제안**: 구현 PR 전에 planner 가 `spec/4-nodes/4-integration/2-database-query.md §2` 에 "멀티 인스턴스 캐시 무효화 — Redis pub/sub 전파" + Rationale(MTTR, fail-safe degrade) 를 추가하는 spec 변경을 선행한다. 이는 plan 자체가 명기한 의무다.

### [INFO] 06 M-1 — WS resumed ack spec 문구 정리: 기각된 대안(B) 불채택 확인

- **target 위치**: `plan/in-progress/refactor/06-concurrency.md` M-1
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md` §4.2 — `queued: boolean` "관측·디버깅 용도, routing 결정에 사용하지 않는다"; Rationale "재연결 복구 — snapshot 모델" 에서 항상-enqueue 아키텍처 기술
- **상세**: 승인된 방향(A — spec 정정, 코드 무변경)은 `resumed` 의 정의를 "재개 성공 여부" → "재개 시작 수락(enqueue) 여부" 로 정정한다. 기각된 B안(gateway 가 실제 resumed 판정 반환)은 "worker 처리를 동기 대기해야 해 §7.5.1 후행 이벤트 설계와 정면 충돌" 이유로 plan 에 명시 기각됐다. spec §7.5.1 의 "RESUME_* 는 후행 이벤트" 원칙을 거스르지 않는다.
- **제안**: planner 가 §4.2 `resumed` 정의 문구 + §7.5 "셋 모두 ack 에 `resumed: false` 노출" 문장을 §7.5.1 과 일치시키는 두 지점의 spec 수정을 수행한다. 수정 완료 전 frontend 에서 ack `resumed` 를 상태 전이 근거로 쓰는 곳이 없는지 확인하는 가드 작업도 plan 에 명기되어 있다.

### [INFO] `review_guard _porcelain_path` off-by-one fix: spec/Rationale 무관, 자체 테스트로 검증

- **target 위치**: `.claude/hooks/_lib/review_guard.py` `_porcelain_path` 함수, `.claude/tests/test_review_guard_hardening.py` `PorcelainPathTest`
- **과거 결정 출처**: 해당 없음 — `.claude/hooks/` 는 워크플로 도구 영역으로 product spec Rationale 체계 밖
- **상세**: `_porcelain_path` 는 `git status --porcelain v1` 출력에서 경로를 파싱한다. 현재 구현(`ln[3:]`)은 `len(ln) < 4` 가드로 최소 4자 미만을 빈 문자열로 반환하며, R/C 상태 코드의 rename `" -> "` 구분자 처리와 파일명 내 literal `"->"` 비분리 처리가 `test_review_guard_hardening.py` 의 `PorcelainPathTest` 6건으로 이미 검증된다. 구현과 테스트가 정합하며 spec Rationale 와 충돌 없음.
- **제안**: 없음.

---

## 요약

검토 대상 5개 항목 모두 기존 spec Rationale 와 충돌하지 않는다. 03 M-6·m-2 는 spec 이 이미 "제거 예약" 으로 기술한 dead code 집행이고, 06 M-5 는 `10-parallel.md :14` 의 shallow copy 결정을 건드리지 않는 dev/test 전용 guard 로 명시 경계를 준수한다. 06 M-1 은 spec 내부 모순 2건을 코드 변경 없이 spec 문구 정정으로만 해소하는 planner 작업이고, 기각된 동기-ack 대안(B)이 plan 에 명시 기각 기록돼 있다. 유일하게 관리가 필요한 항목은 04 m-4 로, pub/sub 전파는 spec 미기술 인프라 행위를 추가하므로 구현 PR 전에 planner 가 `spec/4-nodes/4-integration/2-database-query.md §2` + Rationale 를 갱신해야 한다는 의무가 plan 에 이미 명기돼 있다 — 이 의무가 이행되기 전 구현을 착수하면 spec-less 상태가 된다. `review_guard _porcelain_path` 수정은 product spec Rationale 체계 밖 도구 영역이다.

---

## 위험도

LOW
