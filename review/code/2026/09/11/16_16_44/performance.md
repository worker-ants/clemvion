# 성능(Performance) 코드 리뷰

## 범위 및 방법

리뷰 대상 15개 파일 중 실제 애플리케이션 코드는 3개뿐이다:

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (신규, 268줄) — 단위 테스트
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (신규, 324줄) — `TriggersService` 에서 옮겨진 순수 함수 6개
- `codebase/backend/src/modules/triggers/triggers.service.ts` — 위 6개 메서드 정의 삭제 + import 로 대체 호출

나머지(`plan/**`, `review/**`)는 계획 문서·이전 리뷰 세션 산출물(마크다운/JSON)이라 성능 관점 분석 대상이 아니다.

프롬프트에 diff 가 "크기 제한으로 생략"되어 있어, 저장소를 직접 `git diff origin/main`·`Read` 로 열어 실제 변경 내용을 확인했다(뮤테이션 없이 읽기 전용):

- `git diff origin/main --stat -- codebase/` → 세 코드 파일만 변경, `+606/-310` 순증가.
- `git diff origin/main -- .../triggers.service.ts` 전체 대조 → 6개 private 메서드(`assertChatChannelInputSafe`(+overload 2)·`assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`·`stripChatChannelPlaintext`·`assertInboundSigningPlaintextByProvider`·`translateSetupChannelError`) 정의가 통째로 삭제되고, 호출부 7곳(`this.X(...)` → `X(...)`)만 남았다. 조건 분기·정규식·예외 payload 는 삭제된 블록과 새 파일의 동일 블록이 문자 단위로 같다.
- `git diff 6dc2b7d60 81d2a8c18 -- .../chat-channel-input-rules.ts` → 이번 세션이 이 파일에 더한 변화는 JSDoc 주석 6줄 추가뿐(로직 변경 0).
- `chat-channel-input-rules.spec.ts` 는 이번 세션에 통째로 신규 추가된 단위 테스트 파일이며, `it.each` 로 짧은 문자열(`'a'.repeat(32)`/`'a'.repeat(64)`)을 다루는 순수 함수 호출-단언 쌍이다.

## 발견사항

- **[INFO]** 클래스 메서드 → 모듈 레벨 함수 전환은 실질적 성능 변화가 없는 기계적 추출이다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (전체) / `codebase/backend/src/modules/triggers/triggers.service.ts` 호출부(`create()`/`update()`/`setupChatChannel` catch 블록)
  - 상세: `this.method(...)` → module-level `function(...)` 전환은 V8 인라인 캐시 대상이 바뀌는 정도이고, 6개 함수 모두 요청당 O(1)회(반복문 밖) 호출된다. 알고리즘 복잡도·호출 횟수·I/O 패턴 어느 것도 바뀌지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** `translateSetupChannelError` 의 판별 정규식(`/\b(401|403)\b/`)은 고정 리터럴 패턴이라 ReDoS 위험이 없다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:312` (`translateSetupChannelError`)
  - 상세: 중첩 정량자·backtracking 폭발 구조가 없고, `message.slice(0, 256)` 로 입력 길이도 사전 제한된다. 이번 세션에서 이 함수에는 주석만 추가됐고 로직은 그대로다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 단위 테스트(`chat-channel-input-rules.spec.ts`)는 짧은 고정 길이 문자열(≤64자)만 다뤄 성능에 영향이 없다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (전체, 특히 `'a'.repeat(32|64)` 를 쓰는 provider 분기 케이스)
  - 상세: `it.each` 로 케이스를 늘렸지만 각 케이스는 O(1) 순수 함수 호출-단언이며 루프·재시도·대기 로직이 없다.
  - 제안: 조치 불필요.

새로운 N+1 호출, 블로킹 I/O, 불필요한 대규모 메모리 할당, 캐싱 누락, 부적절한 자료구조, 선행 로딩 문제는 이번 diff 범위(세 코드 파일) 어디에서도 발견되지 않았다.

## 요약

이번 변경은 `TriggersService` 안에 있던 chat-channel 입력 검증/변환 함수 6개(외부 협력자 의존 0)를 별도 모듈로 옮기는 순수 리팩터에, 이동된 함수를 직접 겨냥한 단위 테스트 268줄과 주석 6줄을 더한 것이다. 로직·정규식·예외 payload·호출 횟수·호출 위치(모두 요청당 O(1), 반복문 밖) 어느 것도 바뀌지 않았음을 `git diff` 전문 대조와 소스 직접 열람으로 확인했다. 신규 테스트도 짧은 고정 길이 입력을 쓰는 순수 함수 호출이라 성능에 영향이 없다. 성능 관점에서 조치가 필요한 지점은 없다.

## 위험도

NONE
