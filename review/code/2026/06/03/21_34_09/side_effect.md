# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `chunkText` 공개 API에 선택적 매개변수 추가
- 위치: `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts` — `chunkText(text, options, baseMetadata = {})`
- 상세: `baseMetadata` 매개변수에 기본값 `{}`이 지정되어 있어 기존 모든 호출자(인수 2개로 호출하는 곳)는 영향 없음. 순수 하위 호환 추가.
- 제안: 문제 없음. 기존 동작 유지 확인.

### [INFO] `parsePdf` 내부 타입 시그니처 확장 (모듈 내부 변경)
- 위치: `codebase/backend/src/modules/knowledge-base/parsers/pdf.parser.ts` — `pdfParse` require 캐스팅에 `options?: PdfParseOptions` 및 `numpages` 추가
- 상세: 이 변경은 모듈 내부에서 `pdfParse`를 호출하는 방식의 타입 확장이다. 기존 `parsePdf(buffer)` 공개 함수 시그니처는 그대로이므로 외부 호출자 영향 없음. 새로운 `parsePdfSegments`는 별도로 추가되는 것이므로 기존 코드 경로를 건드리지 않음.
- 제안: 문제 없음.

### [WARNING] `embedding.service.ts` — 비어 있는 document 조기 종료 로직 제거
- 위치: `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts` — diff lines 166-624
- 상세: 이전 코드에서는 `text.trim()` 이 빈 경우 `embeddingStatus: 'completed'`, `chunkCount: 0` 으로 즉시 업데이트하고 반환했다. 변경 이후 해당 조기 종료가 제거되고, 대신 `chunks.length === 0` 체크(아래에 남아 있는 것으로 보임)로만 처리된다. `parseDocumentSegments`가 빈 segment 목록을 반환하거나, 각 segment가 빈 텍스트를 반환해도 `chunks.length === 0` 분기로 올바르게 처리되는지 확인이 필요하다. diff에서 `chunks.length === 0` 처리 블록은 유지되고 있으므로 논리적 동등성은 보존되어 있다. 다만 csv 경로에서도 `parseDocument` 호출 시 빈 텍스트를 `chunkCsv`에 넘겨 빈 배열이 반환된다면 동일하게 처리된다.
- 제안: `parseDocumentSegments`의 모든 경우(txt/md/pdf)에서 빈 input 시 빈 segment 또는 빈 text segment가 반환되고 최종 `chunks.length === 0`으로 수렴하는지 단위 테스트로 검증 권장.

### [INFO] `parsePdfSegments` — `pages` closure 배열에 페이지 텍스트 누적
- 위치: `codebase/backend/src/modules/knowledge-base/parsers/pdf.parser.ts` — `parsePdfSegments`
- 상세: `pagerender` 콜백이 `pages` 배열에 push한다. `pdf-parse`가 페이지 순서를 보장한다고 가정되어 있으며, 라이브러리 동작에 의존하는 부분이다. 외부 상태 변경은 없고 함수 내 로컬 배열이다.
- 제안: 문제 없음. 다만 `pdf-parse` 라이브러리가 `pagerender`를 병렬이 아닌 순차 호출한다는 가정에 의존하므로 주석으로 명시하면 좋다.

### [INFO] `LEGACY_POLICY_MAP` — 모듈 스코프 상수 (전역 변수 아님)
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx`
- 상세: `LEGACY_POLICY_MAP`은 파일 상단 모듈 스코프 `const`로 선언되어 있다. 진정한 전역 변수(window 할당, module 외부 공유)가 아니며 읽기 전용 객체 리터럴이다. 부작용 없음.
- 제안: 문제 없음.

### [WARNING] `node-settings-panel.tsx` — `errorPolicy` → `errorHandling` 저장 포맷 변경 (공개 상태 구조 변경)
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` — `handleSave` 내부
- 상세: 저장 시 `restConfig.errorPolicy`를 `delete`하고 `errorHandling` 키로 대체한다. 이미 저장된 노드 데이터에서 `errorPolicy` 를 읽는 다른 소비자(backend handler, export/import 로직, e2e 스냅샷 등)가 있다면 해당 필드가 사라져 예상치 못한 동작이 발생할 수 있다. 마이그레이션 로직(`LEGACY_POLICY_MAP`)은 로드 시 적용되지만, 저장 전까지는 기존 노드 데이터에 `errorPolicy`가 그대로 유지된다. 저장한 이후에는 `errorPolicy`가 완전히 제거되고 `errorHandling`만 남는다.
- 제안: backend의 error-policy handler가 `errorHandling.policy`(새 형식)와 `errorPolicy`(레거시 형식) 모두를 수용하는지 확인 필요. frontend에서만 마이그레이션하고 backend이 아직 새 형식을 기대하지 않는다면 런타임 오류 가능성 존재. 또한 save 시 `delete restConfig.errorPolicy`는 `nodeConfig` 의 사본을 수정하므로 원본(`nodeConfig`)은 변경되지 않는다 — 올바른 패턴임을 확인.

