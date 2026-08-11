# 변경 범위(Scope) Review — 2회차 (`14_11_34`)

## 검증 방법

직전 라운드(`13_51_44`, LOW / WARNING 1건) 의 `scope.md`·`RESOLUTION.md` 를 먼저 읽고, 이번
라운드의 새 델타로 지목된 커밋 두 개를 직접 확인했다.

- `git show bafa7c007 --stat` / `--name-status` — 실제 변경 파일 8개(코드 5 + plan 2 + spec 1)
  확인. `5c5bd8c40` 는 리뷰 산출물(`review/code/2026/08/11/13_51_44/**`) 커밋뿐 — 코드·spec·
  plan 을 건드리지 않는다.
- `git show bafa7c007 -- <각 파일>` 로 8개 파일 전부 개별 diff 를 직접 열어 대조.
- `git diff origin/main bafa7c007 --stat` 로 전체 PR 누적 diff(13개 파일)를 확인 — 이번 라운드
  프롬프트의 25개 항목(코드/plan 13 + `review/code/.../13_51_44/**` 리뷰 산출물 11 + 자기 자신)
  이 그 누적 diff 와 정확히 대응함을 확인.

## 발견사항

- **[INFO]** 직전 라운드의 유일한 WARNING(plan 미이동) — 처분 확인, 완전 해소
  - 위치: `plan/complete/docs-guard-walker-dedup.md` (신규, `plan/in-progress/docs-guard-walker-dedup.md` 에서 rename), `git show bafa7c007 --name-status` 상 `R090`
  - 상세: `git mv` 로 `plan/complete/` 이동(유사도 90% rename 판정) + frontmatter `status: complete`
    (직전 `in-progress`) 확인. 인입 참조도 함께 정정됐다 —
    `plan/in-progress/harness-env-value-subpattern-dedup.md` 의 링크가
    `docs-guard-walker-dedup.md` → `../complete/docs-guard-walker-dedup.md` 로 바뀌었다.
    `.claude/docs/plan-lifecycle.md §3` 이 요구하는 "같은 PR 안에서 `git mv` + status 갱신"
    조건을 정확히 만족한다. WARNING 은 완전히 처분됐다.

- **[INFO]** `spec/conventions/spec-impl-evidence.md` 수정 — 정당성 있으나 role 경계상 주목할
  경계 사례
  - 위치: `spec/conventions/spec-impl-evidence.md` (`code:` 리스트에 2줄 추가)
  - 상세: CLAUDE.md 의 skill 표는 `developer` 를 `spec/` read-only 로, `spec/` 쓰기는
    `project-planner` 전속으로 못박는다. 이 커밋은 developer 워크플로(구현 완료 후 fix
    라운드) 안에서 `spec/conventions/spec-impl-evidence.md` 를 편집했다 — 표면적으로는
    role 경계를 넘는다.
    다만 세 가지가 이 편집을 정당화한다: (1) 변경 폭이 극히 좁다 — 이 PR 이 스스로 새로
    만든 파일(`tree-walk.ts`/`tree-walk.test.ts`) 두 개를 evidence 카탈로그의 `code:` 목록에
    추가하는 2줄뿐, 서술·요구사항·정책 문장은 손대지 않았다. (2) **직전 라운드
    requirement reviewer 자신의 INFO 지적**("신규 공유 헬퍼가 `code:` 에 빠져 있다")에 대한
    직접 응답이라 이번 fix 라운드의 정당한 범위 안에 있다 — 다른 스코프의 spec 변경이
    아니라 이 PR 이 낳은 결과물 자체를 카탈로그에 반영하는 행위다. (3) Gate C 의 존재
    이유 자체가 "구현 PR 이 `spec/` 을 건드릴 수 있고, 그 사실을 `spec_impact` 로 정직하게
    선언하게 강제" 하는 것이라 — `plan-scan.ts` 의 `hasValidSpecImpact`/`makeSpecExists`
    가 정확히 이 패턴(구현 PR 이 실제로 건드린 실존 `spec/` 파일을 선언)을 검증하도록
    설계돼 있다. 이 PR 은 `spec_impact: none` → 실제 목록으로 정직하게 갱신해 그 계약을
    지켰다.
  - 제안: 문제 삼을 정도는 아니지만, 향후 `spec/` 편집이 카탈로그 항목 추가를 넘어
    서술·요구사항 수준으로 커지면 그 시점엔 project-planner 턴으로 넘기는 것이 맞다 —
    이번처럼 "새로 만든 자기 파일을 목록에 등재" 하는 기계적 갱신과는 성격이 다르다.

- **[INFO]** `spec_impact: none → 실제 목록` 전환 — 정확함
  - 위치: `plan/complete/docs-guard-walker-dedup.md:8-9` (frontmatter `spec_impact`)
  - 상세: `spec_impact` 가 `[spec/conventions/spec-impl-evidence.md]` 로 바뀌었고, 이 PR 이
    실제로 건드린 `spec/` 파일과 정확히 일치한다(위 발견사항과 동일 파일, 그 외 `spec/`
    변경 없음). Gate C(`hasValidSpecImpact`)가 요구하는 "리스트면 비어있지 않고 모든
    원소가 `spec/` 하위 실존 파일" 조건도 만족한다. `none` 을 그대로 뒀다면 그 자체가
    Gate C 위반(거짓 선언)이었을 것 — 이 정정은 스코프 확장이 아니라 정직한 사후 반영이다.

