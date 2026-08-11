# 변경 범위(Scope) Review

## 판정 요청: 직전 라운드(`16_09_40`) 지적 반영 3건이 이 티켓 범위 안인가

이번 diff 는 원 티켓(`deb9b6978` "재로드 REST 오류 분기 3종 구현")에 대한 `ai-review 16_09_40`
라운드의 Critical 1·WARNING 8 을 반영한 후속 커밋 2개(`4eb1be379`, `54a181f0a`)를 포함한다.
`git log`/`git show --stat` 로 세 항목이 각각 어느 커밋에서 어떤 파일만 건드렸는지 실측했다.

### (a) `session-store.applyRefreshedToken` 추출 — **범위 내**

- 위치: `codebase/channel-web-chat/src/lib/session-store.ts` (신규 함수), 호출부
  `codebase/channel-web-chat/src/widget/use-token-refresh.ts`, `codebase/channel-web-chat/src/widget/use-widget.ts`
- 커밋 `54a181f0a`에서만 발생, `maintainability-reviewer`(16_09_40)가 "**요청 판정**"으로 명시 지목한
  리터럴 중복(4줄, `{...session, ...refreshed}` → `sessionRef.current` → `saveSession`)의 제거다.
  그 중복은 **이번 티켓이 새로 추가한 401 분기**(`use-widget.ts`)가 기존 주기 갱신
  (`use-token-refresh.ts`)과 같은 shape 를 또 만들면서 생긴 것이라, 원인이 이 diff 자신에 있다.
- 오케스트레이션(재귀 타이머 vs await-후-확정)은 의도적으로 **합치지 않았고**, 상위 헬퍼로의
  과확장 제안(`recoverFromExpiredToken` module-level 헬퍼)은 RESOLUTION 의 "반영하지 않은 것"에
  명시적으로 보류됐다 — over-engineering 방향으로 가지 않았다는 증거.
- `use-token-refresh.ts` 는 원래 이 티켓의 리뷰 대상 3파일(`use-widget.ts`/test/spec)에 없던
  파일이라 diff 범위가 넓어지긴 했으나, 변경은 import 1줄 + 3줄 치환뿐이고 동작은 동일
  (`{...session, token, expiresAt}` == `{...session, ...{token, expiresAt}}`) — 뮤테이션 RED 2건으로
  검증됨(RESOLUTION §5). 범위 확장의 정도가 결함 원인과 1:1 대응해 과도하지 않다.

### (b) CHANGELOG 항목 — **범위 내**

- 커밋 `54a181f0a`. `documentation-reviewer`(16_09_40)가 지목한 WARNING — 같은 기능 영역
  (§3.1 REST 오류 분기, "앞선 절반"은 이미 CHANGELOG:183행에 기록됨)의 **기존 관례 미이행**을
  메운 것이다. 새 기능이 아니라 이 diff 자신이 만든 사용자-관측 가능 동작 변경(재로드 종료
  판정·자동 refresh)의 문서화이므로, 확장이 아니라 **누락 보완**이다.
- 항목 문구(`CHANGELOG.md:166-173`)도 기존 포맷(`## Unreleased — 웹채팅 위젯: <설명> (<spec 참조>)`)을
  그대로 따르고, 이 diff 의 실제 분기(404/401/soft-fail)만 서술한다 — 범위 밖 서술 없음.

### (c) plan 신설 + spec 본문 포인터 — **범위 내**

