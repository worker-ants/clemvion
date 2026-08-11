# Plan 정합성 검토 — docs-guard-walker-dedup 완료 이동 (target: spec/conventions)

## 검토 범위

`plan/in-progress/docs-guard-walker-dedup.md` → `plan/complete/docs-guard-walker-dedup.md` 이동
(13/13 완료, `status: complete`, `spec_impact` 실목록화)이 (1) `plan-lifecycle.md §3` 이동 규칙,
(2) 인입 참조 전수, (3) PR 이 등재한 후속 3건의 소재, (4) plan 서술-실변경 일치를 만족하는지
확인했다. 대조 자료: `plan/complete/docs-guard-walker-dedup.md` 원문(224줄 전체), `.claude/docs/plan-lifecycle.md`,
`git log`/`git show` (commit `75f2e2af9`·`f2b4cdd1e`·`6002603e1`·`bf0dfc98c`·`bafa7c007`·`5c5bd8c40`),
저장소 전체 `docs-guard-walker-dedup` grep, `review/code/2026/08/11/13_51_44/SUMMARY.md`.

## 발견사항

### 1. `plan-lifecycle.md §3` 이동 규칙 — 전항 충족, 문제 없음

- target 위치: `plan/complete/docs-guard-walker-dedup.md` frontmatter + 본문
- 관련 plan: 동일 문서 자신 + `.claude/docs/plan-lifecycle.md §3/§5`
- 상세: (a) 체크박스 전수 확인 — "판정 없이 바로 착수 가능" 6건, "판정이 선행돼야 하는 것" 2건,
  "`SpecMdFile` 타입명" 1건, "착수 전 필수" 3건 = 12건 모두 `[x]`(+"완료" 절 자체가 13번째
  항목의 최종 처분). 미체크 `[ ]` 0건, "TODO"/"결정 필요" 잔존 0건. (b) `git show --name-status bafa7c007`
  로 확인 — `R090 plan/in-progress/docs-guard-walker-dedup.md → plan/complete/docs-guard-walker-dedup.md`
  가 "chore(plan): mark docs-guard-walker-dedup complete + 리뷰 7명 수렴 지적 처분" 커밋 **안에서**
  코드 수정과 함께 이동됨 — 별도 "이동만 담은 PR" 아님, `git mv` 동등(rename 감지). (c) frontmatter
  `spec_impact: - spec/conventions/spec-impl-evidence.md` — bare string 아닌 실제 YAML 리스트,
  Gate C(`hasValidSpecImpact`) 요구사항 충족. (d) `status: complete` — `plan-scan.ts` 의
  `TERMINAL_PLAN_STATUSES = {complete, implemented, applied, superseded}` 에 포함된 유효값.
  (e) frontmatter 3필드(`worktree`/`started`/`owner`) 모두 존재.
- 제안: 없음.

### 2. 인입 참조 전수 — `review/**` 밖 잔존 0건, 문제 없음

- target 위치: 저장소 전역 (`grep -rln "in-progress/docs-guard-walker-dedup" . --exclude-dir={.git,node_modules,review}` → 0건;
  `spec/` 단독 재확인도 0건)
