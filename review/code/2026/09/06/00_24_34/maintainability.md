# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** "이미 응답에 실려 나가고 있었다" 배경 설명 주석 블록(6줄)이 4개 DTO 파일에
  글자 그대로 동일하게 반복된다.
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:55-61`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:118-124`,
    `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:93-99`,
    `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:98-104`(주석
    시작 지점은 각 파일 기준)
  - 상세: "§5.4 응답-계약 스윕이 '선언되지 않은 키'로 검출했고, 프런트엔드가 실제로
    소비하므로 빼면 계약 회귀다… `@ApiPropertyOptional` 은 `required: false` 의 별칭이라
    상시 존재 필드에 쓰면 '상시 존재' 와 모순된다" 로 시작하는 동일한 6줄이 네 파일에
    복붙돼 있다. 각 파일이 뒤에 그 DTO 고유의 추가 설명(`appUrl` 의 makeshop 갈래 등)을
    붙이는 형태라 완전한 중복은 아니고, 공통 배경 지식을 반복해 두는 것이 §5.4 를 처음
    보는 리뷰어에게는 오히려 도움이 될 수 있다. 다만 §5.4 규약 자체(선언 vs `@ApiProperty`
    선택 기준)가 바뀌면 네 곳을 모두 손으로 동기화해야 하는 잔여 위험이 남는다.
  - 제안: 급하지 않음. 이런 배경 설명이 다섯 번째 파일에도 또 복붙되기 시작하면, 규약
    본문(`spec/conventions/` 또는 `swagger.md §5.4`)으로 옮기고 각 DTO 주석은 그 문서를
    가리키는 한 줄로 축약하는 편을 검토.

- **[INFO]** `SchedulesController.create`/`update` unit 테스트의 트리거-좁힘 단언 블록이
  두 테스트에 글자 그대로 반복된다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.spec.ts:72-79`,
    `92-99`
  - 상세: `expect(Object.keys(res.trigger).sort()).toEqual(['id','name','workflowId'])` +
    `not.toHaveProperty('notificationSecretV2')` + `not.toHaveProperty('chatChannelTokenV2')`
    3줄 조합이 `create`/`update` 두 테스트에 동일하게 나온다. 직전 라운드
    (`review/code/2026/09/06/00_00_23` INFO#3)에서 이미 지적됐고 "급하지 않음, 다음에
    손댈 때" 로 명시적으로 유예된 항목이라 재발이 아니라 **여전히 유효한 관찰**이다 —
    지금 상태 그대로 남아 있음을 확인했다. `remove` 등 세 번째 소비 경로가 생기면 세 번째
    복사가 생길 자리.
  - 제안: 조치 불요(기존 유예 유지). `expectNarrowedScheduleTrigger(res.trigger)` 같은
    작은 헬퍼로 추출할 수 있는 자리라는 점만 남겨 둔다.

- **[INFO]** 조인된 자식 엔티티를 응답 경계에서 좁히는 책임 계층이 모듈마다 다르다 —
  `TriggersService.sanitizeForResponse`(서비스 계층, `triggers.service.ts:691`)와
  `SchedulesController.toResponse`(컨트롤러 계층,
  `codebase/backend/src/modules/schedules/schedules.controller.ts:67`).
  - 상세: 직전 라운드(`review/code/2026/09/06/00_00_23` INFO#2)가 이미 지적하고 "각자
    근거 문서화됨, 유예 유지" 로 처분한 항목으로, 현재도 같은 상태다. 두 곳 모두 왜 그
    계층에서 좁히는지 JSDoc 에 합리적 근거를 남겨 뒀으므로 버그는 아니다.
  - 제안: 조치 불요. 세 번째 유사 사례가 생기면 그때 컨벤션을 명문화할 것을 권고
    (기존 제안과 동일).

## 확인: 직전 라운드 WARNING 2건이 이번 커밋에서 실제로 해소됨

- `sanitizeForResponse` 78줄 단일 메서드(`review/code/2026/09/06/00_00_23` W2, 이전
  라운드 위치 627-705)가 `stripChatChannelSecrets`(142) · `stripInteractionSecrets`(152) ·
  `stripNotificationSigningSecrets`(162) · `deleteSecretColumns`(180) ·
  `narrowWorkflowRef`(190) 다섯 모듈-레벨 순수 함수로 분해됐고, 메서드 본체(691-748)는
  얇은 오케스트레이터로 축소됐다. 중첩도 종전 3단(`if(cfg){if(cfg.chatChannel){...}}`)에서
  `if(cfg){...}` 안에 순차 2단 이하로 낮아졌다 — `triggers.service.ts` 를 직접 읽어
  확인했다.
- `triggers.service.spec.ts` 의 "응답 정화 회귀" JSDoc(직전 라운드 W3, 당시 191-197행이
  208행 테스트 위에 잘못 붙어 있었음)이 현재는 227행에서 233행
  `it('응답에서 회전 secret 컬럼과 notification.signing 비밀이 제거된다', ...)` 바로 위에
  정확히 위치한다 — 대상과 분리된 상태가 해소됨.

둘 다 새로 지적할 결함이 아니라 검증 결과라 위 "발견사항"에는 넣지 않았다.

## 요약

이번 라운드가 대상으로 하는 마지막 커밋(`e018a176f`)은 직전 코드 리뷰가 지적한
`sanitizeForResponse` 의 5-책임 단일 메서드와 JSDoc-대상 분리를 실제로 해소했다 — 다섯
축을 이름 있는 순수 함수로 갈라 오케스트레이터를 얇게 만들었고, 그 리팩터 검증 과정에서
`chatChannel` 축의 unit 커버리지 사각지대까지 추가로 메웠다(뮤테이션 5/5 RED 확인).
`IntegrationDto.appUrl` 설명이 MakeShop 갈래를 빠뜨렸던 것도 정정됐다. 남은 항목은 전부
이전 라운드에서 이미 관찰·유예된 저위험 사안(4개 DTO 파일의 반복된 배경 설명 주석, 컨트롤러
unit 테스트의 3줄 단언 중복, 트리거/스케줄 간 좁히기 책임 계층 불일치)이며 근거가 문서화돼
있고 급하지 않다. 전체적으로 이 스윕은 각 수정마다 "왜 이 형태인가·왜 이전엔 안 잡혔는가"를
상세히 남기는 습관이 일관되고, 반복 성장 이력이 있던 핵심 로직도 이번 라운드에 실제로
분해됐다는 점에서 유지보수성 측면의 위험은 낮다.

## 위험도
LOW
