# 문서화(Documentation) Review

대상 delta: 주석 축약 2곳 + spec 인용 정정 2곳 + `runApplyConfig` 불변식 주석 + plan 등재
(commit `8eb223c19` "refactor(webchat): 라운드 11 — 동작 결함 0, 커버리지·배치·주석 밀도 정리").

## 검증 방법

`git show 8eb223c19`로 실제 diff 를 확보한 뒤, 프롬프트 텍스트가 아니라 현재 워킹트리 소스
(`Read`/`Grep`)를 직접 열어 (a) 축약된 포인터의 목적지가 실제로 그 설명을 담는지, (b)
`runApplyConfig` 불변식 주석이 실측된 사실만 말하는지, (c) plan 에 등재한 트리거의
`checkpoint 2` 가 실재하는 이름인지 세 가지를 대조했다.

## 발견사항

- **[WARNING]** spec 인용 정정이 자매 발생지 하나를 놓쳤다 — `4-security.md §5`(틀림, 프라이버시 절)
  → `§1`(표 "에러 메시지 노출") 정정이 이번 커밋에서 `use-widget.ts` 두 곳(§REST 오류 catch 주석,
  `GENERIC_ERROR_MESSAGE` JSDoc)에만 적용됐다. 같은 오기가 테스트 파일에 그대로 남아 있다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1275`
    (`// W1 — start 실패 시 UI 에러 문구는 일반화되어 서버/내부 원문을 노출하지 않는다(4-security §5).`)
  - 상세: `spec/7-channel-web-chat/4-security.md`를 직접 열어 확인한 결과 §1(라인 27~)이
    "보안 정책 요약" 표이고 그 안의 "에러 메시지 노출" 행이 바로 이 서술(서버/예외 원문 UI 비노출,
    console 로만, 코드 SoT `use-widget.ts errMessage`)을 담고 있다. §5(라인 163~)는 "프라이버시 /
    데이터 처리"로 무관한 절이다 — 커밋 메시지가 스스로 명시한 오류(`§5`는 틀렸다)가 이 test
    파일에는 그대로 재현돼 있다. 커밋 메시지는 "이번에 내가 한 곳 더 늘렸으므로 둘 다 정정"이라고
    적어 정확히 2곳만 고쳤다고 자인하는데, 실제로는 소스에 3번째 사이트가 남아 이 브랜치가 반복해
    온 "형제 자리 미반영" 패턴이 documentation 축에서도 재발했다.
  - 제안: 같은 정정(`§5`→`§1`(표 "에러 메시지 노출"))을
    `use-widget-eager-start.test.ts:1275`에도 적용. 이후 유사 정정 시 `grep -rn "4-security.*§"`로
    전수를 한 번에 훑는 습관을 권한다(이번에도 grep 이면 즉시 잡혔을 결함).

- **[WARNING]** `runApplyConfig` 불변식 주석의 "(실측)" 라벨이 실제 근거의 성격과 어긋난다 —
  같은 파일이 이미 세워 둔 "실측 = 실행/뮤테이션으로 관찰한 결과" 관례와 다르게, 이 자리는
  코드를 눈으로 추적한 정적 논증에 그 표현을 붙였다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1272`
    (`// **오늘 무해한 근거(실측)**: applyConfig 안의 모든 await 는 자체 try/catch·반환값으로 …`),
    동일 표현이 `plan/in-progress/webchat-auth-session-status-reconcile.md:251`에도
    복제(`**오늘은 무해하다(실측)**: …`).
  - 상세: 이 파일에서 "(실측)"이 등장하는 다른 5곳(`use-widget.ts:256, 371, 575, 775, 920`,
    `use-widget.test.ts:56`, `eia-client.test.ts:278`)은 전부 **실제로 코드를 바꿔 테스트를
    돌리거나 뮤테이션 결과를 관찰**한 사례다 — 예컨대 `575`는 "가드를 제거해도 초록이다(실측,
    ai-review `16_26_09` testing 이 반증)", `1127`은 "실측하면 이 구간에 await 을 하나 넣어도 전체
    스위트가 통과한다"처럼 **삽입·제거 후 스위트 실행 결과**를 근거로 든다. 반대로 이번 자리의
    근거("`applyConfig` 안의 모든 `await` 는 자체 try/catch·반환값으로 닫혀 있다")는 소스를
    직접 열어 `isEmbedAllowed`→`fetchEmbedConfig`(try/catch 폐쇄, `host-bridge.ts`의
    `detectHostOrigin`도 try/catch 폐쇄 확인)와 `seedWaitingFromStatus`(모든 분기가
    자체 `try/catch`, `recoverFromExpiredToken`도 마찬가지)를 추적해 검증한 것으로 — 필자가
    본 리뷰에서 독립적으로 재확인한 결과 **주장 자체는 사실**이지만, 이는 정적 코드 추적이지
    이 파일의 "실측" 관례가 뜻하는 실행 기반 관찰이 아니다. 다행히 바로 뒤 문장("리뷰어가 재현
    경로를 찾지 못했고 나도 못 찾았다")은 "재현 안 된다"로 과장하지 않고 "재현 경로를
    못 찾았다"로 정직하게 부정 탐색 결과를 적어, 이 브랜치가 조심해 온 "재현 못 함≠재현 안 됨"
    오류는 범하지 않았다. 문제는 그 앞의 "(실측)" 딱지가 근거의 강도를 실제보다 세게 표시한다는
    점이다 — 향후 checkpoint 2 뒤에 `await`가 추가돼 이 주석을 재검토하는 사람이 "이미 실측(=
    실행 검증)됐다"로 오독하면 재추적을 건너뛸 위험이 있다.
  - 제안: "(실측)"을 "(코드 추적으로 확인)" 또는 "(정적 확인 — 미실행)"처럼 근거 종류를 명시하는
    표현으로 바꾸거나, 실제로 checkpoint 2 뒤에 임시 `await`를 넣어 스위트를 돌려본 결과가 있다면
    그 결과를 이 파일의 다른 "(실측)" 사례처럼 구체적으로 서술할 것. 두 자리(소스 주석 + plan)
    모두 같은 문구이므로 한 번에 동기화 가능.

