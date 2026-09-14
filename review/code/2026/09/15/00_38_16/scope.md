# 변경 범위(Scope) 리뷰 — trigger-config-lost-update (12라운드 누적본)

## 검토 방법

`git diff --stat origin/main...HEAD`(214 파일)와 `git diff --stat origin/main...HEAD -- .
':!review' ':!plan'`(18 파일)을 대조해 실제 코드 변경과 리뷰/plan 산출물을 분리했다. 18개
코드 파일 전부를 `git diff origin/main...HEAD -- <path>`로 개별 전체 diff를 직접 열어
확인했다(프롬프트에 "크기 제한으로 생략"으로 표시된 `schedules.service.spec.ts`,
`trigger-transaction-mock.ts`, `chat-channel-binder.service.ts`, `triggers.service.ts`,
`trigger-config-lock.ts`, `trigger-config-lost-update.e2e-spec.ts` 포함). `package.json`/
lockfile 변경 0건을 재확인했고, `--ignore-all-space`로 포맷팅 전용 hunk 혼입 여부도
대조했다(차이 8줄 — 무의미한 수준, 이전 라운드 실측과 동일).

이번 라운드(00_38_16)는 직전 라운드(`review/code/2026/09/15/00_07_52`, 12라운드 누적본
scope 리뷰, 위험도 NONE)의 스코프 판정을 그대로 재사용하지 않고, 그 이후 새로 쌓인 커밋
`3641ead21`(docs) 하나를 별도로 대조했다.

## 발견사항

- **[INFO]** 이전 라운드(`00_07_52`) 이후 추가된 유일한 커밋은 그 라운드 자신의 Warning
  2건(W1·W3)만 정확히 고친다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(JSDoc,
    `git show 3641ead21` 기준 배선 확인), `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
    (`revokePerTriggerToken — 재읽은 행에 그 키가 아예 없으면 fallback 으로 쓴다` 테스트 신규),
    `plan/in-progress/trigger-config-lost-update.md`(11라운드 처분 표 추가)
  - 상세: 커밋 메시지가 인용한 `review/code/2026/09/15/00_07_52`의 W1(`mergeIntoFreshSubKey`의
    `fallback` 분기를 어느 fixture 도 행사하지 않음)·W3(`trigger-config-lock.ts` JSDoc의
    "창 2·3·4" 열거가 실제 호출부 수보다 과소 서술) 둘 다 `git diff`로 직접 대조한 결과
    그 범위를 정확히 벗어나지 않는다. 코드 변경은 JSDoc 문구 교체(열거 → 규칙 서술)와 신규
    테스트 1건뿐이며, 함수 시그니처·동작·다른 호출부는 건드리지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 전체 diff(코드 18파일, `+2198/-162`, plan 제외)는 여전히 단일 결함
  (`trigger.config` 스냅샷 통째 덮어쓰기로 인한 `inboundSigningRef` lost-update/fail-open)
  과 그 자매 클래스(hooks/schedules의 `save(entity)` 통째 저장) 하나에 수렴
  - 위치: `CHANGELOG.md`, `codebase/backend/src/modules/{hooks,schedules,triggers}/**`,
    `codebase/backend/src/repo-guards/__tests__/**`,
    `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
  - 상세: `package.json`/lockfile/설정 파일 변경 0건. `hooks.service.ts`의
    `touchLastTriggeredAt` 추출, `schedules.service.ts`의 컬럼 한정 갱신, repo-guard
    (`endpoint-path-conflict-wrap-guard.ts`)의 `manager.transaction` 콜백 경계 인식 확장은
    모두 핵심 수정(`update()`의 저장을 advisory lock 트랜잭션 안으로 옮긴 것)이 강제하는
    파생 변경이며, 각 변경 지점에 그 필연성을 설명하는 근거가 코드 주석/CHANGELOG/plan에
    남아 있다. `extractInboundSigningRef` 추출·`withTransactionMock` 헬퍼 승격도 이 PR
    자신이 반복해 만든 중복(3중 인라인 캐스트, 6개 spec 파일의 깨진 mock)을 즉시 정리한
    것으로, 무관한 사전 리팩토링이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `plan/`·`review/consistency/**`·`review/code/2026/09/14/*`(11라운드)·
  `review/code/2026/09/15/00_07_52`(12라운드) 산출물이 같은 changeset에 포함
  - 위치: `plan/in-progress/trigger-config-lost-update.md`,
    `review/consistency/2026/09/14/17_10_16/*`, `review/code/2026/09/14/{18_17_44,...,23_38_09}/*`,
    `review/code/2026/09/15/00_07_52/*`
  - 상세: 이 저장소의 `developer` 워크플로 규약이 요구하는 강제 fix-review 반복 루프의
    정상 산출물이며(메모리 `feedback_review_fix_stale_loop.md`가 기록한 선례와 동일 패턴),
    코드 변경과 무관한 별도 관심사를 끌어들이지 않는다.
  - 제안: 조치 불요.

이 외에 요청 범위를 벗어난 리팩토링, 임포트 정리, 포맷팅 전용 변경, 불필요한 주석 추가/삭제,
무관한 설정 파일 변경은 이번 라운드에서 새로 발견되지 않았다. 직전 라운드(`00_07_52`)가
이미 전수 대조한 19개 코드/plan 파일의 판정(핵심 수정에 직접 종속, scope creep 없음)도
이번 재확인에서 뒤집히지 않았다.

## 요약

직전 라운드 이후 쌓인 유일한 커밋(`3641ead21`)은 그 라운드 자신이 지적한 Warning 2건만
정확히 고치는 docs/test 전용 변경이라 스코프 이탈이 없다. 전체 diff(코드 18파일)도 여전히
단일 lost-update 결함과 그 자매 클래스 하나에 수렴하며, `package.json`/lockfile/설정 파일
변경은 0건, 포맷팅 전용 변경도 없다. Scope 관점에서 차단할 사항이 없다.

## 위험도

NONE
