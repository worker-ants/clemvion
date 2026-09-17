# 신규 식별자 충돌 검토 — `spec/2-navigation/` (--impl-prep, 트래커 DRT-2)

## 스코프 정리

target 은 `spec/2-navigation/` 전체(대부분 컨텍스트 예산으로 절단)와, 이 impl-prep 이 착수하려는
`plan/in-progress/trigger-deletion-release.md`(구현 설계)다. `2-trigger-list.md` 자체는 이미
`aaee17206`(#1345)로 병합된 spec 문구라 새 ID·엔드포인트·이벤트명·ENV 를 도입하지 않는다(diff 확인 —
순서·시점을 서술하는 산문뿐). 따라서 "신규 식별자"의 실질 후보는 `trigger-deletion-release.md` §설계가
예고하는 코드 심볼들이다:

- 파일 `trigger-resource-release.ts` (순수 함수)
- 함수 `triggerSecretPrefix(id)` / `deleteTriggerSecretsAfterCommit(...)` / `undoAbsentTriggerWrite(...)`
- 클래스 `TriggerResourceReleaser` (`triggers/`, injectable)
- 리소스 삭제 경로 4곳에 대한 트래커 라벨 `DRT-2`, 쓰기 보상 5자리 라벨 `W-a`~`W-e`

이 다섯 범주 전부에 대해 저장소 전수 grep 으로 후보 충돌을 먼저 셌다 (0건 선측정 원칙).

## 발견사항

- **[WARNING]** `TriggerResourceReleaser` 가 같은 모듈의 injectable provider 명명 컨벤션(`*Service`
  접미)을 깬다
  - target 신규 식별자: `TriggerResourceReleaser` (`plan/in-progress/trigger-deletion-release.md` §설계,
    "`triggers/`, injectable"로 명시)
  - 기존 사용처: `codebase/backend/src/modules/triggers/` 안의 injectable provider 전수 —
    `TriggersService`, `ChatChannelBinderService`, `ChatChannelTokenRotatorService`,
    `NotificationSecretRotatorService` (모두 `triggers.service.ts` / `chat-channel-binder.service.ts` /
    `chat-channel-token-rotator.service.ts` / `notification-secret-rotator.service.ts`) — 4/4 가
    `*Service` 접미 + `.service.ts` 파일명이다. `Releaser`/`*Releaser` 문자열은 `codebase/` 전체에서
    0건(신규)이라 다른 의미와 부딪히는 CRITICAL 충돌은 아니다.
  - 상세: 같은 디렉토리의 다른 injectable 4개가 예외 없이 `*Service` 로 끝나는데 새 클래스만
    `Releaser` 로 끝난다. `trigger-lock-followups.md`(직전 세션, 같은 모듈)가 남긴 선례 —
    "후보 식별자는 그 저장소 안의 기존 어휘 계열과 충돌하는지 먼저 세고 고른다"(`Precheck` 사례) —
    를 이 자리에 적용하면, `*Service` 미준수는 실제 이름 충돌은 아니어도 **"이 모듈의 provider 는
    전부 Service"** 라는 지금까지 100% 일관된 국소 컨벤션을 깨 다음 사람이 DI 등록·테스트 mock
    작성 시 이 클래스만 다른 규칙을 따르는지 매번 확인해야 하는 인지 비용을 만든다.
  - 제안: `TriggerResourceReleaserService` 로 개명하거나(파일 `trigger-resource-releaser.service.ts`),
    개명하지 않는다면 plan 의 §설계에 "왜 이 provider 만 `*Service` 접미를 쓰지 않는가"를 한 줄
    근거로 남겨 다음 사람이 재지적하지 않게 한다. (순수 함수 파일 `trigger-resource-release.ts` 는
    같은 디렉토리의 비-서비스 헬퍼 `trigger-config-lock.ts` / `trigger-callback-url.ts` 와 동일하게
    접미 없는 kebab-case — 이쪽은 컨벤션 위반이 아니다.)

