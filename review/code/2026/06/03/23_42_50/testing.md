# Testing Review

## 발견사항

### [CRITICAL] `baseMetadata` 전파 기능 삭제와 함께 테스트도 동시에 삭제 — 회귀 감지 불가
- 위치: `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.spec.ts` (삭제된 `describe('chunkText baseMetadata propagation')` 블록), `text-chunker.ts`
- 상세: `chunkText` 함수에서 `baseMetadata` 파라미터와 각 Chunk 의 `metadata` 전파 로직이 제거되면서, 이를 검증하던 테스트 2개도 함께 삭제됐다. 기능 삭제와 테스트 삭제가 동시에 발생했으므로 회귀 감지 경로가 없어졌다. 만약 향후 `metadata` 필드가 다른 경로로 재도입될 경우 현재 테스트로는 이를 포착할 수 없다. 더 근본적으로, 이 변경이 `spec/5-system/8-embedding-pipeline.md §6.1` 명세를 의도적으로 철회한 것인지, 아니면 미완성 리팩토링인지가 테스트 코드만으로는 판단이 불가능하다.
- 제안: 변경이 의도적 명세 철회라면 `spec/5-system/8-embedding-pipeline.md §6.1` 의 `section`/`page` metadata 약속이 여전히 살아있는지 확인 후, metadata 관련 계약을 전혀 테스트하지 않는 현 상태임을 명시적으로 기록해야 한다. metadata 가 향후 필요할 것으로 예상된다면 삭제 전 `TODO` 주석과 함께 보존하거나 feature-flag 로 분리해야 한다.

### [CRITICAL] `parseMdSegments`, `parsePdfSegments`, `parseDocumentSegments` 함수 삭제 + 테스트 파일 전체 삭제 — 커버리지 제로
- 위치: `codebase/backend/src/modules/knowledge-base/parsers/md.parser.spec.ts` (삭제), `pdf.parser.spec.ts` (삭제), `parser.factory.ts` (`parseDocumentSegments` 삭제)
- 상세: `parseMdSegments` (섹션별 분할), `parsePdfSegments` (페이지별 분할), `parseDocumentSegments` (factory) 세 함수가 구현에서 제거됐고 이를 검증하던 spec 파일 2개도 완전 삭제됐다. 이 함수들은 RAG 검색에서 chunk 의 출처(`section`, `page`)를 추적하는 핵심 경로였다. 이제 PDF 파서는 단순 flat text 만 반환하고 page 메타데이터를 전혀 생성하지 않는다. 현재 코드베이스에서 PDF/MD 파서 동작을 검증하는 테스트가 **0개**다.
- 제안: 최소한 `parseMd`/`parsePdf` 의 정상 동작(non-empty output, 빈 파일 처리)을 검증하는 단위 테스트를 작성해야 한다. 기능이 의도적으로 축소된 것이라면 `parsePdf` 가 빈 버퍼를 받았을 때 throw 하지 않는다는 회귀 테스트만이라도 필요하다.

### [CRITICAL] `embedding.service.spec.ts` — multi-segment 경로 테스트 삭제, 단일 flat-text 경로만 남음
- 위치: `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.spec.ts` (삭제된 `chunks each segment and feeds all segments` 테스트)
- 상세: `processDocument` 가 이전에는 `parseDocumentSegments` → 다수 segment → per-segment `chunkText` 경로를 거쳤으나, 이제 `parseDocument` → 단일 text → `chunkText` 로 단순화됐다. 해당 변경과 함께 multi-segment 배치 임베딩을 검증하던 유일한 테스트도 삭제됐다. 남아있는 테스트들은 모두 `parseDocument` 를 mock `'parsed text body'` 로 픽스처했으므로, `parseDocument` 실제 동작(특히 fileType dispatch, 예외 경로)을 전혀 커버하지 않는다.
- 제안: `processDocument` 에서 `fileType === 'csv'` vs 나머지 분기(`chunkCsv` vs `chunkText`)를 각각 커버하는 통합 테스트, 그리고 `parseDocument` 가 unsupported fileType 에서 throw 할 때 `processDocument` 가 `failed` status 로 처리되는지 검증하는 테스트를 추가해야 한다.

