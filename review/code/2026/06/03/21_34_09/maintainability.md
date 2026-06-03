# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1-2: expression-resolver.service — $itemIsFirst / $itemIsLast

- **[INFO]** 두 라인 추가로 최소한의 변경이며 의도가 명확하다. 기존 `$itemIndex` 패턴을 그대로 따르고 있어 일관성 양호.
  - 위치: `expression-resolver.service.ts` +84–85
  - 상세: `$item`, `$itemIndex`, `$itemIsFirst`, `$itemIsLast` 네이밍이 함께 묶여 읽히므로 그룹 가독성 문제 없음.
  - 제안: 없음.

- **[INFO]** 테스트(`expression-resolver.service.spec.ts`)에서 `execContext` 객체 전체를 인라인으로 재선언한다. 이 패턴은 같은 spec 파일 내 다른 테스트에도 반복된다.
  - 위치: spec.ts +41–56
  - 상세: 이전 테스트들과 `ExecutionContext` 픽스처 생성 코드가 중복된다. 헬퍼 팩토리가 이미 다른 describe 블록에서 사용된다면 추출 가능.
  - 제안: `createExecContext(overrides?)` 헬퍼로 추출해 중복 줄이기. 단, 현재 범위가 단일 케이스라면 INFO 수준으로 충분.

---

### 파일 3-4: text-chunker — baseMetadata 전파

- **[INFO]** `pushChunk`와 `forceSplitAndPush` 두 함수에 `baseMetadata` 파라미터가 추가됐고, 호출 지점 5곳 모두 일관되게 전달된다. 패턴이 균일하여 유지보수성 양호.
  - 위치: `text-chunker.ts` 전체 diff

- **[WARNING]** `forceSplitAndPush` 함수 내부에서 청크 객체 리터럴 `{ content, index, tokenCount, metadata }` 이 두 곳(루프 본문과 trailing 잔여 처리)에 중복된다. `metadata: { ...baseMetadata }` spread도 포함해 완전히 동일한 구조다.
  - 위치: `text-chunker.ts` 530–535 / 543–548 (전체 파일 컨텍스트 기준)
  - 상세: `pushChunk` 헬퍼가 이미 공통 청크 생성을 담당하는데, `forceSplitAndPush`는 그 헬퍼를 사용하지 않고 직접 `chunks.push({...})` 두 번을 반복한다. `pushChunk`의 `overlap` 파라미터를 optional로 만들거나 별도 `buildChunk()` 유틸로 객체 생성을 추출하면 중복이 제거된다.
  - 제안: `forceSplitAndPush` 내 `chunks.push` 두 곳을 `pushChunk(chunks, content, '', baseMetadata)` 형태로 통일하거나, 청크 객체 생성 로직을 별도 함수로 분리.

- **[INFO]** `Chunk` 인터페이스에서 `metadata?: ChunkMetadata` 가 optional이지만 실제로는 항상 `{ ...baseMetadata }` (빈 객체 포함)를 채운다. 인터페이스와 실제 동작 간 optional 불일치가 미래 소비자에게 혼란을 줄 수 있다.
  - 위치: `text-chunker.ts` 인터페이스 정의
  - 제안: `metadata: ChunkMetadata` (non-optional)로 변경 고려.

---

### 파일 5-6: embedding.service — parseDocumentSegments 분기

