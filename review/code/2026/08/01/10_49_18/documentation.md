STATUS=success 문서화 리뷰 완료 — WARNING 3건 (CRITICAL 없음)
===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — 감사 로깅 커버리지 확장 (workflow/trigger/schedule/model_config), 2차 라운드

## 검토 방법

이번 프롬프트 번들은 (1) 실제 기능 diff 20개 파일(감사 로깅 구현 + CHANGELOG + plan)과 (2) 직전 리뷰 라운드
(`review/code/2026/08/01/10_05_53/**`)·impl-prep consistency 라운드(`review/consistency/2026/08/01/09_11_58/**`)의
산출물이 커밋되며 새로 diff 에 편입된 25개 파일로 구성된다. 후자는 애플리케이션 문서가 아니라 리뷰
프로세스 산출물이므로, 본 리뷰는 (1)에 집중하되 (2) 중 `RESOLUTION.md`(감사 추적 문서로서의 정확성)는
문서화 관점 검토 대상에 포함했다. 프롬프트 크기 제한으로 생략된 파일(`model-config.service.spec.ts`,
`triggers.service.spec.ts`, `workflows.service.ts` 등)과 diff 에 드러나지 않는 주변 맥락(spec SoT 4곳,
`audit-action.const.ts` 전체, git 커밋 이력)은 `Read`/`Grep`/`git log`/`git show` 로 워크트리를 직접 열어
대조했다.

직전 라운드(`10_05_53`)의 documentation 리뷰가 WARNING 3건(spec SoT 미동기화·CHANGELOG 누락·죽은 코드+주석
불일치)을 남겼고, `RESOLUTION.md` 는 CHANGELOG 항목 추가(W2)와 죽은 코드 제거(W10)를 조치했다고 기록한다.
두 건 모두 직접 확인한 결과 정확히 반영됐다(`CHANGELOG.md` 최상단 신규 섹션 확인,
`triggers.service.spec.ts:2167-2171` 에서 `void idx` 잔재 없음 확인). 다만 spec SoT 미동기화(W1)는 여전히
미해결이며, 이번 조치 커밋 자체가 문서 정확성 결함 2건을 새로 남겼다.

## 발견사항

