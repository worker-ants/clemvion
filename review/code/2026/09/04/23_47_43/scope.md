# 변경 범위(Scope) 리뷰

## 검토 방법

프롬프트가 생략한 diff(파일 4·5·8·9·21·22·23·26·27·28·31·32·35·41 등)와 전체 컨텍스트는
`git diff origin/main..HEAD`, `git log --oneline origin/main..HEAD`, `git show --stat <commit>`,
`grep`으로 워크트리에서 직접 확인했다. 저장소에 어떤 쓰기도 하지 않았다 —
검토 시작·종료 시점 모두 `git status --short` 결과가 `review/code/2026/09/04/23_47_43/`
(이 세션 출력) 하나뿐임을 확인했다.

이 changeset 은 `origin/main..HEAD` 커밋 7개(`6143b8c9f`→`e20fe5b0b`→`8a610e787`→
`dd6549796`→`4be23e1ef`→`8b0f5ac0c`→`608caf02b`), 총 51개 파일로 구성된다. 실질
"코드" 변경은 `git diff --stat origin/main..HEAD -- codebase/` 로 직접 확인한 4개 파일
(195줄)뿐이고, 나머지 47개는 spec 2개·plan 2개(1개는 `git mv`)·직전 두 코드 리뷰
라운드(`23_02_51`, `23_26_09`) 및 두 consistency-check 라운드(`22_34_55`, `22_43_40`)의
산출물이다.

## 발견사항

- **[INFO]** `Schedule (trigger_id)` 인덱스 행 추가는 이 PR 의 원 티켓(`idx_schedule_next_run`
  부분 조건 불일치)과 무관한 드라이브바이 문서 보정이다 — 신규 발견 아님, 3회째 동일 판정
  - 위치: `spec/1-data-model.md:915` (신규 행, 커밋 `6143b8c9f`)
  - 상세: `idx_schedule_trigger_id` 는 이 PR 이전에 이미 적용된 `V106` 마이그레이션의 산물이고,
    이번 changeset 의 핵심 코드 변경(V110)과는 관계가 없다. `plan/complete/spec-draft-schedule-index.md`
    §4 본문("같은 표·같은 테이블이므로 함께 메운다")에 근거가 명시돼 있고, 코드·마이그레이션
    변경 없이 spec 표 행 1개 추가에 그친다. 이 항목은 직전 두 라운드
    (`review/code/2026/09/04/23_02_51/scope.md` INFO, `review/code/2026/09/04/23_26_09/scope.md` INFO)에서
    이미 동일하게 지적·INFO 판정됐고, `23_02_51/RESOLUTION.md` #4 가 "PR 설명에 명시"로 처분을
    확정한 항목이다 — 이번 라운드에서 diff 내용 자체가 늘어난 것은 아니며 기존 처분이 그대로
    유지된다.
  - 제안: 기존 처분(공개·저위험) 유지로 충분. 새 조치 불요.

- **[INFO]** `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재실행 위험의 규약 차원 처리는 구현
  확장 없이 plan 항목 등재로만 그쳤다 — 범위 위반 아님, 확인 기재
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:395-428` (신규 `- [ ]` 블록,
    커밋 `608caf02b`)
  - 상세: `23_02_51` W1(재실행 시 invalid 인덱스 잔존 위험)에 대해 V110 자신은 DROP-먼저
    순서로 완전히 고쳤으나(`dd6549796`), 동일 결함이 남아 있는 선례 `V056`/`V106`(이미 적용된
    append-only 마이그레이션)에 대한 규약·런북 차원 처리는 이 PR 이 구현하지 않고 plan
    항목으로만 등재했다. `spec/conventions/migrations.md`·`codebase/backend/migrations/README.md`
    는 이 diff 에서 건드리지 않았음을 `git diff --stat`(47개 파일 목록)로 직접 확인했다 —
    등재만 하고 실제 성문화는 하지 않아 self-consistent 하다. `spec/conventions/` 쓰기는
    planner 트랙이라는 이 저장소 규약과도 일치한다.
  - 제안: 조치 불요 — 위험의 문서화·이관일 뿐 구현 확장이 아니므로 범위 위반이 아니다.

