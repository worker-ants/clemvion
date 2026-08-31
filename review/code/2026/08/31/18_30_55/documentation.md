# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `spec/5-system/6-websocket-protocol.md` 자체 절 재배치(§4.4 알림 이벤트→§4.5,
  §4.5 시스템 이벤트→§4.6, §4.6 외부 표면 매핑→§4.7)가 같은 문서 안의 **bare 텍스트 인용(마크다운
  링크가 아닌 `§4.X` 프로즈 언급)** 을 갱신하지 못한 곳이 최소 4곳 남아 있다. 이 PR 이 정확히
  이 결함 클래스(줄 번호/절 번호 인용 부패)를 고치던 중에 자기 자신의 절 이동에서 재발시킨 사례다.
  - 위치: `spec/5-system/6-websocket-protocol.md:28` — `` `auth.token_expired`/`system.maintenance` emit(§4.5) `` → 두 이벤트는 이제 §4.6(시스템 이벤트)에 있음. `§4.6` 이어야 함.
  - 위치: `spec/5-system/6-websocket-protocol.md:52` — `**서버발신 `auth.token_expired` 이벤트는 미구현 (Planned)** — §4.5 참조.` → `§4.6` 이어야 함.
  - 위치: `spec/5-system/6-websocket-protocol.md:156` — `` `notification.new` emit 은 `emitNotificationEvent` 로 구현됨 (§4.4) `` → 알림 이벤트는 §4.5 로 이동했으므로 `§4.5` 이어야 함.
  - 위치: `spec/5-system/6-websocket-protocol.md:1013` — `연결 레벨 에러는 §4.5 의 `error` 이벤트(`{ message }`)로만` → `error` 이벤트는 시스템 이벤트(§4.6)에 있으므로 `§4.6` 이어야 함.
  - 위치: `spec/5-system/6-websocket-protocol.md:1086` — `` (`notification.new` emit 은 이후 구현 완료 — §4.4.) `` → `§4.5` 이어야 함.
  - 상세: 이 PR 은 §4.3 KB 이벤트를 §4.4 앞으로 옮기며 뒤따르는 3개 절의 번호를 하나씩 밀었다.
    같은 diff 안에서 마크다운 링크 앵커(`#44-...`→`#45-...` 등)는 정확히 갱신됐고(직접 grep 으로
    잔존 구식 앵커 0건 확인), plan 문서(`spec-sync-external-interaction-api-gaps.md`)도 "WS 문서를
    가리키는 앵커 링크 96건 전수 대조" 를 검증 근거로 든다. 그런데 그 검증은 **마크다운 링크에
    한정**됐고, 링크가 없는 `(§4.X)` / `§4.X 참조` 형태의 **본문 프로즈 인용**은 대조 대상에서
    빠져, 정확히 이 PR 이 다른 파일(chat-channel 3곳)에서 고치려던 것과 같은 부패가 같은 PR 의
    산출물 안에서 재발했다.
  - 제안: 위 5곳(§4.5→§4.6 3곳, §4.4→§4.5 2곳)을 정정하고, 앵커 대조 스크립트를 마크다운 링크
    뿐 아니라 `§\d+(\.\d+)?` 패턴의 bare 프로즈 인용까지 포괄하도록 넓히거나(이 PR 이 신설한
    `spec-links 가드가 앵커를 검사하지 않는다` 백로그 항목에 이 축을 함께 등재), 최소한 이 5곳을
    이번 PR 범위에서 함께 정정할 것.

- **[WARNING]** 위 절 재배치의 파급이 이 PR 이 직접 수정한 `spec/data-flow/8-notifications.md`
  안에서도 한 곳 누락됐다 — 같은 문단 안에서 바로 위 문장은 갱신됐는데 다음 문장은 그대로다.
  - 위치: `spec/data-flow/8-notifications.md:192` — `이벤트 이름은 §4.4 기존 `notification.new` prefix 와 일관성을 유지한다.`
  - 상세: 바로 위 190행은 이 PR 에서 `§4.4`→`§4.5` 로 정확히 갱신됐다(diff 확인). 그런데 같은
    문단의 192행은 갱신되지 않고 구 번호 `§4.4` 를 그대로 인용한다 — 이 문서 안에서만도 같은
    절을 가리키는 4개 인용 중 3개는 `§4.5` 로 고쳐졌고 1개(192행)만 `§4.4` 로 남아 문서 내부
    자기모순이 생겼다.
  - 제안: `§4.4`→`§4.5` 로 정정.

