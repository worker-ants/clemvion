# 변경 범위(Scope) Review

## 검토 방법

`git diff origin/main...HEAD --stat` 로 변경 파일 전수(75개)를 확인하고, 프롬프트에서 생략된
파일(`chat-channel-binder.service.ts`·`trigger-config-lock.ts`·`triggers.service.ts`·
`triggers.service.spec.ts`·plan 문서 등)은 저장소에서 직접 `git diff`/`Read` 로 재확인했다.
의도는 CHANGELOG 신규 항목과 plan 문서(`plan/in-progress/trigger-config-lost-update.md`)로
파악했다: **동시 PATCH/웹훅 인입이 `trigger.config` 를 스냅샷째 되돌려 `inboundSigningRef` 를
지우고 인입 서명 검증이 fail-open 되던 lost-update 를 advisory lock + 재읽기로 닫는다.**

## 발견사항

- **[INFO]** 커밋 diff 총량(6,689줄 추가) 대부분이 실제 프로덕션 코드가 아니라, 이 작업 도중
  수행된 **3라운드 코드 리뷰 + 1라운드 consistency-check 산출물 전체**다
  - 위치: `review/code/2026/09/14/18_17_44/**`, `review/code/2026/09/14/19_07_43/**`,
    `review/code/2026/09/14/19_44_08/**`, `review/consistency/2026/09/14/17_10_16/**`
    (각 라운드마다 `SUMMARY.md`+`meta.json`+`_retry_state.json`+12개 관점 파일 세트)
  - 상세: `git diff --stat` 결과만 보면 이번 PR 이 매우 큰 변경처럼 보이지만, 실제 프로덕션
    코드 변경은 `hooks.service.ts`(+20/-6)·`chat-channel-binder.service.ts`(+101/-52 상당)·
    `triggers.service.ts`(+110/-27)·신규 `trigger-config-lock.ts`(135줄) 네 파일로 좁다.
    나머지는 이 프로젝트 컨벤션(`CLAUDE.md` "코드 리뷰 산출물 → `review/code/**`", "일관성 검토
    산출물 → `review/consistency/**`")이 요구하는 대로 리뷰-수정 라운드마다 산출물을 커밋한
    결과다. 위반은 아니지만, 스코프 판단 시 "실질 코드 변경 크기"와 "diff 총량"을 혼동하지
    않도록 분리해 적는다.
  - 제안: 조치 불요 — 프로젝트 컨벤션 준수. 다음 리뷰어를 위해 "실질 코드 4파일 vs 산출물
    71파일" 구분만 남긴다.

- **[INFO]** 핵심 수정(advisory lock lost-update) 외에 세 곳의 부수 리팩터가 같은 PR 에 포함됨
  — 전부 **이 PR 자신의 이전 리뷰 라운드가 지적한 항목**에 대한 대응
  - 위치:
    1. `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:247`
       (`extractInboundSigningRef` 신설) — 도입 사유가 docblock(`:239-246`)에 `/ai-review
       review/code/2026/09/14/19_07_43 maintainability WARNING#7` 로 명시.
    2. `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (`survivesWithFresh`
       ·`buildChannel` 클로저 통합) — `/ai-review review/code/2026/09/14/18_17_44 maintainability
       WARNING#6` 대응.
    3. `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:26-35,
       111-120, 159-171` (`TRIGGER_ENTITY` 술어 추가) — 프로덕션 `save()` 호출이 `manager.
       transaction()` 콜백 안으로 이동해 기존 래핑 래칫이 오탐(래핑이 있는데 "없다"고 읽음)을
       내던 것을 고정.
  - 상세: 셋 다 "요청된 변경(=lost-update 수정) 외의 추가 수정"으로 보일 수 있지만, (1)·(2)는
    이 PR 자체의 앞선 리뷰 라운드가 낸 WARNING 을 같은 턴에 처리한 것이고(프로젝트 규약상
    "같은 턴의 강제 의무"), (3)은 (1)·(2)가 아니라 **핵심 수정 자체**(`save(trigger)` →
    `m.save(Trigger, fresh)` 로 수신자·위치가 바뀜)가 유발한 정합성 파손을 막는 필연적 후속
    조치다 — 이 가드를 안 고치면 기존 래칫이 거짓 RED 를 내거나(현재 커밋 메시지·주석에 실측
    기록) 반대로 진짜 회귀를 놓칠 위험이 생긴다. `extractInboundSigningRef` 적용 범위도
    `grep` 으로 확인한 결과 원래 중복된 3자리(`triggers.service.ts` 2곳,
    `chat-channel-binder.service.ts` 1곳) 전부에 적용되어 있고 남은 인라인 캐스트가 없다 —
    부분 적용으로 인한 drift 도 없다.
  - 제안: 조치 불요. 세 항목 모두 스코프 이탈이 아니라 이 PR 내부의 리뷰-수정 사이클과
    핵심 수정의 직접적 파급으로 판단된다.

- **설정·임포트·포맷팅 관점**: `package.json`/lockfile/`tsconfig*`/`.eslintrc*`/CI 설정 변경
  **0건** (`git diff --stat -- '*.json' '*.yml' '*.yaml'` 로 확인, 매치된 것은 리뷰 산출물
  JSON(`meta.json`/`_retry_state.json`)뿐). `console.log`/`debugger`/`TODO`/`FIXME` 류 추가
  0건. 프론트엔드·마이그레이션·`spec/` 파일 변경 0건 — 변경 파일 전수가
  `codebase/backend/src/modules/{hooks,triggers}`·`codebase/backend/src/repo-guards`·
  `codebase/backend/test`·`plan/`·`review/` 로만 한정된다. 순수 포맷팅-only diff(공백·개행
  재배열)도 관측되지 않았다 — 모든 diff hunk 가 실질 로직·주석·테스트 추가와 결합돼 있다.

## 참고 (절차 투명성, 이슈로 집계하지 않음)

리뷰 도중 워킹트리 상태를 확인했을 때(`status --short` 상당 명령) `codebase/backend/src/modules/
hooks/hooks.service.ts` 가 unstaged 수정 상태였다. 비교해 보니, 이 PR 이 고친 두 번째 hot-path
자리(interaction ack 직전의 `lastTriggeredAt` 갱신 — 커밋된 diff 에서는 컬럼 한정
`update({id}, {lastTriggeredAt})` 로 바뀌어 있다)가 **`await this.triggerRepository.save(trigger);`
로 되돌려져 있었다.** 이는 이번 리뷰 대상 diff(`origin/main...HEAD`)에는 없는 변경이며,
`hooks.service.spec.ts` 신규 테스트 docblock(같은 call site 를 종전 `save(trigger)` 로 되돌려도
`hooks.service.spec.ts` 전건이 GREEN 이었다는 실측을 적어 둔 그 블록)이 가리키는 바로 그
뮤테이션 — 즉 병렬 fan-out 리뷰 규약이 경고한 "다른 reviewer 가 같은 워킹트리를 동시에 mutate"
상황으로 판단된다. 본 scope 리뷰는 이 워킹트리 변경을 원복하지 않았다 — 내가 만든 변경이 아니고,
원복 조작은 다른 reviewer 의 진행 중인 측정을 방해할 수 있기 때문이다. 커밋된 diff 자체에는
영향이 없으므로 본 리뷰의 위험도 판정에는 반영하지 않았지만, 다음 라운드 리뷰어·orchestrator 는
이 잔여 상태(워킹트리에 커밋되지 않은 `save(trigger)` 되돌리기)를 인지해야 한다.

## 요약

이번 diff 는 표면적 총량(6,689줄)이 크지만, 실질 프로덕션 코드 변경은 트리거 `config`
lost-update 를 advisory lock + 락 안 재읽기로 닫는 4개 파일에 좁게 집중돼 있고, 나머지는
이 저장소 컨벤션이 요구하는 리뷰/일관성 산출물 커밋(3라운드 코드 리뷰 + 1라운드
consistency-check)이 대부분을 차지한다. 핵심 수정 외에 포함된 세 군데의 작은 리팩터
(`extractInboundSigningRef` 추출, `buildChannel` 통합, repo-guard `TRIGGER_ENTITY` 확장)는
모두 이 PR 자신의 앞선 리뷰 라운드가 지적한 항목이거나 핵심 수정이 직접 유발한 정합성
파손을 막는 필연적 후속 조치로, 추적 가능한 근거(리뷰 라운드 ID·실측)가 각 자리에 남아
있다. 설정 파일·임포트·포맷팅·무관한 파일 영역에 대한 의도치 않은 변경은 발견되지 않았다.
스코프 이탈로 분류할 CRITICAL/WARNING 항목은 없다. (리뷰 중 워킹트리에서 관측된 병렬
reviewer 의 미커밋 뮤테이션은 위 "참고" 절 참조 — 커밋된 diff 와는 무관.)

## 위험도

NONE
