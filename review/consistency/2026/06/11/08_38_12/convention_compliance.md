# 정식 규약 준수 검토 결과

**Target**: `plan/in-progress/auth-refresh-rotation-atomic.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-11

---

## 발견사항

### INFO — plan 문서에 Rationale 섹션 존재하나, 본문 섹션 구성이 비표준적
- target 위치: 문서 전체 구조 (`## 변경`, `## 체크리스트`, `## Rationale`)
- 위반 규약: CLAUDE.md §정보 저장 위치 — "Overview / 본문 / Rationale 3섹션 권장"
- 상세: CLAUDE.md 는 spec 문서에 대해 "Overview / 본문 / Rationale 3섹션 권장"을 명시한다. 본 문서는 plan 문서(spec 아님)이므로 엄격 적용 대상은 아니나, plan 본문에 Overview 절 없이 바로 `## 변경` 으로 시작하고 있다. Rationale 은 말미에 존재해 이 부분은 규약과 일치한다. plan 문서 전용 구조 규약(`plan-lifecycle.md`)에는 섹션 순서 의무가 없으므로 실제 위반이 아닌 형식 제안 수준.
- 제안: plan 문서이므로 현 구조 유지 가능. 다만 문서 도입부에 한 줄 이상의 맥락 요약(역할상 Overview)을 두는 것이 일관성에 도움.

---

### INFO — `spec_impact` 필드 미선언 (in-progress 단계이므로 의무 아님, 사전 안내)
- target 위치: frontmatter (lines 1–5)
- 위반 규약: `spec/conventions/spec-impl-evidence.md` §4.2 Gate C + `.claude/docs/plan-lifecycle.md §4` — "완료(`complete/`) 이동 시 `spec_impact` 선언 필수. `started ≥ 2026-06-04` 인 plan 만 대상"
- 상세: 본 plan 의 `started: 2026-06-11` 은 cutoff(2026-06-04) 이후이므로 complete 이동 시 Gate C 적용 대상이다. 현재 in-progress 단계에서는 의무가 없으나(`plan-lifecycle.md §4`: "in-progress 단계에선 의무 아님"), 완료 시 `spec_impact` 를 선언하지 않으면 `spec-plan-completion.test.ts` 에서 build 실패가 발생한다. 본 plan 은 `spec/data-flow/2-auth.md` 변경을 포함하므로 완료 시 해당 경로를 `spec_impact` 에 기재해야 한다.
- 제안: 완료 이동(`plan/complete/`) 시 frontmatter 에 아래 추가 필수:
  ```yaml
  spec_impact:
    - spec/data-flow/2-auth.md
  ```

---

### INFO — frontmatter 필수 3필드 준수 확인
- target 위치: frontmatter (lines 1–5)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` — `worktree`, `started`(ISO), `owner` 3필드 필수
- 상세: `worktree: auth-refresh-rotation-atomic`, `started: 2026-06-11`, `owner: developer` 모두 존재하고 형식이 올바르다. `plan-frontmatter.test.ts` 가드 통과 예상. 위반 없음.
- 제안: 해당 없음.

---

## 요약

`plan/in-progress/auth-refresh-rotation-atomic.md` 는 정식 규약을 전반적으로 잘 준수하고 있다. Plan frontmatter 필수 3필드(`worktree`/`started`/`owner`)는 모두 올바르게 기재됐고 build 가드 통과가 예상된다. 문서 구조상 Rationale 섹션도 말미에 존재한다. 유의할 사항은 이 plan 의 `started`가 Gate C cutoff(2026-06-04) 이후이므로 `plan/complete/`로 이동 시 `spec_impact: [spec/data-flow/2-auth.md]`를 frontmatter에 반드시 추가해야 한다는 점이며, 현 in-progress 단계에서는 규약 위반이 아니다. CRITICAL 또는 WARNING 등급의 정식 규약 위반은 발견되지 않았다.

## 위험도

LOW
