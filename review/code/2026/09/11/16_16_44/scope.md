# 변경 범위(Scope) 리뷰

## 검토 범위와 방법

프롬프트 번들은 47개 파일을 나열하지만 실제 코드는 3개(`chat-channel-input-rules.spec.ts`(신규) ·
`chat-channel-input-rules.ts`(신규) · `triggers.service.ts`)뿐이고, 나머지는 plan 문서 2개
(`impl-chat-channel-binder.md`(신규) · `spec-draft-nullable-notation-followups.md`(트래커 추가))와
이전 두 라운드(`15_31_54`, `15_57_42`)의 `/ai-review` 산출물 + `14_59_33` consistency-check
산출물이다. `git diff origin/main --stat` 로 실측하니 정확히 이 47개 파일과 일치했다(추가 파일
없음, 누락 없음).

- `git show <commit> --stat` 으로 `2ae81077c`(T1 이동) · `6dc2b7d60`(트래커 등재 + 전용 spec) ·
  `81d2a8c18`(뮤테이션 커버리지 보강) 세 커밋 각각의 diff 범위를 확인.
- `git diff origin/main -- .../chat-channel-input-rules.ts` 와 `git show origin/main:.../triggers.service.ts`
  의 구 `assertChatChannelInputSafe` 본문을 나란히 대조 — **로직 델타 0** 을 직접 확인했다(아래
  "검증용 뮤테이션" 절 참고, 대조 중 일시적으로 다른 결론에 도달했다가 재확인으로 정정한 경위 포함).
- `chat-channel-input-rules.spec.ts` 전문을 읽어 새 테스트가 이동된 6개 함수만 exercise 하는지 확인.
- `plan/in-progress/impl-chat-channel-binder.md` 전문과 `spec-draft-nullable-notation-followups.md`
  의 diff 를 읽어 이번 커밋 범위(T1)와 다음 단계(T2)·SPEC-DRIFT 항목의 경계가 문서상으로도
  일치하는지 확인.

## 검증용 뮤테이션 — 저장소 오염 관측 (즉시 보고 의무)

저장소에 아무것도 쓰지 않고 `Read`/`git show`/`git diff` 만 사용했다. 그런데 리뷰 도중
`git status --short` 를 반복 실행하며 **다른 병렬 reviewer 가 공유 워킹트리를 뮤테이션하는
것을 관측**했다:

1. 최초 관측 시점 `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 가
   `assertChatChannelInputSafe` 내부 세 개의 내부-필드 차단(`botTokenRef`/`inboundSigningRef`/
   `inboundSigning`)에 `mode === 'create' &&` 조건을 추가한 상태로 나타났다 — 이 조건이 실제로
   들어가면 PATCH(update) 경로에서 그 세 필드 차단이 **전부 무력화**되는 실질적 동작 변화다.
2. 몇 초 뒤 재확인하니 그 변형은 사라지고 `git status --short` 가 clean 이었다.
3. 다시 확인하니 이번엔 같은 파일의 `assertChatChannelAlreadySetUp` 에서
   `if (incoming.provider && incoming.provider !== current.provider)` 의 `incoming.provider &&`
   가 제거된 1-line 변형이 나타났다(`git diff` 로 정확히 이 hunk 하나만 확인).
4. 리포트 작성 시점 `git status --short` 는 `chat-channel-input-rules.spec.ts` ·
   `chat-channel-input-rules.ts` **두 파일이 modified** 상태다 — 세션이 끝나지 않았다.

**이 관측은 이번 커밋(HEAD, `81d2a8c18`)이 실제로 커밋한 내용과 무관하다** — 전부 `git status`
상 uncommitted 변경이었고, `git show HEAD:<path>` 로 조회한 커밋된 파일 내용은 시종 위 세 필드
체크에 `mode` 조건이 없는(= 이동 전과 동일한) 상태였다. 아래 스코프 판정은 이 오염을 배제하고
**커밋된 diff**(`origin/main..HEAD`)만 근거로 한다. 다만 프로토콜에 따라 이상 상태 자체는
숨기지 않고 보고한다 — 다른 reviewer 가 뮤테이션을 원복하지 않은 채 세션을 마치면 다음 사람이
이 잔여물을 실제 결함으로 오인할 수 있다.

## 발견사항

이번 커밋 범위(`origin/main..HEAD`, 코드 3파일)에서 **스코프 이탈은 발견되지 않았다.**

- **[INFO]** `chat-channel-input-rules.ts` 는 커밋 메시지·plan 이 주장하는 그대로 순수 이동이다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`(신규 전체) ·
    `codebase/backend/src/modules/triggers/triggers.service.ts`(제거된 6개 메서드 자리)
  - 상세: 이동 전(`origin/main` 의 `TriggersService` private 메서드)과 이동 후(신규 파일의
    `export function`)의 함수 본문을 줄 단위로 대조했다 — `private` → `export function` 전환과
    `this.` 제거를 제외하면 조건문·정규식·에러 payload·주석까지 바이트 단위로 동일하다.
    `triggers.service.ts` 의 diff 도 (a) 6개 메서드 삭제, (b) 그 자리를 대체하는 import 6줄,
    (c) 7개 호출부의 `this.foo(...)` → `foo(...)` 치환 세 종류로만 구성된다 — 추가 리팩터·
    조건 변경·순서 변경은 없다.
  - 제안: 없음.

