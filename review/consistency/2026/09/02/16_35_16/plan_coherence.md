# Plan 정합성 검토 — `spec-draft-ws-socket-lifetime-binds-token.md`

## 검토 방법
target 이 참조하는 세 plan 문서(`spec-sync-websocket-protocol-gaps.md` 트래커, 형제 draft
`spec-draft-ws-wontdo-maintenance-appping.md`, `spec-sync-external-interaction-api-gaps.md`)를
번들과 실제 저장소 양쪽에서 대조했다. 특히 target 이 "결정 완료" 로 되돌려 쓰겠다고 선언한
4곳(`6-websocket-protocol.md:52·871·1090·1123`, 트래커 `:23·87`)을 `git log`/`grep` 으로
직접 열어 **현재 실제 상태**와 대조했고, `plan/in-progress/**` 전체를 `token_expired`·
`websocket`·`disconnect`·`reconnect` 키워드로 훑어 다른 진행 중 작업과의 숨은 의존을 찾았다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** frontmatter `pending_plans:` 명시 갱신 여부가 변경안 표에 없음
  - target 위치: `## 변경안` 표의 `— | 〃 frontmatter | 변경 없음 — status: partial 유지` 행
  - 관련 plan: `spec/5-system/6-websocket-protocol.md` frontmatter `pending_plans: [plan/in-progress/spec-sync-websocket-protocol-gaps.md]`
  - 상세: target 은 frontmatter 변경 없음의 근거로 `status: partial` 유지만 명시한다. 형제 draft
    (`spec-draft-ws-wontdo-maintenance-appping.md` 항목 9)는 같은 판단을 하면서 `status: partial`
    과 `pending_plans` 유지를 **둘 다** 명시했다. target 의 결론(트래커가 여전히 열린 구현 항목을
    갖고 있으므로 `pending_plans` 도 그대로)은 실제로 맞고 충돌은 없지만, 표에서 `pending_plans`
    를 누락한 것은 형제 draft 대비 기술 방식이 한 칸 좁다.
  - 제안: target 의 frontmatter 행에 `pending_plans` 도 "변경 없음" 으로 명시해 두면 spec 적용
    시점에 이 필드를 실수로 건드리지 않는다는 근거가 문서 자체에 남는다.

## 확인한 정합성 (문제 없음, 참고용)

- **미해결 결정과의 충돌 없음**: 트래커(`spec-sync-websocket-protocol-gaps.md:23-52`)가 명시한
  유일한 미결 항목은 정확히 target 이 답하는 두 축 — ⓐ 소켓 수명의 토큰 수명 종속 여부, ⓑ 사전
  통지 lead time 여부 — 이다. target 의 결정(둘 다 yes, 60초)은 이 미결 항목을 **정확히 겨냥해
  닫는 것**이지 다른 미결 항목을 우회하는 것이 아니다.
- **선행 plan 은 이미 해소됨**: target 은 `R-wontdo-maintenance-appping` Rationale(스펙 `:1109-1123`)
  과 그 안의 "범위 밖(잔여 유지)" 문단(`:1123`)이 이미 spec 에 존재한다고 전제하는데, 실제로 이
  형제 draft 의 spec 변경은 커밋 `db21d0c9d`(현재 이 브랜치의 HEAD)로 **이미 적용**돼 있다.
  `grep -n "R-wontdo-maintenance-appping" spec/5-system/6-websocket-protocol.md` 로 라인
  28·872·945·1086·1088-1089·1109·1123 전부 실측 확인했고, target 표의 라인 참조(`:52`·`:871`·
  `:1090`·`:1123`)도 현재 파일과 정확히 일치한다. 즉 target 이 선행조건으로 삼는 상태는 가정이
  아니라 이미 저장소에 반영된 사실이다.
- **payload 하위호환 주장 실측 확인**: target 은 "`auth.token_expired` 는 미구현이라 wire 호환
  부담이 없다"고 주장한다. `grep -rn "auth.token_expired|token_expired" codebase/frontend/src
  codebase/backend/src` 로 확인한 결과 실제 코드의 `token_expired` 매치는 전부 통합(cafe24/makeshop
  등) 토큰 만료 사유 필드(`integration-status-reason.ts` 등)이고 WS `auth.token_expired` 와는
  **별개 네임스페이스**다 — target 이 `spec/1-data-model.md:300` 판정에서 스스로 적은 근거와
  일치한다. WS 쪽 emit·소비 코드는 0건으로 확인, 주장은 참이다.
- **`spec-sync-external-interaction-api-gaps.md:343` "변경 없음" 판정 검증**: 번들에서는 이 파일이
  예산 초과로 생략됐으므로 실제 파일을 직접 열어 `:343` 주변을 확인했다. 해당 문단은 §4.x 절
  번호 이동(2026-08-31) 이력을 기록하며 `auth.token_expired`/`system.maintenance` 를 "가리키는
  시스템 이벤트" 로 언급할 뿐이고, 인용 형태·상태 주장이 아니라 절 번호 이동의 동반 정정 목록일
  뿐이다. target 의 "변경 없음" 판정은 정확하다.
- **후속 항목 스캔**: `plan/in-progress/**` 전체를 `websocket|gateway|handleDisconnect|
  handleConnection` 및 `reconnect|재연결|token_expired|소켓 수명` 으로 훑었다. 매치된 나머지
  파일(discord/slack 채널 게이트웨이, webchat SSE/`EventSource` 재연결, EIA `interaction.expiresAt`
  등)은 모두 다른 전송 계층·다른 인증 모델을 다루며 target 의 WS `/ws` JWT 소켓 수명 결정과
  겹치지 않는다. target 변경으로 무효화되거나 새로 만들어야 할 후속 항목은 발견되지 않았다.
- **트래커 체크박스 상태 정합**: target 은 트래커 `:23` 항목의 텍스트만 "결정 완료, 구현 대기"로
  바꾸고 체크박스는 `[ ]` 로 남긴다(구현은 target 범위 밖, developer 트랙). `spec` frontmatter
  `status: partial` 유지 판단과 함께 "체크박스 = 실제 상태" 규약에 부합한다.

## 요약
target 은 `spec-sync-websocket-protocol-gaps.md` 트래커가 명시한 유일한 미해결 결정(ⓐ 소켓
수명-토큰 수명 종속, ⓑ lead time)을 정확히 겨냥해 답하며, 형제 draft(`R-wontdo-maintenance-appping`)
가 이미 spec 에 적용해 둔 "범위 밖(잔여 유지)" 포인터 위에 올바르게 이어 붙인다. 라인 참조 4곳
(`:52·871·1090·1123`)과 트래커 참조 2곳(`:23·87`) 전부 현재 저장소 상태와 실측 일치했고, payload
하위호환·별개 네임스페이스 주장도 코드 grep 으로 재확인됐다. `plan/in-progress/**` 전역 스캔에서
target 변경이 무효화하거나 새로 만들어야 할 다른 plan 의 후속 항목은 찾지 못했다. 유일한 지적은
frontmatter 변경 표에서 `pending_plans` 를 명시적으로 언급하지 않은 완결성 차원의 INFO 뿐이다.

## 위험도
NONE
