# 요구사항(Requirement) Review — `10_41_08`

호출자 요청 2건을 중심으로 판정한다: (1) `4-security.md §5 → §1` 인용 정정 두 곳의 정확성 검증,
(2) `§3.1-2`·`§R4`·`§3.1-3` 이 약속한 것을 이 PR 전체가 빠짐없이 구현했는지 원문 대조 최종 판정
(`status: implemented` 가 이 시점에 참인가).

## 발견사항

- **[정정 검증 — 정확함]** `4-security.md §5` → `§1`(표 "에러 메시지 노출" 행) 인용 정정 2곳 모두 spec 원문과 일치
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1260`(`runApplyConfig` catch 주석),
    `codebase/channel-web-chat/src/widget/use-widget.ts:1354`(`GENERIC_ERROR_MESSAGE` JSDoc)
  - 상세: `spec/7-channel-web-chat/4-security.md` `## 1. 보안 정책 요약` 표(파일 27~44행)에 실제로
    "에러 메시지 노출" 행이 존재한다(파일 38행): "임베드 위젯은 타 사이트에서 동작하므로 서버/예외
    원문을 UI 에 비노출 — 일반화 문구(`GENERIC_ERROR_MESSAGE`)만 표시하고 진단 원문은
    `console.warn` 으로만... 코드 SoT: `use-widget.ts errMessage`". 두 코드 주석이 인용하는 "표
    '에러 메시지 노출' 행" 문구·내용(일반화 문구 표시 + console 진단 + `errMessage` 가 코드 SoT)이
    이 spec 행과 line-level 로 정확히 일치한다. `git show 8eb223c19 -- .../use-widget.ts` 로 대조한
    결과 이 커밋이 건드린 두 곳(`§5`→`§1`)이 정확히 이 두 위치이며, 그 외 왜곡·과장 없음.
  - 제안: 없음 — 정정 정확.

