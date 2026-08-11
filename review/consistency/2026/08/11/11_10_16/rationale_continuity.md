# Rationale 연속성 검토 — spec/7-channel-web-chat (--impl-done)

## 특별 지시 사항에 대한 결론 (요약 선행)

지시받은 두 항목을 먼저 답한다:

1. **§R4 신규 문단("재차 실패는 `401`/`410` 만 뜻한다 + 그 외는 스트림 유예")은 `webchat-boot-single-flight`
   교훈을 뒤집지 않는다 — 오히려 정확히 그 교훈을 인용해 재발을 막는 설계다.** 실제 사고
   (`plan/complete/webchat-boot-single-flight.md`)는 **`sendCommand`(interact 명령) 의 비-410 실패**를
   `teardownSession()`(storage 소거)까지 겸한 종료로 취급해 살아있는 대화를 영구 유실시킨 사건이고,
   그 "명령 실패는 종료인가" 질문은 지금도 **미결 상태**로 별도 planner 트랙에 격리돼 있다
   (`plan/in-progress/webchat-command-failure-is-not-termination.md`, 옵션 A/B/C 미확정). 이번에 검토 대상인
   §R4 문단은 그 코드 경로가 아니라 **`/refresh-token`(재로드 401 낙관적 갱신) 재시도 실패**를 다루는,
   이 PR 이 새로 도입한 별개의 분기다. 그 문단은 "네트워크·5xx 까지 종료로 보면 일시적 장애가 살아있는
   대화를 끝낸다" 를 `webchat-boot-single-flight` 사고를 근거로 **명시 인용**하며 그 실수를 피하도록
   설계됐다 — 대안 부활이 아니라 교훈의 정확한 적용이다. 이 branch 자체의 리뷰 이력에도 동일 실수가
   **일시적으로 재발했다가 즉시 교정된 흔적**이 있다(`31b14aa22 fix(webchat): refresh 가 네트워크
   오류로 실패해도 종료 확정하던 것 — 내 CHANGELOG 원칙과 충돌했다`), 즉 최종 상태(target)는 그
   재발을 이미 걸러낸 상태다.
2. **"결정은 내려졌으나 구현은 없다(Planned)" 고지 제거는 정당하다.** 그 고지는 `43423f830`
   (`plan/complete/webchat-reload-rest-error-branches.md` §본 PR 에서 한 것)에서 §R4 머리에 달렸던 것으로,
   당시 실제로 `404`·복구불가 `401`·낙관적 refresh 3분기가 미구현이었기 때문이었다. 이번 diff
   (`eia-client.ts` `isTerminalAuthError`/`use-widget.ts` `recoverFromExpiredToken`/`seedWaitingFromStatus`
   REST 오류 분기)가 그 3분기 + 신규 4번째 갈래(`refresh_deferred`)까지 실제로 구현했고, frontmatter
   `status: implemented` 로 정합 승격됐다(해당 plan 이 `complete/` 로 이동 완료). 고지 제거는 구현
   완료를 반영한 정당한 정리이며, 결정 자체(§R4 의 낙관적 refresh 원칙)는 이전부터 있던 것을
   재확인·정교화한 것이지 새로 뒤집은 것이 아니다.

두 항목 모두 **CRITICAL 없음**. 다만 조사 과정에서 별도의 cross-spec 정합 갭 하나를 발견해 아래
발견사항에 기록한다(이번 diff 가 만든 결함은 아니나, 이번 diff 가 그 위에 새로 의존을 얹었다).

## 발견사항

