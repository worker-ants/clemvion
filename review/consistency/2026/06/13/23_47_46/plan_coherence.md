# Plan 정합성 검토 결과

## 검토 대상

- **Target**: `spec-sync-s-batch-draft.md` (3건 spec doc-sync: 7-llm-usage §1.3 압축 / interaction-type-registry W2 등재 / 15-external-interaction Rationale SSE 블록 신설 + resume-turn-dispatch.ts JSDoc I3 교정)
- **모드**: spec draft 검토 (--spec)

---

## 발견사항

### [WARNING] 변경 2 — interaction-type-registry W2 가 spec-sync-resume-dispatch-registry.md 미완 항목과 겹침

- **target 위치**: 변경 2 — `spec/conventions/interaction-type-registry.md §1.2` 매트릭스 하단 노트 추가 + `resume-turn-dispatch.ts` frontmatter `code:` 등재
- **관련 plan**: `plan/in-progress/spec-sync-resume-dispatch-registry.md` W2 항목 (미체크 `[ ]`)
  > `[ ] W2 spec/conventions/interaction-type-registry.md §1.1 Backend 행 + §1.2 매트릭스에 resume-turn-dispatch.ts 등재. enum 값 신규 추가 아님 → 매트릭스 완전성 보강.`
- **상세**: target 변경 2 가 `spec-sync-resume-dispatch-registry.md` W2 를 그대로 이행한다. 충돌은 없으나, 작업이 완료되면 해당 plan 의 W2 체크박스가 갱신되지 않으면 plan 이 stale 상태로 남는다. 또한 plan 은 `§1.1 Backend 행` 도 갱신 대상으로 명시했는데 target draft 는 `§1.2` 매트릭스 하단 note 추가만 기술 — §1.1 처리 여부가 명확하지 않다.
- **제안**: target 적용 후 `plan/in-progress/spec-sync-resume-dispatch-registry.md` W2 를 `[x]` 로 갱신하고 W2 의 §1.1 범위 포함 여부를 명시. I3(선택) 도 동시에 처리(부수 항목 참조)하면 plan 의 I3 체크 갱신도 필요.

---

### [WARNING] 부수 항목 — resume-turn-dispatch.ts JSDoc I3 가 동일 plan 의 미완 선택 항목과 겹침

- **target 위치**: "부수 — `resume-turn-dispatch.ts` JSDoc 교정 (I3, 코드 주석)" — `§6.2(중첩 재개)` → `§7.5(rehydration · 중첩 sub-workflow 재개)` 교정
- **관련 plan**: `plan/in-progress/spec-sync-resume-dispatch-registry.md` I3(선택) (미체크 `[ ]`)
  > `[ ] I3(선택) resume-turn-dispatch.ts JSDoc 의 §6.2(중첩 재개) 레이블 → §7.5 중첩 sub-workflow 재개 로 교정`
- **상세**: target 의 부수 항목은 I3 를 완전히 구현한다. 코드 주석 변경이므로 spec PR 범위 밖이지만 이 plan 이 함께 추적하고 있다. 적용 완료 시 plan I3 체크 갱신이 누락되면 stale.
- **제안**: target 적용 후 `spec-sync-resume-dispatch-registry.md` I3 를 `[x]` 처리. W2·I3 모두 체크되면 해당 plan 을 `plan/complete/` 로 이동 검토 (I4 는 선택 사항으로 별도 판단).

---

### [WARNING] 변경 3 — SSE Rationale 블록이 spec-update-sse-single-instance-rationale.md 와 내용 중복

- **target 위치**: 변경 3 — `spec/data-flow/15-external-interaction.md` Rationale 에 "SSE 버퍼 single-instance 한정 이유와 이관 방향" 블록 신설
- **관련 plan**: `plan/in-progress/spec-update-sse-single-instance-rationale.md` (전체 내용이 동일 변경 제안)
- **상세**: `spec-update-sse-single-instance-rationale.md` 는 이 정확히 동일한 Rationale 블록을 신설하는 plan 이다. target 이 이를 이행하면 해당 plan 문서 자체가 완료·불필요해진다. plan 에 `worktree: trigger-schedule-sync-f88604` 가 명시돼 있으므로 해당 worktree 와의 상태 정합도 확인 필요 (이미 브랜치에서 작업이 병행되고 있을 가능성).
- **제안**: target 적용 완료 시 `spec-update-sse-single-instance-rationale.md` 를 `plan/complete/` 로 이동. 현재 worktree `trigger-schedule-sync-f88604` 에 동일 편집이 진행 중인지 확인해 중복 커밋 방지.