### [WARNING] `$itemIsFirst`/`$itemIsLast` 표현식 변수 삭제 — 양단 테스트 삭제
- 위치: `codebase/packages/expression-engine/src/evaluator.ts`, `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts`, `expression-resolver.service.spec.ts`
- 상세: `ExpressionContext` 인터페이스에서 `$itemIsFirst`/`$itemIsLast` 가 삭제됐고 `buildExpressionContext` 에서 이를 expose 하던 코드도 제거됐다. 이 변수들을 실제로 evaluate 하는 `evaluator.ts` 의 테스트도 없고, 삭제된 spec 테스트는 `buildExpressionContext` 레벨의 단위 테스트였다. `$item` / `$itemIndex` 는 여전히 남아 있으므로, `$itemIsFirst`/`$itemIsLast` 가 삭제된 이유와 해당 변수를 사용하는 실사용 expression 이 있을 경우의 동작(undefined로 폴백 vs 오류)을 검증하는 테스트가 없다.
- 제안: Filter 노드 등 `$item` 계열을 사용하는 노드의 통합 테스트에서 `$itemIsFirst`/`$itemIsLast` 를 참조하는 expression 을 사용할 경우 undefined 로 해소됨을 명시하는 테스트를 추가해야 한다.

### [WARNING] `summaryTemplate` 4개 노드에서 삭제 — 테스트도 같이 삭제, 캔버스 요약 회귀 감지 없음
- 위치: `code.schema.ts`, `database-query.schema.ts`, `send-email.schema.ts`, `template.schema.ts` + 각 `.spec.ts`
- 상세: Code, Database Query, Send Email, Template 4개 노드의 `summaryTemplate` 이 `NodeComponentMetadata` 에서 제거됐다. 이를 검증하는 `renderSummaryTemplate` 단위 테스트도 각 spec 파일에서 삭제됐다. 이 필드 삭제로 인해 캔버스에서 해당 노드들의 요약 표시가 어떻게 변경되는지(빈 문자열? fallback 텍스트?)를 검증하는 테스트가 없다. `renderSummaryTemplate` 의 `undefined` summaryTemplate 처리 경로가 테스트되지 않은 상태다.
- 제안: `renderSummaryTemplate(undefined, {})` 또는 `renderSummaryTemplate(null, {})` 의 동작을 검증하는 테스트를 `@workflow/node-summary` 패키지 수준에서 추가해야 한다. 캔버스 요약이 의도적으로 제거됐다면 해당 노드 패널 컴포넌트 테스트에서 요약 영역이 렌더링되지 않음을 assert 해야 한다.

### [WARNING] `NodeSettingsPanel` — 에러 핸들링 탭 테스트 파일 전체 삭제, 레거시 마이그레이션 로직도 삭제
- 위치: `codebase/frontend/src/components/editor/settings-panel/__tests__/node-settings-panel-error-handling.test.tsx` (전체 삭제), `node-settings-panel.tsx`
- 상세: 삭제된 테스트 파일은 (a) 레거시 `config.errorPolicy` flat 값 → `errorHandling.policy` 마이그레이션, (b) retry 정책 저장 시 nested 구조 생성, (c) defaultOutput JSON 파싱 오류 block, (d) 정상 JSON 저장 4가지를 검증했다. 구현에서도 `LEGACY_POLICY_MAP`, nested `errorHandling` 빌드 로직, `defaultOutput` JSON 파싱이 모두 제거됐다. 남아있는 `node-settings-panel.tsx` 의 `errorPolicy` 단순 state 가 실제로 저장/로드되는 경로를 커버하는 테스트가 0개다.
- 제안: 단순화된 `errorPolicy` state 가 올바르게 저장되는지, 그리고 `errorPolicy` 가 없는 노드에서 default 값이 적용되는지를 검증하는 최소 테스트를 복원해야 한다.

