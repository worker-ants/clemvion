# 보안(Security) 리뷰

## 발견사항

### [WARNING] CLI 인자로 전달된 파일 경로를 검증 없이 fs 접근에 사용
- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` — `goldenPath` 및 `outPath` 구성 부분
- 상세: `parseCliFlag('--golden')` 와 `parseCliFlag('--out')` 의 반환값을 `resolve(process.cwd(), ...)` 에 그대로 넘겨 `readFileSync` / `writeFileSync` 를 호출한다. 절대 경로 형식(`/etc/passwd`, `../../sensitive`) 이 입력되면 `resolve()` 가 그대로 사용하여 경로 탐색(path traversal)이 가능하다. 본 스크립트는 내부 developer 도구이므로 위협 벡터가 제한적이나, 공유 CI 환경에서 파라미터 조작이 가능한 경우 민감 파일 읽기/덮어쓰기가 발생할 수 있다.
- 제안: 경로를 허용 디렉터리 내부인지 확인한 후 접근한다. 예: `outAbs.startsWith(resolve(process.cwd()))` 가드 추가. 또는 허용 디렉터리 목록(`eval/`, `dist/`) 을 화이트리스트로 제한한다.

### [WARNING] 골든셋 JSON 파일을 파싱 시 스키마 검증 없이 신뢰
- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` — `JSON.parse(readFileSync(goldenPath, 'utf8')) as GoldenSet`
- 상세: `as GoldenSet` 은 TypeScript 컴파일 타임 캐스팅으로 런타임 검증이 없다. 악의적이거나 손상된 `golden.json` 이 `entries` 필드에 예상 밖의 타입(예: `query` 에 SQL-like 문자열, `knowledgeBaseId` 에 UUID 형식 외 문자열)을 포함해도 그대로 `RagSearchService.searchWithMeta()` 에 전달된다. 특히 `knowledgeBaseId` 는 이후 `SELECT workspace_id FROM knowledge_base WHERE id = $1` 의 파라미터로 흘러가므로, 파라미터바인딩이 TypeORM raw query 로 처리되고 있어 SQL 인젝션 직접 위험은 낮지만 예상치 못한 UUID 길이/형식이 DB 에러를 유발하거나 error 메시지로 내부 정보를 노출할 수 있다.
- 제안: `zod` 가 이미 의존성으로 포함되어 있으므로 `GoldenSet` 스키마를 zod 로 정의하고 `safeParse()` 로 런타임 검증 후 진행한다. `knowledgeBaseId` 는 UUID 형식 검증 추가를 권장한다.

### [WARNING] raw SQL 쿼리에서 kbId 파라미터 타입 미검증 후 전달
- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` — `resolveWorkspace` 함수 내 `dataSource.query('SELECT workspace_id FROM knowledge_base WHERE id = $1', [kbId])`
- 상세: TypeORM `DataSource.query()` 는 파라미터 바인딩을 사용하므로 SQL 인젝션 직접 취약점은 아니다. 그러나 `kbId` 는 골든셋 JSON 에서 읽어온 임의 문자열이며, UUID 형식 검증이 없어 형식이 맞지 않을 경우 DB 드라이버 에러가 발생하고 해당 에러가 `console.warn` 을 통해 stdout 에 노출된다. 에러 메시지에 DB 내부 정보(테이블명·컬럼명·쿼리 계획 일부)가 포함될 수 있다.
- 제안: `kbId` 를 UUID 정규식(`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`)으로 사전 검증하고, 검증 실패 시 해당 entry 를 skip 처리한다.

### [WARNING] 에러 메시지에서 내부 정보 노출 가능성
- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` — catch 블록: `console.warn(`entry ${entry.id} 검색 실패: ${msg}`)`
- 상세: `err.message` 를 그대로 stdout 에 출력한다. DB 연결 오류, ORM 쿼리 실패, LLM API 에러 등에서 DB 호스트명, 쿼리 내용, API 키 접두어, 내부 stack trace 등이 포함된 에러 메시지가 CI 로그에 노출될 수 있다.
- 제안: 에러 메시지를 그대로 출력하지 않고 에러 유형만 분류하여 출력하거나, DB/API 에러 유형별 sanitize 를 고려한다. 단기적으로는 현재 `err instanceof Error ? err.message : String(err)` 수준을 유지하되 stack trace 는 제거한다.

