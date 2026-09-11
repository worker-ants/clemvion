# 성능(Performance) 코드 리뷰

## 범위 및 방법

이번 변경은 `plan/in-progress/impl-chat-channel-binder.md` 가 명시한 대로 **순수 코드 이동(T1)**
이다 — `TriggersService` 의 private 메서드 6개(`assertChatChannelInputSafe`(+overload 2) ·
`assertPatchCarriesNoSecrets` · `assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext` ·
`assertInboundSigningPlaintextByProvider` · `translateSetupChannelError`)를 신규 파일
`codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 로 옮기고,
`triggers.service.ts` 는 그 함수들을 import 해 호출부만 `this.foo(...)` → `foo(...)` 로 바꿨다.
로직 자체(분기 조건·정규식·예외 payload)는 한 글자도 바뀌지 않았다 — diff 를 대조해 확인함.
`triggers.service.ts` 전체 파일도 `Read` 로 직접 열어 호출부 6곳(L404, L414, L487, L495, L510,
L912, L1291)이 모두 단발 호출(반복문 밖)이라는 것을 확인했다. `review/`, `plan/` 하위 문서 파일
(파일 4~11)은 코드가 아니므로 성능 관점 분석 대상에서 제외했다.

가설 검증을 위한 코드 뮤테이션은 필요하지 않았다(로직 델타가 없는 순수 이동이므로 정적 대조로
충분). 저장소 파일은 건드리지 않았다 — `git status --short` 로 확인, 새로 생성된 파일 없음.

## 발견사항

- **[INFO]** 클래스 메서드 → 모듈 레벨 함수 전환에 따른 실질적 성능 변화 없음
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (전체) / `codebase/backend/src/modules/triggers/triggers.service.ts:404,414,487,495,510,912,1291`
  - 상세: `this.method(...)` 호출을 module-level `function(...)` 호출로 바꾼 것은 V8 관점에서
    다형성(polymorphic inline cache) 대상이 인스턴스 메서드에서 독립 함수로 바뀌는 정도이며,
    이 함수들은 요청당 O(1)회(반복문 밖) 호출되므로 체감 가능한 차이가 없다. 알고리즘·시간복잡도·
    호출 횟수·I/O 패턴 어느 것도 바뀌지 않았다.
  - 제안: 조치 불필요. 참고용 기록.

- **[INFO]** `stripChatChannelPlaintext` 의 객체 스프레드(`{ ...rest }`)는 이동 전과 동일하게
  얕은 복사를 1회 수행
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:210-211` (`stripChatChannelPlaintext`)
  - 상세: `chatChannel` 객체는 필드 수가 작고(provider/botToken/inboundSigning 계열 등 10개
    미만) 요청당 최대 3회(`create`/`update`/`sanitizeForResponse` 경로) 호출된다. 신규 결함이
    아니라 원본 private 메서드에서 그대로 옮겨진 동작이므로 이번 diff 가 만든 회귀는 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `translateSetupChannelError` 의 정규식 검사(`/\b(401|403)\b/`)는 리터럴 고정
  패턴이라 ReDoS 위험 없음
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:306` (`translateSetupChannelError`)
  - 상세: 중첩 정량자·backtracking 폭발 가능 구조가 없고, `message.slice(0, 256)` 로 입력 길이도
    사전 제한된다. 이동 전과 동일한 코드이며 이번 PR 이 만든 것도 아니다.
  - 제안: 조치 불필요.

새로운 N+1 호출, 블로킹 I/O, 불필요한 대규모 메모리 할당, 캐싱 누락, 부적절한 자료구조,
선행 로딩 문제는 발견되지 않았다. `SLACK_SIGNING_SECRET_REGEX` / `DISCORD_PUBLIC_KEY_REGEX` 는
`@workflow/chat-channel-validation` 패키지에서 그대로 import 하며(정의 자체는 이 diff 의 범위
밖), 모듈 스코프에서 1회 컴파일되어 재사용되므로 반복 컴파일 비용도 없다.

## 요약

이 PR 은 계획서(`plan/in-progress/impl-chat-channel-binder.md`)가 명시한 대로 로직 변경이 전혀
없는 **순수 코드 이동**이며, 옮겨진 6개 함수는 모두 외부 협력자 의존이 0인 순수 함수이고 호출
위치는 요청당 O(1)회·반복문 밖이다. 성능에 영향을 줄 수 있는 알고리즘 복잡도 변화, N+1 패턴,
블로킹 I/O, 캐싱 전략 변경, 불필요한 연산 추가는 확인되지 않았다. 나머지 파일(계획 문서·
consistency 리뷰 산출물)은 코드가 아니므로 이 관점의 분석 대상이 아니다.

## 위험도

NONE
