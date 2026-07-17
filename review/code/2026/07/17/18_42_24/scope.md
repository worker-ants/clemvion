# 변경 범위(Scope) 리뷰

## 검증 방법

리뷰 payload 의 diff 뿐 아니라 실제 git 저장소에서 아래를 직접 실측 검증했다.

1. `git show --stat 3e84d2109bac5b2d580466b09b28094f1fb0ffee` — 커밋이 실제로 건드린 전체 파일 목록 확인 (payload 에 숨겨진 파일이 없는지).
2. `git diff <parent> <commit> -- output-shape.ts | grep -E '^[+-]' | grep -v '^[+-] \*'` — 주석(` * ` 로 시작) 이외의 +/- 라인이 있는지 필터링.
3. `git show f17fc18dd --stat` / `git show f0ef4a821 --stat` — plan 문서 각주가 인용하는 두 커밋 해시의 실제 diff 대상 파일 대조.
4. `review/code/2026/07/17/18_02_39/RESOLUTION.md` — 이 커밋이 응답하는 직전 리뷰 라운드의 조치 항목 표와 커밋 diff 를 1:1 대조.

## 검증 결과

1. **commit stat**: `3e84d2109` 은 정확히 2개 파일만 변경 (`output-shape.ts` +23/-10, `plan/in-progress/is-conversation-output-restructure.md` +1/-1) — 리뷰 payload 의 2개 파일과 완전 일치, 숨겨진 파일 없음.
2. **`output-shape.ts` 코드/주석 분리**: 주석이 아닌 +/- 라인 필터링 결과 **0건** — 100% JSDoc 블록(`isConversationOutput` 함수 위 주석) 내부 변경이며 함수 시그니처·바디·import 는 한 글자도 건드리지 않았다. 커밋 메시지의 "주석 전용 — 런타임 표면 없음" 주장과 실측이 일치한다.
3. **`plan/...md` 변경**: 단일 각주 라인에서 커밋 해시 리터럴 `f17fc18dd` → `f0ef4a821` 치환 1건뿐. `git show f17fc18dd --stat` 결과 해당 커밋의 파일 목록에 `interaction-type-registry.ts` 가 없음을, `git show f0ef4a821` 결과 그 커밋이 `IS_MULTI_TURN_INTERACTION` 을 실제로 신설했음을 각각 확인 — 정정 내용 자체도 사실과 부합한다.
4. **직전 라운드 RESOLUTION.md 대조**: `review/code/2026/07/17/18_02_39/RESOLUTION.md` 의 조치 항목 표가 W#1(수정)·W#2(수정)·W#3(미채택, 반증 근거 명시)을 기록하며, 이번 커밋의 diff·커밋 메시지가 그 표와 정확히 대응한다. W#3(CHANGELOG 누락)은 조치 없이 조용히 넘어간 게 아니라 커밋 메시지 안에 반증 근거(직전 12개 머지 중 2건만 CHANGELOG 접촉, #959·#961 도 미추가)와 함께 명시적으로 "미채택 — 사용자 결정" 으로 기록됐다.

## 발견사항

없음. 8개 점검 관점 전원 위반 없음:

- **의도 이상의 변경**: 커밋 메시지가 선언한 W#1·W#2 정확히 그 범위만 수정. W#3 은 명시적 미채택으로 기록(silent omission 아님).
- **불필요한 리팩토링**: 없음. 함수 로직·구조 무변경.
- **기능 확장**: 없음. 동작 변경 0 (JSDoc + 문서 각주 문자열 치환뿐).
- **무관한 수정**: 없음. 두 파일 모두 W#1/W#2 가 정확히 지목한 위치.
- **포맷팅 변경**: JSDoc 목록 항목 재정렬(기존 "Legacy waiting" 이 4번째 → 2번째)이 있으나, 이는 신규 발견 분기 2개(`output.conversationConfig`, post-Stage-5 terminal)를 끼워 넣으며 Legacy/Wrapped 그룹을 묶은 편집상 재구성이다. W#2("부정확한 분기 열거 정정")가 요구한 재작성 범위 안이며 의미 없는 포맷팅 노이즈가 아니다.
- **주석 변경**: 이 커밋의 선언된 목적 자체가 주석 정정(W#2)이므로 해당 안 됨 — 추가된 설명(`#959` 배경, whitelist 위험 설명)도 같은 파일 상단 `CONVERSATION_END_REASONS` 주석에 이미 존재하는 맥락과 일관되며, 누락됐던 바로 그 분기(`looksLikeConversationEnd`)를 설명하는 데 직접 기여한다.
- **임포트 변경**: 없음.
- **설정 변경**: 없음.

## 요약

이 커밋은 직전 `/ai-review` 라운드(18_02_39)의 W#1·W#2 두 WARNING 만을 정확히 겨냥한 교정 커밋이다. 실행 코드는 전혀 변경되지 않았고(`output-shape.ts` 는 100% JSDoc 주석 내부 변경, grep 실측으로 확인), plan 문서 수정은 잘못 인용된 커밋 해시 하나를 실측 검증된 값으로 바꾼 단일 치환이다. W#3(CHANGELOG 누락)은 조용히 빠진 게 아니라 반증 근거와 함께 명시적으로 미채택 처리되어 커밋 메시지·직전 RESOLUTION.md 양쪽에 일관되게 기록됐다. 리팩토링·기능 확장·무관한 파일·포맷팅 노이즈·임포트·설정 변경 어느 것도 발견되지 않았다 — 선언된 범위와 실제 diff 가 완전히 일치하는, scope 관점에서 모범적인 커밋이다.

## 위험도
NONE
