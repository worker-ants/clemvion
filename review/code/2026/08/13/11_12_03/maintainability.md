# 유지보수성(Maintainability) 리뷰 — CCH-SE-02 update dedup (라운드 `11_12_03`)

## 범위 확인

이번 프롬프트의 diff(67개 파일, `git diff origin/main...HEAD`)는 실질적으로 두 겹이다:

1. **실 코드 변경(파일 1~6)** — `ChatChannelDedupService` 신설(`chat-channel-dedup.service.ts` + spec) +
   `ChatChannelModule` DI 배선(`chat-channel.module.ts`) + `HooksService` 호출부 배선
   (`hooks.service.ts` + spec). `git log --oneline -- <이 6파일 경로>` 로 확인한 결과 이 코드를
   건드린 커밋은 이 브랜치에 **단 1개**(`a562bfe99`)뿐이다 — 즉 앞선 리뷰 라운드
   (`02_38_41`→`02_50_38`→`09_09_58`)가 반복해서 검토한 것과 **바이트 단위로 동일한 코드**다.
2. **문서·리뷰 산출물(나머지 61개 파일)** — `plan/**` 체크박스·`CHANGELOG.md`·`spec/**` 3건
   (`telegram.md`/`15-chat-channel.md`/`data-flow/14-chat-channel.md`/`redis-keys.md`) 갱신과,
   앞선 리뷰·consistency 라운드 산출물이 프로젝트 관례(`review/code/**`, `review/consistency/**`
   보관)에 따라 그대로 커밋된 것. 함수 길이·중첩·매직넘버 등 이번 관점의 정량 기준이 적용될
   대상이 아니다.

핵심 파일(`chat-channel-dedup.service.ts`, `chat-channel-rate-limiter.service.ts`,
`chat-channel.module.ts`, `hooks.service.ts`, `hooks.service.spec.ts`)을 `Read` 로 직접 열어
앞선 세 라운드(특히 직전 `09_09_58`)의 판정을 독립 재확인했다.

## 발견사항

- **[INFO]** `handleChatChannelWebhook` 은 여전히 약 440줄(`hooks.service.ts:257`~`:698`, 다음
  private 메서드 `reNoiseFormModal` 시작이 `:699`)짜리 단일 메서드로, 이번 신규 게이트를 포함해
  auth → 비활성 체크 → handshake(Slack/Discord) → parseUpdate → **dedup(신규)** → rate-limit →
  enrichInbound → 명령별 분기 → form/modal/interaction 처리까지 10개 이상의 책임을 한 함수에
  담는다.
  - 위치: 함수 전체 `hooks.service.ts:257`–`:698`, 신규 게이트 블록 `hooks.service.ts:328`–`:345`.
  - 상세: 새 블록 자체는 바로 아래 rate-limit 블록(`:347`–)과 동일한
    `if (!(await guard(...))) { warn(); return { executionId: 'ignored' }; }` 형태라 국소적
    패턴 일관성은 지킨다. 이 항목은 **라운드 1(`02_38_41`)에서 WARNING #5 로 지적됐고**, "다음
    게이트가 추가되는 시점"을 추출 트리거로 명시해 유예됐다. 이 트리거는 "지금 추가되는 이
    dedup 게이트 자체"가 아니라 **이후에 또 추가될 게이트**를 가리킨다 — 이 diff 가 코드 변경의
    시작점이자 유일한 커밋이므로, 그 트리거가 도달했는지 판단할 "다음" 게이트가 아직 없다.
    라운드 2·3 모두 같은 결론에 도달했고, 이번 라운드도 코드가 그때와 동일함을 직접 확인했으므로
    같은 결론을 유지한다 — WARNING 으로 재상정하지 않는다(트리거 미충족 상태에서 반복 재상정은
    "발견의 성격 변화 없는 재론"에 해당).
  - 제안: 조치 불요(트리거 미도달). 다음에 이 메서드에 새 inbound 게이트가 붙는 시점에,
    `chatChannelInboundAuthenticator`/`chatChannelDedup`/`chatChannelRateLimiter` 세 개(모두
    "trigger.id + 입력 → boolean/throw" 로 시그니처가 균일)를 파이프라인 협력 객체로 묶는
    리팩터링을 반드시 함께 수행할 것 — 이 조건은 이미 두 차례 명시적으로 고정돼 있다.

