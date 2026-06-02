# RESOLUTION — §1 AI Agent allowlist UI

SUMMARY: `review/code/2026/06/02/10_26_58/SUMMARY.md` (위험도 MEDIUM, Critical 0 / Warning 8 / Info 21). 수동 처리.

## 조치 항목

| SUMMARY # | 분류 | 조치 |
|---|---|---|
| WARNING 1·7·INFO 21 | 타입 안전성/보안 | `Props.onChange` 를 `(enabledTools: string[] \| undefined) => void` 로 변경, `undefined as unknown as string[]` 캐스팅 제거. McpServerRef.enabledTools optional 이라 부모 patch 가 그대로 흐른다. |
| WARNING 2 | 요구사항 (`['*']`) | `allAllowed = enabledTools == null \|\| includes('*')` 도입 — isEnabled/effectiveTools 가 wildcard 를 전부 허용으로 해석. 토글 시 명시 배열로 materialize (spec/5-system/11-mcp-client §5.6). |
| WARNING 3 | 테스트 | sameAsAll → `onChange(undefined)` default 복원 케이스 추가. |
| WARNING 4 | 테스트 | `level='program'` 행 ⚠ 배지 케이스 추가 (consistency INFO #5 결정 동작). |
| WARNING 5 | 테스트 | `mcp-server-selector.test.tsx` 신설 — cafe24 allowlist 토글 노출/일반 mcp 미노출/펼침 시 편집기/개수 뱃지 4 케이스. |
| WARNING 6 | 테스트 | `cafe24-extras.test.ts` 신설 — readCafe24Extras null 분기 4 + resolveCafe24OperationLabel ko/en/miss 2. |
| INFO 16 | 테스트 | 빈 배열 `[]` = 명시적 전부 차단 케이스 추가. |
| INFO 3 | 부작용 | `mcp-server-selector.remove()` 에서 `expanded` Set stale 항목 정리. |
| INFO 9 | 유지보수 | integration-configs 추출 잔여 주석 제거 (import 로 의도 전달). |
| INFO 10 | 유지보수 | `base()` → `effectiveTools()` rename (의미 명확화). |
| INFO 12·19·20 | 문서화 | cafe24-extras JSDoc 보강 — Zustand 스냅숏 직접 접근 주의, dot-key 충돌 이유 + SoT(§7.5), older-backend null/fallback. |

재테스트: editor 10 + cafe24-extras 6 + mcp-server-selector 4 + cafe24-config·catalog-sync 회귀 = 46 pass.

## 보류·후속 항목 (근거)

| SUMMARY # | 판단 | 근거 |
|---|---|---|
| WARNING 8 / INFO 6 | 후속 분리 | `mcp-server-selector` 의 하드코딩 영문 에러/라벨("Failed to load MCP servers", "Expose Resources/Prompts" 등) 은 **§1 이전부터 있던** 텍스트 (본 PR 미추가). 셀렉터 전체 i18n 화는 별 작업 — 본 PR scope(cafe24 allowlist) 밖. |
| INFO 1 | 보류 | `serviceType==='cafe24'` 분기 OCP — 두 번째 advanced-surface provider 등장 시 render-prop 추상화가 합리적. 현재 단일 provider 라 inline 분기가 단순·명확. |
| INFO 2 | 보류 | materialize 로직 순수 함수 추출 — 추가된 컴포넌트 테스트(10케이스)가 동작을 충분히 커버. 추출은 가치 대비 변경폭 큼. |
| INFO 4 | 보류 | extras `op.id`/`labelKey` 무검증 — React 자동 이스케이프로 XSS 직접 위험 없음. 백엔드(신뢰 경로) 메타데이터라 입력 검증 불요. |
| INFO 5 | 후속(프로젝트 전역) | `review/**/_retry_state.json` 절대경로 — 모든 consistency 세션 공통. `.gitignore` 정책은 §1 무관 전역 결정 → 별도 검토. |
| INFO 7 | 보류 | `categoryRestricted` some() — 현재 메타데이터에서 scope-level 카테고리는 전체가 scope. 혼합 카테고리 도입 시 재검토. |
| INFO 8 | project-planner | resource 정렬 순서 spec 미정의 — 알파벳 정렬은 합리적 기본. 필요 시 §8.3 명시(기획 위임). |
| INFO 11 | 보류 | `patch` 함수/파라미터 동명 — §1 이전부터 있던 구조. |
| INFO 13·14·15·17·18 | 일부 조치/보류 | 테스트 cosmetic — 신규 케이스는 aria-label 직접 조회 사용. en locale·indeterminate DOM 검증은 가치 낮아 보류. |

## TEST 결과

- lint: 통과 (eslint --fix 가 매번 무관 기존 파일 자동 수정 → revert)
- unit: 통과 (frontend §1 신규 20케이스 + 회귀)
- build: 통과 (tsc 타입 — onChange 시그니처 정정 포함)
- e2e: 통과 (140)

## 비고

- spec(4-cafe24.md §8.3) 미편집 (이미 명세) → PR #415 와 충돌 회피, consistency Critical 해소.
