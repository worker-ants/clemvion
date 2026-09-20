# 요구사항(Requirement) 리뷰 — trigger 동시 DELETE 감사 중복 수정

## 발견사항

- **[INFO]** 리뷰 중 공유 워크트리에서 `triggers.service.ts` 의 일시적 뮤테이션을 관측함(내가 만든 것 아님)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`remove()` 의 `.catch` 블록)
  - 상세: 리뷰 도중 `Read` 로 이 파일을 다시 열었을 때, `.catch` 블록의 `this.logger.error(...)` 호출이
    `// [MUTATION-TEST] logger.error call deleted — checking if any test catches this.` 로 치환된 상태를
    한 번 관측했다. 이는 병렬로 도는 다른 reviewer 가 뮤테이션 검증을 위해 저장소 파일을 직접 고친
    흔적으로 보인다(본 프롬프트가 경고한 "다른 reviewer 들이 같은 워킹트리를 동시에 읽고 있다" 상황).
    이후 재확인한 결과 파일은 이미 `HEAD` 와 정확히 일치하고(`git diff` 무출력), `git status --short` 는
    `review/code/2026/09/20/22_07_23/` 외에 아무 변경도 보고하지 않는다 — 즉 그 reviewer 가 스스로
    원복을 완료한 것으로 보인다. 나는 이 파일에 어떤 쓰기도 하지 않았다.
  - 제안: 코드 결함이 아니므로 조치 불요. 다만 후속 fan-out 라운드에서 같은 파일을 다시 읽는 reviewer 가
    있다면 이 관측을 참고해 거짓 결함으로 오인하지 않도록 SUMMARY 취합자에게 공유할 것.

- **[WARNING]** `[SPEC-DRIFT 아님, 완성도 과장]` plan 제목 "네 삭제 경로 중 마지막 한 자리" 가 실제 범위보다 넓게 주장함 — `SchedulesService.remove()` 자신의 스케줄 행 삭제는 동일 결함 클래스에서 아직 보호되지 않는다
  - 위치: `plan/in-progress/trigger-dup-delete.md` (제목, 1번째 헤딩) · 비교 대상
    `codebase/backend/src/modules/schedules/schedules.service.ts` 의 `remove()` 함수
  - 상세: 이번 diff 는 `TriggersService.remove()` 하나를 정확히 고쳤고(§4.4 의도대로), 그 자체는 완전하다.
    다만 plan 제목과 커밋 메시지(`bb0cfbe3b`)가 "트리거·스케줄·워크플로·워크스페이스, 네 삭제 경로 중
    마지막 한 자리" 라고 적어 **네 엔티티 모두 같은 클래스의 감사 중복 결함이 이제 닫혔다** 는 인상을
    준다. 그러나 `SchedulesService.remove()` 를 읽으면(`schedules.service.ts:300-352`) 스케줄 자신의
    행(`SCHEDULE_DELETED` 감사)은:
    - `findById` 로 잠금 없이 선조회
    - `triggerId` 가 있으면 **트리거 행**에 대해서만 advisory lock(`trigger-config:<id>`) 을 잡고
      `m.delete(Trigger, triggerId)` 를 호출 — 이것도 0행이어도 던지지 않는다(단, 이 경로는 여기서
      별도 감사를 기록하지 않으므로 그 자체로 중복 감사를 만들지는 않음)
    - 그 후 `await this.scheduleRepository.remove(schedule)` 로 **스케줄 행 자신**을 지우는데, 이 호출은
      advisory lock 도, 재조회(`!fresh`) 가드도 전혀 거치지 않는다. TypeORM 의 `remove()` 는 대상 행이
      이미 없어도 던지지 않으므로, 두 클라이언트가 동시에 같은 스케줄을 삭제하면 이번에 트리거에서
      고친 것과 **글자 그대로 같은 형태**로 `SCHEDULE_DELETED` 감사가 두 번 남을 수 있다.
    - `codebase/backend/test/` 에는 `trigger-delete-concurrency` · `workflow-delete-concurrency` ·
      `workspace-delete-concurrency` 세 e2e 는 있지만 대응하는 `schedule-delete-concurrency` 는 없고,
      `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 트래커에도 "SchedulesService 가
      자기 행에 대해 이 결함을 갖는다" 는 항목이 없다(그 문서의 "네 자리" 서술(4501행)은 **트리거 config
      락 구조 중복**(`락→삭제→실패로깅→재던짐` 블록) 얘기이지, 스케줄 자신의 감사 중복 방어 여부와는
      다른 축이다).
  - 제안: 코드 되돌리기 대상 아님(이번 diff 는 정확). plan 제목의 "네 삭제 경로 중 마지막 한 자리" 를
    "트리거·워크플로·워크스페이스 세 경로" 로 좁히거나, `SchedulesService.remove()` 의 이 잔여 노출을
    별도 백로그 항목으로 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md` 또는 신규
    developer 항목)에 등재해 "네 자리 전부 닫혔다" 는 착시를 없앨 것을 권한다.

