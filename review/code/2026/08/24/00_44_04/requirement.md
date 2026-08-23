# 요구사항(Requirement) 충족 리뷰

## 검토 범위와 방법

`git diff origin/main..HEAD` 기준 실질 애플리케이션 코드 변경은 4개 TS 파일뿐이다
(`node-output-allowlist.ts`/`.spec.ts`, `websocket.service.ts`/`.spec.ts`,
`interaction.service.ts`(JSDoc 4줄)/`.spec.ts`(캐너리 1건 추가)). 나머지 diff 5,573줄
대부분은 `plan/**`·`review/code|consistency/2026/08/23-24/**` 의 과거 리뷰·컨시스턴시
라운드 산출물 커밋(이 저장소 워크플로가 항상 남기는 정본 기록)이며, 이번이 그 작업의
5번째(사실상 마무리) 리뷰 라운드다. 프롬프트가 잘라낸 `websocket.service.ts`/`.spec.ts`
전체 diff, `node-output-allowlist.ts` 전체 파일, `interaction.service.ts` 의
`allowlistNodeOutputKeys` 호출부, `spec/5-system/14-external-interaction-api.md` §R17·
`spec/5-system/6-websocket-protocol.md` §4.4·`spec/conventions/conversation-thread.md`
§8.4·`spec/5-system/15-chat-channel.md` §(c)·chat-channel 3개 렌더러(Discord/Telegram/
Slack) 실 코드는 `Read`/`Grep`으로 직접 열어 대조했다.

## 기능 요약 (실측 확인)

- `websocket.service.ts:182` 신설 `allowlistFanoutNodeOutput` — fanout envelope 의
  `nodeOutput`(top-level)과 `buttonConfig.nodeOutput`(중첩) 두 자리에 각각
  `allowlistNodeOutputKeys`를 걸고, `toFanoutEnvelope`(`:475`) 순서를
  `strip → allowlist → routing 첨부`로 배선했다. 두 emit 경로(`emitExecutionEvent`/
  `emitNodeEvent`)가 이 한 함수를 공유함을 `grep`으로 재확인 — "호출부 4곳이 실은
  chokepoint 하나" 주장은 실측과 일치한다.
- `node-output-allowlist.ts:66-96` `NODE_OUTPUT_ALLOWED_KEYS`가 9키→13키로 확장됐다
  (`payload`·`title`·`rendered`·`nodeType` 추가). 이 4키가 chat-channel 3개 렌더러에서
  실제로 top-level flat 로 읽힘을 코드로 확인함 (`discord-message.renderer.ts:163-192`,
  `telegram-message.renderer.ts:183-207,416`, `slack-message.renderer.ts:152-181`,
  `buttonConfig.nodeOutput?.nodeType` 도 discord/slack 렌더러에 존재). 대응 SoT
  (`spec/5-system/15-chat-channel.md:703` §(c))도 확인됨 — 4키를 넣지 않았다면 위
  렌더러들의 카드/제목/본문/타입 판별이 조용히 실패했을 것이라는 주장이 근거 있다.
- `allowlistNodeOutputKeys`(`node-output-allowlist.ts:125-141`)는 null/비객체/배열
  패스스루, `__proto__` 오염 방지(스프레드+own-property `delete`), copy-on-change(무변경
  시 동일 참조 반환)를 전부 구현하고 대응 테스트(`node-output-allowlist.spec.ts`)가
  각각을 캐너리로 고정한다.
- `websocket.service.spec.ts`에 추가된 신규 캐너리(top-level 제거, `buttonConfig` 중첩
  제거, `buttonConfig` copy-on-change 보존(M5, 이전 라운드 testing W2 반영), chat-channel
  4키 보존 `it.each`, 그리고 **의도적으로 안 닫은** `execution.node.*`의
  `envelope.output` 잔여 갭을 고정하는 `[잔여]` 캐너리)이 실제 구현과 1:1 대응한다.

## 발견사항