---

### [WARNING] 변경 1 + spec-update-gap-callout-plan-links.md — callout 압축 후 plan 링크 추가 위치 영향

- **target 위치**: 변경 1 — `spec/data-flow/7-llm-usage.md §1.3` attribution 갭 note 를 단문으로 압축
- **관련 plan**: `plan/in-progress/spec-update-gap-callout-plan-links.md` — `7-llm-usage §1.3` callout 끝에 plan 파일 링크 추가 제안 (미착수)
- **상세**: `spec-update-gap-callout-plan-links.md` 는 `7-llm-usage §1.3` callout 에 `plan/in-progress/spec-sync-execution-gaps.md` 링크를 추가하려 한다. target 변경 1 이 §1.3 note 를 대폭 압축하면, gap-callout-plan-links 의 추가 위치·문안이 맞지 않는다. 두 plan 을 조율 없이 순서대로 적용하면 충돌 가능성이 있다.
- **제안**: target 변경 1 이 §1.3 note 를 새 형태로 고정한 뒤 `spec-update-gap-callout-plan-links.md` 의 `7-llm-usage §1.3` 항목을 그 새 note 형태에 맞게 갱신(또는 새 note 내에 plan 링크를 포함하도록 변경 1 draft 에 선제 반영). 두 spec-update 를 하나의 적용 단위로 묶는 것도 권장.

---

### [INFO] 변경 1 — attribution 갭 "결정 대기" 상태 기술 방식 / spec-update-doc-style.md 예시와 불일치

- **target 위치**: 변경 1 요약 — "attribution 갭은 여전히 '결정 대기' 상태로 기술 — 갭이 해소됐다고 주장하지 않음"
- **관련 plan**: `plan/in-progress/spec-update-doc-style.md` W10 제안 예시
  > `> **[WARNING#5 수정 완료]** attribution 갭은 2026-06-10 커밋(639be831)으로 해소됨.`
- **상세**: `spec-update-doc-style.md` 의 예시는 갭이 이미 해소된 것처럼 표현하고 있으나, 현행 spec(`7-llm-usage.md §Rationale L197–200`)은 "코드 수정 vs spec 차원 집계 의미 재정의가 결정 대상" 이라며 여전히 미결로 기재. target 은 이 미결 상태를 보존하는 방향이며, plan 의 예시와 내용 방향이 다르다. target 이 plan 예시를 그대로 따르면 미결 결정을 일방적으로 "해소됨" 처리하게 된다. target 이 "결정 대기 보존" 을 명시했으므로 올바른 접근이나, `spec-update-doc-style.md` 의 W10 예시는 이미 부정확하다.
- **제안**: `spec-update-doc-style.md` W10 예시를 "결정 대기 보존" 방향의 표현으로 정정(메모 수준). target 변경 1 의 draft 문안이 SoT 이고 plan 예시는 참고용이므로 target 우선.

---

## 요약

target 의 3건 spec doc-sync 는 각각 `spec-sync-resume-dispatch-registry.md`(W2·I3), `spec-update-sse-single-instance-rationale.md`(변경 3), `spec-update-doc-style.md`(변경 1 W10) 이라는 기존 in-progress plan 에서 추적하던 미완 항목을 직접 이행하는 형태다. 결정 자체를 우회하는 CRITICAL 이슈는 없고, attribution 갭 "결정 대기" 상태도 target 이 올바르게 보존하고 있다. 다만 이행 완료 후 관련 plan 체크박스·완료 이동이 누락되거나, gap-callout-plan-links 의 추가 위치가 변경 1 과 충돌하거나, `spec-update-sse-single-instance-rationale.md` 와 중복 적용될 위험이 있어 WARNING 4건으로 정리한다.

## 위험도

LOW
