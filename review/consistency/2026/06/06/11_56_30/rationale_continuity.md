# Rationale 연속성 검토 결과

검토 모드: `--impl-done` (구현 완료 후), scope=`spec/5-system`, diff-base=`origin/main`

## 발견사항

발견된 CRITICAL·WARNING 항목 없음.

---

### [INFO] `resume_call_stack` 도입이 기각된 `_continuationCheckpoint` 컬럼과의 구분을 Rationale 에서 충분히 명시했으나, 기각 맥락이 두 곳에 분산됨

- **target 위치**: `spec/5-system/4-execution-engine.md` §6.2 "waiting_for_input 진입 시" 행 + §Rationale "park 즉시 해제 + slow-path 일원화" 의 exec-park D6 항목 + `spec/1-data-model.md` `resume_call_stack` 컬럼 서술
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` §Rationale "Multi-turn 재시작 재개 — `_resumeCheckpoint` 보존" 의 "별도 `_continuationCheckpoint` 컬럼 신설 기각" 항목 (Rationale L1188)
- **상세**: 기각된 `_continuationCheckpoint` 는 continuation *운반*용 컬럼이었고, `resume_call_stack` 은 park 시점의 중첩 호출 체인 *위상* 영속이라 목적이 직교하다. target 의 exec-park D6 항목(Rationale L1275)과 §6.2 본문(L733)이 이 구분을 모두 명시하고 있어 번복이 아님을 확인할 수 있다. 다만 `spec/1-data-model.md` 컬럼 서술에서는 "`_continuationCheckpoint` 기각과 다른 범주" 구분이 §7.5 링크로만 간접 참조되어 있어, 신규 독자가 두 결정의 관계를 한 곳에서 확인하기 어렵다.
- **제안**: 필수 수정은 아님. `spec/1-data-model.md` `resume_call_stack` 항목에 "`_continuationCheckpoint` 컬럼 신설 기각과 직교한 목적 — 상세: §Rationale exec-park D6" 같은 한 줄 인라인 주석을 추가하면 단일 진실 접근성이 향상된다.

---

### [INFO] PR-B2 가 B2a·B2b 로 세분화된 사실이 Rationale 에 추가됐으나, 구 "B2" 단일 지칭이 일부 하위 링크에서 잔존 가능성

- **target 위치**: `spec/5-system/4-execution-engine.md` §Rationale "park 즉시 해제 + slow-path 일원화" "단계적 롤아웃 (B1 → B2a → B2b, 2026-06-05/06)" 항목 (L1271)
- **과거 결정 출처**: 동일 Rationale 내 이전 서술 "단계적 롤아웃 (B1 → B2, 2026-06-05)" (origin/main 기준, L1268) — "2개 PR 분할" 로 명시됐던 구 서술
- **상세**: target 이 "B1 → B2a → B2b" 로 세분화를 명시하고 근거(PR-B2b 에서 D6 + full B3 를 함께 처리)를 작성했다. 이는 "B1·B2 분리 불가" 원칙 자체를 번복하지 않고 park-site 단위로 유지하며 PR 수만 증가시킨 것이라 합의 원칙 위반이 아니다. 다만 plan 파일(`plan/in-progress/exec-park-durable-resume.md`)의 B1/B2 분할 서술과 spec Rationale 의 B1/B2a/B2b 서술이 항상 일치하는지 plan 완료 후 일괄 검토를 권장한다.
- **제안**: plan 완료 시 "B1·B2 분리 불가" 원칙 항목이 "park-site 단위" 세분화를 포함해 명확히 기술됐는지 최종 확인.

---

### [INFO] SSE wire 필드 서술 제거 — Rationale 없이 단순 제거됐으나 해당 내용은 cross-reference 이므로 영향 없음

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §6.2 (SSE wire 필드 주의 blockquote 제거), `spec/7-channel-web-chat/0-architecture.md` §3 (SSE wire 필드명 서술 제거)
- **과거 결정 출처**: 해당 서술들은 `fix-webchat-sse-field-map` pending plan 에 의해 추적되던 내용이었음 (spec 본문 Rationale 에 해당 결정이 별도 기록된 곳 없음)
- **상세**: 두 곳에서 SSE wire 필드명 정오 안내 blockquote 가 제거되고, `pending_plans` 에서 `fix-webchat-sse-field-map` 가 제거됐다. 해당 서술들은 spec SoT 가 아닌 "위젯/SDK 구현 참고용 cross-reference"였고, SoT 는 `eia-events.ts` 로 명시됐다. 따라서 제거가 합의된 설계 원칙을 파기하지 않는다. 다만 제거 근거(plan 완료 또는 별도 spec 이전 여부)가 이 diff 내에 문서화되지 않았다.
- **제안**: 필수 수정 아님. `fix-webchat-sse-field-map` plan 이 완료(complete/) 또는 폐기 처리됐는지 확인하는 것으로 충분.

---

## 요약

이번 diff(`exec-park-durable-resume` 워크트리, PR-B1 완료 + PR-B2a top-level 멀티턴 AI 완료 + exec-park D6 설계 확정)에서 기존 Rationale 의 핵심 기각 결정들 — `_continuationCheckpoint` 컬럼 신설 기각, per-node task queue 기각, sticky fast-path 제거, `_resumeCheckpoint` TTL-free 불변식, "항상 BullMQ enqueue" 원칙, "B1·B2 분리 불가(park-site 단위)" 원칙 — 이 모두 유지 또는 정합 확장됐다. `resume_call_stack` 도입은 기각된 `_continuationCheckpoint` 와 목적이 직교하며 Rationale 에서 두 번 구분 설명했고, PR-B2 세분화(B2a/B2b)는 park-site 단위 원칙을 유지하며 D6 범위를 B2b 로 분리한 것이라 원칙 번복이 아니다. SSE wire 필드 주의 blockquote 제거는 SoT 가 코드베이스에 있는 informational cross-reference 제거로, 합의된 설계 결정을 건드리지 않는다. CRITICAL·WARNING 항목은 발견되지 않았다.

## 위험도

NONE