- **[WARNING]** spec SoT 4곳이 이번에 구현된 12개 액션(workflow.created/updated/deleted · trigger.* ·
  schedule.* · model_config.*)을 여전히 "Planned/미구현"으로 서술 — `audit-action.const.ts` 자신의 SoT
  주석과도 상충하는 상태로 남아 있음 (직전 라운드 W1 이 재확인됨, 미해결)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:2`(변경 없는 헤더 — "SoT:
    spec/5-system/1-auth.md §4.1 '구현된 액션' 표.") ↔ `spec/5-system/1-auth.md:429,433-438`(Planned
    표에 12개 액션 그대로 등재) · `spec/data-flow/1-audit.md:82,85`("여전히 미구현이다 — workflows /
    triggers / alerts / schedules 모듈에는 AuditLogsService import 가 전혀 없다") ·
    `spec/conventions/audit-actions.md:56-59`(workflow/trigger/schedule/model_config 4행 상태 컬럼
    "미구현") · `spec/2-navigation/2-trigger-list.md:182,252`(액션명 자체가 오기 — `trigger.delete`/
    `trigger.update` 로 서술하지만 실제 구현은 `AUDIT_ACTIONS.TRIGGER_DELETED = 'trigger.deleted'`/
    `TRIGGER_UPDATED = 'trigger.updated'`, 과거분사)
  - 상세: 직접 `Read`/`grep` 으로 위 4개 spec 파일의 현재 상태를 재확인한 결과, 이번 diff 가 완료한
    구현(4개 모듈에 `AuditLogsService` 실배선, 12개 액션 기록)과 정반대로 아직도 "미구현"이라고 서술한다.
    특히 `audit-action.const.ts:2`("SoT: ... §4.1 '구현된 액션' 표")는 이번 diff 가 새로 추가한 헤더
    문단(32-43행)과 같은 파일 안에서 자기 모순을 만든다 — 파일 자신은 "내 SoT 는 §4.1 구현된 액션 표"라고
    주장하지만, 실제로 그 표(§4.1)에는 지금 추가된 12개 액션이 없고 여전히 "Planned" 표에 있다. 이 문제는
    developer 권한 밖(`spec/` read-only)이라 이번 diff 가 직접 고칠 수 없고, `plan/in-progress/spec-sync-
    auth-gaps.md`(§4.1 구현 후속, 아래 항목)와 `review/code/.../10_05_53/RESOLUTION.md`(W1 미조치 근거)가
    "planner 턴 필요"로 올바르게 인계해뒀다 — 절차는 맞다. 다만 지금 이 순간 spec 을 읽는 사람(다음
    project-planner·spec-coverage 감사·타 개발자)은 "구현된 기능을 미구현"으로 오인하며,
    `2-trigger-list.md` 는 한 걸음 더 나아가 틀린 액션 문자열(`trigger.delete` vs 실제 `trigger.deleted`)을
    단정문으로 서술해 실제로 구현이 완료된 지금도 여전히 사실과 다르다.
  - 제안: (project-planner 턴, 이미 `plan/in-progress/spec-sync-auth-gaps.md:38-42` 에 인계됨) 같은 커밋에서
    `1-auth.md §4.1` Planned→구현 이동(`workflow.executed` 만 Planned 잔류) · `data-flow/1-audit.md §1.1`
    커버리지 갭 문단 갱신 · `audit-actions.md §3` 상태 컬럼 갱신 · `2-trigger-list.md:182,252` 액션명 정정
    (`trigger.delete`→`trigger.deleted`, `trigger.update`→`trigger.updated`)을 동시 수행. 이번 PR 범위는
    아니므로 개발자 조치를 요구하는 항목은 아님 — 다음 planner 턴 착수 시 반드시 반영되어야 함을 재확인하는
    차원의 기록.

- **[WARNING]** `plan/in-progress/spec-sync-auth-gaps.md` §4.1 항목이 새 주석과 옛 본문이 부딪혀
  자기모순 문장이 됨 — "구현 완료"라고 쓴 바로 다음 절이 "미구현"이라 이어짐
  - 위치: `plan/in-progress/spec-sync-auth-gaps.md:15-17`
  - 상세: 이번 diff 는 체크박스를 `[ ]`→`[x]` 로 바꾸고 굵은 글씨로 "**CRUD 13개 구현 완료
    (2026-08-01)**." 를 제목 바로 뒤에 삽입했는데, 그 뒤에 원래 있던 문장("`workflow.*` / `trigger.*` /
    `schedule.*` / `model_config.*`(...) 액션이 미구현. 실측: `workflows`·`triggers`·`schedules`·
    `model-config` 모듈에 `AuditLogsService` import **0건**.")은 그대로 남겨뒀다. 그 결과 한 문단 안에서
    "CRUD 13개 구현 완료(2026-08-01). — ... 액션이 미구현. 실측: ... import 0건." 이 이어져 문장이 스스로
    모순되고, "import 0건"이라는 실측 주장은 지금 시점 기준으로 거짓이다(이번 diff 로 4개 모듈
    `model-config.module.ts`/`schedules.module.ts`/`triggers.module.ts`/`workflows.module.ts` 모두
    `AuditLogsModule` 을 import 함을 `Read` 로 확인). 체크박스가 `[x]`(완료)로 바뀌었는데 그 설명 본문이
    "미구현"이라고 말하는 것은, 이 plan 파일을 훑어보는 사람에게 실제로 무엇이 끝났는지에 대한 혼선을
    준다 — 특히 아래 새로 추가된 "§4.1 구현 후속 (2026-08-01)" 절과 조합하면 "이 항목 자체는 됐다는
    건가, 안 됐다는 건가"를 다시 읽어야 한다.
  - 제안: `:16-17` 의 "액션이 미구현. 실측: ... import 0건." 문장을 과거 시제/이력 표기로 바꾸거나("당시
    실측(2026-06-03): import 0건 — 이후 2026-08-01 구현으로 해소") 삭제하고, 완료 서술과 원래
    갭 설명이 한 문단에서 충돌하지 않도록 정리할 것.

- **[WARNING]** `RESOLUTION.md` 가 C1 조치 커밋으로 존재하지 않는 해시를 인용 — 감사 추적 문서 자신의
  근거가 재현 불가
  - 위치: `review/code/2026/08/01/10_05_53/RESOLUTION.md:9` (조치 항목 표, C1 행 마지막 셀 `` `2a1f8c1` ``)
  - 상세: `git log --all --oneline | grep 2a1f8c1` 실행 결과 이 해시는 이 저장소 어디에도 존재하지 않는다.
    C1 행이 서술하는 내용("서비스 시그니처에 필수 `userId` 를 추가하면서 기존 spec 호출부 70곳을
    갱신하지 않아 `tsc --noEmit` 이 TS2554 로 깨졌다 … 잔여 20건은 기존 오류 … 23건이라 오히려 3건
    줄었다")은 실제 커밋 `f77c1e0de`("fix(test): 리뷰 C1 — spec 호출부 70곳에 userId 추가 (tsc --noEmit
    복구)")의 커밋 메시지와 문자 그대로 일치한다 — 즉 서술 자체는 정확하지만 인용된 해시만 틀렸다. 이
    파일은 감사 로깅 기능 자체를 다루는 PR 의 부속 문서이자, 리뷰 발견사항이 "언제 어느 커밋으로
    조치됐는지"를 추적하는 감사 추적(audit trail) 역할을 한다 — 그 안의 커밋 참조가 잘못돼 있으면
    `git show 2a1f8c1` 로 조치 diff 를 확인하려는 다음 사람(감사자·후속 리뷰어)이 "unknown revision"
    오류만 받는다. C2 행 이하는 `(본 커밋)`(=`a92f53df6`, `RESOLUTION.md` 자신이 커밋된 그 커밋)으로
    올바르게 표기돼 있어, C1 행만의 국소적 오기로 보인다.
  - 제안: `RESOLUTION.md:9` 의 `` `2a1f8c1` `` 를 실제 커밋 `` `f77c1e0de` `` 로 정정. 향후 RESOLUTION
    작성 시 해시는 `git log --oneline` 출력을 직접 붙여넣거나 커밋 직후 `git rev-parse --short HEAD` 로
    재확인할 것을 권장(rebase/amend 로 해시가 바뀌는 경우도 있으므로 최종 push 직전 1회 재검증).

## 확인했으나 문제 없음 — 긍정적으로 평가한 지점

- **CHANGELOG.md**: 직전 라운드 W2(누락) 조치가 정확히 반영됨. `## Unreleased — 감사 로깅 커버리지 확장`
  섹션(`CHANGELOG.md:3-29`)이 신규 액션 13개·시제 근거·"커밋 직후 기록" 원칙·`workflow.executed` 제외
  사유(카디널리티·보존 정책 미정)를 모두 포함하고, 실제 코드(`recordAudit` 호출 시점·액션 목록)와
  대조해도 정확하다. `workflow.created(생성·복제)` 표기도 `workflows.service.ts:397-403` 의
  `duplicate()` 가 `WORKFLOW_CREATED` 액션 + `details.duplicatedFrom` 을 남기는 것과 정확히 일치한다.
