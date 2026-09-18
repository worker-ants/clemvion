# 부작용(Side Effect) 리뷰 — FK 인덱스 V121~V130 + 관련 문서

## 발견사항

- **[INFO]** 신규 인덱스가 `model_config` 테이블의 플래너 선택지를 넓혀 무관한 쿼리의 실행계획에도 영향을 줄 수 있음
  - 위치: `codebase/backend/migrations/V130__model_config_workspace_kind_index.sql` (`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_config_workspace_kind ON model_config (workspace_id, kind);`)
  - 상세: 기존 `model_config_workspace_kind_default_unique`(V089, `WHERE is_default = true`)는 partial 이라 `is_default` 조건이 없는 쿼리가 쓰지 못했다. 이번에 조건 없는 `(workspace_id, kind)` 풀 인덱스를 추가하면 그 컬럼 조합을 건드리는 다른(문서에 명시되지 않은) 쿼리의 플래너 선택도 함께 바뀔 수 있다 — 일반적으로 이롭지만 "이 PR 이 의도한 조회 두 곳(목록·FK)" 밖의 쿼리 계획 변화까지는 실측·서술 범위에 없다. 기능적 회귀는 아니며 통상적인 인덱스 추가의 부수효과라 CRITICAL/WARNING 은 아니다.
  - 제안: 별도 조치 불필요. 인덱스 추가가 늘 동반하는 성격의 부수효과로, 실제 문제가 관측되면 그때 대응.

- **[INFO]** `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 사이의 짧은 창에서 해당 컬럼 조회가 인덱스 없이 수행됨
  - 위치: 10개 마이그레이션 전부(`V121`~`V130` 각 `.sql`) 공통 패턴
  - 상세: 최초 배포 시 대상 인덱스는 아직 존재하지 않으므로 DROP 은 no-op — 실질적 창은 없다. 다만 문서(`migrations/README.md §5`, 각 파일 헤더 주석)가 밝힌 대로 "이전 실패로 남은 invalid 인덱스를 정리"하는 repair-재실행 시나리오에서는, DROP 이후 CREATE 가 끝나기 전까지(대형 테이블일수록 CONCURRENTLY 빌드 시간이 김 — 특히 `edge`/`llm_usage_log` 는 실측상 90만~200만 행) 해당 FK 트리거·조회 경로가 순간적으로 인덱스 없는 상태로 되돌아간다. 이는 V111~V120 에서 이미 확립된 동일 패턴이라 이번 PR 이 새로 도입한 리스크는 아니며, `executeInTransaction=false` + `IF EXISTS`/`IF NOT EXISTS` 가드로 반복 실행 안전성은 확보돼 있다.
  - 제안: 조치 불필요(기존 선례와 동일). repair 재실행이 실제로 필요해지는 시점에 트래픽이 적은 시간대를 고르는 것은 운영 절차의 몫이며 이 diff 의 결함이 아니다.

## 점검 관점별 확인 (해당 없음 확인)

- **의도치 않은 상태 변경 / 전역 변수**: 해당 diff 는 순수 DDL(SQL/`.conf`)과 마크다운 문서뿐이다. 애플리케이션 코드(서비스·컨트롤러·엔티티) 변경이 전혀 없어 전역/공유 상태를 건드리는 함수가 없다. `git diff --stat origin/main -- codebase/` 로 실측 확인 — 변경된 21개 파일 전부 `migrations/V121~V130` 10쌍 + `test/deletion-cascade-indexes.e2e-spec.ts` 하나뿐, 다른 코드 경로 없음.
- **파일시스템 부작용**: 신규 마이그레이션 파일 10쌍은 의도된 산출물. `review/consistency/2026/09/18/**`·`review/code/2026/09/18/**` 산출물도 이 저장소 관례(`CLAUDE.md` 리뷰 산출물 저장 위치)가 요구하는 정상적인 워크플로 부산물이며 예기치 못한 파일 생성이 아니다.
- **시그니처 변경**: 없음. `deletion-cascade-indexes.e2e-spec.ts` 는 기존 `EXPECTED` 배열 항목(V112~V120)을 그대로 두고 10개 항목만 추가했다(diff 확인 — 기존 엔트리 삭제·수정 없음). `describe` 블록 제목만 `V112~V120`→`V112~V130` 로 바뀌었는데, 이는 테스트 스위트 이름표일 뿐 다른 코드가 이 문자열을 참조하지 않는다.
- **인터페이스 변경**: 없음. 신규 DB 인덱스 10개는 모두 조회 가속용 부가 인덱스로, 기존 UNIQUE 제약·API 응답·엔티티 스키마를 변경하지 않는다(`V130` 신규 인덱스와 기존 partial UNIQUE V089 의 이름·조건이 달라 공존함을 cross_spec 리뷰가 실측 확인).
- **환경 변수**: 없음.
- **네트워크 호출**: 없음.
- **이벤트/콜백**: 없음.
- **인덱스 이름 충돌**: `grep -h "CREATE INDEX CONCURRENTLY" V12[1-9]*.sql V130*.sql` 로 10개 인덱스 이름이 서로 겹치지 않고, `DROP`/`CREATE` 문 안의 이름도 파일별로 정확히 일치함을 직접 확인(오타로 인한 "엉뚱한 인덱스 드롭" 가능성 없음).

## 요약

이번 diff 는 순수 추가형(additive) DB 마이그레이션 10쌍(`V121`~`V130`, `CREATE INDEX CONCURRENTLY`/`.conf executeInTransaction=false`)과 그에 대응하는 e2e 단언 확장, 그리고 spec/plan/review 문서 갱신으로 구성되며 애플리케이션 코드·함수 시그니처·공개 API·환경 변수·네트워크 호출을 전혀 건드리지 않는다. `git diff --stat` 로 codebase 변경 범위를 재확인한 결과도 마이그레이션 파일과 테스트 파일 하나로 한정됐다. 유일하게 기록할 만한 점은 인덱스 추가가 통상 동반하는 부수효과(무관한 쿼리 플래너 선택 변화 가능성, DROP→CREATE 재실행 구간의 순간적 인덱스 부재)뿐이며 둘 다 V111~V120 선례와 동일한 패턴이라 이 PR 이 새로 도입한 리스크가 아니다. 저장소 파일을 뮤테이션하는 검증은 수행하지 않았으며(불필요 판단), `git status --short` 는 리뷰 시작 시점 그대로다.

## 위험도

NONE