- **[INFO]** `ChatChannelDedupService` 생성자 보일러플레이트가 `ChatChannelRateLimiterService`
  와 주입 토큰 이름만 다르고 완전히 동일 — `PublicWebhookQuotaService` 까지 포함하면 "Redis 원자
  연산 + fail-open + 개별 Logger" 골격 클래스가 3개로 늘었다.
  - 위치: `chat-channel-dedup.service.ts:39`–`:46` vs `chat-channel-rate-limiter.service.ts:34`–`:42`
    (`this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;` 까지 동일).
  - 상세: 같은 패턴이 이 모듈군 전반에 이미 반복돼 있어 새로 만든 중복이 아니라 기존 관용구를
    한 곳 더 따른 것이다. 라운드 1·3이 동일하게 "4번째 유사 클래스 등장"을 추출 트리거로 고정했고
    이번 라운드에도 그 조건을 바꿀 새 인스턴스가 없다.
  - 제안: 조치 불요. 4번째 "Redis fail-open guard" 클래스가 생기는 시점을 `resolveRedisClient(injected, provider)` 류 공통 헬퍼 추출 트리거로 유지.

- **[INFO]** `ChatChannelDedupService` 생성자의 `@Inject('CHAT_CHANNEL_DEDUP_REDIS')` 토큰에,
  형제 클래스가 갖고 있는 설명 주석이 여전히 없다.
  - 위치: `chat-channel-dedup.service.ts:39`–`:46` (형제: `chat-channel-rate-limiter.service.ts:40`
    의 `// 테스트 주입 우선, 아니면 공유 command connection, 미가용 시 null (fail-open).`)
  - 상세: `'CHAT_CHANNEL_DEDUP_REDIS'` 토큰은 어떤 모듈의 `providers` 에도 실제로 provide 되지
    않아(운영 경로는 항상 `redisConn?.getClientOrNull()` 폴백) 단위 테스트 전용 훅인데, 그 사실이
    클래스 코드 자체에는 문서화돼 있지 않다. 라운드 3 에서 이미 지적된 항목이며 이번 라운드까지
    수정되지 않았다.
  - 제안: 형제 클래스와 동일한 한 줄 주석 추가. 우선순위 낮음(오해 시 파급은 "죽은 provider 등록
    추가" 정도).

- **[INFO]** `handleChatChannelWebhook` 상단 JSDoc "파이프라인 요약"(1~5단계)이 이번 dedup 게이트
  · 바로 다음 rate-limit 게이트 순서를 반영하지 못한다.
  - 위치: 요약 `hooks.service.ts:243`–`:256` vs 실제 게이트 `hooks.service.ts:328`–`:362`.
  - 상세: 게이트 자리의 인라인 주석은 "왜 dedup 이 rate-limit 보다 앞이어야 하는가"를 정확히
    설명하지만(`:328`–`:337`), 메서드 상단 "공식 요약"은 여전히 5단계만 나열해 순서 불변식
    (dedup → rate-limit)이 요약만 읽는 유지보수자에게 드러나지 않는다. 라운드 3에서 이미 지적,
    미수정 상태 유지.
  - 제안: 요약에 "3.5 CCH-SE-02 dedup(재도착 억제, rate-limit 보다 먼저)" 항목 추가.

- **[INFO]** `chat-channel.module.ts` 상단 docstring 의 "모듈 구조" 열거가 `ChatChannelRateLimiterService`
  (기존)·`ChatChannelDedupService`(신규) 둘 다 여전히 빠져 있다.
  - 위치: `chat-channel.module.ts:22`–`:32`(docstring) vs `providers` 배열 `:41`–`:55`
  - 상세: 이번 diff 가 새로 만든 문제는 아니다(rate-limiter 는 이전부터 이미 빠져 있었음). 다만
    새 서비스를 `providers`/`exports` 양쪽에 추가하며 docstring 목록을 갱신할 기회였는데 하지
    않았다. 라운드 3에서 이미 지적, 미수정.
  - 제안: 우선순위 낮음. 다음에 이 파일을 만질 때 목록 갱신 또는 "Spec §7 참조"로 단순화.

- **[INFO]** `hooks.service.spec.ts` 에 `@nestjs/common` import 문이 두 줄로 분리돼 있다
  (`{ BadRequestException, ConflictException, GoneException, NotFoundException,
  UnauthorizedException }` 와 `{ Logger }` 가 별도 `import` 구문).
  - 위치: `hooks.service.spec.ts:4`–`:11`
  - 상세: 신규 `Logger` import(호출부 warn spy 테스트용, 파일 5 diff)가 기존 import 블록에
    병합되지 않고 새 줄로 추가됐다. 기능에는 영향 없고 `eslint` 도 잡지 않는다(`no-duplicate-imports`
    미설정 추정). 라운드 2 RESOLUTION 에서 이미 INFO #8 로 지적·유예("다음에 그 블록을 만질 때
    병합")된 항목으로, 이번 라운드까지 그대로다.
  - 제안: 사소함. 다음에 이 import 블록을 만질 때 한 줄로 병합.

- **[INFO]** 신규 코드 자체(`ChatChannelDedupService` + spec)의 가독성·네이밍·복잡도는 양호하다
  (긍정 기록, 변경 없음 재확인).
  - 위치: `chat-channel-dedup.service.ts` 전체, `chat-channel-dedup.service.spec.ts` 전체.
  - 상세: `makeChatDedupKey`/`CHAT_DEDUP_WINDOW_SEC` 네이밍이 자매 파일의
    `makeChatRateLimitKey`/`CHAT_RATE_LIMIT_WINDOW_SEC` 와 대칭을 이루고, 매직 넘버(30초 TTL)가
    이름 있는 상수로 노출돼 있다. `claim()` 은 약 20줄, 조기 return 2개 + `try/catch` 1개로
    중첩 깊이가 얕고(최대 2단) 순환 복잡도가 낮다(분기 4개: null redis / 빈 키 / SET 성공·실패 /
    예외). `@returns` JSDoc 이 `true`/`false`/fail-open 세 케이스 의미를 명확히 문서화한다.
  - 제안: 조치 불요.

- **[INFO]** 문서 변경분(`plan/**`, `CHANGELOG.md`, `spec/**`)은 코드가 아니므로 이번 관점의 정량
  기준(함수 길이·중첩·매직넘버 등)이 적용되지 않는다. 서술 스타일(체크박스 갱신, "완료" 블록에
  근거·뮤테이션 결과 기록, WARNING/INFO 표 형식)은 이 저장소 기존 관례를 일관되게 따른다. 다만
  `spec/conventions/redis-keys.md` 의 `cc:dedup:<triggerId>:<updateId>` 표기와
  `spec/data-flow/14-chat-channel.md` 의 `cc:dedup:{triggerId}:{idempotencyKey}` 표기가 파라미터명
  (`updateId` vs `idempotencyKey`)에서 서로 다르다 — 코드(`makeChatDedupKey(triggerId, idempotencyKey)`)
  는 후자와 일치한다. 순수 문서 표기 불일치라 maintainability 코드 관점의 실질 영향은 없음.
  - 위치: `spec/conventions/redis-keys.md:61`, `spec/data-flow/14-chat-channel.md:196`
  - 제안: 조치 불요(문서 정합 관점은 documentation/consistency 리뷰어 영역).

## 요약

핵심 신규 코드(`ChatChannelDedupService` + `HooksService` 배선, 이 브랜치에서 이 코드를 건드린
커밋은 `a562bfe99` 단 하나)는 네이밍·상수화·문서화·테스트 구조·기존 컨벤션 준수 면에서 품질이
높고, 세 차례 독립 리뷰 라운드(`02_38_41`→`02_50_38`→`09_09_58`)와 이번 라운드가 직접 재확인한
결과 CRITICAL/WARNING 급 유지보수성 결함은 없다. 남는 신호는 전부 이전 라운드에서 이미 식별돼
명시적 트리거 조건과 함께 유예된 기존 항목의 연장이다: (1) `handleChatChannelWebhook` 다중 책임
누적("다음 게이트 추가 시점"이 추출 트리거, 이번 diff 는 그 자체가 게이트 추가라 트리거 아직
미도달), (2) 3번째로 늘어난 "Redis fail-open guard" 클래스 복제("4번째 등장"이 추출 트리거,
미도달), (3)~(5) DI 토큰 주석·모듈 docstring·함수 상단 파이프라인 요약의 문서 동기화 갭(라운드 3
지적 후 미수정이지만 저위험 INFO), (6) 테스트 파일의 중복 import 문(라운드 2 지적 후 유예 유지).
이 항목들을 이번 라운드에서 WARNING 으로 재상정하지 않은 이유는, 명시된 트리거 조건이 실제로
아직 충족되지 않았음을 코드를 직접 열어 재확인했기 때문이다 — 트리거 미충족 상태에서의 반복
재상정은 발견의 실질 변화 없는 재론에 해당한다.

## 위험도

LOW