- **[WARNING]** 같은 인용 오류(`4-security §5`)의 세 번째 사본이 이번 라운드에서도 남았다 — "두 곳
  다 정정했다" 는 서술은 정확히 이 diff 가 만든/찾은 두 곳에 대해서만 참이고, 저장소 전체 기준으로는
  여전히 미완
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1275` — `// W1 —
    start 실패 시 UI 에러 문구는 일반화되어 서버/내부 원문을 노출하지 않는다(4-security §5).`
  - 상세: `git blame -L 1275,1275`로 확인한 결과 이 줄은 `b9acf02c7`(2026-06-28, "그룹 A" PR)까지
    거슬러 올라가는 선행 결함으로, `10_24_54` requirement 리뷰가 지목한 "동일 결함의 두 사본"
    (`use-widget.ts:1264-1266` 신규 주석 + `use-widget.ts:1348` 기존 주석) 목록에 **이 test 파일
    사본은 포함되지 않았다** — 그래서 `8eb223c19` 의 실제 diff(`git show 8eb223c19` 확인)도 이 줄을
    건드리지 않았다. 이 줄은 이번 PR 의 diff hunk 범위 밖(`git diff origin/main...HEAD` 상 이 파일의
    마지막 hunk 는 new-line 292~864 까지이고 1275 는 그 밖) — 이번 diff 가 새로 만든 것도 아니고
    이번 diff 가 건드린 코드도 아니다. 기능 영향은 없다(테스트 주석일 뿐, 단언 로직은 정확). 다만
    같은 클래스의 defect 가 `00_30_51`(2026-06-28, defer 처리) → `10_24_54`(2026-08-11, "선행
    오류"로 재확인·부분 정정)를 거치며 두 번째로 "정정 완료"라 서술됐는데도 저장소 전체 기준으로는
    완전히 청소되지 않았다 — 다음 사람이 §5 를 열어 이 정책을 찾으면 또 실패한다.
  - 제안: 코드 유지 + `use-widget-eager-start.test.ts:1275` 의 `(4-security §5)` → `(4-security
    §1)` 로 3번째 사본도 정정. 저장소 전체 `grep -rn "4-security.*§5"` 로 이번엔 diff 파일 목록이
    아니라 **전체 트리** 기준 전수 스윕을 권장(이번에도 diff-scoped 검색만으로 하나를 놓쳤다).

- **[INFO]** `§3.1-2`(재로드 REST 오류 분기) — spec 원문과 line-level 대조, 4개 상태 분기 전부 구현 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `seedWaitingFromStatus`(679~756),
    `recoverFromExpiredToken`(529~586); spec `spec/7-channel-web-chat/3-auth-session.md:73-91`
  - 상세: spec §3.1-2 가 정한 4갈래를 코드가 정확히 구현한다 — `200`+진행중(SSE 연결, WAITING
    dispatch, line 704-721) / `200`+terminal(`finalizeEnded`, line 700-703) / `404`(storage 정리 +
    `[ended]`, line 735-738) / `401`(낙관적 `refreshToken` 1회 → 성공 시 `sessionRef`+storage 갱신
    후 `"continue"`, line 536-550; 재차 `401`/`410` 이면 `finalizeEnded`+`"ended"`, line 579-582;
    그 외 실패는 `"refresh_deferred"`, line 559-572). `410`(`EXECUTION_TERMINATED`)도
    `isTerminalAuthError`(`eia-client.ts:179-181`)가 401 과 함께 종료로 묶어 spec 의 "410 도
    `/refresh-token` 이 실제로 내는 분기" 서술과 일치.
  - 제안: 없음.

- **[INFO]** `§R4`(낙관적 refresh 1회 + 세 갈래: 복원/종료/스트림 유예) — Rationale 원문과 대조,
  세 갈래 전부 구현·배선 확인
  - 위치: `use-widget.ts:529-586`(3갈래 판정), `use-widget.ts:280-310`(`onRefreshed`→
    `resumeDeferredStreamRef`), `use-token-refresh.ts:23-29,184-193`(지수 백오프 + terminal 시 중단)
  - 상세: spec §R4 Rationale(`3-auth-session.md:104-117`)이 요구하는 "스트림 유예가 실제로 복구까지
    이어져야 한다"는 조건까지 배선이 닫혀 있다 — `use-token-refresh.ts` 의 refresh 성공 콜백이
    `onRefreshed`(→ `resumeDeferredStreamRef.current`)를 호출해 미뤄둔 스트림을 실제로 열고
    (`use-widget.ts:780-790`), 갱신 실패(비-terminal)는 `retryDelayMs` 지수 백오프로 무기한
    재예약한다(`TOKEN_REFRESH_RETRY_MAX_DELAY_MS` 상한 5분). `401`/`410` 은 재시도하지 않고 멈춘다
    (`isTerminalAuthError` 공유 술어, `use-token-refresh.ts:186`).
  - 제안: 없음.

- **[INFO]** `§3.1-3`(storage 정리 책임) — 명시된 3개 트리거 지점 전부 `clearSession` 경유 확인
  - 위치: `use-widget.ts:396-406`(`finalizeEnded`→`teardownSession`→`clearSession`, line 377),
    `use-widget.ts:890-916`(`sendCommand` 의 `410 Gone` → `finalizeEnded`)
  - 상세: spec §3.1-3 이 열거하는 세 트리거(① SSE terminal 수신, ② 복원 시 200+terminal·404·
    복구불가 401/410 확인, ③ 명령 응답 410 Gone) 가 전부 `finalizeEnded`→`teardownSession`→
    `clearSession` 단일 경로로 수렴한다(JSDoc 이 스스로 "네 진입점이 공유" 라 명시, line 384-389 —
    네 번째는 사용자 종료). 세 트리거 모두 실제 호출부 존재 확인.
  - 제안: 없음. 단 `plan/in-progress/webchat-auth-session-status-reconcile.md`(§"주기 갱신이
    terminal 을 만나도 세션을 정리하지 않는다")가 별도로 지적하는 "주기 갱신(`use-token-refresh`)
    자체가 401/410 을 받아도 `clearSession` 을 안 부른다"는 갭은 **spec §3.1-3 이 명시적으로
    열거하는 3개 트리거에 포함되지 않는 인접 표면**이라(§3.1-3 은 "위 복원에서" 로 범위를 restore
    경로에 한정) 이 spec 문언 위반은 아니다 — 다만 spec 이 침묵하는 영역이므로 그 plan 이 계속
    추적하는 것이 맞다(코드 fix 대상 아님, 회색지대).

## `status: implemented` 최종 판정

**참 — 이 시점에 `3-auth-session.md` frontmatter `status: implemented` 는 정당하다.**

- `spec/7-channel-web-chat/3-auth-session.md` frontmatter(`status: implemented`, `pending_plans`
  키 부재)와 §3.1 배너("v1 구현 현황", "그 외 status·오류는... 미구현이 아니라 의도된 경계다")가
  실제 코드와 line-level 로 일치함을 위 세 항목 각각 직접 소스를 열어 확인했다.
- `plan/complete/webchat-reload-rest-error-branches.md` 의 체크리스트 4항목(`404`·`401`·복구불가
  `401`·네 번째 갈래) 전부 `[x]`이고, 실제로 그 네 갈래가 코드에 존재한다(문서 주장이 아니라 코드
  직독으로 재확인).
- `spec/0-overview.md:82` 의 "영역 spec 6문서가 모두 `implemented`" 서술도 이 plan 을 정확히
  인용하며 코드 상태와 정합.
- `CHANGELOG.md:166-174` 의 "재로드 복원의 `404`·복구불가 `401`/`410` REST 분기" 항목이 서술하는
  5개 하위 항목(404/401 낙관적 refresh/스트림 유예/그 외 soft-fail 유지/`sessionRef.current` 읽기
  계약)도 전부 실제 코드와 대조해 일치를 확인했다(부풀림·누락 없음).

## 요약

호출자가 지목한 두 인용 정정(`use-widget.ts` 의 `4-security §5`→`§1`)은 spec `4-security.md §1`
표의 "에러 메시지 노출" 행과 line-level 로 정확히 일치한다 — 행이 실재하고 표현도 맞다. 다만 같은
결함의 세 번째 사본(`use-widget-eager-start.test.ts:1275`)이 이번 라운드의 diff-scoped 스윕에서
빠져 여전히 잘못된 절 번호를 인용한다 — 기능 영향은 없는 comment-only 결함이지만, "정정 완료"
주장의 스코프가 diff 파일 목록으로 좁혀져 저장소 전체 기준 완전성에는 못 미쳤다는 사실은 기록해
둔다. `§3.1-2`·`§R4`·`§3.1-3` 세 요구사항은 각각의 spec 원문 조항을 실제 소스(`seedWaitingFromStatus`
/`recoverFromExpiredToken`/`use-token-refresh`/`finalizeEnded`)와 대조한 결과 빠짐없이 구현돼
있으며, 세 갈래 판정·지수 백오프 재예약·stale-토큰 storage 정리 트리거 3곳 모두 배선이 닫혀 있다.
`3-auth-session.md` frontmatter `status: implemented` 는 이 시점에 참으로 판정한다.

## 위험도

LOW
