# 부작용(Side Effect) 리뷰 — trigger-deletion-release (2라운드 재확인)

이 트래커는 이전 라운드(`review/code/2026/09/17/18_45_09/side_effect.md`)에서 WARNING 1건·INFO 3건을
남겼고, `RESOLUTION.md`는 그중 워크스페이스 항목(#2·#4)을 "수정(가시화)"로, 로그 접두(#11)를
"수정"으로 처분했다고 기록했다(커밋 `097e583e1`). 이번 라운드는 그 처분이 실제로 반영됐는지와,
그 사이 추가된 커밋(`097e583e1`·`a11889086`·`048ddc271`)이 새 부작용을 만들지 않았는지를
저장소 파일을 직접 열어(Read/Grep/Bash, 뮤테이션 없음) 재확인했다. `git status --short` 로
확인한 잔여 변경 없음(내 세션의 리뷰 산출 디렉터리 외 미변경).

## 발견사항

- **[INFO]** 워크스페이스 삭제의 "잠금 없는 선검사 → 외부 해제 → 잠금 재검사" 순서는 재검사가
  역할 변경으로 거부돼도 이미 실행된 외부 해제(schedule job 취소·provider teardown·listener
  unregister)를 되돌리지 않는다 — 1라운드 WARNING 이 "가시화"로 처분됐고, 기능적으로는 여전히
  미복구 상태다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 함수 `deleteWorkspace`
    (내부 트랜잭션의 `.catch((err) => { this.logger.error(...) throw err; })` 블록, `assertWorkspaceDeletable`
    이 두 번 호출되는 지점)
  - 상세: 코드를 직접 열어 대조한 결과 처분 내용은 정확하다 — 트랜잭션이 재검사 실패로 던지면
    `WorkspacesService.deleteWorkspace: ... 그 트리거들의 schedule job·provider teardown·listener
    해제는 **이미 끝났으므로** 워크스페이스는 남았지만 트리거는 발화하지 않을 수 있다` 는 error 로그가
    남고 그대로 `throw err`(호출자에게 403/500 그대로 전파)된다. 즉 이전엔 **조용히** 사라지던
    부작용(계속 존재해야 할 워크스페이스의 트리거가 스케줄 미발화·인바운드 웹훅 미수신 상태로
    남는 것)이 지금은 **관측 가능**해졌을 뿐, 외부 자원을 재등록해 되돌리는 코드는 여전히 없다.
    CHANGELOG("남는 창" 문단)·`spec/2-navigation/2-trigger-list.md §4.3`·
    `plan/in-progress/trigger-deletion-release.md`(164행 체크리스트 "sweeper 재판단 항목 신설
    … planner 후속에 «워크스페이스 선검사 뒤 역할 변경» 잔여 추가")에 이 잔여가 명시적으로
    등재돼 있음을 확인했다 — 새로 발견한 미문서 이탈이 아니라, 문서화·추적된 트레이드오프가
    코드에 정확히 반영됐음을 재확인한 것이다.
  - 제안: 없음(추가 조치는 이미 plan 체크리스트에 트래커 항목으로 예정돼 있다). 다만 그 체크리스트
    항목이 아직 `- [ ]`(미완료)이므로, 이 PR 을 종결(`complete/` 이동)하기 전에 실제로 sweeper
    재판단 트래커·planner 후속 항목이 신설됐는지 별도 확인이 필요하다.

- **[INFO]** `ChatChannelBinderService` 의 로그 리터럴 접두가 `TriggersService:` → `ChatChannelBinderService:`
  로 4곳 모두 정정됐다 — 관측 가능한 로그 출력이 바뀌는 부작용이므로 배포 전 확인이 필요하다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (`setupChannel` 미등록
    warn, `setupChatChannel` 성공/실패 분기의 warn 2곳, `teardownChannelConfig` 의 best-effort warn)
  - 상세: `grep -n "TriggersService:" chat-channel-binder.service.ts` 로 재확인한 결과 남은 매치는
    JSDoc 설명문 1건뿐이고 실제 로그 리터럴은 전부 정정됐다. 의도적 정정(1라운드 documentation.md
    WARNING 처분)이고, 클래스 JSDoc 에도 "호출 경로가 늘수록 틀린 접두가 진단을 흐린다"는 근거가
    남아 있다. 다만 이 문자열을 grep 하는 로그 기반 알림·대시보드가 외부에 있다면(이 저장소
    범위 밖) 그쪽은 이번 변경으로 매칭이 조용히 끊긴다 — 코드 관점에서는 문제 없음, 배포
    체크리스트에 "로그 파싱 규칙 확인"을 한 줄 넣는 것을 권한다.
  - 제안: 없음(코드는 의도대로 정정됨). 운영 쪽 로그 파싱 규칙만 별도 확인 권장.

- **[INFO]** 생성자 시그니처 변경 4건(`TriggersService`·`SchedulesService`·`WorkflowsService`·
  `WorkspacesService`) — 전부 Nest DI 로만 소비되어 호출자 영향이 없음을 재확인.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`(`ChannelListenerRegistry` 제거 +
    `TriggerResourceReleaserService` 추가), `codebase/backend/src/modules/schedules/schedules.service.ts`
    (`SecretResolverService` 추가), `codebase/backend/src/modules/workflows/workflows.service.ts` /
    `codebase/backend/src/modules/workspaces/workspaces.service.ts`(`ModuleRef` 추가)
  - 상세: `grep -rn "new (TriggersService|SchedulesService|WorkflowsService|WorkspacesService)\("` 저장소
    전체에서 0건 — 네 서비스를 `new` 로 직접 생성하는 코드가 없어 파라미터 추가로 깨지는 수동
    호출자가 없다. `TriggersService` 에서 제거된 `ChannelListenerRegistry` 참조도 파일 전체에서
    완전히 사라졌음을 grep 으로 재확인(고아 필드 없음). 각 서비스의 `*.spec.ts` 도 새 생성자
    인자에 맞춰 함께 갱신돼 있다(diff 확인).
  - 제안: 없음.

- **[INFO]** `ChatChannelBinderService.teardownChannelConfig` 가 신규 public 메서드로 승격됨 —
  인터페이스 확장이지만 모듈 경계 밖으로는 노출되지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (`async
    teardownChannelConfig(triggerId, chatChannelCfg)`)
  - 상세: 이전엔 `teardownChatChannel` 안에 인라인된 로직이었는데, 이번에 별도 public 메서드로
    분리돼 `TriggerResourceReleaserService.undoAbsentWrite`와 같은 파일 내 로컬 `undoWrite` 헬퍼가
    재사용한다. `triggers.module.ts` 는 여전히 `ChatChannelBinderService` 를 `exports` 에 넣지 않으므로
    (`export 하지 않는다` 주석 그대로) 이 신규 public 표면은 `TriggersModule` 내부로 국한된다 — 외부
    모듈에서 우연히 호출할 길은 없다.
  - 제안: 없음.

- **[INFO]** `ModuleRef.get(TRIGGER_RESOURCE_RELEASER, {strict:false})` 서비스 로케이터가
  `WorkflowsService`/`WorkspacesService` 를 `TriggersModule` 가용성에 런타임으로 결합한다 — 1라운드
  side_effect.md·architecture.md 가 이미 INFO/WARNING 으로 남긴 것과 동일한 트레이드오프이며 이번
  라운드에서 변경 없음을 재확인.
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts`
    (`resolveTriggerResourceReleaser`), `workflows.service.ts`/`workspaces.service.ts` 호출부
  - 상세: 새로 발견한 이탈이 아니다. `app.module.ts` 에 `TriggersModule`·`WorkflowsModule`·
    `WorkspacesModule` 이 모두 등록돼 있어 실제 위험은 낮고, 1라운드 처분(#14 INFO)에서 planner
    후속(`4-execution-engine.md §4.4` 표에 throw 사례 추가)으로 넘기기로 확정됐다.
  - 제안: 없음(이미 planner 후속 대기 중).

## 확인했으나 문제 없음 (참고)

- `secrets.deleteByPrefix` 실제 호출부는 저장소 전체에서 `trigger-resource-release.ts` 의
  `deleteTriggerSecretsAfterCommit` 한 곳뿐임을 grep 으로 확인 — 트리거·스케줄·워크플로·워크스페이스
  네 삭제 경로가 전부 이 한 함수를 거치므로 이중 삭제·경로 누락 위험이 없다.
- `TriggerResourceReleaserService.removeScheduleJobsOrRestore` 가 schedule job 해제 중 하나라도
  실패하면 이미 해제한 **활성** job 만 재등록한 뒤 던진다 — 이 복구 로직이 던지는 시점은 chat-channel
  teardown 루프(같은 부모의 다른 트리거) **이전**이라, 스케줄 실패 시 다른 트리거의 provider
  teardown 이 부분적으로 실행되는 일이 없다(전부 멈춘다).
- `TriggersService.ts:670` 부근 주석("remove() 는 이미 teardownChatChannel·secrets.deleteByPrefix·
  BullMQ 해제·CASCADE 삭제를 마쳤으므로")은 문구상 나열 순서가 실제 새 순서(외부 해제 → CASCADE
  삭제 → 커밋 뒤 비밀)와 정확히 일치하지 않지만, "remove() 완료 시점엔 넷 다 끝나 있다"는 주석의
  핵심 주장 자체는 여전히 참이라 기능적 결함은 아니다(문서화 관점의 사소한 drift로만 기록).
- 신규 e2e 스펙(`trigger-deletion-releases-resources.e2e-spec.ts`)은 기존 e2e 인프라(Postgres·Redis
  BullMQ 컨테이너)에만 접속하고, provider 는 SQL 로 placeholder 암호문을 직접 심어 실제 외부
  네트워크(Telegram 등)를 호출하지 않는다 — 의도치 않은 외부 서비스 호출 없음.
- `plan/in-progress/trigger-deletion-release.md`, `review/code/2026/09/17/18_45_09/**`,
  `review/consistency/2026/09/17/18_00_19/**` 신규 파일은 프로젝트 표준 워크플로 산출물(계획
  트래킹·이전 리뷰 라운드 산출물의 커밋 반영)이며 예상 밖 파일시스템 부작용이 아니다.
- 환경 변수 읽기/쓰기 신규 없음(diff 전체에 `process.env` 참조 추가 없음, e2e 스펙의
  `process.env.E2E_BASE_URL` 은 기존 e2e 관례).

## 검증 방법

저장소를 수정하지 않고 `Read`/`Grep`/`Bash`(grep, git diff, git log)로 다음을 직접 대조했다:
`workspaces.service.ts`·`workflows.service.ts`·`triggers.service.ts`·`trigger-resource-releaser.service.ts`·
`trigger-resource-release.ts`·`chat-channel-binder.service.ts`·`schedules.service.ts`·`schedules.module.ts`·
`triggers.module.ts` 전체 파일, `deleteByPrefix`/`new (Triggers|Schedules|Workflows|Workspaces)Service\(`/
`TriggersService:` 전수 grep, `plan/in-progress/trigger-deletion-release.md` 체크리스트, 이전 라운드
`review/code/2026/09/17/18_45_09/{side_effect,RESOLUTION}.md`. `git status --short` 로 잔여 변경 없음을
확인(뮤테이션 시도 없음).

## 요약

1라운드에서 남긴 WARNING(워크스페이스 삭제 재검사 실패 시 외부 해제 미복구)은 이번 라운드
커밋(`097e583e1`)이 "되돌린다"가 아니라 "소리내어 남긴다"로 처분했음을 코드에서 직접 확인했다 —
기능적으로는 여전히 비가역 부작용이 남지만, 침묵하던 실패 모드가 관측 가능해졌고 spec·CHANGELOG·
plan 체크리스트에 잔여로 명시돼 후속 추적이 걸려 있어 새로운 미문서 이탈은 아니다. 로그 접두 정정,
생성자 시그니처 변경 4건, `teardownChannelConfig` public 승격, `ModuleRef` 서비스 로케이터는 모두
의도된 변경이고 호출자·모듈 경계 밖에 영향이 없음을 재확인했다. 이번 라운드에서 새로 도입된
CRITICAL/WARNING 급 부작용은 발견하지 못했다.

## 위험도

LOW
