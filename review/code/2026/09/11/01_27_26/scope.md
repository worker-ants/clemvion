# 변경 범위(Scope) 리뷰 — `impl-chat-channel-patch-token` (6라운드, `01_27_26`)

## 검토 방법

`origin/main`(`c0f2a885c`)`...HEAD`(`c817a44c4`) 누적 diff(126개 파일, 9개 커밋)를 대상으로
프롬프트 게이트 숫자와 `git show`/`git log`/`Read` 로 소스를 직접 대조했다. 앞선 다섯
스코프 리뷰(`23_21_57` · `23_55_23` · `00_21_55` · `00_45_18` · `01_10_43` 은 documentation/
user_guide_sync 타겟이라 scope 미실행)가 이미 핵심 코드 6개 파일(DTO·서비스·컨트롤러·e2e)의
스코프를 D-1/D-2/D-3 에 좁게 대응함을 반복 확인해 NONE 으로 수렴했으므로, 이번 라운드는
**직전 스코프 라운드(`00_45_18`) 이후 실제로 추가된 델타**에 집중했다.

이번 라운드가 대상으로 하는 신규 델타는 마지막 커밋 `c817a44c4`(`docs(plan): CHANGELOG 등재 +
트래커 3건 동기화 · 타겟 라운드가 게이트를 닫지 못한다는 실측`) 하나다 — `git show --stat
c817a44c4` 로 직접 확인: `CHANGELOG.md`(+64) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(+41/-6)
· `plan/{in-progress→complete}/impl-chat-channel-patch-token.md`(rename, +46/-변경) ·
`review/code/2026/09/11/01_10_43/**`(5파일, 5R 산출물) · `review/consistency/2026/09/11/01_10_44/**`
(6파일, 마지막 `--impl-done` 산출물) — 총 16 파일. **`codebase/**` 변경은 0건**이다(같은 명령
결과에 `codebase/` 경로가 없음).

저장소 트리는 뮤테이션하지 않았다(`git status --short` 결과 `review/code/2026/09/11/01_27_26/`
자신의 세션 디렉터리만 untracked — 이 리뷰 자신의 산출물이다).

## 델타(`c817a44c4`) 검증 — 전부 직전 라운드 지적에 1:1 대응

