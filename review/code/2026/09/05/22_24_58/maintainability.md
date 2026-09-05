# 유지보수성(Maintainability) 리뷰

## 컨텍스트

이 diff 는 §5.4 응답-계약 검증자(`assertMatchesContract`/`contractForDto`) 배선을 4→18개
DTO 로 넓히고, 그 과정에서 드러난 트리거 회전 secret 유출(엔티티 컬럼 미스트립 + 스케줄
조인을 통한 2차 유출) 수정과 5개 DTO 24필드 선언 보정을 포함한다. 같은 브랜치 안에서
이미 4라운드(`18_23_02`·`19_08_18`·`20_45_37`·`21_40_37`)의 코드 리뷰가 순차로 돌았고,
그때 지적된 실질 결함(죽은 코드 이중 순회, JSDoc-선언 분리, stale 주석, vacuous 테스트 등)은
이번 최종 상태에서 실측 확인상 대부분 해소돼 있다. 아래는 그 네 라운드가 이미 "이월
(carried-over)"로 등재해 둔 항목 및 이번 최종 diff 자체에서 관측한 잔여 사항이다.

## 발견사항

- **[INFO]** `CHANGELOG.md` 의 새 섹션 끝에서 다음 `## Unreleased` 헤딩 전까지 빈 줄이
  2개 연속으로 들어가, 파일 나머지 부분(섹션 사이 빈 줄 1개)과 어긋난다.
  - 위치: `CHANGELOG.md` — 신규 섹션("트리거 회전 secret 이 두 엔드포인트로 나갔다…") 끝
    문단("...78 은 종전에 알려져 있던 10건보다 훨씬 크다.)") 바로 다음, `## Unreleased —
    \`GET /api/audit-logs\`...` 헤딩 바로 전. (게이트 대응 라인 없음 — 새 파일 diff 가
    프롬프트에서 생략돼 `git diff origin/main -- CHANGELOG.md` 로 직접 확인. 현재 파일
    기준 79~81번째 줄, `sed -n '76,84p' CHANGELOG.md` 로 재확인 가능.)
  - 상세: 파일의 다른 모든 섹션 경계(예: `## Unreleased — \`AlertRuleDto.threshold\`...`
    앞)는 빈 줄 1개로 구분되는데, 이번에 추가된 신규 최상단 섹션만 빈 줄 2개로 끝난다.
    렌더링에는 영향이 없으나(마크다운은 연속 빈 줄을 접는다) 순수 텍스트로 diff/blame 을
    볼 때 일관성이 깨진다.
  - 제안: 빈 줄 하나를 제거해 파일 전체의 섹션 구분 관례에 맞춘다.

