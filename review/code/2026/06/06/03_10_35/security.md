# 보안(Security) 리뷰

## 발견사항

### [INFO] SQL 인젝션 — ORDER BY 동적 인터폴레이션 (이전 라운드 대비 개선 확인)
- 위치: `/codebase/backend/src/scripts/generate-golden-set.ts` line 185, 191
- 상세: `orderBy` 변수는 `order === 'id' ? 'id' : 'random()'` 분기로 결정되어 외부 입력이 SQL에 직접 삽입되지 않는다. 이전 라운드(#16)에서 보류된 항목이며 현재 구현은 실질적 SQL 인젝션 위험이 없다. `kbId`, `minChars`, `sample` 파라미터는 parameterized query(`$1`, `$2`, `$3`)로 전달되어 안전하다.
- 제안: 패턴 자체의 미래 확장 위험을 막기 위해 `const ORDER_BY_MAP: Record<'id' | 'random', string> = { id: 'id', random: 'random()' }` 형태의 화이트리스트 const 매핑을 추가하는 것을 권장하나, 현재는 차단 수준이 아니다.

---

### [INFO] SQL 인젝션 — workspace 조회 raw SQL (eval-retrieval.ts)
- 위치: `/codebase/backend/src/scripts/eval-retrieval.ts` line 155-158
- 상세: `SELECT workspace_id FROM knowledge_base WHERE id = $1` 쿼리는 파라미터화(`[kbId]`)되어 있다. 또한 `kbId` 는 `UUID_RE` 정규식으로 사전 검증(line 149)되어 UUID 형식이 아닌 값은 쿼리에 도달하지 않는다. 이중 방어가 잘 구현되어 있다.
- 제안: 없음.

---

### [INFO] 경로 탐색(Path Traversal) — --out 플래그 경계 가드 적용 확인
- 위치: `/codebase/backend/src/scripts/eval-retrieval.ts` line 129-135
- 상세: `--out` 플래그 값은 `resolve(process.cwd(), outPath)` 후 `outAbs.startsWith(resolve(process.cwd()))` 검사를 거친다. `../../../etc/passwd` 형태의 경로 탐색 시도를 차단한다. 이전 라운드 보안 수정(#5)이 적용된 결과다.
- 제안: `resolve(process.cwd())` 는 trailing slash 없이 비교하므로 `/tmp/eval` CWD 상황에서 `/tmp/eval-evil`도 통과할 가능성이 이론적으로 있다. 보다 엄밀한 검사: `outAbs.startsWith(resolve(process.cwd()) + '/')` 또는 `path.relative(cwd, outAbs)` 가 `..`으로 시작하지 않는지 확인하는 방식을 권장한다. CLI 스크립트 특성상 즉각 차단 수준은 아니다.

---

### [WARNING] 에러 메시지에 err.message 노출 — generate-golden-set.ts
- 위치: `/codebase/backend/src/scripts/generate-golden-set.ts` line 272-274
- 상세: 청크 LLM 생성 실패 시 `const msg = err instanceof Error ? err.message : String(err)` 후 `console.warn(`청크 ${chunk.id} 생성 실패: ${msg}`)` 로 출력한다. `LlmService.chat()`에서 던지는 에러 메시지에 내부 API 엔드포인트, 응답 본문의 민감 필드(API 키 접두어 등)가 포함될 경우 터미널 출력/로그에 노출될 수 있다. `eval-retrieval.ts` catch 블록(이전 라운드 보안 수정 #8)과 달리 이 파일은 `err.message`를 그대로 출력한다.
- 제안: `eval-retrieval.ts`와 동일하게 ErrorConstructor 이름만 출력하도록 통일:
  `const kind = err instanceof Error ? err.constructor.name : 'UnknownError';`
  `console.warn(\`청크 ${chunk.id} 생성 실패: [${kind}]\`);`

---

### [INFO] 하드코딩된 시크릿 없음 확인
- 위치: 전체 변경 파일
- 상세: DB 접속 정보(`host`, `port`, `username`, `password`, `database`)는 모두 `ConfigService`를 통해 환경 변수에서 읽는다(`eval-cli.module.ts` line 40-44). LLM API 키 역시 `LlmService.resolveConfig()`를 통해 DB/환경 변수에서 가져온다. `golden.example.json`의 ID 값은 모두 nil UUID 패턴(`00000000-...`)으로 더미다. README의 `.env` 예시도 `...` 플레이스홀더만 포함한다. 코드 내 하드코딩된 시크릿 없음.
- 제안: 없음.

---

### [INFO] 에러 처리 — eval-retrieval.ts의 sanitize 확인
- 위치: `/codebase/backend/src/scripts/eval-retrieval.ts` line 192-194, line 280-281
- 상세: 검색 실패 catch 블록과 최상위 catch 모두 `err.constructor.name`만 출력하여 DB 연결 문자열, API 키 접두어 등이 노출되지 않는다. 이전 라운드 보안 수정(#8)이 올바르게 적용되었다.
- 제안: 없음.

---

### [INFO] 입력 검증 — 골든셋 JSON zod 스키마 검증 적용 확인
- 위치: `/codebase/backend/src/scripts/eval-retrieval.ts` line 44-113
- 상세: `GoldenSetSchema`(zod)로 파일 로드 시 런타임 스키마 검증이 이루어진다. `knowledgeBaseId`는 UUID 정규식 검증이 포함되어 있으며, `entries` 배열 각 항목의 필수 필드가 검증된다. 이전 라운드 보안 수정(#6, #7)이 적용되어 있다.
- 제안: 없음.

---

### [INFO] 인증/인가 — CLI 스크립트 특성상 적용 범위 외
- 위치: 전체 CLI 스크립트
- 상세: 두 스크립트는 서버 프로세스가 아닌 CLI 도구로, 직접 실행 권한을 가진 개발자/운영자가 로컬에서 실행한다. 별도의 세션/토큰 인증 레이어가 없는 것은 설계 의도에 부합한다. DB 접속 자격증명은 `.env` 파일에서 가져오며 TypeORM 연결 풀을 사용한다.
- 제안: `.env` 파일 권한 관리(`chmod 600 .env`) 및 접근 로깅을 운영 정책으로 권장한다.

---

### [INFO] 암호화 — SHA-1 사용 (stableEntryId)
- 위치: `/codebase/backend/src/scripts/generate-golden-set.ts` line 86-96
- 상세: `stableEntryId` 함수에서 `createHash('sha1')`을 사용한다. SHA-1은 암호학적으로 취약하지만, 여기서의 용도는 `(kbId, chunkId, normalizedQuestion)` 튜플의 안정적 16자리 식별자 생성이며 보안 목적(패스워드 해시, 서명, HMAC)이 아니다. 충돌 저항성이 강력한 암호 해시는 필요하지 않은 내용 주소 식별자 용도다.
- 제안: `// content-address identifier, not security hash` 주석 추가로 의도를 명확히 하는 것을 권장. 보안 강화를 원하면 SHA-256으로 교체 가능하나 현재 용도에서 필수는 아니다.

---

### [INFO] gitignore — 고객 데이터 커밋 방지 확인
- 위치: `/codebase/backend/.gitignore`
- 상세: `eval/golden.json` 및 `eval/*.report.json`이 gitignore에 추가되어 실제 고객 문서 파편을 포함할 수 있는 파일이 git에 커밋되지 않도록 차단한다. `eval/golden.example.json`은 nil UUID 더미 데이터만 포함하므로 커밋 안전하다.
- 제안: 없음.

---

### [INFO] OWASP A05:2021 Security Misconfiguration — synchronize:false 확인
- 위치: `/codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts` line 49
- 상세: TypeORM `synchronize: false`가 명시되어 있어 CLI 부팅 시 자동 스키마 동기화(DDL)가 발생하지 않는다. 운영 DB에 의도치 않은 스키마 변경이 발생하지 않는다.
- 제안: 없음.

---

### [INFO] 의존성 보안 — 신규 외부 패키지 추가 없음
- 위치: `codebase/backend/package.json`
- 상세: 이번 변경에서 신규 외부 패키지가 추가되지 않았다. `p-limit`, `ts-node`, `tsconfig-paths`, `zod`는 기존 의존성이다. `lang-detect.ts`와 `retrieval-metrics.ts`는 순수 TypeScript로 구현되어 외부 NLP/수치 라이브러리 의존이 없다.
- 제안: 없음.

---

## 요약

이번 변경(RAG 평가 하네스)은 CLI 개발 도구 성격의 코드로, 이전 라운드에서 경로 탐색 방지(#5), zod 런타임 스키마 검증(#6), UUID 사전 검증(#7), 에러 메시지 sanitize(#8) 등 주요 보안 항목이 이미 적용되었다. 현재 코드 기준 유일한 WARNING 이슈는 `generate-golden-set.ts`의 청크 생성 실패 catch 블록에서 `err.message`를 그대로 출력하는 부분이다 — LLM 서비스 에러에 내부 엔드포인트나 API 키 접두어가 포함될 경우 로그로 유출될 수 있어 `eval-retrieval.ts`와 동일한 패턴(`err.constructor.name` 출력)으로 통일하는 것이 권장된다. 그 외 `--out` 경로 비교의 trailing-slash 엣지 케이스, SQL ORDER BY 화이트리스트 명시화, SHA-1 주석 추가는 INFO 수준의 사항이다. 하드코딩된 시크릿, SQL 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘 남용 등 고위험 취약점은 발견되지 않았다.

## 위험도

LOW