- **`recordAudit` 헬퍼 JSDoc 4곳**(`model-config.service.ts:232-238`, `schedules.service.ts:136-140`,
  `triggers.service.ts:202-208`, `workflows.service.ts:170-173`): named-field 설계의 이유(positional
  인자였다면 동일 타입 순서 스왑을 컴파일러가 못 잡는다)를 선례 `auth-configs.service.ts:85-86`
  ("code review W-1")와 정확히 대조해 인용 — `grep` 으로 실재 확인. `details.kind`/`details.type` 을
  남기는 이유도 구체적이다.
- **트랜잭션 경계 인라인 주석**: `schedules.service.ts:186-187`·`triggers.service.ts:259-261,341-343`의
  "커밋 직후 기록 — 외부 호출(BullMQ/secret store)이 실패해도 감사는 남는다 (리뷰 W6)" 주석은
  `RESOLUTION.md` W6 조치와 정확히 대응하고, `model-config`/`workflows` 는애초 이 문제가 없었기에 해당
  주석이 없는 것도 일관적이다. `remove()` 앞의 "TypeORM `remove` 는 엔티티의 id 를 지운다" 류 주석
  (`model-config.service.ts:396-397`, `triggers.service.ts:868-869`)도 TypeORM 의 실제 동작과 일치한다.
