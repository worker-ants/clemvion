# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] ParsedSegment 인터페이스가 parser.factory.ts에 정의되어 ChunkMetadata를 역방향 참조
- 위치: `codebase/backend/src/modules/knowledge-base/parsers/parser.factory.ts` (상단 import) + `md.parser.ts`, `pdf.parser.ts`
- 상세: `ParsedSegment` 인터페이스가 `parser.factory.ts`에 선언되어 있고, 그 타입이 `ChunkMetadata`(chunking 레이어)를 가리킨다. 동시에 `md.parser.ts`와 `pdf.parser.ts`가 `parser.factory.ts`에서 `ParsedSegment`를 import한다. 즉 parsers → factory → chunking 방향으로 의존이 흐르는데, parsers 자체는 factory가 orchestrate하는 하위 모듈이다. 개념적으로는 `ParsedSegment`와 `ChunkMetadata`를 공유 타입 파일(예: `types.ts` 또는 `chunking/chunk-types.ts`)로 분리하면 parsers가 factory에 역으로 의존하는 구조를 제거할 수 있다. 현재 구조는 순환 위험은 없지만 레이어 방향이 약간 역전된다.
- 제안: `ParsedSegment`와 `ChunkMetadata`를 별도 shared 타입 파일로 분리하거나, `ParsedSegment`를 `text-chunker.ts` 또는 독립 `types.ts`에 두어 parsers가 factory를 바라보지 않도록 한다.

### [INFO] parsePdf(flat)와 parsePdfSegments(per-page) 두 경로의 텍스트 추출 로직이 분리되어 중복 발생 가능
- 위치: `codebase/backend/src/modules/knowledge-base/parsers/pdf.parser.ts`
- 상세: `parsePdf`는 pdf-parse의 기본 렌더러(`result.text`)를 사용하고, `parsePdfSegments`는 `pagerender` 콜백으로 per-page 텍스트를 재구성한다. 두 경로는 동일 라이브러리를 다른 옵션으로 두 번 호출하는 구조이므로, 텍스트 품질(줄 처리 방식)이 내부적으로 미묘하게 다를 수 있다. `parseDocument`는 여전히 flat `parsePdf`를 csv 경로에서 사용하고, 비-csv 경로는 `parseDocumentSegments`를 사용하므로 호출 경로가 파일 타입에 따라 분기된다. 현재 embedding.service에서 csv는 `parseDocument`, 나머지는 `parseDocumentSegments`로 나뉘므로 두 경로가 공존하는 것은 의도적이나, `parsePdf`(flat)는 현재 실질적으로 `parseDocument('pdf')` 경로를 통해서만 도달 가능한데 그 경로는 embedding.service에서 더 이상 사용되지 않는다. 데드코드화 가능성이 있다.
- 제안: `parsePdf` flat 경로가 실제로 사용되는지 확인하고, 미사용이면 제거 또는 `parsePdfSegments`에서 내부 위임으로 통합하여 로직을 단일화한다.

### [INFO] EmbeddingService가 segment 루프와 chunk index 재부여 로직을 서비스 코드에 직접 포함 (레이어 책임 경계)
- 위치: `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts` (변경 블록 `for segment / for chunk` 루프)
- 상세: segment 순회 + chunk 병합 + index 연속 재부여 로직(`{ ...chunk, index: chunks.length }`)이 `EmbeddingService` 내부에 인라인으로 작성되어 있다. 이 조립 책임은 비즈니스 서비스보다 chunking 레이어에 가깝다. 향후 포맷이 추가되거나 segment 병합 전략이 바뀔 때 서비스 코드를 직접 수정해야 한다(OCP 위반 잠재성).
- 제안: `chunkSegments(segments, options): Chunk[]` 같은 헬퍼를 chunking 레이어에 두어 segment 배열을 받아 index-renumbered chunk 배열을 반환하게 하면, EmbeddingService는 `parseDocumentSegments → chunkSegments → store` 파이프라인만 orchestrate하면 된다.

