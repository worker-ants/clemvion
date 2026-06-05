# 데이터베이스(Database) 리뷰

## 발견사항

### [WARNING] raw SQL `ORDER BY` 에 동적 값 인터폴레이션
- 위치: `/codebase/backend/src/scripts/generate-golden-set.ts` line 185, 186–194
- 상세: `ORDER BY ${orderBy}` 에서 `orderBy` 는 `order === 'id' ? 'id' : 'random()'` 로 두 가지 상수 중 하나를 선택하므로 현재 외부 입력이 그대로 흘러들어가는 구조는 아니다. 그러나 패턴 자체는 문자열 인터폴레이션이며, 향후 `--order` 값이 확장되거나 다른 개발자가 동일 패턴을 참고해 입력 값을 직접 인터폴레이션하면 즉시 SQL injection 취약점이 된다. 이전 리뷰(RESOLUTION #16)에서 보류로 처리됐으나, 데이터베이스 관점에서 별도로 기록한다.
- 제안: `if (order === 'random') { query 1 } else { query 2 }` 처럼 쿼리 전체를 분기하거나, `const ALLOWED_ORDERS = { random: 'random()', id: 'id' } as const` 화이트리스트 const 맵으로 대체해 인터폴레이션 패턴을 제거한다.

---

### [WARNING] `resolveWorkspace` 배치 조회 미적용 — N개 kbId 시 N번 개별 쿼리 왕복
- 위치: `/codebase/backend/src/scripts/eval-retrieval.ts` line 147–163 (`resolveWorkspace`)
- 상세: `wsCache` Map 으로 동일 kbId 중복 쿼리는 방지된다(Promise 캐싱 적용 완료, RESOLUTION #11). 그러나 골든셋에 신규 kbId 가 N개면 여전히 N번 개별 `SELECT workspace_id FROM knowledge_base WHERE id = $1` 가 각각 실행된다. `pLimit(4)` 동시성으로 4개 왕복이 병렬 처리되지만 최초 조회 왕복 횟수 자체는 줄지 않는다. 실 골든셋이 수십~수백 entry 규모이고 kbId 종류가 소수인 현재는 문제가 없으나, 다양한 KB를 대상으로 하는 대규모 골든셋에서는 불필요한 왕복이 증가한다.
- 제안: 스크립트 시작 시 `goldenSet.entries` 에서 고유 kbId 집합을 추출한 뒤 `SELECT id, workspace_id FROM knowledge_base WHERE id = ANY($1::uuid[])` 로 한 번에 조회해 `wsCache` 를 선채우기(pre-warm)한다. N번 왕복을 1번으로 줄일 수 있다.

---

### [INFO] raw SQL 파라미터 바인딩 — SQL injection 직접 위험 없음
- 위치: `/codebase/backend/src/scripts/eval-retrieval.ts` line 155–158; `/codebase/backend/src/scripts/generate-golden-set.ts` line 186–194
- 상세: 두 스크립트 모두 TypeORM `DataSource.query()` 의 파라미터 바인딩(`$1`, `$2`, `$3`) 을 사용하므로 외부 입력이 SQL에 직접 삽입되지 않는다. `kbId`, `minChars`, `sample` 값은 모두 바인딩 파라미터로 전달된다. SQL injection 직접 취약점은 없다.
- 제안: 추가 조치 불필요. 단, `ORDER BY` 인터폴레이션 패턴은 위 WARNING 참조.

---

### [INFO] `document_chunk` 샘플링 쿼리 — 인덱스 활용 적절
- 위치: `/codebase/backend/src/scripts/generate-golden-set.ts` line 186–194
- 상세: `WHERE knowledge_base_id = $1 AND char_length(content) >= $2 ORDER BY random() LIMIT $3` 쿼리는 `knowledge_base_id` 컬럼 인덱스 존재 여부에 따라 성능이 크게 달라진다. `document_chunk` 테이블에 `knowledge_base_id` 인덱스가 있다면 필터링 후 `random()` 정렬이므로 허용 범위다. `char_length(content) >= $2` 조건은 함수 조건이어서 인덱스 활용이 어렵지만, KB 필터로 후보군을 충분히 좁힌 뒤 적용되므로 실질 부하는 낮다. eval 전용 스크립트이므로 운영 쿼리 성능과 직접 관련은 없다.
- 제안: 추가 조치 불필요. 단, `knowledge_base_id` 컬럼 인덱스 존재 여부를 확인해 두는 것이 권장된다.

---

### [INFO] 커넥션 관리 — `app.close()` finally 블록 보장
- 위치: `/codebase/backend/src/scripts/eval-retrieval.ts` line 274–276; `/codebase/backend/src/scripts/generate-golden-set.ts` line 324–326
- 상세: 두 스크립트 모두 `try { ... } finally { await app.close(); }` 패턴으로 NestJS 애플리케이션 컨텍스트를 종료한다. `app.close()` 는 TypeORM DataSource 를 포함한 모든 NestJS 프로바이더의 `onModuleDestroy` 훅을 호출해 DB 커넥션 풀을 정상 반환한다. 예외 발생 시에도 `finally` 보장으로 커넥션 누수가 없다.
- 제안: 추가 조치 불필요.

---

### [INFO] 트랜잭션 미사용 — eval 스크립트의 READ-ONLY 특성
- 위치: `/codebase/backend/src/scripts/eval-retrieval.ts` 전체; `/codebase/backend/src/scripts/generate-golden-set.ts` line 186–194
- 상세: `eval-retrieval.ts` 는 DB 읽기(`knowledge_base` 조회)만 수행하고 쓰기는 파일(`golden.json`)에만 한다. `generate-golden-set.ts` 도 `document_chunk` 읽기만 수행하며 DB 쓰기가 없다. 따라서 트랜잭션 없음이 올바른 설계다.
- 제안: 추가 조치 불필요.

---

### [INFO] 마이그레이션 — 신규 스키마 변경 없음
- 위치: 변경 파일 전체
- 상세: 이번 변경은 eval 하베스 도입이며 신규 테이블, 컬럼 추가, 인덱스 변경 등 DB 스키마 변경이 전혀 없다. 기존 `document_chunk`, `knowledge_base` 테이블의 read-only 접근만 수행한다. `EvalCliModule` 의 `synchronize: false` 설정이 명시적으로 스키마 자동동기화를 비활성화하고 있어 의도치 않은 스키마 변경 위험도 없다.
- 제안: 추가 조치 불필요.

---

## 요약

이번 변경은 RAG 평가 하베스 신규 도입으로 DB 스키마 변경이 없고 기존 테이블(`document_chunk`, `knowledge_base`)에 대한 read-only raw SQL만 사용한다. TypeORM 파라미터 바인딩이 적용되어 SQL injection 직접 위험은 없으며, 커넥션은 `finally` 블록의 `app.close()` 로 안전하게 반환된다. 주요 지적 사항은 두 가지다: (1) `generate-golden-set.ts` 의 `ORDER BY ${orderBy}` 문자열 인터폴레이션 패턴은 현재 상수 2개만 사용해 실질 위험은 없으나 화이트리스트 const 맵이나 쿼리 분기로 패턴을 강화하는 것이 권장된다. (2) `eval-retrieval.ts` 의 `resolveWorkspace` 는 kbId 별 개별 쿼리 발행 구조로, 다수 kbId 를 포함하는 대규모 골든셋에서 `WHERE id = ANY($1)` 배치 조회로 전환하면 왕복 횟수를 줄일 수 있다. 전반적으로 eval 전용 CLI 스크립트의 DB 사용 방식은 적절하며 운영 서비스에 직접 영향을 주는 위험은 없다.

## 위험도

LOW
