# 유지보수성(Maintainability) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강 (라운드 5)

## 검토 방법

이 세션은 이미 4라운드(`16_17_57` → `16_39_18` → `17_02_19` → `17_23_34`)를 거쳤고, 매 라운드
maintainability reviewer 가 독립적으로 훑어 LOW 수준 INFO 만 남긴 상태다. 직전 라운드(`17_23_34`)
이후 `codebase/**` 에 추가된 유일한 커밋(`01f03524c`)은 리뷰 인용 5곳을 bare `hh_mm_ss` 에서
전체 경로로 바꾼 **주석 전용** 수정이다(`git show 01f03524c --stat` 로 확인 — 로직 변경 0줄).
따라서 이번 라운드는 새로 볼 코드 델타가 없고, 13개 애플리케이션/테스트/가드 파일 전체를 `Read` 로
직접 재확인해 이전 라운드 판정에 회귀나 누락이 없는지 독립 검증했다.

저장소 파일은 조회만 했다 — `git status --short` 결과 이 리뷰 산출물 디렉터리 외 변경 없음, 원복 불필요.

## 발견사항

- **[INFO]** `throwInvalidField(field: string, message: string)` 의 `field` 가 넓은 `string` 이라, `rejectBlockedField` 를 경유하지 않고 리터럴을 직접 넘기는 6개 호출부는 `ChatChannelBlockedField` 유니언이 주는 오타-컴파일에러 보호를 못 받는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:56`(선언), 직접 호출부 `:205-207`(`'chatChannel'`), `:222-226`(`'provider'`), `:270-273`·`:284-287`·`:293-297`·`:300-304`(`'inboundSigningPlaintext'` 리터럴 4회 반복).
  - 상세: `rejectBlockedField` 는 인자를 `ChatChannelBlockedField` 로 좁혀 "필드명을 한 번만 쓴다" 는 목표를 달성했지만, `assertChatChannelAlreadySetUp`·`assertInboundSigningPlaintextByProvider` 는 저수준 헬퍼를 직접 불러 그 보호 밖에 있다. 각 호출부에 `details.field` 를 단언하는 테스트가 붙어 있어(`chat-channel-input-rules.spec.ts`) 오타는 런타임에 곧바로 RED 로 드러나므로 실제 회귀 위험은 낮다. 이 항목은 라운드 1~4 전부에서 동일하게 관찰·이월됐다(재발 아님).
  - 제안: 이번 라운드도 즉시 조치 불요. 호출부가 더 늘거나 실제 오탐이 나면 `field: ChatChannelBlockedField | 'chatChannel' | 'provider'` 로 좁히는 것을 고려.

- **[INFO]** 신규 `dto-class-name-collision-guard.ts` 의 AST 순회가 형제 가드와 스타일이 갈린다 — 최상위 statement 만 보고, `SRC_ROOT` 도 가드가 소유(export)하지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts:33`(`for (const stmt of source.statements)` — 비재귀), `dto-class-name-collision.spec.ts:42`(`const SRC_ROOT = path.resolve(__dirname, '..', '..');` — 가드 모듈에서 import 하지 않고 spec 이 직접 계산).
  - 상세: 같은 디렉터리의 `dto-jsdoc-citation-guard.ts` 는 `ts.forEachChild` 로 재귀 순회하고 `SRC_ROOT` 를 자신이 `export` 해 spec 이 import 하는 "한 곳이 소유" 패턴을 쓴다. 이번 신규 가드는 두 관례 모두 따르지 않는다. 실측으로는 무해하다 — `grep -rn "^\s\+export class" --include="*.dto.ts" codebase/backend/src` 0건으로 저장소의 모든 DTO 클래스가 최상위에 있고, 두 파일이 같은 디렉터리라 `SRC_ROOT` 값도 지금은 갈리지 않는다. 다만 이 가드의 존재 이유가 "정본 파서로 완전하게 세겠다"인데 그 완전성의 범위(최상위만)가 문서화돼 있지 않아, 형제 가드와 나란히 놓고 보면 "왜 여기만 다른가" 를 다음 사람이 되물어야 한다.
  - 제안: 급하지 않음. 스코프를 의도적으로 최상위로 고정할 것이면 JSDoc 에 그 범위를 명시하거나, 형제 가드처럼 재귀 순회 + `SRC_ROOT` export 로 통일.

