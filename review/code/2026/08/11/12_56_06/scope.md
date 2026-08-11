# 변경 범위(Scope) 리뷰 — `12_56_06` (신규 델타: 커밋 `f5d485a52`)

## 조사 방법

`git show f5d485a52 --stat` / 본문 / `git diff f5d485a52^ f5d485a52 -- codebase/ plan/ spec/` 로
이번 라운드의 실제 델타를 직접 확인했다. 프롬프트에 첨부된 unified diff 는 `origin/main..HEAD`
전체(5개 커밋 누적) 기준이라 `f5d485a52` 하나만의 델타와는 다르다 — 프롬프트 파일 목록에
`CHANGELOG.md`·`triggers.controller.ts`·`triggers.controller.spec.ts` 등이 보이는 것은 이전
라운드(`12_37_14`)에서 이미 NONE 판정을 받은 구간이며, 이번 커밋에서 다시 손댄 게 아니다(아래
`git diff` 결과로 확인). 이어서 RESOLUTION 이 주장한 뮤테이션 결과 2건을 저장소 안에서 실제로
뮤턴트를 심어 재현했다.

## `f5d485a52` 실제 델타 (직접 확인)

```
.../audit-logs/audit-action.const.ts   |  5 +-   (주석 정정, 2개 문장 재작성)
.../triggers/triggers.service.spec.ts  | 33 ++++  (신규 테스트 1건)
plan/in-progress/spec-sync-auth-gaps.md|  6 ++     (체크리스트 1항목 등재)
spec/5-system/1-auth.md                |  2 +-     (표 셀 1줄 — 같은 W2 정정의 spec 미러)
review/code/2026/08/11/12_22_23/*      | 9 files   (직전 라운드 리뷰 산출물, 사후 커밋)
review/code/2026/08/11/12_37_14/*      |10 files   (확인 라운드 리뷰 산출물, 신규 커밋)
```
26 files changed, 1750 insertions(+), 3 deletions(-) — insertion 대부분(약 1700줄)은
`review/code/**` 산출물이고, 실질 코드/문서 변경은 위 4개 파일 46줄뿐이다.

## 발견사항

- **[INFO]** 커밋 설명("테스트 1건 + 주석 2줄")이 `spec/5-system/1-auth.md` 표 셀 정정 1줄을
  명시적으로 언급하지 않는다 — 다만 실질적으로는 범위 이탈이 아니다
  - 위치: `spec/5-system/1-auth.md`(트리거 시크릿·토큰 행, "트리거 (시크릿·토큰)" 표 셀)
  - 상세: `git diff f5d485a52^ f5d485a52`로 확인한 실제 변경은 "주석 2줄"이 아니라 **두 지점**의
    같은 문구("앞의 둘")를 액션명 직접 명기로 바꾼 것이다 — `audit-action.const.ts`(코드 주석)와
    `spec/5-system/1-auth.md`(spec 표, 코드 주석의 미러). 커밋 본문은 실제로 "액션명을 직접
    쓰는 형태로 **두 곳**(`audit-action.const.ts`·`1-auth.md §4.1`) 을 고쳤다"고 명시하고 있어
    사실관계는 정확하다(오탐이 아니다) — 다만 커밋 제목 요약에서만 "주석 2줄"로 축약돼 있다.
    같은 오류(위치 수식어가 실제 순서와 다름)를 두 미러 지점에서 함께 고친 것이므로 범위상
    자연스럽고, spec 은 코드 read-only 인 developer 역할 하에서도 `spec/` 자체 편집이 아니라
    **커밋된 트리거 관련 spec 파일의 오탈자성 사실 정정**이라 별도 planner 턴 없이도 정당화된다
    (이미 이 PR 의 다른 커밋 `d71a53127`이 같은 spec 표 행을 도입했다).
  - 제안: 조치 불필요. 기록 목적의 관찰.