### [WARNING] 새로 추가된 테스트(`spec-link-integrity`, `spec-area-index`, `plan-frontmatter`, `spec-plan-completion`) — 실제 파일시스템 의존, 격리 불가
- 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`, `spec-area-index.test.ts`, `plan-frontmatter.test.ts`, `spec-plan-completion.test.ts`
- 상세: 4개 테스트 모두 `repoRoot()` 로 실제 파일시스템을 직접 읽는다. 워킹 디렉토리에 절대적으로 의존하므로, CI 환경이 다른 경로에서 실행되거나 spec 파일이 이동될 경우 테스트 자체가 silent pass 또는 wrong root 로 실행될 수 있다. `spec-link-integrity.test.ts` 의 `it("scans a non-trivial set of spec markdown files", ...)` 은 sanity guard 역할이지만, `repoRoot()` 가 잘못된 경로를 반환해도 `files.length > 50` 이 `files.length === 0` 이 되어 실패 메시지 없이 판정 오류가 발생한다.
- 제안: `repoRoot()` 가 실제로 `spec/` 폴더를 포함한 디렉토리를 반환하는지 assertion 을 추가하고, `files.length` 의 하한을 더 보수적으로 높이거나(예: > 100) 파일 목록 샘플을 출력하는 assertion 을 추가해야 한다.

### [INFO] `spec-plan-completion.test.ts` — `spec_impact` 리스트 항목의 파일 존재 여부만 검증, 내용 정합성 미검증
- 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`
- 상세: Gate C 검증은 완료된 plan 의 `spec_impact` frontmatter 가 실제 spec 파일 경로를 가리키는지만 확인한다. spec 파일 내에서 해당 plan 이 구현한 기능이 실제로 명세됐는지, 혹은 `spec_impact: none` 이 과도하게 사용되지 않는지는 검증하지 않는다. 이는 허용 가능한 tradeoff 이나, `none` 의 사용 빈도를 모니터링하지 않으면 gate 를 우회하는 수단으로 남용될 수 있다.
- 제안: INFO 수준으로 기록. `none` 을 사용한 plan 목록을 test output 에 출력해 리뷰어가 인지할 수 있도록 하는 optional assertion 을 추가하면 gate 효과가 강화된다.

### [INFO] 스펙 문서(링크 수정) 변경에 대한 구현 사이드 테스트 없음 — 정책적으로 허용
- 위치: 파일 1~21 (spec/*.md 링크/앵커 수정)
- 상세: 이번 PR 의 spec 파일 변경 대부분은 내부 링크·앵커 수정(`#1-conditiongroup-구조` → `#1-condition-구조` 등)이다. 이 변경들은 새로 추가된 `spec-link-integrity` 게이트가 직접 회귀를 탐지한다. 기능 구현 변경이 아니므로 별도의 구현 사이드 테스트를 요구하지 않는다.

---

## 요약

이번 변경의 핵심 테스트 위험은 **기능 삭제와 테스트 삭제가 동시에 발생**한 패턴에 있다. KB 파이프라인에서 `baseMetadata` 전파, `parseMdSegments`/`parsePdfSegments`/`parseDocumentSegments` segment 파싱, embedding 멀티-세그먼트 배치 경로가 구현에서 제거되면서 해당 경로를 커버하던 테스트도 함께 삭제됐다 — 이 경우 삭제된 기능이 나중에 다른 방식으로 재도입될 때 회귀를 포착할 안전망이 없다. 추가로 `NodeSettingsPanel` 에러 핸들링 탭 테스트, 4개 노드의 `summaryTemplate` 렌더링 테스트, `$itemIsFirst`/`$itemIsLast` 표현식 테스트도 구현 단순화와 함께 제거됐다. 반면 새로 추가된 `spec-link-integrity`, `spec-area-index`, `plan-frontmatter`, `spec-plan-completion` 4개의 문서 정합성 게이트 테스트는 이전에는 존재하지 않던 build-time 가드를 추가하는 긍정적 변경이나, 실제 파일시스템 직접 의존성으로 인한 환경 격리 취약점이 있다.

## 위험도

HIGH
