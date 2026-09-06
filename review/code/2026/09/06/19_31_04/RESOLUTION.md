# RESOLUTION — `review/code/2026/09/06/19_31_04` (+ consistency `19_31_06`)

**원 결과**: 코드 리뷰 Critical **0** · WARNING 2 ·
consistency **BLOCK: NO** · Critical **0** · WARNING 2
**처분**: **라운드 통과.** 네 WARNING 전부 리뷰어·checker 가 스스로 *"조치 불요 / 이미
등재 / 차단 사유 아님"* 으로 판정했다. INFO 1건만 plan 에 새로 등재했다.

---

## 통과 판정의 근거 — 남은 WARNING 이 무엇인가

| 출처 | 항목 | 리뷰어 본인의 판정 |
|---|---|---|
| 리뷰 W1 | 한 브랜치에 네 관심사 | *"조치 불요할 수 있음(근거 충분히 disclose됨). 향후 유사 상황에서는 분리 권장"* |
| 리뷰 W2 | 도메인 세부 에러 코드 표현 이원화 | *"이미 planner 항목으로 등재됨. 신규 조치 요구 아님"* |
| consistency W1 | 같은 사안 (4개 checker 중복) | *"조치 불요 — 이미 등재"* |
| consistency W2 | `WorkflowVersionDetail` 동명이형 | *"조치 불요 — 개명·공유 타입 승격 등재됨"* |

**즉 남은 것은 이 PR 이 고칠 수 있는 결함이 아니라, 다음 planner 턴이 문서로 닫을
정책 결정과 이 브랜치의 구조에 대한 사후 권고다.**

INFO 11건도 전부 확인 기록·기등재·범위 밖이다. 특히 직전 라운드 지적이 이번에 해소
확인됐다 — Swagger `@ApiConflictResponse`(consistency convention_compliance),
`joinedAt` 계약, JSDoc bare 시각 축.

## 새로 등재한 것 — INFO#2 (side_effect)

`TriggersService` 의 `save()` 호출 8곳 중 충돌 래핑은 `create`/`update` **둘뿐**이다.
나머지 여섯은 `endpointPath` 를 안 건드리므로 **지금은 옳다.**

**비대칭이 남는다** — 앞으로 `endpointPath` 를 쓰는 `save()` 가 생기면 그 경로만 미가공
500 이 되고, **아무도 알려 주지 않는다.** 두 방향(저장 직전 한 자리로 모으기 / AST 래칫)
중 이 저장소 관행에 가까운 것은 래칫이라고 적어 등재했다 — 비대칭을 문서가 아니라
테스트가 들고 있게 된다.

## 조치하지 않은 INFO (사유)

| # | 사유 |
|---|---|
| 1 | 실유출 수정 확인(양성 기록) |
| 3 | 파서 변경의 전역 영향 — **의도된 것**이고 회귀 테스트로 덮였다. in-flight PR 의 게이트 판정이 넓어질 수 있다는 사실은 PR 설명에 적는다 |
| 4 | 트리거 409 e2e 부재 — 이미 등재(`541`행) |
| 5 | `error-codes.md §4.2` 인용의 컨테이너 형태 차이 — 인용 자체는 사실이고 구현은 `2-trigger-list.md §3` 과 정확히 일치. 여유 시 주석 한 줄 |
| 6 | `WorkflowVersion*Dto.creator` §5.4 금지 조합 — 래칫으로 동결, 이미 등재 |
| 7 | `joinedAt` — 확인 기록 |
| 8 | 유저 가이드 에러 코드 표 — 신규 사용자 노출 없음(frontend 소비 grep 0건) |
| 9 | `_parse_frontmatter_code` 비대화 — 다음에 만질 때 |
| 10·11 | 전역 필터 SoT · `integration-oauth` 치환 — 둘 다 실측과 함께 이미 등재 |

## 검증

lint / unit(backend **9,491** · 452 suites) / build / e2e(299) 전부 PASS.
