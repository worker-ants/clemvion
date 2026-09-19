# 요구사항(Requirement) 충족 리뷰

## 발견사항

- **[WARNING]** plan draft 자신의 체크리스트가 이미 끝난 작업을 미완으로 표시한다
  - 위치: `plan/in-progress/spec-draft-code-guards-and-change-summary.md` — `## 체크리스트` 절 (파일 끝 4개 항목)
  - 상세: 현재 파일 내용은
    ```
    - [x] `--spec` 이 draft — ... BLOCK: NO ...
    - [ ] spec 반영
    - [ ] 가이드 정정 · lint · unit · build (e2e 면제 — 화이트리스트) · `/ai-review`
    - [ ] 트래커 두 항목 닫기 · 이 draft `plan/complete/` 로
    ```
    이지만, 실측(`git log`)으로 확인하면 "spec 반영"은 커밋 `19f58a3b7`(`spec/1-data-model.md` · `spec/3-workflow-editor/0-canvas.md` 갱신)로, "가이드 정정"은 커밋 `4a00859cd`(`version-history.mdx`/`.en.mdx`)로 **이미 완료**됐다. 게다가 지금 이 리뷰 자체가 세 번째 항목이 요구하는 `/ai-review` 실행이다. 즉 4개 중 최소 2개(스펙 반영·가이드 정정)는 실제로 끝났는데 체크박스는 여전히 미체크 상태다. 메모리 규약("plan 체크박스 = 실제 상태 — 수행 후에만 체크")과 정면으로 어긋난다.
  - 제안: 이번 세션 안에서 이 draft 파일의 체크리스트를 실제 상태로 갱신하고(스펙 반영·가이드 정정 체크), `/ai-review`·나머지 lint/unit/build 확인 후 트래커 두 항목을 닫고 draft 를 `plan/complete/` 로 이동한다.

- **[WARNING]** 세 문서가 아직 존재하지 않는 `plan/complete/spec-draft-code-guards-and-change-summary.md` 를 "근거"로 인용한다
  - 위치:
    - `spec/1-data-model.md:1002` — `근거: \`plan/complete/spec-draft-code-guards-and-change-summary.md\`.`
    - `spec/3-workflow-editor/0-canvas.md` R-5 문단 끝(526행대 §8.1 정정 바로 아래, "근거: `plan/complete/spec-draft-code-guards-and-change-summary.md`.")
    - `plan/in-progress/spec-draft-nullable-notation-followups.md` — 두 항목의 "2026-09-19 해소" 주석 (각각 `plan/complete/spec-draft-code-guards-and-change-summary.md` 인용)
  - 상세: 실측(`ls`) 결과 이 경로는 존재하지 않는다 — 실제 파일은 `plan/in-progress/spec-draft-code-guards-and-change-summary.md` 에 있다(위 발견사항대로 아직 `plan/complete/` 로 옮겨지지 않았다). `.claude/docs/plan-lifecycle.md` 는 "미완 항목이 단 하나라도 남으면 옮기지 않는다"고 명시하는데, 이 draft 는 자신의 체크리스트에 미완 항목을 3개나 남긴 채 이미 두 spec 파일과 트래커 세 곳에서 `plan/complete/...` 경로를 기정사실처럼 인용하고 있다. 같은 `spec/1-data-model.md` 안의 인접 Rationale 항목(`근거·실측: plan/complete/spec-draft-data-model-fk-actions.md`)은 실제로 이미 `plan/complete/` 에 존재하는 파일을 가리켜 대조군이 된다 — 이번 인용만 선례와 다르게 아직 이동하지 않은 경로를 가리킨다. `spec-link-integrity.test.ts` 류 가드는 마크다운 링크만 검사해 백틱 산문 인용은 걸러내지 못하므로 build 는 통과하지만, 지금 이 "근거" 인용을 따라가는 다음 사람은 파일을 찾지 못한다.
  - 제안: 위 첫 발견사항대로 draft 를 실제로 `plan/complete/` 로 옮기는 마무리 커밋을 이번 PR 범위 안에 포함시켜 세 인용이 가리키는 경로를 실재하게 만든다. (병합 순서상 `/ai-review` 통과 후 마지막 커밋으로 처리하면 되므로 이 자체가 최종 실패는 아니다 — 단, 지금 상태로 머지되면 깨진 참조가 남는다.)

- **[INFO]** draft 체크리스트의 "반영" 각주가 INFO 3(게이트 메커니즘 명시)을 실제보다 넓게 주장한다
  - 위치: `plan/in-progress/spec-draft-code-guards-and-change-summary.md` `## 체크리스트` 1번째 항목 — "INFO 3(게이트 기준 명시) → §3 첫 절"
  - 상세: `review/consistency/2026/09/19/10_23_21/convention_compliance.md` INFO 1 은 "효과" 문장에 `review_guard._spec_linked_changes`(전수 스캔) 라는 구체적 메커니즘 이름을 덧붙이라고 제안했다. 그런데 실제로 커밋된 `spec/1-data-model.md` Rationale(§3 첫 절)에는 `--impl-done` 언급만 있고 `review_guard._spec_linked_changes` 함수명은 등장하지 않는다(grep 확인). INFO 항목이 애초에 "선택 사항"이었으므로 결함은 아니지만, draft 의 "반영 완료" 자기보고가 실제 반영 폭보다 넓다.
  - 제안: 조치 불요(선택 사항이었음). 다음에 유사한 "반영" 각주를 쓸 때는 인용된 제안 문구가 실제로 spec 본문에 들어갔는지 문자열 단위로 재확인할 것.

