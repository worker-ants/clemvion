# 변경 범위(Scope) Review

## 검토 방법

`git diff origin/main...HEAD --stat`/`--name-only` 로 전체 변경 파일을 전수 확인하고, 프롬프트에서
생략된 diff(파일 4·5·8·9·10·11·16·17)는 저장소에서 직접 `git diff origin/main...HEAD -- <path>` 로
열람했다. `plan/in-progress/trigger-config-lost-update.md` 의 스코프 결정 표(수용·수정 / 후속 등재 /
planner 범위)와 대조해 실제 diff 가 그 결정과 어긋나는지 확인했다. 저장소 파일은 뮤테이션하지
않았다(`git status --short` 로 확인, read-only 리뷰).

## 발견사항

- **[INFO]** 웹훅 인입 hot path(`hooks.service.ts`)가 원 스코프(트리거 config PATCH 경합)와
  다른 모듈로 확장됐다 — 단, 같은 결함 클래스라 문서화된 의도적 확장
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (`touchLastTriggeredAt` 신설,
    두 호출부 — 함수명 기준, 원 diff 게이트 227·686), `codebase/backend/src/modules/hooks/hooks.service.spec.ts`
  - 상세: 트래커 항목은 "동시 PATCH 가 trigger.config 를 잃는다"였는데, 이 PR 은 웹훅 인입
    경로의 `lastTriggeredAt = ...; save(trigger)` 도 함께 컬럼 한정 `update()` 로 바꿨다.
    모듈 경계로는 원 스코프 밖이지만, CHANGELOG·plan 양쪽에 "잃는 것이 같은
    `inboundSigningRef` 이고 PATCH 경합보다 훨씬 잦은 경로"라는 근거가 명시돼 있고,
    실제로 3라운드 리뷰가 이 자리의 회귀 테스트 부재를 CRITICAL 로 잡아낸 이력까지 plan 에
    기록돼 있다(`review/code/2026/09/14/19_44_08` testing CRITICAL#2). 같은 root cause(전체
    엔티티 `save()` 로 인한 `config` 스냅샷 되돌림)를 닫는 것이므로 임의 기능 확장은 아니다.
  - 제안: 조치 불요 — 이미 CHANGELOG·plan 에 왜 스코프에 포함됐는지 명시돼 있어 후속 리더가
    오해할 위험이 낮다.

- **[INFO]** 정적 분석 가드(`endpoint-path-conflict-wrap` 래칫) 3파일 수정 — 핵심 수정과 직접
  무관해 보이지만 그 수정이 유발한 구조 변경 때문에 필요해진 것
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`,
    `endpoint-path-conflict-wrap.spec.ts`, `fixtures/endpoint-path-save.fixture.ts`
  - 상세: `TriggersService.update()`의 `save(trigger)`를 `manager.transaction(async (m) => m.save(Trigger, ...))`
    안으로 옮기면서 저장의 수신자 이름이 `this.triggerRepository`에서 `m`으로 바뀌어, 수신자
    이름으로 저장 자리를 스캔하던 기존 가드가 "래핑이 사라졌다"는 오탐(fail-safe RED)을 냈다.
    plan(§"창 1 을 옮기자 정적 가드가 눈이 멀었다")에 이 인과관계와 뮤테이션 검증(RED 2건/1건)이
    기록돼 있다. 가드 로직 확장(인자 기반 엔티티 판별 + 콜백 경계 통과)과 대조군 fixture 3종
    추가가 이 PR 의 핵심 변경(락 도입)이 직접 깨뜨린 기존 회귀 가드를 다시 세우는 목적이라
    스코프 이탈이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 소규모 DRY 리팩터 3건이 이번 PR 안에서 도입·소비된다 — 무관한 코드 정리가 아님
  - 위치: `triggers.service.ts` 의 `assertTriggerFound`/`throwTriggerNotFound`(함수명 기준,
    `findById`/`findByIdForUpdate`/삭제-경합/`rotateBotToken` 404 분기가 공유), `chat-channel-input-rules.ts`
    의 `extractInboundSigningRef`(3개 호출부가 이 PR 에서 새로 생기거나 이 PR 이 값을 다시
    읽어야 하는 자리), `hooks.service.ts` 의 `touchLastTriggeredAt`
  - 상세: 세 헬퍼 모두 (a) 이 PR 이 새로 만든 호출부가 최소 하나 이상 있고, (b) plan 의
    리뷰 처분 표에 "복제가 정확히 이 PR 을 물었다"는 근거(한쪽만 회귀 테스트가 있어 다른 쪽이
    깨진 채로 넘어갈 뻔한 이력)와 함께 등재돼 있다. 순수 취향적 리팩터링이 아니라, 이 PR 자신이
    만든 중복이 buggy 해질 위험을 이 PR 안에서 닫은 것이다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/09/14/{18_17_44,19_07_43,19_44_08,20_17_16,20_49_15,21_18_21}/**`
  및 `review/consistency/2026/09/14/17_10_16/**` — 이전 리뷰 라운드 산출물이 diff 의 대부분
  (127개 파일 중 110개 이상, 약 13,000줄 중 절반 이상)을 차지한다
  - 위치: `review/code/2026/09/14/*/`, `review/consistency/2026/09/14/17_10_16/`
  - 상세: 이 저장소 컨벤션(`CLAUDE.md` "코드 리뷰 산출물" 표, review-fix 루프 교훈)상
    `/ai-review`·`/consistency-check` 산출물은 `review/**` 에 커밋되는 것이 정상이며, 이번
    PR 은 6라운드의 review-fix 반복(초기 fix → 매 라운드 CRITICAL/WARNING 수정)을 거친
    흔적이다. 코드 변경 자체(17개 파일, CHANGELOG 포함)에 견주면 산출물 볼륨이 크지만, 이는
    프로젝트가 강제하는 표준 워크플로의 부산물이지 임의로 끼워 넣은 무관한 파일이 아니다.
  - 제안: 조치 불요. (참고: 리뷰가 스스로를 리뷰하는 재귀적 구조이므로, 이 산출물들 자체의
    내용 검증은 다른 관점의 리뷰어 몫으로 남긴다.)

