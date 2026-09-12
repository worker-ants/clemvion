# API 계약(API Contract) 리뷰

## 컨텍스트

이 라운드(`16_39_18`)는 직전 라운드(`review/code/2026/09/12/16_17_57`)에서 이 reviewer 가 낸
**CRITICAL 1 · WARNING 1**에 대한 조치 결과다. 두 건 모두 코드를 직접 열어 독립적으로
재검증했다.

- **CRITICAL (스키마 이름 충돌)**: 신규 응답 DTO 클래스가 `ChatChannelRotateBotIdentityDto` 로
  개명됐다. `grep -rhoE "export class [A-Za-z0-9_]+" codebase/backend/src --include="*.dto.ts" |
  sort | uniq -c | sort -rn` 로 전 `*.dto.ts` (256개 클래스, RESOLUTION.md 의 실측치와 일치)를
  직접 스캔해 **동명 클래스 0건**을 확인했다. → **해소 확인**.
- **WARNING (문서가 실응답보다 좁음 — `publicKey` 누락)**: `chat-channel-rotate-bot-token.dto.ts`
  에 `publicKey?: string`(`@ApiPropertyOptional`)이 추가됐고, `triggers.service.ts` 의
  `rotateBotToken` 반환 타입 선언이 손으로 다시 적은 리터럴 대신
  `NonNullable<ChatChannelConfig['botIdentity']> | null` 로 바뀌어 SoT(`chat-channel/types.ts:55`
  의 `botIdentity` 형태: `botId`·`username`·`teamId?`·`publicKey?`)를 그대로 참조한다. 두
  선언이 필드 단위로 정확히 일치함을 대조 확인했다. → **해소 확인**.

## 발견사항

- **[INFO]** `chat-channel-rotate-bot-token.dto.ts` 를 `dto/responses/` 관례 대신 평평한 `dto/`
  에 둔 것은 `15-chat-channel.md` 의 `code:` glob(`*` 가 `/` 를 안 넘음)과의 충돌을 피하려는
  의도적 선택이며, 이미 plan 에 planner 후속 항목으로 등재돼 있다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts:1-14`
    (파일 헤더 주석) / `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목
    "응답 DTO 의 `responses/` 관례가 `code:` glob 과 충돌한다"
  - 상세: HTTP 계약 자체(경로·응답 형태)에는 영향이 없다 — 순수하게 저장소 파일 배치 관례와
    spec 소유권(glob 매칭) 문제다. `2-trigger-list.md` 의 `dto/**` 가 두 자리를 모두 덮어
    `--impl-done` spec-link 판정은 어느 쪽이든 성립한다는 점까지 plan 에 적혀 있어 이번 PR 이
    새로 만든 리스크는 아니다.
  - 제안: 조치 불요 (planner 축 후속 결정 대기).

- **[INFO]** `rotateBotToken` 은 같은 컨트롤러의 다른 rotate 계열(`rotateNotificationSecret`,
  `revokePerTriggerToken`)과 달리 `:id` 에 `ParseUUIDPipe` 가 없고 `@ApiParam({ name: 'id',
  format: 'uuid' })` 도 없다. 직전 라운드에 낸 동일 지적이 그대로 남아 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken`
    함수 시그니처 (`@Param('id') triggerId: string`). 이 파라미터 선언 자체는 이번 diff 로
    바뀐 줄이 아니다(PR 이전부터 존재).
  - 상세: 이번 PR 스코프(swagger 응답 문서화)가 아니라는 판단이 이미 plan 에 명시돼 있고
    ("developer, 2026-09-12 등재 · 스코프 밖" — 처분 후보로 이월), 실사용 영향도 비-UUID 입력이
    최종적으로 `RESOURCE_NOT_FOUND` 404 로 수렴해 치명적이지 않다.
  - 제안: 조치 불요 (트래커에 이미 등재, 이 PR 에서 확대할 이유 없음).

- **[INFO]** POST 바디가 DTO 클래스가 아닌 인라인 타입(`body: { newBotToken?: string }`)이라
  swagger 에 request body 스키마가 자동 문서화되지 않는다(`@ApiBody()` 부재).
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken`
    시그니처. 이 부분도 이번 diff 의 변경 대상이 아니다(수동 `if (!body?.newBotToken …)` 검증도
    기존 코드 그대로).
  - 상세: 이번 PR 은 "응답 형식 문서화 잔여"만 스코프로 명시했고(plan 근거 참조) 요청 바디
    문서화는 별개 축이다. 새로 만든 결함이 아니므로 이번 라운드의 판정에는 반영하지 않는다.
  - 제안: 조치 불요. 필요하면 별도 후속 항목으로 등재 권장.

## 관측된 저장소 상태 이상 — 내가 만들지 않음

리뷰 도중 `git status --short` 로 확인한 결과 `codebase/backend/src/modules/triggers/
chat-channel-input-rules.ts` 가 **미커밋 상태로 수정돼 있었다**:

```diff
 function hasField(chatChannel: ChatChannelInput, field: string): boolean {
-  return (
-    typeof (chatChannel as unknown as Record<string, unknown>)[field] !==
-    'undefined'
-  );
+  return !!(chatChannel as unknown as Record<string, unknown>)[field];
}
```

이는 내가 만든 변경이 아니다 — `Read` 로 파일 전체를 열었을 때는 원본(`typeof … !==
'undefined'`) 그대로였고, 이후 `git diff` 로 재확인했을 때 이 truthy-판별 변경이 관측됐다.
`RESOLUTION.md` 가 서술하는 W3 뮤테이션 검증(`hasField` 를 `!!value` 로 바꿔 `null`/`''` 가
두 층을 통과하는지 보는 실험)과 정확히 일치하는 형태라, **동시에 실행 중인 다른 reviewer/검증
세션이 남긴 일시적 뮤테이션**으로 보인다. 본 리뷰의 분석은 이 파일의 **committed 상태**(diff/
`git show`)를 기준으로 했으므로 위 발견사항에는 영향이 없다. `git checkout`/`restore` 는 금지
규약에 따라 실행하지 않았다 — 이 잔여물을 다음 사람이 실결함으로 오인하지 않도록 여기 기록한다.

## 요약

이번 라운드는 순수 조치 라운드다. 직전 라운드가 낸 CRITICAL(스키마 이름 충돌)과 WARNING(응답
DTO 가 실제 wire 응답보다 좁음) 둘 다 코드를 직접 열어 필드 단위로 대조 확인했고, 실제로
해소됐다. 이번 diff 자체(`chat-channel-input-rules.ts` 리팩터링, DTO/컨트롤러 주석 정정, 테스트
보강)는 에러 봉투 형태(`code`/`details.field`/`details.code`)·HTTP 상태 코드·응답 필드를 전혀
바꾸지 않는 순수 정리이며, 신규로 도입한 API 표면(`ChatChannelRotateBotTokenDto` 응답 문서화)도
실제 서비스 반환값과 SoT 타입 참조로 일치가 보장되도록 고쳐졌다. 남은 항목(3건)은 전부 이 PR
이전부터 있던 스코프 밖 사안이고 plan 트래커에 이미 등재·처분돼 있어 조치가 필요 없다.

## 위험도

LOW
