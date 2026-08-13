# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-redis-key-registry.md`

## 검토 방법

프롬프트 번들에서 `4-execution-engine.md`·`6-websocket-protocol.md`·`14-external-interaction-api.md`·
`data-flow/3-execution.md`·`data-flow/15-external-interaction.md` 등 target 이 직접 수정하는
핵심 문서 5개가 "컨텍스트 예산 초과"로 절단되어 있었다. 해당 문서는 저장소에서 직접 읽고,
target 이 새로 도입하는 각 식별자(문서 id·파일 경로·도메인 접두·리터럴 키)를
`spec/`, `codebase/` 전체에서 grep 대조했다.

## 발견사항

### [INFO] 신규 문서 id/경로 `redis-keys` — 충돌 없음
- target 신규 식별자: frontmatter `id: redis-keys`, 파일 경로 `spec/conventions/redis-keys.md`
- 기존 사용처: 없음 — `spec/` 전체에서 `^id: redis` 매치 0건, `redis-keys` 문자열이 등장하는 파일은
  target 문서 자신(`plan/in-progress/spec-draft-redis-key-registry.md`) 뿐이다.
- 상세: `spec/conventions/*.md` 18개 기존 문서 id 와 겹치지 않고, 명명 스타일(`error-codes.md`·
  `node-output.md`·`migrations.md` 등 kebab-case 명사(구))과도 정합한다.
- 제안: 없음 — 그대로 진행 가능.

### [INFO] 도메인 접두(`exec`/`eia`/`iext`/`interaction`/`cc`/`wh`/`cafe24`/`integration`) — 코드에 이미 실재, 새 의미 충돌 없음
- target 신규 식별자: Redis 키 도메인 접두 8종을 규약 문서의 공식 어휘로 formalize
- 기존 사용처: 각 접두는 이미 코드/spec 에 실제 Redis 키로 존재한다 —
  `iext:blacklist:<jti>`/`interaction:idempotency:...` (`spec/data-flow/15-external-interaction.md:257-258`,
  `spec/5-system/14-external-interaction-api.md:1061`), `cc:rl:{triggerId}:{conversationKey}`
  (`spec/data-flow/14-chat-channel.md:91`), `cafe24:install:fail:{ip}`/`cafe24:install:nonce:...`
  (`spec/4-nodes/4-integration/4-cafe24.md:559,564,577`, `spec/2-navigation/4-integration.md:1291-1292`),
  `integration:cache:invalidate` (`spec/5-system/4-execution-engine.md:1173-1179`).
- 상세: target 은 이 접두들을 **새로 발명하지 않고** 기존 실재 키를 그대로 인벤토리화한다. 각 접두가
  가리키는 모듈 의미도 실제 소유 모듈과 일치해 다른 의미로 쓰이는 곳이 없다.
- 제안: 없음. 다만 target 자신이 이미 각주로 명시한 `iext`/`interaction`/`eia` 3접두 병존(같은
  external-interaction 모듈이 세 접두를 씀)은 **새 충돌이 아니라 기존 사실의 정직한 기록**이므로
  이 관점에서는 문제 삼지 않는다.

### [INFO] `background:run:<id>` / `execution:<id>` / `workflow:<id>` — WS 채널과의 경계, target 초안이 이미 자체 교정
- target 신규 식별자: 없음(target 은 오히려 이 항목들을 Redis 키 인벤토리에서 **제외**하고 별도
  "인접 네임스페이스 각주"로 분리하는 조치)
- 기존 사용처: `spec/5-system/6-websocket-protocol.md:147-150` — Socket.IO room 채널명
  (`execution:{executionId}`·`workflow:{workflowId}`·`background:run:{id}`). Redis 키 도메인 접두는
  `exec`(짧은 형태)로 실제 Redis 키(`exec:seq:<executionId>` 등, `4-execution-engine.md:1169`)와
  구별되므로, WS 채널명 `execution:...`/`workflow:...`와 Redis 키 도메인 `exec:...`가 문자열
  레벨에서 접두 충돌을 일으키지 않는다.