- **[WARNING]** `processDocumentEmbedding` 메서드(또는 해당 메서드) 내부의 parse+chunk 로직이 `if (doc.fileType === 'csv') { ... } else { segments loop }` 형태로 확장됐다. CSV 분기와 segments 분기 모두 최종적으로 `chunks` 배열을 채우지만, CSV 분기는 empty-check(이전 코드의 `if (!text.trim())` 블록)가 제거되어 있고 공통 `if (chunks.length === 0)` 블록으로 합쳐졌다.
  - 위치: `embedding.service.ts` diff +643–658
  - 상세: empty-text early return 로직 제거 후 `chunks.length === 0` 분기로 수렴하는 방향은 코드 단순화로 긍정적. 그러나 두 분기의 책임(CSV vs segments)이 하나의 메서드 안에 인라인으로 공존해 함수 길이가 늘어난다. 추후 새 파일 타입 추가 시 이 if/else가 더 길어질 위험이 있다.
  - 제안: CSV 분기와 non-CSV(segments) 분기를 각각 private 메서드로 추출해 `_buildChunksForCsv` / `_buildChunksFromSegments`로 분리하면 메서드 길이·복잡도 관리 용이.

- **[INFO]** segments 루프 내 index 재부여 `{ ...chunk, index: chunks.length }` 패턴이 명시적이고 의도가 주석으로도 설명돼 있다. 가독성 양호.

---

### 파일 7-8: md.parser — parseMdSegments

- **[INFO]** `buf`(내부 버퍼 배열)와 `flush`(클로저)의 명명이 단순하지만 관련 코드 범위가 좁아 가독성에 지장 없음. `currentSection`도 의도가 명확하다.

- **[INFO]** `flush` 클로저가 외부 변수(`buf`, `segments`, `currentSection`)를 직접 변이(mutate)한다. 이 패턴은 JS에서 흔하지만, 테스트를 보면 4개 케이스 모두 단일 호출로 검증하므로 side-effect가 문제가 되지는 않는다. 다만 `flush` 자체가 반환값 없이 부작용만 있다는 점을 JSDoc에 명시하면 가독성 향상.
  - 제안: 현 수준에서는 INFO이나 `flush(): void` 시그니처 주석 보강 고려.

- **[INFO]** 마지막 fallback `segments.length > 0 ? segments : [{ text: text.trim(), metadata: {} }]`는 "빈 텍스트에서 heading 없이 flush가 한 번도 push 안 된 경우"를 처리한다. 그러나 `flush` 내 `if (body)` 가드 때문에 빈 텍스트라면 segments가 비어 fallback이 `[{ text: '', metadata: {} }]`를 반환할 수 있다 — 이는 text-chunker의 `if (!text.trim()) return []`가 이후에 처리하므로 실용적 문제는 없으나, 순수성(parseMdSegments 자체가 빈 text에 대해 비어있는 segment를 돌려주는 게 맞는지)은 명확하지 않다.
  - 위치: `md.parser.ts` 마지막 라인
  - 제안: INFO 수준. 필요시 `text.trim()` 가드를 함수 상단에 추가하면 의도 명확화.

---

### 파일 9: parser.factory — parseDocumentSegments

- **[INFO]** `parseDocument`와 `parseDocumentSegments` 두 함수가 switch 구조를 각각 가진다. 지원 포맷(`txt`, `md`, `pdf`, `csv`)이 늘어날 경우 두 switch를 동기화해야 한다.
  - 위치: `parser.factory.ts`
  - 상세: 현재 `parseDocumentSegments`에 `csv` case가 없고 `default` throw로 처리된다(CSV는 별도 경로). 이 의도가 JSDoc에 명시돼 있어 괜찮으나, 두 switch의 포맷 집합이 달라지면 유지보수 시 혼란 가능.
  - 제안: `SUPPORTED_SEGMENT_TYPES: string[]` 같은 상수로 명시적으로 두 함수의 지원 범위 차이를 표기하거나, `parseDocument`와 공유하는 포맷만 분기하는 방식 검토(INFO 수준).

- **[INFO]** `ParsedSegment` 인터페이스가 `parser.factory.ts`에 정의되고, `md.parser.ts`·`pdf.parser.ts`가 이를 import한다. 의존 방향이 factory → parser가 아닌 parser → factory 역방향이다. 소규모 모듈에서 실용적으로 사용되지만, 향후 `ParsedSegment`를 별도 types 파일로 분리하면 순환 가능성과 계층 혼재를 방지할 수 있다.
  - 제안: `chunking/types.ts` 또는 `parsers/types.ts`로 인터페이스 분리 고려(INFO 수준).