- **CHANGELOG.md**: 직전 라운드(`01_10_43/SUMMARY.md` WARNING #1 — "이 PR 이 닫는 CRITICAL 보안
  우회와 breaking change 에 대해 CHANGELOG 항목이 없다")에 대한 조치. 커밋 메시지가 선례
  (`08fbf133d`·`bfa124920`·`f5d97aa39` 는 갱신, `df1962e25`·`c0f2a885c` spec-only 는 미갱신)를
  실측으로 인용하고 `bfa124920` 형식을 따랐음을 확인 — `git show bfa124920 -- CHANGELOG.md` 로
  직접 대조한 결과 서술 스타일(표·인용 블록·"원인" 절 구성)이 동일 관례다. 새 절 하나만
  `# Changelog` 바로 아래 삽입됐고 기존 절(`## Unreleased — 주간 가드가...`)은 손대지 않았다 —
  프롬프트 게이트 라인 67~69 (기존 절 시작부)가 diff 밖(컨텍스트)임을 확인.
- **`plan/in-progress/spec-draft-nullable-notation-followups.md`**: 커밋 메시지가 예고한 정확히
  세 항목만 바뀌었다(`git show c817a44c4 -- <path>` 직접 대조):
  1. dead-code 항목에 실측 인용 블록 추가(추측 → 두-갈래 표, `[ ]` 유지 — 처방은 아직 미확정).
  2. 검증 함수 분리 항목 `[ ]` → `[x]` + 해소 근거 인용 블록.
  3. "spec 7곳" → "spec 9곳" 개수 정정 + 근거 인용 블록(측정 범위 명시: chat-channel 9곳 /
     notification 1곳은 측정 안 함).
  세 항목 모두 커밋 본문의 "트래커 3건" 절과 1:1 대응하며, 그 외 트래커의 나머지 항목(§5.4.1
  표 2행, telegram carve-out, `details.field`, `allowEmpty` 등)은 diff 컨텍스트로만 나타나고
  실제 변경이 없다.
- **`plan/complete/impl-chat-channel-patch-token.md`**: `plan/in-progress/` 에서 rename(git
  rename-detect 확인, `-M`)되며 체크리스트 항목 체크(CHANGELOG·plan 이동)와 "타겟 라운드는 push
  게이트를 닫지 못한다" 실측 절이 추가됐다 — plan lifecycle 관례(`.claude/docs/plan-lifecycle.md`)
  그대로다.
- **`review/code/2026/09/11/01_10_43/**` · `review/consistency/2026/09/11/01_10_44/**`**: 5R
  코드 리뷰(documentation+user_guide_sync 타겟)와 마지막 `--impl-done` 산출물을 코드/plan 수정과
  같은 커밋에 묶은 것 — 이전 라운드(`00_45_18/scope.md`, `00_21_55/scope.md`)가 이미 확인한
  "코드/일관성 리뷰 산출물 → 지정 경로 커밋" 관례와 동일 패턴이라 스코프 위반이 아니다.

## 이전 라운드 결론 — 최신 소스에서도 유지됨

- 핵심 코드 6개 파일(`chat-channel-config.dto.ts`·`update-trigger.dto.ts`·`triggers.controller.ts`·
  `triggers.service.ts`·`triggers.service.spec.ts`·`trigger-dto-validation.spec.ts`·
  `trigger-workflow-ref.e2e-spec.ts`)은 이번 라운드에서 **변경되지 않았다**(`c817a44c4` diff에
  `codebase/` 경로 0건) — 앞선 4개 스코프 라운드가 D-1/D-2/D-3 세 항목에 좁게 대응함을 확인한
  결론이 그대로 유지된다.
- 문서 6개 파일(`triggers.mdx`/`.en.mdx`, `discord`/`slack`/`telegram` mdx)도 이번 델타에서
  미변경 — 3R·4R 스코프 라운드가 이미 검증한 상태 그대로다.
- `package.json`/`tsconfig*`/`eslint.config.mjs` 등 설정 파일 변경 0건(누적 diff 전체 126개
  파일에도 없음).
- `spec/**` 파일 변경 0건 — developer 가 spec 결함(9곳 `store()`/`rotate()` drift·`details.field`
  SoT 미확정)을 코드로 우회하지 않고 `plan/in-progress/` 트래커에 planner 인계 항목으로만 남긴
  경계가 이번 델타에서도 유지된다(정정한 것은 트래커 자신의 개수 오기이지, spec 본문이 아니다).

## 발견사항

없음 — 신규 스코프 이탈 없음. 이번 델타(`c817a44c4`)는 커밋 메시지가 예고한 세 축(CHANGELOG
등재·트래커 3건 동기화·spec_impact 표기 정정)에 정확히 대응하며, 무관한 리팩토링·기능 확장·
설정 변경·미사용 import·의미 없는 포맷팅은 관측되지 않았다.

## 요약

이번 6라운드가 대상으로 하는 신규 델타는 `codebase/**` 를 전혀 건드리지 않고 `CHANGELOG.md`
갱신 · plan 트래커 3건 정정 · 직전 리뷰 라운드 산출물 커밋으로만 구성되며, 각각이 직전
스코프/documentation 라운드가 낸 지적(CHANGELOG 미기재 WARNING, 트래커 실측 갱신)에 1:1
대응하는 최소 수정이다. 새 기능·무관한 리팩토링·설정 변경·미사용 import 는 없다. 앞선 네
스코프 리뷰 라운드의 결론(핵심 코드 6개 파일이 D-1/D-2/D-3에 좁게 대응, 문서 8개 파일이 정확히
그 계약 변경만 반영)도 이번 라운드에서 코드 변경이 없었으므로 그대로 유지된다.

## 위험도

NONE
