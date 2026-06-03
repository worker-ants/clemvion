# Code Review 통합 보고서

## 전체 위험도
**HIGH** — EN i18n 사전 7개 키 누락으로 기존 `dict parity` 테스트 CI 즉시 실패 확실. spec Planned 기능에 대한 i18n 키 선행 추가(dead code) 및 테스트 엣지케이스 공백 존재.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트/빌드 | KO 사전 신규 7개 키(`periodCustom`, `customRangeStart`, `customRangeEnd`, `customRangeApply`, `changeVsPrev`, `addTrigger`, `resetFilters`)가 EN 대응 파일에 전혀 없어 기존 `dict parity (ko ↔ en)` 테스트 CI 즉시 실패 | `codebase/frontend/src/lib/i18n/dict/en/statistics.ts`, `en/triggers.ts`, `en/workflows.ts` | EN 3개 파일에 대응 번역 추가(`"Custom"`, `"Start date"`, `"End date"`, `"Apply"`, `"vs. previous period"`, `"Add trigger"`, `"Reset filters"`) |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | spec 에서 "미구현(Planned)"으로 명시한 커스텀 범위 UI 관련 4개 키(`periodCustom`, `customRangeStart`, `customRangeEnd`, `customRangeApply`) 선행 추가 — 소비 코드 없는 dead i18n | `ko/statistics.ts` lines 105~108 | 커스텀 범위 UI 구현 완료 시점에 키 추가하거나 동 PR 에 UI 구현 포함 |
| 2 | 요구사항 | spec 에서 "미구현(Planned)"으로 명시한 전 기간 대비 증감률 기능 키(`changeVsPrev`) 선행 추가 — 소비 코드 없음 | `ko/statistics.ts` line 109 | 증감률 카드 구현 시점에 키 추가하거나 동 PR 에 구현 포함 |
| 3 | 유지보수성 | `addWebhook`("웹훅 추가"), `addTrigger`("트리거 추가"), `addWebhookTrigger`("웹훅 트리거 추가") 세 키 공존 — 사용처 불명확으로 혼동 가능 | `ko/triggers.ts` lines 198~200 | 각 키의 사용처를 주석으로 명시하거나 미사용 키 제거 |
| 4 | 테스트 | `fallback` 필터에서 연쇄 필터(`fallback:X \| upper`) 테스트 누락 | `evaluator.spec.ts` — `fallback:` describe 블록 | `renderTemplate('{{ workflowName \| fallback:workflowId \| upper }}', { workflowId: 'wf-1' })` → `'WF-1'` 케이스 추가 |
| 5 | 테스트 | `fallback` 필터에서 dot-path 인수 해석(`fallback:nested.id`) 테스트 누락 | `evaluator.spec.ts` — `fallback:` describe 블록 | `renderTemplate('{{ name \| fallback:meta.id }}', { meta: { id: 'x' } })` 케이스 추가 |
| 6 | 테스트 | `fallback` 필터에서 인수 자체가 빈 문자열(`fallback:`)일 때 동작 미검증 | `evaluator.spec.ts` — `fallback:` describe 블록 | `renderTemplate('{{ name \| fallback: }}', {})` → `''` 케이스 추가(엣지케이스 문서화) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `addTrigger` 키 사용처 미확인 — 소비하는 `.tsx`/`.ts` 파일 미발견 | `ko/triggers.ts` line 200 | 사용 컴포넌트 확인 후, 없으면 제거 |
| 2 | 요구사항 | `resetFilters` 키 사용처 미확인 — 소비하는 파일 미발견 | `ko/workflows.ts` line 521 | 사용 컴포넌트 확인 후, 없으면 제거 |
| 3 | 요구사항 | `fallback:` 필터가 spec 어디에도 정의되지 않음 — spec 보완 필요 | `evaluator.ts` `case 'fallback'` | `project-planner` 에 spec 보완 위임 — `summaryTemplate` 지원 필터 목록 및 각 인수 해석 방식 섹션 추가 |
| 4 | 요구사항 | `en/statistics.ts`, `en/triggers.ts`, `en/workflows.ts` TypeScript 타입 에러 발생 가능 (CRITICAL #1 과 동일 원인) | EN dict 3개 파일 | CRITICAL #1 해결로 자동 해소 |
| 5 | 유지보수성 | `case 'default':` 와 `case 'fallback':` 의 빈값 판단 조건(`v === undefined \|\| v === null \|\| v === ''`) 중복 — DRY 위반 경미 | `evaluator.ts` `applyFilter` 내 두 case | `const isEmpty = (v: unknown): boolean => ...` 헬퍼 추출 권장 |
| 6 | 유지보수성 | `statistics.ts` 기존 파일에 `averageDuration`/`avgDuration` 동의어 중복 존재 (이번 변경과 무관) | `ko/statistics.ts` | 이번 PR 범위 외; 별도 정리 검토 |
| 7 | 테스트 | `fallback` 필터 빈 인수 방어 코드 부재 — 런타임 안전하나 테스트/문서 공백 | `evaluator.ts` line 1213 | WARNING #6 케이스 추가로 커버 가능 |
| 8 | 부작용 | `applyFilter` 시그니처 변경(`config` 파라미터 추가)은 모듈 내부 비공개 함수, 공개 API(`renderTemplate`) 변경 없음 | `evaluator.ts` | 현재 구조 유지. 문제 없음 |
| 9 | 부작용 | `fallback` 케이스 — `config` 를 읽기 전용으로만 참조, 상태 변경 없음 | `evaluator.ts` `case 'fallback'` | 현재 구조 유지. 문제 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | HIGH | EN i18n 사전 7개 키 누락으로 `dict parity` CI 테스트 즉시 실패 확실; fallback 필터 연쇄/dot-path/빈인수 테스트 공백 |
| requirement | MEDIUM | spec Planned 기능 i18n 선행 추가(5개 dead 키), EN dict 미동기화로 타입 에러 예상, fallback 필터 spec 미정의 |
| maintainability | LOW | `addWebhook`/`addTrigger`/`addWebhookTrigger` 유사 키 공존으로 사용처 혼동 가능성; `isEmpty` 헬퍼 추출 미흡(DRY 경미 위반) |
| scope | NONE | 모든 변경 범위 내 — 공개 API 유지, 부작용 없음 |
| side_effect | NONE | 의도하지 않은 부작용 없음, 공개 API 시그니처 유지 |
| security | — | 결과 파일 없음 (manifest success 기록이나 output_file 미존재 — 재시도 필요) |

## 발견 없는 에이전트

- **side_effect**: 5개 파일 전반에 의도하지 않은 부작용 없음 확인
- **scope**: 모든 변경이 PR 의도 범위 내, 무관 파일 수정 없음 확인

## 권장 조치사항

1. **(즉시/CI 차단)** EN i18n 사전 3개 파일에 대응 키 추가 — `en/statistics.ts` 5개, `en/triggers.ts` 1개, `en/workflows.ts` 1개. 이 조치 없이는 빌드/CI 통과 불가.
2. **(권장)** `periodCustom`, `customRangeStart`, `customRangeEnd`, `customRangeApply`, `changeVsPrev` 5개 KO 키를 현 PR 에서 제거하고, 커스텀 범위 UI 및 증감률 카드 구현 PR 에서 함께 추가. (또는 해당 UI 구현을 이번 PR 에 포함)
3. **(권장)** `addTrigger`, `resetFilters` 키의 실제 소비 컴포넌트 확인 후, 소비처가 없으면 제거.
4. **(권장)** `evaluator.spec.ts` 에 `fallback` 필터 연쇄 필터, dot-path 인수, 빈 인수 엣지케이스 테스트 3건 추가.
5. **(선택)** `project-planner` 에 spec 보완 위임 — `summaryTemplate` 지원 필터 목록(`upper`, `lower`, `default:`, `fallback:`) 및 인수 해석 방식 섹션 추가.
6. **(선택)** `applyFilter` 내 빈값 판단 조건 `isEmpty` 헬퍼로 추출(DRY 개선).

## 라우터 결정

라우터가 선별하여 실행:

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing` (6명, 전원 `router_safety` 강제 포함)
- **제외**: 8명

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| documentation | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |

**강제 포함(router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (전 실행 reviewer)

**비고**: `security` reviewer 는 manifest 에 `success` 로 기록됐으나 output_file(`security.md`)이 존재하지 않아 결과를 읽을 수 없음. 해당 reviewer 결과는 본 보고서에 반영되지 않았으며 재시도 필요.