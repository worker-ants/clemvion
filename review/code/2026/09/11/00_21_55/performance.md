# 성능(Performance) 코드 리뷰

## 검토 방법

`_prompts/performance.md` 가 프롬프트 크기 제한으로 생략한 파일(`triggers.service.ts`,
`triggers.service.spec.ts`, `trigger-dto-validation.spec.ts` 등)은 `git diff origin/main --
<path>` 로 저장소에서 직접 전문을 확인했다. 저장소 트리는 변경하지 않았다(`git status --short`
확인 불요 — read-only 조사만 수행). 핵심 변경은 `codebase/backend/src/modules/triggers/` 하위
DTO·서비스·컨트롤러 6개 파일이며, 나머지(mdx 문서·plan·review 산출물)는 런타임 경로가 아니라
성능 관점에서 검토 대상이 아니다.

## 발견사항

없음. 이 diff 는 알고리즘 복잡도, DB/외부 API 호출 횟수, 메모리 할당, 캐싱, 블로킹 I/O, 데이터
구조, 로딩 시점 어느 축으로도 새로운 부담을 추가하지 않는다. 근거는 아래와 같다.

- **N+1 없음**: `triggers.service.ts` diff 398줄 전체에서 신규 `for`/`.map`/`.forEach`/`while`
  루프나 신규 `triggerRepository.*` 호출은 0건이다(`grep` 로 diff 의 `+` 줄만 대조해 확인).
  `assertChatChannelAlreadySetUp(trigger, chatChannel)` 은 이미 로드된 `trigger.config` 를
  in-memory 로 읽을 뿐 추가 쿼리를 내지 않는다. `update()`/`create()` 끝의 `triggerRepository.findOne`
  재조회(응답 stale 방지용)는 이 PR 이전부터 있던 패턴을 diff 컨텍스트로 그대로 물려받은 것이며,
  이번 변경이 새로 추가한 조회가 아니다.
- **secret-store 호출 횟수는 오히려 감소**: `setupChatChannel` 에 추가된
  `storeUserSuppliedSecrets` 플래그가 `false`(PATCH 경로)일 때 `this.secrets.rotate()` 두 곳
  (botToken, provider-issued inboundSigning)을 건너뛴다 — `codebase/backend/src/modules/triggers/triggers.service.ts`
  `setupChatChannel` 본문(`if (storeUserSuppliedSecrets) { await this.secrets.rotate(...) }`).
  종전에는 PATCH 마다 무조건 두 번의 비동기 secret-store round trip 이 발생했으나, 이 변경 후
  PATCH 는 그 두 호출을 생략하고 telegram server-issued 서명 저장(세 번째 쓰기)만 조건부로
  수행한다. 순회 없는 단순 boolean 게이팅이라 회귀 위험도 없다.
- **알고리즘 복잡도 변화 없음**: `assertChatChannelInputSafe`(오버로드 2개 추가)·
  `assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp` 은 모두 필드 몇 개를 확인하는
  O(1) 검증 함수다. `stripChatChannelPlaintext` 의 캐스팅 제거(`as ChatChannelConfigDto & {...}`
  → 그대로 구조분해)도 런타임 동작은 동일하고 타입 레벨 정리일 뿐이다.
- **DTO metadata 생성은 부트스트랩 1회성 비용**: `ChatChannelUpdateConfigDto extends
  OmitType(ChatChannelConfigDto, ['botToken', 'inboundSigningPlaintext'] as const)`
  (`codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:372`)는 `@nestjs/swagger`
  의 클래스 데코레이터로, 모듈 로드 시 한 번 reflect-metadata 를 복사하는 비용이며 요청 경로
  런타임 비용이 아니다. 필드 수도 2개뿐이라 무시할 수준.
- **불필요한 연산·문자열 누적 없음**: 신규 에러 메시지는 전부 상수 리터럴이며 반복문 안에서
  조립되는 문자열 연결이 아니다.
- **테스트 파일 증가(참고용, 비차단)**: `triggers.service.spec.ts`(+570/-110)·
  `trigger-dto-validation.spec.ts`(+146)로 CI 실행 시간이 소폭 늘어나지만, 이는 프로덕션 성능과
  무관하고 회귀 커버리지 확대가 목적이므로 지적 대상이 아니다.

## 요약

이번 diff 는 chat-channel PATCH 가 사용자 비밀을 받지 않도록 하는 DTO 분리(`ChatChannelUpdateConfigDto`)와
서비스 계층의 조건부 secret-store 쓰기 게이팅(`storeUserSuppliedSecrets`)이 핵심이며, 둘 다 검증
로직·boolean 분기 추가에 그친다. 신규 DB 조회·외부 API 호출·루프·대용량 메모리 할당은 없고,
오히려 PATCH 경로에서 불필요했던 secret-store 쓰기 2건을 건너뛰게 되어 미세하게 I/O 가
줄었다. 성능 관점에서 지적할 CRITICAL/WARNING/INFO 항목이 없다.

## 위험도

NONE
