# 신규 식별자 충돌 검토 — trigger-deletion-release

## 전제

`spec/2-navigation/` scope 델타는 0개 파일이다 — 이 PR 은 spec 을 고치지 않고(`spec_impact: none`)
`plan/in-progress/trigger-deletion-release.md` 가 기존 계약(`2-trigger-list.md` §3·§4.3·§4.4,
`secret-store.md` §2.1·§5.3)에 맞춰 코드만 구현한다. 따라서 **새 spec 식별자(요구사항 ID·엔티티·API
endpoint·이벤트명·ENV/설정키)는 도입되지 않았다** — 검토 대상은 이 PR 이 코드 레벨에서 새로 만든
심볼(클래스·함수·상수·파일명)이 기존 코드베이스·spec 상의 다른 의미의 동일/유사 식별자와 충돌하는지다.

## 확인한 신규 식별자와 grep 결과

- `TriggerResourceReleaserService` (`codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts`) —
  같은 이름의 클래스가 다른 곳에 없음(`class .*Releaser` grep 1건, 자기 자신). `--impl-prep` 라운드
  W6 지적(구 이름 `TriggerResourceReleaser` 가 디렉토리의 `*Service` 접미 관례를 깼다)이 실제로
  반영됐다 — bare `TriggerResourceReleaser`(Service 접미 없이) 잔존 0건 재확인.
- `TRIGGER_RESOURCE_RELEASER` (DI 토큰, `Symbol('TRIGGER_RESOURCE_RELEASER')`) — 동일 이름의 다른
  Symbol/토큰 없음. `TriggersModule` 이 `useExisting` 으로 배선하고 `WorkflowsService`·
  `WorkspacesService` 가 `ModuleRef.get(TOKEN, { strict:false })` 로만 참조 — 의미 일관.
- `TriggerParent`, `TriggerResourceReleasePort` (타입/인터페이스) — grep 결과 유일, 다른 도메인에
  동명 타입 없음.
- `triggerSecretPrefix` / `deleteTriggerSecretsAfterCommit` / `undoAbsentTriggerWrite` (순수 함수,
  `trigger-resource-release.ts`) 및 서비스 메서드 `releaseExternal(ForParent)` /
  `lockParentAndListTriggerIds` / `releaseSecretsAfterCommit` / `undoAbsentWrite` — 각각 유일한
  호출부 집합을 가지며, 다른 모듈(schedules/workflows/workspaces)에서의 import 는 전부 동일
  export 를 그대로 쓴다(재정의 없음).
- `buildSecretRefPrefix` (`secret-ref.ts` 신규 export) — 기존 `buildSecretRef` 옆에 추가된 자매
  함수, 동명 함수 없음.
- 라벨 `RP-1`~`RP-5` — `--impl-prep` INFO 6 (`W-a~e` 가 리뷰 `W<N>` 라벨과 겹쳐 보인다는 지적)에
  따라 개명된 결과. 코드 주석·spec 밖 어디에도 `RP-` 접두 라벨의 선행 사용 없음(grep 4건, 전부 이
  PR 의 테스트 주석).
- `TRIGGER_DELETE_LOCK_TIMEOUT_MS` — 이 PR 이전부터 트리거 PATCH/rotate 삭제 경로에 있던 상수를
  그대로 import 해 스케줄/워크플로/워크스페이스 삭제의 부모 잠금에도 적용한 것(재정의 아님, 값 5000
  고정 1곳). 이름의 "TRIGGER_DELETE" 가 가리키는 범위가 "트리거 삭제" 에서 "트리거를 없애는 모든
  삭제 경로" 로 넓어졌지만, 상수 자체가 하나(SoT)이고 의미(삭제 관련 락 대기 상한)는 일관돼 **명칭
  재사용이지 충돌이 아니다** — 이미 `/ai-review` 2라운드가 인덱스 후속으로 추적 중.
- e2e 파일 `trigger-deletion-releases-resources.e2e-spec.ts` — `codebase/backend/test/` 기존
  트리거 e2e 8개(`trigger-config-lost-update`, `trigger-update-save-window`,
  `trigger-workflow-ref`, `schedule-trigger`, `webhook-trigger` 등)와 이름 겹침 없음, `trigger-*`
  명명 관례(하이픈 구분 설명 + `.e2e-spec.ts`)를 따른다.
