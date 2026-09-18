# 테스트(Testing) 리뷰 — V121~V130 FK 인덱스 + e2e 확장

## 검토 범위

- 신규 마이그레이션 10쌍(`V121`~`V130`, `.conf`+`.sql`, `codebase/backend/migrations/`) — 코드 관점에서 직접 테스트할 로직은 없고(DDL), 유일한 테스트 표면은 아래 e2e 스펙이다.
- `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` — 기존 `EXPECTED` 테이블(9건, V112~V120)에 10건을 더해 19건(`it.each`)으로 확장. 이번 리뷰의 실질적 대상.
- `plan/in-progress/spec-draft-fk-remaining-dispositions.md`, `review/consistency/**`, `spec/**` — 테스트 관점에서는 부수 문서이며 별도 검증(아래 "검증 절차" 참조)만 수행.

## 검증 절차 (뮤테이션 없이 read-only)

저장소 파일을 수정하지 않고 다음만 실행해 plan 의 실측 주장을 재현했다:
- `python3 scripts/check-migration-versions.py --base origin/main` → `OK: 130 migration(s), max V130` (plan 서술과 일치)
- `npx tsc --noEmit -p tsconfig.json` (backend) → `deletion-cascade-indexes.e2e-spec.ts` 관련 오류 없음
- `grep -c "name: '" test/deletion-cascade-indexes.e2e-spec.ts` → 19 (plan 의 "it.each 열아홉" 서술과 일치), 이름 19개 전수 중복 없음(uniq 확인)
- SQL 10개 파일의 `CREATE INDEX` 정의(컬럼·partial 조건 유무)를 `EXPECTED` 배열의 정규식 10건과 1:1 대조 — 전부 일치(아래 "발견사항" 없음 항목 참고)

`git status --short` 로 원복 확인 완료, 저장소에 변경 남기지 않음.

### 발견사항

- **[INFO]** 신규 e2e 단언은 스키마 형태(존재·`indisvalid`·`pg_get_indexdef` 정규식)만 검증하고, FK 트리거 쿼리가 실제로 해당 인덱스를 사용하는지(플래너 선택) 또는 `ON DELETE CASCADE`/`SET NULL` 연쇄의 동작 정확성은 이 스펙의 범위 밖이다.
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` — `describe('FK 인덱스 (e2e, V112~V130)', ...)` 블록 전체
  - 상세: 이는 V112~V120 선례부터 이어진 의도된 스코프(주석에 "정의는 선두 컬럼과 부분 조건까지 대조한다" 로 명시)이며, 실제 성능·플랜 사용 여부는 plan 문서의 수동 `EXPLAIN`/벤치마크로 별도 확인되어 있다. 새로 도입된 갭이 아니라 기존 컨벤션의 연속이므로 이번 PR 을 막을 사유는 아니다.
  - 제안: 조치 불요. 다만 향후 이 파일에 "인덱스가 실제로 스캔에 쓰였는가"까지 자동 검증하고 싶다면 별도 이슈로 트래킹.

- **[INFO]** `idx_model_config_workspace_kind` (V130) 케이스는 기존 부분 UNIQUE 인덱스(`(workspace_id, kind) WHERE is_default = true`)와 이름이 다르므로 쿼리(`WHERE c.relname = $1`)상 혼동될 여지가 없는데도, 테스트에 "구분된다"는 주석을 달아 둔 점은 가독성에 도움이 된다.
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:104` 부근 (`idx_model_config_workspace_kind` 엔트리 주석)
  - 상세: 실제 판별은 이름 매칭으로 이미 보장되므로 기능적 이슈는 아니다. 정규식 자체도 `$` 앵커로 `WHERE (is_default = true)` 접미사가 붙는 옛 인덱스 정의와는 애초에 매치되지 않는다.
  - 제안: 조치 불요 (긍정적 관찰).