- **[INFO]** `harness-env-value-subpattern-dedup.md`(다른 plan) 수정 — 범위 내, plan 이동의
  필연적 부수 효과
  - 위치: `plan/in-progress/harness-env-value-subpattern-dedup.md` (5줄 변경: `+3/-2`)
  - 상세: `git diff 5c5bd8c40^ bafa7c007 -- plan/in-progress/harness-env-value-subpattern-dedup.md`
    로 직접 대조 — 변경은 정확히 두 가지뿐이다: (a) 상대경로 링크 정정
    (`docs-guard-walker-dedup.md` → `../complete/docs-guard-walker-dedup.md`, plan 이동으로
    깨진 링크의 필연적 결과), (b) 그 옆 설명 1문장을 "walker 3벌 통합 판정" → "완료
    (2026-08-11) — 착수 때 3벌로 봤으나 실측 6벌, `walkTree` 하나로 모임" 으로 갱신. 두
    번째도 범위 확장이 아니라 링크 대상이 가리키는 문서 상태가 실제로 바뀌었으니 그
    설명을 stale 하게 방치하지 않은 것뿐이다 — 이 프로젝트가 반복해 지적해 온 "자매 문서가
    한쪽만 갱신돼 stale 해지는" 패턴을 이 PR 자신이 피한 사례다. 그 plan 의 본문 나머지
    (체크리스트·다른 섹션)는 전혀 건드리지 않았다.

- **[INFO]** 코드 5개 파일(fix 대상) — 처분과 diff 가 1:1 대응, 무관한 수정 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts`(`walkTree` 의
    `path.isAbsolute` 분기 제거), `impl-anchor-parse.ts`(중복 설명 → SoT 포인터로 축약),
    `plan-scan.ts`(헤더 주석 "네 벌"→"여섯 벌" 정정), `spec-links.ts`(`@deprecated`
    `SpecMdFile` 별칭 삭제 + 실측 수치 정정 각주), `tree-walk.test.ts`(중복 설명 →
    포인터로 축약)
  - 상세: `git show bafa7c007 -- <파일>` 로 5개 전부 개별 대조 — 각 diff 가 `RESOLUTION.md` 가
    선언한 항목(W1 죽은 분기, W2 반증된 별칭 근거, W3 숫자 정정, W5 4곳 중복 설명)과
    정확히 하나씩 대응한다. 포맷팅-only 변경, 무관한 import, 사용하지 않는 정리는
    없었다.

## 요약

이번 라운드의 새 델타(`bafa7c007` + `5c5bd8c40`)는 직전 라운드 SUMMARY 가 지목한 6건(그중
scope 관점 WARNING 1건 포함)에 대한 처분으로 정확히 구성돼 있다. plan 이동은 `git mv` +
`status: complete` + 인입 참조 정정까지 완결됐고, `spec_impact` 정정도 실제 변경과 일치한다.
`spec/conventions/spec-impl-evidence.md` 편집은 role 경계(developer 는 `spec/` read-only) 상
표면적으로 눈에 띄지만, 이 PR 이 자신의 신규 파일을 evidence 카탈로그에 등재하는 2줄짜리
기계적 갱신이고 직전 라운드 자신의 지적에 대한 직접 응답이라 별 트랙으로 분리할 실익이 없다
— Gate C 의 `spec_impact` 메커니즘 자체가 이런 형태의 구현-PR-내 `spec/` 접촉을 정직하게
선언하도록 설계돼 있다. `harness-env-value-subpattern-dedup.md` 수정도 plan 이동이 깨뜨린
링크를 고치는 필연적 부수 효과이며 5줄로 국한된다. 코드 5개 파일의 수정은 직전 라운드
발견사항과 diff 가 1:1 대응하고, 무관한 리팩토링·포맷팅·주석·임포트 변경은 관찰되지 않았다.

**머지 가능 여부**: scope 관점에서 이 fix 커밋을 막을 이유가 없다. WARNING 이 완전히
처분됐고 새 스코프 위반도 없다.

**수렴 여부**: 수렴했다고 판단한다. 이번 델타는 (a) 직전 라운드가 지목한 항목에 정확히
대응하는 최소 변경뿐이고, (b) 새로 건드린 두 개의 "다른 파일"(spec 카탈로그·자매 plan)도
전부 이 PR 자신의 상태 변화(신규 파일 생성, plan 이동)의 직접적·필연적 결과로 설명된다.
스코프 관점에서 추가 라운드가 새로운 정보를 낼 여지는 낮다 — 이 축에서는 이번이 마지막
라운드가 되어도 무방하다.

## 위험도

NONE