- 플랜 파일 `plan/in-progress/trigger-deletion-release.md` — 기존 `plan/in-progress/*.md` 92개 중
  동일 slug 없음. 트래커 ID `DRT-2` 는 `plan/complete/spec-draft-deletion-releases-trigger-resources.md`
  가 이미 이 PR 을 위해 예약해 둔 항목이라 재사용이 의도된 것(신규 충돌 아님).

## 발견사항

- **[WARNING]** `ChatChannelBinderService` 안의 두 teardown 메서드명이 시각적으로 유사
  - target 신규 식별자: `teardownChannelConfig(triggerId, chatChannelCfg)` (신규 public 메서드,
    `chat-channel-binder.service.ts`)
  - 기존 사용처: 같은 파일의 기존 `teardownChatChannel(trigger)` (`chat-channel-binder.service.ts:362`,
    이번 PR 이전부터 있던 진입점)
  - 상세: 두 메서드는 인자 형태가 다르다 — `teardownChatChannel`은 `Trigger` 엔티티를 받아 저장된
    `trigger.config.chatChannel` 을 읽어 teardown 하고, `teardownChannelConfig`는 트리거 id 와
    "이번 요청이 등록한" 설정 객체를 직접 받아 teardown 한다(보상 경로 — 행이 이미 삭제된 뒤 쓰는
    자리라 저장된 config 를 읽을 수 없다). 의미는 명확히 다르고 docstring 도 그 차이를 적었지만,
    `ChatChannel` ↔ `ChannelConfig` 로 단어 순서/구성만 바뀐 이름이라 grep·자동완성·로그 메시지에서
    구별하기 쉽지 않다. 실제로 `teardownChatChannel` 내부 구현이 `teardownChannelConfig` 를
    위임 호출하는 관계라 "얇은 래퍼 vs 신규 로직"을 이름만으로 오인하기 쉽다.
  - 제안: 필수는 아니나, 후속 정리 시 보상 경로 전용 메서드임을 이름에 드러내는 편이 안전하다(예:
    `teardownRegisteredChannel` / `teardownChannelByConfig`). 지금 당장 rename 을 요구할 정도의
    충돌은 아니며(같은 클래스 내부, 호출부 3곳 모두 의도대로 배선됨 — 위 grep 확인), 리뷰 3라운드가
    이미 코드 변경 0 으로 수렴을 선언한 뒤라 이번 PR 범위에서 강제하지 않는다.

- **[INFO]** 로그 접두 문구 정정이 실제로 전수 반영됐는지 확인 완료
  - target 신규 식별자: 없음(정정 확인)
  - 기존 사용처: `chat-channel-binder.service.ts` 의 로그 리터럴들
  - 상세: 이 PR 이 클래스 이동 시 남아 있던 `TriggersService:` 로그 접두 3곳을
    `ChatChannelBinderService:` 로 정정했다(diff 확인). grep 결과 이 파일 안에 `TriggersService:`
    잔존 0건 — 클래스명·로그 접두 불일치로 인한 "이름이 가리키는 실행 주체 오인" 소지가 이번 PR 로
    해소됐다. 새로운 충돌 아님, 긍정 확인 차원의 기록.

## 요약

이 PR 은 spec 을 변경하지 않아(spec/2-navigation 델타 0) 요구사항 ID·엔티티명·API endpoint·이벤트명·
ENV/설정키 층위의 신규 식별자 충돌 가능성 자체가 낮다. 코드 층위에서 도입한 새 클래스
(`TriggerResourceReleaserService`)·DI 토큰(`TRIGGER_RESOURCE_RELEASER`)·타입(`TriggerParent`,
`TriggerResourceReleasePort`)·함수(`triggerSecretPrefix`, `deleteTriggerSecretsAfterCommit`,
`undoAbsentTriggerWrite`, `buildSecretRefPrefix`)·파일(`trigger-resource-release*.ts`, 신규
e2e/plan 파일)을 전수 grep 했으며 기존 코드의 다른 의미 사용과 겹치는 사례를 찾지 못했다. `--impl-prep`
단계에서 지적된 두 건(`TriggerResourceReleaser` 접미 누락 W6, `W-a~e` 라벨 충돌 INFO 6)은 이번
구현에서 실제로 개명돼 grep 0건으로 확인된다. 유일하게 남는 것은 `teardownChatChannel` /
`teardownChannelConfig` 의 이름 유사성으로, 의미는 명확히 분리돼 있어 CRITICAL/차단 사유는 아니고
가독성 개선 권고 수준의 WARNING 하나로 그친다.

## 위험도

LOW
