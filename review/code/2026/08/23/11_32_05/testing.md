# 테스트(Testing) 리뷰 — `11_32_05`

## 리뷰 범위와 방법

이번 diff 의 실질 코드 변경은 신규 e2e 스펙 1개(`codebase/backend/test/terminal-duration-sql.e2e-spec.ts`, 182줄)뿐이고, 나머지는 plan 문서(`plan/complete/terminal-duration-sql-safety-net.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`)와 직전 라운드(`11_15_39` 코드 리뷰, `10_48_33` consistency 리뷰)의 산출물이 저장소에 커밋된 것이다. 즉 이번 라운드는 **직전 리뷰가 지적한 항목들이 실제로 반영됐는지**를 재검증하는 성격이 강하다.

검증을 위해 직접 실행한 것:
- `codebase/backend/test/terminal-duration-sql.e2e-spec.ts` 전체 원본 파일과 `codebase/backend/src/shared/utils/terminal-duration.ts`(SQL/상수 정의), `terminal-duration.spec.ts`(기존 단위 스펙), `codebase/backend/test/helpers/db.ts`(e2e DB 헬퍼)를 대조.
- `npx tsc --noEmit -p tsconfig.json` 실행 — 전체 199건 에러(38개 파일, plan 문서가 주장하는 ratchet baseline과 정확히 일치) 중 `terminal-duration` 관련 에러 **0건**. 신규 파일이 타입체크 회귀를 만들지 않음을 직접 확인.
- 신규 e2e 파일의 테스트 개수를 직접 세어 plan 문서의 "9케이스(전제1·값4·경계2·스키마2)" 주장과 대조 — 일치.

## 발견사항

- **[INFO]** 클램프 경계 `it.each` 가 상한 이상만 다루고 "상한 바로 아래"(클램프에 안 걸려야 하는 값)는 별도 케이스로 명시하지 않는다
  - 위치: `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:143-148`
  - 상세: `[정확히 상한, PG_INT4_MAX]`, `[상한 + 1ms, PG_INT4_MAX + 1]` 두 케이스만 있다. 다만 실질 갭은 낮다 — 상한을 낮은 쪽으로 벗어난 뮤턴트(`LEAST(PG_INT4_MAX - 1, …)`)는 "정확히 상한" 케이스가 값 불일치로 잡고, 높은 쪽 뮤턴트(`LEAST(PG_INT4_MAX + 1, …)`)는 "상한+1ms" 케이스에서 `::int` 캐스팅이 `integer out of range` 로 실패해 어차피 RED 가 된다(실패 사유가 assertion mismatch 가 아니라 DB 에러라는 점만 다르다). 클램프가 정상값에 오작동하지 않는지는 `[단위]`(1500ms)·`[경계]`(0ms) 케이스가 이미 커버한다.
  - 제안: 현재도 판별력은 충분하므로 조치 불요. 굳이 완전성을 높이려면 `PG_INT4_MAX - 1ms` 케이스를 추가해 "클램프 미발동" 을 assertion mismatch 로 직접 보이게 할 수 있다(우선순위 낮음).

- **[INFO]** `entityTable()`/`entityColumn()` 의 fail-fast throw 경로(`t?.name` 또는 `c?.options?.name` 이 falsy 인 경우)는 별도로 테스트되지 않는다
  - 위치: `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:20-24`, `27-34`
  - 상세: 이 두 헬퍼는 테스트 자신을 위한 방어 코드(엔티티 메타데이터를 못 찾으면 즉시 에러로 원인을 드러냄)라, throw 경로 자체를 단언하는 테스트를 추가하는 것은 배보다 배꼽이 큰 선택이다.
  - 제안: 조치 불요. 참고 기록.

## 관점별 평가

