# 부작용(Side Effect) 리뷰

## 검토 범위

이번 라운드(`14_42_10`)의 diff 는 `origin/main` 대비 전체 누적분이라, 1라운드에서 이미 검토된
`schedules.service.spec.ts` 의 앞 두 신규 테스트 + 1라운드 산출물(`review/code/.../14_22_46/**`,
`review/consistency/.../14_01_01/**`) 이 다시 포함돼 있다. 실질적으로 **새로** 검토할 부분은
1라운드 RESOLUTION(`ae060b266`)이 추가한 세 번째 테스트(대조군)와 그 RESOLUTION/이전 라운드
산출물 커밋(`a7cb7f79b`)뿐이다. 프로덕션 코드(`schedules.service.ts`)는 이번 **diff** 어디에서도
변경되지 않았다 — `git diff origin/main...HEAD --stat` 로 확인, 테스트 파일·plan·review 산출물만
21개 파일에 걸쳐 변경.

## 발견사항

- **[INFO]** 리뷰 도중 `schedules.service.ts` 가 순간적으로 뮤테이션된 상태를 직접 관측했다 —
  1라운드 SUMMARY 가 기록한 것과 같은 형태
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:266`
    (`if (dto.cronExpression || dto.timezone) {` 분기)
  - 상세: 이 파일 조사 도중 harness 가 "파일이 마지막으로 읽은 뒤 디스크에서 바뀌었다"고
    알려, `git status`/`git diff` 로 확인했더니 그 시점엔 266행이 `if (true) {` 로 치환된
    **커밋되지 않은 작업트리 변경**이 실제로 존재했다(`git status --short` 에 `M
    codebase/.../schedules.service.ts`). 직후 재확인하니 원래 조건으로 돌아와 있었고
    `git status --short` 도 다시 clean 이었다 — 즉 내가 관측하는 사이에 **다른 세션이 뮤턴트를
    넣었다가 스스로 원복**한 것으로 보인다. 이 파일은 이번 changeset(`git diff
    origin/main...HEAD`)에 전혀 포함돼 있지 않으므로 이번 diff 가 만든 부작용은 아니다. 1라운드
    SUMMARY(`review/code/2026/09/20/14_22_46/SUMMARY.md` INFO 2)·RESOLUTION 이 이미 "두 reviewer가
    독립 관측 · 병렬 세션(뮤턴트 판별력 검증)의 잔상으로 추정 · 조치 불요"로 정리한 바로 그 형태가
    2라운드에서도 재발했다는 뜻이다. 이 리뷰 자신은 저장소에 아무것도 쓰지 않았다(뮤테이션 규약
    §1~§3 준수, 아래 "원복 확인" 참조) — 관측한 값을 지어내거나 되돌리려 하지 않았다.
  - 제안: 조치 불요(이번 diff 밖, 자체 원복 확인). 다만 이 형태가 라운드마다 재발한다는 점은
    기록해 둘 가치가 있다 — 병렬 fan-out 리뷰가 공유 워크트리에서 도는 동안 다른 세션의 뮤턴트
    검증(`cp` 백업 → 치환 → 원복) 타이밍과 리뷰어의 파일 스냅숏 타이밍이 겹칠 수 있음을 보여주는
    반복 사례.

- **[INFO]** `jest.spyOn` 스파이 3건(기존 2건 + 신규 대조군 1건)이 여전히 명시적으로 복구되지 않는다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — 신규 대조군 테스트
    `cron · timezone 을 안 바꾸면 재계산하지 않는다 — nextRunAt 이 그대로다` 내부의
    `jest.spyOn(service as unknown as {...}, 'computeNextRuns')` 호출 (게이트 512행)
  - 상세: 1라운드에서 이미 지적한 패턴과 동일하다 — `computeNextRuns` 는 `SchedulesService.prototype`
    의 private 메서드(`schedules.service.ts:407`)이고, `service` 는 매 테스트의 `beforeEach`
    (게이트 39행 이하)에서 `moduleRef.get(SchedulesService)` 로 완전히 새로 생성되므로
    `jest.spyOn(service, …)` 은 그 인스턴스에 한정된 own-property 오버라이드다. 다음 테스트는
    새 인스턴스를 받으므로 스파이가 전이되지 않는다. 이번 대조군 테스트는 `.mockReturnValue()`
    도 걸지 않은 채(패스스루) `not.toHaveBeenCalled()` 만 단언하므로, 설령 호출됐더라도 실제
    cron 파싱 로직이 도는 것 외의 부작용은 없다. 실질적 위험은 여전히 없다.
  - 제안: 조치 불요(1라운드 판단 유지). 방어적으로 원한다면 describe 상단에
    `afterEach(() => jest.restoreAllMocks())` 를 추가할 수 있으나 강제 아님.

- **[INFO]** `_retry_state.json` 두 건이 "미완료" 스냅숏 그대로 커밋된다
  - 위치: `review/code/2026/09/20/14_22_46/_retry_state.json`, `review/consistency/2026/09/20/14_01_01/_retry_state.json`
  - 상세: 두 파일 모두 `routing_status: "pending"`, `agents_success: []`, `agents_pending` 에
    전체 에이전트 목록이 그대로 남아 있다 — 실제로는 SUMMARY.md 가 forced 7명(또는 5개 checker)
    전원의 완료 결과를 담고 있는데도, 커밋된 `_retry_state.json` 은 루프 시작 시점의 초기 상태를
    보존한 값이다. 다른 세션의 harness 코드가 이 파일을 "리뷰가 아직 안 끝났다"는 판단 근거로
    읽는다면 오판할 여지가 있다. 다만 같은 저장소의 더 이른 라운드
    (`review/code/2026/09/20/12_45_31/_retry_state.json` 등)도 동일하게 `pending`/`[]` 로 커밋돼
    있어, 이는 이번 diff 가 새로 들여온 문제가 아니라 harness 의 기존 산출 관례(완료 상태는
    SUMMARY.md/개별 리뷰어 `.md` 로만 판정하고 `_retry_state.json` 은 감사용 초기 스냅숏으로
    남긴다)로 보인다. "관측한 이상 상태는 보고하라"는 지침에 따라 기록만 해 둔다.
  - 제안: 조치 불요(기존 관례와 일치, 이번 세션의 결함 아님). 다만 향후 어떤 자동화가
    `_retry_state.json` 의 `routing_status`/`agents_pending` 을 완료 판정에 실제로 사용하게
    된다면 이 스냅숏-vs-실제 괴리가 거짓 차단을 일으킬 수 있다는 점만 참고.

## 점검 관점별 확인

1. **의도치 않은 상태 변경** — 없음(이번 diff 기준). 프로덕션 코드 변경 0. 신규 대조군
   테스트도 자신의 `beforeEach` 로 받은 `service`/`scheduleRepo`/`saved` 배열만 다루고, 다른
   테스트와 공유하는 가변 상태를 만들지 않는다. 위에서 관측한 `schedules.service.ts` 순간
   뮤테이션은 이번 changeset 밖의 병렬 세션 잔상이며 자체 원복됐다.
2. **전역 변수** — 없음. 새 module-level/전역 식별자 없음. `scheduleRow()` 헬퍼도 `describe`
   블록 스코프에 갇혀 있다.
3. **파일시스템 부작용** — 신규 커밋 파일(`plan/in-progress/sched-recalc-unit.md`,
   `review/code/**`, `review/consistency/**`) 은 모두 프로젝트가 규정한 산출물 경로에 부합한다.
   위 INFO 항목들(스냅숏-vs-실제 괴리, 병렬 세션의 순간 뮤테이션)을 제외하면 예상 밖의
   생성·수정·삭제 없음.
4. **시그니처 변경** — 없음. `computeNextRuns`, `update()` 등 시그니처 불변. 스파이는 런타임
   인스턴스 오버라이드일 뿐 정적 시그니처와 무관.
5. **인터페이스 변경** — 없음. 공개 API/DTO 변경 없음(`spec_impact: none` 과 일치, 커밋 스탯도
   `schedules.service.ts` 자체가 diff 에 없음을 확인).
6. **환경 변수** — 없음.
7. **네트워크 호출** — 없음. 모든 의존성이 jest mock, `computeNextRuns` 도 spy 로 대체돼 실제
   cron 파싱·DB 접근이 없다.
8. **이벤트/콜백** — 없음. 신규 대조군 테스트는 `scheduleRepo.save` 콜백을 관찰만 하고 새 이벤트
   발행·콜백 등록을 추가하지 않는다.

## 원복 확인

이번 리뷰는 저장소 파일을 뮤테이트하지 않았다(읽기 전용 조사만 수행 — `Read`/`Bash grep`/`git
status`/`git diff` 뿐, 어떤 파일도 쓰지 않았다). 위 첫 INFO 항목에서 관측한
`schedules.service.ts` 의 순간 변경은 **내가 만든 것이 아니며** 관측 시점 이후 스스로
원복돼 있었다(관측 직후 재확인). `git status --short` 로 최종 확인 — 이번 리뷰 세션 자신의
산출물 디렉터리(`review/code/2026/09/20/14_42_10/`, untracked)만 남아 있고 그 외 잔여물 없음.

## 요약

이번 라운드에서 실질적으로 추가된 코드는 1라운드 RESOLUTION 이 넣은 대조군 단위 테스트 1건
(`ae060b266`)뿐이며, 기존 두 happy-path 테스트와 동일한 격리 구조(매 테스트 새 `service`
인스턴스)를 그대로 따르므로 spy 미복구가 실질 누수로 이어지지 않는다. 프로덕션 코드·공개
인터페이스·전역 상태·환경 변수·네트워크 호출 어디에도 이번 diff 가 만든 부작용은 없다. 다만
리뷰 도중 `schedules.service.ts` 266행이 순간적으로 `if (true)` 로 뮤테이션된 상태를 직접
관측했다 — 1라운드에서 이미 같은 형태로 보고·정리된 병렬 세션(뮤턴트 판별력 검증)의 잔상이
재발한 것으로, 이번 changeset 에는 포함되지 않고 자체 원복도 확인했다. 그 외 기록해 둘 관측은
커밋된 `_retry_state.json` 스냅숏이 "미완료" 상태 그대로 저장된다는 점인데, 이 역시 이전
라운드들에서도 동일하게 나타나는 harness 의 기존 산출 관례다.

## 위험도

NONE
