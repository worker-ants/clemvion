# 변경 범위(Scope) 리뷰

## 검증 방법

프롬프트에 실린 diff/파일 목록(17개)을 `git show --stat 0710021f0` · `git show 0710021f0 -- <file>` 로
실제 커밋과 전수 대조했다. 파일 수·변경 라인 수·diff 내용이 프롬프트와 정확히 일치한다 — 프롬프트에
없는 숨은 변경이나, 프롬프트에는 있으나 실제 커밋에 없는 변경은 없다. `plan/in-progress/impl-details-code-wiring.md`
가 이 PR 의 스코프를 A/B/C/D 4건으로 명시하고 5번째(E: `TriggersService` 모듈 경계 추출)를 후속 PR 로
명시적으로 분리했으므로, 이를 기준선으로 각 파일 변경이 그 4건 안에 드는지 대조했다.

## 발견사항

- **[INFO]** 서로 다른 성격의 4개 항목(A: 응답 payload 필드 추가, B: 주석 인용 정정, C: 검증 규칙
  강화, D: 문자열 리터럴 상수화)이 한 커밋에 번들되어 있다.
  - 위치: 커밋 `0710021f0` 전체 (특히 `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
    의 `@MinLength(1)` 추가 부분과, 같은 파일의 `swagger.md` 인용 정정 부분이 인접해 섞여 있음)
  - 상세: A(15자리 `code` 배선)·D(메시지 상수화)는 같은 규약(§5.3, R-CC-21 등가성)에서 파생된 밀접한
    쌍이라 자연스럽지만, C(`@MinLength(1)` — 실질적인 검증 확대로 이제 `botToken: ''` 요청이 거부됨)는
    별도의 동작 변경이고, B(주석의 줄-번호 인용을 절 제목으로 바꾸는 것)는 코드 동작과 무관한 문서성
    수정이다. 다만 이 번들링은 우발적이지 않다 — `plan/in-progress/impl-details-code-wiring.md` 가
    시작 시점부터 A/B/C/D 를 "같은 트래커(`spec-draft-nullable-notation-followups.md`)의 항목들을
    한 PR 에서 닫는다"고 명시했고, `/consistency-check --impl-prep`(`10_28_52`, BLOCK:NO)이 이 4건
    묶음 자체를 사전 검토해 통과시켰다. E(모듈 경계 추출)만 별도 PR 로 분리한 근거("이동+변경이 섞이면
    리뷰가 동작 델타를 분리할 수 없다")가 diff 에서도 실측된다 — `triggers.service.ts` diff 전체를
    확인한 결과 함수/클래스 이동은 전혀 없고 기존 `throw` 자리의 `message`/`details` 리터럴만
    치환됐다.
  - 제안: 없음(사전 계획·게이트를 통과한 의도된 번들). 향후 유사 사례에서 A(payload 계약 변경)·
    C(검증 강화, 동작 회귀 가능성)를 B(주석)·D(순수 리팩토링)와 분리하면 리뷰 가독성이 더 좋아질 수
    있다는 참고용 기록.

- **[INFO]** `review/consistency/2026/09/11/10_28_52/**` 8개 파일(SUMMARY·`_retry_state.json`·
  `meta.json`·5개 checker 출력)이 이 커밋에 함께 포함됐다.
  - 위치: `review/consistency/2026/09/11/10_28_52/*`
  - 상세: `CLAUDE.md` 워크플로 규약상 `developer` 는 구현 착수 직전 `/consistency-check --impl-prep`
    을 의무적으로 실행하고 그 산출물은 `review/consistency/**`(developer 쓰기 권한 영역)에 남는다.
    코드 변경과 무관해 보일 수 있으나 실은 이 PR 착수를 승인한 게이트의 증거물이라 스코프 이탈이
    아니다.
  - 제안: 없음.

## 스코프 안에 있음을 확인한 항목 (기록용)

- 15자리 `code: 'INVALID_FIELD'` 배선(`triggers.service.ts` 13곳 + `password.util.ts` 2곳)이 plan
  §A 표·커밋 본문의 "15자리" 서술과 정확히 일치. `rethrowEndpointPathConflict`(이미 도메인 코드
  보유)와 `field` 없는 6개 진단 payload(`{errors}`·`{offenders}`·`{reason}`)는 의도적으로 미변경 —
  실제 diff 에도 해당 자리들은 건드려지지 않았다.
- `chat-channel-rejection-messages.const.ts` 신규 파일이 정확히 plan §D 가 실측한 5필드
  (`botTokenRef`·`inboundSigningRef`·`inboundSigning`·`botToken`·`inboundSigningPlaintext`)만
  다룬다 — 그 이상의 리터럴을 흡수하지 않았다.
- `chat-channel-config.dto.ts` 의 `@MinLength(1)` 추가는 plan §C 가 실측한 정확히 그 필드
  (`botToken`)에만 적용됐고, 같은 파일의 다른 필드(`inboundSigningPlaintext` 등)는 손대지 않았다.
- 테스트 파일(1,5,6,8번)의 신규 `it`/`it.each` 는 전부 A·C·D 를 검증하는 캐너리이고, 무관한 기존
  테스트 케이스의 로직 변경이나 삭제는 없다 — 기존 단언 위에 `code`/`toEqual` 강화만 추가됐다.
- E(모듈 경계 추출)는 plan 이 "이 PR 에 넣지 않는다"고 명시했고, 실제 diff 에도 `TriggersService`
  의 구조적 이동·분리가 전혀 없다 — 리터럴 치환만 발생했다.
- import 추가(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`, `CHAT_CHANNEL_BLOCKED_FIELDS`)는 각 파일에서
  실제로 사용되며 미사용 임포트는 없다.
- 설정 파일(`package.json`, `tsconfig` 등) 변경 없음.

## 요약

프롬프트에 실린 17개 파일 변경은 `plan/in-progress/impl-details-code-wiring.md` 가 착수 전에
명시한 A(`details[].code` 배선 15자리)·B(`swagger.md` 인용 정정)·C(`botToken` `@MinLength(1)`)·
D(거부 메시지 상수화) 4건과 정확히 일치하며, `git show --stat`/`git show`로 실제 커밋과 대조한
결과 프롬프트에 없는 숨은 변경이나 반대로 누락된 변경도 없었다. 계획이 미리 분리한 5번째 항목(모듈
경계 추출)이 diff 에 섞여 들지 않았음도 실측으로 확인했다. 4개 항목을 한 커밋에 묶은 점과 리뷰
산출물(`review/consistency/**`)이 함께 커밋된 점은 프로젝트 워크플로가 요구하는 정상 절차이자
사전 계획·게이트로 뒷받침되므로 문제로 보지 않는다(참고용 INFO 로만 기록). 의도 이상의 변경,
무관한 리팩토링, 요청하지 않은 기능 확장, 포맷팅/주석/임포트/설정의 임의 변경은 발견되지 않았다.

## 위험도

NONE