---

### 파일 10-11: pdf.parser — parsePdfSegments

- **[INFO]** `renderPageText` 함수의 명명과 책임이 명확하다. PDF item Y 좌표 비교로 줄바꿈을 삽입하는 로직이 주석으로 설명돼 있다.

- **[WARNING]** `pdf.parser.spec.ts`의 `jest.mock` 블록 상단이 매우 길다(30+ 라인의 중첩 타입 선언 포함). 두 번째 테스트(`mockImplementationOnce`)에서 동일 타입 구조를 다시 인라인으로 반복한다(`_buffer: Buffer, options?: { pagerender?: ... }` 타입 40+ 라인 중복).
  - 위치: `pdf.parser.spec.ts` +32–53
  - 상세: mock 타입은 상단의 `jest.mock` 블록과 완전히 동일한 구조다. TypeScript `type` alias나 `jest.Mock` 파라미터 타입을 추출해 참조하면 중복 제거 가능.
  - 제안: spec 파일 상단에서 `type PdfParseMock = ...`으로 타입 추출 후 두 곳에서 재사용. 또는 `mockResolvedValueOnce` 패턴으로 mock 구현 단순화.

---

### 파일 12-19: 노드 summaryTemplate 일괄 추가

- **[INFO]** `code`, `database-query`, `send-email`, `template` 4개 노드 모두 동일한 3-line `summaryTemplate: { template: '...' }` 패턴으로 추가됐다. 일관성 매우 양호.

- **[INFO]** `send-email.schema.ts` diff에서 `summaryTemplate.template`이 `'{{to.length}} recipients · {{subject}}'`로 추가됐다. `to`가 undefined인 경우 `to.length` 평가 시 런타임 에러 가능성이 있으나, 이는 DSL 평가기의 에러 처리 방식에 의존하므로 schema 레벨에서는 정보 수준.
  - 위치: `send-email.schema.ts` summaryTemplate
  - 제안: DSL 평가기가 undefined 프로퍼티 접근을 안전하게 처리하는지 확인. 필요시 `{{to?.length ?? 0}}` 형태나 평가기의 null-safe 처리 보장.

---

### 파일 20: expression-constants.ts — $itemIsFirst / $itemIsLast

- **[INFO]** `ROOT_VARIABLES` 배열에 두 항목이 `$itemIndex` 바로 다음에 배치되어 의미적 그룹화가 자연스럽다. `scopeKey: "hasItem"` 일관성도 양호.

- **[INFO]** `ContainerScopeFlags.hasItem` JSDoc이 "`$item` / `$itemIndex`"만 언급하고 신규 추가된 `$itemIsFirst`/`$itemIsLast`는 빠져 있다.
  - 위치: `expression-constants.ts` `ContainerScopeFlags` 인터페이스
  - 제안: JSDoc 업데이트로 `$itemIsFirst` / `$itemIsLast` 추가 언급.

---

### 파일 21-22: node-settings-panel — Error Handling UI 확장

- **[WARNING]** `SettingsTab` 함수형 컴포넌트가 이번 변경으로 상당히 길어졌다. 에러 핸들링 관련 state 4개(`policy`, `maxRetries`, `retryInterval`, `defaultOutputText`/`Error`) + 조건부 렌더링 두 블록이 기존 notes/label/isDisabled 로직에 합류하여 단일 컴포넌트가 여러 책임을 갖게 됐다.
  - 위치: `node-settings-panel.tsx` `SettingsTab` 함수 전체
  - 상세: 컴포넌트 길이가 300+ 라인으로 증가 추정. 에러 핸들링 UI(`policy` select + 조건부 retryConfig/defaultOutput 입력)를 `ErrorHandlingSection` 서브컴포넌트로 추출하면 책임 분리와 테스트 용이성 향상.
  - 제안: `ErrorHandlingSection` 컴포넌트 추출. props: `{ policy, maxRetries, retryInterval, defaultOutputText, defaultOutputError, onChange 핸들러들 }`.

