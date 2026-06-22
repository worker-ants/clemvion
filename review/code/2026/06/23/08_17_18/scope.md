# 변경 범위(Scope) Review

## 발견사항

### [INFO] `apiClient` 임포트가 `triggers/page.tsx` 에 잔류
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/app/(main)/triggers/page.tsx` 상단 임포트
- 상세: 전체 파일 컨텍스트를 보면 `import { apiClient } from "@/lib/api/client";` 임포트가 여전히 남아 있다. diff 에서 `/workflows` 호출은 의도적으로 잔류시켰으나, 해당 임포트가 lint 경고를 유발할 가능성이 있다. 커밋 메시지는 "lint·build PASS" 를 명시하므로 실제로는 사용 중인 것으로 보이나(workflows 쿼리 `apiClient.get("/workflows")`), 리뷰 시 트리거 관련 임포트를 정리하면서 이 임포트만 유지하는 근거가 명시되지 않아 독자가 혼동할 수 있다. 문제는 없으나 주석 한 줄("workflows 호출에만 사용") 로 의도를 명확히 하면 향후 M-8 2단계 또는 m-2 workflows 트랙 작업자가 실수로 삭제하지 않을 것이다.
- 제안: `apiClient` 임포트 바로 위에 `// /workflows 호출 전용 — m-2 workflows 트랙에서 제거 예정` 한 줄 주석 추가(선택 사항, 범위 위반은 아님).

### [INFO] `normalizePagedResponse` 임포트가 `triggers/page.tsx` 에서 제거됨
- 위치: diff 첫 번째 hunk, `-import { normalizePagedResponse } from "@/lib/api/paginated";`
- 상세: 이 임포트 제거는 `triggersApi.list()` 내부로 해당 로직이 이동됐으므로 완전히 정상적인 범위 내 변경이다.
- 제안: 없음.

### [INFO] `review/consistency/2026/06/23/07_55_57/` 하위 파일 다수 커밋 포함
- 위치: 파일 5~12 (`SUMMARY.md`, `_retry_state.json`, `convention_compliance.md`, `cross_spec.md`, `meta.json`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`)
- 상세: 구현 착수 전 `/consistency-check --impl-prep` 산출물이 같은 커밋에 포함되어 있다. CLAUDE.md 규약상 `developer` 는 구현 착수 직전 consistency-check 의무 실행 후 산출물을 커밋하므로, 이는 의도된 패턴이다. 범위 위반이 아님.
- 제안: 없음.

---

## 요약

이번 변경은 선언된 목적(M-8 1단계 — `lib/api/triggers.ts` API 레이어 추출, 직접 호출 8곳 제거)에 완전히 부합한다. 신설 파일 `lib/api/triggers.ts` 는 drawer 와 page 에서 사용하던 로컬 타입·`apiClient` 직접 호출을 집약하고, 컴포넌트 구조·렌더·권한 게이트는 무변으로 유지되어 over-engineering 없이 순수 API 레이어 추출만 이루어졌다. `/workflows` 호출이 `apiClient` 직접 방식으로 잔류하는 것도 커밋 메시지에서 의도적으로 명시하였고 m-2 workflows 트랙으로 위임되어 있어 범위 초과가 아니다. 불필요한 포맷팅 변경, 무관한 파일 수정, 의도하지 않은 설정 변경은 발견되지 않았다. plan 파일 갱신(`02-architecture.md`)과 consistency-check 산출물 커밋도 developer SKILL 규약에 따른 정상 절차다.

## 위험도

NONE
