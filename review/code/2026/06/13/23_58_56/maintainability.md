# 유지보수성(Maintainability) 리뷰 결과

**검토 대상**: spec-sync-s-batch-b85f17 변경셋 (13개 파일)
**검토 일시**: 2026-06-13

---

## 발견사항

### [INFO] 파일 1 — `resume-turn-dispatch.ts` JSDoc spec 참조 교정
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` line 68
- 상세: `§6.2(중첩 재개)` → `§7.5(rehydration · 중첩 sub-workflow 재개). (§6.2 는 영속화 정책)` 로 교정. 독자가 JSDoc 에서 spec 섹션을 참조할 때 정확한 섹션으로 안내되며 혼동이 제거된다. 단일 라인 변경으로 의도가 명확하다.
- 제안: 없음. 가독성·정확성 모두 개선.

### [INFO] `ResumeTurnDispatch` 인터페이스 전체 구조 — 유지보수성 양호
- 위치: `resume-turn-dispatch.ts` 전체
- 상세: `ResumeTurnDispatch`·`ResumeTurnSelector`·`ResumeTurnContext` 세 인터페이스가 역할별로 분리돼 있고, 각 필드에 명확한 한국어 JSDoc 이 붙어 있다. `readonly` 를 전면 사용해 불변 의도를 명시한다. 네이밍(`selects`, `handle`, `persistedInteractionType`, `hasResumeCheckpoint` 등)이 목적을 잘 나타낸다.
- 제안: 없음.

### [INFO] plan 문서 완료 이동 패턴 일관성
- 위치: `plan/complete/spec-sync-resume-dispatch-registry.md`, `plan/complete/spec-update-doc-style.md`, `plan/complete/spec-update-pr2-embedding.md`, `plan/complete/spec-update-sse-single-instance-rationale.md`
- 상세: 4개 plan 문서 모두 `plan/complete/` 로 이동되어 있으며, frontmatter 스키마(`worktree`, `started`, `owner`, `spec_impact`) 가 일관되게 작성됐다. 항목(W1/W2/I3/I4) 상태(`[x]`) 및 완료 날짜가 인라인으로 기록돼 이력 추적이 가능하다.
- 제안: 없음.

### [WARNING] `spec-update-pr2-embedding.md` 항목 구조 — 제안 변경과 실제 완료 결과 혼재
- 위치: `/Volumes/project/private/clemvion/plan/complete/spec-update-pr2-embedding.md`
- 상세: 파일 상단의 완료 블록이 "본 plan 의 제안 변경이 모두 supersede 됨"을 설명하지만, 하단에는 이미 적용되지 않은 "Before/After" 예시(`### 1. §2.11 필드 표`, `### 2. §5.2 폴백 체인`, `### 3. frontmatter 갱신`)가 상당량 남아 있다. 후속 독자가 제안 예시를 최신 현행 spec 으로 오인할 수 있다. 특히 "3-step 폴백 체인" 예시는 이미 PR4b 에서 2-step 으로 발전된 구현보다 퇴행이라는 점이 상단 완료 블록에서 명시되었지만, 예시 자체는 그대로 남아 있어 유지보수성 위험이 있다.
- 제안: `plan/complete/` 에 들어간 시점에서 "제안 변경" 섹션 전체를 `> [superseded] — 내용은 상단 완료 블록 참조` 한 줄 callout 으로 압축하거나, 최소한 각 Before/After 예시 상단에 `> 미적용 (superseded by PR4b)` 주석을 추가해 오인 위험을 줄인다.

### [INFO] `spec-update-gap-callout-plan-links.md` heads-up 노트 추가
- 위치: `/Volumes/project/private/clemvion/plan/in-progress/spec-update-gap-callout-plan-links.md`
- 상세: 파일 끝에 `> **heads-up (2026-06-13, spec-sync-s-batch)**:` 블록을 추가해 이후 착수자에게 §1.3 note 변경 사실을 명시적으로 경고하는 패턴은 유지보수성 관점에서 긍정적이다. 단, 이 추가가 "제안 변경" 섹션과 시각적으로 분리되지 않고 파일 말미에 붙어 있어, 독자가 해당 파일의 구조(원본 발견사항 / 제안 변경 / heads-up)를 즉시 파악하기 어렵다.
- 제안: heads-up 블록 앞에 `## 진행 메모` 또는 `## 후속 주의사항` 헤딩을 추가하면 섹션 구조가 명확해진다.

### [INFO] consistency review 산출물 — `_retry_state.json` 의 `agents_pending` 비어있지 않은 상태로 커밋
- 위치: `/Volumes/project/private/clemvion/review/consistency/2026/06/13/23_47_46/_retry_state.json`
- 상세: `agents_pending` 배열에 5개 checker 가 남아 있고 `agents_success: []` 인 채로 커밋됐다. SUMMARY.md 는 모든 checker 결과를 반영해 완성된 상태이므로 실제 작업에 문제는 없으나, retry_state.json 이 "미완료" 인상을 준다. orchestrator 완료 후 해당 파일을 정리하거나 최종 완료 상태로 갱신하는 패턴이 없다면, 향후 worktree 상태 감사(audit) 시 혼동의 원인이 될 수 있다.
- 제안: 검토 프로세스 완료 후 `agents_pending: []`, `agents_success: [all]` 로 갱신하거나, 해당 파일을 커밋 범위에서 제외하는 orchestrator 패턴 정비 권장. 당장의 기능 위험은 없다.

### [INFO] `meta.json` 파일 — 줄 끝 newline 없음
- 위치: `/Volumes/project/private/clemvion/review/consistency/2026/06/13/23_47_46/meta.json` (diff 의 `\ No newline at end of file`)
- 상세: `meta.json` 과 `_retry_state.json` 모두 파일 끝 개행 없이 작성됐다. git diff 에서 `\ No newline at end of file` 경고가 발생하며, 일부 도구에서 JSON 파싱 오류로 이어질 수 있다.
- 제안: 두 JSON 파일의 마지막 줄에 개행을 추가한다.

---

## 요약

이번 변경셋의 핵심 코드 변경(`resume-turn-dispatch.ts` JSDoc 교정)은 1줄 수정으로 의도가 명확하고 인터페이스 자체의 유지보수성도 우수하다. Plan 문서들은 frontmatter 스키마 일관성과 상태 추적 가시성이 양호하다. 주요 유지보수성 우려는 `spec-update-pr2-embedding.md` 의 "제안 변경" 섹션이 이미 supersede 된 예시를 다량 포함한 채 `plan/complete/` 에 들어간 점이며, 후속 독자가 해당 예시를 현행 spec 지침으로 오인할 가능성이 있다. `_retry_state.json` 의 미완 상태 커밋과 JSON 파일의 trailing newline 누락은 경미한 도구 호환성 문제다. 전반적으로 doc-sync 중심의 변경셋이므로 코드 레벨 유지보수성 위험은 낮다.

---

## 위험도

LOW
