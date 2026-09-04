# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위

`git diff --stat origin/main..HEAD -- codebase/` 로 실측한 결과, 실질 "코드" 변경은 여전히 4개
파일뿐이다.

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.conf` (신규, 4줄)
- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (신규, 70줄 — 이전
  두 라운드(`23_02_51`, `23_26_09`) 이후 **내용 변경 없음**, `git log -- <path>` 로 확인:
  `e20fe5b0b`→`dd6549796` 이후 커밋 없음)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (기존 파일에 `it` 블록 2개 — `schema:` 테스트,
  `J.` 목록 조회 테스트)
- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (**이번 라운드에 새로 추가된
  diff** — `sort=next_run_at&order=desc` 단위 테스트 1건)

나머지 43개 파일(`plan/**`, `spec/**`, `review/**`)은 이전 리뷰·consistency-check 라운드 산출물이
이 changeset 에 커밋된 것이거나 spec 표/plan 체크박스 갱신이라 "가독성·네이밍·함수 길이·중첩·
매직넘버·중복·복잡도" 관점의 점검 대상이 실질적으로 없다. 저장소 파일은 건드리지 않았다
(`git status --short` 결과 이 세션의 출력 디렉터리 외 변경 없음).

이전 두 라운드가 지적한 사항이 이번 diff 에서 실제로 해소됐는지를 코드로 직접 재검증했다.

## 발견사항

- **[INFO]** (확인용, 긍정적 발견) 직전 라운드(`23_26_09`)가 낸 WARNING — `J.` 테스트가 파일의
  "물리 순서 = 알파벳 레이블" 관례를 깨고 `H, J, I` 순으로 삽입돼 있던 문제 — 가 이번 changeset 에서
  실제로 해소됨을 직접 확인.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — `grep -n "it('[A-Z]\."` 실행 결과
    `A`(86행) → `B`(106행) → `C`(117행) → `D`(178행) → `E`(200행) → `F`(220행) → `G`(250행) →
    `H`(281행) → `I`(312행) → `J`(347행) 순으로, 물리 등장 순서와 알파벳 레이블이 정확히 일치한다.
  - 상세: `J.` 블록이 `I.` 블록(`});` 종료, 337행) 바로 뒤 파일 최말단으로 옮겨졌다. 새로 도입된
    결함은 없음 — 확인용 기재.

- **[INFO]** 신규 unit 테스트(`schedules.service.spec.ts`)는 파일 기존 관례를 정확히 따름 — 결함 없음
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:142`
    (`it('sort=next_run_at&order=desc 를 반영 (V110 최적화 축)', ...)`)
  - 상세: 같은 `describe` 블록 안의 `sort=` 계열 테스트(`기본값은 s.created_at DESC` → `sort=updated_at&order=asc` → 신규 `sort=next_run_at&order=desc` → `sort=name`) 사이, "정렬 축 나열"
    이라는 그룹핑 순서에 자연스럽게 끼워 넣어졌다(파일 끝에 덧붙이지 않음). 네이밍(`sort=X&order=Y 를
    반영`), 헬퍼 재사용(`makeQb()`), 단언 패턴(`orderBy` 호출 인자 확인) 모두 인접 테스트와 동일한
    형태를 그대로 따른다. 함수 길이·중첩·복잡도 관점에서 지적할 대상 없음(단일 `await` + 단일
    `expect`, 10줄).

- **[INFO]** 이전 라운드(`23_26_09`)가 이미 기록한 지역 중복 — `J.` 테스트 안 `ascTimes`/`descTimes`
  추출 로직 반복 — 은 이번 라운드에서도 그대로 남아 있으나 새 지적 아님, 기존 처분 유지가 타당
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:373-376`, `:385-388`
    (`.map((r) => r.nextRunAt).filter((v): v is string => v !== null).map((v) => new Date(v).getTime())`
    3단 체인이 asc/desc 두 번 반복)
  - 상세: `23_26_09/RESOLUTION.md` #12 가 "asc/desc 두 방향을 눈으로 나란히 비교할 수 있는 것이 이
    테스트의 요점이라, 헬퍼로 접으면 무엇을 다르게 걸었는지가 흐려진다"는 근거로 **의도적 미조치**를
    확정했다. 이번 라운드에서 그 판단을 뒤집을 새 근거는 없다 — 동의, 확인용 기재.

- **[INFO]** 마이그레이션 헤더 길이(70줄, 주석 58줄)는 이전 두 라운드가 이미 지적·처분한 상태 그대로
  — 이번 라운드에서 내용 변경 없음(재확인만)
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:1`~`58`
  - 상세: `git log --oneline -- <파일>` 로 확인한 결과 `dd6549796`(23_02_51 W1 대응) 이후 이 파일에
    대한 커밋이 없다 — 이번 changeset 의 신규 diff 가 아니다. `23_26_09/maintainability.md` 가 이미
    "코드보다 주석이 5배" 경향을 INFO 로 남겼고, 반복되는 안전성 설명을
    `migrations/README.md`/`spec/conventions/migrations.md` 로 이관하는 후속이
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재돼 있다. 새로 추가할
    지적 없음.

## 요약

이번 라운드(`23_47_43`)의 실질 신규 diff 표면은 `schedules.service.spec.ts` 단위 테스트 1건뿐이고,
그 외 코드 파일(마이그레이션 `.conf`/`.sql`, e2e 스펙)은 직전 라운드(`23_26_09`) 이후 내용 변경이
없다. 직전 라운드가 낸 유일한 WARNING(`J.` 테스트의 물리 순서/알파벳 레이블 불일치)은 `git log`·
`grep` 으로 직접 재검증한 결과 정확히 해소되어 `A`~`J` 물리 순서와 레이블이 완전히 일치한다. 신규
unit 테스트는 파일 기존 관례(네이밍·헬퍼 재사용·그룹핑 위치)를 그대로 따라 추가돼 유지보수성
결함이 없다. 남아 있는 INFO 셋(헤더 길이, `ascTimes`/`descTimes` 지역 중복, 벤치마크 표 3중 복제)은
모두 이전 라운드에서 이미 검토·처분된 항목으로 이번 diff 가 새로 만든 것이 아니며, 그 처분(의도적
미조치 또는 후속 plan 등재)을 뒤집을 새 근거도 발견하지 못했다. Critical·Warning 급 유지보수성
결함은 발견되지 않았다.

## 위험도

NONE
