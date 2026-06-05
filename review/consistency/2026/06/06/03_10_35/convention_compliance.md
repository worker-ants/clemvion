# 정식 규약 준수 검토 결과

검토 대상: `spec/conventions/rag-evaluation.md` + `spec/5-system/9-rag-search.md` (NUL fix·이모지 수정 후 재검증, diff-base=origin/main)

---

## 발견사항

### INFO — `spec/conventions/rag-evaluation.md` `code:` 경로에 `cli-utils.ts` 미등재
- **target 위치**: `/spec/conventions/rag-evaluation.md` frontmatter `code:` 배열
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: implemented` spec 의 `code:` 는 해당 spec 이 약속한 surface 의 구현 경로를 기술한다.
- **상세**: diff 에서 신규 추가된 `codebase/backend/src/scripts/cli-utils.ts` 는 `eval-retrieval.ts` 와 `generate-golden-set.ts` 가 공유 의존하는 CLI 헬퍼로, `rag-evaluation.md` 의 구현 surface 일부다. 현재 frontmatter `code:` 에 누락. 빌드 가드(`spec-code-paths.test.ts`) 는 기존 경로 중 glob 매치가 >=1 있으므로 **빌드는 통과**하지만, spec 이 약속하는 구현 범위가 불완전하게 선언된 상태다.
- **제안**: `code:` 배열에 `codebase/backend/src/scripts/cli-utils.ts` 추가(또는 `codebase/backend/src/scripts/eval-*.ts` glob 으로 대체 가능).

---

### INFO — `spec/5-system/9-rag-search.md` `pending_plans:` 이동 시 Gate C 준비 필요
- **target 위치**: `/spec/5-system/9-rag-search.md` frontmatter `pending_plans:` + `/plan/in-progress/rag-eval-harness.md`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` Gate C — `started >= 2026-06-04` 완료 plan 에 `spec_impact` 선언 의무.
- **상세**: `plan/in-progress/rag-eval-harness.md` 는 진행 노트에 "Phase A+B 구현 완료"로 기록되어 있으나 아직 `plan/in-progress/` 에 머물러 있다. 이번 PR 완료 후 `plan/complete/` 로 이동 시 `started: 2026-06-06` 이 cutoff `2026-06-04` 이상이므로 Gate C 강제 대상이다. plan 에 `spec_impact` frontmatter 가 없어 이동 시 `spec-plan-completion.test.ts` 빌드 차단이 된다.
- **제안**: `rag-eval-harness.md` 를 `plan/complete/` 로 이동할 때 frontmatter 에 `spec_impact: ["spec/conventions/rag-evaluation.md", "spec/5-system/9-rag-search.md"]` 추가 필요.

---

### INFO — `spec/conventions/rag-evaluation.md` §5 이모지 잔류
- **target 위치**: `/spec/conventions/rag-evaluation.md` §5 해석 가이드 라인 123~127
- **위반 규약**: CLAUDE.md "Only use emojis if the user explicitly requests it." 검토 모드에 "이모지 수정 후 재검증" 명시.
- **상세**: `spec/conventions/rag-evaluation.md` §5 에 `❌` / `✅` 이모지가 잔류한다. 검토 모드에서 이모지 수정을 완료했다고 설명하나, 실제 파일에는 해당 이모지가 제거되지 않은 상태다.
- **제안**: `❌` -> `금지:` / `✅` -> `허용:` 또는 `X` / `O` 등 이모지 없는 표현으로 교체.

---

## 요약

정식 규약(`spec/conventions/`) 준수 관점에서 이번 변경 집합은 전반적으로 양호하다. `spec/conventions/rag-evaluation.md` 의 frontmatter `id`/`status`/`code:` 구성은 `spec-impl-evidence.md §2~§3` 규약을 충실히 따르며, 3섹션 구조(Overview / 본문 / Rationale)도 충족하고, `spec/5-system/9-rag-search.md` 의 `pending_plans:` 링크도 실존 파일을 가리킨다. 에러 코드(RERANK_ENDPOINT_FAILED 등 UPPER_SNAKE_CASE)는 `error-codes.md` 의 명명 규약을 준수한다. 주요 미비는 세 가지 INFO 수준이다: (1) `cli-utils.ts` 가 `rag-evaluation.md` `code:` 에 빠진 것(기능 가드 통과이나 선언 불완전), (2) `rag-eval-harness.md` plan 완료 이동 시 Gate C(`spec_impact`) 선언이 없어 빌드 차단 예비 위험, (3) `spec/conventions/rag-evaluation.md` §5 에 이모지(`❌`/`✅`) 잔류. CRITICAL 또는 WARNING 수준 위반은 없다.

## 위험도

LOW
