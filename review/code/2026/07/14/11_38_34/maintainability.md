# 유지보수성(Maintainability) 리뷰

대상: F-5 MarkdownV2 로직의 shared 모듈 단일화, F-4 orphan JSDoc 원위치, 테스트 보강
(commit 42dbd387b)

## 발견사항

- **[INFO]** shared 상수(`MARKDOWN_V2_SPECIAL_CHARS`)가 실제로는 두 소비자 중 한쪽에만 연결됨 — "단일화"가 부분적
  - 위치: `codebase/backend/src/modules/chat-channel/shared/markdown-v2.ts:154-165` (JSDoc) vs
    `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts:27`
  - 상세: `markdown-v2.ts`의 JSDoc은 "이 집합은 두 곳에서 필요하다 ... 여기 단일 정의하고 양쪽이 import 한다"고
    명시하지만, 실제로 import 하는 곳은 `chat-channel-config.dto.ts`(`LanguageHintsRawSendValidator`) 뿐이다.
    `telegram-message.renderer.ts`의 `MD_V2_ESCAPE_REGEX = /([_*[\]()~\`>#+\-=|{}.!])/g`는 여전히 문자
    집합을 리터럴로 독립 보유하며 `MARKDOWN_V2_SPECIAL_CHARS`를 import 하지 않는다. 즉 "동일 문자 집합"의
    소스가 코드 구조상으로는 여전히 두 곳(리터럴 정규식 vs export 상수)이고, 일치 여부는 구조적 강제가 아니라
    `markdown-v2.spec.ts`의 계약 테스트(런타임 회귀 가드)로만 보증된다. 커밋 메시지("renderer escape 집합과의
    drift 는 계약 테스트로 잠금")와 spec 문서 양쪽에 이 잔여 gap이 명시돼 있어 인지된 트레이드오프로 보이지만,
    JSDoc 문구("양쪽이 import 한다")가 실제 구현보다 과장되어 있어 향후 독자가 renderer도 이미 import 중이라고
    오인할 수 있다.
  - 제안: JSDoc 문구를 "현재는 DTO 검증만 import, renderer는 계약 테스트로만 동기화됨(구조적 단일화 미완)"처럼
    현재 상태에 맞게 정정하거나, 후속 작업으로 renderer도 `MARKDOWN_V2_SPECIAL_CHARS`를 소스로 정규식을
    생성하도록(`new RegExp(...)`) 완전히 단일화할 것을 백로그로 남길 것.

- **[INFO]** 신규 함수 네이밍이 같은 파일 컨벤션과 미묘하게 어긋남
  - 위치: `codebase/backend/src/modules/chat-channel/shared/markdown-v2.ts:178` (`firstUnescapedMarkdownV2Special`)
    vs `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` 내 `findFirstUnsafeRawSendHint`,
    `findFirstUnknownPlaceholder`
  - 상세: 같은 모듈/도메인 내에서 "첫 번째 매치를 찾는" 함수들은 기존에 `findFirstX` 접두사 컨벤션을 쓰고 있다.
    신규 shared 함수는 `find` 없이 `firstX`로 명명되어 있어 로컬 컨벤션과 미묘히 다르다. 반환 타입도 다르므로
    (`string | null` vs `{field, char} | null`) 의도적 구분일 수 있으나, 컨벤션 일관성 관점에서는 사소한 흔들림.
  - 제안: 우선순위는 낮음 — 실질적 혼동 위험은 적으나, 신규 shared 유틸 명명 시 동일 파일군 내 기존
    `findFirst*` 패턴과의 정렬을 한번 검토 권장.

- **[INFO]** F-4 orphan JSDoc 정정은 원인 문서화 없이 결과만 반영
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:977-1007`
  - 상세: 이전 리팩터(`sendBestEffortNotice` 추출)가 `sendExecutionStillRunningNotice`의 JSDoc을
    `sendBestEffortNotice` 위로 잘못 끌고 올라간 상태였던 것을 이번 diff가 원위치시켰다. 수정 자체는 정확하고
    (재확인 결과 현재 각 JSDoc이 올바른 함수 바로 위에 위치, dangling 없음) 커밋 메시지에도 "F-4 리팩터 orphan
    JSDoc" 으로 원인이 기록돼 있어 추적성은 확보됨. 코드 자체에는 재발 방지 코멘트가 없지만, 이 정도 규모의
    단순 위치 오류는 별도 가드가 필요할 정도는 아니라 판단.
  - 제안: 없음(참고용 기록).

- **[INFO]** DTO 쪽 코드 축소는 순수한 개선
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:167-183` (diff)
  - 상세: 로컬 재선언이던 `MD_V2_SPECIAL_CHARS` / `MD_V2_ESCAPE_PAIR` / `firstUnescapedMdV2Special`(regex 기반,
    연속 backslash 우회 버그 보유)가 제거되고 shared 함수 import로 대체되어 중복 코드가 순감소했다(-11줄,
    +1 import). 호출부에 shared SoT 참조 이유를 설명하는 주석도 추가되어 가독성 저하 없음.
  - 제안: 없음(긍정적 변경, 별도 조치 불필요).

- **[INFO]** 신규 테스트의 가독성/구조는 기존 컨벤션과 일치
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:2013-2286`(F-6),
    `codebase/backend/src/modules/hooks/hooks.service.spec.ts:625-671`(F-4),
    `codebase/backend/src/modules/chat-channel/shared/markdown-v2.spec.ts`(F-5)
  - 상세: `F-N — <설명>` 접두사, `rejects.toBeInstanceOf(...)` 패턴, 회귀 배경을 설명하는 한글 주석 등 기존
    파일의 스타일을 그대로 따른다. `markdown-v2.spec.ts`는 "연속 backslash 우회" 케이스를 별도로 명시해 회귀
    의도를 명확히 남겼고, "SoT drift 가드" describe 블록은 shared 상수와 renderer 구현 간 계약을 문자 단위로
    순회 검증해 향후 문자 집합 변경 시 양쪽 불일치를 잡아낼 수 있다 — 위 첫 항목에서 지적한 구조적 미단일화의
    실질적 완화책으로 유효하게 작동한다.
  - 제안: 없음.

## 요약

이번 델타는 유지보수성 관점에서 대체로 긍정적이다. F-5는 3곳(정확히는 DTO 검증부 1곳)에 흩어져 있던
MarkdownV2 특수문자 검출 로직 중 리터럴 재선언 하나를 제거하고 계약 테스트로 잠근 shared 모듈로
치환했으며, 함수 자체(`firstUnescapedMarkdownV2Special`)는 짧고 읽기 쉽고 backslash-toggle 의미론을
정확히 문서화한다. 다만 shared 모듈 JSDoc이 주장하는 "두 소비자 모두 import"는 실제로는 한쪽(DTO)만
해당하며 renderer는 여전히 독립 리터럴 정규식을 쓰고 있어, "단일화"라는 표현이 코드의 실제 구조보다
다소 과장돼 있다(런타임 계약 테스트가 이를 보완하지만 구조적 SoT는 아님). F-4의 orphan JSDoc 정정은
정확하고 깔끔하게 반영됐고, 신규 테스트들은 기존 파일들의 네이밍·구조 컨벤션을 잘 따른다. 함수 길이·
중첩 깊이·순환 복잡도·매직 넘버 등 다른 항목에서는 문제되는 지점이 없다.

## 위험도

LOW
