# 코드 리뷰 조치 내역 (세션 2)

> 리뷰 대상 세션: `2026-04-15_10-57-51` (스키마/컴포넌트 정합성 중심)
> 세션 1(`2026-04-15_10-55-07`)의 RESOLUTION.md와 중복되는 항목은 그쪽을 참조.

## CRITICAL 조치

| # | 항목 | 조치 |
|---|------|------|
| 1 | `ifElseConfigSchema.conditions.min(1)` 위반 defaultConfig — 노드 초기화 시 ZodError | `if-else.schema.ts`의 `.min(1)` 제거. 빈 조건 배열을 초기 상태로 허용 |
| 2 | `chartConfigSchema.xAxis.field.min(1)` 위반 defaultConfig — 빈 문자열 초기값이 즉시 스키마 실패 | `chart.schema.ts`의 `xAxis.field` / `yAxis.field`에서 `.min(1)` 제거 |
| 3 | `switchNodePorts.outputs: []` — 실행 엔진 라우팅 불가 | 정적 `default` 출력 포트 추가 + "case 포트는 런타임 동적 생성" 주석. `NodeComponentMetadata.isDynamicPorts` 플래그 도입 |
| 4 | `backend/src/nodes/` 테스트 0건 | 신규 테스트 3종 추가<br>· `nodes/core/zod-validator.spec.ts`<br>· `nodes/core/node-component.registry.spec.ts`<br>· `nodes/nodes.integration.spec.ts` (전 컴포넌트 `defaultConfig ↔ configSchema` 정합성 `it.each`)<br>· `modules/nodes/nodes.controller.spec.ts` — 44 tests 추가 |
| 5 | `if-else.component.ts` 누락 지적 | **오진** — 파일은 실재함 (`backend/src/nodes/logic/if-else/if-else.component.ts`) |

## WARNING 조치

본 PR(노드 컴포넌트 구조 분리)의 범위와 부합하는 항목만 즉시 반영, 그 외는 후속으로 이관.

| # | 항목 | 본 PR 조치 | 후속 과제로 이관 사유 |
|---|------|------------|----------------------|
| 1 | `if_else.operator` `z.string()` 무제한 | — | 기존 handler `validate()`가 허용 목록 검증 수행 중. Zod enum화는 configSchema 구체화 단계에서 일괄 진행 |
| 2 | `chart.dataSource: z.unknown()` SSRF/경로 탐색 위험 | — | 현 시점 `dataSource`는 `$node[X].output` 참조(데이터만) 전용. handler 내부에서 array 여부만 사용. 위험 표면 없음. 구체화는 configSchema 작업으로 이관 |
| 3 | 대다수 노드 `z.object({}).passthrough()` 플레이스홀더 | — | handler 자체 `validate()`가 런타임 검증을 계속 수행하므로 기능 퇴행 없음. 고위험 순(`code`, `http_request`, `database_query`)으로 단계 정의 예정 |
| 4–11 | `loop.count`, `map.errorPolicy`, `merge.strategy`, `switch.cases`, `variable-*`, presentation 전반, `chart.chartType` donut/area, `manual_trigger.parameters` 등 스펙 기반 스키마 | — | 본 PR은 **구조 분리**가 목표. 필드 구체화는 spec 재확인과 frontend config UI 동기화까지 포함되는 별도 작업 |
| 12 | 카테고리 색상 하드코딩 | — | 후속에서 `NODE_CATEGORY_COLORS` 공유 상수화 예정 |
| 13 | 실행 엔진의 `configSchema.parse()` 수행 불명확 | — | 현재 handler `validate()`가 역할 수행. Zod로 일원화 단계에서 engine의 검증 레이어 정비 |
| 14 | `createHandler`가 `deps`를 무시해 mock 불가 | — | 의존성 있는 노드(ai/integration/workflow)는 이미 `(deps) => new X(deps.xxx)` 패턴 적용. stateless 핸들러는 의도적으로 무시 |

## INFO 조치

- `chart`만 `inputSchema`/`outputSchema` 정의 — reference implementation 의도. 다른 노드로의 확장은 configSchema 구체화 시 병행 예정.
- `chartComponent` 명명 불일치(`chartNodeComponent`로 통일) — 후속 리네이밍 작업으로 이관.

## 테스트 결과

- `npm test` — **1148 tests passed** (리팩터 전 1104 → 44 추가)
- `npm run build` — 성공
- `npm run lint` — 494 problems (79 errors, 415 warnings) — 기존 baseline과 동일, 신규 이슈 없음