1. **테스트 존재 여부**: 신규 프로덕션 코드 변경은 없다(diff 는 test/plan/review 산출물뿐). 이전 라운드(`10_48_33`/`11_09_44` 등)에서 도입된 `TERMINAL_DURATION_MS_SQL`/`resolveTerminalDurationMs` 는 이미 단위 스펙(`terminal-duration.spec.ts`)이 있었고, 이번에 "SQL 문자열이 실제 Postgres 값으로 옳은가"라는, 단위 테스트가 원리적으로 못 잡는 층을 e2e 로 메웠다 — plan 문서의 문제 정의(왜 단위 테스트로 불가능한지)가 정확하고, 그 경계를 정확히 존중해 e2e 를 최소 표면(값 검증 + 스키마 전제)에만 배치했다.
2. **커버리지 갭**: 뮤테이션 실측(M1: `* 1000` 제거 → 단위 스펙 GREEN·신규 e2e RED, M2/M3: `LEAST`/`THEN NULL` 제거 → 이미 단위 스펙에서 RED)으로 실제 갭이 "단위(초/ms) 하나"였음을 직접 실증했다. 이 실측 방법론 자체가 이 코드베이스에서 반복적으로 요구되는 "판별력 검증"을 정확히 수행한 사례다. 남은 실질 갭은 없다고 판단된다(위 INFO 2건은 저비용 완전성 항목일 뿐 결함이 아니다).
3. **엣지 케이스**: 부호(음수 span → NULL, `GREATEST(0,…)` 회귀 방지), 경계(0ms), 클램프 상/상+1(off-by-one) 모두 명시적으로 다룬다. 직전 라운드의 INFO-1(클램프 컷오프 미검증)이 정확히 이 off-by-one 케이스로 반영됐다.
4. **Mock 적절성**: mock 을 쓰지 않고 실제 Postgres 에 정본 SQL 문자열을 그대로 태운다. 파일 상단 docstring 이 "왜 mock/문자열 단언이 아니라 실행 검증이 필요한가"를 정확히 논증한다 — mock 을 썼다면 검증 대상 자체(SQL 의미)가 사라지므로, 이 선택은 정당하다.
5. **테스트 격리**: 모든 쿼리가 literal subquery(`SELECT $2::timestamptz AS started_at`) 기반이라 실제 테이블에 쓰기가 없고, 스키마 전제 검증도 `information_schema` 읽기 전용 조회다. `beforeAll`/`afterAll` 로 커넥션을 관리하며 테스트 간 공유 가변 상태가 없어 실행 순서에 무관하게 독립적이다. 기존 e2e 컨벤션(`createDbClient()`, `webchat-idle-reaper.e2e-spec.ts` 와 동일 패턴)을 그대로 따른다.
6. **테스트 가독성**: `[전제]/[단위]/[부호]/[경계]/[클램프]` 태그로 케이스 성격을 라벨링했고, 각 `it`/`describe` 블록에 "왜 이 케이스가 필요한가"를 정확히 설명하는 주석이 붙어 있다. `plusMs()` 로 시각 산술을 계산시켜 매직 시각 손계산을 없앤 점(직전 INFO-3 반영)도 가독성에 기여한다.
7. **회귀 테스트**: 기존 단위 스펙(`terminal-duration.spec.ts`)은 이번 변경으로 건드리지 않았고, 여전히 유효하다 — 오히려 이번 e2e 가 그 스펙의 사각지대(문자열 `toContain` 이 못 잡는 산술 의미)를 메우는 보완 관계다. `tsc --noEmit` 재실행으로 신규 파일이 타입 에러를 추가하지 않음을 직접 확인했다.
8. **테스트 용이성**: 프로덕션 코드(`terminal-duration.ts`)가 순수 함수 + 상수 SQL 문자열로 구성돼 있어 테스트하기 쉬운 구조다. e2e 도 Nest 앱 전체 부트스트랩 없이 `getMetadataArgsStorage()` 로 엔티티 데코레이터 메타데이터만 읽어 테이블/컬럼명을 유도하는 가벼운 방식을 택해, 무거운 통합 셋업 없이도 정본과의 결속을 검증한다.

## 이전 라운드 대비 변화 확인

`review/code/2026/08/23/11_15_39/RESOLUTION.md` 가 주장하는 반영 사항(INFO #1~4)을 소스와 대조한 결과 전부 실제로 반영되어 있다:
- 클램프 컷오프 `it.each` 2케이스 — 확인(143-148행).
- `toPgSql()`/`paramOccurrences()` 분리 — 확인(56-67행).
- `plusMs()` 계산식 도입 — 확인(72-75행).
- vacuous-guard 독립 `it('[전제]…')` 분리 — 확인(108-110행).

미반영 INFO #5~7(무가드 인덱싱, 편도 상호참조, spec fidelity)은 각각 정당한 사유(literal subquery라 항상 1행·아직 미착수 항목에 대한 stale 역참조 위험·결함 아님)와 함께 명시적으로 defer 되어 있어 재지적하지 않는다.

## 요약

이번 diff 의 유일한 실질 코드 변경(신규 e2e 스펙)은 이미 직전 라운드(`11_15_39`)에서 촘촘히 리뷰되고 뮤테이션으로 판별력까지 실측된 상태이며, 그 라운드가 지적한 4건의 INFO 는 전부 소스에서 확인되는 형태로 반영됐고 나머지 3건은 정당한 사유로 defer 됐다. 직접 재확인한 결과(`tsc --noEmit` 클린, 케이스 개수 일치, 격리·mock·가독성 전부 양호) 새로운 Critical/Warning 은 발견되지 않았다. 추가로 발견한 2건은 우선순위가 낮은 INFO(경계값 완전성, 헬퍼 throw 경로 미테스트)로, 판별력에 실질적 구멍을 남기지 않는다.

## 위험도
LOW
