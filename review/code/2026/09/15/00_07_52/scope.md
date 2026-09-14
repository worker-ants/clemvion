# 변경 범위(Scope) 리뷰 — trigger-config-lost-update (11라운드 누적본)

## 검토 방법

`git diff --stat origin/main...HEAD`(197 파일)와 `git diff --stat origin/main...HEAD -- . ':!review/'`
(19 파일)를 대조해 실제 코드/plan 변경과 리뷰 산출물(`review/code/2026/09/14/*` 11라운드분 +
`review/consistency/2026/09/14/17_10_16`)을 분리했다. 19개 코드/plan 파일 전부를
`git diff origin/main...HEAD -- <path>` 로 개별 재확인했고, `git diff --ignore-all-space` 로
포맷팅 전용 변경이 실질 변경에 섞였는지도 대조했다(공백 무시 시 diff 크기 차이 8줄 — 무의미한
수준, 포맷팅 전용 hunk 없음). `git log --oneline origin/main..HEAD` 로 11개 커밋 전부가
`fix(triggers):` 접두로 이 결함 하나에 수렴함을 확인했다.

## 발견사항

- **[INFO]** `review/code/2026/09/14/*` 11라운드분 + `review/consistency/2026/09/14/17_10_16`
  (총 178개 산출물)이 코드 변경과 같은 changeset 에 포함
  - 위치: `review/code/2026/09/14/{17_10_16,18_17_44,19_07_43,19_44_08,20_17_16,20_49_15,21_18_21,21_50_09,22_24_35,23_01_18,23_38_09}/*`
  - 상세: 이 저장소의 `developer` 워크플로 규약(`CLAUDE.md`)은 구현 완료 후 `/ai-review` +
    critical/warning fix 를 "상시 승인된 강제 의무"로 명시하고, 리뷰 산출물은
    `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 에 쌓이도록 규정한다. 각 라운드 SUMMARY 를
    열어 보면 그 라운드가 지적한 Critical/Warning 이 다음 라운드 커밋에서 실제로 수정되는
    인과관계가 있다(예: `18_17_44` security CRITICAL#1 → 커밋 `567c82edb`; `19_44_08` testing
    CRITICAL#2 → hooks.service 대칭 테스트 추가; `23_38_09` C1 → 커밋 `91b816498`). 즉 scope
    creep 이 아니라 이 저장소가 강제하는 fix-review 반복 루프의 정상적인 축적물이다(메모리
    `feedback_review_fix_stale_loop.md` 가 기록한 선례와 같은 패턴).
  - 제안: 조치 불요(기록 목적). 다만 산출물 178개는 이번 PR 의 diff 크기(22,502줄 삽입)
    대부분을 차지하므로, 다른 관점(예: maintainability·documentation) 리뷰어가 이 축적물
    자체를 "비대한 diff"로 재지적하지 않도록 SUMMARY 집계 시 감안할 것.

- **[INFO]** 실제 코드/plan 변경은 19개 파일로 명확히 국한 — 전부 결함 하나에 직접 종속
  - 위치: `CHANGELOG.md`, `codebase/backend/src/modules/{hooks,schedules,triggers}/**`,
    `codebase/backend/src/repo-guards/__tests__/**`, `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`,
    `plan/in-progress/trigger-config-lost-update.md`
  - 상세: `package.json`/lockfile 변경 0건, 설정 파일 변경 0건. `triggers.service.ts`·
    `chat-channel-binder.service.ts`·신규 `trigger-config-lock.ts` 가 핵심 수정이고,
    `hooks.service.ts`(`touchLastTriggeredAt` 추출)·`schedules.service.ts`(컬럼 한정
    갱신)는 CHANGELOG 가 명시한 "일곱 군데 더" 중 두 자리로, 같은 `save(entity)` 통째
    저장 → lost-update 클래스의 자매 사례를 닫는 것이라 스코프 안이다.
  - 제안: 조치 불요.

- **[INFO]** repo-guard(`endpoint-path-conflict-wrap-guard.ts`) 확장은 핵심 수정이 강제한
  파생 변경 — 요청 없는 기능 확장이 아니다
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:26-35`
    (`TRIGGER_ENTITY` 상수 신설), `:108-121`(`isWrappedByConflictCatch` 콜백 경계 인식),
    `:156-172`(`EntityManager.save(Trigger, …)` 형태 인식)
  - 상세: `triggers.service.ts` 의 `update()` 저장이 `manager.transaction(async (m) => …)`
    안으로 들어가면서 수신자가 `this.triggerRepository` 에서 콜백 인자 `m` 으로 바뀌었다.
    기존 정적 래칫 가드는 수신자 이름만 보고 있어 이 이동을 "래핑이 사라졌다"는 오탐(false
    RED)으로 읽었을 것이다. 이 가드 확장은 핵심 수정(창 1을 락 안으로 옮김)이 기존 정적
    래칫의 전제를 깨는 것을 막는 필연적 파생 변경이며, `endpoint-path-conflict-wrap.spec.ts`
    ·`endpoint-path-save.fixture.ts` 의 대응 변경도 이 확장 하나를 검증하는 범위 안에 있다.
  - 제안: 조치 불요.

- **[INFO]** `extractInboundSigningRef` 추출(`chat-channel-input-rules.ts`)은 이 PR 이
  스스로 3중 복제한 인라인 캐스트를 정리한 것 — 요청 범위를 벗어난 사전 리팩토링이 아니다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:239-250`
  - 상세: 이 함수가 대체하는 `{ chatChannel?: { inboundSigningRef?: string } }` 인라인
    캐스트 자리 세 곳(`triggers.service.ts` 두 곳, `chat-channel-binder.service.ts` 한 곳)은
    전부 이번 PR 이 새로 건드리는 lost-update 방지 로직 내부다 — 기존에 있던 무관한 코드를
    정리한 것이 아니라, 이번 수정으로 그 패턴이 3곳으로 늘어나는 것을 막기 위해 이번 PR
    자신이 즉시 통합한 것이다.
  - 제안: 조치 불요.

- **[INFO]** `withTransactionMock` 헬퍼를 공용 위치(`__test-utils__/`)로 승격 + 2개 spec
  파일(`triggers.service.spec.ts`, `triggers.web-chat.spec.ts`)의 전체 `Trigger` repo mock
  일괄 래핑
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`(신규),
    `triggers.web-chat.spec.ts:9, 82-85`
  - 상세: `update()`/`remove()` 가 `manager.transaction` 을 요구하게 되면서 `manager` 없는
    기존 mock 이 전부 깨지므로, 이 배선은 핵심 수정에 직접 종속된 필연적 변경이다. plan 문서
    자체가 "6개 파일 중 실제로 감싼 것은 2개뿐이고 나머지 4개는 그 경로를 안 타 지금은 안전"
    이라고 스스로 스코프를 좁혀 적어 둔 점도 확인했다(과잉 확장 방지 근거로 타당).
  - 제안: 조치 불요.

- **[INFO]** plan 문서(`plan/in-progress/trigger-config-lost-update.md`, 644줄)에 실측·
  기각된 대안·11라운드 처분 이력이 상세히 누적
  - 위치: 전체
  - 상세: 이 저장소 컨벤션(`CLAUDE.md` "진행 중 작업" 항목)이 요구하는 작업 추적 문서이며,
    "후속(developer 범위) — 이 PR 로 넓히지 않는다" 섹션이 §D 에서 실측한 유사 위험 지점
    19곳 이상을 의도적으로 스코프 밖으로 미룬 근거를 남기고 있다 — 오히려 스코프를 좁게
    유지한 증거다. 체크리스트 하단 3개 항목(`트래커 [x] 표시`·`run-test-all.sh`·`/ai-review
    + --impl-done`)이 아직 미체크 상태인데, 이는 지금 이 리뷰 라운드가 그 절차의 일부이므로
    정상이다(scope 위반 아님, 진행 상태일 뿐).
  - 제안: 조치 불요. 이 라운드가 끝나면 체크리스트·`plan/complete/` 이동을 잊지 말 것
    (별도 프로세스 관점, scope 관점의 지적 아님).

이 외에 요청 범위를 벗어난 리팩토링, 임포트 정리, 포맷팅 전용 변경(공백 무시 diff 대조로
확인), 불필요한 주석 추가/삭제, 무관한 설정 파일 변경은 발견되지 않았다. `console.log`/
`TODO`/`FIXME`/`debugger` 등 잔여 디버그 흔적도 전수 grep 으로 0건 확인했다.

## 요약

실제 코드/plan 변경은 19개 파일(+2,806/-162)로, 전부 "동시 PATCH 가 `trigger.config` 를
스냅샷으로 통째 덮어써 `inboundSigningRef` 를 잃는" 단일 결함과 그 결함의 4개 창(update·
binder 성공/실패·rotateBotToken) + 자매 클래스(hooks/schedules 의 `save(entity)` 통째
저장) 를 닫는 데 직접 종속된다. repo-guard 확장·헬퍼 추출·mock 승격은 모두 핵심 수정이
강제한 파생 변경이지 임의의 사전 정리가 아니며, 각 변경 지점에 그 필연성을 설명하는 근거가
코드 주석/plan 문서에 남아 있다. `package.json`/설정 파일 변경은 0건이고 포맷팅 전용 변경도
없다. `review/code/2026/09/14/*` 11라운드 + `review/consistency` 산출물(178개 파일, diff
대부분을 차지)은 이 저장소가 강제하는 fix-review 반복 루프의 정상 산출물이며 무관한 파일
혼입이 아니다. Scope 관점에서 차단할 사항이 없다.

## 위험도

NONE