## 검증한 사실관계 (결함 아님 — 정합 확인)

- `workflows.service.ts:725` `changeSummary: \`Restored from v${target.version}\`` (복원 전용) · `save-canvas.dto.ts:214` `changeSummary?: string`(저장 API 는 요청값을 그대로 받음) · `codebase/frontend/src/lib/api/workflows.ts` `saveCanvas` 타입에 `changeSummary` 필드 없음(응답 타입·표시 컴포넌트에만 존재) — 모두 spec/가이드 정정 내용과 정확히 일치.
- `version-history-panel.tsx:170` `{v.changeSummary && (...)}` — 가이드의 "change summary (when present)"/"변경 요약(있을 때만)" 서술과 정확히 일치.
- `spec/3-workflow-editor/5-version-history.md` §7.4·§9, `spec/data-flow/11-workflow.md` — 이미 올바르게 서술돼 있어 이번 정정과 충돌 없음(전수 grep: `spec/` 내 `change_summary`/`changeSummary` 언급 중 틀린 곳은 이번에 고친 0-canvas.md §8.1 한 줄뿐이었고, 지금은 잔여 오기술 없음).
- `codebase/frontend/src/content/docs` 전체에서 `changeSummary`/`change_summary` 를 언급하는 파일은 이번에 고친 두 mdx 뿐 — 다른 가이드 페이지에 같은 결함 잔존 없음.
- `.claude/hooks/_lib/review_guard.py::_parse_frontmatter_code` 는 블록 리스트 안의 빈 줄·`#` 주석을 건너뛰도록 이미 고쳐져 있어(2026-09-06), `spec/1-data-model.md` frontmatter 에 추가된 2줄 주석이 뒤따르는 3개 e2e 경로 파싱을 깨뜨리지 않는다 — 실제로 그 파일을 열어 프리앰블·리스트 순서를 확인해 정상 파싱됨을 검증했다.
- 신규 등재 3개 e2e 파일(`deletion-cascade-indexes.e2e-spec.ts` · `trigger-endpoint-path-dedupe.e2e-spec.ts` · `entity-schema-declarations.e2e-spec.ts`) 모두 `codebase/backend/test/` 에 실존.
- `spec/1-data-model.md` 는 `spec/conventions/spec-impl-evidence.md §1` 의 frontmatter-evidence build gate inclusive list 밖(`EXCLUDE_BASENAMES`)이라 그 build gate 는 이 `code:` 를 검증하지 않지만, `_spec_linked_changes` 는 `os.walk(spec/)` 로 basename 필터 없이 전수 스캔하므로 draft 가 주장한 "`--impl-done` 을 부른다" 효과는 실제로 성립 — 소스 직접 확인.
- 첨부된 consistency-check 산출물(`review/consistency/2026/09/19/10_23_21/*.md`) 각 항목을 `SUMMARY.md` 집계와 대조 — 개수(Critical 0·WARNING 3·INFO 6)·내용 모두 일치, 정보 손실 없음. WARNING 2(R-CC-22 원칙과의 거리)·WARNING 3(R-3 연장 미기재)는 실제로 커밋된 `spec/1-data-model.md`·`spec/3-workflow-editor/0-canvas.md` Rationale 에 각각 반영돼 있음을 본문 대조로 확인.
- 이 변경은 새 요구사항 ID·API·엔티티·상태 전이를 도입하지 않는 순수 문서/스펙 정정(사용자 결정: 자동 요약 기능은 만들지 않음)이라 "엣지 케이스·에러 시나리오·반환값" 관점은 대체로 해당 사항 없음.

## 요약

핵심 변경(스펙 §8.1 정정·가이드 mdx 정정·`1-data-model.md` `code:` 3건 등재)은 코드(`workflows.service.ts`·`save-canvas.dto.ts`·frontend `saveCanvas`/`version-history-panel.tsx`)와 line-level 로 정확히 일치하며, 전수 grep 으로 spec·가이드 전체에 동일 결함의 잔존이 없음을 확인했다. consistency-check 가 지적한 WARNING 2건도 최종 커밋에 반영됐다. 다만 이 작업 자체의 plan-lifecycle 위생에 결함이 있다 — draft(`plan/in-progress/spec-draft-code-guards-and-change-summary.md`)의 체크리스트가 이미 완료된 두 항목(spec 반영·가이드 정정)을 미체크로 남겨 뒀고, 그 상태에서 두 spec 파일과 트래커 세 곳이 아직 존재하지 않는 `plan/complete/spec-draft-code-guards-and-change-summary.md` 를 근거로 인용하고 있다. 이는 제품 기능/코드 결함이 아니라 이 저장소가 명시적으로 중요하게 다루는 "plan 체크박스 = 실제 상태" 규약 위반이며, 이번 PR 이 최종적으로 draft 를 `plan/complete/` 로 옮기고 체크박스를 갱신하는 마무리 커밋을 거치지 않으면 병합 후에도 깨진 참조로 남는다.

## 위험도

LOW
