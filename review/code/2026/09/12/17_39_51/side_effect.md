# 부작용(Side Effect) 리뷰 — chat-channel-input-rules 구조 정리 + rotateBotToken swagger 보강 (라운드 5)

## 검증 방법

이 세션에서 `side_effect` 관점은 이미 3라운드 연속 독립 검토했다(`16_17_57`·`16_39_18`·`17_23_34`,
모두 CRITICAL/WARNING 없이 NONE). 이번 라운드(`17_39_51`)에서 실제로 새로 볼 것이 있는지부터
확인했다.

- `git log --oneline -3`: 직전 리뷰(`17_23_34`) 이후 신규 커밋은 `01f03524c` (`docs(triggers):
  내가 새로 넣은 bare 인용 5곳을 전체 경로로`) 하나뿐.
- `git show 01f03524c -- codebase/` 로 그 커밋이 건드린 코드 파일 3개(`chat-channel-input-rules.spec.ts`
  · `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` · `triggers.service.ts`)의 diff를
  직접 열람 — **전부 JSDoc/`//` 주석 안의 인용 문자열**(`` `/ai-review` `16_17_57` `` →
  `` `review/code/2026/09/12/16_17_57` `` 형태 5곳)뿐이고, 실행 코드·타입·테스트 단언 어디에도
  변경이 없다. 부작용 관점에서 논할 대상이 아니다.
- 그래도 누적 diff 전체(`git diff origin/main..HEAD -- codebase/`, 13개 파일, `+521/-104`)를 다시
  스캔해 이전 라운드들이 놓친 것이 없는지 재확인했다: `process\.env` · `fetch\(|axios|http\.request`
  · `writeFileSync|appendFileSync|unlinkSync|mkdirSync|rmSync` · `global\.|globalThis\.` ·
  `\.emit\(|EventEmitter` 패턴 전부 **0건**.
- `git status --short` — 이 리뷰 자신의 출력 디렉터리(`review/code/2026/09/12/17_39_51/`) 외에
  워킹트리에 남은 변경 없음. 저장소 파일은 조회만 했고 뮤테이션·원복 대상 없음.

## 발견사항

없음. (이번 라운드의 유일한 코드 변경은 주석 안 인용 표기 수정이며, 이전 세 라운드가 이미 검증한
누적 diff(헬퍼 추출, `rotateBotToken` DTO 화, repo-guard 신설)에 대해서도 재검증 결과 새로운
관측 사항이 없다.)

## 참고 — 이전 라운드가 이미 확정한 판정 (재검증만, 반복 기재 안 함)

- 컨트롤러/서비스 반환 타입 애노테이션 변경(`Promise<Awaited<ReturnType<...>>>` → DTO,
  `botIdentity` 리터럴 → `NonNullable<ChatChannelConfig['botIdentity']>`)은 타입 레벨 전용이며
  런타임 반환 객체·호출자 영향 없음 — 이번 라운드에서도 해당 3줄은 변경되지 않았다(`01f03524c`
  는 그 옆의 주석 한 줄만 바꿨다).
  - `triggers.service.ts:995` 근방(`botIdentity: NonNullable<ChatChannelConfig['botIdentity']> | null;`)
- `throwInvalidField`/`hasField`/`rejectBlockedField` 세 헬퍼는 여전히 module-private(`export`
  없음)이고, `env`/전역 변수/네트워크/이벤트 콜백을 건드리지 않는 순수 함수 + `throw` 뿐이다.
- 신규 repo-guard(`dto-class-name-collision-guard.ts`)는 `fs.readFileSync` **읽기 전용**이며
  스캔 루트가 `modules/`·`common/` 로 유계, 어떤 파일도 쓰거나 지우지 않는다.
- 신규 응답 DTO(`dto/responses/chat-channel-rotate-bot-token-response.dto.ts`)가 OpenAPI 스키마에
  새 항목을 등록하는 것은 additive-only이고, 라운드 1의 클래스명 충돌 CRITICAL 은 라운드 2 개명
  으로 해소되고 라운드 3에서 도입된 repo-guard 가 재발을 정적으로 고정한다.

## 검증 메모

저장소 파일은 `git show`/`git diff`/`grep` 으로만 조회했다. 뮤테이션을 가하지 않았으므로 원복
대상 없음. 리뷰 시작·종료 시점 모두 `git status --short` 는 본 리뷰의 출력 디렉터리만 보였다 —
이전 라운드들이 반복 관측했던 공유 워크트리 뮤테이션 잔여물(`hasField` truthy 뮤턴트)은 이번
라운드에는 관측되지 않았다.

## 요약

이번 라운드(`17_39_51`)의 실제 코드 델타는 이전 라운드(`17_23_34`)의 WARNING(bare `hh_mm_ss`
인용 표기)을 조치한 주석 문자열 5곳뿐이며, 실행 동작·타입·테스트에 영향이 없다. 누적 diff
전체에 대해서도 `process.env`·네트워크 호출·전역 상태 변경·이벤트/콜백 도입 패턴을 재스캔한
결과 0건이고, 시그니처가 바뀐 두 자리(컨트롤러 반환 타입, 서비스 `botIdentity` 필드 타입)는
모두 타입 레벨 전용으로 런타임·호출자 영향이 없음을 이전 라운드가 SoT 타입과 직접 대조해
확인했고 이번 라운드에서도 그 코드는 불변임을 재확인했다. 부작용 관점에서 이 세션은 수렴
상태다.

## 위험도

NONE