### [INFO] `generate-golden-set.ts` 가 binary diff 로만 표시됨 — 내용 검토 불가
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts`
- 상세: 본 리뷰에서 `generate-golden-set.ts` 의 실제 코드를 검토하지 못했다. 이 스크립트는 `LlmService.chat()` 호출, KB 청크 접근, 파일 쓰기를 수행하는 것으로 plan 에 기술되어 있어 보안상 중요한 코드 경로를 포함한다. 특히 `--workspace-id`, `--kb-id` CLI 인자를 DB 쿼리에 사용하는 경우, 동일한 경로 탐색/인자 검증 취약점이 존재할 수 있다.
- 제안: `generate-golden-set.ts` 의 텍스트 diff 가 포함된 별도 리뷰를 수행하거나, 최소한 CLI 인자(특히 `--workspace-id`, `--kb-id`, `--out`)의 UUID 형식 검증 및 출력 경로 검증이 구현되어 있는지 확인한다.

### [INFO] 평가 리포트 출력 파일이 `.gitignore` 에 glob 패턴으로 처리됨 — 실 데이터 노출 방지 적절
- 위치: `codebase/backend/.gitignore` — `eval/golden.json`, `eval/*.report.json`
- 상세: 고객 데이터 파편을 포함할 수 있는 파일이 `.gitignore` 로 정상 처리되어 있다. README 에도 커밋 정책이 명확히 기술되어 있다. 보안적으로 올바른 처리다.
- 제안: 추가로 `eval/golden.json` 이 실수로 git staging 에 포함되는 것을 방지하기 위해 pre-commit hook 에서 해당 파일 존재 여부를 검사하는 것을 고려한다.

### [INFO] `golden.example.json` 내 예시 데이터는 실 민감 데이터 아님 — 정상
- 위치: `codebase/backend/eval/golden.example.json`
- 상세: 예시 파일의 `knowledgeBaseId` 는 모두 nil UUID(`00000000-...`), `goldChunkIds` 도 더미 UUID 를 사용하고 있어 실 고객 데이터가 포함되지 않았음이 확인된다.
- 제안: 없음.

### [INFO] `EvalCliModule` DB 연결이 환경 변수 기반으로 올바르게 구성됨
- 위치: `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts`
- 상세: DB 자격증명이 `ConfigService` + `.env` 를 통해 주입되며 코드에 하드코딩된 값은 없다. `synchronize: false` 로 스키마 자동 변경이 비활성화되어 있어 운영 DB 에 대한 스키마 손상 위험이 없다.
- 제안: 없음.

---

## 요약

이번 변경은 RAG 평가 하베스(골든셋 생성 + 검색 지표 측정)를 위한 내부 CLI 도구 및 평가 라이브러리 추가다. 보안 위험의 핵심은 두 가지로 압축된다. 첫째, eval-retrieval 스크립트가 CLI 인자로 받은 파일 경로와 JSON 에서 파싱한 `knowledgeBaseId` 값을 충분히 검증하지 않고 파일시스템 접근 및 DB 쿼리에 사용한다(경로 탐색 및 런타임 오류 유발 가능). 둘째, 에러 핸들링에서 내부 에러 메시지가 stdout/CI 로그에 그대로 노출된다. 하드코딩된 시크릿, 인증 우회, SQL 인젝션(파라미터 바인딩으로 직접 취약점 없음) 등의 중대 취약점은 확인되지 않는다. `generate-golden-set.ts` 가 binary diff 로만 제공되어 완전한 검토가 불가능한 점은 별도 검증이 필요하다. 해당 스크립트가 내부 개발자 도구이며 외부 API 엔드포인트가 아닌 점을 고려하면 전반적인 위험도는 낮지만, CI 파이프라인 통합 전 경로 검증과 zod 런타임 스키마 검증을 추가하는 것이 권장된다.

---

## 위험도

LOW
