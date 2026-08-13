# 변경 범위(Scope) 리뷰

## 검증 방법

프롬프트 diff(94개 파일, 대부분 이전 리뷰(`14_01_46`~`18_38_10`)·consistency-check(`14_18_42`,
`17_05_10`,`18_50_06`) 라운드 산출물)와 별개로, `git log --oneline origin/main..HEAD`(13커밋)
과 `git diff origin/main...HEAD --stat -- codebase/`(8파일, +561/-52)를 워크트리에서 직접
재현했다. 이전 스코프 라운드(`14_01_46`→`17_15_21`→`18_00_11`→`18_19_33`→`18_38_10`, 전부
NONE)가 이미 검증한 범위는 재확인만 하고, 그 이후 새로 추가된 2커밋(`ef4ff8d5d`,
`e38eddaf3`, consistency `18_50_06` 라운드 대응분)을 `git show`로 직접 열어 대조했다.

## 발견사항

- **[INFO]** WARNING 수정 커밋에 4년간(4라운드) 유예돼 온 스타일 항목 4건이 함께 번들됐다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts`
    (커밋 `ef4ff8d5d`) — 오배치 JSDoc 이동·pass-through 래퍼(`buildDispatcherForNull`)
    제거·`make*`→`build*` 네이밍 통일·인라인 타입 캐스트 4곳→`callHandle` 헬퍼
  - 상세: 이 커밋의 본 목적은 `execution-engine.service.ts`의 admission catch 주석
    (`attempts:1`을 안 보고 "BullMQ 재배달로 자가 치유"라 오서술한 부분, consistency
    `18_50_06` WARNING 1)을 고치는 것이다. 여기에 별건인 dispatcher 테스트 파일의 스타일
    정리 4건이 같은 커밋에 섞였다. 다만 이 4건은 임의로 새로 발견된 것이 아니라 `17_15_21`
    코드 리뷰부터 4라운드 연속 지적·의식적으로 유예돼 왔고, 직전 커밋(`6f8fbdc9b`)에서 이미
    plan 체크리스트에 "다음 실질 변경 때 정리" 로 명시 등재된 항목이다. 커밋 메시지가
    "어차피 `codebase/**`를 고쳐야 하는 게 확정돼 미룰 이유가 사라졌다"고 번들 사유를
    명시했고, plan 문서에도 동일 근거가 기록돼 있다 — 즉흥적 리팩토링이 아니라 사전에
    추적되고 승인된 부채 정리다.
  - 제안: 조치 불요. 향후에도 이런 번들은 커밋 메시지·plan에 근거를 남기는 현재 패턴을
    유지할 것.

## 확인한 것 (스코프 일치, 문제 없음)

- `git diff origin/main...HEAD --stat -- codebase/` 결과 8개 backend 파일만 변경됐고, 이전
  4라운드 스코프 리뷰가 이미 검증한 파일 집합(`assert-row-array.{ts,spec.ts}` 신규,
  `chat-channel.dispatcher.spec.ts`, `execution-engine.service.{ts,spec.ts}`,
  `executions{-rerun,}.service.{ts,spec.ts}`)과 정확히 동일하다. 신규 파일·신규 모듈 추가
  없음.
- 신규 2커밋(`ef4ff8d5d` 코드 수정, `e38eddaf3` RESOLUTION 문서)을 `git show`로 직접 대조한
  결과, `ef4ff8d5d`의 프로덕션 코드 변경은 `execution-engine.service.ts`의 주석 텍스트
  교체(로직·분기·throw 여부 무변경, "재배달로 자가 치유" 오서술 → `attempts:1` 근거로 정정)
  뿐이다. `e38eddaf3`는 `review/consistency/2026/08/13/18_50_06/RESOLUTION.md` 1개 신규
  파일만 추가하는 순수 문서 커밋.
- `assertRowArray` 헬퍼·자매 지점 전수 테스트(`assert-row-array.spec.ts`)는 이전 라운드
  (`18_00_11` maintainability WARNING 1)가 명시적으로 요구한 후속 조치이며, 이번 라운드에서
  로직 변경 없이 유지된다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md`의 체크박스 갱신(4건 `[ ]`→`[x]`,
  worktree frontmatter 정정)은 실제로 같은 커밋에서 코드로 반영된 항목과 1:1 대응하며, 문서
  서술("등재 직후 전부 처리했다")도 실측과 일치한다.
- `review/consistency/2026/08/13/18_50_06/**`, 그리고 이전 라운드들의 `review/code/**`·
  `review/consistency/**` 산출물은 CLAUDE.md가 명시한 저장 위치에 정확히 대응하는 강제
  리뷰/consistency-check 워크플로의 정상 부산물이다.
- 포맷팅만 바뀐 자리, 불필요한 주석 추가/삭제, 사용하지 않는 임포트, 의도치 않은 설정 파일
  변경은 발견되지 않았다.

## 요약

이번 라운드(`19_08_48`)의 실질 델타는 이전 4회 스코프 리뷰(전부 NONE)가 검증한 상태에 2커밋만
추가됐다 — consistency-check `18_50_06`가 지적한 "admission catch 주석의 근거 오류"를
`execution-engine.service.ts` 주석 텍스트만 교체해 정정한 것(로직 무변경)과, 그 RESOLUTION
문서 1건이다. 함께 번들된 `chat-channel.dispatcher.spec.ts` 스타일 정리 4건은 겉보기엔 별건
같지만 4라운드에 걸쳐 추적·plan에 명시 등재된 부채이고 번들 사유가 커밋 메시지·plan 양쪽에
기록돼 있어 스코프 위반으로 보지 않는다. `git diff --stat`으로 재확인한 전체 코드 변경 파일
집합(8개 backend 파일)도 이전 라운드들과 동일하며 신규로 넓어진 영역이 없다. 요청 이상의 기능
확장, 무관한 파일 수정, 의미 없는 포맷팅/주석/임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
