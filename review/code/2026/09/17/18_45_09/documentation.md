# 문서화(Documentation) 리뷰 — trigger-deletion-release (트래커 DRT-2)

## 발견사항

- **[WARNING]** `CHANGELOG.md` 가 이번 변경에서 갱신되지 않았다 — 저장소의 확립된 관행과 어긋난다
  - 위치: `CHANGELOG.md` (이번 diff 에 포함되지 않음 — 27개 변경 파일 목록에 부재)
  - 상세: `git log --oneline -5 -- CHANGELOG.md` 로 직접 대조한 결과, 이 브랜치 직전의 다섯 `fix(...)`
    커밋(`cc199df6f`, `2d20cc3e1`, `60be0712a`, `fdf576a2f`, `afaef5bef`)이 **전부** `## Unreleased`
    섹션에 원인·수정·검증을 담은 상세 항목을 남겼다(예: 바로 앞 커밋 `cc199df6f` 는 원인·수정·PR
    안에서 낸 회귀까지 6문단으로 기록). 반면 이번 트래커의 핵심 커밋 `1544a1501`(fix(triggers):
    트리거 행을 없애는 네 경로가 그 트리거의 자원을 정리한다)은 27개 파일을 바꿨지만
    `CHANGELOG.md` 는 그 목록에 없다(`git show --stat 1544a1501 -- CHANGELOG.md` 결과 없음). 뒤이은
    `a11889086`(job scheduler 판정 수정)도 마찬가지다. 이 PR 은 워크플로·워크스페이스·스케줄 삭제가
    BullMQ job · provider 등록 · 암호화된 비밀을 **전혀 정리하지 않던** 실제 자원 누수를 고치는,
    운영 영향이 큰 변경이라 이 저장소의 확립된 패턴상 CHANGELOG 대상 1순위에 해당한다.
  - 제안: `## Unreleased` 에 "트리거 행을 없애는 네 경로가 그 자원을 정리한다" 항목을 추가한다 —
    선행 다섯 커밋과 같은 형식(문제·원인·수정·검증)으로, 특히 "종전엔 워크플로·워크스페이스 삭제가
    아무 외부 자원도 해제하지 않았다"는 운영자에게 중요한 사실을 명시한다.

- **[WARNING]** `ChatChannelBinderService` 의 `TriggersService:` 로그 접두가 이번 PR 로 더 넓은
  호출 경로에 퍼지는데도 정정되지 않았다 — 이미 "다음에 이 파일을 손댈 때 고친다"고 트래킹된 항목
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:379`
    (`teardownChannelConfig` 안의 `this.logger.warn(...TriggersService: teardownChannel 실패...)`)
  - 상세: 이 로그 리터럴이 실제 클래스(`ChatChannelBinderService`)와 다른 이름을 말하는 문제는
    `plan/in-progress/spec-draft-nullable-notation-followups.md:2460-2464` 에 이미 등재돼 있고,
    처분은 "T2 가 일부러 남겼다 … **다음에 그 파일을 손댈 때**" 정정하기로 돼 있다. 이번 PR 이
    정확히 그 "다음"이다 — `chat-channel-binder.service.ts` 를 43줄 바꾸며 `teardownChannelConfig`
    를 별도 public 메서드로 뽑아냈고, 그 결과 이 로그가 트리거 발생하는 호출부가 종전
    (`teardownChatChannel` 한 곳)보다 훨씬 넓어졌다 — `TriggerResourceReleaserService.undoAbsentWrite`
    를 거쳐 `TriggersService.normalizeNotificationSecretRef`·`rotateBotToken`·
    `promoteRotatedNotificationSecrets`(cron)·`WorkflowsService.remove`·`WorkspacesService.deleteWorkspace`
    등 클래스 이름과 무관한 다섯 자리에서도 이제 이 로그가 찍힌다. "옮기기 전 리터럴을 보존해
    순수 이동임을 증명한다"는 T2 당시의 근거는 이번처럼 호출부 자체가 늘어나는 리팩터에는
    적용되지 않는다.
  - 제안: 이번 PR 에서 `TriggersService:` → `ChatChannelBinderService:` 로 네 곳(105·312·315·379행)을
    함께 정정하거나, 못 한다면 plan 체크리스트/트래커 후속 항목에 "이번 PR 로 호출부가 늘어 블라스트
    반경이 커졌다"는 사실을 한 줄 추가해 우선순위를 올린다.

- **[INFO]** "다른 지연 해석은 못 찾으면 no-op" 비교가 두 개의 다른 기존 패턴을 하나로 뭉뚱그린다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts:19`
    (`TRIGGER_RESOURCE_RELEASER` JSDoc, "저장소의 다른 지연 해석(`NotificationsService.getWebsocket`
    등)은 못 찾으면 no-op 이지만 **여기는 던진다**") — 동일 문구가
    `codebase/backend/src/modules/workflows/workflows.service.ts:296`,
    `codebase/backend/src/modules/workspaces/workspaces.service.ts:590` 에도 반복된다.
  - 상세: 직접 대조해 보면 두 선례가 실제로는 다르게 동작한다. `execution-engine.service.ts` 의
    `getNotificationsService()`(825행)는 `moduleRef.get` 을 **자체 try/catch 로 감싸** 못 찾으면
    resolver 안에서 `undefined` 를 돌려주는 진짜 no-op 이다. 반면 `notifications.service.ts` 의
    `getWebsocket()`(37행)은 감싸지 않아 **똑같이 던지고**, no-op 처럼 보이는 것은 그 호출부
    `emitNew()`(506-524행)가 try/catch 로 삼키기 때문이다 — 즉 "no-op" 은 resolver 가 아니라
    caller 의 성질이다. 이번 신규 코드(`triggerResourceReleaser()`)는 `getWebsocket()` 과 같은
    층위(resolver 자체는 그냥 던진다)이고, 차이는 오직 "caller 가 삼키지 않는다"는 점뿐이다. 이
    구분이 없어도 실사용에는 영향이 없지만("결과적으로 no-op" 이라는 결론은 맞다), "어디서" no-op
    이 되는지를 다음 사람이 다른 지연 해석 패턴을 흉내낼 때 참고하면 오도될 수 있다.
  - 제안: 없어도 무방하나, 정정한다면 "그 caller 가 삼키면 no-op 이 되지만"처럼 계층을 한 단어만
    바꿔 명확히 할 수 있다.

