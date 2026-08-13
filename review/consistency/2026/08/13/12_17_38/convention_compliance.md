# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 검토 범위 확정

`_prompts/convention_compliance.md` 는 734KB 로 컨텍스트 예산 초과 절단이 많아(swagger.md·error-codes.md·node-output.md 등 다수 conventions 본문이 "의도된 절단"으로 생략됨), 프롬프트 대신 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)를 절대경로로 직접 열람해 실제 diff 를 확인했다.

`git diff origin/main...HEAD --stat` 기준 실제 변경은 문서뿐이다 (코드 변경 없음):

```
plan/.../backend-lint-gate-broken-on-main.md   | 42 +++++++++++++++++++---
spec/4-nodes/4-integration/4-cafe24.md          |  5 +++
spec/4-nodes/7-trigger/providers/discord.md     |  2 +-
spec/4-nodes/7-trigger/providers/slack.md       |  6 +++-
spec/5-system/12-webhook.md                     | 11 ++++++
spec/conventions/redis-keys.md                  |  5 +--
spec/data-flow/14-chat-channel.md               |  4 +++
```

target 은 `spec/5-system/`(주로 `12-webhook.md`)이고, 커밋 목적은 `spec/conventions/redis-keys.md` §3 인벤토리가 가리키는 "상세 SoT" 절이 실제로 존재하지 않던 두 곳(chat-channel, cafe24)을 채우고 포인터를 바로잡는 것 — 그 김에 `wh:rl:*` 키도 처음으로 `12-webhook.md` 본문에 명문화했다. 코드/DTO/컨트롤러 변경이 없어 "API 문서 규약(Swagger 데코레이터)" 관점은 이번 diff 에 해당 사항 없음.

## 발견사항

- **[WARNING] `chat-channel:` / `chat-channel-lock:` 키가 redis-keys.md §1 형태 규칙을 벗어나는데, 이번에 처음 인벤토리에 등재되면서도 그 사실이 각주로 남지 않았다**
  - target 위치: `spec/conventions/redis-keys.md` §3 전역 인벤토리 표, `chat-channel` 행 (신규 추가된 `| \`chat-channel:<triggerId>:<conversationKey>\` · \`chat-channel-lock:<triggerId>:<conversationKey>:formsubmit\` | ... |` 행)
  - 위반 규약: `spec/conventions/redis-keys.md` §1 "키 형태 — 머리 2세그먼트 고정 + 꼬리 가변" (`{도메인}:{용도}[:{식별자}...]`)
  - 상세: 같은 표의 `cc:rl:<triggerId>:<conversationKey>` · `cc:dedup:<triggerId>:<idempotencyKey>` (동일 모듈 `modules/chat-channel` 소유)는 도메인(`cc`)+용도(`rl`/`dedup`)+식별자 구조를 정확히 따른다. 반면 이번에 새로 등재된 `chat-channel:<triggerId>:<conversationKey>` 는 도메인 뒤에 바로 식별자가 오고 "용도" 세그먼트가 없으며, `chat-channel-lock:<triggerId>:<conversationKey>:formsubmit` 는 도메인+용도를 하이픈으로 융합(`chat-channel-lock`)하고 "용도"에 해당하는 `formsubmit` 을 식별자 뒤 맨 꼬리로 보낸 도치 형태다(코드 근거: `codebase/backend/src/modules/chat-channel/channel-conversation.service.ts:179,183`). 같은 모듈이 `chat-channel:`/`chat-channel-lock:` 와 `cc:` 두 개의 서로 다른(공통 어간도 없는) 접두 체계를 동시에 쓰는 셈인데, §3 표 바로 아래에는 `external-interaction` 이 `iext:`/`interaction:`/`eia:` 세 접두를 쓰는 것에 대해서만 "한 모듈이 접두 셋을 쓴다… 다만 넷째가 생기지 않도록 사실을 남긴다" 는 명시적 각주가 있고, 이번에 새로 노출된 chat-channel 의 이중 접두·형태 이탈에는 그런 각주가 없다. 규약이 "통일을 강제하지 않는다"고 명시하므로 CRITICAL 은 아니지만, 이번 diff 가 이 사실을 처음 표면화한 시점이라 각주를 남길 좋은 기회였다.
  - 제안: redis-keys.md §3 표 아래 각주에 `chat-channel` 도 추가해 "다섯째 접두가 생기지 않도록" 사실을 남기거나, 이 키들이 §1 형태 규칙의 예외임을 명시. 규약을 갱신하는 쪽(사실을 있는 그대로 기록)이 실제 배포된 키를 리네이밍하는 것보다 이 문서의 기존 철학("지켜진 적 없는 규칙은 규칙이 아니라 오해의 원천")과 더 합치한다.

