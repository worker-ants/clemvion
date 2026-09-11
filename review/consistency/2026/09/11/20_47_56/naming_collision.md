# 신규 식별자 충돌 검토 — `spec-draft-chat-channel-binder-drift.md`

## 검토 범위 및 방법

target draft 가 새로 도입하는 식별자를 6개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·파일 경로)으로 추출하고, 각각을 저장소 실측(`grep`/`find`/`git cat-file`)으로 기존 사용처와 대조했다. 대조 대상 코드베이스는 이 worktree(`spec-chat-channel-binder-drift-eb5b89`, HEAD `77f4a88e5`)에 이미 머지되어 있는 T1(`ba634a4b0`)·T2(`77f4a88e5`) 산출물이다 — draft 가 "verbatim, `77f4a88e5` 기준" 이라 명시한 그 시점과 일치한다.

draft 가 새로 도입하는 식별자 후보:
1. Rationale ID `R-CC-22` (`spec/5-system/15-chat-channel.md`)
2. `code:` frontmatter glob 3개(`chat-channel-*.ts` · `dto/chat-channel-*.dto.ts` · `trigger-callback-url*.ts`)
3. §7 열거에 새로 추가되는 파일명 5개(`chat-channel-binder.service.ts` · `chat-channel-input-rules.ts` · `chat-channel-rejection-messages.const.ts` · `trigger-callback-url.ts` · `chat-channel-token-rotator.service.ts` 재배치 · `dto/chat-channel-config.dto.ts`)
4. 귀속 표기에 새로 등장하는 클래스명 `ChatChannelBinderService`(호출자→정의처 정정)

## 발견사항

### [INFO] `dto/chat-channel-config.dto.ts` 의 `code:` 이중 커버리지 — draft 이전부터 존재, draft 로 변경 없음
- target 신규 식별자: `spec/5-system/15-chat-channel.md` frontmatter 에 추가되는 glob `codebase/backend/src/modules/triggers/dto/chat-channel-*.dto.ts`
- 기존 사용처: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 의 `codebase/backend/src/modules/triggers/dto/**` (기존에 이미 존재하는 넓은 glob)
- 상세: `dto/chat-channel-config.dto.ts` 하나의 파일이 두 spec 문서의 `code:` 술어에 동시에 매칭된다. 다만 이 이중 커버리지는 **draft 이전부터 이미 존재**했다 — 현행 `15-chat-channel.md` 는 같은 파일을 명시 경로로 이미 등재하고 있었고(`- codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`), `2-trigger-list.md` 의 `dto/**` 도 이미 그 파일을 덮고 있었다. draft 는 명시 경로를 glob 으로 **치환**할 뿐 매칭 집합의 교집합 크기를 바꾸지 않는다(치환 전후 모두 이 한 파일만 해당). 복수 spec 이 같은 코드 파일을 서로 다른 관점(트리거 UI 표면 vs chat-channel 도메인 규칙)에서 `code:` 로 공유하는 것은 이 저장소에서 이미 확립된 패턴(`spec-impl-evidence.md` 참조)이라 CRITICAL/WARNING 대상은 아니다.
- 제안: 조치 불요. draft 의 Rationale 에 "이 glob 이 다른 spec 의 `dto/**` 와 겹칠 수 있다"는 한 줄을 덧붙이면 다음 사람이 재확인할 필요가 없어지지만, 필수는 아니다.

## 관점별 결론

1. **요구사항 ID 충돌** — `R-CC-22` 는 저장소 전체 `spec/` grep 결과 미사용(현재 최대는 `R-CC-21`, `R-CC-14` 는 결번이며 재사용하지 않음, draft 의 주장과 실측 일치). 충돌 없음.
2. **엔티티/타입명 충돌** — `ChatChannelBinderService` 는 spec 어디에도 아직 등장하지 않고(0건), 코드베이스에 이미 존재하는 실제 클래스명과 정확히 일치한다(`chat-channel-binder.service.ts`). `SetupResult` 인터페이스는 `spec/conventions/chat-channel-adapter.md` §2.4 와 `codebase/backend/src/modules/chat-channel/types.ts` 양쪽에서 이미 동일하게 정의된 **단일** 타입이고, draft 는 그 JSDoc 문구 하나(caller 귀속)만 고친다 — 새 타입을 만들지 않는다. 충돌 없음.
3. **API endpoint 충돌** — draft 는 신규 endpoint 를 도입하지 않는다(문서 내 API 경로 변경 없음, 파일/귀속 정정뿐). 해당 없음.
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트명 도입 없음. 기존 `chat-channel-token-rotator` 큐 이름은 유지된다. 해당 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/설정 키 도입 없음. 해당 없음.
6. **파일 경로 충돌** — draft 는 새 spec 파일을 만들지 않고 기존 6개 파일만 편집한다. 3개 신규 glob 을 정본 매처 방식(`review_guard._glob_to_regex` 규칙, `*`→`[^/]*`)으로 직접 재현해 계산한 결과 `chat-channel-*.ts`(7) + `dto/chat-channel-*.dto.ts`(1) + `trigger-callback-url*.ts`(2) = **10**, `triggers/` 디렉터리 전체 파일 수는 **27**로 draft 의 실측치와 정확히 일치했다. glob 3개가 겹치는 다른 spec 의 `code:` 항목은 위 INFO 1건(사전 존재, 미확대) 외에 없음(`chat-channel-adapter.md`·`redis-keys.md`·`slack/discord/telegram.md` 는 전부 `modules/chat-channel/` 아래 별도 트리라 `modules/triggers/` glob 과 물리적으로 겹치지 않는다). `setupChatChannel`/`teardownChatChannel` 메서드 정의는 코드베이스에 각각 단 하나(`chat-channel-binder.service.ts`)뿐이라 귀속 정정 대상과 실제 정의처가 정확히 일치한다.

## 요약

target draft 는 새 개념·엔드포인트·이벤트를 신설하는 문서가 아니라, 이미 머지된 코드 이동(T1/T2)을 spec 에 뒤늦게 반영하는 정합화 작업이다. 도입되는 유일한 신규 "식별자"는 Rationale ID `R-CC-22` 뿐이며 이는 실측으로 미사용임이 확인됐다. 나머지는 전부 코드베이스에 이미 존재하는 실제 파일명/클래스명/함수명을 spec 문서에 뒤늦게 등재하는 것이라 정의상 "새 의미로 충돌"할 여지가 없고, glob 확장이 초래하는 다른 spec 과의 `code:` 교집합도 실측 결과 draft 이전부터 있던 것과 동일하다(신규 확대 없음). CRITICAL·WARNING 급 신규 식별자 충돌은 발견되지 않았다.

## 위험도
NONE