- **[INFO]** REST `getStatus`가 이번 PR로 SSE와 `NODE_OUTPUT_ALLOWED_KEYS`를 처음 공유하면서,
  chat-channel 전용으로 추가한 `payload`/`title`/`rendered`/`nodeType` 4키가 REST 응답
  표면에도 함께 열린다(부수 효과). 이는 이전 리뷰 라운드(`22_51_46` side_effect W1)에서
  이미 지적됐고, 같은 라운드 RESOLUTION에서 `interaction.service.spec.ts:733-763`에
  "[캐너리] chat-channel wire 4키는 REST `getStatus`에서도 통과한다(목록 단일화의 의도된
  결과)" 캐너리를 추가해 **의도임을 코드로 못박는 것**으로 처리했다. 실제로 그 테스트가
  `_retryState`는 여전히 떨어지고 4키만 통과함을 함께 단언한다 — 재확인 결과 이미 해소된
  항목이라 신규 발견으로 재기재하지 않는다.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:733-763`
  - 제안: 조치 불요 (이미 처리됨, 확인용 기재).

- **[INFO]** `execution.node.completed`/`.failed`의 `envelope.output`은 이번 PR이 의도적으로
  닫지 않은 잔여 표면이다. `execution-engine.service.ts:6109`(NODE_COMPLETED)와 `:6369`
  (NODE_FAILED)가 `output: nodeExecution.outputData`를 실어 JSDoc이 주장하는 "envelope.output
  경로로 `_retryState` 등 내부 필드가 계속 샌다"는 서술과 일치함을 실측 확인했다(같은 함수의
  다른 NODE_FAILED 호출 `:8010`은 `output` 필드 자체가 없어 이 갭과 무관 — `output` 필드를
  싣는 호출만 골라 세면 claim이 정확하다). 이 잔여는 `plan/in-progress/
  spec-sync-external-interaction-api-gaps.md:136`에 별도 항목으로 등재돼 있고,
  `websocket.service.spec.ts`의 `[잔여]` 캐너리(`envelope.output`의 `_retryState`가
  여전히 존재함을 단언)가 "닫히면 이 테스트가 의식적으로 뒤집혀야 한다"는 형태로 방향을
  고정한다 — 기능 누락이 아니라 실측 근거가 있는 **의도적 범위 제한**(같은 목록을 걸면
  버튼 재개 record가 `{}`가 된다는 실측)이다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` `[잔여] execution.node.* 의 envelope.output 은 아직 allowlist 를 지나지 않는다`
  - 제안: 조치 불요 — 후속 작업이 별도 tracker 항목으로 이미 잡혀 있다.

- **[INFO]** spec fidelity — `spec/5-system/14-external-interaction-api.md` §R17의 범위 표
  (`getStatus` waiting/terminal 3행 + SSE/fanout waiting 1행 + SSE/fanout `envelope.output`
  1행)와 `NODE_OUTPUT_ALLOWED_KEYS` 3그룹 JSDoc 표(핸들러 계약 공개분/wire 전용(위젯)/wire
  전용(chat-channel))가 코드 배열(`node-output-allowlist.ts:66-96`)의 순서·키 구성과
  1:1로 대응함을 라인 단위로 대조했다 — 불일치 없음. `spec/5-system/6-websocket-protocol.md`
  §4.4 blockquote의 "`nodeOutput` 키 집합은 공유하지 않는다" 단서, `spec/conventions/
  conversation-thread.md:388-392`의 자기-반증형 소정정 블록도 실제 구현(§R17 표·
  `toFanoutEnvelope` 배선)과 일치한다. 저장소 전역에 대해 `SSE.*잔여|잔여.*SSE|fanout.*잔여`
  패턴으로 재스윕한 결과, 취소선 처리 안 된 잔존 서술은 없음을 확인했다(이전 라운드
  `00_16_59`가 조사 한 글자 차이로 놓쳤던 6번째 미러가 이번 diff에서 이미 정정돼 있다).
  - 위치: `spec/5-system/14-external-interaction-api.md:1747-1751`,
    `codebase/backend/src/shared/utils/node-output-allowlist.ts:44-93`
  - 제안: 조치 불요 (양호, 확인용 기재).

- **[INFO]** TODO/FIXME/HACK/XXX 계열 미완성 주석 없음(diff 전수 grep 0건). 반환값 경로
  — `allowlistNodeOutputKeys`는 모든 입력 형태(null/원시값/배열/일반 객체)에서 명시적 값을
  반환하며 암묵적 `undefined` 경로가 없다. `allowlistFanoutNodeOutput`도 모든 조건 분기에서
  `next`를 반환한다(early return 없음, 항상 마지막 `return next`).

## 요약

핵심 로직 변경(4개 TS 파일 + 대응 spec.ts)은 REST `getStatus`와 SSE/fanout의 `nodeOutput`
방어 강도를 동일 chokepoint(`toFanoutEnvelope`)·동일 allowlist(`NODE_OUTPUT_ALLOWED_KEYS`)로
통일한다는 의도를 정확히 구현한다. null/배열/비객체 패스스루, `__proto__` 오염 방지,
copy-on-change(top-level과 `buttonConfig` 중첩 양쪽 모두)까지 엣지 케이스가 캐너리로
빠짐없이 고정돼 있고, chat-channel 4키 확장이 실제 렌더러 코드·spec §(c)와 라인 단위로
일치함을 직접 대조했다. 함수 시그니처·반환 타입 변경 없음, TODO 없음, 모든 경로에서 적절한
값을 반환한다. 유일하게 남는 것은 `execution.node.*`의 `envelope.output`이라는 **의도적**
잔여 갭인데, shape 불일치(버튼 재개 record에 같은 목록을 걸면 `{}`가 된다는 실측)로 인해
이번 라운드에서 닫지 않기로 한 판단이 근거·트래커·캐너리 삼중으로 뒷받침된다. spec
(`14-external-interaction-api.md` §R17, `6-websocket-protocol.md` §4.4,
`conversation-thread.md` §8.4)과 코드가 라인 단위로 정합하며, `SSE·fanout 이 잔여다`류의
이제는 거짓이 된 서술이 저장소 전역에 남아있지 않음을 재스윕으로 확인했다. CRITICAL/WARNING
급 요구사항 미충족은 발견되지 않았다.

## 위험도
NONE
