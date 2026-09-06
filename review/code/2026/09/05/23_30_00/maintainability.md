# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `sanitizeForResponse()` 안에 "항목을 순회하며 strip-key 집합에 있으면
  건너뛰고 나머지를 새 객체로 옮긴다" 는 동일한 루프 패턴이 `config.interaction` 축과
  `config.notification.signing` 축에서 구조적으로 완전히 동일하게 반복된다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:637-647`
    (`config.interaction` 축) 과 `:651-666` (`config.notification.signing` 축).
    같은 메서드 안의 `config.chatChannel` 축(`:624-635`)은 `hasBotToken` 파생 필드를
    추가로 주입하므로 구조가 다르지만, interaction 축과 signing 축은 "대상 객체 →
    `Object.entries` 순회 → strip-key 집합에 있으면 skip → 새 객체에 담기" 흐름이
    변수명만 다를 뿐 동일하다.
  - 상세: 이 메서드는 과거 리뷰 라운드(`review/code/2026/09/05/19_08_18` INFO#8)에서
    "strip 필터 루프 중복"을 이미 지적받았고, 그때는 "두 축의 후처리가 다르다
    (`hasBotToken` 주입)" 는 근거로 조치 불요 처분을 받았다. 그러나 그 판단 시점에는
    `NOTIFICATION_SIGNING_STRIP_KEYS`(19:08 라운드에서 신설) 축만 있었고,
    `INTERACTION_RESPONSE_STRIP_KEYS` 축(`review/consistency/2026/09/05/22_25_00`
    Critical 1 대응, 이후 라운드에서 신설)이 나중에 추가되면서 상황이 바뀌었다.
    지금은 interaction 축과 signing 축 **둘 다** `hasBotToken` 같은 파생 필드 후처리가
    없어, 애초의 "후처리가 다르다" 는 차별화 근거가 이 두 축 사이에는 적용되지 않는다.
    즉 이번 diff 가 기존에 유예됐던 중복과는 별개로, 그 유예 근거가 더는 성립하지 않는
    새로운 형태의 순수 중복을 만들었다. 이 메서드 자신의 JSDoc(`:605-606`)도 "다음에
    비밀 축이 하나 더 생기면 목록을 늘리지 말고 선언적 SoT로 옮길 것"이라고 스스로
    경고하고 있어, 저자도 이 패턴이 확장에 취약하다는 것을 인지하고 있다.
  - 제안: `stripKeys(source: Record<string, unknown>, strip: ReadonlySet<string>): Record<string, unknown>`
    같은 사설 헬퍼로 공통 루프를 추출하고, `chatChannel` 축만 그 결과에
    `hasBotToken` 을 덧붙이는 후처리를 얹는다. 최소 침습이면서 세 축 모두 같은 헬퍼를
    쓰게 되어 다음 축 추가 시 새 루프를 복붙할 유혹을 줄인다.

- **[INFO]** `sanitizeForResponse()` 가 4개의 서로 다른 축(엔티티 컬럼 삭제·
  `config.chatChannel` 정화·`config.interaction` 정화·`config.notification.signing`
  정화)과 `workflow` 참조 좁히기까지 한 메서드에 모두 담겨 본문이 약 84줄
  (`:608-691`)로 늘었다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:608-691`.
  - 상세: 각 축은 서로 독립적인 관심사이고(엔티티 컬럼 vs JSONB 내부 키 3종 vs 조인된
    관계 좁히기), 메서드 하나에 조건 분기가 5~6개 중첩 없이 나열돼 있어 지금 당장
    가독성이 심각하게 나쁘지는 않다. 다만 이 메서드가 이미 "세 번 같은 형태로 좁게
    틀렸다"(메서드 자체 JSDoc, `:592`)는 이력이 있고 축이 늘어나는 추세라, 다음 축이
    추가되면 함수가 더 길어지고 각 축의 실패를 국소적으로 테스트하기 어려워진다.
  - 제안: 즉시 차단 사유는 아니다. 위 WARNING 의 `stripKeys` 헬퍼 추출과 함께, 축마다
    사설 메서드(`stripChatChannel`, `stripInteraction`, `stripNotificationSigning`,
    `stripEntityColumns`)로 쪼개는 리팩토링을 다음 축 추가 시점에 고려할 것.