- **[INFO]** 쓰기 보상 5자리 라벨 `W-a`~`W-e` 가 저장소 전역의 `W<N>` 리뷰-발견 라벨 관용구와
  시각적으로 겹친다
  - target 신규 식별자: `W-a` / `W-b` / `W-c` / `W-d` / `W-e` (`trigger-deletion-release.md` §착수 전
    실측 "쓰기 경로" 표)
  - 기존 사용처: 이 저장소는 `W1`~`W4`(정수 접미) 를 **리뷰 세션이 발견한 N번째 WARNING** 을
    가리키는 관용구로 반복 사용한다 — 같은 spec 파일 안에도 `spec/2-navigation/2-trigger-list.md`
    §R-17 의 "`W4` 회귀 방지"(`--impl-done naming_collision W4` 출처, `trigger-lock-followups.md` 참조),
    `spec/5-system/4-execution-engine.md` 의 "SPEC-DRIFT W3" 등.
  - 상세: 형태(문자 접미 `-a`~`-e` vs 정수 접미 `1`~`4`)가 달라 실제 파싱 충돌은 없고, 이 라벨은
    같은 plan 문서 안에서만 참조되어 교차 문서 인용 위험도 낮다. 다만 "W + 구분자"라는 시각 패턴
    자체가 이 저장소에서 이미 "리뷰가 지적한 결함 번호"로 강하게 각인돼 있어, 향후 이 표를 인용하는
    커밋 메시지·리뷰 코멘트에서 "W-b" 를 실제 WARNING 발견 번호로 오독할 여지가 있다.
  - 제안: 필수는 아니나, 재사용 여지를 없애려면 `RP-1`~`RP-5`(release-path) 등 `W` 로 시작하지
    않는 접두로 바꾸는 편이 더 안전하다. 우선순위 낮음 — 차단 사유 아님.

## 비대상으로 확인한 후보 (grep 0건 또는 의미 일치 확인)

- `triggerSecretPrefix` / `deleteTriggerSecretsAfterCommit` / `undoAbsentTriggerWrite`: `codebase/`
  전수 grep 0건, `undo[A-Z]` 패턴도 0건 — 어휘 계열 충돌 없음.
- `trigger-resource-release.ts`: `modules/triggers/` 안에 동명 파일 없음(현재 파일 목록 확인).
- `DRT-2` / `DRT-1` / `DRT-3`: 이미 이전 `--spec` 라운드(`spec-draft-deletion-releases-trigger-resources.md`
  CRITICAL 처분)에서 `T1`~`T3` 후보가 같은 트래커의 기존 `T1`/`T2`(`#676` 계열)와 충돌해 `DRT-*` 로
  교체됐고, 그때 이미 저장소 전체 0건을 선측정했다 — 이번 세션에서 재검증해도 여전히 이 plan
  계열 3곳(본 문서)만 사용해 충돌 없음.
- `listener registry` (§4.3 표): 새 개념이 아니라 기존 `ChannelListenerRegistry`
  (`codebase/backend/src/modules/chat-channel/channel-listener.registry.ts`, `TriggersService.remove()`
  가 이미 `channelListenerRegistry.unregister(trigger.id)` 를 호출)를 가리키는 재참조 — 같은 의미의
  기존 사용과 정합, 충돌 아님.
- `secret://triggers/<id>/` prefix 서술: `spec/conventions/secret-store.md` §1/§2.1 의 기존 URI
  scheme·`deleteByPrefix` 호출 규약과 정확히 일치 — 새 계약이 아니라 그 규약의 재인용.
- "Release" 어휘: 실행 엔진 도메인에 `ParkReleaseSignal`/`isParkReleaseSignal`/`park_released` 가
  이미 있으나 형태가 뚜렷이 다르고(`Park` + `Release` + `Signal` 합성어) 클래스 레벨 `*Releaser`
  계열은 0건이라, 위 WARNING(Service 접미 누락) 이상의 별도 CRITICAL 로 세우지 않았다.
- API endpoint / webhook·큐 이벤트명 / ENV var / config key: 이번 target 범위(§설계)는 순수
  내부 서비스 리팩터링이라 신규 endpoint·이벤트·환경변수를 도입하지 않는다 — 해당 관점은 대상 없음.

## 요약

이번 target(`trigger-deletion-release.md` 구현 설계 + 이미 병합된 `2-trigger-list.md` 삭제 규칙
서술)이 새로 도입하는 식별자 5종을 저장소 전수 grep 으로 먼저 세운 결과, 다른 의미로 이미 쓰이고
있는 CRITICAL 충돌은 없었다. `DRT-2` 트래커 라벨과 `secret://triggers/` prefix·`ChannelListenerRegistry`
재참조는 기존 관례·이전 라운드의 충돌 해소 결과와 정확히 정합한다. 유일한 실질 지적은
`TriggerResourceReleaser` 가 같은 디렉토리의 다른 provider 4개가 예외 없이 지키는 `*Service` 접미
컨벤션에서 벗어난다는 것(WARNING) — 이름이 다른 의미를 가로채는 것은 아니지만 국소 명명 일관성을
깬다. `W-a`~`W-e` 라벨은 저장소 전역의 `W<N>` 리뷰-발견 관용구와 시각적으로만 겹치는 낮은 위험의
INFO 다.

## 위험도

LOW
