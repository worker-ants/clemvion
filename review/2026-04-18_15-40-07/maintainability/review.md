### 발견사항

**[INFO]** `enrichInfoExtractorOutputSchema` 함수의 위치가 부적절
- 위치: `use-expression-context.ts:54-103`
- 상세: `information_extractor` 전용 로직이 범용 hook 파일에 직접 내장되어 있어, 새 노드 타입이 추가될 때마다 이 hook이 수정되어야 함. `INFO_EXTRACTOR_TYPE_MAP`도 동일 문제.
- 제안: `information-extractor` 노드 디렉토리 또는 별도 `node-output-schema-enrichers.ts` 유틸로 분리하고, 타입별 enricher를 등록(registry) 패턴으로 처리

**[WARNING]** `dropStaleEdges`의 와일드카드 fallback 로직이 혼란스러움
- 위치: `edge-utils.ts:120-138` (`validOutputs`/`validInputs`)
- 상세: `size > 0` 조건으로 빈 Set를 "와일드카드"로 암묵적으로 사용. 의도는 명확하지만, Set가 비어있는 이유가 "unknown type이라 permissive"인지 "포트가 실제로 없는 노드"인지 구분 불가. 후자 케이스에서 유효한 엣지가 보존될 수 있음.
- 제안: `undefined | Set<string>` 리턴으로 명시적 구분 (`undefined` = 검증 생략, 빈 Set = 포트 없음)

**[INFO]** `getExpressionToken`의 string 추적 로직이 중복됨
- 위치: `use-expression-suggestions.ts:58-93`
- 상세: forward scan (quote count)과 backward walk (inString state)가 유사한 string-boundary 로직을 각각 구현. 한 쪽을 제거하고 단방향으로 통합 가능.
- 제안: forward scan 결과(`cursorInsideString`)만 사용하여 backward walk의 초기 상태를 설정하는 현재 방식은 합리적이나, 주석으로 두 패스의 역할을 명시할 것

**[INFO]** `aiAgentNodeOutputSchema`의 `z.unknown()` 타입 사용
- 위치: `ai-agent.schema.ts:290`
- 상세: `response: z.unknown()` 는 autocomplete 목적의 schema에서 타입 정보를 제공하지 못함. 실제 핸들러가 생성하는 shape (`string | object`)가 있으므로 `z.union([z.string(), z.record(z.unknown())])` 등으로 구체화 가능.
- 제안: 런타임 타입을 반영하거나 현재 의도(doc only)를 주석으로 명시

**[INFO]** `informationExtractorNodeOutputSchema`의 이중 구조 설명 부족
- 위치: `information-extractor.schema.ts` 주석 블록
- 상세: 주석에서 "legacy port selector" 언급이 있으나, 이 `outputSchema`가 실제로 `$node["X"].output`에 매핑되는 방식과 `data.output.extracted.<name>` 경로 간의 관계가 코드상으로 추적하기 어려움. 주석은 잘 작성되었으나 실제 resolver 코드 참조 링크가 없음.
- 제안: `expression-resolver.service.ts`의 관련 섹션 파일명/함수명을 주석에 명시

**[INFO]** `use-expression-context.ts` useMemo 의존성 배열 확인
- 위치: `use-expression-context.ts:271`
- 상세: `nodeDefinitions`가 추가되었으나, `nodeDefinitions` 객체는 매 렌더마다 새 참조가 아닌 store 내부 stable reference임을 확인 필요. store selector가 shallow equality를 사용하지 않으면 불필요한 recompute 발생 가능.
- 제안: `useNodeDefinitionsStore`의 selector 패턴이 다른 store (`useEditorStore`)와 동일함을 확인 — 현재는 문제 없어 보임

---

### 요약

전반적으로 코드 품질이 높고, schema 기반 autocomplete 힌트 추가라는 복잡한 기능이 기존 패턴(zod schema, store selector, 함수형 util)을 잘 따르며 구현되었다. 주요 유지보수성 우려는 **`information_extractor` 전용 enricher 로직이 범용 hook에 하드코딩**된 점으로, 노드 타입이 늘어날수록 `use-expression-context.ts`가 비대해질 수 있다. `dropStaleEdges`의 wildcard Set 패턴은 기능적으로 동작하지만 의도 파악에 인지 비용이 있어, 타입으로 명시하면 이후 수정자의 실수를 줄일 수 있다. 나머지 사항은 낮은 위험도의 개선 제안 수준이다.

### 위험도
**LOW**