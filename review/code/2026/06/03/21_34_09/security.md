# Security Review

## 발견사항

### **[INFO]** PDF 파서: 사용자 제공 버퍼의 무제한 처리
- 위치: `codebase/backend/src/modules/knowledge-base/parsers/pdf.parser.ts` — `parsePdfSegments` / `parsePdf`
- 상세: `pdfParse(buffer, ...)` 에 업스트림에서 전달된 Buffer 를 그대로 넘긴다. pdf-parse 는 악성 PDF (embedded JS, 거대 오브젝트 트리, zip-bomb 형태의 압축 스트림)로 ReDoS 수준의 CPU 소비 또는 메모리 폭발을 유발할 수 있다. 기존 `parsePdf`도 동일 패턴이지만 이번 변경에서 페이지별 콜백(`pagerender`) 경로가 추가돼 attack surface 가 소폭 확대됐다. pdf-parse 자체에는 CVE 가 다수 보고된 이력이 있다 (현재 버전 확인 필요).
- 제안: (1) 업로드 단계에서 파일 크기·MIME 검증 강화, (2) pdf-parse 버전을 최신으로 고정하고 `npm audit` CI gate 유지, (3) 파싱 작업을 별도 워커/프로세스에서 실행하여 메인 프로세스 자원 고갈 차단.

### **[INFO]** Markdown 파서: 대용량·악의적 입력 처리 없음
- 위치: `codebase/backend/src/modules/knowledge-base/parsers/md.parser.ts` — `parseMdSegments`
- 상세: `buffer.toString('utf-8')` 후 줄 단위로 반복 처리하며 섹션 수·줄 수 상한이 없다. 단순 텍스트 처리라 RCE 위험은 없으나, 수백 MB 마크다운 파일이 투입되면 메모리 압박이 발생할 수 있다. 보안 영향은 낮으나 DoS 벡터로 분류된다.
- 제안: 업로드 레이어의 파일 크기 제한이 md 파일에도 일관 적용되는지 확인. 추가 방어가 필요하다면 `lines.length` 상한 조기 탈출을 고려한다.

### **[INFO]** `defaultOutputText` JSON.parse — 에러 처리 정확성
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` — `handleSave` 내 `JSON.parse(defaultOutputText)`
- 상세: `catch` 블록이 예외를 잡아 toast + 인라인 오류를 표시하고 저장을 차단한다. 구현 자체는 올바르다. 다만 `defaultOutputText` 가 클라이언트 측 state 이므로 저장된 값이 실제 백엔드로 전송될 때 서버 측에서도 `defaultOutput` 타입·구조를 재검증해야 한다. 현재 리뷰 범위(프론트엔드 패널)에서는 클라이언트-사이드 XSS 위험은 없다 — textarea 입력이 JSON.parse 후 직접 DOM 에 렌더링되지 않기 때문이다.
- 제안: 백엔드 실행 엔진이 `config.errorHandling.defaultOutput` 을 읽을 때 타입 제약(최대 깊이, 키 수) 검증이 있는지 확인한다.

### **[INFO]** ChunkMetadata spread — prototype pollution 가능성 낮음
- 위치: `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts` — `pushChunk`, `forceSplitAndPush`
- 상세: `metadata: { ...baseMetadata }` 로 shallow copy 한다. `baseMetadata` 는 `ChunkMetadata` 타입(`{ page?: number; section?: string }`)으로 엄격히 제한돼 있고, 파서가 직접 생성한 리터럴 객체를 전달하므로 prototype pollution 위험은 실질적으로 없다. 그러나 향후 `ChunkMetadata` 가 `Record<string, unknown>` 계열로 확장될 경우 `Object.assign` / spread 전에 키 화이트리스트 필터링을 고려해야 한다.
- 제안: 현재 코드는 안전하다. `ChunkMetadata` 인터페이스를 좁게 유지한다.

### **[INFO]** 표현식 컨텍스트에 boolean 플래그 직접 노출
- 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts` — `$itemIsFirst`, `$itemIsLast`
- 상세: `executionContext.itemContext?.isFirst` / `isLast` 를 표현식 컨텍스트에 그대로 전달한다. 이 값은 엔진 내부에서 계산된 boolean 이므로 외부 입력이 아니다. 인젝션·정보 노출 위험 없음. 다만 `$itemIsFirst`/`$itemIsLast` 가 `undefined` 일 때(itemContext 없음) 표현식 사용자가 `false` 로 잘못 가정할 수 있는 논리 오류 가능성이 있다 — 이는 보안보다 기능 버그 범주다.
- 제안: 문서(spec) 에 "ForEach 컨텍스트 밖에서는 undefined" 임을 명시한다 (이미 스펙에서 `scopeKey: "hasItem"` 로 필터링함).

## 요약

이번 변경은 대부분 테스트 추가, 스키마 메타데이터 확장(summaryTemplate), 표현식 컨텍스트 boolean 플래그 노출, 프론트엔드 에러 핸들링 UI 리팩터링, 그리고 임베딩 파이프라인의 문서 세그먼트별 metadata 전파 구현으로 구성된다. 하드코딩된 시크릿, SQL 인젝션, XSS, 커맨드 인젝션, 인증·인가 우회, 안전하지 않은 암호화 알고리즘, 민감 정보 에러 노출 등 주요 OWASP Top 10 취약점은 발견되지 않았다. 주의가 필요한 지점은 PDF 파서에서 외부 라이브러리(pdf-parse)를 통한 악성 입력 처리로, 이는 기존 `parsePdf` 경로부터 존재하던 구조적 이슈이며 이번 변경이 새로 도입한 취약점은 아니다. 전체적으로 보안 위험도는 낮다.

## 위험도

LOW
