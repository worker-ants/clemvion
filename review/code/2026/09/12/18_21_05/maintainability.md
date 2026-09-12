# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `throwInvalidField(field: string, ...)` 저수준 헬퍼는 여전히 `field` 를 넓은 `string` 으로 받아, `rejectBlockedField` 를 경유하지 않는 6개 직접 호출부는 `ChatChannelBlockedField` 유니언이 주는 오타-컴파일에러 보호를 못 받는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:56`(선언), 직접 호출부 `:202`(`'chatChannel'`), `:220`(`'provider'`), `:267`·`:281`·`:291`·`:298`(`'inboundSigningPlaintext'` 리터럴 반복).
  - 상세: `rejectBlockedField`(`:85-92`)는 존재검사·에러메시지 키를 `ChatChannelBlockedField` 하나로 묶어 오타를 컴파일 에러로 만든다는 목표를 정확히 달성했지만, 그 아래 계층인 `throwInvalidField` 자체는 여전히 범용 `string` 이라 5개 차단필드 밖의 호출부(예: `'inboundSigningPlaintext'` 문자열이 4번 반복)는 여전히 손으로 맞춰 적는 옛 패턴이다. 이미 두 차례 이전 라운드(`review/code/2026/09/12/16_17_57`, `16_39_18`)에서 동일하게 지적되고 "재발 시 고려"로 유예된 항목이라 이번 diff 가 새로 만든 결함은 아니며, 각 호출부마다 `details.field` 를 단언하는 테스트가 있어 오타는 즉시 RED 로 드러난다.
  - 제안: 조치 불요(기존 유예 유지). 호출부가 더 늘거나 재발하면 `throwInvalidField<F extends string>` 또는 리터럴 유니언으로 좁히는 것을 고려.

- **[INFO]** 반환 타입 주석이 파라미터 목록 안, 마지막 인자 뒤·닫는 괄호 앞에 걸려 있어 처음 읽을 때 "무엇에 대한 설명인지"를 한 박자 늦게 알게 된다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:289-293` (`@CurrentUser('sub') userId: string,` 바로 다음 줄부터 `): Promise<ChatChannelRotateBotTokenDto> {` 사이).
  - 상세: 주석 3줄("반환 타입을 DTO 로 선언한다 …")은 실제로는 `Promise<ChatChannelRotateBotTokenDto>` 반환 타입 선택 이유를 설명하는데, 위치상 마지막 매개변수 `userId` 바로 아래에 붙어 있어 그 매개변수에 대한 주석처럼 보일 수 있다. 내용 자체는 정확하고 유용하다.
  - 제안: 급하지 않음. 다음 편집 때 함수 시그니처 위(JSDoc 블록 안) 또는 반환 타입 줄 바로 위 한 줄로 옮기면 오독 가능성이 줄어든다.

- **[INFO]** 신규 대조군 fixture 디렉터리 이름이 가드/스펙 이름과 한 단어(`name`) 차이가 난다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/dto-class-collision/` (디렉터리명) vs `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision.spec.ts` / `dto-class-name-collision-guard.ts` (파일명).
  - 상세: 저장소 관례는 `<guard-name>-guard.ts` + `<guard-name>.spec.ts` 페어인데(`dto-jsdoc-citation-guard.ts`/`dto-jsdoc-citation.spec.ts` 등 다수 선례), fixture 디렉터리는 공유 자원(`fixtures/dto/`)일 수도 있어 1:1 매칭이 강제는 아니다. 다만 이번 fixture 는 이 가드 전용(공유 아님)이라 `dto-class-name-collision`(전체 이름)이었다면 grep 만으로 소유 관계가 더 명확했을 것이다. 실제 혼동 사례는 없다(파일 3개뿐이고 헤더 주석이 소유 관계를 명시).
  - 제안: 조치 불요. 다음에 이 디렉터리를 다시 만질 일이 있으면 개명 고려.

- **[INFO]** `chat-channel-input-rules.ts`가 입력 검증과 출력 에러 변환(`translateSetupChannelError`)이라는 서로 다른 책임을 한 파일에 갖는 상태가 이번 diff 로 더 명시적으로 문서화됐다(새 결함은 아님).
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:34-42`(확장된 헤더 주석).
  - 상세: 파일명만 보면 출력측 함수가 여기 있다고 예상하기 어렵지만, 헤더 주석이 "왜 같이 사는가"와 "분리는 `§7 파일 트리` planner 축 결정과 함께"라는 조건을 명시적으로 남겨 다음 사람이 판단 근거를 재구성할 필요가 없다. 이미 이전 라운드들에서 조치 불요로 확정된 항목.
  - 제안: 없음.

## 요약

이번 라운드(6번째)의 diff 는 앞선 다섯 라운드의 지적(CRITICAL 1건·WARNING 다수)이 전부 해소된 상태에서의 최종 확인 지점이다. `chat-channel-input-rules.ts` 는 11곳의 반복되던 `VALIDATION_ERROR` 봉투 생성을 `throwInvalidField`/`hasField`/`rejectBlockedField` 세 헬퍼로 정확히 추출했고, 각 헬퍼가 왜 세 번째 인자를 안 두는지·왜 `never` 인지·왜 유니언 타입을 강제하는지를 근거와 함께 남겨 재발명을 막는다. 신규 `dto-class-name-collision-guard.ts`/`.spec.ts` 는 기존 형제 가드(`dto-jsdoc-citation`)와 정확히 같은 파일 페어링·명명 관례를 따르고, AST 기반 판정·대조군 fixture·vacuous 방지 단언을 모두 갖춰 품질이 높다. `triggers.controller.ts`/`triggers.service.ts` 의 반환 타입을 손으로 두 번 적지 않고 서비스 타입을 그대로 참조하도록 바꾼 것도 "형태를 한 곳에서만 선언한다"는 이 PR 전체의 일관된 원칙을 따른다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮고 네이밍은 기존 컨벤션(`throwXxx`/`assertXxx`/`-guard.ts`+`.spec.ts`)과 일치한다. 남은 관찰 사항은 전부 INFO 수준이며 그중 다수는 이미 이전 라운드에서 검토되고 조치 불요로 확정된 항목의 연속이다. CRITICAL/WARNING 없음.

## 위험도
NONE