- **[WARNING] redis-keys.md §3 인벤토리가 "상세 SoT" 로 새로 지정한 `4-cafe24.md §9.8` 이 CLAUDE.md 의 Overview/본문/Rationale 3섹션 구조상 "Rationale" 섹션 안에 있다**
  - target 위치: `spec/conventions/redis-keys.md` §3, `cafe24:install:*` 행의 링크가 `4-nodes/4-integration/4-cafe24.md#98-private-앱-app-url-hmac-검증` 로 변경됨 (이전엔 `2-navigation/4-integration.md` 전체를 가리켜 실제로 해당 절이 없는 죽은 포인터였음)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거" → 해당 spec 문서 끝의 `## Rationale`, "기술 명세" → 본문. redis-keys.md 자신도 "각 소유 문서가 SoT… 상세는 소유 문서에" 라고 요구한다.
  - 상세: `4-cafe24.md`의 `## 9. Rationale` 은 9.1~9.9 하위 절 전체가 "왜 이렇게 결정했나" 서술과 "HMAC 알고리즘 단계·키 조합·TTL" 같은 순수 기술 명세를 뒤섞어 담고 있다(예: §9.8 은 HMAC 검증 알고리즘 자체, nonce 키 포맷 `cafe24:install:nonce:{mall_id}:{timestamp}:{hmac 앞 8자}` 를 정의). 이번 diff 는 이 절을 Redis 키 "상세 SoT" 로 공식 지정해, 다른 문서(redis-keys.md)가 정상 참조 대상으로 명시적으로 가리키게 만들었다 — 즉 "Rationale = 배경/근거"라는 CLAUDE.md 관례를 이 파일에서는 사실상 "본문" 대용으로 쓰는 기존 패턴을 강화한다. 이 자체는 이번 diff 가 새로 만든 문제는 아니고(§9.1~9.9 전체가 이미 오래된 구조), diff 는 죽은 포인터를 살리는 과정에서 그 구조를 처음으로 규약 문서의 공식 참조 대상으로 승격시켰을 뿐이다.
  - 제안: 두 갈래 중 택일 — (a) `4-cafe24.md` 의 §9.8 같은 순수 기술 명세(알고리즘/키 포맷/TTL)를 별도 본문 절(예: `## 8.x 보안` 계열)로 옮기고 Rationale 에는 "왜" 서술만 남긴다, 또는 (b) 이 파일이 이미 오래전부터 Rationale 을 "설계 결정 노트"(배경+상세를 함께 담는) 용도로 써 왔음을 인지하고 CLAUDE.md/SKILL.md 문서구조 규약에 그 예외를 명문화한다. 지금처럼 규약은 "Rationale=배경" 이라 말하고 실제로는 다른 문서가 "Rationale=SoT" 로 참조하는 상태가 계속되면 3섹션 구조를 신뢰하는 다른 tooling(자동 요약·consistency-checker 프롬프트 조립 등)이 오판할 수 있다.

- **[INFO] 신규 blockquote 줄에서 `>` 뒤 공백 누락**
  - target 위치: `spec/5-system/12-webhook.md:350` (`>들어가 **단일 공유 버킷**으로 묶인다 — …`)
  - 위반 규약: 명시적 conventions 문서 규칙은 아니며, 같은 문서·같은 신규 블록의 앞뒤 줄(348, 351)은 `> ` 로 정상 포맷된 순수 형식 일관성 이슈.
  - 상세: CommonMark/GitHub 렌더러는 lazy continuation 으로 대체로 같은 blockquote 로 붙여 보여주므로 실제 렌더링 파손 가능성은 낮지만, 소스 그대로 diff/grep 하면 세 줄 중 한 줄만 `>` 뒤 공백이 빠져 있어 눈에 띈다.
  - 제안: `> 들어가` 로 공백 추가.

- **[INFO] 새로 추가/수정된 여러 포인터 링크가 "§N" 이라는 절 번호를 텍스트에 적으면서도 앵커(fragment)를 달지 않아 파일 전체로만 이동한다**
  - target 위치: `spec/5-system/12-webhook.md:342` (`[\`conventions/redis-keys.md\` §3](../conventions/redis-keys.md)` — 앵커 없음), `spec/conventions/redis-keys.md:59~63` (`data-flow/15 §2.2`, `data-flow/14 §2.2`, `webhook` 행 — 전부 앵커 없음. 단 `cafe24:install:*` 행(64번)만 `#98-private-앱-app-url-hmac-검증` 앵커를 달았다)
  - 위반 규약: 명시적 규약 위반은 아님(redis-keys.md 는 앵커 형식을 강제하지 않는다) — 다만 같은 문서·같은 표 안에서 한 행만 앵커를 달고 나머지는 안 다는 비일관성이, 마침 이번 diff 가 "가리키는 절이 실재하는지" 를 바로잡는 작업이었던 만큼 아쉬운 지점이다.
  - 제안: 여유가 있다면 나머지 행에도 `#22-redis`, `#92-...` 류 앵커를 달아 "§N" 표기와 실제 링크가 대응하게 맞춘다. 필수는 아님.

## 요약

이번 diff(스펙 전용, 코드 변경 없음)는 `redis-keys.md` §3 인벤토리의 죽은 포인터 2건(chat-channel, cafe24)을 실재하는 절로 바로잡고 `12-webhook.md` 에 `wh:rl:*` 키 상세를 처음 명문화한 정합성 보수 작업으로, 링크 대상 존재 여부·용도/TTL 서술 자체는 코드(`channel-conversation.service.ts`, `public-webhook-quota.service.ts`, `Cafe24InstallNonceCache`)와 정확히 일치해 왜곡·오기재는 없다. 다만 이번에 처음 표면화된 `chat-channel:`/`chat-channel-lock:` 키가 규약 §1 이 정의한 "도메인:용도:식별자" 2세그먼트-헤드 형태를 벗어나는데도 external-interaction 사례처럼 명시적 예외 각주가 없고, redis-keys.md 가 "상세 SoT" 로 새로 지정한 `4-cafe24.md §9.8` 은 CLAUDE.md 의 Overview/본문/Rationale 구조상 "Rationale" 절에 위치해 있어 "Rationale=배경/근거"라는 문서 구조 규약과 거리가 있다(다만 이는 해당 파일 전체의 기존 패턴이라 이번 diff 가 새로 만든 문제는 아니다). 이 둘은 시스템 invariant 를 깨는 CRITICAL 은 아니고, 규약 문서 쪽 각주 보강이나 CLAUDE.md 문서구조 규약의 명문화된 예외 인정으로 해소 가능한 WARNING 수준이다. 그 외 사소한 formatting(blockquote 공백, 앵커 누락)은 INFO.

## 위험도

LOW
