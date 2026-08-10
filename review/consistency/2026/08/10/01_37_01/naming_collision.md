# 신규 식별자 충돌 검토 (재검토)

## 진단 메모 (알려진 결함 대응)

prompt 의 `## 구현 변경 사항` diff 섹션·target 문서가 번들에 없었다(2576줄 spec/conventions/
번들만 있었고 실제 변경 범위인 `.claude/docs/plan-lifecycle.md` / `codebase/frontend/src/lib/docs/__tests__/`
/ `plan/in-progress/docs-guard-walker-dedup.md` 는 빠져 있었음). 워킹트리 절대경로
(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`, 이 세션의 CWD 와 동일)
에서 `git diff origin/main...HEAD` 로 직접 diff·현재 코드를 확인했다.

본 라운드는 **재검토**다. 직전 라운드(`review/consistency/2026/08/10/01_09_04/naming_collision.md`)가
지적한 3건(WARNING×2 + WARNING×1)에 대한 개명·범위 명시가 이번 diff 에 반영됐는지, 그리고 그 개명이
저장소 전역에서 일관되게 적용됐는지, 새로 만든 `pr:`/`TERMINAL_PLAN_STATUSES`/신규 plan 파일이 또
다른 충돌을 만들지 않는지를 확인했다.

## 발견사항

### 직전 지적 3건 — 반영 확인

- **[해결 확인]** `merged_pr:` → `pr:` 재명명
  - `plan/complete/c1-pr2-aiturn-blueprint.md:5` 가 `pr: 625` 로 변경됨. 저장소 전수 `git grep -n "^pr:"`
    결과 기존 5개 완료 plan(`fix-carousel-waiting-status.md`(`pr: 498`)·`execution-engine-typed-errors.md`
    (`pr: 598, 599`)·`fix-presentation-tool-default.md`(`pr: 438`)·`embedding-model-ux.md`(`pr: 492`)·
    `workflow-execution-turn-timing.md`(`pr: 445`))와 동일 관례로 합류했다. 값 형태도 기존 다수(단일 정수)
    패턴과 일치한다(기존 1건은 `598, 599` 콤마-복수 선례가 있어 그 자체로 스키마 이완이 있었지만, 이번
    변경은 그 선례를 침범하지 않는다).
  - `merged_pr` 리터럴은 이제 코드/현재 plan 어디에도 남아있지 않다 — 남은 참조는 전부 (a) 과거 라운드의
    `review/code/2026/08/09/23_43_28/*`(당시 코드 리뷰 산출물, 시점 기록) 와 (b) `plan/complete/spec-draft-secret-store-verification-footnote.md:131`(이 라운드의 개명 결정 자체를 서술하는 Rationale 각주, "정규식으로 센 숫자를 파서가 정정했다 — 자유서술을 `merged_pr:` 로 분리했다") 뿐이다. 둘 다 `plan/complete/` 의 시점 기록 문서로, `plan-lifecycle.md §3` 의 "인입 참조는 옛 표현을 유지" 원칙상 갱신 대상이 아니다. 잔존 참조 없음으로 판정.

- **[해결 확인]** `TERMINAL_STATUSES` → `TERMINAL_PLAN_STATUSES` 재명명
  - `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:100` 의 export 명이 `TERMINAL_PLAN_STATUSES`
    로 바뀌었고, 소비처(`plan-frontmatter.test.ts:184`, `plan-scan.test.ts:6,163,165`) 전부 동기화됐다.
    `codebase/frontend` 전체에서 `TERMINAL_STATUSES`(옛 이름) 리터럴은 0건 — 잔존 참조 없음.
  - backend `ExecutionEngineService.TERMINAL_STATUSES`(`codebase/backend/src/modules/execution-engine/execution-engine.service.ts:499`, 워크플로 **실행** 종료 상태)는 손대지 않았고 이름이 더 이상 겹치지 않는다 — 직전 라운드가 지적한 grep 오분류 위험이 실제로 해소됐다.
  - `.claude/docs/plan-lifecycle.md:83` 의 신설 문구("새 종료 어휘가 필요하면 그 파일의
    `TERMINAL_PLAN_STATUSES` 에 등재한다")와 `spec-impl-evidence.md:87` 의 신설 각주 모두 새 이름으로
    일관되게 인용한다.

- **[해결 확인]** walker 통합 범위 명시(합친 건 둘, Gate C 는 등재된 후속)
  - `plan-scan.ts` 모듈 헤더 코멘트가 "**이 파일이 합친 것은 그중 둘이다** — live/complete 수집기를
    한 구현(`walkPlanMarkdown`)에서 파생시켰다. Gate C(`spec-plan-completion.test.ts`)의
    `collectCompletePlans` 는 **아직 독립 구현으로 남아 있고**... 그 통합은
    `harness-env-value-subpattern-dedup.md` 에 등재했다" 로 정정됐다.
  - 실제로는 그 후속이 `harness-env-value-subpattern-dedup.md` 가 아니라 신규 분리 plan
    `plan/in-progress/docs-guard-walker-dedup.md` 에 등재돼 있다(해당 plan 의 "함께 볼 것 — Gate C 의
    4번째 walker" 절). `harness-env-value-subpattern-dedup.md` 쪽은 "함께 볼 것" 섹션에서 상호
    참조만 한다. `plan-scan.ts` 코멘트의 "등재했다" 라는 서술이 실제 최종 등재처(`docs-guard-walker-dedup.md`)가 아니라 중간 경유지(`harness-env-value-subpattern-dedup.md`)를 가리키는 것으로 읽힐 여지가 있으나, 두 plan 문서 서로가 상호 링크돼 있어 어느 쪽에서 시작해도 실제 후속 항목(walker 3벌 표·Gate C 4번째 walker 판정 체크박스)에 도달 가능하다 — 추적성 단절은 아니다. INFO 수준으로만 남긴다(아래).

### 신규 확인 — 이번 라운드가 도입한 것 자체의 충돌 여부

- **[INFO]** `plan-scan.ts` 코멘트의 "등재했다" 지시선이 최종 목적지가 아닌 경유 plan 을 가리킴
  - target 신규 식별자: 없음(코멘트 텍스트 문제)
  - 기존 사용처: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:16-17` — "그 통합은
    `harness-env-value-subpattern-dedup.md` 에 등재했다" vs 실제 신규 파일은
    `plan/in-progress/docs-guard-walker-dedup.md`
  - 상세: 식별자 충돌은 아니고 문서 간 상호참조 정확도 문제다. 두 plan 이 서로를 링크하므로 실질적
    추적 단절은 없지만, `plan-scan.ts` 코드 코멘트만 읽는 사람은 `harness-env-value-subpattern-dedup.md`
    를 열어야 "함께 볼 것" 절을 거쳐 `docs-guard-walker-dedup.md` 로 한 단계 더 이동해야 한다.
  - 제안: `plan-scan.ts:17` 의 인용 대상을 `docs-guard-walker-dedup.md` (walker 통합 판정을 직접
    다루는 plan) 로 정정하면 한 홉 절약된다. 차단 사유 아님.

- **[없음]** 신규 plan 파일 `plan/in-progress/docs-guard-walker-dedup.md` — 기존 plan 과 파일명/제목 충돌 없음
  - `plan/in-progress/` 34개 파일 전수 확인 결과 `*walker*`/`*docs-guard*` 패턴의 기존 파일 없음.
    frontmatter 는 `title:`(기존 in-progress 34개 중 19개가 이미 쓰는 필드) + `spec_impact: none`
    (기존 7개 plan 과 동일 sentinel 표기) 로 기존 관례와 형식이 일치한다. `id:` 필드는 plan frontmatter
    에 원래 없는 필드라(spec frontmatter 전용 네임스페이스) 신규 plan 도 쓰지 않아 spec `id:` 네임스페이스와
    충돌 여지 없음.

- **[없음]** `TERMINAL_PLAN_STATUSES` 자체가 만드는 새 충돌 없음
  - 저장소 전수 검색(`git grep -rn "TERMINAL_PLAN_STATUSES"`) 결과 4개 파일(`plan-lifecycle.md`,
    `plan-frontmatter.test.ts`, `plan-scan.test.ts`, `plan-scan.ts`, `spec-impl-evidence.md`)에서만
    등장하고 전부 동일 개념(plan 종료 status 허용값 집합)을 가리킨다. 다른 도메인에서 이 이름을 선점한
    사례 없음.

- **[미해결, 직전 라운드부터 이월 — 이번 라운드 범위 밖]** `collectCompletePlanMarkdown`(신규) vs
  `collectCompletePlans`(기존 Gate C) 이름 유사·로직 중복은 코드 레벨에서는 **아직 그대로**다. 다만
  직전 WARNING 의 요구("두 함수 중 한쪽이 바뀌면 반대쪽도 갱신해야 한다는 사실을 두 파일 모두에
  상호 참조 코멘트로 명시")는 이제 충족됐다 — `plan-scan.ts` 코멘트가 위에서 확인한 대로 Gate C 를
  명시 인용하고, 신규 `docs-guard-walker-dedup.md` 가 별도 항목("함께 볼 것 — Gate C 의 4번째
  walker")으로 통합 여부 판정을 등재했다. 코드 통합 자체는 그 plan 의 범위이므로 본 라운드에서
  차단 사유로 재상신하지 않는다. `collectLivePlanMarkdown` 재-export 이중 경로(`spec-links.ts`)와
  `PlanMdFile`/`SpecMdFile` 필드 동일 구조 INFO 도 마찬가지로 미변경 — 둘 다 직전 라운드에서 INFO
  (비차단) 등급이었고 이번 재검토 지시 3건에 포함되지 않아 그대로 남아 있다. 신규 충돌은 아니므로
  본 라운드 재상신하지 않는다.

- **요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트·메시지명 / 환경변수 충돌**: 해당 없음. 이번
  변경은 여전히 내부 운영 문서(`plan-lifecycle.md`) + frontend build-guard 테스트 헬퍼 + plan
  frontmatter 정정 + 신규 plan 문서로, 제품 API/이벤트/ENV 표면을 도입하지 않는다.

## 요약

직전 라운드가 지적한 3건(`merged_pr`→`pr`, `TERMINAL_STATUSES`→`TERMINAL_PLAN_STATUSES`, walker
통합 범위 명시)은 코드·문서 전역에 일관되게 반영됐고 잔존 참조(고아 리터럴)는 없다 — 남은 옛 이름
언급은 전부 `plan/complete/` 시점 기록 문서(자기 자신의 개명 이력을 서술하는 Rationale)뿐이라 갱신
대상이 아니다. `TERMINAL_PLAN_STATUSES` 는 backend 동명 상수와 더 이상 겹치지 않고, 저장소 안에서
그 이름을 다른 의미로 선점한 곳도 없다. 신규 plan 파일 `docs-guard-walker-dedup.md` 는 파일명·
frontmatter 형식 모두 기존 plan 관례와 충돌 없이 자연스럽게 합류했고, `pr:` 필드 값 형태도 기존
5개 선례와 정합적이다. 유일하게 새로 발견한 것은 INFO 급 사소한 상호참조 부정확(`plan-scan.ts`
코멘트가 walker 통합 후속의 최종 등재처를 한 홉 우회해서 가리킴)이며, 두 plan 문서가 서로 링크돼
있어 추적성 단절로 이어지지는 않는다. `collectCompletePlanMarkdown`/`collectCompletePlans` 코드
중복 자체(직전 WARNING)는 코드 레벨에서는 아직 미해결이지만, 그 갭을 인지·추적하는 장치(상호
참조 코멘트 + 신규 plan 의 명시적 후속 항목)가 이번 라운드로 갖춰졌으므로 재상신하지 않는다.

## 위험도

LOW
STATUS=success
