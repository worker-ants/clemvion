# 변경 범위(Scope) 리뷰

## 개요

이 브랜치(`user-entity-column-defense`, `origin/main...HEAD`, 8개 커밋)는 `User` 엔티티 컬럼
노출 방어라는 단일 목표에서 출발했으나, 그 목표를 구현·리뷰·정합성 검토하는 과정에서 연쇄적으로
발견된 결함들을 같은 브랜치 안에서 처분하며 범위가 여러 차례 확장됐다. `git diff --stat` 기준
198개 파일·17,345줄 삽입 중 실제 애플리케이션/하네스 코드는 15개 파일이고 나머지는 `review/**`
리뷰 라운드 산출물(7회 코드 리뷰 + 9회 consistency 라운드)과 `plan/**` 갱신이다. 각 확장은
커밋 메시지·CHANGELOG·RESOLUTION.md 에 실측과 함께 상세히 disclose 되어 있어 은폐된 변경은
없었다. 다만 "범위 관점"에서는 disclose 여부와 무관하게 원래 목표를 벗어난 축이 몇 개 섞였는지를
짚는 것이 이 리뷰의 역할이므로, 아래에 각 확장을 항목별로 나눠 기록한다.

## 발견사항

- **[WARNING]** 세 번째 검출 축(`dto-jsdoc-citation-guard.ts`)은 "User 엔티티 컬럼 노출"이 아니라 별개의 문제(DTO JSDoc 을 통한 리뷰 인용 유출)를 다루며, 브랜치 목표와 독립적인 신규 기능이다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`(신규, 115줄), `dto-jsdoc-citation.spec.ts`(신규, 127줄), `fixtures/dto/responses/jsdoc-citation.fixture.ts`(신규, 61줄) — 커밋 `4529812c6`
  - 상세: 이 가드는 응답 DTO 의 JSDoc 에 `review/code/...`·`review/consistency/...` 같은 리뷰 산출물 경로 인용이 남아 공개 OpenAPI `description` 으로 노출되는 것을 막는다. `User` 엔티티의 민감 컬럼(passwordHash 등) 노출과는 판정 대상·방어 원리가 전혀 다르다(하나는 "값이 새는가", 다른 하나는 "주석 텍스트가 새는가"). 도입 계기는 "이 브랜치 계열에서 같은 위반이 세 번 났다"(즉 이 브랜치 자신이 작업 중 반복해서 저지른 실수를 리뷰어가 매번 사람이 잡아냈다는 사실)로, `WorkspaceMemberDto.joinedAt` 필드 추가 이후 발생한 부산물이다. 브랜치명·plan 항목("User 엔티티에 컬럼 수준 방어를 둘지 결정")이 가리키는 원래 스코프에는 없는 새 검증 계층이며, `spec/conventions/review-citations.md`·`spec/conventions/spec-impl-evidence.md` 두 문서 본문 정정까지 연쇄적으로 유발했다(아래 항목).
  - 제안: 기능적으로는 잘 만들어졌고 충분히 disclose 됐으므로 되돌릴 필요는 없으나, 이후 리뷰·머지 판단 시 "User 컬럼 방어 PR" 이 아니라 "User 컬럼 방어 + DTO JSDoc 인용 가드, 두 개의 독립 기능이 한 커밋 계열에 있다"는 전제로 검토해야 한다. 다음에 유사 상황이 생기면 별도 브랜치로 분리하는 편이 리뷰 단위를 좁힌다.

- **[WARNING]** 하네스/도구 코드(`review_guard.py` frontmatter 파서) 버그 수정이 애플리케이션 기능 브랜치에 섞여 들어갔다
  - 위치: `.claude/hooks/_lib/review_guard.py:640-651`(`_parse_frontmatter_code` 블록 리스트 루프에 빈 줄/`#` 스킵 추가), `.claude/tests/test_review_guard.py:329-374`(회귀 테스트 3건 신규) — 커밋 `8b67300b5`
  - 상세: 이 수정은 `User` 엔티티 방어와 무관한 리뷰 파이프라인 자체의 결함(spec frontmatter `code:` 블록 리스트가 YAML 주석·빈 줄에서 조기 `break` 해 뒤 항목이 전부 유실)이다. 발단은 이 브랜치가 `dto-jsdoc-citation-guard.ts` 를 spec `code:` 에 등재하면서 범주 구분용 인라인 YAML 주석을 넣은 것 — 즉 위 WARNING 항목(세 번째 축)이 연쇄적으로 만들어낸 2차 파생이다. 저장소 전체 spec 387개를 스캔해 41개 entry 유실을 실측하고 회귀 테스트까지 갖춘 견실한 수정이지만, "User 엔티티 컬럼 방어" 라는 애플리케이션 기능과는 계층이 다른(개발 도구 인프라) 변경이 같은 커밋 계열에 포함됐다.
  - 제안: 커밋 메시지(`fix(harness,spec): ...`)가 이미 애플리케이션 커밋(`feat(backend)`)과 별도 커밋으로 분리되어 있어 git 이력상 추적은 용이하다. 병합 시 이 하네스 수정만 별도로 cherry-pick 하거나 리뷰하는 것도 고려할 만하다는 점만 기록 — 현재 상태로도 기능상 문제는 없다.

