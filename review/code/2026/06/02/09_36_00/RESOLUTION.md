# RESOLUTION — 09_36_00

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | spec (false positive) | (없음) | `spec/conventions/i18n-userguide.md` 에 Principle 3-C 이미 정식 정의됨 (base 브랜치). grep "Principle 3-C" 3건 확인. project-planner 재위임 불필요. |
| #2 | spec (false positive) | (없음) | `spec/conventions/cross-node-warning-rules.md §3` 에 `params?` 필드·`evaluate` 반환 타입 이미 반영됨 (base 브랜치). grep "params?" 2건 확인. |
| #3 | 코드(테스트) | d8e35889 | `custom-node-graph-warning.test.tsx` 에 ko/en 로케일·params 유무 조합 배지 렌더 검증 4케이스 추가 |
| #4 | 코드(테스트) | d8e35889 | `editor-toolbar-rbac.test.tsx` 에 ko 로케일 + params error result → Save 버튼 title 한국어 보간 검증 케이스 추가 |
| #5 | 코드(테스트) | d8e35889 | `backend-labels.test.ts` 에 `translateGraphWarning` 5케이스 + `translateBackendError` 4케이스 직접 단위 테스트 추가 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (5416 passed)
- e2e   : 통과 (140/140)

## 보류·후속 항목

INFO 항목 (자동 수정 대상 아님, 비용 대비 낮은 우선순위):

- INFO #5: `editor-toolbar.tsx` JSX `title` 속성 IIFE → `useMemo` 리팩토링 (기존 컨벤션 일치)
- INFO #6: `translateBackendError` 호출 지점 없음 — TODO 주석 또는 후속 PR 연결
- INFO #7: `evaluator.ts` 조건부 spread 단순화
- INFO #11: `no-internal-refs.test.ts` 주석에 `GRAPH_WARNING_KO` 추가
- INFO #12: `interpolate` 함수 JSDoc 추가
- INFO #13: `translateBackendError` JSDoc params 보완
- INFO #15: `editor-store.ts` params? 필드 인라인 주석 → JSDoc 교체
- INFO #16: `plan/in-progress/backend-msg-i18n-impl.md` frontmatter worktree 업데이트
- INFO #17: `POST /workflows/:id/save` 400 응답 @ApiResponse 에 params 스키마 등록
- INFO #18: `workflow-response.dto.ts` @ApiPropertyOptional example 에 grand 키 추가
