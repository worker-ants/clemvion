# Rationale 연속성 검토 — spec/4-nodes/7-trigger/ (impl-done)

## 검토 범위 확인

- diff-base `origin/main` 대비 실제 코드 변경은 4개 파일, 전부 주석/JSDoc/Swagger
  `description` 문자열만 수정 (`git diff origin/main...HEAD --stat -- codebase/` 로 재확인):
  `trigger-parameter.types.ts`(JSDoc 3종 추가) · `resolve-trigger-parameters.ts`(base 함수
  docblock 확장, 영→한 통일) · `re-run.dto.ts`(Swagger description 확장) ·
  `workflows.controller.ts`(인라인 주석 영→한 통일). 실행 로직 diff 라인 0줄.
- spec 변경은 `spec/4-nodes/7-trigger/1-manual-trigger.md` frontmatter `code:` 목록에
  `executions.service.ts` 1줄 추가뿐 (본문 무변경).
- 즉 이번 target 변경분은 **문서·주석 전용**이며, 새 설계 결정이나 대안 채택이 없다.

## 발견사항

검토 관점 1~4 (기각 대안 재도입 / 원칙 위반 / 무근거 번복 / invariant 충돌) 전체에서
**CRITICAL·WARNING 없음**. 근거:

- 신규 JSDoc/Swagger 서술은 모두 `spec/5-system/14-external-interaction-api.md` §R17
  Rationale 의 기존 결정을 **그대로 인용**한다 — 예: "base 에 넣지 않은 것은 의도, base 는
  Webhook·Schedule 도 공유" (코드 주석) ↔ "base 에 넣지 않은 것은 의도 — base 는
  Webhook·Schedule 도 공유하므로 거기 넣으면 무관한 경로가 같은 거부 규칙을 진다" (EIA
  §R17, `_prompts` L2253). Swagger 의 "부분 일치는 통과" 도 §R17 의 "보장의 경계 — 정확
  일치만 감지" (L2284) 와 정확히 일치. 새 결정이 아니라 기존 결정의 **재진술**이다.
- `REASON_TO_DETAIL` 4종 JSDoc 분리("사용자가 취할 행동" 기준)는 `1-manual-trigger.md
  §6` 의 "위 4가지 구조 위반은 모두 단일 `invalid_schema` reason 으로 산출된다 — distinct
  한 메시지로 분기하지 않는다(머신 코드 단일화)" (target L218) 라는 **기존 원칙과 충돌하지
  않는다** — 그 원칙은 `invalid_schema` **내부**의 4가지 스키마 위반을 하나의 reason 으로
  묶으라는 것이고, 신규 JSDoc 은 이미 별개로 존재하던 4개 최상위 reason 코드
  (`missing_required`/`coerce_failed`/`invalid_schema`/`masked_value_resubmitted`) 사이의
  설명을 보강한 것뿐 — 코드 개수·구조 변경 없음.
- `workflows.controller.ts` 주석의 영→한 전환은 "`errors` 가 아니라 `details`" 근거를
  보존했음을 diff 로 확인(target L385-387) — 정보 손실 없이 언어만 통일. target 본문
  L233 의 "re-run 이 이 목록에 들어온 것은 2026-08-20" 서술과도 모순 없음(그 서술이 가리키는
  배선을 이 PR 은 건드리지 않았다).
- 이번 diff 는 `resolveTriggerParametersRejectingMasked` wrapper 를 base 가 아닌 곳에 두는
  기존 아키텍처, `masked-reject-callers-guard` CI 가드, Manual 전용(webhook/schedule 제외)
  범위 등 EIA §R17 이 확정한 모든 invariant 를 **그대로 유지**한다. 새로 도입되거나 우회된
  invariant 없음.

## INFO — 추적 완료, 조치 불요

- **[INFO] 마스킹 마커 SoT 분산 재기술 위험 — 이미 트래커에 등재·해결 경로 존재**
  - target 위치: 없음 (코드 주석 3곳 — `re-run.dto.ts`, `resolve-trigger-parameters.ts`,
    `trigger-parameter.types.ts` JSDoc)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §R17 —
    "마커 집합과 깊이 상한의 SoT 는 공유 패키지 `@workflow/masked-markers` 다(2026-08-21
    이관)... 예전엔 두 스택이 값을 손으로 복제했고 한쪽만 늘면 다른 쪽이 조용히
    fail-open 했다" (target 번들 L2306-2313) — 즉 "마커 관련 정보는 단일 패키지로
    집중시키고 손 복제를 없앤다" 는 확립된 원칙.
  - 상세: 이번 PR 이 추가한 3곳의 산문 서술(Swagger description, JSDoc 2건)은 마커
    **리터럴 문자열 값**은 복제하지 않았지만(`***` 등 미기재), "정확 일치만 거부·부분
    일치는 통과" 같은 **거부 규칙의 의미**를 SoT 패키지 링크 없이 산문으로 재기술한다.
    개발자 자신이 이 사실을 `plan/complete/masked-marker-cosmetic-followups.md` 및
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 신규 항목으로
    등재하고 "PR #1194(`egress-masking.md` 신설)가 머지되면 그 문서 §3 이 이 클래스를
    흡수한다" 는 해결 경로까지 명시해 두었다(2026-08-22 등재).
  - 제안: 이미 정본 트래커에 등재·추적되고 있어 이번 PR 범위에서 추가 조치 불필요. 단
    `#1194` 가 철회되거나 지연될 경우 이 항목이 유일한 기록이라는 점을 트래커가 이미 명시
    — Rationale 연속성 관점에서는 이 점이 잘 지켜지고 있는지만 추후 확인하면 충분.

## 요약

이번 target 변경은 `spec/4-nodes/7-trigger/1-manual-trigger.md` frontmatter 1줄과 4개
백엔드 파일의 주석/JSDoc/Swagger 문자열 전용 변경이며, 실행 로직·아키텍처·API 계약을
전혀 바꾸지 않는다. 새로 추가된 산문 서술은 전부 `spec/5-system/14-external-interaction-api.md`
§R17 및 `1-manual-trigger.md` 자체 `## Rationale` 이 이미 확정한 결정(base/wrapper 분리
이유, Manual-only 범위, 정확 일치만 감지 등)을 **그대로 재인용**하는 수준이라 기각된 대안의
재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 어느 것도 관측되지 않았다. 유일한
관찰 사항(마커 규칙의 산문 재기술이 SoT 분산 위험을 소폭 늘림)은 개발자가 이미 자체
발견해 정본 트래커에 해결 경로와 함께 등재해 두어 INFO 수준에 그친다.

## 위험도
NONE
