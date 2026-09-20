# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `jest.spyOn` 스파이 두 건이 명시적으로 복구(`mockRestore`)되지 않는다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — 신규 테스트
    `cron 을 바꾸면 새 cron 으로 다시 계산해 nextRunAt 에 넣는다` (게이트 447~452행) ·
    `timezone 만 바꿔도 새 timezone 으로 다시 계산한다` (게이트 482~487행)
  - 상세: `jest.spyOn(service as unknown as {...}, 'computeNextRuns').mockReturnValue(...)` 로
    스파이를 걸고 테스트 종료 시 `mockRestore()`/`try…finally` 를 쓰지 않는다. 다만 실질적
    부작용은 없다 — `computeNextRuns` 는 `SchedulesService.prototype` 의 메서드이고, `service`
    는 매 테스트의 `beforeEach` (게이트 39~117행)에서 `moduleRef.get(SchedulesService)` 로
    **완전히 새로 생성**되므로 `jest.spyOn(service, …)` 이 만드는 것은 그 인스턴스에 한정된
    own-property 오버라이드다. 다음 테스트는 새 인스턴스를 받으므로 스파이가 전이되지
    않는다. 같은 describe 안의 기존 방어 분기 테스트(게이트 400~405행)도 동일하게
    `mockRestore` 없이 이 패턴을 이미 쓰고 있어, 이번 추가가 새 위험을 들여오는 것은 아니다.
    `jest.config` 에도 `restoreMocks`/`clearMocks` 전역 설정이 없음을 확인했다.
  - 제안: 현재로선 안전하지만, 향후 같은 `service` 인스턴스를 여러 테스트가 공유하도록
    리팩터링되면 이 누락이 실제 누수로 바뀐다. 일관성을 위해 `afterEach(() => jest.restoreAllMocks())`
    를 describe 상단에 추가하는 편이 방어적이다(강제는 아님).

- **[INFO]** 신규 커밋 파일(`review/consistency/.../_retry_state.json`, `meta.json`)에 로컬
  워크트리의 절대경로가 그대로 박제된다
  - 위치: `review/consistency/2026/09/20/14_01_01/_retry_state.json` (전체),
    `review/consistency/2026/09/20/14_01_01/meta.json`
  - 상세: `/Volumes/project/private/clemvion/.claude/worktrees/sched-recalc-unit-9c4e17/...` 형태의
    세션 로컬 절대경로가 `session_dir`/`prompt_file`/`output_file` 값으로 저장소에 커밋된다.
    이 자체는 프로젝트 관례(`feedback_consistency_meta_json_required_by_guard.md` — 가드가
    `meta.json` 을 요구)에 부합하는 산출물이라 "의도치 않은" 부작용은 아니지만, 워크트리가
    삭제된 뒤에는 이 경로들이 더 이상 유효하지 않은 채로 영구 보존된다는 점만 기록해 둔다.
    실행 동작에 영향은 없다(단순 감사 로그성 아티팩트).
  - 제안: 조치 불요 — 기존 관례와 일치. 참고용으로만 남긴다.

## 점검 관점별 확인

1. **의도치 않은 상태 변경** — 없음. 서비스 프로덕션 코드(`schedules.service.ts`)는 이번 diff 에서 전혀 변경되지 않았고, 테스트 파일에만 순수 추가(2개 `it` + 헬퍼 `scheduleRow`)가 있다. 각 테스트는 자신의 `beforeEach` 에서 새로 만든 `service`/`scheduleRepo`/`saved` 배열만 다루며 다른 테스트와 공유하는 가변 상태가 없다.
2. **전역 변수** — 없음. `scheduleRow` 헬퍼도 `describe` 블록 스코프에 갇혀 있고 새 module-level/전역 식별자를 만들지 않는다.
3. **파일시스템 부작용** — 리뷰 대상 파일 자체가 `review/`·`plan/` 산출물(신규 커밋 파일)이지만, 이는 프로젝트 워크플로가 규정한 정상적인 산출 위치이며 실행 시점에 예상 밖의 파일을 만들거나 지우지 않는다.
4. **시그니처 변경** — 없음. `computeNextRuns`, `update()` 등 어떤 시그니처도 바뀌지 않았다. 스파이는 런타임에 그 인스턴스의 메서드를 대체할 뿐 정적 시그니처에 영향 없다.
5. **인터페이스 변경** — 없음. 공개 API/DTO 변경 없음 (`spec_impact: none` 과 일치).
6. **환경 변수** — 없음. 읽기·쓰기 모두 관찰되지 않는다.
7. **네트워크 호출** — 없음. `scheduleRepo`/`triggerRepo`/`auditLogs`/`engine`/`runner` 전부 jest mock 이며, 신규 두 테스트도 `computeNextRuns` 를 spy 로 대체해 실제 cron 파싱·타임존 계산·DB 접근이 전혀 일어나지 않는다.
8. **이벤트/콜백** — 없음. 신규 테스트는 `scheduleRepo.save` 콜백을 관찰만 할 뿐 새 이벤트 발행·콜백 등록을 추가하지 않는다.

## 요약

이번 변경은 `SchedulesService.update()` 의 cron/timezone 재계산 happy-path를 고정하는 단위 테스트 2건 추가와 그에 딸린 plan/consistency 산출물 커밋으로, 프로덕션 코드·공개 인터페이스·전역 상태·환경 변수·네트워크 호출 어디에도 실질적인 부작용을 만들지 않는다. `jest.spyOn` 스파이 미복구는 현재 테스트 격리 구조(매 테스트 새 `service` 인스턴스) 덕분에 무해하며, 같은 파일의 기존 관행과도 일치한다. 커밋되는 consistency 산출물의 로컬 절대경로 박제는 프로젝트가 이미 채택한 관례이므로 조치가 필요한 결함이 아니다.

## 위험도

NONE
