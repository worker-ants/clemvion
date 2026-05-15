## 성능 코드 리뷰

### 발견사항

- **[INFO]** `createHandler: () => new LoopHandler()` — 핸들러 팩토리 패턴
  - 위치: 모든 `*.component.ts` 파일의 `createHandler` 필드
  - 상세: 각 노드 컴포넌트가 `createHandler: () => new XxxHandler()` 형태의 팩토리를 보유. 핸들러가 stateless라면 매 실행마다 불필요한 객체 생성 발생.
  - 제안: 핸들러가 상태를 갖지 않는다면 싱글톤 인스턴스를 재사용하거나, 팩토리가 내부적으로 캐싱하도록 변경 고려. 단, 핸들러가 실행 컨텍스트 상태를 가져야 한다면 현재 방식이 올바름.

- **[INFO]** `z.object({}).passthrough()` — 빈 스키마에 passthrough 적용
  - 위치: `loop.schema.ts`, `map.schema.ts`, `merge.schema.ts`, `split.schema.ts`, `switch.schema.ts`, `variable-declaration.schema.ts`, `variable-modification.schema.ts`, `carousel.schema.ts`, `form.schema.ts`, `pdf.schema.ts`, `table.schema.ts`, `template.schema.ts`, `manual-trigger.schema.ts`
  - 상세: 빈 스키마에 `.passthrough()`를 적용하면 Zod가 모든 키를 통과시키는 로직을 실행하지만, 실질적인 검증이 없어 검증 비용 대비 효과가 없음. 추후 실제 필드가 추가될 때 스키마가 구체화되지 않으면 런타임 타입 안전성이 없음.
  - 제안: 현재는 허용 가능한 수준. 노드 구현이 완성되면 실제 config 필드를 스키마에 명시하여 passthrough 의존도를 줄일 것.

- **[INFO]** `conditionSchema`의 `.passthrough()` 사용
  - 위치: `if-else.schema.ts` L8-L12
  - 상세: 조건 스키마가 `field`, `operator`, `value` 외 임의 필드를 허용. 조건이 다수일 때 불필요한 필드가 메모리에 유지됨.
  - 제안: 조건 필드가 확정되면 `.strict()` 또는 필요 필드만 명시하여 불필요한 데이터 통과 방지.

- **[INFO]** `chartConfigSchema` 내 중첩 객체 생성
  - 위치: `chart.schema.ts` L14-L33
  - 상세: `chartConfigSchema`는 `xAxis`, `yAxis`, `buttons` 등 중첩 스키마를 포함. 이 스키마는 모듈 로드 시 한 번 생성되므로 런타임 성능 영향 없음. 다만 `dataSource: z.unknown()`으로 임의의 대형 데이터가 config로 유입될 경우 검증 없이 통과.
  - 제안: `dataSource`의 최대 크기 또는 형태를 스키마 레벨에서 제한하는 것을 고려.

### 요약

리뷰 대상 파일들은 대부분 모듈 초기화 시점에 한 번만 평가되는 정적 스키마/메타데이터 정의 파일이다. 런타임 핫패스에서 반복 호출되는 코드가 아니기 때문에 성능 관점에서 심각한 문제는 없다. 다만 `createHandler: () => new XxxHandler()` 팩토리 패턴은 핸들러가 stateless임에도 매 실행마다 인스턴스를 생성할 경우 불필요한 GC 압력을 유발할 수 있고, 다수의 스키마에 적용된 `.passthrough()`는 노드 구현이 완성되지 않은 임시 조치로 보이므로 실제 구현 시 구체적인 스키마로 교체해야 한다.

### 위험도

**LOW**