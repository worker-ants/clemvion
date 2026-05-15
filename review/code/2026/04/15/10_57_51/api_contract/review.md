## 발견사항

- **[WARNING]** `ifElseConfigSchema`와 `defaultConfig` 간 계약 불일치
  - 위치: `if-else.schema.ts` — `ifElseConfigSchema`의 `conditions: z.array(...).min(1)`, `defaultConfig: { conditions: [] }`
  - 상세: 스키마는 `conditions` 배열에 최소 1개 항목을 요구하지만, `defaultConfig`는 빈 배열 `[]`을 설정합니다. 클라이언트가 `defaultConfig`를 그대로 사용해 노드를 생성할 경우, 런타임 검증 단계에서 실패합니다.
  - 제안: `defaultConfig`를 `{ conditions: [{ field: '', operator: '', value: undefined }], combineMode: 'and' }` 형태로 수정하거나, 스키마에서 `min(1)` 제약을 제거해 빈 초기 상태를 허용하도록 조정

- **[WARNING]** 대부분의 노드 Config 스키마가 `z.object({}).passthrough()`로만 정의됨
  - 위치: `loop`, `map`, `merge`, `split`, `switch`, `variable-declaration`, `variable-modification`, `carousel`, `form`, `pdf`, `table`, `template` 스키마
  - 상세: 스키마가 실질적인 필드 검증을 수행하지 않아 클라이언트-서버 간 암묵적 계약이 형성됩니다. `merge`의 `defaultConfig`에는 `strategy`, `outputFormat`, `timeout` 필드가 있고, `loop`의 `defaultConfig`에는 `count` 필드가 있지만 스키마에서 이를 전혀 검증하지 않습니다. `GET /nodes/types` 같은 메타데이터 API로 노출될 경우, 클라이언트가 존재하지 않는 필드에 의존할 수 있습니다.
  - 제안: `defaultConfig`에 포함된 필드들은 최소한 스키마에 선언. 예: `merge`의 경우 `strategy: z.enum(['wait_all', ...]).optional()`

- **[WARNING]** `switch` 노드의 `outputs: []` — 동적 포트 계약 미문서화
  - 위치: `switch.schema.ts` — `switchNodePorts.outputs = []`
  - 상세: `switch` 노드는 케이스에 따라 동적으로 출력 포트가 생성되는 것으로 보이지만, 포트가 정적으로 빈 배열로 선언되어 있습니다. 프론트엔드가 `outputs`를 기반으로 연결 가능 포트를 렌더링한다면, 이 계약이 깨집니다.
  - 제안: 동적 포트 지원 여부를 `NodeComponentMetadata`에 `isDynamicPorts: true` 등의 플래그로 명시

- **[INFO]** `chart` 노드만 `inputSchema` / `outputSchema`를 정의, 나머지 노드와 일관성 부재
  - 위치: `chart.component.ts`, `chart.schema.ts`
  - 상세: `chart`만 별도의 입출력 데이터 스키마를 보유해, 노드 간 계약 표현 방식이 불일치합니다.
  - 제안: 다른 노드도 점진적으로 `inputSchema`/`outputSchema`를 추가하거나, `chart`의 방식을 공식 패턴으로 문서화

---

### 요약

이 파일들은 HTTP REST 엔드포인트가 아닌, 워크플로우 엔진의 노드 컴포넌트 계약(포트, Config 스키마, 메타데이터)을 정의합니다. HTTP API 계약 항목(버전 관리, 상태 코드, 인증 등)은 직접 해당하지 않으나, 이 스키마들이 `GET /nodes/types` 같은 메타데이터 API를 통해 클라이언트에 노출되고 Config 검증에도 사용된다는 점에서 간접적 API 계약 역할을 합니다. 가장 주요한 문제는 `ifElseConfigSchema`의 `min(1)` 제약과 `defaultConfig: { conditions: [] }` 간의 불일치로, 이는 런타임 오류를 유발할 수 있습니다. 나머지 노드들의 빈 passthrough 스키마는 당장의 파괴적 변경은 아니지만, 계약 명확성이 낮아 향후 유지보수 위험을 높입니다.

### 위험도
**MEDIUM**