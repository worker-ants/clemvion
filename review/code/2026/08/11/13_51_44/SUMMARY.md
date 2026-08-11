# ai-review SUMMARY — `13_51_44` (forced 7 전원 실행)

대상: `claude/docs-guard-walker` vs `origin/main`. 문서 가드의 손수 짠 DFS 여섯 벌을
`walkTree` 하나로 통합 + 무관측 판정 고정 + Gate C 판정 함수 이전.

## 집계 — 7/7 착지 (디스크 파일로 확인)

| reviewer | Critical | Warning | 위험도 |
|---|---|---|---|
| side_effect | 0 | 0 | LOW |
| performance | 0 | 0 | LOW |
| testing | 0 | 0 | LOW |
| scope | 0 | 1 | LOW |
| requirement | 0 | 1 | LOW |
| documentation | 0 | 2 | LOW |
| maintainability | 0 | 3 | LOW |
| **합계** | **0** | **7** (중복 제거 후 6) | LOW |

## 리뷰어들이 **직접 재현**한 것

이 라운드는 주장을 읽고 넘기지 않고 실측한 비율이 높았다:

- **testing**: 저장소 밖 scratch 에 `node_modules` symlink 로 복제해 세 옵션을 각각 뮤테이션.
  `skipDir` 무력화 → **정확히 8건 RED**(내 주장과 일치), `recurse` → 35건, `includeFile`
  제거 → 612건. 사전 필터를 순진한 조건으로 좁히면 **정확히 1건만** RED, 필터 통째 제거는
  전량 GREEN(계약을 넓히지 않으므로 정상). 그리고 `git show <pre>:...` 로 **옛 구현을 나란히
  실행**해 7개 수집기 전부 **원소·순서까지 byte-identical** 임을 독립 확인.
- **performance**: 9회 반복 중앙값으로 재측정 — old 119ms → new 74ms(디스크 포함),
  62.7ms → 21.5ms(CPU 격리). 가장 큰 파일(699KB)에서 필터 비용 ~46μs vs 전체 스캔 ~2.78ms
  로 **60배 싸다**. `walkTree` 클로저 오버헤드 +22%(3.4ms)는 스위트 총 시간의 0.4% 미만.
- **scope**: 13개 체크 항목을 diff 로 **전수 대조** — 허위 체크 0건. "3벌 → 6벌" 정정도
  base 커밋에서 직접 세어 확인(정확히 6곳).
- **documentation**: 9개 주장을 표로 판정 — 7개 참, 2개 부정확(아래 W3).

## Warning (중복 제거 후 6건) — **전부 고침**

| # | reviewer | 내용 |
|---|---|---|
| W1 | side_effect · maintainability · testing (**3명 수렴**) | `walkTree` 의 `path.isAbsolute(base)` 가 **죽은 분기** — 다섯 호출부 전부 상대경로만 넘기고, 뮤턴트가 2900건 전량 GREEN |
| W2 | maintainability · documentation | `SpecMdFile` `@deprecated` 별칭의 근거("외부 호출부 6곳")가 **거짓** — 실측 0곳. 게다가 같은 파일이 `@deprecated` 를 선언하며 자기 시그니처에 계속 씀 |
| W3 | documentation | **"2075 → 2076" 이 2077 이어야 한다** — 중간 상태에서 쟀다. 사전 필터 수치도 1~2 밀림 |
| W4 | requirement | plan 이 요구한 "집합 동일을 **테스트로 고정**" 이 문자 그대로는 미이행 — 원리상 불가능(옛 구현이 지워지면 비교 대상이 사라진다) |
| W5 | maintainability | `_` 접두 비대칭 설명이 **4곳 중복** — 규칙이 바뀌면 일부만 갱신될 자리 |
| W6 | scope · requirement · documentation (**3명 수렴**) | 13/13 체크인데 plan 이 `complete/` 로 이동 안 됨 + `status` stale |

## INFO 처분

| 출처 | 내용 | 처분 |
|---|---|---|
| requirement | `tree-walk.ts` 가 `spec-impl-evidence.md` `code:` 에 없다 | **고침** (자매 둘은 등재돼 있었다) |
| documentation | `plan-scan.ts` 헤더 "네 벌" stale | **고침** |
| testing | `spec-frontmatter-parse.ts` 전용 캐시-우회 fixture 부재 | 등재 — 코드 주석이 잔여 위험을 이미 명시 |
| performance | `rel(full)` 을 `skipDir` 마다 계산(~1.13ms) | 무조치 — 스위트 대비 0.02% |
| maintainability | `plan-scan.ts` 449줄, 세 결이 한 파일 | 무조치 — 하위 유틸을 실제로 공유. 다음 확장 시 재검토 |

## RISK: LOW
## CRITICAL_COUNT: 0
## WARNING_COUNT: 6
