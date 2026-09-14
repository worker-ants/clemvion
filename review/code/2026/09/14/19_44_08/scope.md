# 변경 범위(Scope) 리뷰 — trigger-config-lost-update (누적 3커밋)

## 검토 방법

`git log --oneline -15`로 대상 커밋(`567c82edb` → `12ed21ff1` → `c7a9c107e`)을 확인하고,
`git diff --stat origin/main...HEAD`로 전체 58개 변경 파일을 코드(14) / CHANGELOG(1) /
plan(1) / review 산출물(42)로 분류했다. 코드 파일은 각각 `git diff origin/main...HEAD -- <path>`
로 전문을 직접 열어 대조했고, 포맷팅 노이즈 여부는 `git diff --stat -w`(공백 무시)와
`git diff --stat`(기본)의 결과가 **완전히 동일**함을 확인해 검증했다(공백만 바뀐 줄 0건).

## 발견사항

- **[INFO]** `hooks.service.ts`/`hooks.service.spec.ts` 는 트리거 모듈이 아닌 다른 모듈이지만, 같은 결함 클래스의 후속 수정으로 정당화된다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (두 곳 — 웹훅 hot path `lastTriggeredAt` 갱신, interaction ack 경로), `codebase/backend/src/modules/hooks/hooks.service.spec.ts`
  - 상세: 커밋 `c7a9c107e`가 `save(trigger)` → `update({id}, {lastTriggeredAt})`로 바꾼 것은 트리거 모듈 밖의 파일이라 처음엔 범위 이탈로 보일 수 있다. 그러나 커밋 메시지·코드 주석(`review/code/2026/09/14/19_07_43` concurrency WARNING#1 인용)이 이 자리가 "PATCH 끼리의 경합보다 훨씬 잦은" 같은 클래스의 fail-open(웹훅 인입마다 `config` 를 통째로 재저장)임을 명시하고, 변경 자체는 두 개의 대칭적인 hunk로 컬럼 한정 갱신으로 좁게 국한된다. 이 PR 의 표제 결함("동시 PATCH 가 `trigger.config` 를 잃는다")의 발견 과정에서 드러난 인접 창을 같은 배치에서 닫은 것으로, 무관한 모듈에 대한 임의 개입이 아니다.
  - 제안: 조치 불요 — 근거가 코드·plan·커밋 메시지에 모두 일관되게 기록돼 있다.

- **[INFO]** `CHANGELOG.md` Behavior change 항목이 커밋 `12ed21ff1` 시점 기준으로 작성돼, 이후 커밋(`c7a9c107e`)이 추가한 hooks hot-path 수정 및 "1라운드 수정이 만든 새 lost update"는 CHANGELOG 본문에 별도로 반영되지 않았다
  - 위치: `CHANGELOG.md` (Unreleased "동시 PATCH 가 인입 서명 ref 를 지워 fail-open 이 되던 경로를 닫는다" 항목)
  - 상세: 이 항목은 "config 를 다시 쓰는 네 자리 전부"를 락으로 닫았다고 서술하는데, 실제로는 그 뒤 커밋에서 `TriggersService.update()`(창 1) 자체의 저장이 새 lost update를 만들었다가 다시 고쳐졌고, 별도로 hooks 모듈의 hot path도 고쳐졌다. 이는 스코프 확장이 아니라 반대로 문서가 최신 코드 변경을 다 따라잡지 못한 것이라 이 관점(과도한 변경)의 위반은 아니지만, 다음 리뷰어가 CHANGELOG만 보고 "네 창이 전부"라고 오인할 소지가 있어 기록해 둔다.
  - 제안: scope 관점에서는 조치 불요(문서 완결성은 documentation 리뷰어 영역). 참고용 기재.

이 외에 확인한 코드 파일(`chat-channel-binder.service.ts`, `chat-channel-input-rules.ts`,
`trigger-config-lock.ts`/`.spec.ts`(신규), `triggers.service.ts`/`.spec.ts`,
`triggers.web-chat.spec.ts`, `trigger-transaction-mock.ts`(신규 테스트 유틸),
`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/`fixtures/endpoint-path-save.fixture.ts`,
`trigger-config-lost-update.e2e-spec.ts`)는 모두 표제 결함(트리거 `config` 동시 쓰기
lost-update)과 직접 연결된다:

- `endpoint-path-conflict-wrap-guard.ts` 확장(`TRIGGER_ENTITY` 상수, 함수-경계 판정)은
  `save(trigger)` 호출이 `manager.transaction(async (m) => …)` 콜백 안으로 이동하면서
  기존 정적 가드가 "저장이 사라졌다"로 오판(false RED)하게 된 것을 바로잡는 **필연적** 동반
  수정이다 — 가드 자체의 임의 리팩토링이 아니라 이 PR 이 만든 새 코드 형태를 인식시키는
  좁은 확장이다.
- `chat-channel-input-rules.ts` 의 `extractInboundSigningRef` 추출은 이 PR 자체가 세 자리에
  복제한 동일 인라인 캐스트를 정리한 것으로(주석이 `review/code/.../19_07_43` maintainability
  WARNING#7 을 인용), 이 PR 이 만든 중복을 그 자리에서 제거하는 정당한 범위 내 정리다 —
  PR 과 무관한 기존 코드 리팩토링이 아니다.
- `trigger-transaction-mock.ts` 는 `manager.transaction()` 도입으로 6개 스펙 파일에 흩어진
  Trigger repo mock 이 깨지는 것을 막기 위한 공용 헬퍼이며, 도입 필요성이 JSDoc 에 실측
  (뮤턴트 13건 RED)으로 근거돼 있다.
- `plan/in-progress/trigger-config-lost-update.md` 는 발견된 유사 위험 지점(19곳 이상)을
  "이 PR 로 넓히지 않는다"고 명시적으로 트래커에만 등재하고 실제 diff 를 확장하지 않았다 —
  스코프 이탈이 아니라 스코프를 의도적으로 좁게 유지한 근거 문서다.
- `review/code/**`·`review/consistency/**` 42개 파일은 이 저장소의 강제 워크플로
  (`/ai-review`, `consistency-check --impl-prep`)가 요구하는 산출물이며 `CLAUDE.md` 의
  저장 위치 규약과 일치한다 — scope creep 이 아니다.

포맷팅 전용 변경, 불필요한 임포트 추가/정리, 의미 없는 주석 변경, 설정 파일의 의도치 않은
수정은 발견되지 않았다. `git diff --stat -w` 결과가 공백 무시 없는 결과와 동일해 diff 안에
실질 변경과 섞인 공백/개행 노이즈도 없음을 확인했다.

## 요약

3개 커밋에 걸친 누적 diff(코드 14파일 +CHANGELOG +plan, review 산출물 별도)를
`origin/main` 대비 전수 대조한 결과, 모든 코드 변경은 "동시 PATCH 가 `trigger.config` 를
lost-update 로 되돌려 인입 웹훅 서명 검증이 fail-open 되는" 단일 결함 클래스와 그 발견
과정에서 드러난 직접 파생 항목(정적 가드의 오탐, 이 PR 자신이 만든 캐스트 중복, mock 배선
깨짐)에 한정된다. 요청 이상의 기능 확장, 무관한 리팩토링, 포맷팅/임포트/주석 전용 변경,
의도치 않은 설정 변경은 발견되지 않았다. 유일하게 기록해 둘 점은 트리거 모듈 밖의
`hooks.service.ts` 수정인데, 이는 같은 결함 클래스의 후속 수정으로 근거가 코드·커밋
메시지에 일관되게 남아 있어 범위 이탈로 보지 않는다. CHANGELOG 가 최신 커밋의 변경을
완전히 따라잡지 못한 점은 문서 완결성 이슈이지 스코프 초과는 아니다.

## 위험도

NONE
