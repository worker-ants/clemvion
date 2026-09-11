# 유지보수성(Maintainability) 코드 리뷰

## 검증 방법

이 리뷰 세션(`11_33_35`)의 diff 는 `origin/main..HEAD` 두 커밋(`0710021f0`, `0fb691248`)으로
구성된다. 두 번째 커밋(`0fb691248`)은 **직전 리뷰 라운드(`review/code/2026/09/11/11_05_27`)의
maintainability WARNING(“it.each fixture 완전 중복”)과 architecture WARNING(canonical
`ErrorCode` 미재사용, 존재하지 않는 스펙 파일 인용)을 반영한 fix 커밋**이다. 프롬프트에 실린
diff 대신 `git diff origin/main..HEAD -- <file>` 로 실제 최종 상태를 직접 대조했다 — 프롬프트가
조립 과정에서 자른 `triggers.service.spec.ts` 전체 diff 를 포함해서다.

## 발견사항

- **[INFO]** `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 5개 메시지의 문체가 격식체(`botTokenRef`/
  `inboundSigningRef`/`inboundSigning` — `...입니다`/`...하세요`)와 해요체(`botToken`/
  `inboundSigningPlaintext` — `...없어요`/`...주세요`)로 혼재한다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 객체 리터럴, `botTokenRef`~`inboundSigningPlaintext` 5개 값)
  - 상세: 이번 PR 은 리터럴 값 자체를 바꾸지 않고 두 층(DTO 데코레이터·서비스 가드)에 흩어져 있던 문자열을 상수로 모았을 뿐이라 이 불일치는 pre-existing 이다(이전 라운드 `api_contract.md` 도 동일 항목을 INFO 로 짚었음). 다만 다섯 값이 한 객체 리터럴 안에 나란히 놓이면서 문체 혼재가 코드 리뷰에서 더 쉽게 눈에 띄게 됐고, 이 파일이 "사용자 노출 문자열의 단일 SoT" 를 표방하는 자리이므로 새로 이 파일을 여는 사람이 문체를 참고 삼아 복사하면 혼재가 더 퍼질 수 있다.
  - 제안: 이번 PR 스코프 밖 — 필요 시 별도 트래커에 "chatChannel 거부 메시지 문체 통일(해요체로)" 항목으로 등재.

- **[INFO]** `TriggersService`(1868줄)·`triggers.service.spec.ts`(3422줄) 파일 크기가 이번 diff 로 계속 증가한다(순증가는 서비스 파일 +19줄, 스펙 파일은 fixture 중복 제거로 실질 순증가가 크지 않음).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`, `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
  - 상세: 이번 diff 자체는 기존 throw 자리에 `code` 키 1개씩을 추가하는 국소 변경이라 새로 중첩·복잡도를 만들지 않았고, 오히려 스펙 쪽은 중복 fixture 를 `BLOCKED_FIELD_CASES` 하나로 합쳐 실질 중복을 줄였다. 파일 자체의 비대화는 이번 PR 이 원인이 아니며 `plan/in-progress/impl-details-code-wiring.md` 가 이미 "모듈 경계 추출(E)"을 후속 PR 로 명시적으로 분리해 뒀다 — 새 발견이 아니라 추적 상태 확인.
  - 제안: 처분 없음(추적 확인용 기록). 후속 PR(E) 착지 여부만 확인.

- **[INFO]** `it.each` fixture 중복 제거가 "중복 제거"에 그치지 않고 **fixture 완전성 자체를 단언하는 캐너리**(`[A] fixture 가 차단 5필드 전체를 덮는다`)를 함께 추가한 점이 눈에 띄게 좋다 — 단순 리팩터가 아니라 6번째 차단 필드가 생겼을 때 fixture 가 조용히 뒤처지는 것까지 막는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (`BLOCKED_FIELD_CASES` 선언부 및 바로 아래 `it('[A] fixture 가 차단 5필드 전체를 덮는다', ...)`)
  - 상세: 이는 결함이 아니라 양성 관찰이다 — 직전 라운드 WARNING(“중복 제거”)에 대한 수정이 표면적 리팩터에 그치지 않고, 재발 방지 테스트까지 갖췄다는 점을 기록해 둔다.
  - 제안: 없음.

## 확인했으나 문제 없음 (직전 라운드 WARNING 재검증)

- **fixture 중복(직전 WARNING)** — `triggers.service.spec.ts` 의 두 `it.each` 가 이제 `BLOCKED_FIELD_CASES` 하나를 공유한다(git diff 로 직접 확인). 해소됨.
- **canonical `ErrorCode` 미재사용(직전 WARNING)** — `triggers.service.ts` 13곳은 `ErrorCode.INVALID_FIELD` import 로 치환됐다. `password.util.ts` 2곳만 리터럴로 남았는데, `common/**` 이 `nodes/**` 를 import 하는 선례가 0건이고 같은 층의 `common/pipes/validation.pipe.ts` 도 리터럴을 쓴다는 근거(주석 + 커밋 메시지에 실측 수치 명시)가 있어, "15곳 전수 치환" 이 아니라 "층을 봐서 가른" 판단이 오히려 더 정확하다 — 층 경계를 거스르지 않았다.
- **존재하지 않는 스펙 파일 인용(직전 WARNING)** — `chat-channel-rejection-messages.const.ts` 헤더 주석이 이제 `trigger-dto-validation.spec.ts`/`triggers.service.spec.ts` 의 실제 `[등가성]` 테스트 위치를 정확히 가리킨다(전용 spec 파일이 없다는 것도 명시).
- **`CHANGELOG.md` 미기록(직전 WARNING)** — `## Unreleased — 거부 사유가 사람만 읽을 수 있었다 …` 항목이 추가돼 해소됐다.
- **`CHAT_CHANNEL_BLOCKED_FIELDS`/`..._MESSAGES` 편도 동기화(직전 architecture INFO)** — `satisfies` 방식에서 `Record<ChatChannelBlockedField, string>` 방식으로 바뀌어 배열↔객체 양방향 컴파일 타임 동기화가 강제된다. 해소됨.
- **e2e 5곳 동일 주석 중복(직전 INFO)** — 파일 상단에 배경 설명을 한 번만 두고 각 `it()` 자리는 "파일 상단 주석 참조" 한 줄 앵커로 줄었다. 해소됨.
- **`[등가성]` 파이프 테스트가 길이 미단언(직전 INFO)** — `expect(res?.details).toHaveLength(1)` 이 추가됐다. 해소됨.
- **공백 전용 문자열 경계 미문서화(직전 INFO)** — `[C]` 테스트 JSDoc 에 "공백 전용은 이 가드가 막지 못한다" 문단이 추가됐다. 해소됨.

## 요약

이번 세션의 diff 는 새 기능이 아니라 **직전 리뷰 라운드가 지적한 WARNING 4건 + 저비용 INFO 다수를 정확히 겨냥해 닫은 fix 커밋**이다. 각 수정이 표면적 패치에 그치지 않고 근거(층별 import 선례 실측, fixture 완전성 캐너리, 존재 확인된 테스트 위치 인용)를 남겨, "고쳤다고 주장" 이 아니라 "고친 근거를 검증 가능하게" 남기는 이 저장소의 관례를 잘 따른다. 새로 도입된 코드(신규 `.const.ts` 파일, `triggers.service.ts` 의 `details` 객체 리터럴 확장, 두 `it.each` 통합)는 함수 길이·중첩·순환 복잡도 어느 축에서도 새 부채를 만들지 않았고, 네이밍·파일 명명 규칙도 기존 컨벤션(`*.const.ts`, `SCREAMING_SNAKE_CASE` 상수, `PascalCase` 타입)과 일치한다. 남은 항목은 모두 이 PR 이전부터 있던 pre-existing 문체 혼재와, 이미 별도 후속 PR 로 분리·추적 중인 `TriggersService` 비대화뿐이며 둘 다 INFO 수준으로 병합을 막을 사안이 아니다.

## 위험도

NONE
