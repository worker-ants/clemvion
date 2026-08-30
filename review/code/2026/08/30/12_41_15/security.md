### 발견사항

- **[INFO]** 신규 정적 스캐너(`hasRawUpdateReturning`)와 재귀 파일 탐색(`listSources`/`discover`)은 저장소 자체 소스 트리(`src/**`)만을 대상으로 하는 테스트 전용 코드다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:93` (`hasRawUpdateReturning`), `codebase/backend/src/common/utils/update-returning-rows.spec.ts:165`·`184` (`listSources`/`discover`)
  - 상세: `readdirSync`/`readFileSync` 의 입력 경로가 `join(__dirname, '..', '..')` 로 고정되고 이후 재귀 시 `readdirSync` 가 돌려주는 실제 디렉터리 엔트리만 이어붙인다 — 외부(사용자) 입력이 경로 구성에 개입할 여지가 없어 경로 탐색(path traversal) 표면이 아니다. 정규식(`CALL = /\.query\s*(?:<[^>]*>)?\s*\(\s*(...)/g` 등)도 중첩 정량자가 없는 선형 패턴이라 ReDoS 형태가 아니며, 설령 있었더라도 입력이 신뢰된 1st-party 소스 파일뿐이라 공격 표면이 되지 않는다. Jest 스펙/`__test-utils__` 로 프로덕션 번들에 포함되지 않는다(파일 상단 docstring: "jest 타입 비의존… 순수 함수만 둔다").
  - 제안: 조치 불요 — 참고 기록.

- **[INFO]** `kb-stats.helper.ts` 의 실질 변경은 `dataSource.query<...>()` 의 **제네릭 타입 인자**뿐이며 SQL 리터럴·파라미터 바인딩은 그대로다.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:36` (`await this.dataSource.query<...>`)
  - 상세: SQL 은 `$1` placeholder + `[knowledgeBaseId]` 파라미터 배열로 이미 파라미터화돼 있어 SQL 인젝션 경로가 없다. 변경은 `{ entity_count, relation_count }[]` → `[{ entity_count, relation_count }[], number]` 로, TypeORM 이 `UPDATE … RETURNING` 에 실제로 `[rows, affectedCount]` 튜플을 돌려주는 런타임 shape 을 정확히 반영하는 컴파일 타임 단언 정정이다. 반환값은 여전히 소비되지 않는다(`await` 만, 대입 없음) — 런타임 동작 변화 없음.
  - 제안: 조치 불요.

- **[정보 확인 — 발견 없음]** 하드코딩된 시크릿, 인증/인가 로직, 암호화 처리, 에러 메시지의 민감정보 노출 경로가 이번 diff 범위(`source-scan.ts`, `update-returning-rows.spec.ts`, `kb-stats.helper.ts`, plan 문서, consistency 리뷰 산출물)에 없다. `review/consistency/2026/08/30/12_17_21/**` 는 이전 세션이 생성한 정적 검토 보고서(마크다운/JSON)이며 로컬 절대경로 외에 비밀값·자격증명은 포함돼 있지 않다.

### 요약

이번 변경은 애플리케이션의 사용자 입력 처리 경로를 건드리지 않는다 — (1) 저장소 자체 소스를 스캔하는 테스트 전용 정적 가드 신설(`hasRawUpdateReturning` + 전수 탐색 스펙), (2) 기존에 이미 파라미터화된 SQL 쿼리의 TypeScript 제네릭 타입 인자를 실제 런타임 shape(튜플)에 맞게 정정한 것, (3) plan 문서와 consistency 리뷰 산출물(문서/JSON) 갱신이 전부다. 신규 코드가 다루는 입력은 전부 신뢰된 1st-party 소스 파일이라 인젝션·경로 탐색·ReDoS 등 통상적 공격 표면이 성립하지 않으며, 시크릿 하드코딩·인증/인가 변경·평문 전송·에러 정보 노출도 관측되지 않았다.

### 위험도

NONE
