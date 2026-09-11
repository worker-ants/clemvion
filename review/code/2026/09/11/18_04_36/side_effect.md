# 부작용(Side Effect) 리뷰 — impl-chat-channel-binder-t2

## 검증 방법

`chat-channel-binder.service.ts`(신규) 의 본문을 `triggers.service.ts` diff 에서 **삭제된** 원본
블록과 줄 단위로 대조했다(둘 다 이 프롬프트에 unified diff 형태로 실려 있어 `git checkout`/뮤테이션
없이 정적 대조만으로 가능했다 — 저장소에는 아무것도 쓰지 않았다). 추가로 DI 시그니처 변경
(`TriggersService` 생성자에 `chatChannelBinder` 추가)이 실제로 모든 테스트 provider 등록에
반영됐는지 `grep`으로 전수 확인했다.

- `chat-channel-binder.service.ts` 의 `setupChatChannel`/`teardownChatChannel` 본문은 원본
  `triggers.service.ts`(삭제된 `private setupChatChannel`/`private teardownChatChannel`)와
  **콜백 URL 조립 한 줄을 제외하고 완전히 동일**하다. 콜백 URL 조립도 기존
  `this.buildCallbackUrl(endpointPath)` (`baseUrl = configService.get('app.url') ?? 'http://localhost:3011'`)
  와 신규 `buildTriggerCallbackUrl(configService.get('app.url'), endpointPath)` (동일 fallback·동일
  슬래시 정규화)가 기능적으로 동치임을 확인했다 — 순수 이동 주장은 근거가 있다.
- `TriggersService` 생성자에 `chatChannelBinder: ChatChannelBinderService` 파라미터가 추가됐다.
  실제 앱 경로는 `TriggersModule.providers` 에 `ChatChannelBinderService` 가 등록돼 Nest DI 가
  자동 해결한다(`codebase/backend/src/modules/triggers/triggers.module.ts:51`). 수동으로
  `Test.createTestingModule` 을 쓰는 스펙 파일은 이 새 의존을 직접 등록해야 하는데, 전수 grep
  결과 `triggers.service.spec.ts` 의 `TriggersService,` 8개 직접 블록(40/111/427/614/1576/1736/
  1844/2138/2334행 — `createBaseProviders` 헬퍼 1곳 포함하면 실질 9개 지점) 전부와
  `triggers.web-chat.spec.ts` 의 단일 `makeService()` 헬퍼 모두 바로 다음 줄에
  `ChatChannelBinderService` 를 추가했다. `triggers.controller.spec.ts` 는 `TriggersService` 를
  `jest.Mocked<Pick<...>>` 로 완전히 모킹해 DI 컴파일을 거치지 않으므로 영향 없음. `grep -rn "new
  TriggersService("` 전역 0건 — 수동 생성자 호출 경로도 없다. 이 시그니처 변경으로 인한 누락된
  호출자는 발견되지 않았다.
- `ChatChannelBinderService` 자신이 요구하는 협력자(`Repository<Trigger>`·`ChannelAdapterRegistry`·
  `ChannelListenerRegistry`·`SecretResolverService`·`ConfigService`)는 위 9(+1)개 테스트 블록
  모두에 이미 `TriggersService` 자신의 의존으로 등록돼 있어(동일 값 재사용), 신규 provider 가
  해석 실패 없이 컴파일된다 — 샘플 블록(`triggers.service.spec.ts:105`) 직접 대조로 확인.

## 발견사항

