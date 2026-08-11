# RESOLUTION — `13_51_44`

Critical 0 / Warning 6 **전부 처분** (커밋 `bafa7c007`).

## 세 건은 **내가 이 PR 안에서 재생산한 결함**이었다

이 PR 의 주제가 "자매 사이에서 규칙이 조용히 갈리는 것을 막는다" 인데, 그 작업을 하면서
같은 클래스를 세 번 냈다. 리뷰어 표현대로 "이 PR 스스로가 경계하는 문제 유형을 소규모로
재생산" 했다.

| # | 내가 낸 것 | 처분 |
|---|---|---|
| W1 | `walkTree` 에 **아무도 안 쓰는 분기** 추가 — 이 폴더가 반복해 지적해 온 "뮤테이션으로 발각되는 도달 불가 분기" 그 형태 | 제거. 게다가 절대경로 base 는 `relPath` 에 `../` 를 만들어 **함수 자신의 계약을 깬다** |
| W2 | `@deprecated` 별칭의 근거가 **실측과 어긋남** — "외부 호출부 6곳" 이라 썼는데 0곳 | 별칭 삭제 + 잔존 3곳 치환 |
| W5 | 같은 설명을 **4곳에 복제** — 이 PR 이 없애려던 중복의 문서판 | `tree-walk.ts` 헤더를 SoT 로, 나머지는 포인터 |

## W3 — 숫자를 틀렸다, 그리고 **하필 그 숫자**였다

"2075 → **2076**" 이라 적었는데 **2077** 이다. `tree-walk.ts` 만 만든 중간 상태에서 재고,
그 뒤 `tree-walk.test.ts` 를 추가했다 — 둘 다 `codebase/frontend/src` 하위 `.ts` 라 수집
대상이다.

> **이건 "조용한 스코프 변경 0" 을 정확한 카운트로 증명하려던 바로 그 숫자다.** 증명의
> 근거가 되는 값을 **편집이 더 남은 중간 상태에서** 쟀다. 다시 재라가 아니라 —
> **문서에 쓰는 그 시점의 실제 수량으로** 적어야 한다. 사전 필터 JSDoc 수치도 같은 이유로
> 밀려 있었고, 이번엔 모든 편집을 끝낸 뒤 다시 재서 넣었다(통과 247개 = 11.9%).

## W4 — plan 의 요구 자체가 원리상 불가능했다

"각 가드의 대상 파일 집합이 통합 전후로 동일한지를 **테스트로 고정할 것**" — 옛 구현이
지워지면 비교 대상이 사라지므로 테스트로 남길 수 없다. 실제로 한 것은 (a) 통합 직전/직후
7개 집합의 **일회성 dump 대조**(원소·순서까지)와 (b) 새 구현의 필터 배선을 합성 fixture 로
**forward 고정**이다. plan 문구를 그렇게 정정했다.

**리뷰어가 그 갭을 스스로 메웠다** — `git show <pre>:...` 로 옛 구현 5개를 scratch 에 나란히
두고 실저장소 데이터로 실행해 **7/7 전부 byte-identical** 을 독립 재현했다. 내 dump 대조보다
강한 증거다.

## W6 — plan 이동, 그리고 이동이 가드를 깨뜨렸다

`plan/complete/` 로 `git mv` + `status: complete`. `plan-lifecycle.md §3` 이 "이동만 담은
별 PR" 을 금지하므로 이 PR 안에서 했다.

**이동하자 링크 가드가 1건 RED 를 냈고 그게 정상이다** — `harness-env-value-subpattern-dedup.md`
가 형제 경로로 이 plan 을 가리키고 있었다. 상대경로를 고쳤고, **그 문서의 "walker 3벌"
서술도 함께 stale 해져 같이 고쳤다**. 자매 문장이 안 고쳐지는 형태가 또 나올 뻔했다.

부수: `spec_impact: none` 이 거짓이 됐다(이 PR 이 `spec/conventions/spec-impl-evidence.md`
를 건드리게 됐다 — requirement INFO 처분). 실제 목록으로 정정, Gate C 818 passed.

## 등재 처분 (코드 무수정) — 3건

| 출처 | 내용 | 왜 지금 안 고치나 |
|---|---|---|
| testing INFO | `spec-frontmatter-parse.ts` 전용 캐시-우회 fixture 부재 | 회귀는 `plan-scan.test.ts` 에 있고, 코드 주석이 잔여 위험을 이미 명시 |
| performance INFO | `rel(full)` 을 `skipDir` 마다 계산(~1.13ms) | 스위트 대비 0.02%. `skipDir.length > 1` 감지는 이득 1ms 미만 |
| maintainability INFO | `plan-scan.ts` 449줄 | 하위 유틸을 실제로 공유해 억지 결합이 아니다. 다음 확장 시 재검토 |

## 검증

- docs 가드 **2892 passed**(plan 이동으로 per-plan 테스트 1건이 in-progress → complete 로 이동).
- Gate C 단독 **818 passed**, 타입 오류 0, lint 신규 0.
- 뮤테이션: 내 6종 + 리뷰어 독립 재현분(옵션 3축 + 사전 필터 2방향).

## 남은 절차

W6·`spec_impact` 처분이 `spec/` 을 건드렸으므로 consistency `--impl-done` 이 필요하다.
그리고 이 fix 가 `codebase/**` 를 건드렸으므로 확인 라운드를 한 번 더 돈다.
