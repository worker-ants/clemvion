# 변경 범위(Scope) Review — 커밋 `4479e771b`(fix) + `1887aaec9`(리뷰 산출물)

## 점검 배경

직전 라운드(`15_50_53`)에서 나(scope) 는 LOW / 머지 가능 · "거의 수렴 — 잔여 1줄 정정 권고"
로 정리했다. 그 잔여 1줄(`use-widget.ts:197` 의 죽은 `§R0` 참조)과, 같은 라운드가 집계한
WARNING 7건(전 리뷰어 합산)이 이번 커밋으로 처분됐다고 주장한다. `git show --stat`/`Read`
로 직접 재검증했다.

## 1. `git show 4479e771b --stat` — WARNING 7건과 1:1 대응하는가

```
codebase/.../use-widget-eager-start.test.ts      | +6 -2
codebase/.../use-widget.test.ts                  | +1 -1
codebase/.../use-widget.ts                       | +2 -3
plan/complete/webchat-boot-apibase-scheme-validation.md | +2 -1
spec/7-channel-web-chat/2-sdk.md                 | +1 -1
spec/7-channel-web-chat/4-security.md            | +1 -1
```
(6 files changed, 12 insertions(+), 10 deletions(-))

`review/code/2026/08/11/15_50_53/SUMMARY.md` 의 WARNING 7건(`## Warning — 전부 고침` 표)과
diff 내용을 항목별로 대조했다 — **전부 1:1 대응, 범위 밖 파일·행 없음**:

1. **6명 수렴 — 죽은 `§R0` 참조** → `use-widget.ts:194-198` JSDoc 이 "spec §R0 에서 그 문장을
   정정하면서 여기는 안 고쳤다..." 는 4줄짜리 이력 설명을 "정정 이력은 `4-security.md` §R7
   참고(같은 서술을 여기 되풀이하지 않는다)" 1줄로 축약. `grep -n "§R0" codebase/... spec/...`
   실측 결과 코드·spec 어디에도 살아있는 `§R0` 참조가 없고(`4-security.md:272` 에 `### R7.`
   섹션 실재 확인), plan 의 역사 서술("당시 §R0")만 의도대로 남았다.
2. **cross_spec — `§1` 표 상호배타 오서술** → `4-security.md` §1 `apiBase 입력 검증` 행 1줄
   변경. "경로는 둘이다: host 없는 직접 로드용 쿼리 / 정상 임베드용 boot" (상호배타 서술) →
   "경로는 둘이고 정상 임베드에서 둘 다 순차로 발동한다"(SDK 의 `resolveIframeTarget`→boot
   순서 서술 + 제거 위험 명시)로 정정. 다른 행·다른 섹션은 무변경(diff 1줄).
3. **scope·plan_coherence·requirement (3명) — `spec_impact` 에 `2-sdk.md` 누락** →
   `plan/complete/...md` frontmatter 에 `- spec/7-channel-web-chat/2-sdk.md` 1행 추가. 확인됨.
4. **requirement·documentation — "450 passed(신규 8)" → "451(신규 9)"** → 같은 plan 파일
   본문의 검증 수치 문장 갱신. 확인됨.
5. **documentation — 거짓 문장의 4번째 복제본**(테스트 주석) → `use-widget.test.ts:89` 의
   `"applyConfig 가 자기 자리에서 실패하도록 둔다"` 주석을 `"applyConfig 가 조용히 반환한다
   (진단은 safeApiBase 의 warn 뿐)"` 로 정정. 확인됨(테스트 로직 자체는 무변경, `expect` 라인
   그대로).