- **[WARNING]** §R4 가 인용한 `EIA §5.5` 원문은 실제로 `410` 을 문서화하지 않는다 — 오히려 그 자리를 `401` 로 명시한다
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1-2 2번째 항목("`410`(`EXECUTION_TERMINATED`)도
    `/refresh-token` 이 실제로 내는 분기다([EIA §5.5](../5-system/14-external-interaction-api.md))") 및 §R4
    본문("재차 실패(`401`/`410`)면 종료로 확정한다").
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §5.5 본문(`POST
    .../refresh-token` 응답 예시) — `401 Unauthorized   // execution 종료됨, 또는 expiresAt 까지 30분
    이상 남음`. 즉 EIA 자신의 문서는 **"execution 종료됨" 시나리오를 `401` 로 귀속**시키며 `410`
    가능성 자체를 언급하지 않는다(§5.5 응답 예시 블록에 `200`/`401` 두 코드만 존재).
  - 상세: 실제 backend 코드(`codebase/backend/src/modules/external-interaction/interaction.service.ts`
    `refreshToken()`)는 execution 이 terminal 이면 `GoneException`(`410 Gone` / `EXECUTION_TERMINATED`)을
    던진다 — 이는 `plan/complete/webchat-reload-rest-error-branches.md` §미구현 항목의 "구현 중
    `410`(`EXECUTION_TERMINATED`)도 `/refresh-token` 이 실제로 내는 분기임이 드러나 같은 갈래로 함께
    닫았다" 라는 기록과 일치한다 — 즉 **코드가 SoT 이고 그 사실 자체는 맞다.** 문제는, 그 발견이
    `3-auth-session.md` 에는 정확히 반영됐지만 **인용 대상인 `EIA §5.5` 자체는 이번 PR 은 물론 그
    선행 PR(`webchat-reload-rest-error-branches`)에서도 갱신되지 않았다**(`git log
    origin/main..HEAD -- spec/5-system/14-external-interaction-api.md` 결과 0건, `git log
    --oneline -- spec/5-system/14-external-interaction-api.md` 마지막 편집은 최초 작성 커밋
    `9ed6e6305`). 결과적으로 target 의 새 Rationale 문단은 **"EIA §5.5 가 이렇게 말한다"고 인용하지만
    실제로 그 절은 반대로(401) 말하고 있는 상태**를 그대로 둔 채 그 절을 근거로 인용한다. 이는
    criterion ④(암묵적 가정 충돌)에 해당한다 — 향후 누군가 `EIA §5.5` 원문(401-only)을 SoT 로 믿고
    backend `refreshToken()` 의 `GoneException` 분기를 "spec 과 다른 결함" 으로 오인해 제거하면,
    이번에 target 이 명문화한 3-갈래(복원/종료/스트림 유예) 판정이 조용히 깨진다.
    (참고: 직전 code-review 라운드 `review/code/2026/08/10/16_42_07/documentation.md` 가 유사하지만
    더 얕은 형태로 이 축을 이미 짚었다 — 그때는 "`410` 을 반환하지 않는다는 보장이 spec 어디에도
    없다" 로만 서술했는데, 이번 조사로 **`EIA §5.5` 가 침묵이 아니라 명시적으로 401 이라고 적고
    있다**는 더 구체적인 사실이 드러났다. 또한 가장 최신 code-review 라운드
    `review/code/2026/08/11/10_24_54/documentation.md` 는 "EIA §5.5·§8.3 는 이 diff 에서 참조만
    되고 편집되지 않았다"를 `spec_impact` 범위 판단 근거로만 확인했을 뿐, 그 참조 내용 자체의
    정합성은 검증하지 않았다.)
  - 제안: `project-planner` 트랙에서 `spec/5-system/14-external-interaction-api.md` §5.5 응답 예시에
    `410 Gone // execution 이미 종료됨(EXECUTION_TERMINATED)` 분기를 추가하고, `401` 주석에서
    "execution 종료됨" 문구를 제거(그 사유는 이미 `410` 으로 이관됐으므로)해 코드·`3-auth-session.md`
    §R4 와 정합시킨다. 급하지 않음(코드 자체는 이미 올바르게 동작하고 회귀 테스트로 고정돼 있음 —
    순수 cross-spec 문서 정합 갭). `webchat-spec-rationale-followup.md` 류의 후속 티켓에 등재를 권장.

- **[INFO]** "네트워크·5xx 는 종료가 아니다" 원칙의 적용 범위가 아직 열린 결정(`interact` 명령 실패)과 인접해 있다
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §R4 신규 문단.
  - 과거 결정 출처: `plan/in-progress/webchat-command-failure-is-not-termination.md`(미결, 옵션
    A/B/C), `plan/in-progress/webchat-spec-rationale-followup.md` 체크리스트("불변식 2… 착수 불가 —
    결정 전에 Rationale 로 적으면 결정을 앞질러 굳힌다").
  - 상세: 이번 §R4 문단은 `/refresh-token`(재로드 갱신) 실패에만 명시적으로 스코프돼 있고,
    `sendCommand`/`interact()` 명령 실패(여전히 미결)를 다루지 않는다 — 이 분리 자체는 정확하고,
    planner 도 두 축을 의도적으로 분리해 둔 상태다. 다만 두 문단이 표면상 매우 유사한 논거("일시적
    실패를 종료로 보면 살아있는 대화가 끊긴다")를 쓰기 때문에, 향후 이 열린 결정을 닫을 사람이 §R4
    의 "일시적 실패는 종료가 아니다" 를 **이미 정해진 선례**로 오독해 옵션 (A) 쪽으로 결정을
    앞질러 굳힐 위험이 낮게나마 있다(이 저장소가 반복 관측한 "한쪽만 고치고 자매 사이트를 놓친다"
    패턴의 변형).
  - 제안: §R4 문단 끝 또는 `webchat-command-failure-is-not-termination.md` 서두에 한 줄
    cross-link("본 원칙은 재로드 `refresh-token` 갱신 실패 한정이며 `interact` 명령 실패의 종료 여부는
    별도 미결 결정이다")를 추가해 두 결정 축의 경계를 명문화. 급하지 않음.

## 요약

검토 지시가 특정한 두 지점(§R4 신규 문단, "Planned" 고지 제거) 모두 Rationale 연속성 위반이
아니다 — 오히려 `webchat-boot-single-flight` 사고의 교훈("에러도 종료다"로 해석하면 살아있는
대화를 유실한다)을 명시적으로 인용해 그 실수를 피하도록 설계된, 별개 코드 경로(재로드
refresh-token 갱신)에 대한 새로운 3~4갈래 Rationale 이며, 실제로 그 사고가 다룬 `interact` 명령
실패 축은 여전히 미결로 격리돼 있어 침범하지 않았다. "Planned" 고지 제거도 대응하는 구현이 실제로
완료됐음을 코드·plan 이력으로 확인했다. 조사 중 발견한 유일한 실질 이슈는 target 이 아니라 **참조만
하고 편집하지 않은 `EIA §5.5`** 자체의 pre-existing 문서 갭이다 — 그 절의 응답 예시가 `410` 을
문서화하지 않고 오히려 종료를 `401` 로 귀속시키는데, 이번 target 의 §R4 는 코드에서 실측된 `410`
사실을 정확히 반영하면서도 그 인용 대상(EIA §5.5)의 불일치를 해소하지 않은 채로 둔다. 이는 이번
diff 의 결함이라기보다 이번 diff 가 그 위에 새로 의존을 얹은 pre-existing cross-spec drift이며,
plan-lifecycle 관점에서 이번 PR 의 `spec_impact` 범위 밖(참조-only)이라는 점은 직전 code-review
라운드가 이미 확인했다. 차단 사유는 없다.

## 위험도

LOW