- **[INFO]** 로그 컨텍스트와 메시지 리터럴이 서로 다른 클래스를 가리키게 된다 (관측 가능한 출력 변경)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (`this.logger = new Logger(ChatChannelBinderService.name)` 및 그 아래 4개 `this.logger.warn(\`TriggersService: ...\`)` 호출)
  - 상세: Nest `Logger` 는 생성자에 준 이름을 **컨텍스트 태그**로 출력에 붙인다(예: `[ChatChannelBinderService] TriggersService: chatChannel.provider="..." 미등록 — setupChannel skip`). 이동 전에는 컨텍스트와 메시지 리터럴이 둘 다 `TriggersService` 로 일치했지만, 이동 후에는 **컨텍스트=`ChatChannelBinderService`, 메시지 본문=`TriggersService:`** 로 갈라진다. 이는 코드 자체는 손대지 않았어도 **런타임 관측 가능한 로그 출력이 이 PR 로 인해 새로 불일치 상태가 되는** 것이라 "이벤트/콜백"·"의도치 않은 상태 변경" 관점에서 부작용 체크리스트에 해당한다. 다만 PR 저자가 이 트레이드오프를 docstring(47행 부근 "로그 메시지의 `TriggersService:` 접두는 의도적으로 남겼다")과 후속 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md` "옮긴 로그 메시지가 아직 `TriggersService:` 접두를 달고 있다" 항목)에 명시적으로 남겨 두었고, 이 리터럴을 단언하는 테스트가 0건임도 실측했다고 밝혔다.
  - 제안: 추가 조치 불요 — 이미 인지·기록됨. 로그 기반 알림/모니터링이 메시지 prefix 로 origin 클래스를 식별하고 있다면(이 리포지토리 밖의 외부 로그 파서가 있다면) 그 파서가 영향받을 수 있다는 점만 참고.

- **[INFO]** `setupChatChannel`/`teardownChatChannel` 이 `private` 메서드에서 새 클래스의 `public` 메서드로 승격됨 — 캡슐화 표면이 넓어짐 (모듈 내부 한정)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:83`(`async setupChatChannel(...)`), `:277`(`async teardownChatChannel(...)`)
  - 상세: 종전에는 `TriggersService` 의 `private` 메서드라 클래스 밖에서 호출 불가능했다. 이동 후에는 `ChatChannelBinderService` 의 `public` 메서드가 되어, 원리적으로는 `TriggersModule` 안의 **다른 어떤 provider** 도 `ChatChannelBinderService` 를 주입받아 호출할 수 있다. 다만 `triggers.module.ts` diff(50~51행)가 `ChatChannelBinderService` 를 `exports` 에 넣지 않아 **모듈 경계 밖으로는** 노출되지 않으므로 외부 공개 API 영향은 없다. 모듈 내부 남용 가능성만 이론적으로 존재.
  - 제안: 조치 불요. 순수 함수 대안(호출자가 콜백 URL만 넘기기)을 기각한 것과 같은 트레이드오프이며 plan 이 이미 인지하고 있다.

- **[정보/검증 결과 — 결함 아님]** DB 쓰기·secret store 쓰기·listener registry 호출·네트워크 호출(`adapter.setupChannel`/`teardownChannel`) 은 이동 전후 조건·순서·인자가 **전부 동일**하다. `TriggersService.remove()`(옛 855행 부근)에서 `this.teardownChatChannel(trigger)` → `this.chatChannelBinder.teardownChatChannel(trigger)` 로, 그 직후 `this.channelListenerRegistry.unregister(trigger.id)` 는 여전히 `TriggersService` 자신이 직접 호출한다(이동 안 됨) — register/unregister 의 소유가 갈리는 것도 plan 문서의 "경계" 표와 일치하며 새로운 분기나 누락은 없다. `create()`/`update()` 호출부는 `setupChatChannel` 완료 후 in-memory `saved` 가 stale 함을 알고 `triggerRepository.findOne` 으로 재조회하는 기존 패턴을 그대로 유지한다(447~455행, 565~577행) — 이 refetch 로직 자체는 이 PR 이 만든 것이 아니라 그대로 보존됐다.

## 요약

`ChatChannelBinderService` 신설은 문서화된 대로 **순수 코드 이동**이며, 원본 삭제 블록과의 줄 단위
대조 결과 콜백 URL 조립 한 줄(기능적으로 동치)을 제외하면 완전히 동일하다. DB/secret-store 쓰기,
listener registry 등록/해제, 외부 adapter 호출 등 실질적 부작용 표면은 조건·순서·인자 모두 보존됐고
새로 생기거나 사라진 것이 없다. `TriggersService` 생성자 시그니처 변경(신규 DI 파라미터)은 실제
모듈 등록과 9개 이상 테스트 provider 블록 전수에 정확히 반영되어 누락된 호출자가 없음을 grep 으로
확인했다. 유일하게 새로 생기는 관측 가능한 부작용은 로거 컨텍스트(`ChatChannelBinderService`)와
로그 메시지 리터럴(`TriggersService:`)의 불일치인데, 이는 PR 저자가 "순수 이동" 주장을 지키기 위해
의도적으로 선택하고 문서·후속 트래커에 명시한 트레이드오프다. 이 변경을 차단할 CRITICAL/WARNING 급
부작용은 발견하지 못했다.

## 위험도

LOW
