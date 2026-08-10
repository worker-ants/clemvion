# 부작용(Side Effect) Review

## 검증 방법

프롬프트의 diff-base(`origin/main`)는 이번 세션의 전체 누적 변경(스트림 소유권 게이트 리팩터 + 이전
리뷰/일관성 라운드 산출물 커밋)을 포함하지만, 오케스트레이터 지시대로 **직전 라운드(`13_21_24`,
forced 7/7, 그 자체가 CRITICAL 0 · side_effect NONE 으로 종결)와 이번 라운드 사이의 실제 delta**에
초점을 맞췄다. `git show edebb1cc1`(`fix(webchat): 같은 JSDoc 블록이 자기와 모순하던 마지막 자리 +
"범위 밖" 이라 써 놓고 고친 문서 정정`)로 그 delta 를 직접 열어 대조했다.

## 발견사항

없음(CRITICAL/WARNING 없음).

- **[INFO]** 이번 delta 의 코드 쪽 변경은 `use-widget.ts` 의 **JSDoc 산문 2줄**뿐이고, 둘 다 순수
  텍스트 치환이라 실행 경로에 닿지 않는다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `seedWaitingFromStatus` JSDoc 블록
    내부(`git show edebb1cc1` 기준 두 hunk, 파일 내 `461`행 부근 "이중 스트림은 ... 막는다" 문장과
    `468`행 부근 "그 짝 가드로 ..." 문장 — 두 문장 모두 JSDoc 주석 안).
  - 상세: 치환 내용은 "호출부의 짝 가드가 막는다" → "`openStream` 진입 가드가 막는다", "그 짝
    가드로" → "그 진입 가드로" 두 곳뿐이다. 커밋 메시지가 밝히듯 이는 직전 커밋(`bf8d71802`)의
    "JSDoc·spec 옛 아키텍처 서술 정정"에서 같은 블록 안 다른 문장(`461-462`·`466-468`)은 이미
    "openStream 진입에서 재확인"으로 갱신됐는데, 이 두 줄만 옛 표현("호출부의 짝 가드")으로 남아
    **같은 JSDoc 블록 안에서 자기모순**이던 것을 마저 맞춘 것이다. 코드 토큰(`type`/함수 시그니처/
    `useCallback` 의존성 배열/조건문)은 이 hunk 에 전혀 없다 — `git show edebb1cc1 -- '*.ts'`
    확인 결과 변경 줄이 모두 `*` 로 시작하는 주석 텍스트 라인이다. 상태 변경·전역 변수·파일시스템·
    시그니처·인터페이스·환경 변수·네트워크 호출·이벤트/콜백 배선 어느 관점에도 영향 없음.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/webchat-reload-rest-error-branches.md` 의 delta 는 frontmatter/
  체크리스트/코드 링크를 건드리지 않는 **본문 서술 확장**뿐이다.
  - 위치: `plan/in-progress/webchat-reload-rest-error-branches.md` — 상단 인용 블록("> 출처:
    `review/consistency/...`" 로 시작하는 문단) 내부.
  - 상세: `git show edebb1cc1` 기준 변경은 "무관한 티켓에 딸려 나온 기존 결함이라 그 PR 범위
    밖" 문장을 "왜 그 PR 안에서 고쳤나" 절로 교체·확장한 것이다 — 문서가 자기모순("범위 밖"이라
    적어 놓고 같은 PR 에서 고침, `13_21_24` scope WARNING)이었던 것을 근거 3가지(a/b/c)로 정정한
    narrative-only 변경. 이 문서는 순수 마크다운이고 harness/코드에서 파싱·실행되는 대상이
    아니므로(제목·frontmatter·체크리스트·경로 링크는 이 hunk 밖) 부작용 표면이 원천적으로 없다.
  - 제안: 조치 불필요.

- **[INFO]** 이전 라운드에서 지적됐던 부작용 관련 항목(`sessionEstablished` 의존성 배열 잔재,
  12_39_25 WARNING)은 이번 delta 이전에 이미 해소돼 있고 이번 delta 로 재도입되지 않았음을 재확인.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:634` — `}, [openStream, persist,
    seedWaitingFromStatus, scheduleRefresh, isStale, worldGenRef]);`
  - 상세: 소스를 직접 열어 `start()` 의 `useCallback` 의존성 배열에 `sessionEstablished` 가 없음을
    확인했다(2d9d202188 이후 `bf8d71802`/이전 라운드 fix 로 이미 제거). 이번 `edebb1cc1` delta 는
    이 배열을 건드리지 않는다.
  - 제안: 조치 불필요.

## 점검 관점별 결론 (delta 한정)

1. **의도치 않은 상태 변경**: 없음 — 변경 줄 전부 주석/문서 텍스트.
2. **전역 변수**: 해당 없음.
3. **파일시스템 부작용**: 없음 — `.md` 파일 자체가 이번 PR 의 편집 산출물(정본 저장 위치)이지,
   런타임 코드가 실행 중 생성/수정/삭제하는 파일이 아니다.
4. **시그니처 변경**: 없음 — `openStream`/`StreamClaim` 등 타입·함수 시그니처는 이번 delta 밖
   (직전 라운드에서 이미 검토·NONE 판정).
5. **인터페이스 변경**: 없음.
6. **환경 변수**: 없음.
7. **네트워크 호출**: 없음 — `client.openStream(...)` 호출 조건·타이밍 미변경.
8. **이벤트/콜백**: 없음 — `dispatch`/`bridgeRef.current?.sendEvent`/`onEvent`/`onError` 배선
   미변경.

## 요약

직전 라운드(`13_21_24`) 대비 이번 라운드의 실질 delta 는 `git show edebb1cc1` 로 직접 확인한 대로
`use-widget.ts` JSDoc 산문 2줄(같은 블록 안에서 자기모순이던 옛 "호출부의 짝 가드" 표현을 현행
"`openStream` 진입 가드" 표현으로 통일)과 `webchat-reload-rest-error-branches.md` 의 Rationale
서술 확장뿐이며, 둘 다 실행 코드·타입·의존성 배열·호출 조건을 전혀 건드리지 않는 순수 텍스트
변경이다. 이전 라운드(`13_21_24`)의 side_effect 리뷰가 이미 스트림 소유권 게이트 리팩터 전체
(시그니처 `void→StreamClaim`, 게이트 위치 이동, `sessionEstablished` 의존성 정리)를 검토해 NONE
으로 결론냈고, 이번 delta 는 그 코드 표면에 어떤 변경도 추가하지 않는다. 새로운 부작용 표면은
없다.

## 위험도

NONE