- **[INFO]** DROP-먼저 패턴(`DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS`)의 "실패 후 재실행이 invalid 잔재를 스스로 치운다"는 복구 시나리오는 CI/e2e 스위트에 자동화된 회귀 테스트가 없고, plan 체크리스트에 "일회용 pg18 에 파일 그대로 두 번 적용(멱등)" 이라는 수동 검증으로만 남아 있다.
  - 위치: 신규 10개 `.sql` 파일 공통 헤더 주석 (`DROP INDEX CONCURRENTLY IF EXISTS idx_*;` 앞 문단)
  - 상세: 이 역시 V111 선례부터 이어지는 기존 관례(README.md §5)이고, `migrate-repair` 흐름은 인프라 레벨이라 백엔드 Jest e2e 로 포착하기 어렵다. 새로운 갭이 아니다.
  - 제안: 조치 불요.

## 커버리지 · 격리 · 가독성 평가

- **테스트 존재/커버리지**: 마이그레이션 10건 ↔ `EXPECTED` 신규 엔트리 10건이 1:1 대응하며 누락 없음(전수 대조 완료). 새 컬럼·인덱스에 대해 사각지대 없음.
- **엣지 케이스**: partial 인덱스(`WHERE ... IS NOT NULL`) 5건 모두 정규식에 조건절이 포함되어, "조건 누락"·"조건 잘못됨" 변형과 구분된다. plan 체크리스트에 오답 22개(조건 누락·추가·선두 변경·기존 UNIQUE·컬럼 순서)를 수동으로 넣어 전부 거부됨을 확인했다는 기록이 있고, 이는 판별력 있는 fixture 설계로 바람직한 관행이다.
- **Mock 적절성**: 이 스펙은 mock 없이 실제 Postgres(`createDbClient`)에 대해 `pg_index`/`pg_get_indexdef` 를 직접 질의한다 — 스키마 검증 목적에 적합하며 실동작과의 괴리가 없다.
- **테스트 격리**: `beforeAll`/`afterAll` 로 커넥션 1개를 공유하지만 각 `it.each` 케이스는 이름별 독립 SELECT 이며 부작용이 없어, 순서 의존성이나 상호 오염 없음.
- **테스트 가독성**: 헤더 주석이 세 PR 묶음(V112~116/V117~120/V121~130)의 근거·수치·SoT 를 명시하고, 배열 내부에도 구간별 주석이 있어 왜 이 인덱스가 필요한지 추적 가능.
- **회귀 테스트**: 기존 9건 엔트리는 변경 없이 그대로 유지되어, 이전 배치(V112~V120)의 회귀 안전성이 보존된다. `describe` 제목과 헤더만 범위 확장에 맞춰 갱신됨.
- **테스트 용이성**: 데이터 기반(`it.each`) 구조라 다음 배치 추가 시에도 배열에 엔트리를 더하기만 하면 되는 낮은 결합도 설계.

## 요약

이번 변경은 신규 로직이 아니라 DDL 인덱스 추가이므로 단위 테스트 대상 코드가 없고, 유일한 테스트 표면인 `deletion-cascade-indexes.e2e-spec.ts` 는 V112~V120 에서 이미 검증된 패턴(이름·정의 정규식·`indisvalid` 3중 확인)을 그대로 10건 더 확장한 것이다. 10개 SQL 정의를 정규식과 전수 대조한 결과 전부 일치했고, plan 이 주장한 실측치(마이그레이션 버전 130·엔트리 19개)도 직접 재현해 확인했다. 스키마 형태만 검증하고 쿼리 플랜 실사용이나 캐스케이드 동작 자체는 범위 밖이라는 점, DROP-먼저 복구 시나리오가 자동화되지 않았다는 점은 모두 선례부터 이어진 의도된 스코프이며 이번 PR 이 새로 만든 갭이 아니다. Critical/Warning 급 결함은 발견하지 못했다.

## 위험도

NONE