- **[INFO]** `SchedulesController.toResponse()` 안에서 `schedule.trigger` 를 담는 변수명이
  `t` 로, 같은 메서드·같은 파일의 다른 식별자(`workflowId`, `workspaceId` 등 서술적 이름)와
  비교해 유독 축약돼 있다. 이 항목은 이미 3라운드(`18_23_02`·`20_45_37`·`21_40_37`)에서
  INFO 로 지적·이월된 상태이며 이번 최종 diff 에도 그대로 남아 있다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:68`
    (`const t = schedule.trigger;`), 사용처 `:75-81` (`private toResponse` 메서드 전체는
    `:67-84`).
  - 상세: 이 메서드는 이 PR 의 핵심 보안 처리(조인된 트리거 엔티티 전체를 참조 4필드로
    좁힘)를 담당하는 자리이고, 바로 위 JSDoc(`:53-66`)이 상세히 배경을 설명하는 만큼 본문
    변수명도 서술적이면 가독성이 한 단계 올라간다.
  - 제안: `t` → `trigger` (타입 `Schedule`/`Trigger` 와 네임스페이스가 달라 충돌 없음).
    다만 팀이 이미 여러 라운드에 걸쳐 "사소함" 으로 유예한 항목이라 차단 사유는 아니다.

- **[INFO]** "이미 응답에 실려 나가고 있었다 …" 로 시작하는 배경 설명 주석 블록이 4개
  DTO 파일에 거의 그대로 반복된다. 이 역시 `18_23_02` 라운드에서 이미 지적·이월됐다.
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`
    (신규 필드 `createdBy`/`lastTriggeredAt` 앞), `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`appUrl` 앞), `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts`
    (`documentCount` 앞), `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`
    (`chatChannelHealth` 앞).
  - 상세: 코드 중복이 아니라 설명 주석의 중복이라 위험도는 낮다. 각 DTO 가 파일별로 다른
    정보(FE 소비처 수 등)도 함께 담고 있어 완전한 추출은 어렵지만, 이 서사(§5.4 스윕 경위)를
    나중에 정정할 일이 생기면 4곳을 각각 찾아 동기화해야 한다.
  - 제안: 즉시 조치 불필요. 정정이 필요해지면 4곳 전체를 grep 으로 찾아 동기화할 것.

- **[INFO]** `TriggersService.sanitizeForResponse()` 가 이번 diff 로 4개의 서로 다른
  책임(1. `config.chatChannel` 키 스트립 + `hasBotToken` 파생, 2.
  `config.notification.signing` 키 스트립, 3. 조인된 `workflow` 참조 좁히기, 4. 엔티티
  컬럼 스트립)을 한 private 메서드에서 처리하도록 커졌다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — 메서드 선언
    `private sanitizeForResponse<T extends Trigger>(trigger: T): T {` 부터 닫는 중괄호까지
    (JSDoc 포함 약 100줄, 본문만 약 70줄). (게이트 대응 라인 없음 — 해당 파일 diff 가
    프롬프트에서 생략돼 `git diff origin/main -- .../triggers.service.ts` 로 직접 확인.)
  - 상세: 각 블록은 `if (cfg)` → `if (cfg.chatChannel)`/`if (signing...)` → 내부 `for`
    루프 → `if (configTouched)` → `if (wf)` → 마지막 `for` 루프로 이어져 순환 복잡도가
    이전 버전보다 눈에 띄게 늘었다. 다만 각 블록에는 "왜 이 축이 필요한가" 를 설명하는
    JSDoc(§5.4 응답-계약 스윕 경위, 두 번 좁게 틀렸던 이력)이 잘 붙어 있어 읽는 데 큰
    어려움은 없다. 팀은 같은 라운드(`review/code/2026/09/05/21_40_37` RESOLUTION W3)에서
    순수 함수 추출을 **의도적으로 보류**했다 — "이 라운드에 이미 동작 수정 2건이 들어갔고,
    추출은 검증 수단을 바꾸지 않으면서 diff 만 넓힌다" 는 근거를 남겼다. 그 판단은
    합리적이라고 본다.
  - 제안: 이번 PR 범위에서 즉시 조치 불필요. 다음에 이 메서드에 네 번째 축(예: 새로운
    비밀 필드)이 추가되면 그때는 `stripChatChannelSecrets`/`stripNotificationSigning`/
    `narrowWorkflowRef`/`stripEntityColumns` 같은 이름의 작은 순수 함수로 나누는 것을
    권장한다 — RESOLUTION 문서가 이미 "네 번째 재발 시 `@Sensitive()` 류로 승격" 을
    strip 목록 3벌 문제에 대해 적어 둔 것과 같은 트리거 조건을 이 함수 자체에도 적용할
    만하다.

## 요약

이번 diff 는 §5.4 응답-계약 검증자의 배선 확대와 그 과정에서 발견된 두 건의 secret 유출
수정, 5개 DTO 24필드 선언 보정으로 구성된다. 이미 같은 브랜치에서 4라운드의 코드 리뷰가
돌며 죽은 코드(이중 순회), JSDoc-선언 분리, stale 주석, vacuous 테스트(존재하지 않는
fixture 참조, secret 없는 mock) 등 실질적 유지보수성 결함을 상당수 잡아 고쳤고, 이번
최종 상태를 직접 열어 확인한 결과 그 수정들은 실제로 반영돼 있다(`sanitizeForResponse` 의
undefined-then-delete 이중 순회는 단일 delete 루프로 정리됐고, `TRIGGER_RESPONSE_STRIP_COLUMNS`/
`NOTIFICATION_SIGNING_STRIP_KEYS` 의 JSDoc 은 각 대상 선언 바로 위에 붙어 있다). 남은
항목은 전부 여러 라운드에 걸쳐 이미 트리아지되고 "사소함/이월" 로 명시적으로 유예된
것들(지역 변수 `t`, DTO 배경 주석 4곳 반복)이거나, 이번에 새로 관측했지만 팀이 같은
라운드 안에서 이미 근거와 함께 보류를 결정한 것(`sanitizeForResponse` 책임 증가 — 추출은
검증 수단을 바꾸지 않으면서 diff 만 넓힌다는 판단)이다. CHANGELOG 의 빈 줄 2개 관례
이탈은 이번에 새로 발견한 순수 스타일 흠이며 병합을 막을 사안이 아니다. 전반적으로
네이밍은 명확하고(`TRIGGER_RESPONSE_STRIP_COLUMNS`, `contractForDto`,
`ScheduleTriggerRefDto` 등), 각 결정의 배경(왜 `select: false` 를 안 썼는지, 왜 서비스가
아니라 컨트롤러에서 좁히는지, 왜 세 개의 strip 목록이 필요한지)이 코드 인접 주석으로 잘
남아 있어 가독성이 높다.

## 위험도

LOW
