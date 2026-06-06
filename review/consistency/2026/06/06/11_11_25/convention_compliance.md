# 정식 규약 준수 검토 결과

**Target**: `plan/in-progress/spec-update-llm-embed-signature.md`
**검토 모드**: spec draft 검토 (--spec)
**검토일**: 2026-06-06

---

## 발견사항

### [INFO] 문서 제목이 "Spec Update Draft" — plan 문서로서의 성격 중립
- target 위치: 파일 첫 줄 `# Spec Update Draft — llm-embed-signature`
- 위반 규약: 해당 없음 (금지 항목 아님)
- 상세: 파일은 `plan/in-progress/` 에 위치하며 plan 문서로 분류된다. 제목이 "Spec Update Draft" 인 것은 내용상 spec 변경 제안을 담은 plan 임을 명확히 하므로 문제없다. 다만 plan 문서로서의 표준 제목 패턴(`# Plan: <name>` 또는 자유형) 대비 "Draft" 어휘가 spec 의 draft 가 아닌 plan 자체인지 혼동 가능성이 있다.
- 제안: 현행 유지 가능. 명확성을 높이려면 `# Plan: Spec 갱신 — LlmService.embed 시그니처` 형태도 고려할 수 있으나 강제 사항 아님.

### [INFO] 체크박스·완료 추적 항목 부재
- target 위치: 문서 전체
- 위반 규약: `.claude/docs/plan-lifecycle.md §2` — "미체크 체크박스(`[ ]`), TODO, 남은 작업, 다음 단계, 결정 필요, 미해결 follow-up 항목이 하나라도 있으면 `in-progress/`"
- 상세: plan-lifecycle §2 는 in-progress 문서의 분류 기준을 체크박스·TODO 등의 존재로 정의한다. 역으로, 본 문서에는 체크박스가 전혀 없어 "무엇이 남았는가" 를 추적할 수 없다. 규약이 체크박스를 의무화하는 것은 아니지만, plan 문서로서 실행 단계 추적이 없으면 완료 이동 판단(`plan-lifecycle §3`)이 불명확해진다.
- 제안: 적용할 spec 파일과 변경 항목을 체크박스(`- [ ] spec/5-system/7-llm-client.md §8.3 embed 시그니처 추가` 등)로 열거해 완료 여부를 명시하는 것을 권장. 강제 위반은 아님.

### [WARNING] 완료 이동 시 spec_impact 선언 필수 — in-progress 단계 예고
- target 위치: frontmatter 전체
- 위반 규약: `.claude/docs/plan-lifecycle.md §4 · §5 Gate C` + `spec/conventions/spec-impl-evidence.md §4.2` — `started >= 2026-06-04` 인 plan 이 `complete/` 로 이동할 때 `spec_impact` 필드 의무
- 상세: `started: 2026-06-06` 이므로 cutoff(2026-06-04) 이후 시작 plan 이다. 현재 `in-progress` 단계에서는 `spec_impact` 미선언이 가드 위반이 아니다(완료 이동 시점에만 `spec-plan-completion.test.ts` 가 강제). 그러나 본 plan 의 목적이 spec 변경 적용이므로, 완료 이동 시 `spec_impact` 에 `spec/5-system/7-llm-client.md` 와 `spec/5-system/8-embedding-pipeline.md` 를 반드시 선언해야 한다.
- 제안: 완료 이동 시 아래와 같이 frontmatter 갱신 필수:
  ```yaml
  spec_impact:
    - spec/5-system/7-llm-client.md
    - spec/5-system/8-embedding-pipeline.md
  ```

### [WARNING] 원본 발견사항 섹션 번호 오기(§3.3) — NOTE 에서만 교정, 불일치 잔존
- target 위치: `## 원본 발견사항` 섹션 + `## 제안 변경` NOTE 단락
- 위반 규약: 정식 규약 직접 위반은 아님. 내적 일관성 문제로 plan 독자에게 혼란 유발.
- 상세: `## 원본 발견사항` 에서 SUMMARY#8 은 "§3.3 의 `LlmService.embed` 시그니처..." 를 가리킨다. `## 제안 변경` 의 NOTE 에서는 "§3.3 은 `LLMClient` 인터페이스, `LlmService.embed` 는 §8 에 해당하므로 §8.3 에 추가" 라고 자체 교정한다. 이 교정이 원본 발견사항 섹션에 반영되지 않아 두 섹션 간 참조가 어긋난 채로 남아있다.
- 제안: `## 원본 발견사항` 섹션의 SUMMARY#8 기술을 `spec/5-system/7-llm-client.md §8.3 (원 발견사항 §3.3 은 오기)` 형태로 정정하거나, 인라인 주석으로 "(§3.3 은 오기 — 실제 대상은 §8.3)" 을 추가.

### [INFO] 문서 구조 — Overview / 본문 / Rationale 3섹션 권장 패턴 적용 대상 아님 (확인)
- target 위치: 문서 전체 구조
- 위반 규약: 해당 없음
- 상세: Overview / 본문 / Rationale 3섹션 권장은 `spec/**/*.md` 에 적용된다. 본 문서는 `plan/in-progress/` plan 문서이므로 적용 대상 아님. 위반 없음.
- 제안: 해당 없음.

---

## 요약

`plan/in-progress/spec-update-llm-embed-signature.md` 는 정식 규약의 build guard 차단 요건을 모두 충족한다. frontmatter 필수 3필드(`worktree`·`started`·`owner`)가 정상 선언돼 있고, `worktree` 값 `embedding-model-ux-c40698` 은 `<task>-<slug>` 형식에 부합하며, `spec_impact` 미선언은 in-progress 단계에서 허용된 상태다. WARNING 2건은 각각 (1) 완료 이동 시 Gate C 의무(`spec_impact` 선언 필요) 예고와 (2) 원본 발견사항의 섹션 번호 오기가 plan 내에서 교정됐으나 발견사항 섹션에 반영되지 않은 내적 불일치다. 두 건 모두 현 in-progress 단계에서 빌드를 차단하지 않으나, 완료 이동 전 `spec_impact` 필드를 빠뜨리면 Gate C 위반이 되므로 주의가 필요하다.

---

## 위험도

LOW