- **[INFO]** 신규 전용 단위 테스트(`chat-channel-input-rules.spec.ts`)는 이동된 6개 함수만
  exercise — 인접 기능 확장 아님
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` 전체
  - 상세: import 는 `chat-channel-input-rules`(이동된 6개 함수) · 상수 파일 ·
    DTO/엔티티 타입 3개뿐이고, 각 `describe`/`it.each` 블록은 그 6개 함수의 분기(내부 필드
    차단·PATCH 비밀 차단·provider 분기·에러 변환 캐너리)만 다룬다. plan 문서(`impl-chat-channel-binder.md`
    "왜 이 턴인가")가 "이 파일이 이 추출의 두 번째 동기다" 라고 명시한 목적과 정확히 일치하며,
    이동과 무관한 신규 기능·API 추가는 없다.
  - 제안: 없음.

- **[INFO]** 후속 커밋들(`6dc2b7d60`, `81d2a8c18`)이 리뷰 발견을 코드로 흡수하지 않고
  트래커로 분리한 스코프 규율
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:2523-2561`(신규 3항목:
    SPEC-DRIFT · discord verify_key 502 캐너리 · 구조 정리 6건)
  - 상세: 라운드 1(`15_31_54`) architecture/documentation/maintainability 리뷰가 지적한
    "구조 정리 6건"(에러 봉투 헬퍼화·매직넘버·이중 캐스팅·파일 책임 경계 등)을 **이번 PR 에서
    고치지 않고** 트래커에 명시적으로 등재해 뒤로 미뤘다. "동작 보존" 이라는 이 PR 의 유일한
    주장을 지키기 위한 의도적 스코프 좁히기이며, 리팩터 중 눈에 띄는 인접 개선을 즉흥적으로
    끼워넣지 않았다는 점에서 스코프 관점 모범 사례다. 반면 W1(대칭 필드 누락)·W2(정규식 스왑
    미검출)·W3(discord verify_key 502) 는 **테스트 커버리지/캐너리** 성격이라 이동된 코드
    자체의 정확성 확인에 해당해 이번 PR 범위 내로 처리한 것도 합리적 경계다.
  - 제안: 없음 — 참고 기록.

- **[INFO]** plan 문서(`impl-chat-channel-binder.md`)가 철회한 처방을 취소선으로 남기고
  체크리스트를 실제 상태로 갱신
  - 위치: `plan/in-progress/impl-chat-channel-binder.md:93-98`(취소선 처리된 "얇은 delegator"
    처방) · `:159-165`(체크리스트, T1 항목 체크·T2 는 취소선 + "범위 밖" 명시)
  - 상세: 직전 라운드(`15_31_54`) scope/documentation 리뷰가 지적한 "plan 서술과 실제 코드
    불일치"·"완료 단계 미체크"가 이번 커밋 범위에서 정정돼 있다 — 원문은 지우지 않고 취소선
    + 철회 사유를 옆에 적었고, T1 체크박스는 실측 근거(`git diff --numstat` = 0)와 함께
    체크됐으며 T2 는 "이 PR 범위 밖" 으로 명시적으로 갈렸다. 이는 스코프 경계를 문서에도
    정확히 반영한 것으로 코드 변경 자체는 아니지만 스코프 관점에서 긍정적 신호다.
  - 제안: 없음.

## 스코프 밖으로 보이나 실제로는 이 작업의 필수 절차인 항목 (참고용)

- `review/code/2026/09/11/{15_31_54,15_57_42}/**`(25개 파일) · `review/consistency/2026/09/11/14_59_33/**`
  (8개 파일)는 코드 diff 가 아니라 이 프로젝트 규약(`--impl-prep` consistency-check 의무,
  구현 완료 후 `/ai-review` 강제)이 요구하는 산출물이 그대로 커밋된 것이다. `chat-channel-input-rules.ts`·
  `triggers.service.ts`·plan 문서와 무관한 별도 관심사를 끌어들인 것이 아니라, 이 작업 자체의
  실행 이력이므로 "무관한 파일 수정"에 해당하지 않는다.

## 확인했으나 문제 없음

- 포맷팅/줄바꿈만 바뀐 hunk, 사용하지 않는 신규 import, 의도치 않은 설정 파일(`package.json`·
  tsconfig·eslint 등) 변경은 `git diff origin/main --stat` 전수 확인 결과 없음.
- `chat-channel-input-rules.ts` 가 import 하는 5개 모듈(`@nestjs/common` · 내부 3개 ·
  `@workflow/chat-channel-validation`)은 전부 `triggers.service.ts` 가 이동 전부터 쓰던 것을
  그대로 옮긴 것으로, 신규 의존성 추가가 아니다.

## 요약

커밋된 diff(`origin/main..HEAD`, 3개 커밋)는 plan 문서와 커밋 메시지가 주장하는 범위 — `TriggersService`
의 chat-channel 입력 검증 6개 함수를 신규 모듈로 순수 이동하고 전용 단위 테스트를 붙이는 것 —
를 정확히 지킨다. 이동 전후 함수 본문을 줄 단위로 대조해 로직 델타 0을 확인했고, 리뷰가 발견한
비차단 구조 정리 항목들은 코드에 즉흥적으로 반영하지 않고 durable 트래커로 분리해 스코프를
좁게 유지했다. 유일하게 보고할 사항은 코드 자체의 스코프 결함이 아니라 **리뷰 세션 도중 다른
병렬 reviewer 가 같은 파일에 두 차례 뮤테이션을 남긴 채 아직 정리하지 않은** 워킹트리 오염이다
— 커밋된 상태와는 무관하지만, 세션 종료 후에도 uncommitted 상태로 남으면 다음 사람이 실제
결함으로 오인할 수 있어 기록해 둔다.

## 위험도

NONE