## 검증한 항목 (문제 없음 — 근거만 기록)

- **JSDoc/독스트링**: `trigger-resource-release.ts`(신규 정책 함수 3개)·`trigger-resource-releaser.service.ts`
  (신규 서비스, 포트 구현)·`workflows.service.ts`/`workspaces.service.ts` 의 `triggerResourceReleaser()`
  private 메서드 모두 목적·순서·실패 정책·근거(spec 절 인용)를 갖춘 JSDoc 이 있다. `spec/2-navigation/
  2-trigger-list.md §3`(206행 "쓰지 못했으면 락 밖에서 만든 것을 되돌린다") · §4.3(294행 커밋 뒤
  비밀 삭제 표) · `spec/conventions/secret-store.md §2.1/§5.3/§6`(147·337·398행) 인용을 직접 열어
  대조했고 모두 실제 절 제목·내용과 일치한다(허위 인용 없음).
- **주석 정확성**: `jest.config.ts` 의 e2e 핸들 정리 주석 갱신(47-53행)은 새 e2e spec 이 실제로
  `Queue.close()`·`DataSource.destroy()` 를 `afterAll` 에서 부르는 것과 일치한다(직접 대조).
  `triggers.module.ts` 의 registry 주입 주석(37-39행)도 `TriggersService`(rotateBotToken 에서만
  `channelAdapterRegistry` 사용, `channelListenerRegistry` 는 이제 미주입) · `ChatChannelBinderService`
  (register/teardown) · `TriggerResourceReleaserService`(unregister) 세 클래스의 실제 생성자 주입과
  grep 으로 대조해 일치를 확인했다.
- **인라인 주석**: `TriggerResourceReleaserService.lockParentAndListTriggerIds`(105-107행)의
  "잠금 뒤엔 FK 검사(`FOR KEY SHARE`)가 INSERT 를 막는다"는 PostgreSQL 표준 동작과 부합한다.
  각 delete 경로(트리거·스케줄·워크플로·워크스페이스)의 순서 변경 지점마다 "왜 이 순서인가"를
  설명하는 주석이 있고, 뮤턴트 검증표(`plan/in-progress/trigger-deletion-release.md` M1~M15)와
  1:1 대응한다.
- **README/설정 문서**: 새 환경변수·설정 옵션이 없다(순수 내부 서비스 배선 변경). `codebase/backend/
  README.md` 에 secret/trigger 관련 서술이 없어 갱신 대상도 아니다 — 갭 없음.
  API 엔드포인트·요청/응답 스키마 변경도 없어(내부 정리 로직만 변경) Swagger/API 문서 갱신 불요.
  `plan/in-progress/trigger-deletion-release.md` 자체가 착수 전 실측·설계·뮤턴트·처분·체크리스트를
  갖춘 양호한 작업 기록이며, `--impl-prep` WARNING 6건의 처분이 본문에 반영돼 있다(직접 대조 확인).

## 요약

코드 자체의 문서화 수준은 높다 — 새로 추가된 정책 모듈(`trigger-resource-release.ts`)과 서비스
(`TriggerResourceReleaserService`)는 순서·실패 정책·spec 근거를 갖춘 JSDoc 을 갖추고 있고, 인용된
spec 절 번호를 직접 열어 대조한 결과 허위 인용이 없었다. 다만 두 가지 문서화 관행 이탈이 있다:
(1) 이 저장소가 최근 5개 연속 `fix` 커밋 모두에서 지켜온 `CHANGELOG.md` 갱신이 이번 — 운영 영향이
가장 큰 축에 속하는 — 자원 누수 수정에서는 빠졌고, (2) 이미 트래커에 "다음에 이 파일을 손댈 때
고친다"고 등재된 `ChatChannelBinderService` 의 `TriggersService:` 오표기 로그가, 정확히 그 파일을
손댄 이번 PR 로 호출 경로만 넓어지고 정정되지 않았다. 둘 다 기능적 결함은 아니며 차단 사유가 아니다.

## 위험도

LOW
