# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**HIGH** — plan frontmatter 빌드 가드 강제 필드(`started`, `owner`) 누락으로 빌드 실패 예상. spec 내부 모순 2건은 plan 적용 방향이 올바르나 미반영 상태로 실존.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | plan frontmatter 필수 필드 `started`, `owner` 누락 — `plan-frontmatter.test.ts` 빌드 가드 실패 예상 | `plan/in-progress/spec-update-ws-resumed-ack.md` frontmatter lines 1–8 | `.claude/docs/plan-lifecycle.md §4` 스키마 (`worktree`·`started`·`owner` 필수) | frontmatter에 `started: 2026-06-10`, `owner: planner` 추가 |
| 2 | Cross-Spec | WS §4.2 line 241 `resumed` 정의가 "재개 성공 여부"로 남아있어 always-enqueue 코드 동작 및 plan 변경안과 불일치 | `spec/5-system/6-websocket-protocol.md` line 241 | `spec/data-flow/3-execution.md` line 171, 엔진 §7.5.1, plan 변경 선언 | plan 대로 line 241을 "재개 시작 수락(enqueue) 여부 — 정상 enqueue 시 항상 `true`, 실패는 `queued: false`"로 정정 |
| 3 | Cross-Spec | 엔진 §7.5 line 967 이 "ack 에 `resumed: false` + error 로 노출"로 기술 — 동일 파일 §7.5.1("후행 `EXECUTION_CANCELLED` 이벤트")과 직접 모순 | `spec/5-system/4-execution-engine.md` line 967 | 동일 파일 §7.5.1 line 995, `spec/data-flow/3-execution.md` line 171 | plan 대로 line 967을 "worker 측 비동기 실패 — 후행 `EXECUTION_CANCELLED` 이벤트(`error.code = RESUME_*`)로 통지, 동기 ack 아님"으로 정정 |

