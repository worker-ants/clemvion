# 신규 식별자 충돌 검토 — `plan/in-progress/planner-doc-batch.md` (3회차)

## 방법 노트

프롬프트 번들이 target 이 편집하는 9개 spec 파일 대부분을 예산 초과로 담지 못해, `git diff
origin/main...HEAD` 로 실제 커밋된 diff 전문을 직접 열어 대조했다. 이전 두 라운드
(`13_30_49`, `16_41_05`)의 `naming_collision.md`/`RESOLUTION.md` 도 함께 읽어, 이미 지적·수정된
항목이 실제로 반영됐는지 재확인하는 방식으로 검토했다. 관련 코드
(`node-output-allowlist.ts`, `websocket.service.ts`, `12-background.md` §8.5,
`redis-keys.md:84`, `data-flow/3-execution.md`)도 grep 으로 직접 대조했다.

## 발견사항

- **[정보 — 이전 WARNING 해소 확인]** B5 신규 행의 플레이스홀더가 형제 표와 일치하도록 정정됨
  - target 신규 식별자: `spec/5-system/6-websocket-protocol.md:128` (§3.2, 신규 행) —
    `` background:run:`{id}` ``
  - 기존 사용처: 같은 파일 §3.3(line 155, pre-existing) — `` background:run:`{id}` ``
  - 상세: 직전 라운드(`16_41_05`)가 `{runId}` 라는 **3번째 표기**(§3.2/§3.3 두 표기
    `{id}`/`<backgroundRunId>` 에 더해)를 WARNING 으로 지적했었다. 현재 커밋은 `{id}` 로
    수정돼 같은 파일 §3.3 형제 행과 **글자 그대로 일치**한다 — 새 토큰을 만들지 않는다.
    수정이 정확히 반영됐음을 재확인.
  - 잔여 사항(신규 아님, target 책임 밖): `spec/4-nodes/1-logic/12-background.md:274,278,333`
    · `spec/conventions/redis-keys.md:84` · `spec/data-flow/3-execution.md:144,230` 는
    여전히 angle-bracket `<id>`/`<backgroundRunId>` 를 쓴다. 이 cross-document 표기 분기는
    이 diff 이전부터 있던 것이고(WS 문서 자체가 이미 `{...}` 컨벤션을 쓰고 있었음), B5 의
    선택(§3.2 에 행 추가, WS 문서 로컬 컨벤션 `{id}` 준수)은 그 상태를 악화시키지 않았다 —
    target 이 새로 만든 충돌이 아니므로 조치 불요.

- **[정보 — 이전 WARNING 해소 확인]** `wire 전용` 갈래 라벨 표현이 EIA §R17 과 정확히 일치
  - target 신규 식별자: `node-output.md:54-55` 의 `` `wire 전용 (위젯 파서)` `` /
    `` `wire 전용 (chat-channel 렌더러)` ``
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:1828-1829`(pre-existing,
    `#1209`) — 동일 문구. `codebase/backend/src/shared/utils/node-output-allowlist.ts:47-48`
    JSDoc 은 축약형(`wire 전용 (위젯)`/`(chat-channel)`).
  - 상세: target 은 EIA §R17 의 긴 형태를 그대로 재사용해 세 번째 표현을 만들지 않았다(plan
    이 스스로 세운 제약 준수). node-output.md 본문도 "코드 JSDoc 은 축약형이라 문자 그대로
    같지는 않다" 고 스스로 각주에 명시해, 코드-스펙 간 표기 차이를 숨기지 않고 드러냈다
    (`16_41_05` WARNING 3 지적을 반영한 정정). 키 배열 자체(8개)는 코드·스펙 3곳이 정확히
    일치하므로 기능적 충돌은 없다.

- **[INFO]** `nodeOutput.nodeType` carve-out 각주가 참조하는 `waitingNodeType` 은 기존
  확립된 wire 필드명과 충돌 없이 정확히 일치
  - target 신규 식별자: 없음 — `spec/5-system/6-websocket-protocol.md:530` 각주가
    `waitingNodeType` 을 인용
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:736-742`,
    `spec/5-system/6-websocket-protocol.md:451,1055-1065`,
    `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`,
    `codebase/backend/src/modules/execution-engine/{button-interaction,form-interaction,
    ai-turn-orchestrator}.service.ts` 등 전역에서 이미 확립된 필드명
  - 상세: 새 각주가 `waitingNodeType` 을 **재정의하지 않고 인용만** 한다. `16_41_05` WARNING 2
    (초판이 `payload.nodeType` 로 잘못 인용했던 것)가 정정된 상태를 재확인.

- **[INFO — target 책임 밖, pre-existing]** `spec/5-system/6-websocket-protocol.md` 에
  `### 4.4` 섹션 제목이 두 번 쓰인다 — line 447 "사용자 입력 대기 이벤트 상세", line 842
  "알림 이벤트 (Server → Client)"
  - `git show origin/main:...` 대조 결과 이 중복은 **이 diff 이전부터 존재**(line 446/815).
    target 은 그 사이(§4.4 사용자 입력 대기 이벤트 상세)에 새 blockquote 를 삽입했을 뿐,
    헤딩 자체는 만들지도 고치지도 않았다. `13_30_49` RESOLUTION INFO #6 이 이미
    "pre-existing, 이 PR 책임 아님. 후속 등재" 로 처분한 항목과 동일 — 재조치 불요, 기록만.

- **[검증 — 신규 식별자는 전부 기존 구현의 재인용]** `allowlistFanoutNodeOutput`
  (`egress-masking.md`), `NODE_OUTPUT_ALLOWED_KEYS` (`node-output.md`) 는 각각
  `codebase/backend/src/modules/websocket/websocket.service.ts:210` ·
  `codebase/backend/src/shared/utils/node-output-allowlist.ts:66` 에 **이미 구현돼 있는**
  이름을 spec 문서가 뒤늦게 인용하는 것이다. spec 이 처음 만드는 이름이 아니므로 "새 식별자가
  기존 사용처와 다른 의미로 충돌" 할 여지가 없다.

## 요약

target(`planner-doc-batch.md`)이 실제로 편집한 9개 spec 파일의 diff 전문을 직접 대조한 결과,
**새 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·환경변수·spec 파일 경로 중 어느 것도
새로 도입되지 않았다** — 전부 이미 구현된 코드(`#1209` 계열 `allowlistFanoutNodeOutput` /
`NODE_OUTPUT_ALLOWED_KEYS` / `waitingNodeType`)나 이미 존재하는 spec 표현(EIA §R17 의 `wire
전용` 라벨, WS §3.3 의 `background:run:{id}`)을 문서가 뒤늦게 인용·정합화하는 순수 문서
배선 작업이다. 직전 두 라운드(`13_30_49`, `16_41_05`)의 naming_collision 이 지적한 두 건
(`{runId}` 형제 행 불일치, `wire 전용` 라벨 정확성)은 이번 커밋에서 실제로 정정된 것을
확인했다. 남은 두 항목(cross-document `{id}`/`<id>` 표기 분기, `### 4.4` 헤딩 중복)은 모두 이
diff 이전부터 존재했고 target 의 책임 범위 밖으로 이미 별도 처분(현행 유지/후속 등재)돼
있어 재차단 사유가 아니다. CRITICAL 급 "동일 식별자·다른 의미" 충돌은 없다.

## 위험도

NONE
