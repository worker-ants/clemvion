# 테스트(Testing) 리뷰 — 트리거 삭제 자원 정리 stale 주석·이름 정정

## 범위 요약

`codebase/**` 변경분은 9개 파일이며, plan(`plan/in-progress/trigger-release-stale-comments.md`)이
명시한 대로 **동작은 바꾸지 않는다** — 실질 코드 변경은 메서드 리네임 하나
(`teardownChannelConfig` → `teardownRegisteredChannel`, `chat-channel-binder.service.ts` /
`trigger-resource-releaser.service.ts` / `trigger-resource-releaser.service.spec.ts`)뿐이고,
나머지(secret-resolver.service.ts, trigger-config-lock.ts, triggers.service.ts,
triggers.service.spec.ts, workspaces.service.spec.ts, trigger-workflow-ref.e2e-spec.ts)는
JSDoc·인라인 주석·테스트 주석 문면 정정이다.

검증을 위해 저장소를 뮤테이션하지 않고 다음을 실측했다 (원복 불요 — 읽기 전용):

- `grep -rn "teardownChannelConfig|teardownRegisteredChannel" codebase/` — 리네임이 전 콜사이트에
  일관되게 반영됨을 확인 (정의부·프로덕션 호출 2곳·mock 1곳·이벤트 라벨 1곳 전부 새 이름, 옛 이름은
  JSDoc 안의 "이전 이름" 언급 1곳만 잔존 — 의도된 것).
- `npx jest trigger-resource-releaser.service.spec.ts chat-channel-binder.service.spec.ts triggers.service.spec.ts workspaces.service.spec.ts` — 4 suites 전부 GREEN (239 passed, 1 skipped). skip 은 `triggers.service.spec.ts:999` 의 기존 `it.skip('structural anchor', …)` 로 이 diff 밖의 pre-existing 항목 (grep 으로 diff 라인과 무관함을 확인).
- `npx tsc -p tsconfig.build.json --noEmit` — 에러 0건 (build ratchet 통과).
- 작업 종료 시 `git status --short` — 리뷰 산출물 디렉터리 외 트리 변경 없음.

## 발견사항

