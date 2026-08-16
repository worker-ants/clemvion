# RESOLUTION — `17_35_49` (2라운드)

1라운드(`17_12_34`) fix 이후 코드가 바뀌어 게이트가 재리뷰를 요구했다. **forced 7 + performance**
= 8명 실행. **CRITICAL 0 · WARNING 3**(+ documentation 4).

## 처리

| # | Reviewer | 발견 | 조치 |
|---|---|---|---|
| 1 | maintainability | 1라운드에서 고친 **null-hiding 캐스트를 바로 위 자매 자리(`as NodeExecution`)에 그대로 재도입** | **수정.** `ResponseNodeExecution` 신설, 캐스트 제거 |
| 2 | testing | copy-on-change 최적화가 **참조 동일성으로 검증되지 않음** — 무조건 spread 로 되돌리는 뮤턴트가 GREEN | **수정.** `⑤-c` 참조 동일성 테스트 추가 + **뮤턴트로 RED 확인** |
| 3 | scope | plan 위생 chore 가 핵심 과제와 같은 브랜치에 번들 | **무조치 — 근거 아래** |
| 4 | documentation | `CHANGELOG.md` 마크다운 링크에 URL 누락 | **수정** |
| 5 | documentation | `stop()`/`stopInternal()` 분리 후 **TOCTOU 계약 JSDoc 이 얇은 wrapper 에 남음** | **수정.** 본체로 이동 + wrapper 에 포인터 |
| 6 | documentation | plan 문서에 3줄 문단이 복사-붙여넣기로 **중복** | **수정.** 중복 제거 |
| 7 | documentation / requirement | `plan-lifecycle.md` 의 "plan 레벨 3건" 실측치가 **이 PR 자신의 뒷 커밋 때문에 stale**(실제 4건) | **수정.** 4 로 정정 + 실패 형태를 문서에 명시 |

## #3 — 무조치, 근거는 프로젝트 규약이다

scope reviewer 는 plan 위생 chore(`fafb57e46`)를 별 PR 로 분리하라고 제안했다. 그러나
[`.claude/docs/plan-lifecycle.md §3`](../../../../../.claude/docs/plan-lifecycle.md) 이
정반대를 규정한다:

> **이동은 마지막 작업 PR 안에서**: … `chore(plan): mark <name> complete` 형태의 **별
> commit** 으로. **plan 이동만 담은 별 PR 분리 금지** (PR 증식 + 이동 누락 패턴 차단).

현재 구조가 정확히 그것이다 — **작업 PR 안의 별 commit**. 제안을 그대로 받으면 규약을
위반하게 되므로 채택하지 않는다. (리뷰어가 이 규약을 인용하지 않은 것은 프롬프트 번들에
그 문서가 없었기 때문으로 보인다.)

## `--impl-done`(`17_35_13`) WARNING 도 같은 턴에 반영

**BLOCK: NO** 였고 유일한 WARNING 은 *"응답 DTO 4곳 Swagger JSDoc 이 마스킹 부수효과 미반영"*
이었다. `PROJECT.md` 가 **같은 turn 갱신 의무 · 사후 보정 PR 패턴 금지**를 규정하므로 이 PR
안에서 반영했다 — `execution-response.dto.ts` 3곳 + `background-run-response.dto.ts` 1곳에
"자격증명 값은 마스킹되어 반환(DB 원문과 다를 수 있음)" + SoT 포인터.

INFO 두 건도 함께 닫았다 — `12-background.md` frontmatter `code:` 에
`redact-stored-error.ts` 등재, `1-data-model.md §2.14` 에 마스킹 역참조 행 추가(**§2.14 가
바로 이번 CRITICAL 의 근거였던 표**라 그 자리에 포인터가 없는 것이 특히 나빴다).

## 판별력

`⑤-c` 는 장식이 아니다 — copy-on-change 삼항을 지우는 뮤턴트를 python 으로 만들어
**RED(1 failed / 39 passed) 확인** 후 원복했다. 값 비교만 하던 `⑤-b` 는 같은 뮤턴트에서
GREEN 이었다(그게 이 발견의 요지다).

## 검증

- 영향 스위트 재실행 PASS · `tsc --noEmit` 변경 파일 오류 0
- TEST WORKFLOW 4스테이지 재수행 결과는 plan 체크리스트 참조
