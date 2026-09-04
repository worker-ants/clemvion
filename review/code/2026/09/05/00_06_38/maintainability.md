# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위

`git diff --stat origin/main...HEAD -- codebase/` 로 실측한 결과, 실질 "코드" 변경은 4개
파일뿐이다 (총 +197줄):

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.conf` (신규, 4줄)
- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (신규, 70줄)
- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (기존 `describe` 블록에
  `it` 1개 추가, 10줄)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (기존 파일에 `it` 2개 추가, 113줄)

나머지 60여 개 파일(`plan/**`, `spec/**`, `review/**`)은 이전 3개 코드 리뷰 라운드
(`23_02_51`→`23_26_09`→`23_47_43`)와 그 사이의 `consistency-check --spec` 산출물이 이번
changeset 에 함께 커밋된 것으로, "가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도" 관점의
점검 대상(함수·클래스·제어 흐름)이 실질적으로 없다. 이번 라운드는 그 세 라운드가 이미 낸
maintainability 판정(전부 NONE)을 그대로 가져오지 않고, 최종 상태의 코드 파일을 다시 직접
읽어 독립적으로 재검토했다.

뮤테이션은 수행하지 않았다. `git status --short` 로 확인한 결과 이 세션은 저장소 파일을 건드리지
않았다.

## 발견사항

- **[INFO]** 신규 e2e 테스트 `J.` 가 파일 내에서 이례적으로 길고, 서로 다른 4개 검증 축을 한
  테스트에 담고 있다
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:347`(`it('J. 목록 조회 — 워크스페이스
    격리 + next_run_at 정렬 (V110 대상 쿼리)'`)~`419`
  - 상세: 이 블록은 73줄로, 같은 파일의 다른 `it` 블록(`A.`~`I.`, 9~30줄, 평균 24줄) 중 가장 긴
    것의 2.4배다. 한 테스트 안에 (1) `sort=next_run_at&order=asc` 정렬 확인, (2) 반대 방향
    `order=desc` 확인, (3) 파라미터 생략 시 기본 정렬(`created_at DESC`) 확인, (4) 다른
    워크스페이스에서 목록이 비어 있는지(격리) 확인 — 네 가지 별개 관심사가 들어 있다. 각 블록은
    개별적으로는 잘 근거를 남기고 있다(`23_02_51` W4, `23_26_09` INFO#8, `23_47_43` W1 을 각각
    인용) — 즉 세 차례 리뷰 라운드를 거치며 한 테스트에 점진적으로 assertion 이 누적된 결과이지,
    한 번에 설계된 것이 아니다. e2e 는 워크스페이스·workflow·스케줄 생성 비용이 커서 관련 검증을
    한 테스트에 모아 셋업 비용을 상각하는 것 자체는 이 저장소에서 드물지 않은 패턴이지만(`C-2.`
    도 목록+cron+nextRunAt 을 함께 본다), 이 블록은 그 정도를 넘어 "정렬"과 "격리"라는 서로 독립적인
    두 개념(테스트 제목의 `+` 도 이를 인정)을 하나로 묶어 실패 시 원인 진단이 느려진다(어느 절이
    실패했는지 stack trace 로는 알 수 있지만, 테스트 이름만으로는 구분 안 됨).
  - 제안: 결함은 아니며 이번 PR 을 막을 사유가 아니다. 다음에 이 파일을 다시 만질 기회가 있으면
    `J. next_run_at 정렬 (asc/desc + 기본값)` 과 `K. 워크스페이스 격리` 두 개로 분리하는 편이
    실패 시 진단이 빠르다. 공유 셋업(스케줄 2건 생성)은 별도 `it` 으로 옮기지 않는 이상 중복되므로,
    분리 비용 대비 이득이 크지 않다면 현행 유지도 무방하다 — 강제 조치 아님.

- **[INFO]** (확인, 새 문제 아님) `ascTimes`/`descTimes` 추출 3단 체인 반복은 이전 라운드의
  의도적 미조치 결정이 최종 상태에서도 유지됨을 재확인
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:373`~`376`, `:385`~`388`
    (`.map((r) => r.nextRunAt).filter((v): v is string => v !== null).map((v) => new
    Date(v).getTime())` 가 asc/desc 두 번 반복)
  - 상세: `23_26_09/RESOLUTION.md` #12 가 "asc/desc 를 나란히 비교할 수 있는 것이 이 테스트의
    요점이라 헬퍼로 접으면 무엇을 다르게 걸었는지 흐려진다"는 근거로 미조치를 확정했고,
    `23_47_43/maintainability.md` 도 이를 재확인했다. 이번 라운드에서 그 판단을 뒤집을 새 근거는
    없다 — 동의, 확인용 기재.

- **[INFO]** (확인, 새 문제 아님) 마이그레이션 헤더 주석(58줄)이 실행문(5줄 SQL)의 약 12배 —
  이전 두 라운드가 이미 검토·처분한 상태 그대로
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:1`~`58`
    (주석) vs `:60`~`65` (실행문)
  - 상세: `IF NOT EXISTS`/`DROP-first` 재실행 안전성 서술이 두 차례 리뷰(`23_02_51` W1,
    `23_26_09` W3)를 거치며 누적된 결과다. 반복되는 CONCURRENTLY 안전성 설명을
    `migrations/README.md`/`spec/conventions/migrations.md` 로 이관하는 후속이 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재돼 있어 이 PR 범위에서
    추가로 지적할 사항이 없다.

- **[INFO]** 신규 unit 테스트(`schedules.service.spec.ts`)·`schema:` e2e 테스트는 각 파일의 기존
  네이밍·구조 관례를 정확히 따름 — 결함 없음(확인용)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:142`
    (`it('sort=next_run_at&order=desc 를 반영 (V110 최적화 축)', ...)`), 같은 파일
    `describe('findAll sort/order', ...)` 블록(114행)
  - 상세: `sort=` 계열 테스트가 나열되는 순서(기본값 → `updated_at&asc` → 신규
    `next_run_at&desc` → `name`) 그룹핑에 자연스럽게 끼워 넣어졌고, 헬퍼(`makeQb()`)·단언 패턴
    모두 인접 테스트와 동일하다. 단일 `await` + 단일 `expect`, 10줄로 함수 길이·복잡도 지적
    대상이 아니다.

## 요약

실질 신규 코드 표면은 마이그레이션 쌍(`.conf`/`.sql`, 74줄) + unit 테스트 1건(10줄) + e2e 테스트
2건(113줄)뿐이며, 전반적으로 가독성·네이밍·일관성 면에서 저장소 기존 관례(`V056` 선례, 파일 내
`sort=` 테스트 그룹핑, `A.`~`I.` 알파벳 레이블 물리 순서)를 정확히 따른다. 세 차례 앞선 리뷰
라운드가 지적한 WARNING(물리 순서 불일치, unit 파라미터화 누락, 격리 단언의 vacuous loop)은
전부 최종 상태에서 소스 직접 대조로 해소를 확인했다. 유일하게 새로 짚을 지점은 신규 `J.` e2e
테스트가 세 라운드에 걸쳐 점진적으로 assertion 이 누적되며 파일 내 다른 테스트 대비 2.4배 길고
"정렬"과 "격리"라는 독립된 두 관심사를 한 테스트에 담고 있다는 것인데, 각 절의 근거가 개별적으로는
타당하고 e2e 셋업 비용 상각이라는 이 저장소의 기존 관행과도 크게 어긋나지 않아 INFO 로만 남긴다.
매직 넘버·중첩 깊이·순환 복잡도 관점에서는 지적할 대상이 거의 없을 만큼 변경 규모가 작다.
Critical·Warning 급 유지보수성 결함은 발견되지 않았다.

## 위험도

NONE
