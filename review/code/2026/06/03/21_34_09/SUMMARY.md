# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — spec-drift(구현 완료 후 spec 미갱신) 5건 + 기능 버그 가능성(null 저장, 빈 페이지 필터링 누락) 2건 + 테스트 격리·커버리지 갭 2건이 주요 이슈. 보안·아키텍처 레이어는 LOW 수준으로 안정적.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `$itemIsFirst`/`$itemIsLast` 구현 완료 — `spec/4-nodes/1-logic/9-foreach.md` §3.3 및 `spec/5-system/5-expression-language.md` §4 미갱신. spec 에 여전히 "Planned" 표기 잔존 | `expression-resolver.service.ts`, `evaluator.ts`, `expression-constants.ts` | 코드 유지. spec 두 곳 갱신: §3.3 표에 두 변수 추가(Planned→구현됨), expression-language §4 목록에 추가, foreach frontmatter pending_plans 제거 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] embedding pipeline §6.1 `metadata` 구현 완료 — `spec/5-system/8-embedding-pipeline.md` §6.1 에 여전히 "현재 항상 빈 `{}` (Planned)" 서술 잔존 | `text-chunker.ts`, `embedding.service.ts`, `md.parser.ts`, `pdf.parser.ts` | 코드 유지. spec §6.1 metadata 행을 구현 완료 상태(md: `{section}`, pdf: `{page}`)로 교체, frontmatter pending_plans 제거 |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] errorHandling nested 계약 + retry/default-output UI 구현 완료 — `spec/3-workflow-editor/1-node-common.md` §2.4/§2.5.1 에 "미구현 (Planned)" 표기 잔존 | `node-settings-panel.tsx`, `node-settings-panel-error-handling.test.tsx`, i18n 사전 | 코드 유지. spec §2.4 Retry 행·§2.5.1 제목에서 "Planned" 제거, `errorHandling` nested shape + policy vocabulary + 레거시 마이그레이션 규칙 spec에 명시 |
| 4 | SPEC-DRIFT | [SPEC-DRIFT] Code 노드 summaryTemplate `{{language\|upper}}` 구현 완료 — `spec/4-nodes/5-data/0-common.md` §3 Code 행에 "미구현 (Planned)" 잔존 | `code.schema.ts`, `code.schema.spec.ts` | 코드 유지. spec §3 Code 행을 구현된 `{{language\|upper}}` (`JAVASCRIPT`) 포맷으로 업데이트, "미구현" 제거 |
| 5 | SPEC-DRIFT | [SPEC-DRIFT] Template 노드 summaryTemplate `{{outputFormat}} · {{buttons.length}} buttons` 구현 — `spec/4-nodes/6-presentation/5-template.md` §7 "버튼 없음" 행이 구현 동작(`html · 2 buttons`)과 불일치 | `template.schema.ts`, `template.schema.spec.ts` | 코드 유지. spec §7 표를 구현된 단일 포맷으로 통일, "버튼 없음/있음" 분기 제거 |
| 6 | 기능 버그 | `use_default_output` 정책에서 JSON 에디터를 비울 때 `null` 이 저장됨 — spec §2.5.2 의 "미지정 시 타입별 기본값" 규칙과 충돌 | `node-settings-panel.tsx` `handleSave` | `defaultOutputText.trim()` falsy 시 저장 차단(`setDefaultOutputError` 호출) 또는 기본값 `'{}'`로 폴백 |
| 7 | 기능 버그 | `parsePdfSegments` 에서 빈 페이지 텍스트(`str: ''`)를 필터링하지 않고 `{ text: '', metadata: { page: N } }` segment로 포함 — 대용량 스캔 PDF에서 무의미한 루프 발생 가능 | `pdf.parser.ts` `parsePdfSegments` | `pages.push` 전 `text.trim()` 공백 체크 후 skip, 또는 map 이후 `filter(s => s.text.trim())` 추가 |
| 8 | 테스트 격리 | NodeSettingsPanel 테스트에서 Zustand store 가 `afterEach`에서 명시적으로 리셋되지 않아 테스트 간 상태 누출 위험 — 순서 의존·간헐적 실패 가능성 | `node-settings-panel-error-handling.test.tsx` | `beforeEach`/`afterEach`에서 `useEditorStore.setState({ nodes: [], ... })`로 store 명시적 리셋 |
| 9 | 테스트 커버리지 | `embedding.service.spec.ts` mock이 단일 segment만 반환 — 다중 segment의 chunk index 연속 재부여·metadata 전파 로직이 전혀 검증되지 않음 | `embedding.service.spec.ts` | mock을 다중 segment(`[{text:'seg1',metadata:{section:'A'}},{text:'seg2',metadata:{section:'B'}}]`)로 교체, 최종 chunk.index 연속성과 metadata 부착 어설션 추가 |
| 10 | 부작용 | `errorPolicy`→`errorHandling` 저장 포맷 전환 시 backend handler가 새 형식(`errorHandling.policy`)을 처리하는지 확인 필요. frontend만 마이그레이션되고 backend가 미지원이면 런타임 오류 가능 | `node-settings-panel.tsx` `handleSave`, backend error-policy handler | backend handler가 `errorHandling.policy`(신규)와 `errorPolicy`(레거시) 양쪽을 수용하는지 확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | PDF 파서: `pdfParse(buffer)` 에 악성 입력 시 ReDoS/메모리 폭발 가능성 — 기존 구조적 이슈, 이번 변경이 attack surface 소폭 확대 | `pdf.parser.ts` | 업로드 크기·MIME 검증 강화, pdf-parse 버전 최신 고정, npm audit CI gate 유지, 파싱을 별도 워커에서 실행 고려 |
| 2 | 보안 | Markdown 파서: 파일 크기 상한 없어 수백 MB 입력 시 메모리 압박 DoS 벡터 | `md.parser.ts` | 업로드 레이어 크기 제한이 md 파일에도 적용되는지 확인 |
| 3 | 아키텍처 | `ParsedSegment` 인터페이스가 `parser.factory.ts`에 정의되어 하위 파서가 팩토리를 역참조하는 레이어 방향 역전 | `parser.factory.ts`, `md.parser.ts`, `pdf.parser.ts` | `ParsedSegment`를 별도 `types.ts`로 분리하여 parsers가 factory를 바라보지 않도록 개선 |
| 4 | 아키텍처 | `parsePdf`(flat) 경로가 embedding.service에서 더 이상 사용되지 않아 데드코드화 가능성 | `pdf.parser.ts`, `embedding.service.ts` | `parsePdf` 호출 경로 확인 후 미사용이면 제거 또는 `parsePdfSegments`에 위임 |
| 5 | 아키텍처 | `EmbeddingService` 내 segment 루프·chunk index 재부여 로직이 서비스 레이어에 인라인 — 포맷 추가 시 서비스 코드 직접 수정 필요(OCP 위반 잠재성) | `embedding.service.ts` | `chunkSegments(segments, options): Chunk[]` 헬퍼를 chunking 레이어에 두어 서비스는 파이프라인만 orchestrate |
| 6 | 아키텍처 | `NodeSettingsPanel` — 에러 핸들링 config 변환 도메인 로직이 UI 컴포넌트에 집중, useState 수 증가 | `node-settings-panel.tsx` | `useErrorHandlingConfig(initialConfig)` 커스텀 훅으로 상태·파생·빌드·마이그레이션 로직 분리 |
| 7 | 아키텍처 | expression context 변수 추가 시 엔진 타입·서비스 구현·프론트엔드 자동완성 3곳을 동시 수정해야 하는 구조적 결합 | `evaluator.ts`, `expression-resolver.service.ts`, `expression-constants.ts` | 장기적으로 context 변수 레지스트리를 shared 패키지 단일 정의로 수렴 |
| 8 | 범위 | `code.schema.ts`·`template.schema.ts`·`expression-resolver.service.ts` 구현이 plan 파일 "결정 필요" 표기 제거 없이 포함됨 — 결정 근거가 plan 문서에 명시적으로 기록되지 않음 | `plan/complete/*.md` | plan 파일에 "결정 A 채택" 근거 기록, "결정 필요" 표시 제거 |
| 9 | 유지보수성 | `forceSplitAndPush` 내 청크 객체 리터럴 두 곳 중복 — `pushChunk` 헬퍼가 있음에도 우회 | `text-chunker.ts` | `pushChunk` 재사용 또는 `buildChunk()` 유틸 추출 |
| 10 | 유지보수성 | `SettingsTab` 컴포넌트가 300+ 라인으로 증가, 에러 핸들링 state 4개 + 조건부 렌더링 흡수 | `node-settings-panel.tsx` | `ErrorHandlingSection` 서브컴포넌트 추출 |
| 11 | 유지보수성 | `LEGACY_POLICY_MAP` 에서 `retry: "retry"` 항목이 실질적으로 무의미(동일값 매핑) | `node-settings-panel.tsx` | 주석으로 "retry was unchanged" 명시하거나 맵에서 제거 후 fallback 로직 조정 |
| 12 | 유지보수성 | `pdf.parser.spec.ts` mock 타입 구조가 두 곳에서 40+ 라인 중복 인라인 | `pdf.parser.spec.ts` | `type PdfParseMock = ...` 추출 후 재사용 |
| 13 | 유지보수성 | `ContainerScopeFlags.hasItem` JSDoc이 `$itemIsFirst`/`$itemIsLast` 미반영(stale) | `expression-constants.ts` | JSDoc에 두 신규 변수 추가 언급 |
| 14 | 문서화 | `ChunkMetadata`/`Chunk` 인터페이스에 필드별 JSDoc 없음; `metadata`가 optional이나 항상 채워지는 불변식 미명시 | `text-chunker.ts` | 인터페이스에 JSDoc 추가, `metadata`를 non-optional로 변경 또는 "항상 존재 (빈 객체 기본)" 주석 |
| 15 | 문서화 | `LEGACY_POLICY_MAP` JSDoc에 라이프사이클(제거 조건, deprecated 여부) 미명시 | `node-settings-panel.tsx` | `@deprecated` 여부와 제거 조건 또는 관련 spec 링크 추가 |
| 16 | 문서화 | `spec/5-system/5-expression-language.md` 표에서 `$itemIsFirst`/`$itemIsLast`가 `$loop.isFirst`/`isLast`와 병립 — ForEach vs Loop 구분 설명 부재 | `spec/5-system/5-expression-language.md` | 각주 또는 표에 "`$itemIsFirst`/`$itemIsLast`는 ForEach 전용; Loop는 `$loop.isFirst`/`$loop.isLast`" 한 줄 추가 |
| 17 | 테스트 커버리지 | `$itemIsLast=true` 케이스 테스트 누락 — `isFirst=true`만 검증 | `expression-resolver.service.spec.ts` | `isFirst=false, isLast=true` 케이스 추가 |
| 18 | 테스트 커버리지 | `chunkText baseMetadata` 테스트가 단일 청크 가능성 높은 입력값 사용 — `forceSplitAndPush` 경로 metadata 전파 미검증 | `text-chunker.spec.ts` | `chunkSize: 5`처럼 강제 다중 청크 유도 값으로 테스트, `forceSplitAndPush` 경로 직접 트리거 케이스 추가 |
| 19 | 테스트 커버리지 | `parsePdfSegments` 빈 페이지 처리 테스트 없음 | `pdf.parser.spec.ts` | 빈 페이지 포함 PDF 케이스 추가, segment 필터링 여부 명세 |
| 20 | 테스트 커버리지 | `parseMdSegments` — 중간 body 없는 연속 헤딩 케이스 미검증 | `md.parser.spec.ts` | 연속 헤딩(body 없음) 및 헤딩 레벨 혼재 케이스 추가 |
| 21 | 테스트 커버리지 | `retryInterval` 변경 UI 테스트 없음 | `node-settings-panel-error-handling.test.tsx` | `retryInterval` 변경 후 저장 케이스 추가 |
| 22 | 테스트 커버리지 | 기존 nested `errorHandling` 구조로 seed 된 노드 로드 케이스 없음 (정상 경로) | `node-settings-panel-error-handling.test.tsx` | nested errorHandling seed 후 UI 초기값 표시 검증 케이스 추가 |
| 23 | 테스트 커버리지 | summaryTemplate 테스트에서 undefined/null 필드 입력 케이스 없음 | `code/database-query/send-email/template.schema.spec.ts` | 관련 필드 undefined·빈 배열 시 `renderSummaryTemplate` 안전 처리 여부 엣지 케이스 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | SPEC-DRIFT 5건(spec 미갱신) + 기능 버그 2건(null 저장, 빈 페이지 필터링) |
| testing | MEDIUM | embedding.service 다중 segment 테스트 부재, Zustand store 격리 미흡 |
| security | LOW | PDF 파서 악성 입력 처리(기존 구조적 이슈), 신규 취약점 없음 |
| architecture | LOW | ParsedSegment 역방향 의존, EmbeddingService 인라인 로직, 3-위치 expression context 결합 |
| side_effect | LOW | errorPolicy→errorHandling 저장 포맷 전환 시 backend 정합성 확인 필요 |
| maintainability | LOW | forceSplitAndPush 중복, SettingsTab 컴포넌트 과다, pdf.parser.spec.ts mock 타입 중복 |
| scope | LOW | plan 파일 "결정 필요" 표기가 제거 없이 구현 포함, 결정 근거 미기록 |
| documentation | LOW | ContainerScopeFlags JSDoc stale, ChunkMetadata 인터페이스 설명 부재, LEGACY_POLICY_MAP 라이프사이클 미명시 |