- **[INFO]** `review/code/2026/08/11/{12_22_23,12_37_14}/*` 전체(리뷰어가 작성한 SUMMARY·
  testing.md 등 원본 리포트 포함, RESOLUTION.md 뿐 아니라)가 developer 의 커밋(`f5d485a52`)에
  실려 들어왔다
  - 위치: `review/code/2026/08/11/12_22_23/`, `review/code/2026/08/11/12_37_14/` (각 디렉터리 전체)
  - 상세: `CLAUDE.md` 의 쓰기 권한 표는 developer 에게 `review/**/RESOLUTION.md`만 명시하고,
    다른 리뷰 산출물(`SUMMARY.md`/`testing.md`/`meta.json`/`scope.md` 등)은 code-review-agents
    (`review/code/**`)의 소관이다. 그러나 이번 diff 는 developer 가 그 파일들의 **내용을 새로
    작성**한 게 아니라, 이미 `code-review-agents` 서브에이전트가 이전 두 라운드(12:22, 12:37)에
    직접 write 로 생성해 워크트리에 존재하던 파일들을 뒤늦게 `git add`+`commit` 한 것이다
    (`git log --oneline -- review/code/2026/08/11/12_22_23/ review/code/2026/08/11/12_37_14/`
    결과 커밋 이력이 `f5d485a52` 하나뿐 — 파일이 그 이전엔 미커밋 상태로만 존재했음을 뒷받침).
    이는 이 PR 자신의 리뷰 과정 기록이고, `CLAUDE.md` 정보 저장 표가 지정한 정확한 위치
    (`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에 그대로 있다. 커밋 본문도 "12_22_23 은
    리포트 7개만 있고 SUMMARY 가 없었다 — 게이트가 '빈 세션'으로 조용히 지나갈 수 있는 형태라
    뒤늦게 기록했다"고 스스로 이유를 밝히고 있다. Write 도구 권한(role별 write scope)과 git
    commit(이미 디스크에 있는 파일을 이력에 편입)은 다른 층위이므로, 이 커밋 행위 자체가
    write-권한 위반은 아니다. 다만 두 라운드분을 한 커밋에 몰아 넣어 "각 라운드 직후 즉시
    커밋" 관행과는 어긋난다.
  - 제안: 조치 불필요(범위 위반 아님). 다만 다음부터는 리뷰 라운드가 끝날 때마다 그 라운드의
    산출물을 바로 커밋해 두면 이런 "뒤늦은 일괄 커밋"이 반복되지 않는다.

- 그 외 항목(불필요한 리팩토링·기능 확장·무관한 파일·포맷팅·임포트·설정 변경) — 해당 없음.
  `triggers.controller.ts`/`triggers.service.ts`(비즈니스 로직)/`triggers.controller.spec.ts`
  는 이번 커밋에서 **전혀 건드리지 않았다**(diff 확인). CHANGELOG.md 도 이번 커밋 대상이 아니다.

## RESOLUTION 처분 재현 (직접 뮤테이션 실행)

`review/code/2026/08/11/12_37_14/RESOLUTION.md` 가 주장한 W1 처분("자매 둘의 실패경로 뮤턴트가
`save()` 자체를 실패 지점으로 옮기면 각각 RED")을 저장소 안에서 원본 파일을 `cp` 로 백업한 뒤
직접 재현했다(작업 종료 후 `cp` 로 원복, `git status` 로 잔여 0 확인).

| 뮤턴트 | 주장 | 재현 결과 |
|---|---|---|
| `rotateNotificationSecret`+`revokePerTriggerToken` 둘 다 `save()`→`recordAudit` 순서 반전 | RED (`:2444`) | **확인** — 정확히 `triggers.service.spec.ts:2444`(`notification_secret_rotated` 호출 1회 감지)에서 실패 |
| `revokePerTriggerToken` 만 반전 | RED (`:2453`) | **확인** — 정확히 `:2453`(`interaction_token_revoked` 호출 1회 감지)에서 실패, 전반부(2444)는 통과 |

두 뮤턴트 모두 `npx tsc --noEmit` 통과(유효한 뮤턴트, 컴파일 실패로 인한 거짓 RED 아님)를
확인했고, 원복 후 해당 테스트 파일 전체 재실행 시 73 passed / 1 skipped 로 그린이었다. 주장은
**정확히 재현됐다** — 인용한 줄 번호까지 일치한다.

"등재 2건"(코드 무수정) 주장도 diff 로 교차 확인했다: `plan/in-progress/spec-sync-auth-gaps.md`
에 `rotateBotToken` 5→6 구간 뮤턴트 잔존 갭이 실제로 새 체크리스트 항목으로 등재돼 있다. 두
번째 항목(documentation INFO — plan 캐비엇 미부착)은 RESOLUTION 이 "고치지 않기로" 처분했다고
명시하며 그 이유(완료 항목의 기존 서술 보존 관례)도 적혀 있어, diff 에 흔적이 없는 것 자체가
처분과 일치한다(누락이 아니라 의도적 무수정).

## `12_22_23` 지연 커밋의 정당성 (확인할 것 3)

`review/code/2026/08/11/12_22_23/` 는 **이 PR 자신의 첫 ai-review 라운드**(12:22)의 산출물이다.
`git log --oneline -- review/code/2026/08/11/12_22_23/`가 `f5d485a52` 단일 커밋만 보여주므로,
그 이전엔 파일이 워크트리에 미커밋 상태로만 존재했다는 뜻이다. 처분(코드 fix)은 이미
`9eb2c6088`에서 끝나 있었고, 이번 커밋은 그 **기록만** 뒤늦게 편입한 것 — 커밋 메시지가 이를
"밀린 위생"이라 명시적으로 자백하고 있다. `CLAUDE.md` 가 지정한 저장 위치(`review/code/**`)에
정확히 있고, 다른 PR·다른 세션의 산출물을 끌어온 게 아니라 **이 PR 자신의** 리뷰 이력이므로
범위 위반이 아니다. 유일한 흠은 "즉시 커밋" 관행과 어긋나 두 라운드가 한 커밋에 뭉쳐 들어간
점인데, 이는 위생상 아쉬움이지 범위 이탈은 아니다(위 INFO 항목 참고).

## 요약

이번 라운드의 실질 델타(`f5d485a52`)는 테스트 1건 추가 + 같은 문구 오류를 두 미러 지점(코드
주석·spec 표)에서 정정 + plan 체크리스트 1항목 등재 + 이 PR 자신의 리뷰 산출물 사후 커밋으로
정확히 구성돼 있으며, `triggers.controller.ts`/`triggers.service.ts`(비즈니스 로직)나
`triggers.controller.spec.ts`, `CHANGELOG.md` 등은 이번 커밋에서 전혀 건드리지 않았다 — 이전
라운드(`12_37_14`)가 이미 NONE 판정한 구간을 다시 흔든 곳이 없다. RESOLUTION 이 주장한 두
뮤테이션 결과(자매 둘 동시 반전 → `:2444` RED, `revokePerTriggerToken` 단독 반전 → `:2453`
RED)는 저장소 안에서 직접 재현해 인용 줄 번호까지 정확히 일치함을 확인했다. `12_22_23` 리뷰
산출물의 지연 커밋은 이 PR 자신의 감사 이력이라 정당하다. 범위 관점에서 이번 델타는 깨끗하고,
직전 라운드의 NONE 판정을 뒤집을 근거가 없다.

## 머지 가능 여부

**머지 가능.** 이번 델타는 범위 안이고, RESOLUTION 의 처분 주장은 직접 재현으로 사실 확인됐다.
추가로 열어야 할 항목 없음.

## 위험도

NONE
