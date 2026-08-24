# 신규 식별자 충돌 검토 — `plan/in-progress/planner-doc-batch.md` (2회차, 커밋 후)

## 방법 노트

이번 호출도 프롬프트 번들이 target 이 직접 편집하는 9개 spec 파일 중 다수를 컨텍스트 예산
초과로 담지 못했다. 대신 `git diff origin/main` 으로 실제 커밋(`4af06d951`)의 diff 전문을
직접 열어 대조했다 — B1~B7 이 이미 적용된 **사후(2회차)** 상태를 검토한다. 관련 코드
(`node-output-allowlist.ts`, `websocket.service.ts`, `12-background.md` §8.5,
`redis-keys.md:84`)도 직접 읽었다.

## 발견사항

- **[WARNING]** B5 가 추가한 `background:run:{runId}` 가 **같은 문서 안의 형제 행**
  `background:run:{id}` 와 다른 플레이스홀더 이름을 쓴다
  - target 신규 식별자: `spec/5-system/6-websocket-protocol.md:128` (§3.2 채널 패턴 표,
    신규 행) — ``background:run:`{runId}` ``
  - 기존 사용처:
    - 같은 파일 `spec/5-system/6-websocket-protocol.md:155` (§3.3 인가 표, pre-existing) —
      ``background:run:`{id}` `` — **동일 채널**을 가리키는 형제 표의 기존 행
    - `spec/4-nodes/1-logic/12-background.md:274,278,333` (§8.5, 이 채널의 이벤트 SoT) —
      ``background:run:<backgroundRunId>`` / ``<id>``
    - `spec/conventions/redis-keys.md:84` — ``background:run:<id>``
    - `spec/data-flow/3-execution.md:144,230` — ``background:run:<id>``
    - 코드 전역(`websocket.gateway.ts`, `background-run-channel-authorizer.ts`,
      `use-background-run.ts` 등) — 필드명은 항상 `backgroundRunId`, 문서 표기는
      `<id>`/`<backgroundRunId>`
  - 상세: §3.2 의 다른 4행은 모두 §3.3 의 형제 행과 **글자 그대로 동일한** 플레이스홀더를
    쓴다 — `{executionId}`↔`{executionId}`, `{workflowId}`↔`{workflowId}`,
    `{documentId}`↔`{documentId}`, `{userId}`↔`{userId}`. B5 가 새로 넣은 행만
    `{runId}` 를 써서 이 1:1 대응이 깨진다. `{runId}` 는 이 문서를 포함해 spec 전체에서
    **이 한 곳에만** 나타나는 새 토큰이고(grep 결과 유일 출현), 같은 채널을 가리키는 기존
    표기가 이미 두 갈래(`{id}`·`<backgroundRunId>`)인데 세 번째 표기를 더한다. 값이
    달라서 생기는 CRITICAL 급 오해(다른 의미의 충돌)는 아니지만, 표 두 개를 나란히 읽는
    독자가 `{id}` 와 `{runId}` 를 **다른 파라미터**로 오인할 수 있다.
  - 참고: 직전 라운드(`13_30_49` naming INFO 4)가 이미 "B5 가 §3.2 를 택하면 그 문서
    컨벤션(`{id}`)을 따라야 다른 4행과 스타일이 맞는다" 고 짚었다. 실제 커밋은 curly-brace
    스타일 자체는 맞게 골랐지만(angle-bracket 을 섞지 않음), 토큰 이름을 `{id}` 대신
    `{runId}` 로 써 그 권고의 취지를 부분적으로만 반영했다 — target 문서 자신의 plan 본문
    (`plan/in-progress/planner-doc-batch.md:160`)도 "브래킷은 그 문서 컨벤션 `{id}`" 라고
    적어 두어, 실제 결과물이 **target 자신이 기록한 의도와도** 어긋난다.
  - 제안: `{runId}` → `{id}` 로 정정해 §3.3 의 형제 행과 문자 그대로 일치시킨다. 서술
    명확성이 필요하면 `{id}` 뒤에 "(= `backgroundRunId`)" 를 괄호로 덧붙이는 것으로 충분하고,
    별도 토큰을 만들 필요는 없다.

- **[INFO]** `wire 전용` 그룹 레이블의 짧은형(코드)·긴형(spec) 표기가 이미 공존 — target 은
  이를 새로 만들지 않고 기존 긴형을 정확히 재사용함
  - target 신규 식별자: 없음 — target(B1)은 `node-output.md` Principle 0 각주에
    `wire 전용 (위젯 파서)` / `wire 전용 (chat-channel 렌더러)` 를 그대로 썼다.
  - 기존 사용처: `codebase/backend/src/shared/utils/node-output-allowlist.ts:47-48,73,78`
    의 JSDoc 표/주석은 짧은형 `wire 전용 (위젯)` / `wire 전용 (chat-channel)` 을 쓰고(1곳
    prose 에서만 `"wire 전용 (chat-channel 렌더러)"` 인용), `spec/5-system/
    14-external-interaction-api.md:1828-1829` (pre-existing, `#1209`)는 긴형을 쓴다.
  - 상세: target 이 새로 만든 표기가 아니라 EIA §R17 에 이미 있던 긴형을 그대로 복제한
    것이라(plan 이 명시한 "세 번째 표현 금지" 원칙을 지켰다) 충돌이라 부르기는 어렵다.
    다만 target 덕분에 이 긴형이 이제 3곳(EIA·`node-output.md`·`6-websocket-protocol.md`)
    으로 늘었고, 원본 코드 주석은 여전히 짧은형이라 **spec 쪽 3곳과 code 쪽 1곳의 표기가
    서로 다른 상태**가 유지된다. target 의 책임 범위(spec 문서 정합)는 아니지만, 다음에
    이 allowlist 코드에 손을 대는 developer 가 어느 쪽이 SoT 인지 헷갈릴 수 있다.
  - 제안: 이번 target 의 조치는 불필요 — 정보 기록용. 후속으로 `node-output-allowlist.ts`
    JSDoc 표의 레이블을 긴형으로 맞추는 것을 별도 항목으로 등재할 수 있다(코드 변경이라
    developer 소관, 이번 순수 문서 PR 범위 밖).

## 요약

target 은 새 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·spec 파일 경로를 도입하지
않는 순수 문서 정합화 작업이고, 실제 커밋 diff 를 직접 대조한 결과 CRITICAL 급 "다른 의미의
동일 식별자" 충돌은 없다. 다만 B5 가 §3.2 에 추가한 신규 행이 **같은 문서의 형제 표**와
플레이스홀더 이름을 맞추지 못해(`{runId}` vs `{id}`) 정확히 이 배치 작업이 고치려던 종류의
"표기가 흩어져 혼동을 만든다" 결함을 새로 하나 만들었다 — B5 항목이 스스로 세웠던 목표(§3.2
"채널 패턴" 표의 누락을 메워 §3.3 과 정합시키는 것)를 토큰 이름 수준에서는 완전히 달성하지
못했다. 나머지 항목(B1·B3·B6·B7)은 기존 taxonomy·링크를 정확히 재사용해 새 식별자를 만들지
않았다.

## 위험도

LOW