- 상세: target 의 "실측" 섹션이 이미 `02_01_16` 라운드에서 지적된 오분류(WS 채널을 Redis 키로
  잘못 등재)를 직접 반증·수정했고, 재발 방지를 위해 인접 네임스페이스 각주를 신설 항목으로
  체크리스트에 넣었다. 이번 검토에서 실측한 WS 채널 표(`6-websocket-protocol.md:147-150`)와
  target 의 서술이 정확히 일치한다.
- 제안: 없음 — 이미 target 이 자체 교정 완료.

### [INFO] `14-external-interaction-api.md` §8.4 — 리터럴 키 추가 위치 확인
- target 신규 식별자: 없음(§8.4 는 이미 존재하는 "Rate Limit" 섹션이며, `eia:rl:interact:<executionId>`
  등은 코드에 이미 실재하는 키를 리터럴로 **처음 문서화**하는 것)
- 기존 사용처: `spec/5-system/14-external-interaction-api.md:778-791` — §8.4 는 이미 inbound/SSE/
  outbound rate-limit 한도표를 다루는 절이며, Redis 키 리터럴이 아직 없다(각주 W1 이 정확히
  이 공백을 지적).
- 상세: 섹션 성격(요구사항/한도 정의)과 추가하려는 내용(Redis 키 리터럴)이 자연스럽게 부합해
  다른 의미로 오염될 위험이 없다.
- 제안: 없음.

### [INFO] 프로즈 상 `cafe24:카페24` — 다른 네임스페이스의 우연한 문자열 겹침, 실질 충돌 아님
- target 신규 식별자: 없음(target 이 건드리지 않는 파일)
- 기존 사용처: `spec/conventions/cafe24-api-catalog/order/orders.md:142,1272` — `order_place_id` enum
  값 설명 프로즈에 `cafe24:카페24 · mobile:모바일웹 …` 형태로 콜론이 등장한다.
- 상세: 이것은 Cafe24 오픈API 필드 값-라벨 매핑을 한글 문서에서 콜론으로 구분한 것일 뿐, Redis
  키 네임스페이스와 아무 관련이 없다. target 이 도입하는 `cafe24:` Redis 도메인 접두와 형태만
  같을 뿐 완전히 다른 문서·문맥·독자층(카페24 API 카탈로그 vs Redis 키 레지스트리)이라 혼동
  가능성이 낮다. 향후 checker 가 단순 `cafe24:` 문자열 grep 만으로 오탐하지 않도록 기록해 둔다.
- 제안: 대응 불요.

## 요약

target(`spec-draft-redis-key-registry.md`)이 신설하는 문서 id(`redis-keys`)·파일 경로
(`spec/conventions/redis-keys.md`)는 기존 spec 어디에도 사용된 적이 없어 충돌이 없다. 문서가
formalize 하는 Redis 키 도메인 접두 8종(`exec`/`eia`/`iext`/`interaction`/`cc`/`wh`/`cafe24`/
`integration`)은 전부 코드에 이미 실재하는 키를 그대로 인벤토리화한 것이며, 각 접두가 가리키는
모듈 의미도 실제 소유와 일치해 다른 의미로 쓰이는 자리가 없었다. 오히려 이 target 은 직전
consistency 라운드(`02_01_16`)에서 지적된 실질 식별자 오분류(WS 채널 `background:run:<id>`를
Redis 키로 잘못 등재)를 스스로 반증·교정하고 "인접 네임스페이스 각주"라는 재발 방지 장치까지
신설 범위에 포함시켰다. §8.4 rate-limit 리터럴 추가, data-flow/15 §2.2 역참조 추가 등 나머지
변경도 기존 섹션 성격과 부합해 새 의미 충돌을 만들지 않는다. 신규 식별자 충돌 관점에서는
CRITICAL/WARNING 없음.

## 위험도

NONE