### [INFO] `ExpressionContext` 인터페이스에 필드 추가
- 위치: `codebase/packages/expression-engine/src/evaluator.ts` — `$itemIsFirst?: boolean`, `$itemIsLast?: boolean`
- 상세: 선택적 필드 추가이므로 기존 `ExpressionContext` 생성자 모든 호출부 호환. 런타임에는 `undefined`로 평가되므로 기존 표현식 동작에 영향 없음.
- 제안: 문제 없음.

### [INFO] `ROOT_VARIABLES` 배열에 항목 추가
- 위치: `codebase/frontend/src/components/editor/expression/expression-constants.ts`
- 상세: `BUILT_IN_PICKER_VARIABLES`는 `ROOT_VARIABLES`를 filter+map으로 파생하므로 자동으로 새 항목을 포함한다. `$itemIsFirst`, `$itemIsLast` 모두 `scopeKey: "hasItem"`이 설정되어 있어 ForEach 컨테이너 외부에서는 자동으로 숨겨진다. 의도된 동작.
- 제안: 문제 없음.

### [INFO] `parseDocumentSegments` 신규 공개 함수 — `csv` 타입 미지원
- 위치: `codebase/backend/src/modules/knowledge-base/parsers/parser.factory.ts`
- 상세: `parseDocumentSegments`의 `default` 케이스는 `throw new Error('Unsupported file type for segment parsing: ...')`를 발생시킨다. `embedding.service.ts`에서 `csv`는 이 함수를 호출하지 않고 별도 분기로 처리되므로 런타임 오류는 없다. 그러나 미래에 `parseDocumentSegments`를 `csv`로 직접 호출하는 코드가 생기면 예외가 발생한다.
- 제안: 문서화 수준의 주의. 현재 호출 패턴에서는 문제 없음.

### [INFO] `summaryTemplate` 필드 추가 — 기존 `NodeComponentMetadata` 소비자
- 위치: `code.schema.ts`, `database-query.schema.ts`, `send-email.schema.ts`, `template.schema.ts`
- 상세: `summaryTemplate`은 `NodeComponentMetadata`의 선택적 필드로 보이며, 추가 전에는 `undefined`였다. 이 필드를 읽는 `getConfigSummary`/`renderSummaryTemplate` 로직은 `undefined` 시 `null`을 반환하도록 설계되어 있으므로 기존 동작과 동일. 새로 설정된 값은 새 기능을 활성화.
- 제안: 문제 없음.

---

## 요약

이번 변경 집합의 부작용 위험은 전반적으로 낮다. 주요 변경은 (1) `chunkText`에 선택적 `baseMetadata` 매개변수 추가(하위 호환), (2) `parsePdfSegments`/`parseMdSegments` 신규 함수 추가, (3) `embedding.service.ts`에서 segment 기반 parse+chunk 파이프라인 교체, (4) frontend error handling 저장 형식을 `errorPolicy`(flat)에서 `errorHandling`(nested) 로 마이그레이션, (5) 표현식 컨텍스트에 `$itemIsFirst`/`$itemIsLast` 추가다. 주의가 필요한 지점은 `embedding.service.ts`의 빈 document 조기 종료 로직 제거가 `chunks.length === 0` 체크로 올바르게 수렴하는지, 그리고 frontend의 `errorPolicy` → `errorHandling` 포맷 전환이 backend handler와 정합성을 유지하는지다.

## 위험도

LOW