- **[INFO]** 리네임된 `teardownRegisteredChannel` 이 "호출자가 넘긴 설정"으로 동작한다는 신설
  JSDoc 서술이 그 인자 경유 경로 자체를 직접 단위 테스트로 고정하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` 함수
    `teardownRegisteredChannel` (게이트 380행 정의) JSDoc — "저장된 `config` 를 읽는
    {@link teardownChatChannel} 이 이것을 부르고 … 보상 경로는 **이번 요청이 등록한 설정**을
    넘긴다"
  - 상세: `chat-channel-binder.service.spec.ts` 는 `teardownChatChannel`(trigger.config 에서
    읽은 설정)을 통해서만 이 공유 로직을 행사한다. "호출자가 직접 넘긴 설정으로 adapter 를
    부른다"는 축은 `trigger-resource-releaser.service.spec.ts`(파일 4, 게이트 308~318행
    `undoAbsentWrite` 테스트)가 exercise 하지만, 그 테스트는 binder 자체를 전부 mock
    (`teardownRegisteredChannel: jest.fn(...)`)하므로 실제 구현이 "인자로 받은 config 를 그대로
    adapter 에 전달하는지"는 검증하지 못하고 "binder 의 그 메서드가 호출됐는지"만 검증한다.
    다만 `teardownRegisteredChannel` 은 `teardownChatChannel` 과 완전히 같은 내부 로직을
    공유하는 얇은 래퍼이고(리네임 전부터 그랬다), `teardownChatChannel` 쪽 테스트가 이미
    "넘어온 config 값 자체"까지 `toHaveBeenCalledWith` 로 단언하고 있어(파일 미변경,
    `chat-channel-binder.service.spec.ts:107-116`) 실질 커버리지 공백은 작다 — 이번 PR 이
    새로 만든 갭이 아니라 리네임 이전부터 있던 구조다.
  - 제안: 조치 불요(이 PR 스코프 밖). 다음에 이 메서드의 "호출자 config 우선" 분기 자체를
    바꿀 일이 생기면, `undoAbsentWrite`/`undoAbsentTriggerWrite` 경로에서 binder 를 mock 하지
    않고 실제 `ChatChannelBinderService` 인스턴스로 "trigger.config 와 다른 config 를 넘겼을 때
    그 값이 adapter 에 전달되는지"를 직접 도는 테스트를 추가하면 이 축이 명시적으로 닫힌다.

- **[INFO]** plan 실측표 #4(리네임 콜사이트 목록)가 실제보다 좁다는 consistency 지적(INFO#2,
  `review/consistency/2026/09/18/11_26_25/plan_coherence.md`)은 **코드·테스트에는 영향이
  없다** — 위 grep·jest·tsc 실측으로 실제 리네임은 전 콜사이트(정의부 1 + 프로덕션 호출 2 +
  mock 1 + 이벤트 라벨 1)에 완전히 반영됐고 빌드·테스트 모두 GREEN 이다. 문서(plan) 표만
  좁을 뿐 코드 결함은 아니므로 이 리뷰의 "테스트 커버리지 갭"으로는 등재하지 않는다(단
  나중에 그 plan 표를 근거로 "이 두 파일은 안 봐도 된다"고 오판하지 않도록 참고용으로만
  남긴다).

## 관점별 평가

1. **테스트 존재 여부**: 리네임 대상 로직(`teardownChatChannel`/`teardownRegisteredChannel`)은
   기존에 이미 두껍게 테스트돼 있었고(파일 상단 주석이 그 경위를 설명), 이번 PR 은 그 테스트의
   mock 키·이벤트 라벨만 새 이름으로 따라갔다(파일 4, 게이트 53-54·315행) — 신규 테스트 추가가
   필요한 신규 동작이 없다.
2. **커버리지 갭**: 위 INFO 1건(경미, 리네임 이전부터 존재) 외 추가 갭 없음.
3. **엣지 케이스**: 동작 변경이 없으므로 신규 엣지 케이스 없음. 주석 정정들(secret-resolver
   JSDoc 의 "메타문자 없음 — 2026-09-18 전수 확인" 등)은 이미 존재하는 `deleteByPrefix` 의
   메타문자 거부 테스트(`%`, `_`, `\`)로 뒷받침되는 서술이며 이번 diff 로 새로 반증되지 않았다.
4. **Mock 적절성**: `trigger-resource-releaser.service.spec.ts` 의 binder mock 은 `as never`
   로 캐스트돼 프로퍼티명 오탈자를 컴파일 타임에 잡지 못하지만, 실행 시 `undefined is not a
   function` 형태로 즉시 RED 가 되므로 은닉 위험은 낮다 — 실제로 이번 리네임이 mock/production
   양쪽에 누락 없이 반영됐음을 jest GREEN 으로 확인했다.
5. **테스트 격리**: 4개 spec 모두 `new`/factory 로 협력자를 직접 주입하며 전역 상태 공유 없음.
   기존 관례(`afterEach(() => jest.restoreAllMocks())` 등) 그대로 유지.
6. **테스트 가독성**: 파일 4의 이벤트 라벨을 `teardownConfig:` → `teardownRegistered:` 로 함께
   바꿔 이름과 라벨이 계속 대응— 가독성 저하 없음.
7. **회귀 테스트**: `npx jest` 4 suites 실측 GREEN(239 passed / 1 skipped, skip 은 diff 무관
   pre-existing). 회귀 없음.
8. **테스트 용이성**: 변경 없음 — 기존 DI 구조 그대로.

## 요약

이번 변경은 plan 이 선언한 대로 "동작 미변경 + stale 주석/이름 정정"이 실제로 지켜졌다. 유일한
실질 코드 변경(`teardownChannelConfig`→`teardownRegisteredChannel` 리네임)은 정의부·프로덕션
콜사이트 2곳·테스트 mock·이벤트 라벨까지 grep 으로 누락 없음을 확인했고, 관련 4개 spec 파일과
`tsc --noEmit` 빌드 랫칫이 실측으로 모두 GREEN 이다. 발견한 유일한 갭(호출자-공급 config 경로가
binder 실제 인스턴스가 아니라 mock 을 통해서만 간접 검증됨)은 이번 PR 이 새로 만든 것이 아니라
리네임 이전부터 있던 구조적 특성이라 이 PR 자체의 결함으로 보지 않으며, 차단 사유가 되는 항목은
없다.

## 위험도

NONE
