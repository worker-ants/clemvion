## 변경 범위(Scope) 코드 리뷰

### 발견사항

- **[CRITICAL]** `if-else.component.ts` 파일 누락
  - 위치: `backend/src/nodes/logic/if-else/`
  - 상세: `if-else/index.ts`가 `./if-else.component`를 re-export하지만, 해당 컴포넌트 파일이 리뷰 대상에 포함되어 있지 않음. 다른 모든 노드(loop, map, merge, split, switch, variable-*)는 `.component.ts` 파일이 포함되어 있음
  - 제안: `if-else.component.ts` 파일 존재 여부 및 리뷰 포함 여부 확인

- **[WARNING]** `if-else` schema와 `defaultConfig` 간 논리적 불일치
  - 위치: `if-else.schema.ts` — `ifElseConfigSchema` (.min(1)) vs `defaultConfig.conditions: []`
  - 상세: `conditions: z.array(conditionSchema).min(1)` 은 최소 1개 조건을 요구하지만, `defaultConfig`는 `conditions: []`(빈 배열)로 정의되어 스키마 검증을 통과하지 못하는 기본값
  - 제안: `defaultConfig`를 유효한 기본 조건으로 채우거나, `.min(1)` 제약 제거

- **[WARNING]** `loop`, `map`, `merge`, `split`, `switch`, `variable-declaration`, `variable-modification` 스키마와 `defaultConfig` 불일치
  - 위치: 각 `*.schema.ts` 파일
  - 상세: 모든 configSchema가 `z.object({}).passthrough()`(빈 객체)로 정의되어 있지만, `defaultConfig`에는 실제 필드가 존재함 (예: loop의 `{ count: 1 }`, merge의 `{ strategy: 'wait_all', outputFormat: 'array', timeout: 300 }`)
  - 제안: 실제 사용하는 필드를 schema에 명시하거나, 의도적으로 schema 검증을 건너뛰는 것이라면 주석으로 명시

- **[WARNING]** `switch` 노드 outputs 빈 배열
  - 위치: `switch.schema.ts` — `switchNodePorts.outputs: []`
  - 상세: "Multi-path branching" 기능을 설명하지만 출력 포트가 없음. 다른 분기 노드(if-else)는 `true`/`false` 출력을 정의함
  - 제안: 동적 출력 포트를 의도한 경우 주석 또는 메타데이터로 명시; 그렇지 않으면 기본 출력 포트 정의 필요

- **[INFO]** `chart` 컴포넌트 명명 불일치
  - 위치: `chart.component.ts` — `export const chartComponent`
  - 상세: 다른 모든 노드는 `[type]NodeComponent` 패턴을 따르지만 (예: `carouselNodeComponent`, `formNodeComponent`), chart만 `chartComponent`로 명명됨
  - 제안: `chartNodeComponent`로 통일하여 명명 규칙 일관성 유지

- **[INFO]** `chart` 노드만 `inputSchema`/`outputSchema` 정의
  - 위치: `chart.component.ts`, `chart.schema.ts`
  - 상세: 다른 모든 노드는 `inputSchema`/`outputSchema` 없이 `configSchema`만 정의하지만, chart만 추가로 정의. 범위 내 변경이나 의도적인 것인지 불명확
  - 제안: 의도적 차이라면 이를 명시하거나, 다른 노드에도 동일하게 적용할 계획인지 확인

---

### 요약

전체적으로 변경 파일들은 모두 `backend/src/nodes/` 디렉토리의 노드 컴포넌트 추가라는 하나의 목적에 집중되어 있으며, 불필요한 리팩토링이나 무관한 파일 수정은 없음. 그러나 `if-else.component.ts` 파일이 리뷰에서 누락된 것이 Critical 사항이며, 여러 노드에서 Zod 스키마와 `defaultConfig` 간의 불일치가 발견됨 — 이는 런타임에서 스키마 검증 실패를 야기할 수 있는 실질적 결함임. 특히 `if-else`의 `.min(1)` vs 빈 배열 문제는 즉시 수정이 필요함.

### 위험도

**MEDIUM** — `if-else` 스키마/defaultConfig 불일치로 인한 런타임 검증 오류 가능성 및 `if-else.component.ts` 누락 여부 확인 필요