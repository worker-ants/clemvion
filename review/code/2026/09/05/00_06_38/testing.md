# 테스트(Testing) 코드 리뷰

## 검토 범위·방법

이 changeset(65개 파일, `origin/main..HEAD`)의 실질 테스트 대상은 이전 3개 코드 리뷰 라운드
(`23_02_51` → `23_26_09` → `23_47_43`)와 동일하게 3개 파일이다.

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.{conf,sql}` (신규 DDL — 자체
  단위 테스트 대상 아님, e2e schema 테스트로 검증)
- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (신규 unit 케이스 1개:
  `sort=next_run_at&order=desc`)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (신규 `it` 2개: `schema: ...` + `J. 목록 조회
  — 워크스페이스 격리 + next_run_at 정렬`)

나머지(`plan/**`, `spec/1-data-model.md`, `spec/data-flow/10-triggers.md`, `review/**`)는 문서·plan·
이전 리뷰/consistency-check 세션 산출물이라 테스트 코드·테스트 대상 코드를 포함하지 않는다.
`git log --oneline origin/main..HEAD -- <세 파일>` 로 실제 diff 범위가 이 세 파일에 국한됨을,
`git diff --stat a74704c49..HEAD` 로 직전 라운드(`23_47_43`) 이후 이번 라운드 사이에 코드 diff가
전혀 없음(전부 리뷰 산출물 커밋)을 직접 확인했다.

이전 세 라운드의 testing 리뷰는 다음을 순차로 지적·조치했다 — 이번 라운드에서 그 조치가 실제로
반영돼 있는지 소스 대조 + **뮤테이션 실행**으로 독립 재검증했다.

1. (`23_02_51` W1) `GET /api/schedules`(V110 최적화 대상 쿼리) 자체를 부르는 e2e 부재 → `J.` 테스트
   신설로 해소 — 현재 파일 `:347-419` 에 존재함을 `Read` 로 확인.
2. (`23_26_09` INFO#8) `J.` 가 기본 정렬(`created_at`, `sort` 생략) 경로는 호출만 하고 정렬 정확성을
   단언하지 않음 → `byDefault`/`createdTimes` 단언 추가로 해소 — `:391-401` 에 존재.
3. (`23_26_09` INFO#9) unit 파라미터화 목록(`schedules.service.spec.ts`)에 `next_run_at` 축 누락 →
   케이스 추가로 해소 — `:142-147` 에 존재.
4. (`23_47_43` W1) `J.` 의 워크스페이스 격리 단언이 "빈 배열을 도는 for 루프"라 정상 경로에서 관측되지
   않는 vacuous 형태 → `expect(isolated.body.data).toEqual([])` 로 교체 — `:418` 에 존재.

### 직접 실행한 검증 (뮤테이션 테스트)

주장을 재현 없이 받아들이지 않기 위해, 신규 unit 케이스가 실제로 회귀를 잡는지 뮤테이션으로
확인했다. 저장소 밖 scratch 에 원본을 `cp` 로 백업한 뒤 `resolveOrderBy` 의
`next_run_at: 's.next_run_at'` → `'s.last_run_at'` 로 뮤테이션하고
`npx jest src/modules/schedules/schedules.service.spec.ts` 실행:

```
FAIL src/modules/schedules/schedules.service.spec.ts
  ● ... sort=next_run_at&order=desc 를 반영 (V110 최적화 축)
    Expected: "s.next_run_at", "DESC"
    Received: "s.last_run_at", "DESC"
Tests: 1 failed, 18 passed, 19 total
```

RED 확인 직후 `cp` 로 원본을 복원했고 `diff`(동일) + `git status --short`(해당 파일 무변경)로 원복을
검증했다. 이 신규 테스트는 vacuous 가 아니라 실제로 회귀를 검출한다. 원복 전 상태(뮤테이션 적용 상태)가
다른 세션에 노출된 시간은 명령 1회 실행 구간뿐이었다.

무뮤테이션 상태에서 같은 파일 전체 실행 결과는 `19 passed, 19 total` — `23_26_09` RESOLUTION 이 주장한
수치와 일치한다.

## 발견사항

- **[INFO]** `resolveOrderBy` 화이트리스트의 `last_run_at` 축이 unit/e2e 어느 쪽에서도 테스트되지 않음
  (이번 PR 이 만든 갭 아님 — 참고용 기재)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` (`resolveOrderBy`, 5개 화이트리스트
    키 `created_at`/`updated_at`/`next_run_at`/`last_run_at`/`name` 중 `last_run_at`만 unit
    파라미터화 목록·e2e 어디에도 등장하지 않음)
  - 상세: `git log -S"last_run_at" --oneline -- codebase/backend/src/modules/schedules/schedules.service.ts`
    로 확인한 결과 이 축은 `#443`(2026년 이전)에 도입된 기존 코드이며 이번 V110 diff 가 건드리지 않았다.
    이번 PR 은 정확히 자신이 최적화한 축(`next_run_at`)만 unit 레벨로 채웠고, 그 판단은 타당하다 —
    `last_run_at` 을 함께 메우는 것은 이 PR 의 범위(스케줄 인덱스 전략 정정) 밖의 드라이브바이가 된다.
    다만 5개 화이트리스트 값 중 유일하게 어떤 테스트 스위트에서도 등장하지 않는 값이라는 사실 자체는
    다음에 `resolveOrderBy` 를 리팩터링할 사람이 참고할 만하다.
  - 제안: 조치 불요(이 PR 범위 밖). 향후 `resolveOrderBy` 를 건드리는 PR 에서 `last_run_at` 케이스를
    함께 채우는 정도로 충분.

- **[INFO]** `CREATE INDEX CONCURRENTLY` 중단→재실행 시 DROP-first 가 실제로 복구하는지에 대한 자동화
  회귀 테스트는 여전히 없음 — 3개 라운드 전부 같은 결론으로 defer, 이번 라운드도 뒤집을 근거 없음
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:32-58`
    (`## \`IF NOT EXISTS\` 만으로는 재실행이 안전하지 않다` 절)
  - 상세: `23_02_51/RESOLUTION.md` §"W1 을 '주석 정정' 으로 끝내지 않은 이유"는 `CREATE UNIQUE INDEX
    CONCURRENTLY` 를 중복 데이터에 걸어 결정적으로 실패시키고 두 순서(DROP-first 유/무)를 수동으로
    재현·검증했다고 기록한다 — 즉 **검증은 실제로 수행됐으나 일회성 수동 재현**이고, 그 시나리오를
    자동으로 재현해 CI 에서 지키는 테스트(예: 별도 스크립트로 `CREATE INDEX CONCURRENTLY` 를 강제
    중단시켜 invalid 인덱스를 만든 뒤 마이그레이션 재실행 성공을 단언)는 3라운드 내내 추가되지
    않았다. `schema:` e2e 테스트는 **정상 1회 적용** 결과(`indisvalid=true`)만 단언하며, "실패 후
    재실행" 경로 자체는 CI 가 매번 재현하지 않는다. `23_02_51`·`23_26_09`·`23_47_43` 세 라운드
    testing.md 가 모두 이 갭을 인지하고 "DBA 수동 복구 시나리오라 자동화 비용 대비 실익이 낮다"는
    같은 근거로 낮은 우선순위 defer 를 유지했고, 이번 재검증에서도 그 판단을 뒤집을 새 근거는
    찾지 못했다.
  - 제안: 조치 불요(기존 처분 유지에 동의). 다만 이 저장소가 `CREATE INDEX CONCURRENTLY` 패턴을
    반복 사용하므로(`V022`/`V030`/`V034`/`V047`/`V048`/`V056`/`V072`/`V086`/`V095`/`V106`/`V109`/`V110`),
    이 시나리오를 한 번만 재사용 가능한 헬퍼 스크립트로 자동화해 두면 다음 CONCURRENTLY 마이그레이션마다
    반복 재현하지 않아도 된다 — 등재된 규약화 후속 항목(`spec-draft-nullable-notation-followups.md`)에
    이 자동화까지 범위를 넓힐지 고려할 만하다.

## 회귀 테스트 확인 (발견사항 아님, 확인용 기재)

- `A.`~`I.` 기존 e2e 케이스(preview/생성/PATCH/run-now/delete/trigger 양방향 동기화/`C-2.` 트리거
  목록 enrichment)는 인덱스 컬럼 순서 변경과 무관한 API 계약을 검증하므로 이번 변경 후에도 유효 —
  `resolveOrderBy`/`findAll` 쿼리 빌더 로직 자체는 diff 밖이라 회귀 없음.
  `schedules.service.spec.ts` 의 인접 describe(`findAll triggerId filter`, `create — timezone
  fallback`)도 diff 로 건드려지지 않았고 `19 passed`(뮤테이션 원복 후 재확인)로 그대로 GREEN.
- 신규 unit 테스트는 `makeQb()` 헬퍼·`beforeEach` 로 매 테스트 fresh mock 을 받아 테스트 간 격리를
  유지하며(다른 `it` 의 mock 상태에 의존하지 않음), 인접 "미허용 sort 값은 폴백" 테스트와 축이 겹치지
  않는다 — mock 은 TypeORM `QueryBuilder` 체이닝만 흉내 내는 최소 형태(`orderBy`/`where`/`getMany`
  등)로 실제 인터페이스 형태와 일치하고 과도한 내부 구현 노출이 없다.
  뮤테이션 실행으로 이 mock 이 실제 `resolveOrderBy` 반환값 변화를 정확히 검출함을 실증했다(위 참조).
  e2e `J.` 테스트는 실 DB·실 HTTP 왕복으로 unit 이 못 보는 workspace 격리·직렬화(JSON `nextRunAt`
  포맷)까지 검증해 레이어 분리(unit=쿼리 빌더 로직, e2e=엔드투엔드 계약)가 목적에 맞게 이뤄져 있다.
- e2e `schema:` 테스트는 새 인덱스 존재(`indisvalid=true`, 컬럼 순서, non-partial)와 옛 인덱스 부재를
  양방향으로 확인해 "교체의 절반만 닫히는" vacuous 패턴을 피한다. `J.` 테스트는 asc/desc 양방향 정렬 +
  기본 정렬(`created_at`) + 워크스페이스 격리(빈 배열 직접 단언) 를 모두 걸어, 이전 두 라운드가
  지적한 세 가지 커버리지 갭(최적화 대상 쿼리 e2e 부재·기본 정렬 미단언·격리 단언 vacuous)이 실제로
  전부 닫혀 있음을 파일을 직접 읽어 확인했다.
- `J.` 테스트는 서로 다른 두 cron(`'0 3 * * *'`, `'0 21 * * *'`)으로 `next_run_at` 값을 먼저 다양화한
  뒤 정렬을 확인해(`new Set(ascTimes).size).toBeGreaterThanOrEqual(2)`), "분기를 못 가르는 fixture"
  문제(양쪽 값이 같아 정렬 여부를 관측 못 하는 경우)가 아니다.
- e2e `J.`/`schema:` 테스트가 다른 e2e 스펙 파일이나 같은 파일의 `A.`~`I.` 테스트와 상태를 공유하지
  않는다 — 각 `it` 이 자신만의 `uniqueName`/`createTeamWorkspace` 로 격리된 데이터를 만든다. `J.` 가
  생성한 workspace/schedule 을 명시적으로 정리(cleanup)하지 않는 것은 파일 내 다른 케이스(`A.`~`I.`)
  전부와 동일한 관례이며(e2e 환경은 `make e2e-down` 으로 초기화), 이 파일만의 새 결함이 아니다.

## 요약

이 changeset 의 테스트 표면(migration schema e2e 1건, unit 1건, e2e 목록 조회 1건)은 이미 3차례 코드
리뷰 라운드를 거치며 지적된 WARNING 전부(최적화 대상 쿼리 e2e 부재 → 기본 정렬 미단언 → 워크스페이스
격리 단언 vacuous)를 순차로 닫았고, 이번 라운드는 그 최종 상태를 소스 대조뿐 아니라 **직접 뮤테이션
테스트**(`resolveOrderBy` 값을 바꿔 신규 unit 케이스가 실제로 RED 를 내는지 확인, 이후 `cp` 로 원복)로
독립 재검증했다 — vacuous 하지 않고 실제로 회귀를 검출한다. 남은 것은 이 PR 의 범위를 명확히 벗어나는
INFO 두 건뿐이다: (1) `resolveOrderBy` 의 `last_run_at` 축은 이번 PR 이전부터 어떤 테스트에도 없었고
이번 PR 이 만든 갭이 아니며, (2) `CREATE INDEX CONCURRENTLY` 중단→재실행 복구는 3라운드 내내 일회성
수동 재현만 있고 자동화된 CI 회귀 테스트는 없다 — 이 갭 자체는 이미 인지·문서화됐고 defer 근거(DBA
시나리오 자동화 비용 대비 실익)가 세 라운드 동안 일관되게 유지돼 이번 라운드에서 뒤집을 근거를 찾지
못했다. Critical/Warning 급 테스트 결함은 발견되지 않았다.

## 위험도

NONE