- **[INFO]** `plan/in-progress/trigger-config-lost-update.md` 가 506줄로 매우 크다
  - 위치: `plan/in-progress/trigger-config-lost-update.md`
  - 상세: 착수 전 실측(창 4개 vs 트래커 2개) · 설계 근거 · 6라운드 리뷰 처분 표 · 후속 항목
    등재가 전부 한 파일에 누적됐다. 프로젝트 컨벤션(plan lifecycle) 상 진행 중 작업의 근거는
    plan 문서에 쌓는 것이 정상이고, 각 절이 실제 diff 결정과 1:1 대응해 추적 가능하다 —
    스코프 이탈이 아니라 오히려 스코프 경계(무엇을 이 PR 에서 고치고 무엇을 planner/후속으로
    미뤘는지)를 투명하게 남긴 사례다.
  - 제안: 조치 불요.

- **설정 변경**: `package.json`/lockfile 등 설정 파일 diff 0건 확인(`git diff origin/main...HEAD --name-only`
  전수 대조). **spec/ 변경**: 0건(plan frontmatter `spec_impact: none` 과 일치). **임포트**: 신규
  import 는 전부 이번 PR 이 신설한 내부 함수(`trigger-config-lock`, `extractInboundSigningRef`
  등) 참조뿐 — 무관한 정리성 import 변경 없음. **포맷팅**: `git diff --check` 공백 오류 0건,
  순수 공백-only 헝크 별도 확인 결과 이상 없음(전부 신규 코드/주석 블록 안의 빈 줄).

## 요약

이 PR 은 "동시 PATCH 가 trigger.config 를 잃는다"는 단일 트래커 항목을 닫는 6라운드 review-fix
반복의 최종 커밋 세트다. 코드 변경 17개 파일은 advisory lock 기반 lost-update 수정(핵심)과 그
수정이 직접 유발한 두 가지 필연적 파급(① 같은 결함 클래스인 웹훅 hot path, ② 저장 위치 이동으로
깨진 정적 분석 가드)으로 구성되며, 모두 CHANGELOG·plan 에 "왜 이 PR 범위에 포함되는가"가
사전에 근거와 함께 기록돼 있다. 리팩터(헬퍼 추출 3건)는 전부 이 PR 자신이 만든 호출부가
소비하는 것이라 무관한 코드 정리가 아니다. spec/ 변경 없음, 설정 파일 변경 없음, 무관한
import·포맷팅 변경 없음을 확인했다. diff 볼륨의 대부분을 차지하는 `review/**` 산출물은 프로젝트
표준 워크플로(review-fix 루프)의 정상 부산물이다. 의도 이상의 변경·불필요한 기능 확장·무관한
파일 수정은 발견되지 않았다.

## 위험도

NONE
