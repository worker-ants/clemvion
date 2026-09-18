# 유지보수성(Maintainability) Review

## 리뷰 범위 메모

이번 diff 는 실질적으로 애플리케이션 코드 변경이 없다 — DB 마이그레이션 5쌍(V112~V116 `.sql`/`.conf`), e2e 스키마 검증 테스트 1개, 그리고 spec/plan 문서 갱신이 전부다(파일 1~13, 31~34). `review/consistency/2026/09/18/{13_44_08,13_55_55}/**`(파일 14~30)는 `/consistency-check` 가 생성한 자동 산출물(리포트·`meta.json`·`_retry_state.json`·`_target` 스냅샷)이며 저장 위치도 컨벤션대로다 — 유지보수 대상 소스가 아니라 감사 증거물이라 가독성·네이밍 등 코드 품질 기준을 적용하지 않았다.

## 발견사항

- **[INFO]** 5개 마이그레이션 헤더 주석에 동일한 벤치마크 표가 그대로 복제됨
  - 위치: `codebase/backend/migrations/V112__node_execution_node_id_index.sql:10-12`, `V113__integration_usage_log_node_execution_id_index.sql:10-12`, `V114__integration_usage_log_workflow_id_index.sql:10-12`, `V115__llm_usage_log_node_execution_id_index.sql:10-12`, `V116__llm_usage_log_execution_id_index.sql:10-12` (각 파일의 "800k node_execution 규모 실측 … (V112 · V113 · V115 · V116 넷을 둔 측정 …)" 3줄 블록)
  - 상세: 다섯 파일이 하나의 공유 벤치마크 실행(동일 규모·동일 결과 표)에서 나온 수치이므로 헤더에 같은 문단이 글자 그대로 5회 복제됐다. Flyway 마이그레이션은 append-only·자기완결(파일 간 참조 불가, `migrations/README.md` §5)이어야 하므로 이 중복은 의도된 설계 트레이드오프이지 실수가 아니다 — V111 선례도 같은 자기완결 원칙을 따른다. 다만 이 공유 수치에 훗날 정정이 필요해지면(예: 재측정으로 오차 발견) 5개 파일을 手동으로 동시에 고쳐야 하고, 이를 강제하는 장치는 없다 — 마이그레이션은 머지 후 불변이라 실제로 고칠 일은 드물겠지만, `spec/1-data-model.md` `## Rationale`(S3)이 이미 이 표의 SoT 사본을 갖고 있으므로 두 곳(spec 1곳 + 마이그레이션 5곳)이 실질적 SoT가 된다.
  - 제안: 조치 불요(현재 컨벤션·V111 선례와 일관) — 다만 향후 이 수치를 정정할 일이 생기면 "5개 마이그레이션 헤더 + spec Rationale" 전부를 동시에 훑는다는 점을 인지해 둘 것.

- **[INFO]** e2e 인덱스 정의 정규식이 끝(`$`)만 고정하고 시작을 고정하지 않음
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:22-40` (`EXPECTED` 배열의 `def: RegExp` 다섯 항목)
  - 상세: 각 정규식이 `ON public.<table> USING btree (...)$` 형태로 문자열 끝만 고정한다. `indisvalid` 단언과 결합돼 있어 실질적 결함 포착력은 충분하지만, 만약 `pg_get_indexdef` 출력에 예상 밖 접두(예: `UNIQUE`, 다른 tablespace 절)가 섞여도 이 정규식은 여전히 통과한다 — 가독성보다는 방어적 엄격함의 사소한 여지다.
  - 제안: 필수 아님 — 원한다면 `^CREATE (UNIQUE )?INDEX .* ON public\.` 형태로 접두까지 고정해 의도를 더 명시할 수 있다.

## 요약

변경분의 대부분이 self-contained 마이그레이션 파일·파라미터화된 e2e 테스트(`it.each`로 5개 케이스를 중복 없이 처리)·spec/plan 문서라 가독성·네이밍·함수 길이·중첩·복잡도 축에서 지적할 거리가 거의 없다. 인덱스 명명(`idx_<table>_<column>`)·마이그레이션 절차(비-트랜잭션 `.conf`, DROP-먼저 CONCURRENTLY)·문서 앵커까지 기존 코드베이스 선례(V008·V014·V111)와 정확히 일치해 일관성이 높다. 유일하게 주목할 점은 다섯 마이그레이션 헤더에 같은 벤치마크 표가 복제된 것인데, 이는 Flyway 자기완결 파일 컨벤션에 따른 의도된 설계이지 리팩터링 대상이 아니다.

## 위험도
LOW
