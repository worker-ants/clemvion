# 정식 규약 준수 검토 결과

검토 대상: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/plan/in-progress/spec-fix-error-code-routing.md`
검토 모드: spec draft (--spec)
검토일: 2026-06-12

---

## 발견사항

### [WARNING] plan frontmatter 에 `spec_impact` 필드 없음 (완료 시점 준비 부재)
- target 위치: 파일 상단 frontmatter (lines 1-5)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2 (Gate C)` · `.claude/docs/plan-lifecycle.md §4 (Gate C)`
- 상세: 본 plan 의 `started: 2026-06-12` 는 grandfather cutoff `2026-06-04` 이후이므로 `complete/` 이동 시 frontmatter 에 `spec_impact:` 선언이 **의무**다. 현재 in-progress 단계이므로 지금 당장 빌드 실패를 일으키지는 않으나(Gate C 는 완료 시점 강제), 완료 이동 전 선언이 없으면 `spec-plan-completion.test.ts` 가 차단한다. 제안 변경에서 `spec/5-system/3-error-handling.md`·`spec/2-navigation/5-knowledge-base.md` 를 직접 수정하는 작업이므로 선언이 필요하다.
- 제안: frontmatter 에 미리 아래 항목 추가 후 완료 시 실존 파일 목록으로 확정:
  ```yaml
  spec_impact:
    - spec/5-system/3-error-handling.md
    - spec/2-navigation/5-knowledge-base.md
  ```

### [INFO] 문서 구조 — 제안 변경 본문에 Rationale 섹션 미포함
- target 위치: 문서 전체 구조
- 위반 규약: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`"
- 상세: plan 문서 자체가 아니라 target 이 되는 spec 파일들(`3-error-handling.md`·`5-knowledge-base.md`)에 Rationale 을 추가하도록 제안하고 있다. 본 plan 이 그 절차를 명확히 서술하고 있으므로 큰 문제는 아니나, `3-error-handling.md Rationale` 추가 방안(변경 §2)이 plan 안에서 인라인 추가 문구로만 제시되어 있고, 실제 target spec 문서의 Rationale 섹션 구체적 위치(행 번호 참조 `§397-401`)만 언급한다. 구현 시 Rationale 을 spec 파일 말미 규약 위치에 정확히 배치해야 함을 명시하는 것이 좋다.
- 제안: 변경 §2 에 "기존 Rationale 의 말미 — 파일 끝 `## Rationale` 섹션 안 추가" 임을 한 줄 명시.

### [INFO] 에러코드 표기 방식 확인 (규약 준수)
- target 위치: 문서 전반 — `MODEL_CONFIG_NOT_FOUND`, `MODEL_CONFIG_DEFAULT_MISSING` 표기
- 위반 규약: `spec/conventions/error-codes.md §1` (UPPER_SNAKE_CASE 표기 의무는 `3-error-handling.md §3.2` · `node-output.md §3.2` SoT)
- 상세: 두 에러코드 모두 `UPPER_SNAKE_CASE` 를 올바르게 사용하고 있다. 규약 위반 없음. 단순 확인 사항.
- 제안: 해당 없음.

### [INFO] Before/After 코드 블록 내 줄바꿈 포맷 — Markdown 표 셀 줄바꿈 의미 모호
- target 위치: `## 제안 변경 ### 1. Before/After` 코드 블록 (lines 43-54)
- 위반 규약: `spec/conventions/error-codes.md §1` 간접 — 에러 코드 카탈로그 SoT 는 `3-error-handling.md §1.3` Markdown 표이므로 표 셀 서식이 명확해야 한다.
- 상세: `Before`/`After` 코드 블록이 실제 Markdown 표 행으로 표현되어 있는데, 셀 내부에 줄바꿈이 있어 그대로 spec 파일에 붙여넣으면 표가 깨질 수 있다. Markdown GFM 표는 셀 내 줄바꿈을 지원하지 않는다. 실제 spec 파일(3-error-handling.md line 51)의 해당 행도 단일 줄로 작성되어 있다.
- 제안: After 제안 문구를 단일 표 행(줄바꿈 없음)으로 정리해 두면 실수 없이 적용 가능하다.

---

## 요약

plan 문서의 frontmatter 는 `worktree`·`started`·`owner` 의 3 필수 필드를 모두 갖추고 있어 `plan-frontmatter.test.ts` 빌드 가드를 통과한다. 에러코드 표기(`UPPER_SNAKE_CASE`)·에러코드 명명 원칙(의미 기반)·SoT 분리(카탈로그: `3-error-handling.md`, 명명 규약: `error-codes.md`) 모두 규약에 부합한다. Rationale 추가 위치도 spec 문서 말미 `## Rationale` 절로 올바르게 지정되어 있다. 유일한 규약상 주의 사항은 `started: 2026-06-12`(cutoff 이후)인 plan 이 완료 이동 시 `spec_impact:` 선언이 Gate C 에 의해 의무화되는 점으로, 지금 in-progress 단계에서 미리 예비 선언을 추가해 두는 것이 권장된다.

---

## 위험도

LOW