- 관련 plan: `plan/in-progress/harness-env-value-subpattern-dedup.md:113` — task 설명이 지목한
  "이미 고친" 참조. 실제로 `[docs-guard-walker-dedup.md](../complete/docs-guard-walker-dedup.md)`
  로 정정돼 있고, 인접 서술("완료 (2026-08-11) — 착수 때 3벌로 봤으나 실측 6벌이었고,
  `tree-walk.ts` 의 `walkTree` 하나로 모였다")도 완료 plan 의 실제 결론과 일치.
- 상세: `review/code/**`·`review/consistency/**` 안의 다수 잔존 옛 경로 언급(수십 건)은 전부
  시점 기록 문서이며 `plan-lifecycle.md §3` "인입 참조: `review/**` 같은 시점 기록 문서는
  옛 경로 유지" 규정의 정상 범위. `spec/**.md` 본문에도 `docs-guard-walker-dedup` 문자열이
  전혀 없어 `spec-link-integrity.test.ts` 의 "spec 본문 → plan 링크"(타깃 필터 없는 스캔)
  경로로도 build 가 깨질 위험이 없다.
- 제안: 없음.

### 3. [WARNING] PR 이 등재한 "후속 3건" — 완료 plan 안이 아니라 timestamped review 산출물에만 존재, 그중 1건은 재검토 트리거를 어디에도 못 남김

- target 위치: `plan/complete/docs-guard-walker-dedup.md` 전체(224줄) — 위 3건("`spec-frontmatter-parse.ts`
  캐시-우회 fixture"·"`rel(full)` 계산"·"`plan-scan.ts` 크기") 어느 것도 완료 plan 본문에
  **없다**(`캐시`/`rel(full)`/`크기` grep 전부 무관 매치이거나 0건). 실제 소재는
  `review/code/2026/08/11/13_51_44/SUMMARY.md` "## INFO 처분" 표 마지막 3행이다:

  | 출처 | 내용 | 처분 |
  |---|---|---|
  | testing | `spec-frontmatter-parse.ts` 전용 캐시-우회 fixture 부재 | **등재** — 코드 주석이 잔여 위험을 이미 명시 |
  | performance | `rel(full)` 을 `skipDir` 마다 계산(~1.13ms) | **무조치** — 스위트 대비 0.02% |
  | maintainability | `plan-scan.ts` 449줄, 세 결이 한 파일 | **무조치** — 하위 유틸을 실제로 공유. **다음 확장 시 재검토** |

- 관련 plan: `plan/complete/docs-guard-walker-dedup.md`(원 출처, 이미 닫힘) / 대조 —
  `plan/in-progress/harness-env-value-subpattern-dedup.md` 의 "트리거가 걸린 조건부 항목"
  (같은 PR 계열이 만든 자매 plan으로, "세 번째 사례가 생기는 시점에 공유 헬퍼로 뽑는다 …
  지금 착수할 일은 없다" 라는 **동형의 조건부 defer 를 `plan/in-progress/` 에 명시 등재**한 선례).
- 상세: 3건 중 앞의 둘은 실질적으로 종결됐다 — (i) 캐시-우회는 `matterNoCache` 단일 진입점으로
  구조적으로 통합됐고(spec-frontmatter-parse.ts:83-98 JSDoc이 "그 전제를 코드가 강제하지
  않는다. 한쪽이 언젠가 같은 파일을 읽는 순간 조용히 되살아난다"고 잔여 위험을 실제로 명시,
  disposition 과 일치), (ii) `rel(full)` 성능은 실측 0.02% 로 non-issue 확정. 문제는 **셋째**다
  — "`plan-scan.ts` 449줄 · 다음 확장 시 재검토"는 조건부 트리거(harness-env plan 의 "세 번째
  사례" 패턴과 동형)인데, 그 조건이 실제로 발생했을 때 다시 찾을 수 있는 곳이 **timestamped
  review 산출물 하나뿐**이다 — `plan/complete/docs-guard-walker-dedup.md` 본문에도,
  `plan-scan.ts` 코드 주석에도, 어떤 `plan/in-progress/**` 항목에도 이 재검토 조건이 없다.
  `plan-lifecycle.md §3` "인입 참조" 조항과 사용자 워크플로 교훈("`review/**` 는 SoT 아님 —
  미룬 항목은 그 턴에 `plan/` 에 적어라")이 정확히 이 형태를 겨냥한다 — completed plan 이
  `complete/` 로 닫히고 나면 이 조건부 항목을 추적할 살아있는 문서가 아예 없어진다.
  (task 가 전제한 "후속 3건이 완료 plan **안에** 있다"는 진술 자체는 부정확하다 — 실제로는
  plan 밖 review 산출물에 있고, 그중 둘은 이미 종결됐다.)
- 제안: `plan-scan.ts` 파일 헤더 주석(Gate C 판정 함수 섹션)에 "다음 확장 시 파일 분리 재검토"
  한 줄을 남기거나, `docs-guard-walker-dedup.md` 의 `## Rationale` 에 조건부 후속 노트로
  추가한다. 완료 plan 자체를 다시 열 필요는 없다(체크리스트 자체는 13/13 으로 정당하게 닫혔다) —
  누락된 것은 새 최소 기록이지 재작업이 아니다.

### 4. Plan 서술 vs 실변경 일치 — "2075 → 2077", "테스트로 고정" 정정 모두 정확

- target 위치: `plan/complete/docs-guard-walker-dedup.md` "### 조용한 스코프 변경 0 — 집합으로 증명"(165-177행),
  "착수 전 필수" 체크리스트 3번째 항목의 표현-정정 블록(58-62행)
- 관련 plan: 동일 문서 + `review/code/2026/08/11/13_51_44/SUMMARY.md` W3/W4
- 상세: "2075 → 2076" 은 `tree-walk.ts` 만 만든 중간 상태에서 잰 오기였고 최종본은 "2075 →
  **2077**"(`tree-walk.ts`+`tree-walk.test.ts` 둘 다 `codebase/frontend/src` 하위 `.ts` 라
  수집 대상)로 정정돼 있다 — documentation reviewer 가 W3 로 독립 지적했고 SUMMARY 는
  "전부 고침"으로 기록, 현재 plan 문서 텍스트와 일치. "집합 동일을 테스트로 고정" 표현도
  "원리상 불가능(옛 구현이 지워지면 비교 대상이 사라진다) — 실제로 한 것은 (a) 일회성 dump
  대조 (b) forward 고정"으로 정확히 재서술돼 있고, 이는 requirement reviewer 의 W4 지적과
  정확히 대응한다("`docs-guard-walker-dedup.md` 요구 문구를 그렇게 정정했다"). 두 정정 모두
  삭제·은폐가 아니라 원문 보존 + 정정 블록 추가 방식(이 저장소의 확립된 self-correction
  패턴)을 따른다.
- 제안: 없음.

## 요약

이동 자체는 `plan-lifecycle.md §3` 의 모든 요건(체크박스 전부 `[x]`, 같은 PR 안 rename,
`spec_impact` 실목록, 유효 종료 `status`)을 충족하고, 인입 참조도 저장소 전역에서 `review/**`
밖에는 잔존이 없어 CRITICAL 급 문제는 없다. Plan 서술("2075→2077", "테스트로 고정" 표현)도
실제 커밋 이력과 정확히 일치한다. 유일한 실질 갭은, task 가 지목한 "후속 3건" 이 실제로는
완료 plan 안이 아니라 `review/code/2026/08/11/13_51_44/SUMMARY.md` 의 INFO 처분 표에만
존재한다는 점이며, 그중 캐시-우회·성능 2건은 정당하게 종결됐으나 "`plan-scan.ts` 크기 —
다음 확장 시 재검토" 1건은 조건부 defer 임에도 `plan/` 이나 코드 어디에도 흔적을 남기지
못해, plan 이 닫힌 지금 이 조건이 실제로 도래해도 아무도 재발견할 수 없는 상태다. 미해결
결정 우회나 선행 plan 미해소는 발견되지 않았다.

## 위험도

LOW