- **[INFO]** spec fidelity — 대상 spec 은 `spec/2-navigation/2-trigger-list.md` §4.4 이며 line-level 로 일치함
  - 위치: `spec/2-navigation/2-trigger-list.md:318` — "동시 삭제: 두 클라이언트가 동시에 같은 트리거를
    삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`"
  - 상세: `TriggersService.remove()` 의 새 코드(`throwTriggerNotFound()` → `NotFoundException({ code:
    'RESOURCE_NOT_FOUND', ... })`)가 이 문장을 정확히 구현한다. 이 문서 §4.4 가 이 diff 이전에는 (선행
    consistency 리뷰 `review/consistency/2026/09/20/21_43_47` INFO#1 이 지적한 대로) caveat 없이 사실이
    아닌 상태를 단정하고 있었는데, 이번 구현이 그 문장을 실제로 참으로 만든다. spec 문서 자체를 고칠
    필요는 없다(이미 옳게 서술돼 있었고 구현이 뒤따라온 경우) — SPEC-DRIFT 아님.

## 점검 관점별 확인 결과 (요약)

- **기능 완전성**: `remove()` 에 advisory lock 획득 뒤 `select: { id: true }` 재조회 + `!fresh` 404 단락을
  추가 — 의도한 기능(두 번째 동시 삭제 요청은 404, 감사 1건)을 완전히 구현.
- **엣지 케이스**: 락 안 재조회가 `workspaceId` 까지 스코프해 교차 워크스페이스 오탐 없음. 정상(행 존재)
  경로는 회귀 없이 그대로 `m.remove(trigger)` 진행(기존 lost-update 테스트들이 이를 고정).
- **TODO/FIXME**: 없음.
- **의도와 구현 간 괴리**: `remove()` 자체는 주석·구현 일치. 다만 plan 제목의 "네 자리 완결" 주장은 위
  WARNING 대로 실제보다 넓다.
- **에러 시나리오**: `.catch` 에서 `NotFoundException` 만 조용히 재던지고(거짓 "반쯤 삭제" 로그 억제),
  그 외 에러는 기존처럼 error 로그 후 재던짐 — 단위 테스트(`error).not.toHaveBeenCalled()` 및 기존
  `removeRejects` 케이스)가 양쪽을 갈라 고정.
- **데이터 유효성**: 재조회 조건절(`{ id, workspaceId }`)이 원 조회와 동일 스코프 — 유효.
- **비즈니스 로직**: spec §4.4 "두 번째 요청 404" 규칙을 정확히 반영. 워크플로/워크스페이스 선행 PR
  (`4a9828afe`, `ae4fbc374`)과 같은 형태(잠금 뒤 재확인 → 404 → catch 에서 NotFoundException 구분)로
  통일 — 일관성 있음.
- **반환값**: `remove(): Promise<void>` 계약 유지, 실패 시 예외로 신호 — 모든 경로에서 적절.
- **관련 spec 본문 일치**: 위 spec fidelity 참조 — 일치.

테스트(`triggers.service.spec.ts` 신규 케이스, `trigger-delete-concurrency.e2e-spec.ts`)는 판별력이
실측된 형태다 — plan 체크리스트가 기록한 대로 e2e 로 `[204, 204]`→`[204, 404]` 전이와 감사 2건→1건
전이를 실측했고, 단위 테스트 뮤턴트 검증 중 첫 뮤턴트가 무효(다른 메서드까지 지워 440줄 삭제)였음을
자인하고 재측정한 이력까지 plan 에 남아 있어 신뢰도가 높다.

## 요약

이번 diff 는 `TriggersService.remove()` 의 동시 DELETE 감사 중복 결함을 spec §4.4 문언 그대로,
선행 워크플로/워크스페이스 수정과 동일한 형태로 정확히 닫는다. 단위·e2e 테스트 모두 판별력이 실측된
형태로 추가돼 있고 회귀 위험은 낮다. 유일한 함몰점은 코드가 아니라 서술 범위다 — plan/커밋 메시지가
"네 삭제 경로(트리거·스케줄·워크플로·워크스페이스) 완결" 을 주장하지만 `SchedulesService.remove()` 의
자기 행 삭제(`SCHEDULE_DELETED` 감사)는 같은 클래스의 동시성 결함에 여전히 노출돼 있고 이를 추적하는
백로그 항목도 없다 — 이번 PR 의 코드 자체를 되돌릴 사유는 아니며, 완성도 서술 정정과 후속 백로그
등재를 권고한다. 아울러 리뷰 도중 공유 워크트리에서 다른 reviewer 로 추정되는 일시적 파일 뮤테이션을
관측했으나 이미 자체 원복돼 현재 상태는 깨끗함을 함께 기록한다.

## 위험도

LOW