- **[INFO]** 위 절 재배치의 파급이 diff 밖의 backend 코드 주석까지 stale 하게 만들었다 —
  이 PR 의 변경 파일 목록에는 없지만 이번 렌넘버링의 직접 결과다.
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:211` — `` * 권위 정의: spec/5-system/6-websocket-protocol.md §4.4 (`notification.new`). `` → `§4.5` 이어야 함.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:567` — `` * spec/data-flow/8-notifications.md §1·§2.2 + spec/5-system/6-websocket-protocol.md §4.4. `` → `§4.5` 이어야 함.
  - 상세: 두 주석 모두 `notification.new` 의 spec SoT 를 `§4.4` 로 인용하는데, 이 PR 로 그 절은
    `§4.5` 가 됐다. `WS §4.4` 패턴으로 grep 하면 이 두 곳 외에도 다수(주로 `execution.waiting_for_input`
    관련 — 이 절은 이동하지 않아 정확함)가 걸리므로, 이 두 파일만 실제로 잘못 짚혔음을 개별
    확인했다(직접 Read 로 대조).
  - 제안: 이 PR 범위는 아니지만, 절 재배치를 병합하기 전에 `grep -rn "§4\.[4-7]\b" spec/ codebase/`
    로 코드 주석까지 포함한 전수 재확인을 한 라운드 더 돌릴 것을 권한다 — 이 리뷰가 두 곳을
    잡았지만 전수 커버는 아니다.

## 긍정적으로 확인한 점

- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 신설 함수
  `_count_diff_files`/`_scope_delta_census` 는 근거(재발 이력·측정치)를 포함한 상세한 독스트링을
  갖추고 있고, `.claude/tests/test_consistency_scope_census.py` 도 모듈 상단에 왜 이 테스트가
  필요한지(공허 방지 축 포함)를 명확히 설명한다.
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.swagger.spec.ts` 는
  "왜 이 파일이 있나" 섹션을 갖춘 JSDoc 으로 회귀 방지 취지를 설명하고, 인용한 `swagger.md §2-4`
  문구(`'인증 실패 또는 토큰 만료'`)는 실제 spec 본문과 대조해 정확함을 확인했다.
- `workflow-assistant.controller.ts` 의 `@ApiUnauthorizedResponse` 신규 부착은 그 자체로 API
  문서(Swagger) 갭을 메우는 변경이며, 배치 순서(401 → 403)도 저장소 관례와 일치한다.
- `chat-channel.dispatcher.ts`/`chat-channel.dispatcher.spec.ts`/`types.ts` 의 하드코딩 줄 번호
  인용(`line 536`, `line 89`) 제거는 실측(정확한 앵커는 유지하고 썩는 줄 번호만 제거)에 근거해
  정확하게 수행됐다 — 세 파일 모두에서 `line \d+` 잔존 0건을 직접 grep 으로 확인했다.
- `plan/in-progress/node-output-redesign/README.md` 의 "줄 번호 인용을 심볼 서술로 교체" 갱신도
  같은 원칙(코드 인용에 줄 번호 대신 식별자 사용)을 일관되게 적용한다.

## 요약

이 PR 은 문서화 관점에서 전반적으로 모범적이다 — 신규 코드에는 근거가 실린 독스트링/JSDoc이
붙었고, 여러 곳에서 정확히 "하드코딩 줄 번호·절 번호 인용이 편집 후 조용히 썩는다" 는 문제를
실측 기반으로 고쳤다. 다만 그 고치는 작업의 핵심 축인 `spec/5-system/6-websocket-protocol.md`
절 재배치(§4.4~§4.6→§4.5~§4.7) 자체가 같은 결함 클래스를 최소 5곳(같은 파일 내부 4곳 +
`8-notifications.md` 1곳) 재생산했고, 파급이 diff 밖 backend 주석 2곳까지 번졌다. PR 이 자체
검증으로 내세운 "앵커 링크 96건 전수 대조" 는 마크다운 링크만 커버해 이 bare 텍스트 인용 부패를
잡지 못했다 — 검증 범위와 실제 위험 표면 사이의 간극이다.

## 위험도

MEDIUM