- **[INFO]** `SchedulesController.toResponse()` 의 지역 변수명이 `t` 로, 같은 파일의
  다른 코드(서술적 이름 사용) 대비 유독 축약돼 있다. 직전 코드 리뷰
  (`review/code/2026/09/05/18_23_02`)에서 이미 지적됐고 "이월(조치 불요)" 로 명시적으로
  유예된 항목이며, 이번 diff 에서도 그대로 남아 있다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:68`
    (`const t = schedule.trigger;`), 사용처 `:71-77`.
  - 상세: 이 메서드는 트리거 엔티티 전체가 새던 것을 참조 4필드로 좁히는, 이 PR 의
    핵심 보안 경계다. 스코프가 13줄로 짧아 즉시 오독 위험은 낮지만, 위쪽 JSDoc 이
    상세한 만큼 본문 변수명도 서술적이면 읽는 부담이 더 줄어든다.
  - 제안: 조치 불요(이미 유예 확인됨). 다음에 이 메서드를 다시 손댈 일이 있으면
    `t` → `trigger` 로 바꿀 것.

- **[INFO]** "이미 응답에 실려 나가고 있었다 …" 로 시작하는 배경 설명 주석 블록이 4개
  DTO 파일에 문구 그대로 반복된다. 직전 코드 리뷰(`review/code/2026/09/05/18_23_02`)
  에서 이미 지적·유예된 항목이고 이번 diff 에서도 동일하게 남아 있다.
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:55`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:118`,
    `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:93`,
    `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:98`.
  - 상세: 코드 중복이 아니라 주석 중복이라 당장 위험은 낮다. 이 서사(§5.4 스윕 경위)를
    나중에 정정해야 하면 4곳을 각각 찾아 동기화해야 하는 비용만 있다.
  - 제안: 조치 불요(이미 유예 확인됨).

## 요약

이번 변경은 응답-계약 검증자(§5.4)를 4개에서 18개 DTO 로 넓히고, 그 과정에서 실측으로
드러난 트리거 회전 secret 2종의 응답 유출(엔티티 컬럼 미스트립 + 스케줄 조인을 통한
2차 유출)과 `config.interaction.triggerToken` 미스트립을 함께 틀어막는 작업이다. 7 라운드에
걸친 반복 리뷰를 거치며 네이밍(`TRIGGER_RESPONSE_STRIP_COLUMNS`,
`NOTIFICATION_SIGNING_STRIP_KEYS`, `ScheduleTriggerRefDto` 등)이 명확해졌고, 각 결정의
배경(왜 `select: false` 를 안 썼는지, 왜 서비스가 아니라 컨트롤러에서 좁히는지, 왜 세
목록으로 나눴는지)이 코드 인접 주석과 CHANGELOG·plan 트래커에 촘촘히 남아 있어 전반적
가독성과 이력 추적성이 높다. `contractForDto` 메모이제이션·`allowMissing` 옵션·§5.4 금지
조합 래칫(양성 대조군 fixture 포함) 등 신규 테스트 인프라도 각자의 설계 근거를 뮤테이션
테스트로 검증해 뒀다. 유일한 실질 지적은 `sanitizeForResponse()` 안에서
`config.interaction` 축과 `config.notification.signing` 축이 구조적으로 동일한
strip-loop 를 반복한다는 점이다 — 과거 라운드에서 "두 축의 후처리가 다르다" 는 근거로
같은 종류의 지적을 유예했지만, 그 근거는 이번에 추가된 이 두 축 사이에는 적용되지 않아
공유 헬퍼로 추출할 여지가 남아 있다. 나머지는 이미 이전 라운드에서 지적·유예된 사소한
네이밍(`t`)·주석 반복 항목으로, 이번 diff 가 새로 만든 문제가 아니다.

## 위험도

LOW