- **[INFO]** `spec/conventions/review-citations.md`·`spec/conventions/spec-impl-evidence.md` 편집은 개발자 워크트리 안에서 이뤄졌으나, "자기증명형 소정정" 예외의 부적용을 스스로 판정하고 절차를 준수했다
  - 위치: `spec/conventions/review-citations.md:97`(`> **정정 (2026-09-06)**: 이제 **한 축의 절반이 강제된다.**` 이하 블록), `spec/conventions/spec-impl-evidence.md:81`(`code` 필드 정의 셀 안 취소선 정정)
  - 상세: `CLAUDE.md` 는 developer 의 `spec/` 쓰기를 "자기 자신이 쓴 예고 문장을 실측으로 반증했을 때"로 좁게 제한한다. 이 브랜치는 반증 대상 문장(`이 규약에는 시행하는 코드가 없다`)을 `git log -S` 로 추적해 그것이 developer 가 아니라 이전 planner 턴(`90c1751e8`, PR #1287)이 쓴 문장임을 스스로 확인하고, "자기증명형 소정정 예외를 쓸 수 없다"고 커밋 메시지(`0f689bb7e`)에 명시한 뒤 우회하지 않고 별도 "planner 턴"을 열어 정정했다. 결과물도 원문을 취소선으로 남기고 해당 문장에 국한된 정정이라는 조건을 지켰다. 절차적으로는 규약을 준수했으나, 이 정정 자체가 "User 엔티티 컬럼 방어" 라는 원래 작업의 산출물이 아니라 위 두 WARNING 항목이 유발한 3차 파생이라는 점에서, 하나의 작업 브랜치가 코드 → 리뷰 도구 → spec 규약 문서까지 세 계층을 순차로 건드리게 된 연쇄의 종착점이다.
  - 제안: 조치 불요(절차 준수 확인됨). 다만 이 정정이 §5.4 "검증자는 두 문서 code: 에 등재" 관례와 얽혀 있어, 이후 실제로 `spec/5-system/2-api-convention.md` 쪽 `code:` 갱신이 필요한지(현재 plan 에 planner 후속 항목으로만 등재돼 있음)는 별도 planner 턴에서 마무리해야 완결된다.

- **[INFO]** 리뷰/정합성 라운드 산출물 183개 파일(`review/code/**`, `review/consistency/**`)이 diff 에 포함되어 있으나, 이는 저장소 관례(review/ 는 gitignore 대상 아님)를 따른 정상적인 워크플로 부산물이다
  - 위치: `review/code/2026/09/06/{10_13_22,10_53_48,11_27_53,11_55_36,12_28_02,12_53_28,13_39_20}/**`, `review/consistency/2026/09/06/{10_13_23,10_53_50,11_27_54,11_55_37,12_28_03,12_53_29,13_06_22,13_18_59,13_39_25,13_52_23}/**`
  - 상세: 7회의 `/ai-review` 라운드와 9회의 `/consistency-check` 라운드가 반복적으로 발생한 것은 하나의 기능 작업치고는 많은 편이나(위 WARNING 두 건이 유발한 연쇄 재작업이 주 원인), 각 라운드 사이에 실제 코드 변경이 있었고 RESOLUTION.md 가 처분 근거를 남기고 있어 절차상 이상은 없다. 스코프 관점에서는 새로운 결함이 아니라 "왜 이렇게 라운드가 많았는가"를 위 두 WARNING 이 설명한다.
  - 제안: 조치 불요.

- **[INFO]** `WorkflowVersionsService` 의 `creator` 투영 수정(`workflow-versions.service.ts`)은 곁가지처럼 보이지만 "User 컬럼 노출"이라는 브랜치 본 주제와 직접 일치한다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — 커밋 `4d49aa575`
  - 상세: 새로 만든 타입 기반 스캔 축이 실제로 `findOne` 이 `User` 전체를 투영 없이 반환하던 살아있는 유출을 발견해 고친 것으로, 브랜치가 표방하는 "User 엔티티 컬럼 방어"의 핵심 산출물 중 하나다. 범위 이탈이 아니라고 판단해 별도 WARNING 으로 올리지 않았다.
  - 제안: 해당 없음(범위 내 정상 변경).

## 요약

브랜치의 핵심 산출물(`user-entity-exposure-guard.ts`/`user-secret-absence.ts` 2축 + 소비
e2e/spec, `WorkspaceMemberDto.joinedAt` 계약 정정, `WorkflowVersionsService.findOne` 실유출
수정)은 "User 엔티티 컬럼 방어"라는 원래 목표에 정확히 대응한다. 그러나 그 작업을 리뷰·정합성
검토하는 과정에서 (1) 별개 관심사인 DTO JSDoc 리뷰-인용 가드 신설, (2) 그 가드의 spec 등재
과정에서 드러난 리뷰 하네스(`review_guard.py`) 파서 버그 수정, (3) 그 하네스 수정이 반증한
spec 규약 문서(`review-citations.md`/`spec-impl-evidence.md`) 정정까지 3단 연쇄로 범위가
확장됐다. 각 확장은 실측·회귀 테스트·커밋 메시지 근거를 갖추고 절차(자기증명형 소정정 예외의
부적용 판정 → planner 턴)도 준수했으므로 기능적 결함이나 은폐는 없지만, "한 PR = 한 관심사"
관점에서는 세 개의 서로 다른 계층(애플리케이션 보안 / 리뷰 도구 인프라 / spec 거버넌스 문서)이
하나의 커밋 계열에 뒤섞여 있다는 사실 자체가 스코프 리뷰가 짚어야 할 지점이다. 무관한
포맷팅·주석 정리·불필요한 임포트 변경 등 전형적인 "저지레" 형태의 스코프 이탈은 발견되지
않았다.

## 위험도

LOW