- **[INFO]** `findDtoClassCollisions` 가 파일당 불변인 상대경로(`toPosixRelative`)를 그 파일의 클래스 수만큼 재계산한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts:54-58` (`for (const name of exportedClassNames(file)) { const rel = toPosixRelative(srcRoot, file); ... }`).
  - 상세: `rel` 은 `file` 에만 의존해 안쪽 루프 반복마다 동일한 값을 다시 계산한다. 114개 파일 규모에서 성능 영향은 없고 결과도 정확하지만, 바깥 루프로 옮기면 "이 값이 클래스마다 달라질 수 있나" 라는 순간의 오독을 없앨 수 있다.
  - 제안: 급하지 않음(순수 스타일). 다음에 이 함수를 만질 때 정리.

- **[INFO]** `chat-channel-input-rules.spec.ts` 에 동일한 `it.each([['null', null], ['빈 문자열', '']])` 골격이 필드만 바꿔 두 번 반복된다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts:94-106`(botToken) / `:108-125`(inboundSigningPlaintext).
  - 상세: 두 블록은 케이스 배열·기대 `code`(`INVALID_FIELD`) 구조가 동일하고 대상 필드명·`details.field` 값만 다르다. 필드 목록을 바깥 루프로 한 번 더 감싸 `it.each([['botToken', ...], ['inboundSigningPlaintext', ...]])` 형태로 합칠 수도 있으나, 현재 형태가 각 테스트 제목에 필드명을 그대로 노출해 실패 시 무엇이 깨졌는지 더 직접적으로 보인다는 트레이드오프가 있다. 이 항목은 라운드 3 RESOLUTION 이 "`it.each` 구조 중복" 으로 이미 이월 처리해 둔 항목과 같은 클래스다.
  - 제안: 조치 불요 — 가독성 vs 중복 제거의 트레이드오프이며 이미 트래커에 등재된 저위험 관찰.

## 확인했으나 문제 없음

- **`chat-channel-input-rules.ts` 8개 함수** — 각 함수가 단일 책임(봉투 생성/필드 존재 판정/차단-필드 조합/모드별 검증/이미-설정됨 판정/평문 제거/provider 분기/에러 변환)을 갖고, 최대 중첩은 2단(`if` 안 `if`), 순환 복잡도도 함수당 5 미만이다. `assertChatChannelInputSafe` 의 오버로드 선언 + 구현 시그니처 패턴은 `mode`/DTO 타입 짝을 컴파일 타임에 묶는 의도가 JSDoc 에 명시돼 있어 다음 사람이 왜 오버로드인지 재구성할 필요가 없다.
- **매직 넘버/문자열** — `'VALIDATION_ERROR'`·`ErrorCode.INVALID_FIELD` 는 헬퍼 하나(`throwInvalidField`)로 모여 11곳의 반복이 사라졌고, provider label 문자열(`'Slack signing secret'` 등)은 정규식·에러 메시지와 함께 `assertInboundSigningPlaintextByProvider` 한 곳에서만 정의돼 테스트가 그 값을 참조하는 것이지 별도로 하드코딩을 반복하지 않는다.
- **신규 응답 DTO(`chat-channel-rotate-bot-token-response.dto.ts`) 네이밍** — `ChatChannelRotateBotIdentityDto`/`ChatChannelRotateBotTokenDto` 는 기존 `ChatChannelConfigDto`(`ChatChannelBotIdentityDto`)와 이름이 겹치지 않고, 왜 합치지 않고 별도 클래스로 두는지 근거(입력 검증 DTO vs 응답 DTO, 필드 필수 여부 차이)가 파일 헤더에 남아 있다.
- **`dto-class-name-collision` 가드의 핵심 설계** — 정규식이 아니라 `typescript` AST 파서를 쓴 판단, 대조군(fixture 2종: 충돌 검출 + 정규식이었으면 오탐할 자리) 구성, `> 100` 하한 단언으로 vacuous 통과를 막은 점은 이 저장소가 반복 학습한 패턴을 그대로 따른다.
- **8개 애플리케이션 파일 회귀 없음** — 라운드 4 이후 유일한 커밋(`01f03524c`)이 주석(인용 경로)만 바꿨음을 `git show --stat` 로 직접 확인했고, 로직·타입·테스트 단언 어디에도 변화가 없다.

## 요약

라운드 4 이후 `codebase/**` 에 가해진 유일한 변경은 리뷰 인용 형식을 정정한 주석 5곳뿐이라, 이번
라운드에서 새로 발견된 CRITICAL/WARNING 급 유지보수성 결함은 없다. 8개 애플리케이션 파일은
헬퍼 추출(`throwInvalidField`/`hasField`/`rejectBlockedField`)로 11곳의 반복 에러 봉투 생성을
제거했고, 각 설계 판단(3번째 인자 생략 이유, `never` 반환 이유, 타입 좁히기로 오타를 컴파일
에러화한 이유)이 코드 주석에 근거와 함께 남아 다음 사람이 재발명할 필요가 없다. 함수 길이·중첩
깊이·순환 복잡도 모두 낮고 네이밍은 기존 컨벤션과 일치한다. 남은 관찰 사항은 4라운드 내내
동일하게 유예돼 온 저위험 INFO 4건(`throwInvalidField` 의 넓은 타이핑, 신규 가드의 비재귀
순회·`SRC_ROOT` 소유권 불일치, `rel` 재계산, `it.each` 구조 중복)뿐이며 전부 실측으로 현재
무해함이 확인돼 즉시 조치를 요하지 않는다.

## 위험도

LOW
