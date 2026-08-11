# 변경 범위(Scope) Review — webchat `wc:boot` apiBase 스킴 검증 (라운드 5, 델타: `df1375208` + `4daeaa534`)

## 검증 절차 (직접 실측)

- `git show df1375208 --stat`: `codebase/channel-web-chat/src/widget/use-widget.ts` 단일 파일, `10 insertions(+), 2 deletions(-)`. 두 hunk 모두 JSDoc/inline 주석 블록 안이며 실행 코드(로직) 줄은 한 줄도 바뀌지 않았다 — 커밋 메시지의 "실행 코드 0줄 변경(주석 전용)" 주장과 diff 가 일치.
- `git log --oneline --all -S "직접 로드/샘플 대비" -- codebase/channel-web-chat/src/widget/use-widget.ts` / 동일 방식으로 두 번째 문구도 추적 → 원문의 출처는 `a652f8733`(최초 위젯 PR #384) 하나뿐이고, 이번 브랜치에서 그 문구를 건드린 커밋은 `df1375208` 이 유일 — "최초 위젯 PR 유래" 서술이 실측과 일치.
- `git log --oneline --all -S "직접 로드/샘플 전용" -- spec/7-channel-web-chat/4-security.md` → 그 spec 문장("쿼리 경로를 '호스트 없는 직접 로드/샘플 전용'으로 읽으면 안 된다")을 도입한 커밋은 `4479e771b` — **같은 브랜치(현재 PR 체인) 안**의 더 이른 커밋이다. 즉 `df1375208` 이 정정한 불일치는 이 PR 자신의 앞선 커밋이 spec 을 고치면서 만든 것이지, 이번 PR 과 무관한 과거 유산이 아니다.
- `grep -n "샘플\|직접 로드" codebase/channel-web-chat/src/widget/use-widget.ts` (현재 HEAD) → 남은 매치는 `L64`(`직접 로드 등` — origin soft-allow 주석, 무관 맥락)와 `L1321`(`직접 로드 폴백` — 호출부 구조 설명, 무관 맥락) 뿐이고, 실제로 고쳐진 두 자리(`L222`, `L1384`)는 이제 "**아니다**"/"샘플 전용으로 읽고 지우면 전부 깨진다" 로 정확히 뒤집혀 있다 — "복제본 정확히 2곳" 주장과 일치, drive-by 로 다른 자리를 건드리지 않았음도 확인.
- `git diff df1375208~1 4daeaa534 --stat` (직전 라운드 `16_06_02` 베이스라인 → 현재 HEAD 전체 델타): `use-widget.ts`(12줄) + `review/code/2026/08/11/16_06_02/**` 12개 신규 파일(리뷰 산출물)뿐. 그 외 코드·spec·plan·설정 파일은 이번 델타에 전혀 등장하지 않는다.
- `4daeaa534` stat: 전부 `review/code/2026/08/11/16_06_02/*.md`·`*.json` 신규 파일 — CLAUDE.md 가 지정한 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 저장 위치와 일치. 코드/spec/plan 변경 없음.

## 발견사항

없음.

## 요약

이번 델타(`df1375208` + `4daeaa534`)는 요청 그대로다. `df1375208` 은 `use-widget.ts` 단일 파일의 주석 두 곳만 고치며 실행 로직은 한 줄도 건드리지 않았고, 그 두 주석은 직전 라운드 security 리뷰어의 비-blocking INFO 를 그대로 처분한 것이다. 고친 주석의 원문은 최초 위젯 PR(#384)에서 왔고, 그 문구와 어긋나게 된 spec 문장은 **같은 PR 체인 안의 더 이른 커밋(`4479e771b`)**이 만들었으므로, 이번 커밋은 무관한 과거 유산을 건드린 drive-by 가 아니라 이 PR 자신이 연 불일치를 닫는 후속 정정이다. `4daeaa534` 는 리뷰 산출물만 `review/code/**` 규약 위치에 추가했을 뿐 코드·spec·plan 변경이 없다. 포맷팅·임포트·설정·기능 확장·무관한 리팩토링 등 범위 이탈 신호는 없다. 억지로 만들 발견이 없다 — 직전 라운드 7명 전원 NONE 판정 이후의 이 작은 후속 델타도 동일하게 범위 내(NONE)이며 수렴 상태를 유지한다. 머지 가능하다고 판단한다.

## 위험도
NONE