> **참고**: Critical #2·#3은 plan 이 정정하려는 바로 그 모순이 현재 spec 에 미반영 상태로 실존하는 것입니다. plan 적용 방향 자체는 다른 영역 spec 및 코드와 정합합니다. Critical #1은 plan 이 **적용되기 전**에 반드시 해소해야 하는 frontmatter 문제입니다.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | 엔진 §7.5 line 967 "ack 동기 노출" 기술이 왜 최초 도입됐고 §7.5.1로 번복하는 역사적 근거가 spec Rationale 어디에도 없음 | `spec/5-system/4-execution-engine.md §Rationale` (부재) | 엔진 §7.5 line 967 (기존 기술) vs §7.5.1 line 995 (올바른 경로) | `spec/5-system/4-execution-engine.md §Rationale`에 "`RESUME_*` 동기 ack 노출(§7.5 옛 기술) 폐기" 항목 추가 — BullMQ 항상 enqueue 도입 이후 §7.5.1이 authoritative 경로가 됐음을 명문화 |
| 2 | Rationale Continuity | WS `resumed` 재정의 근거가 plan 자체 Rationale에만 있고 WS spec §Rationale에 공식 기록 부재 — 다음 검토자가 "합의 번복인가"를 추적 불가 | `spec/5-system/6-websocket-protocol.md §Rationale` (부재) | plan Rationale 블록 (always-enqueue 모델에서 동기 성공 판정 불가) | WS spec §Rationale에 "`resumed` 의미 재정의" 항목 신설: ① 옛 정의, ② always-enqueue 채택 후 동기 판정 불가 이유, ③ "enqueue 수락"으로 재정의 근거, ④ 대안 B 기각, ⑤ `spec/0-overview.md §Rationale "실행 엔진"` cross-link |
| 3 | Convention Compliance | `status: in-progress` frontmatter 필드가 비표준 — 공식 스키마 미정의, 경로와 이중 상태 표현으로 sync drift 위험 | `plan/in-progress/spec-update-ws-resumed-ack.md` frontmatter line 8 | `.claude/docs/plan-lifecycle.md §4` (in-progress/complete 구분은 파일 경로로 관리) | `status: in-progress` 줄 제거 권고 |
| 4 | Convention Compliance | `spec_impact` 필드를 in-progress 단계에 선언 — 규약 의도(완료 시점 Gate C 강제)와 어긋남, 중간 spec 경로 변경 시 stale 위험 | `plan/in-progress/spec-update-ws-resumed-ack.md` frontmatter lines 3–6 | `.claude/docs/plan-lifecycle.md §Gate C`, `spec/conventions/spec-impl-evidence.md §4.2` | `spec_impact` 선언을 `complete/` 이동 시점까지 유보하거나 plan 본문 텍스트로만 기술 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `retry_last_turn` 실패 ack의 `resumed: false`는 plan 변경 범위 외(publisher 동기 검증 실패) — 4종 continuation ack 정정과 별개 경로 | `spec/5-system/6-websocket-protocol.md` line 339 | WS §4.2에 `retry_last_turn`의 `resumed: false`가 publisher 사전 검증 실패임을 명시 주석 추가 (권고) |
| 2 | Cross-Spec | `resumed` 명명 중의성 — WS ack 필드 boolean vs NodeExecution status enum 동일 단어 | `spec/5-system/14-external-interaction-api.md` line 441, `spec/5-system/6-websocket-protocol.md` §4.2 | WS §4.2에 ack 필드 `resumed`와 status enum `"resumed"` 구분 인라인 주석 추가 (권고) |
| 3 | Cross-Spec | `spec/data-flow/3-execution.md` line 171 — 이미 올바른 "후행 EXECUTION_CANCELLED 이벤트" 기술, 별도 수정 불필요 | `spec/data-flow/3-execution.md` line 171 | 조치 불요 |
| 4 | Rationale Continuity | `retry_last_turn` ack의 `resumed` 필드가 "동기 검증 결과"인지 "enqueue 수락"인지 4종 continuation과의 구분 미명시 | `spec/5-system/6-websocket-protocol.md` §4.2 line 339 | WS §4.2의 `retry_last_turn` ack 설명 또는 Rationale에 `resumed` 필드가 동기 검증 결과를 반영하는 필드임을 한 문장 명시 |
| 5 | Rationale Continuity | plan Rationale이 `spec/0-overview.md §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"` always-enqueue 결정을 명시 인용하지 않아 연결 고리 약함 | `plan/in-progress/spec-update-ws-resumed-ack.md §Rationale` | WS spec §Rationale 신설 항에 `spec/0-overview.md §Rationale "실행 엔진"` 인용 링크 추가 |
| 6 | Convention Compliance | `name: spec-update-ws-resumed-ack` 필드 — plan-lifecycle 비정의, 파일 basename 중복 | frontmatter line 2 | `name:` 필드 제거 고려 |
| 7 | Plan Coherence | M-1 출처 계승 정상 — `refactor/06-concurrency.md` M-1 위임 계보 일치 | plan 전문(preamble) | 조치 불요 |
| 8 | Plan Coherence | `spec-sync-websocket-protocol-gaps.md` worktree sentinel `spec-sync-audit` 미착수 표기 미정리 | `plan/in-progress/spec-sync-websocket-protocol-gaps.md` frontmatter | frontmatter의 `worktree: spec-sync-audit`를 미착수 sentinel로 교체 권장 |
| 9 | Plan Coherence | `exec-park-durable-resume` spec flip 커밋과의 이중 편집 가능성 — spec 본문 확인으로 배제됨, 착수 전 편집자 확인 권장 | `spec/5-system/4-execution-engine.md §7.5` | target 편집자가 spec flip 커밋(5dc6444f·7c6d0f2c·35524fe4) §7.5 변경 범위 확인 후 착수 |
| 10 | Plan Coherence | 프론트 가드 확인 결과 신규 항목 신설 시 `refactor/06-concurrency.md` M-6 cross-link 포함 권장 | target §검증·후속 | 조건부 신설 항목 발생 시만 적용 |
| 11 | Naming Collision | 신규 식별자 미도입 — 기존 필드명/이벤트명/에러코드 설명 정정만, 네임스페이스 충돌 없음 | plan 전체 | 조치 불요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | spec 내 CRITICAL 모순 2건 (WS §4.2 `resumed` 정의, 엔진 §7.5 line 967) 실존; plan 적용 방향은 다른 영역과 정합 |
| Rationale Continuity | LOW | 두 spec 파일 §Rationale에 변경 근거 공식 기록 부재; 추적성 미흡 |
| Convention Compliance | HIGH | `started`·`owner` 필수 필드 누락으로 빌드 가드 실패 예상 |
| Plan Coherence | NONE | 미결 결정과 충돌 없음, 활성 worktree 경합 없음, 전원 INFO |
| Naming Collision | NONE | 신규 식별자 미도입, 충돌 없음 |

---

## 권장 조치사항

1. **(BLOCK 해소 우선)** `plan/in-progress/spec-update-ws-resumed-ack.md` frontmatter에 `started: 2026-06-10`, `owner: planner` 추가 — `plan-frontmatter.test.ts` 빌드 가드 통과를 위해 plan 적용 전 필수.
2. **(spec 정정 실행)** plan 대로 `spec/5-system/6-websocket-protocol.md` §4.2 line 241 및 `spec/5-system/4-execution-engine.md` §7.5 line 967 정정 — 두 Critical 모순 해소.
3. **(Rationale 보존)** `spec/5-system/6-websocket-protocol.md §Rationale`에 "`resumed` 의미 재정의" 항목 신설(WARNING #2); `spec/5-system/4-execution-engine.md §Rationale`에 "`RESUME_*` 동기 ack 노출 폐기" 항목 신설(WARNING #1) — 각각 `spec/0-overview.md §Rationale "실행 엔진"` cross-link 포함.
4. **(frontmatter 정리)** `status: in-progress` 줄 제거 및 `spec_impact` 선언을 `complete/` 이동 시점으로 이연 (WARNING #3·#4).
5. **(INFO, 선택)** WS §4.2에 `retry_last_turn` `resumed: false`와 4종 continuation ack의 구분 주석, `resumed` 명명 중의성 주석 추가 (혼동 방지 권고 수준).
