# 정식 규약 준수 검토 결과

**Target**: `plan/in-progress/spec-draft-code-node-followups.md`
**검토 모드**: spec draft (--spec)
**검토 일자**: 2026-06-12

---

## 발견사항

### [INFO] plan frontmatter 에 `spec_impact` 미선언 — in-progress 단계라 의무는 아님
- target 위치: frontmatter (lines 1–5)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` — `spec_impact` 는 `complete/` 이동 시점에만 의무. in-progress 단계에서는 선택 사항.
- 상세: 현재 frontmatter 에 `spec_impact` 가 없다. 본 plan 은 `plan/in-progress/` 단계이므로 build guard(`spec-plan-completion.test.ts`)가 강제하는 대상이 아님. 완료 이동 시 선언 필요.
- 제안: 현 단계에서는 조치 불요. `complete/` 이동 PR 에서 `spec_impact: spec/4-nodes/5-data/2-code.md` 를 frontmatter 에 추가할 것.

### [INFO] 변경 3 env var 이름 — spec 내 이름과 코드 W15 주석의 이름이 이미 일치, 별도 이름 인벤토리 없음
- target 위치: §변경 3 (lines 68–87), "후속 code PR" 절 line 92
- 위반 규약: 직접 위반 규약 없음. 관련 문서: `spec/conventions/error-codes.md §4` (내부 분류 코드 vs public 코드 구분)
- 상세: target 은 `CODE_NODE_MEMORY_LIMIT_MB` env var 이름을 사용. 현재 코드(`code.handler.ts` line 17의 W15 주석)가 이미 `CODE_NODE_MEMORY_LIMIT_MB` 로 예고하고, 내부 상수는 `ISOLATE_MEMORY_LIMIT_MB`. "후속 code PR" 절(line 92)에서 "`ISOLATE_MEMORY_LIMIT_MB` → `CODE_NODE_MEMORY_LIMIT_MB` env 파싱" 으로 기술하는데 이는 내부 JS 상수 리네임이 아니라 env var 신규 도입을 의미함. 기술이 약간 오해를 유발할 수 있다.
- 제안: "후속 code PR" 절 기술을 "`CODE_NODE_MEMORY_LIMIT_MB` env var 파싱 추가 (기본 128, clamp ≤512)" 로 명확화. `ISOLATE_MEMORY_LIMIT_MB` 내부 상수는 유지하거나 제거하는 별도 결정임을 명시하면 좋음. 규약 위반은 아님.

### [INFO] §변경 1 Rationale 날짜 제목 형식 — spec 본문 Rationale 날짜 컨벤션 확인 필요
- target 위치: §1-c, §2-b, §3-c (각 Rationale 신규 절 제목)
- 위반 규약: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`". 날짜 형식 자체에 대한 별도 정식 규약은 없음.
- 상세: 각 변경 항목에서 Rationale 절 제목을 `### <주제> (2026-06-12)` 형식으로 기술하고 있다. 이 형식은 target spec 파일(`spec/4-nodes/5-data/2-code.md`)의 기존 Rationale 절 형식과 일치하는지 확인이 필요하나, plan draft 문서 자체에 대한 규약 위반은 없음.
- 제안: target spec 파일의 기존 Rationale 절 제목 형식을 참조하여 일관성 유지. 규약 위반 아님.

---

## 요약

`plan/in-progress/spec-draft-code-node-followups.md` 는 정식 규약 준수 관점에서 **전반적으로 적절하게 작성**되어 있다. frontmatter 3필드(`worktree`/`started`/`owner`)가 모두 존재하고 `plan-frontmatter.test.ts` 가드 요건을 충족한다. 참조 에러 코드(`CODE_EXECUTION_FAILED`, `CODE_MEMORY_LIMIT`)는 `spec/conventions/error-codes.md §4` 의 public 코드와 정확히 일치한다. 문서 구조는 CLAUDE.md 의 Overview/본문/Rationale 3섹션 권장에 부합하며, `spec/conventions/` 의 정식 규약을 직접 위반하는 패턴은 발견되지 않았다. 발견사항 3건은 모두 INFO 수준의 명확화 제안이다.

---

## 위험도

NONE
