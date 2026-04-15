# 코드 리뷰 조치 내역

> 리뷰 대상 세션: `2026-04-15_10-55-07`, `2026-04-15_10-57-51`

## CRITICAL 조치

| # | 항목 | 조치 |
|---|------|------|
| B1-1 | `NodeComponentRegistry` 테스트 전무 | `backend/src/nodes/core/node-component.registry.spec.ts` 신설 — `bootstrap()`(정상 + 중복 throw), `getComponent()`, `listMetadata()`, `listDefinitions()`(input/output schema 유무 포함) 커버 |
| B1-2 | `GET /nodes/definitions` 테스트 없음 | `backend/src/modules/nodes/nodes.controller.spec.ts` 신설 — `NodeComponentRegistry` mock 후 `listDefinitions` 위임 검증 |
| B2-1 | `ifElseConfigSchema.conditions.min(1)` 위반 defaultConfig | `if-else.schema.ts`의 `.min(1)` 제거. 조건 0개를 허용하는 것이 초기 상태의 정확한 표현 |
| B2-2 | `chartConfigSchema.xAxis.field.min(1)` 위반 defaultConfig | `chart.schema.ts`의 `xAxis.field`/`yAxis.field`에서 `.min(1)` 제거. 빈 초기값을 허용 |
| B2-3 | `switchNodePorts.outputs: []` | `default` 정적 포트 추가 + "case 포트는 런타임에 동적 생성" 주석 명시. `NodeComponentMetadata.isDynamicPorts` 플래그 도입 |
| B2-4 | `backend/src/nodes/` 테스트 0건 | `nodes.integration.spec.ts` 신설 — 전 컴포넌트에 대해 type 유일성, 메타데이터 완전성, 포트 구조, `defaultConfig ↔ configSchema` 정합성 검증 (it.each) |
| B2-5 | `if-else.component.ts` 누락 (리뷰어 가설) | **오진** — 파일은 실재함 (`backend/src/nodes/logic/if-else/if-else.component.ts`) |

## WARNING 조치

| # | 항목 | 조치 |
|---|------|------|
| B1-1 | `validateWithZod` 테스트 없음 | `zod-validator.spec.ts` 신설 — 성공/단일 실패/중첩 path/다중 issue/루트 실패 5케이스 |
| B1-2 | `execution-engine.service.spec.ts` bootstrap 검증 공백 | 리팩터링 회귀는 `nodes.integration.spec.ts` + `node-component.registry.spec.ts` 조합으로 커버됨. engine.spec에는 `NodeComponentRegistry` provider 주입만 보강 |
| B1-12 | `summaryTemplate` 필드 누락 | `NodeComponentMetadata`에 `summaryTemplate?: string` 추가 (spec §1.4 대응) |
| B1-14 | `NodeCategory` 리터럴 유니온 중복 | `category: NodeCategory \| \`${NodeCategory}\`` 로 변경 — enum을 단일 소스로 두고 리터럴 할당도 허용 |

## 추가 개선 사항 (본 PR 범위 밖으로 기록)

다음 항목은 현재 PR의 범위(노드 컴포넌트 구조 분리)를 넘어서며, 스펙 정합성/보안 강화를 위한 후속 작업으로 이관합니다.

1. **configSchema 구체화** — 현 시점의 대다수 노드는 `z.object({}).passthrough()` 플레이스홀더 상태. 각 핸들러의 기존 수동 `validate()`가 런타임 검증을 계속 수행하므로 기능적 퇴행은 없음. 스펙 기반 Zod 스키마 정의는 단계별로 진행 예정 (고위험 순: `code`, `http_request`, `database_query`, `if_else`의 operator enum, `loop.count`, `merge.strategy`).
2. **`validateWithZod` 핸들러 연결** — 현재 각 핸들러는 자체 `validate()`를 구현함. Zod 스키마가 완전해지는 시점에 `createHandler` 팩토리에서 `validateWithZod(configSchema)`를 주입하도록 일괄 전환 예정.
3. **순환 의존성 제거** — `NodesModule ↔ ExecutionEngineModule`의 `forwardRef`. `NodeComponentRegistry`를 별도 `NodeRegistryModule`로 분리하는 리팩터는 후속 작업.
4. **HandlerDependencies DIP** — 현재 `LlmService`/`RagSearchService`/`IntegrationsService`/`WorkflowExecutor` 구체 타입 직접 참조. 추상 인터페이스 분리는 후속 작업.
5. **`listDefinitions` 캐싱 · bootstrap 상태 가드** — 부팅 후 스키마는 불변이므로 캐싱으로 최적화 가능. 현 트래픽에서 문제없어 후속.
6. **미구현 노드 스펙 정합성** — `google_sheets`, `github`, `google_drive`, `parallel`, `background`에 대한 `🚧 미구현` 마킹은 spec 문서 보강 작업.
7. **`chart.chartType` enum 확장** — `donut`, `area` 추가.
8. **`text_classifier` 출력 포트** — 카테고리 기반 동적 포트. `isDynamicPorts: true`로 마킹 예정.
9. **`chartComponent` 명명 통일** — `chartNodeComponent`으로 리네이밍 (타 컴포넌트와 일관).
10. **인증 가드** — 전역 JWT 가드 적용 여부 확인 필요. 현재 컨트롤러는 기존 노드 CRUD 라우트와 동일 컨트롤러·동일 데코레이터 사용하므로 기존 정책을 그대로 따름.

## 테스트 결과

- `npm test` — **1148 tests passed** (44 tests 신규 추가)
- `npm run build` — 성공
- `npm run lint` — 494 problems (79 errors, 415 warnings) — 리팩터 전과 동일, 본 PR로 인한 신규 lint 이슈 없음
