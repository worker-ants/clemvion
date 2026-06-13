# Documentation Review

## 발견사항

### [INFO] spec/2-navigation/1-workflow-list.md — §2.4 테이블의 "구현 상태" 컬럼 서술 방식 일부 미흡
- 위치: spec/2-navigation/1-workflow-list.md, §2.4 정렬 테이블
- 상세: 새 테이블은 "서버 `last_run`(`execution` 테이블의 워크플로별 `MAX(started_at)` correlated subquery, 미실행 워크플로는 `NULLS LAST`) + UI" 처럼 구현 메커니즘 세부사항(SQL 패턴, NULLS LAST)을 spec 본문에 직접 노출한다. spec 의 "단일 진실" 역할은 *무엇을* 보장하는지(정렬 기준·방향·미실행 처리 정책)이며, *어떻게* 구현하는지(subquery 방식)는 구현 계층에 두는 것이 spec 관리 비용을 낮춘다. 현재 기술이 틀린 것은 아니지만, 구현 방식이 바뀔 때마다 spec 도 편집해야 하는 결합이 생긴다.
- 제안: "서버 `last_run` 지원 + UI" 처럼 무엇을 지원하는지에 집중하고, subquery 세부사항은 코드 주석(현재 `workflows.service.ts` 인라인 주석 `§2.4`)으로 위임하는 편이 낫다.

### [INFO] workflows.service.ts — `findAll` 공개 메서드에 JSDoc/TSDoc 없음
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/workflows/workflows.service.ts`, `findAll` 메서드 (약 라인 115)
- 상세: `getGraphWarnings`, `evaluateGraphWarnings` 등 다른 공개·private 메서드는 상세한 JSDoc이 있으나, `findAll`은 인라인 주석만 산재한다. `sort='last_run'` 동작 방식, `ownership` 필터 팀/개인 워크스페이스 분기, `NULLS LAST` 보장 등 호출자가 알아야 할 계약이 주석 조각으로 분산되어 있다.
- 제안: `findAll` 상단에 `@param`/`@returns` 수준의 JSDoc을 추가하고 `sort` 허용값 및 `last_run`의 NULLS LAST 정책을 명시한다. 기존 인라인 주석은 유지해도 된다.

### [INFO] workflows.service.ts — `getSortColumn` private 메서드에 허용 목록 확장 가능성 미기재
- 위치: `getSortColumn` 메서드 (파일 하단)
- 상세: `last_run`은 `getSortColumn`을 거치지 않는 별도 분기이지만, `getSortColumn` 자체에는 이 사실이 언급되어 있지 않다. 나중에 `last_run`을 허용 목록에 추가하려는 개발자가 `getSortColumn`만 수정하고 `last_run` 분기를 간과할 수 있다.
- 제안: `getSortColumn` 상단에 `// Note: 'last_run' 은 findAll 에서 별도 subquery 분기로 처리됨 — 여기에 추가하지 말 것` 수준의 한 줄 주석을 추가한다.

### [INFO] workflows.service.spec.ts — 테스트 describe 블록 제목에 "§2.4" 스펙 참조 혼용
- 위치: 라인 45: `it("§2.4 sort='last_run' → execution 최근 실행 subquery orderBy (NULLS LAST)"...`
- 상세: 다른 테스트 케이스는 자연어로 기술되는데 이 케이스만 spec 섹션 번호(`§2.4`)를 포함한다. 일관성이 없고, spec 섹션 번호가 리팩토링 시 drift될 수 있다. 오류는 아니며 추적성을 위한 선택이지만, 팀 컨벤션이 섹션 참조를 테스트 이름에 포함하는지 명확하지 않다.
- 제안: 팀이 스펙 참조 컨벤션을 일관되게 채택할 경우 인라인 주석(`// spec §2.4`)으로 분리하거나, 현행 방식을 명시적 컨벤션으로 채택한다.

### [INFO] page.tsx — `SORT_OPTIONS` 상수에 JSDoc 없음 (신규 정렬 옵션 추가 가이드 부재)
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/app/(main)/workflows/page.tsx`, 라인 47-79
- 상세: `SORT_OPTIONS`는 새 정렬 옵션 추가 시 참조해야 할 핵심 상수이지만 상단 주석이 `// spec §2.4 — 정렬 옵션 → backend sort/order 매핑` 한 줄이다. `sort`/`order` 필드의 값이 backend `QueryWorkflowDto`와 `getSortColumn` allowlist에 일치해야 한다는 계약이 코드 독자에게 명확하지 않다.
- 제안: `// Note: sort/order 값은 backend QueryWorkflowDto 허용 목록 및 getSortColumn (또는 last_run 분기)과 동기화되어야 한다` 수준의 주석을 추가한다.

### [INFO] plan/in-progress/spec-sync-workflow-list-gaps.md — frontmatter의 `worktree` 필드 누락
- 위치: `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-workflow-list-gaps.md`
- 상세: CLAUDE.md의 plan frontmatter 스키마(`.claude/docs/plan-lifecycle.md`)에 따르면 진행 중 플랜에는 `worktree` 명시가 요구된다. 현재 frontmatter에 `worktree` 필드가 없고 `owner: planner`만 있다.
- 제안: frontmatter에 `worktree: impl-workflow-list-gaps-f4f815` 추가.

### [INFO] spec/2-navigation/1-workflow-list.md — ASCII 목업에 정렬 드롭다운 미반영
- 위치: §1 화면 구조 ASCII 목업
- 상세: 경고 텍스트는 "정렬은 드롭다운(§2.4 구현)"으로 업데이트됐지만, 목업 다이어그램 자체에는 정렬 드롭다운이 표시되지 않는다. `[전체][Active][Inactive]` 옆에 정렬 드롭다운이 추가된 현행 구현이 반영되지 않았다.
- 제안: 목업에 `[정렬 ▾]` 또는 `Sort [▾]` 등의 표시를 추가해 실제 UI와 일치시킨다. (낮은 우선순위 — 문서 보조 역할이므로 경고 텍스트가 커버하고 있음)

## 요약

이번 변경은 워크플로우 목록 정렬 기능의 풀스택 구현으로, 문서화 품질은 전반적으로 양호하다. spec 파일(`1-workflow-list.md`)이 실제 구현에 맞게 현행화되었고, plan 파일 체크박스가 완료 항목을 정확히 반영한다. 인라인 주석(`§2.4`, `NULLS LAST`, injection 안전성)이 복잡한 로직에 충분히 기재되어 있다. 개선 여지는 (1) `findAll` 공개 메서드 JSDoc 부재, (2) `getSortColumn`에 `last_run` 별도 분기 사실 미기재, (3) spec 본문에 구현 메커니즘 세부사항(subquery 방식)이 혼입되어 향후 spec-impl 결합도가 높아질 수 있는 점이다. 모두 선택적 개선이며 기능 동작이나 안전성에는 영향이 없다.

## 위험도

LOW
