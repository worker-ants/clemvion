# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `parsePdf` 공개 함수에 JSDoc 없음
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/knowledge-base/parsers/pdf.parser.ts` — `parsePdf` 함수
- 상세: 동일 파일에 추가된 `parsePdfSegments`와 `renderPageText`는 JSDoc이 충실하게 작성되었으나, 기존 `parsePdf`는 문서가 없다. 이미 존재하던 함수라 이번 변경의 직접 대상은 아니지만, 신규 peer 함수와 일관성이 떨어진다.
- 제안: `parsePdf`에도 한 줄 JSDoc 추가 (`/** Parse an entire PDF to a single flat string using pdf-parse defaults. */`).

### [INFO] `ChunkMetadata` 인터페이스에 JSDoc 없음
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts` — `ChunkMetadata`, `Chunk`, `ChunkOptions` 인터페이스
- 상세: `chunkText`의 새 파라미터 `baseMetadata: ChunkMetadata`는 JSDoc에서 잘 설명되었지만, `ChunkMetadata` 인터페이스 자체와 `Chunk` 인터페이스에는 필드별 설명이 없다. `metadata?: ChunkMetadata` 필드가 optional임에도 `pushChunk`/`forceSplitAndPush`에서 `{ ...baseMetadata }`로 항상 채워진다는 불변식이 인터페이스 레벨에서 명시되지 않는다.
- 제안: `ChunkMetadata` 및 `Chunk.metadata` 필드에 간단한 JSDoc 추가. `Chunk.metadata`를 `metadata: ChunkMetadata`(non-optional)로 변경하거나 JSDoc에 "항상 존재 (빈 객체 기본)" 명시.

### [INFO] `ExpressionContext` 인터페이스에 `$itemIsFirst`/`$itemIsLast` 설명 없음
- 위치: `/Volumes/project/private/clemvion/codebase/packages/expression-engine/src/evaluator.ts` — `ExpressionContext` 인터페이스의 두 신규 필드
- 상세: 동일 인터페이스 내 `$loop`, `$item`, `$itemIndex` 역시 별도 주석이 없지만, 신규 필드를 추가하면서 간단한 인라인 주석이라도 추가하면 가독성이 높아진다. spec 참조(spec/4-nodes/1-logic/9-foreach.md)를 연결하면 특히 유용하다.
- 제안: `/** ForEach: true when this is the first item (spec/4-nodes/1-logic/9-foreach.md §3) */` 형태의 인라인 주석 추가.

### [INFO] `LEGACY_POLICY_MAP` 문서에 마이그레이션 대상 버전/날짜 기재 없음
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` — `LEGACY_POLICY_MAP` 상수
- 상세: JSDoc 주석이 있어 목적은 이해되나, 이 레거시 키들이 "언제까지 지원해야 하는 마이그레이션 경로인지" 또는 "영구 하위 호환인지"가 명시되어 있지 않다. 향후 해당 분기를 제거할 수 있는지 판단 기준이 없다.
- 제안: JSDoc에 `@deprecated` 여부와 제거 조건(예: "모든 기존 workflow가 새 형태로 재저장된 이후 제거 가능") 또는 관련 spec 링크 추가.

### [INFO] `ContainerScopeFlags.hasItem` JSDoc이 `$itemIsFirst`/`$itemIsLast` 미반영
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/components/editor/expression/expression-constants.ts` — `ContainerScopeFlags` 인터페이스 `hasItem` 필드
- 상세: 현재 JSDoc은 `/** \`foreach\` container ancestor provides \`$item\` / \`$itemIndex\`. */`라고 기술되어 있으나, 이번 변경으로 `$itemIsFirst`/`$itemIsLast`도 `hasItem` scope에 종속된다. 주석이 stale 상태가 되었다.
- 제안: `/** \`foreach\` container ancestor provides \`$item\`, \`$itemIndex\`, \`$itemIsFirst\`, \`$itemIsLast\`. */`로 업데이트.

### [INFO] spec/5-system/5-expression-language.md 표: `$itemIsFirst`/`$itemIsLast` type 컬럼 일관성 확인 필요
- 위치: `/Volumes/project/private/clemvion/spec/5-system/5-expression-language.md` — 신규 두 행
- 상세: 기존 표는 `$item`을 `Object/Any`, `$itemIndex`를 `Number`로 표기한다. 신규 행은 `Boolean`으로 표기하여 일관성이 있다. 문서화 품질은 양호하다. 다만, `$loop`의 `isFirst`/`isLast`가 이미 존재한다면 동일 표에서 두 세트가 병립하는 것에 대한 설명(foreach vs loop 구분)이 있으면 더 명확하다.
- 제안: 표 또는 각주에 "`$itemIsFirst`/`$itemIsLast`는 ForEach 전용; Loop 컨텍스트의 first/last는 `$loop.isFirst`/`$loop.isLast` 참조" 한 줄 추가.

### [INFO] plan 문서의 `[x]` 체크 상태와 spec `status: implemented` 승격 일관성 — 문서화 관점 양호
- 위치: `plan/complete/spec-sync-foreach-gaps.md`, `plan/complete/spec-sync-embedding-pipeline-gaps.md`, `plan/complete/spec-sync-data-common-gaps.md`, `plan/complete/spec-sync-template-gaps.md`, `plan/in-progress/spec-sync-integration-common-gaps.md`, `plan/in-progress/spec-sync-node-common-gaps.md`
- 상세: 구현 완료 항목에 `[x]`가 체크되고, spec frontmatter의 `status`가 `partial`에서 `implemented`로 정확히 업데이트되었으며, `pending_plans` 링크도 제거되었다. 이력·배경 메모(비고 섹션)도 충실하다. 문서화 품질 문제 없음.

### [INFO] `node-settings-panel.tsx` 인라인 주석의 `t("editor.errorDefaultOutputInvalid")` 번역키가 두 곳에서 사용
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` 및 i18n 사전
- 상세: `editor.errorDefaultOutputInvalid`가 toast와 state 모두에 사용되나 i18n 사전(en/ko)에 올바르게 추가되어 있다. 번역 키가 "Invalid JSON"(en)과 "유효하지 않은 JSON 입니다"(ko)로 잘 정의되어 있다. 문서화 관점 문제 없음.

---

## 요약

이번 변경은 전반적으로 문서화 품질이 높다. 신규 공개 API(`parseDocumentSegments`, `parseMdSegments`, `parsePdfSegments`, `chunkText` 파라미터 확장, `ParsedSegment` 인터페이스)에는 JSDoc과 spec 참조 링크가 일관되게 첨부되어 있고, spec 파일도 구현에 맞게 갱신되었다. 주요 미비 사항은 소규모이며: `ContainerScopeFlags.hasItem` JSDoc이 신규 `$itemIsFirst`/`$itemIsLast` 노출을 반영하지 않은 stale 주석(INFO), `ChunkMetadata`/`Chunk` 인터페이스의 필드 설명 부재(INFO), `LEGACY_POLICY_MAP`의 라이프사이클 명시 부재(INFO) 수준이다. 중단·경고 수준의 문서화 결함은 없다.

## 위험도

LOW