- **[INFO]** changeset 51개 파일 중 43개(84%)가 직전 두 라운드의 리뷰/consistency-check
  산출물 커밋 — 실질 코드 변경(195줄) 대비 문서 부피가 크다
  - 위치: `review/code/2026/09/04/23_02_51/**`(13개, 커밋 `4be23e1ef`),
    `review/code/2026/09/04/23_26_09/**`(14개, 커밋 `608caf02b`),
    `review/consistency/2026/09/04/22_34_55/**`(11개, 커밋 `6143b8c9f`),
    `review/consistency/2026/09/04/22_43_40/**`(8개, 커밋 `8a610e787`)
  - 상세: CLAUDE.md 가 "코드 리뷰 산출물"·"일관성 검토 산출물"의 SoT 위치로
    `review/code/**`·`review/consistency/**` 를 명시하므로, 이 커밋들이 그 자체로 범위
    이탈은 아니다. 각 커밋을 `git show --stat` 으로 직접 대조한 결과 리뷰/consistency 라운드
    커밋은 해당 라운드의 산출 파일만 담고 코드 변경과 섞여 있지 않다(단, `608caf02b` 는
    RESOLUTION 대응으로 `spec-draft-nullable-notation-followups.md` +15줄도 함께 포함 —
    같은 라운드의 WARNING 조치이므로 문제 아님). 참고 기록으로만 남긴다.
  - 제안: 조치 불요.

## 위반 없음으로 확인된 항목

- `git diff --stat origin/main..HEAD -- codebase/` 결과 실질 코드 변경은 정확히 4개 파일
  (`V110__schedule_workspace_next_run_index.{conf,sql}`, `schedules.service.spec.ts`,
  `schedule-trigger.e2e-spec.ts`)뿐이다. controller/service 등 다른 레이어는 건드리지
  않았다 — `schedules.controller.ts`/`schedules.service.ts` 자체는 diff 밖.
- `schedule-trigger.e2e-spec.ts` 전체 diff 를 직접 열어 확인한 결과 삭제 줄은 0 —
  순수 추가(신규 schema 테스트 + `J.` 목록 조회 테스트)이며 기존 테스트 로직 변경은 없다.
  직전 라운드(`23_02_51`)가 지적한 "`J.` 가 `H.`/`I.` 사이에 삽입돼 물리 순서=알파벳 관례가
  깨졌다"는 WARNING 은 이번 diff 에서 실제로 파일 끝(`I.` 뒤)으로 재배치돼 있음을
  `grep -n "it('[A-Z]\."` 로 직접 재확인했다(`A`→`J` 순서 일치, 해소 확인).
- `plan/complete/spec-draft-schedule-index.md` 는 `git log --follow` 로 `git mv` 이력이
  보존됨을 확인 — history 를 끊지 않은 정상 이동이며, 소스 plan
  (`spec-draft-nullable-notation-followups.md`)의 상대 링크도 `../complete/...` 로 함께
  갱신돼 있다.
- `spec/1-data-model.md`, `spec/data-flow/10-triggers.md` — 각각 해당 인덱스를 서술하는
  표 행/문구만 수정(+ 위 trigger_id 행 1개). 무관 섹션 리플로우·포맷팅 변경 없음.
- import 정리, 불필요한 주석 변경, lint/CI/빌드 설정 파일 변경은 diff 전체에서 발견되지
  않았다. `.conf` 신규 파일은 마이그레이션 자체에 내재한 Flyway 트랜잭션 설정이라 "무관한
  설정 변경"에 해당하지 않는다.
- `spec/conventions/migrations.md`·`codebase/backend/migrations/README.md` 는 신규 등재된
  후속 항목이 가리키는 대상임에도 이번 diff 에서 실제로 수정되지 않았다 — 등재만 하고
  구현을 앞서가지 않았음을 확인.

## 요약

핵심 코드 변경(`V110` 마이그레이션 쌍 + e2e/unit 테스트 4개 파일, 195줄)은 "쓰이지 않는
`idx_schedule_next_run` 부분 인덱스를 `(workspace_id, next_run_at)` 로 교체"라는 단일
목표에서 벗어나지 않는다. controller/service 로직, import, 설정 파일, 포맷팅에 대한
의도 밖 수정은 발견되지 않았고, 직전 라운드가 지적한 테스트 배치 순서 WARNING 은 실제로
해소됨을 코드에서 직접 재확인했다. changeset 의 나머지 대부분(43/51 파일)은 이 저장소
관례상 SoT 로 지정된 `review/code/**`/`review/consistency/**` 산출물 커밋이라 범위
이탈로 보지 않는다. 유일하게 반복 지적되는 지점(§`Schedule (trigger_id)` 행 드라이브바이)은
이미 두 차례 검토·공개·저위험으로 처분된 항목이 그대로 유지된 것뿐이며, 새로운 규약 후속
항목 등재도 구현 확장 없이 문서화에 그쳐 범위 위반이 아니다.

## 위험도

NONE