6. **convention — `2-sdk.md` 코드펜스 안 마크다운 리터럴 렌더** → `` ```ts `` 블록 안 주석의
   마크다운 링크(`[4-security §1 ... §R7](./4-security.md)`)를 산문(`4-security.md §1·§R7
   참조`)으로 교체. 확인됨.
7. **side_effect — e2e 가 `location.search` 만 캡처**(pathname 유실 소지) →
   `use-widget-eager-start.test.ts` 에서 `originalHref = window.location.href` 로 전체 캡처
   후 `replaceState(null, "", originalHref)` 로 복원. 변수명 변경(`original`→`originalHref`)과
   주석 1줄이 함께 붙었으나 모두 이 수정 자체를 설명하는 것으로, 무관한 리팩터는 없다.

12줄 삽입 / 10줄 삭제라는 diff 크기가 위 7항목(전부 주석·문서 정정 + 1줄 assignment 변경)의
실질 변경량과 정확히 비례한다. 로직(런타임 분기·타입·API 시그니처)에 손댄 곳은 0건 — 전부
JSDoc/spec 산문/테스트 주석/frontmatter/e2e 캡처 대상이다.

## 2. `spec_impact` 에 `2-sdk.md` 추가 여부

확인됨 (`plan/complete/webchat-boot-apibase-scheme-validation.md` frontmatter). 이 PR 이
`4-security.md` 뿐 아니라 `2-sdk.md` 도 실제로 편집(§1·§R7 상호참조 주석)하므로, Gate C 선언
범위가 실제 diff 범위와 이제 정확히 일치한다.

## 3. `4-security.md §1` 서술 변경 — 이 PR 범위인가

**범위 내로 판단한다.** 이번에 바뀐 §1 행은 신규 spec 정책 도입이 아니라, **이 PR 이 이전
라운드에 자기 손으로 이미 써넣은 문장의 사실 오류**를 고친 것이다 — §1 `apiBase 입력 검증`
행 자체는 1라운드에서 이 PR 이 신설했고(`safeApiBase` 두 경로 검증 서술), 이번 수정은 그
문장이 두 경로를 상호배타로 그린 부분만 정정한다("둘 다 순차 발동"). 새 spec 파일도, 새 표
행도, 새 정책도 추가되지 않았고 `2-sdk.md`/`4-security.md` 둘 다 이미 `spec_impact` 로
선언된 파일이다. "동작 변경의 서술 동기화"(§역할 경계 절이 스스로 규정한 프레임)와 "새 사실
문서화" 중 굳이 나누자면, SDK 의 iframe-쿼리→boot 순차 발동 자체는 **선재 사실**(이 PR 이
만든 동작이 아님)이지만, 그 사실을 정확히 서술해야 하는 이유는 **이 PR 이 그 행을 잘못
서술했기 때문**이다. 즉 자기 자신이 도입한 문장의 정확성 교정 — 새 트랙으로 분리할 이유가
없다. cross_spec 리뷰어가 잡은 것도 "제거 위험"(쿼리 폴백을 샘플 전용으로 오인해 지우면 정상
임베드가 깨진다)이라는, 이 PR 의 §1 신설 서술이 초래할 수 있었던 직접적 위해다.

## 4. 4라운드를 거치며 plan 범위를 벗어났는가

벗어나지 않았다. 커밋 이력(1라운드 구현 → `15_16_20` 리뷰 → `d8abc7003` fix → `15_32_44`
리뷰 → `99d3e9000` fix → `15_50_53` 리뷰 → `4479e771b` fix) 전체에서 새로 추가된 코드
표면은 `safeApiBase(raw, source)` 일반화 + `mergeBootConfig` 신설 + 그 회귀 테스트뿐이고,
이번(4번째) fix 는 그마저도 건드리지 않은 채 **3라운드 리뷰가 낸 문서/주석 정정만** 처리했다.
`codebase/` 로직 변경은 0건(JSDoc·테스트 주석·e2e 캡처 대상만). 새 의존성·새 설정·새 API
표면 없음.

role 경계(`developer` 가 `spec/` 직접 편집) CRITICAL 은 2라운드(`15_32_44`)에서 저장소 선례
(`cbc0d33760`·`da078a63f4`)로 이미 HIGH→LOW 하향됐고, 이번 커밋도 그 궤도(plan frontmatter
`owner: developer + planner` 로 선언된 범위) 안에서만 spec 을 고쳤다 — 새로운 거버넌스 우회
없음.

리뷰 산출물 커밋(`1887aaec9`, 19 files, review/code/**·review/consistency/** 전용)은 이
저장소의 표준 관행(리뷰 산출물 commit)과 일치하고 `codebase/`·`spec/`·`plan/` 어느 것도
건드리지 않는다.

## 요약

`4479e771b` 은 직전 라운드(`15_50_53`)가 12명(코드 7 + consistency 5) 전체 집계로 낸
WARNING 7건 전부와 파일·줄 단위로 정확히 1:1 대응하며, 요청 밖 리팩터링·포맷팅·임포트
정리·무관 파일 수정은 발견되지 않았다. 이번에 새로 들어온 `4-security.md §1` 서술 변경은
새 정책 도입이 아니라 이 PR 자신이 신설한 문장의 사실 오류(경로 상호배타 오서술) 정정이라
같은 PR 범위 안에 있고, `spec_impact` 는 `2-sdk.md` 를 추가해 실제 편집 범위와 이제 정확히
일치한다. 4라운드 전체를 통틀어 코드 표면은 `safeApiBase`/`mergeBootConfig` 하나로 계속
수렴돼 있고, 이번 fix 는 로직을 전혀 건드리지 않은 순수 문서/주석 정정이다.

**머지 가능 여부**: 머지 가능. scope 관점에서 남은 blocking 요소가 없다.

**수렴 여부**: 수렴했다. 직전 라운드가 지적한 유일한 잔여(죽은 `§R0` 참조)와 다른 5명이 낸
WARNING 이 전부 처분됐고, 이번 라운드의 재검증에서 새 CRITICAL/WARNING 은 발견되지 않았다.

**이번이 마지막 라운드가 될 수 있는가**: 그렇다고 본다. 4라운드에 걸쳐 발견의 성격이
"배선 결함(1) → 서술 정정 누락(2) → 참조 정합(3)"으로 계속 얕아지다 이번엔 scope 관점에서
새로 지적할 거리가 없는 지점에 도달했다. 다만 이 판단은 scope 단일 관점이며, 같은 라운드의
다른 리뷰어(특히 testing·requirement·documentation)가 실행 검증("451 passed" 등 수치)까지
재확인해 전원 NONE/LOW 로 수렴함을 확인해야 최종 결론이 완성된다.

## 위험도

NONE

STATUS: OK
