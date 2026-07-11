# 문서화(Documentation) 리뷰 결과

대상: `codebase/channel-web-chat/src/lib/widget-state.test.ts`(+72줄, mergeMessages 5케이스),
`codebase/channel-web-chat/src/lib/widget-state.ts`(mergeMessages JSDoc 정정 포함),
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(+67줄, 복원 통합 테스트),
`plan/in-progress/webchat-multiturn-restore-test.md`(신규), 그리고 `review/code/2026/07/12/01_10_15/**`
(직전 `/ai-review` 세션 산출물 10개 파일, 관례대로 커밋). 제품 코드·API·spec·config 변경 0 —
test-only 회귀/characterization 테스트 추가 + 그 직전 리뷰 라운드의 fix 반영(commit `462a23e4e`) +
리뷰 아카이브.

이번 diff 는 `review/code/2026/07/12/01_10_15/` 리뷰가 지적한 WARNING#2(Documentation: `mergeMessages`
오래된 JSDoc)를 이미 반영한 **이후** 상태다. 아래는 그 반영 결과에 대한 독립 재검증 + 잔여 발견사항이다.

## 발견사항

- **[INFO]** `mergeMessages` JSDoc 정정 확인 — 이전 WARNING 해소, 정확성 양호
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` (함수 상단 JSDoc, `mergeMessages`)
  - 상세: 직전 리뷰(`review/code/2026/07/12/01_10_15/documentation.md` WARNING)가 지적한 "합치기(merge)·
    중복 회피(dedup)" 오서술이 `/** durable thread snapshot 과 로컬 라이브 메시지 중 **하나를 통째로
    선택**한다(interleave·dedup 아님): snapshot 이 로컬과 같거나 길면 정본(snapshot), 짧으면 로컬을 그대로
    채택. ... */` 로 정정됐다. 실제 구현(`return snapshot.length >= local.length ? snapshot : local;`)과
    line-level 로 일치함을 직접 대조 확인. 테스트 파일 상단 주석("SoT: widget-state.ts mergeMessages")도
    함수와 정확히 연결된다. 조치 불필요 — 참고용 확인.

- **[INFO]** `mergeMessages` "병합" 용어가 함수명·테스트 describe 제목·블록 코멘트에 여전히 잔존(직전 리뷰
  testing.md 가 이미 지적, 미조치·non-blocking 상태 유지)
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.test.ts` — 함수명 `mergeMessages` 자체(변경 없음),
    describe 제목 `"widgetReducer — WAITING threadMessages 병합(mergeMessages, 복원 시드)"`, 바로 위 블록
    코멘트("...로컬 라이브 메시지를 **합치는 분기**...")
  - 상세: 함수의 JSDoc 은 이번에 "선택(select)이지 병합(merge)/interleave 가 아니다"로 정밀하게 정정됐으나,
    같은 파일의 describe 제목과 도입부 코멘트는 여전히 "병합"·"합치는"이라는 표현을 그대로 쓴다(블록 코멘트
    바로 다음 문장에서 "두 분기(snapshot 채택 / local 보존)"로 실제 선택 의미를 정확히 부연하긴 하지만,
    첫인상 단어 선택은 JSDoc 이 방금 명시적으로 부정한 "merge"와 계속 겹친다). `review/code/2026/07/12/01_10_15/testing.md`
    가 이미 동일 지점을 "코드 소스의 명명/주석 문제, 테스트 관점 조치 불필요, 코드 리뷰어에게 소스 주석 정정
    권고"로 확인성 기술했고 이번 fix 커밋(`462a23e4e`)에도 반영되지 않은 채 남아 있다. 기능 결함은 아니며
    JSDoc 정정으로 진실은 이미 확보돼 있어 심각도는 낮다.
  - 제안: 조치 불필요(blocking 아님). 다음에 이 영역을 건드릴 후속 커밋에서 함수명(예: `selectMessages`) 또는
    describe 제목의 "병합" 표현을 JSDoc 과 일치시키는 것을 고려 가능. 우선순위 낮음.

- **[INFO]** plan 문서 e2e 소요시간 표기 불일치 — 직전 리뷰 INFO#3 해소 확인
  - 위치: `plan/in-progress/webchat-multiturn-restore-test.md` (워크플로 체크박스 / 결정 메모 섹션)
  - 상세: 직전 라운드에서 `216s` vs `229s` 로 불일치하던 표기가 이번 fix 로 "TEST WORKFLOW ... e2e PASS(253
    tests) — fix 후 재수행 예정" / "e2e = 수행(면제 아님): ... 2회 수행: 최초 main-root 검증 229s, 이후
    worktree 검증 216s(동일 결과)"로 명확히 회차 구분됐다. 근거 추적 시 혼란 요소 해소 확인. 조치 불필요.