- **테스트 파일의 "왜 이렇게 짰는가" 주석**: `workflows.service.spec.ts:786-788,821-823`,
  `model-config.service.spec.ts` 신규 `감사 로깅` describe 블록의 "경계를 양쪽 다 찍어야 한다 — 실측:
  그 뮤턴트가 GREEN" 류 주석은 `RESOLUTION.md` 가 기록한 뮤턴트 발견(vacuous 테스트 2건)과 정확히
  대응하며, 왜 그 형태로 테스트가 짜였는지를 다음 사람이 재현할 수 있게 남겨져 있다.
  `triggers.service.spec.ts:2167-2171` 의 죽은 코드(직전 라운드 W10)는 삭제됐고 주석도 실제 override
  지점 바로 위로 옮겨져 있어 더 이상 어긋나지 않는다.
  - 참고로 `2-navigation/2-trigger-list.md` 관련 및 `spec/**` 4곳 갱신 항목은 개발자 권한 밖이라
    이번 조치 목록에 없는 것이 아니라, `RESOLUTION.md`·`plan/in-progress/spec-sync-auth-gaps.md`
    양쪽에 일관되게 "planner 턴 필요"로 인계돼 있다 — 인계 자체는 절차상 올바르다(위 WARNING 참고).
- **Swagger/API 문서**: `@CurrentUser('sub') userId` 는 JWT 세션에서 파생되는 파라미터라 `@Body`/
  `@Query`/`@Param` 로 노출되지 않으므로 Swagger 데코레이터 갱신이 불필요하다는 직전 라운드
  `user_guide_sync.md` 결론을 코드로 재확인했다(4개 컨트롤러 모두 `@ApiOperation`/`@ApiOkWrappedResponse`
  등 기존 Swagger 데코레이터 변경 없음).

## 요약

새로 추가된 애플리케이션 코드 자체의 문서화 품질은 이 저장소 평균 이상이다 — CHANGELOG 는 직전 라운드
지적을 정확히 반영했고, 4개 서비스에 반복되는 `recordAudit` JSDoc·트랜잭션 경계/TypeORM 동작을 설명하는
인라인 주석·테스트의 "왜 이렇게 짰는가" 주석까지 실제 코드·커밋 이력과 대조해도 전부 정확했다. 다만 이번
2차 라운드에서 확인한 문서 정합성 문제는 두 층위다. 첫째, 직전 라운드가 지적한 spec SoT 4곳 미동기화(W1)는
여전히 미해결로 남아 있다 — `spec/5-system/1-auth.md`·`spec/data-flow/1-audit.md`·
`spec/conventions/audit-actions.md`·`spec/2-navigation/2-trigger-list.md` 가 지금 이 순간에도 이미 구현된
12개 감사 액션을 "미구현"으로 서술하며, `2-trigger-list.md` 는 실제 구현된 액션명과 다른 오기까지 갖고
있다. 이는 developer 권한 밖(spec read-only)이라 이번 PR 이 직접 고칠 수 없고 planner 턴으로 올바르게
인계돼 있어 이번 diff 자체의 결함은 아니지만, spec 을 읽는 다음 사람에게는 여전히 실질적 오정보다. 둘째,
이번 조치 라운드 자신이 새로 만든 문서 정확성 결함 2건 — `plan/in-progress/spec-sync-auth-gaps.md` 의
자기모순 문장("구현 완료"와 "미구현...0건"이 한 문단에 공존)과 `RESOLUTION.md` 의 존재하지 않는 커밋 해시
인용(`2a1f8c1`, 실제는 `f77c1e0de`) — 을 확인했다. 둘 다 소규모 수정으로 해결 가능하며 런타임 동작에는
영향이 없지만, 후자는 감사 추적 문서 자신의 신뢰성을 깎는다는 점에서(이 PR 이 추가하려는 기능이
"신뢰할 수 있는 변경 이력"임을 감안하면) 가볍게 넘기기 아쉬운 지점이다.

## 위험도

MEDIUM
