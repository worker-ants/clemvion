# Rationale 연속성 검토

## 검토 범위 확인

- 지정 target(`spec/conventions/`)의 diff-base(`origin/main`) 대비 실제 변경 파일은 **0개**다. `spec/conventions/migrations.md` 를 포함해 이 디렉토리는 이번 변경에서 손대지 않았다 — 이 자체는 CRITICAL 근거가 아니다(코드 전용 PR).
- 그러나 프롬프트의 "(main 추가) scope 밖 spec 과 구현" 절이 지목한 실제 spec-연결 변경은 `spec/1-data-model.md`(§3 인덱스 표, §2.10.1, §2.24, `## Rationale` 신설 두 항목)과 `spec/data-flow/{3-execution,5-integration,7-llm-usage}.md` 의 sink 표, 그리고 `codebase/backend/migrations/V112~V116` (5쌍) + `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` 다. 이 범위를 실제로 대조했다.

## 발견사항

이 범위에서 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회는 **발견되지 않았다.**

- **[INFO] 이전에 유보된 결정(쓰기비용 트레이드오프)의 재검토 — 모범 사례**
  - target 위치: `spec/1-data-model.md` `## Rationale` 신설 "삭제 연쇄의 FK 인덱스 다섯 (2026-09-18)"
  - 과거 결정 출처: 같은 문서 `## Rationale` "Trigger `(workflow_id)` 인덱스 (2026-09-18)" — "`integration_usage_log` 는 로그 테이블이라 행 수가 가장 클 수 있지만, INSERT 가 잦은 테이블에 인덱스를 더하는 것은 쓰기 비용과 맞바꾸는 판단이라 따로 잰다."
  - 상세: 이번 변경(V114)은 그 절이 유보했던 `integration_usage_log.workflow_id` 인덱스를 실제로 추가한다. 이것은 "결정의 무근거 번복"(관점 3)에 해당할 수 있는 패턴이지만, 새 Rationale 이 (a) 옛 절을 명시적으로 인용하고, (b) 예고됐던 쓰기 비용 실측(10만 행 INSERT 5회 median, +10.0%)을 제시하고, (c) "그 절의 문장은 그 범위에서 참이라 고치지 않는다" 고 옛 서술을 폐기하지 않은 채 범위를 명확히 구분했다. 관점 3이 요구하는 "과거 결정을 뒤집으면서 새 Rationale 를 함께 작성" 조건을 정확히 충족한 사례다.
  - 제안: 조치 불요. 다른 checker 가 이 재검토를 "번복" 으로 단독 인용할 경우, 이 인용 사슬(신 Rationale → 구 Rationale 명시적 참조 + 실측)을 함께 봐야 한다는 점만 기록해 둔다.

- **[INFO] 원칙 준수 확인 — CONCURRENTLY 패턴·partial 인덱스 원칙**
  - target 위치: `codebase/backend/migrations/V112~V116` (5쌍의 `.sql`/`.conf`)
  - 과거 결정 출처: `spec/conventions/migrations.md` §5 "인덱스를 만드는 마이그레이션은 별도 패턴" (README §5 인용, 선례 V056/V106 실패 사례) + `spec/1-data-model.md` `## Rationale` "Schedule 인덱스 …" 의 "선두는 술어 컬럼" 원칙 + 같은 문서 "`User` 민감 컬럼…" 절 인접의 partial index 관례(`WHERE … IS NOT NULL`)
  - 상세: 5개 마이그레이션 전부 `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 순서, `executeInTransaction=false` `.conf` 페어링을 지켰다. `llm_usage_log` 두 인덱스만 partial(`WHERE … IS NOT NULL`)로 만든 이유도 nullable 컬럼 + FK 트리거 등치조회라는 기존 원칙과 정확히 같은 근거로 설명된다. e2e(`deletion-cascade-indexes.e2e-spec.ts`)가 `indisvalid` 까지 확인하는 것도 V056/V106 반복 실패 학습을 반영한다.
  - 제안: 조치 불요. 확인 목적의 기록.

- **[INFO] 데이터 정합 대조 — 수치·V번호 일치**
  - target 위치: `spec/1-data-model.md` §3/§2.24/`## Rationale`, `spec/data-flow/{3-execution,5-integration,7-llm-usage}.md` sink 표, migration SQL 헤더 주석
  - 상세: 실측 수치(2,225 ms→6.96 ms, 206.6 ms→0.79 ms 등)와 V번호(V112~V116)가 spec 문서 3곳과 SQL 헤더 주석 5곳에 걸쳐 동일하게 복제돼 있으며 불일치가 없다. `python3 scripts/check-migration-versions.py --base origin/main` 도 `OK: 116 migration(s), max V116` 로 통과했다(중복/gap/단조성/`.conf` 페어 위반 없음).
  - 제안: 조치 불요.

## 요약

target scope(`spec/conventions/`) 자체는 이번 변경에서 건드리지 않았고, 관련 스코프(`spec/1-data-model.md`, `data-flow/*`, `migrations/V112~V116`)를 직접 대조한 결과 기각된 대안의 재도입이나 합의 원칙 위반은 없다. 오히려 이전 Rationale("Trigger `(workflow_id)` 인덱스" 절)이 유보했던 쓰기비용 트레이드오프를 실측으로 재검토하면서 옛 절을 인용·구분해 새 Rationale 을 작성한 것은 "결정 번복 시 새 Rationale 동반" 원칙을 정확히 지킨 사례다. `migrations.md` §5 의 CONCURRENTLY 패턴, 데이터 모델 문서의 partial-index·선두컬럼 원칙도 모두 준수됐다. Rationale 연속성 관점에서 이 변경은 우려사항이 없다.

## 위험도

NONE