- **[INFO]** plan 의 e2e 면제 화이트리스트 인용 정확성 재확인
  - 위치: `plan/in-progress/webchat-multiturn-restore-test.md` — "`*.test.ts` 전용 변경은 `PROJECT.md §e2e
    면제 화이트리스트`의 회색지대(명시적으로 화이트리스트 밖)라 e2e 수행"
  - 상세: `PROJECT.md:99` 원문("회색 지대(예: `*.test.ts` 만 변경, configuration JSON, helper 한 줄) 도
    화이트리스트가 아니므로 e2e 수행")과 직접 대조해 정확히 일치함을 확인. 조치 불필요.

- **[INFO]** 테스트 인라인 주석의 소스코드 참조 정확성 — 재검증 결과 정확
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.test.ts` (threadMessages 부재 테스트 코멘트:
    "두 프로덕션 dispatch 호출부(use-widget.ts handleEiaEvent·seedWaitingFromStatus)는 항상
    threadToMessages(...) 배열을 전달한다")
  - 상세: `use-widget.ts` 의 `handleEiaEvent`(WAITING dispatch, `threadMessages: threadToMessages(conversationThread)`)와
    `seedWaitingFromStatus`(`threadMessages: threadToMessages(parsed.conversationThread)`) 두 호출부를
    직접 확인했고, `conversation.ts` 의 `threadToMessages(thread: ConversationThread | undefined):
    DisplayMessage[]` 가 입력이 `undefined`/빈 turns 이어도 항상 `[]`(빈 배열)를 반환함(`if (!thread?.turns?.length)
    return [];`)을 확인 — 테스트 코멘트의 "undefined 미도달, 타입 레벨 방어 분기" 주장이 소스와 정확히 일치.
    조치 불필요.

- **[INFO]** 리뷰 아카이브 파일(`review/code/2026/07/12/01_10_15/**` 10개) 커밋 — 프로젝트 관례 부합, 별도
  문서화 조치 불요
  - 위치: `review/code/2026/07/12/01_10_15/{RESOLUTION,SUMMARY,meta,_retry_state,documentation,maintainability,
    requirement,scope,security,side_effect,testing}.{md,json}`
  - 상세: `review/` 산출물은 gitignore 대상이 아니며 SUMMARY·RESOLUTION 커밋이 프로젝트 표준(작업 이력 보존)이다.
    `RESOLUTION.md` 의 조치 항목 표(WARNING#1/#2, INFO#2/#3, 커밋 `462a23e4e`)를 실제 커밋 diff 와 대조한 결과
    내용이 정확하다(`git show 462a23e4e` 확인). README/CHANGELOG 성격의 문서가 아니므로 갱신 요건 없음.

- **[INFO]** README/CHANGELOG/API 문서 갱신 불요 판단 — 재확인, 타당
  - 상세: 이번 diff 는 제품 코드·엔드포인트·환경변수·설정 옵션 변경이 전혀 없는 순수 테스트 추가 +
    직전 리뷰 fix 반영이다. 신규 공개 함수/클래스 없음(모두 기존 `widgetReducer`/`mergeMessages`/`useWidget`
    내부 로직에 대한 테스트). README·CHANGELOG·API 문서 갱신이 필요 없다는 plan 의 판단은 타당하다.

## 요약

이번 diff 는 `review/code/2026/07/12/01_10_15/` 세션이 지적한 두 WARNING(테스트 커버리지 갭·`mergeMessages`
오래된 JSDoc) 을 정확히 반영한 fix 커밋(`462a23e4e`)과, 그 리뷰 세션 산출물 자체의 커밋, plan 문서의 후속
갱신으로 구성된다. 정정된 `mergeMessages` JSDoc 은 실제 구현(length 비교 기반 양자택일, interleave/dedup 아님)과
line-level 로 정확히 일치함을 독립 검증했고, 테스트 인라인 주석이 인용하는 프로덕션 호출부·소스 함수 참조도
모두 실존·정확했다. plan 문서의 e2e 소요시간 표기 불일치, e2e 면제 화이트리스트 인용도 모두 정확하게 해소·
검증됐다. 유일한 잔여 사항은 직전 리뷰가 이미 non-blocking 으로 확인성 기술한 것 — `mergeMessages` 함수명과
테스트 describe 제목이 여전히 "병합" 이라는 표현을 쓰는데, 정정된 JSDoc 이 명시적으로 "interleave·dedup 아님"
이라 부정하는 것과 어휘 차원에서 살짝 겹친다는 점이다. 기능적 결함이 아니고 진실(정확한 동작 서술)은 이미
JSDoc 에 확보돼 있어 blocking 사유가 아니다. 제품 코드·API·config 변경이 없으므로 README/CHANGELOG 갱신
요건도 없다.

## 위험도

NONE
