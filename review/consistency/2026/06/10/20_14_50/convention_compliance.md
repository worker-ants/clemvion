# 정식 규약 준수 검토 — plan/in-progress/spec-update-perf-backlog-01.md

검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-06-10

---

## 발견사항

### [INFO] `spec_impact` 필드 미선언 — in-progress 단계에서는 비차단
- target 위치: frontmatter (lines 1–5)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2 Gate C` + `.claude/docs/plan-lifecycle.md §4`
- 상세: `started: 2026-06-10` 으로 grandfather cutoff(`2026-06-04`) 이후 시작 plan 이므로 `plan/complete/` 로 이동 시 `spec_impact` 선언이 의무화된다. 현재 in-progress 상태에서는 Gate C 가드가 강제하지 않으나, 완료 이동 시 누락하면 `spec-plan-completion.test.ts` 가 빌드 차단한다. 본 draft 의 체크리스트 3번 항목("반영 후 본 draft 를 `plan/complete/` 로 이동")이 있으나 `spec_impact` 준비에 대한 언급이 없다.
- 제안: 체크리스트에 `spec_impact` 선언 항목을 명시적으로 추가한다. 본 plan 이 변경하는 spec 파일이 `spec/data-flow/4-file-storage.md` 와 `spec/5-system/4-execution-engine.md` 두 건이므로, 완료 시 frontmatter 에 아래를 추가해야 한다:
  ```yaml
  spec_impact:
    - spec/data-flow/4-file-storage.md
    - spec/5-system/4-execution-engine.md
  ```

### [INFO] 문서 구조 — Rationale 섹션 없음
- target 위치: 문서 전체
- 위반 규약: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 권장 (SKILL.md 참고 사항으로 spec draft 문서 3섹션 구성 권장)
- 상세: `plan/in-progress/` 문서에 Rationale 섹션은 필수가 아니며 CLAUDE.md 도 "spec 문서"에 대한 3섹션 구성을 권장한다. 그러나 본 문서가 두 건의 spec 변경 판단 근거(행위 의미 불변·code-sync 판정 등)를 내포하고 있으므로, 해당 근거를 짧게라도 남겨두면 project-planner 가 `/consistency-check --spec` 적용 시 판단 context 로 활용할 수 있다.
- 제안: plan 문서 특성상 선택 사항이므로 강제 아님. 필요 시 판단 근거 한두 줄을 본문에 인라인으로 남겨도 충분하다. 현재 heading 구조는 적합하다.

---

## 요약

`plan/in-progress/spec-update-perf-backlog-01.md` 는 frontmatter 의 세 필수 필드(`worktree`·`started`·`owner`) 를 모두 갖추고 있으며 plan-lifecycle.md §4 의 in-progress 단계 규약을 준수한다. 명명·위치·참조 대상 spec 경로 모두 규약에 부합한다. 단, `started: 2026-06-10` 으로 Gate C 적용 대상이므로 `plan/complete/` 이동 전 `spec_impact` 필드 선언이 필요하며, 해당 준비가 체크리스트에 명시되지 않은 점이 INFO 등급 발견이다. 규약 직접 위반(CRITICAL/WARNING) 은 없다.

---

## 위험도

LOW