- 커밋 `4eb1be379`(CRITICAL 수정 커밋과 동일 커밋). `scope-reviewer`(16_09_40) 자신이 낸 WARNING —
  "두 PR 의 머지 순서 의존을 커밋 메시지에만 남긴 것은 불충분" — 에 대한 직접 응답이다. 그 WARNING
  은 이 티켓의 spec 변경(§3.1 배너를 "미구현"→"구현됨"으로 정정)이 **동시에 진행 중인 다른 PR
  (#1130)이 같은 frontmatter 를 정반대 방향으로 정정 중**이라는, 이 diff 자신이 만든 조정 리스크를
  지적한 것이므로, 그 대응(plan + spec 포인터)도 이 diff 의 부작용을 봉합하는 것이지 별도 기능이
  아니다.
- `spec/7-channel-web-chat/3-auth-session.md` 에 추가된 것은 4줄 짜리 안내 블록(`frontmatter
  재판정 대기`)뿐이며 새 spec **결정**을 만들지 않는다(직전 라운드 scope INFO#3 이 이미 "이미
  확정된 spec 을 그대로 구현한 사실 동기화는 developer 스코프로 봄이 타당"이라 판정한 동일 성격 —
  이번 4줄도 결정이 아니라 조정 사실 기록이라 같은 논리가 적용된다).
- plan 파일(`plan/in-progress/webchat-auth-session-status-reconcile.md`, 70줄) 자체는 프로젝트
  관례("진행 중 조율이 필요한 사실은 `plan/`에 남긴다")를 따른 정상적 산출물이다.

## 발견사항

- **[INFO]** plan 파일이 서로 다른 두 follow-up 을 한 문서에 묶었다
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md` — `## 처리 (나중 머지 쪽)`
    섹션(frontmatter 소유권 조정)과 `## 함께 남은 미확인 갭 — start() 경로의 401` 섹션(뮤테이션
    실측으로 발견된 회귀 커버리지 갭)
  - 상세: 두 항목 모두 이번 diff/리뷰 세션에서 직접 파생됐다는 점에서 범위 이탈은 아니지만,
    표제(`3-auth-session.md frontmatter 재판정...`)는 첫 번째 항목만 가리켜 두 번째 항목의
    가시성이 제목만으로는 낮다. 두 관심사가 서로 독립적으로 종결될 가능성이 있다(하나는
    "다음 머지되는 PR"이, 다른 하나는 "start() 401 도달 가능성 조사"가 트리거) — 향후 어느
    한쪽만 먼저 닫히면 plan 분리를 고려할 만하다.
  - 제안: 조치 불요(현 단계에서는 한 세션의 산출물을 한 plan 에 모으는 것이 합리적). 두 항목 중
    하나가 먼저 처리되면 남은 항목만 담은 새 plan 으로 분리해 표제와 내용을 재정렬 권장.

- **[INFO]** 이번 diff 는 `review/code/2026/08/10/16_09_40/**` (SUMMARY/RESOLUTION/각 리뷰어
  산출물 11개)도 신규 커밋에 포함한다
  - 위치: 커밋 `4eb1be379`
  - 상세: `CLAUDE.md` 의 정보 저장 위치 표에 따라 코드 리뷰 산출물은 `review/code/**`에 커밋되는
    것이 정상 관례이고, 이 파일들은 developer 가 아니라 리뷰 스킬이 생성한 산출물이라 developer
    쓰기 권한(`review/**/RESOLUTION.md`) 범위 논쟁과도 무관하다. 스코프 이탈 아님 — 참고용으로만
    기록.

## 요약

세 항목(session-store 추출·CHANGELOG 항목·plan+spec 포인터) 모두 `git log`/`git show --stat` 로
추적한 결과 원 티켓 자체가 아니라 **원 티켓 diff 를 대상으로 한 직전 ai-review 라운드(`16_09_40`)의
Critical/WARNING 을 반영한 커밋**(`4eb1be379`, `54a181f0a`)에서 발생했으며, 세 항목 모두 그 라운드의
특정 리뷰어가 **이 diff 자신이 만든 결함/리스크**(리터럴 중복·문서 관례 누락·머지 순서 조정 공백)를
지목한 데 대한 proportionate 대응이다. 상위 오케스트레이션 통합이나 module-level 헬퍼 추출 같은 더
넓은 리팩토링 제안은 명시적으로 거절해 과확장을 피했다(RESOLUTION "반영하지 않은 것"). `CLAUDE.md`
의 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 조항과도 부합하는 정상적인 fix-cycle
산출물이다. 세 항목 모두 **티켓 범위 안**으로 판정한다. 무관한 리팩토링·기능 확장·포맷팅 뒤섞임·
불필요한 주석/임포트 변경은 발견되지 않았다.

## 위험도

NONE