- **[WARNING]** `LEGACY_POLICY_MAP`이 모듈 최상단에 정의되어 있는데, `retry`를 `retry`로 매핑하는 항목(`retry: "retry"`)이 포함돼 있다. 이 항목은 실질적으로 무의미한 항목이다(변환 없이 그대로). 코드를 읽는 사람이 "왜 retry → retry가 필요한가?"라고 혼란스러울 수 있다.
  - 위치: `node-settings-panel.tsx` `LEGACY_POLICY_MAP`
  - 제안: 주석으로 "legacy short values → engine canonical values; `retry` was unchanged" 등을 명시하거나, 그대로인 값은 맵에서 제거하고 fallback 로직 조정.

- **[INFO]** `handleSave` 콜백의 `useCallback` 의존성 배열이 7개(`nodeId, label, isDuplicateLabel, isDisabled, nodeConfig, notes, policy, maxRetries, retryInterval, defaultOutputText, t`)로 이전보다 늘었다. 올바른 구성이지만 배열이 길어지면 실수로 의존성을 빠뜨리기 쉽다. ESLint exhaustive-deps 규칙이 활성화돼 있다면 자동 검증된다.
  - 제안: INFO. ESLint 규칙 활성화 여부 확인.

- **[INFO]** `backoffMultiplier: 2` 가 `handleSave` 내부에 하드코딩돼 있다.
  - 위치: `node-settings-panel.tsx` +684
  - 상세: `retryInterval`은 state로 편집 가능하지만 `backoffMultiplier`는 고정값 `2`로 내장된다. 이 값이 엔진 default와 동일하다면 상수화하는 것이 의도를 명확히 한다.
  - 제안: `const DEFAULT_BACKOFF_MULTIPLIER = 2;` 상수로 추출.

---

### 파일 23-24: i18n dict

- **[INFO]** en/ko 두 dict가 동일 키 5개를 동시에 추가했다. 일관성 양호. 한국어 번역 `errorDefaultOutputInvalid: "유효하지 않은 JSON 입니다"` 는 올바른 한국어 표현이다.

---

### 파일 25: expression-engine evaluator.ts

- **[INFO]** `ExpressionContext` 인터페이스에 `$itemIsFirst?: boolean` / `$itemIsLast?: boolean` 추가. 최소 침습적 변경으로 일관성 양호.

---

### 파일 26-30: plan/complete 문서

- **[INFO]** plan 문서들은 코드가 아니라 추적 문서이므로 유지보수성 관점 평가 범위 밖이다. 내용의 명확성·구조는 양호하며, 미구현 항목 체크박스(`[x]`)로 상태가 명시적으로 추적된다.

---

## 요약

전체 변경은 세 가지 독립적인 기능 추가(ForEach `$itemIsFirst`/`$itemIsLast` 노출, knowledge-base chunk metadata 전파, error handling UI 확장)로 구성된다. 각 기능 내에서 패턴 일관성은 높고 네이밍은 의도를 잘 반영한다. 주요 유지보수성 우려는 두 가지다: (1) `forceSplitAndPush` 내부의 청크 객체 리터럴 중복(이미 `pushChunk` 헬퍼가 있음에도 우회)과 (2) `node-settings-panel.tsx`의 `SettingsTab` 컴포넌트가 에러 핸들링 state 4개 + 조건부 렌더링 두 블록을 흡수하면서 단일 컴포넌트 책임 과다. `pdf.parser.spec.ts`의 mock 타입 인라인 중복도 테스트 유지보수성을 낮춘다. 이 외 발견사항들은 INFO 수준으로 현재 코드 품질을 크게 저하시키지는 않는다.

## 위험도

LOW
