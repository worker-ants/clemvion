# RESOLUTION — `review/code/2026/09/06/12_53_28` (+ consistency `12_53_29`)

**원 결과**: 코드 리뷰 Critical **0** · WARNING **1** · 위험도 LOW ·
consistency **BLOCK: YES** · Critical **1**
**처분**: 코드 리뷰 WARNING 1건 + INFO 3건 수정 · consistency Critical 은 **planner 턴**으로
근본 정정 (권한 밖 `spec/` 편집이라 우회하지 않았다)

---

## W1 (testing) — "세 형태를 센다" 고 적어 놓고 둘만 관측하고 있었다

리뷰어가 `CITATION_PATTERNS[1]`(날짜+시각 `2026-09-05 23_30_01`)을 **통째로 지우고** 스위트를
돌렸다. **전부 초록.** 위반 fixture 3건이 나머지 두 정규식으로 다 잡혀서, 그 정규식이 죽은
것을 아무도 못 봤다.

**뿌리는 fixture 부재가 아니라 `findCitation` 이었다.** 그 함수가 **첫 매치 하나만** 돌려주고
있었다 — 한 JSDoc 에 두 형태가 섞이면 뒤 형태는 **영영 관측되지 않는다**. 즉 fixture 를 넣어도
그 자리에 전체 경로 인용이 먼저 있으면 여전히 죽은 채로 초록이었을 것이다. 리뷰어의 W1(검출력)
과 INFO#9(진단 완전성)는 같은 뿌리의 두 증상이었다.

| 고친 것 | 무엇 |
|---|---|
| `findCitation` → `findCitations` | 형태별 첫 매치를 **전부** 모아 반환. `HitInfo.citation: string` → `citations: readonly string[]` |
| fixture | `ViolationFieldCitationDto.avatarUrl` — **날짜+시각** 형태 위반 1건 |
| spec | 목록 비교 옆에 **형태별 관측 단언** 신설 — `startsWith('review/')` · bare 시각 · 날짜+시각 셋을 각각 문다 |

**뮤테이션 재현**: 리뷰어와 같은 뮤턴트(날짜+시각 정규식 제거) → **RED**. 고치기 전에는
GREEN 이던 그 뮤턴트다.

## INFO#11 (testing) — 같은 헬퍼라도 **호출 지점마다** 관측돼야 한다

`unwrap` 은 두 자리에서 불린다: `relations` 값과 `select` 값. fixture 는 `relations` 쪽만
태우고 있었다 — `hasProjectionFor` 안의 `unwrap(sel.initializer)` 를 지워도 초록이었다.

`violationSelectBooleanWrapped` (`select: { creator: true satisfies boolean }`) 추가 +
전용 단언. **뮤테이션**: 그 `unwrap` 호출 제거 → **3 RED**.

> 이 브랜치에서 **세 번째** 같은 형태의 실수다 (eager 축 검출력 0 · 날짜+시각 정규식 ·
> `select` 쪽 `unwrap`). 공통 뿌리는 *"술어를 새로 쓸 때 음성 대조군만 두고 양성을 안 둔다"*
> 이고, 세 번 다 **GREEN 이 증거가 아니었다**.

## INFO#9 (maintainability) — W1 과 같은 뿌리

위 표의 `findCitations` 로 함께 해소. 함수 JSDoc 에 *"첫 매치만 돌려주던 판이 두 가지를
동시에 망쳤다"* 를 근거와 함께 남겼다.

## INFO#13 (documentation) — plan 번호 목록 순서

`spec-draft-nullable-notation-followups.md` 완료 노트의 `1.`→`3.`→`2.` 를 등장 순서대로 정정.

---

## 조치하지 않은 INFO (사유)

| # | 사유 |
|---|---|
| 1 | 이미 `spec-draft-nullable-notation-followups.md` 에 planner 후속으로 등재됨 (이 draft 가 아니라 그 plan 이 소유) |
| 2 | `USER_SECRET_KEYS` 는 **자격증명·토큰류** 7컬럼으로 의도적 스코프. `pendingEmail`·`oauthProviderId` 가 응답에 실리는 경로가 실측되면 그때 넓힌다 |
| 3 | 중첩 `relations`/`select` 조합은 저장소 0건(grep). 어긋나도 **false positive 방향**(안전)이라 급하지 않다 |
| 4·5·6·7·8·17 | 확인 기록 — 조치 불요 판정에 동의 |
| 10 | `review-citations.md §4`(소급 정리 대상 아님) 범위. 다음에 만질 때 |
| 12 | `enclosingName` 의 `'<module>'` 폴백 — 모듈 최상위 로드 형태가 저장소 0건이고, fixture 를 만들면 **저장소에 없는 형태를 위해 fixture 를 짜는 것**이 된다. 가드 확장 시 함께 |
| 14 | `listMembers` 오버페치 — **PR 범위 밖**. 응답 노출은 없고(`.map()` 재투영) DB→앱 전송 낭비만. 래칫 화이트리스트에 올라 있어 **더 나빠지면 잡힌다** |
| 15 | `select: false` 는 사용자가 **다른 방식을 택했다** (AskUserQuestion → "정적 가드 + 응답 계약"). 19곳 로더 전제는 CHANGELOG 에 실측과 함께 기록됨 |
| 16 | `findByWorkflow` 페이지네이션 — 사전 존재 동작. 이번 diff 는 `select`/`relations` 절만 건드렸다 |

---

## consistency `12_53_29` Critical — planner 턴으로 넘겼다

`review-citations.md` 의 `## Rationale` 이 *"이 규약에는 **시행하는 코드가 없다**"* 라고
적는데, 이 PR 의 `dto-jsdoc-citation-guard.ts` 가 그 문장을 **거짓으로 만들었다.**

**자기-반증형 소정정 예외를 쓸 수 없다.** `CLAUDE.md` 의 다섯 조건 중 **조건 1**이 깨진다 —
그 문장은 developer 가 쓴 예고가 아니라 **2026-09-05 planner 턴**이 등재한 Rationale 이다
(`git log -S` 로 커밋 `90c1751e8` 확인). 조건 2도 성립하지 않는다: 예고·트리거가 아니라
`code:` 필드의 **해석 근거**다.

그래서 우회하지 않고 `plan/in-progress/spec-draft-review-citations-enforcement.md` 로
planner 턴을 열었다. 처분은 그 draft 와 `--spec` 게이트 산출물
(`review/consistency/2026/09/06/13_06_22` → `13_18_59`)에 있다.
