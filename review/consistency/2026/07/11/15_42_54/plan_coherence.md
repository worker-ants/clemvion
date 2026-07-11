### 발견사항

- **[WARNING]** `spec-links.ts` 중복 정리 plan 항목이 이번 커밋으로 완료됐는데 plan 체크박스가 갱신되지 않음
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `findBrokenLinksInFiles` 공유 코어 추출 (커밋 `829ddceee refactor(docs-guard): spec-link 스캔 코어를 파라미터화해 중복 제거`)
  - 관련 plan: `plan/in-progress/eia-context-schema-followups.md` §"리뷰 후속" 32행 — `- [ ] **\`spec-links.ts\` 중복 정리** — \`collectCodebaseSources\`/\`findBrokenSpecLinksInSources\` 가 기존 \`collectSpecMarkdown\`/\`findBrokenLinks\` 와 ~40줄 골격 중복. 파일-목록 파라미터화한 코어로 추출 여지(동작은 정확, 저우선).`
  - 상세: 이번 diff 는 정확히 이 plan 항목이 요구한 작업(파일-목록 파라미터화한 코어 `findBrokenLinksInFiles` + `LinkScanOptions{checkSelfAnchors, targetFilter}` 로 `findBrokenLinks`/`findBrokenSpecLinksInSources` 두 공개 함수의 ~40줄 중복 골격을 통합)을 그대로 구현했다. 공개 함수 시그니처(`findBrokenLinks(root)`, `findBrokenSpecLinksInSources(root)`)와 동작(선택 로직·정렬)은 보존돼 순수 내부 리팩터로 보인다. 그러나 `git diff origin/main...HEAD --stat` 기준 이번 브랜치는 `spec-links.ts` 한 파일만 변경했고, `plan/in-progress/eia-context-schema-followups.md` 는 이 커밋에 포함되지 않아 32행 체크박스가 여전히 `[ ]` 로 남아 있다. 메모리 교훈("plan 체크박스 = 실제 상태: 수행 후에만 체크하고 그 커밋에 포함")과 정확히 일치하는 패턴 — 다음에 이 plan 문서를 읽는 사람은 이미 끝난 항목을 다시 "저우선 잔여"로 오인해 중복 작업을 시도할 수 있다.
  - 제안: `plan/in-progress/eia-context-schema-followups.md` 32행을 `[x]` 로 갱신하고, 커밋 829ddceee 참조와 완료 근거(공개 API 불변·동작 무변경)를 항목 설명에 추가한다. 같은 섹션의 다른 항목들(19·24·30·31행)이 이미 이 서식(완료 커밋/PR 참조 + 검증 요약)을 따르므로 동일 패턴으로 맞추면 된다.

### 요약

이번 diff(`spec-links.ts` 의 `findBrokenLinksInFiles` 코어 추출)는 순수 내부 리팩터로, 공개 함수 시그니처·동작·`spec-impl-evidence.md §4.2` SoT 표에 등재된 파일 경로가 모두 보존돼 spec 이나 다른 plan 의 미해결 결정과 충돌하지 않는다. 다만 이 작업이 `eia-context-schema-followups.md` 의 명시적 잔여 항목("`spec-links.ts` 중복 정리")을 그대로 이행한 것인데도 해당 plan 파일이 같은 커밋에 포함되지 않아 체크박스가 stale 상태로 남았다 — 후속 항목 갱신 누락에 해당하는 WARNING 1건.

### 위험도
LOW