### [INFO] NodeSettingsPanel의 errorHandling 상태 관리 및 마이그레이션 로직이 컴포넌트 내부에 집중
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx`
- 상세: `LEGACY_POLICY_MAP` 상수, 초기 상태 파생, `errorHandling` 객체 빌드, JSON 파싱 유효성 검사, 레거시 키 삭제(`delete restConfig.errorPolicy`) 등 도메인 로직이 UI 컴포넌트인 `SettingsTab` 함수 본문에 집중되어 있다. 단일 책임 원칙 측면에서 "에러 핸들링 config 변환" 책임이 프레젠테이션 컴포넌트에 섞여 있다. useState 수가 늘고(policy, maxRetries, retryInterval, defaultOutputText, defaultOutputError) useCallback 의존성 배열도 그만큼 늘어났다.
- 제안: `useErrorHandlingConfig(initialConfig)` 커스텀 훅으로 상태 + 파생 + 빌드 + 마이그레이션 로직을 분리하면 컴포넌트는 렌더링만 담당하고 로직의 단위 테스트가 용이해진다.

### [INFO] `$itemIsFirst`/`$itemIsLast` top-level 변수가 `ExpressionContext` 인터페이스, `expression-resolver.service.ts`, `expression-constants.ts` 세 곳에 병렬로 추가됨
- 위치: `codebase/packages/expression-engine/src/evaluator.ts`, `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts`, `codebase/frontend/src/components/editor/expression/expression-constants.ts`
- 상세: 새 context 변수를 추가할 때 엔진 타입, 서비스 구현, 프론트엔드 자동완성 정의 세 곳을 동시에 손봐야 하는 구조다. 현재 변경은 세 곳 모두 일관성 있게 수정되었으나, 이 패턴은 확장 시 누락 위험이 있다. 근본적으로는 expression context 변수 레지스트리(타입 정의 + 문서 + 자동완성 소스)가 단일 진실 원천으로 수렴되지 않아 발생하는 구조적 결합이다.
- 제안: 현재 변경 자체는 일관성 있게 처리되었으므로 즉각적인 수정 필요성은 낮다. 장기적으로 context 변수 레지스트리를 shared 패키지의 단일 정의로 수렴시키면 프론트엔드 자동완성이 런타임 타입에서 자동 파생되어 누락을 방지할 수 있다.

### [INFO] `ChunkMetadata` 인터페이스가 `page?: number, section?: string`으로 고정되어 있어 확장성 제한
- 위치: `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts`
- 상세: 현재 메타데이터 필드가 두 개로 고정되어 있다. 향후 docx의 paragraph-id, html의 element-id 등 포맷별 추가 필드가 필요할 때 인터페이스를 수정해야 한다. `[key: string]: unknown` 인덱스 시그니처 추가 또는 제네릭 파라미터화로 개방성을 확보할 수 있다.
- 제안: `ChunkMetadata` 를 `Record<string, unknown>` 으로 완전 열거나, `{ page?: number; section?: string; [key: string]: unknown }` 확장 인덱스 시그니처를 추가하여 새 포맷 추가 시 타입 변경 없이 대응 가능하게 한다.

## 요약

이번 변경은 크게 세 가지 독립적인 기능 축으로 구성된다: (1) ForEach `$itemIsFirst`/`$itemIsLast` 표현식 변수 노출, (2) embedding 파이프라인의 segment-level metadata 전파(md/pdf 파서 분리 + baseMetadata 전파), (3) 노드 설정 패널의 errorHandling nested 계약 정합 + UI 확장. 전반적으로 레이어 책임 구분이 유지되고 있으며, 특히 embedding 파이프라인은 파서·청킹·서비스 레이어를 분리하는 방향으로 개선되었다. 다만 `ParsedSegment` 타입이 `parser.factory.ts`에 위치해 하위 파서 모듈이 팩토리를 역참조하는 구조, segment 조립 로직이 서비스 레이어에 인라인으로 포함된 점, NodeSettingsPanel 컴포넌트의 도메인 로직 집중은 향후 포맷 확장이나 정책 추가 시 유지보수 부담을 높일 수 있다. 순환 의존성이나 레이어 간 명백한 위반은 없으며, summaryTemplate 패턴의 노드별 일관 적용과 spec↔구현 정합 처리(plan/complete 이동)는 구조적으로 건전하다.

## 위험도

LOW