## 확인되어 문제없는 항목 (교차검증 결과)

- 주석 축약 2곳(`use-widget.ts:616`, `:863-864`)의 포인터 목적지 —
  `seedWaitingFromStatus`의 `@returns`(`:624-636`) — 둘 다 실제로 "그래서 호출부는 캡처해 둔
  지역 변수가 아니라 `sessionRef.current` 를 읽어야 한다"는 설명을 담고 있음을 `Read`로 직접
  대조 확인. 방향 표현("아래 `@returns` 참조")도 실제 위치 관계와 일치.
- spec 인용 정정 자체(§5→§1)의 목적지 정확성 — `spec/7-channel-web-chat/4-security.md`
  §1 표의 "에러 메시지 노출" 행이 정확히 인용된 서술을 담고, §5는 무관한 프라이버시 절임을
  직접 열어 확인.
- plan 등재 트리거의 `checkpoint 2` — `use-widget.ts:1220`(`checkpoint 2 — openStream 직전
  boot+world 재검증`)·`:1227`에 실재하는 이름이며, 그 지점과 `openStream` 호출(`:1238`) 사이에
  실제로 `await`가 하나도 없음을 코드로 확인 — "checkpoint 2 직후 동기 구간"이라는 서술과 일치.
  plan 체크리스트 항목(`webchat-auth-session-status-reconcile.md:261`)의 트리거 문구도 동일.
- plan 문서 상단 요약 표(다섯 항목, "완료 조건이 서로 독립인 항목들")에 이번 신규 절
  (`## runApplyConfig catch 에 stale 가드가 없다`)이 행으로 추가되지 않았지만, 같은 문서의
  기존 유사 절(`## start()/applyConfig 꼬리 블록 중복` 등 maintainability 성격 항목)도 그
  표에 없어 기존 관례와 일관됨 — 누락이 아니라 그 표가 "완료를 막는 독립 축"만 추리는 의도된
  부분집합.

## 요약

이번 delta는 실질 동작 변경이 없는 순수 문서/주석 정리이며, 핵심 두 축(포인터 축약의 목적지
정확성, plan 트리거의 코드 실재성)은 직접 소스를 열어 대조한 결과 모두 정확했다. 다만 정정
작업 자체의 완결성에서 두 가지 흠이 발견됐다 — spec 인용 정정이 같은 오류의 세 번째 발생지
(테스트 파일)를 놓쳤고, `runApplyConfig` 불변식 주석의 "(실측)" 표기가 이 파일이 다른 곳에서
일관되게 지켜 온 "실측 = 실행/뮤테이션 관찰" 관례보다 강한 근거를 주장한다(주장 자체는 재검증
결과 사실이었다). 둘 다 이 브랜치가 리뷰 이력 내내 반복해 지적받아 온 "형제 자리 미반영"·
"근거 강도 과장" 패턴의 documentation 축 재발이라 낮게 보기 어렵다.

## 위험도

MEDIUM