## 발견 없는 에이전트

없음 — 모든 에이전트가 발견사항을 보고함.

## 권장 조치사항

1. **[즉시] SPEC-DRIFT 5건 해소** — `spec/4-nodes/1-logic/9-foreach.md` §3.3, `spec/5-system/5-expression-language.md` §4, `spec/5-system/8-embedding-pipeline.md` §6.1, `spec/3-workflow-editor/1-node-common.md` §2.4/§2.5.1, `spec/4-nodes/5-data/0-common.md` §3, `spec/4-nodes/6-presentation/5-template.md` §7 갱신 (코드 revert 불필요, spec만 갱신)
2. **[즉시] `use_default_output` 빈 JSON 저장 버그 수정** — `node-settings-panel.tsx` `defaultOutputText.trim()` falsy 시 `null` 대신 저장 차단 또는 `'{}'` 폴백 적용
3. **[즉시] `parsePdfSegments` 빈 페이지 필터링 추가** — `text.trim()` 가드로 빈 텍스트 segment 제외
4. **[권장] `embedding.service.spec.ts` 다중 segment 테스트 추가** — chunk index 연속성·metadata 전파 로직 검증
5. **[권장] NodeSettingsPanel 테스트 store 격리** — `beforeEach`/`afterEach`에서 Zustand store 명시적 리셋
6. **[권장] backend errorHandling 포맷 호환성 확인** — `errorHandling.policy`(신규)와 `errorPolicy`(레거시) 양쪽 수용 여부 검증
7. **[개선] `forceSplitAndPush` 내 청크 객체 리터럴 중복 제거** — `pushChunk` 헬퍼 재사용
8. **[개선] plan 파일 결정 근거 기록** — `spec-sync-data-common-gaps.md`, `spec-sync-template-gaps.md`, `spec-sync-node-common-gaps.md` 의 "결정 필요" 표기를 채택된 결정으로 교체
9. **[개선] `ContainerScopeFlags.hasItem` JSDoc 업데이트** — `$itemIsFirst`/`$itemIsLast` 추가 언급
10. **[장기] expression context 변수 레지스트리 단일화** — shared 패키지에서 타입 정의, 프론트엔드 자동완성 자동 파생

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명 — 전원 router_safety 강제 포함)
  - **제외**: `performance`, `dependency`, `database`, `concurrency`, `api_contract` (5개)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 에 의해 생략 |
  | dependency | router 에 의해 생략 |
  | database | router 에 의해 생략 |
  | concurrency | router 에 의해 생략 |
  | api_contract | router 에 의해 생략 |