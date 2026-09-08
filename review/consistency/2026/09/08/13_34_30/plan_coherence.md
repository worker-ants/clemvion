# Plan 정합성 검토 — target: `spec/5-system/` (--impl-done, diff-base=origin/main)

## 검토 범위 및 방법

- target 은 `spec/5-system/**` 델타 0(정상 — 코드 전용 PR). 실제 구현 diff 는
  `git diff origin/main...HEAD --stat` 로 재확인 — 51개 변경 파일(소스 19개 + `plan/`·`review/`
  산출물), 핵심은 `.claude/test-stages.sh`·`PROJECT.md`·`http-exception.filter.ts`·
  `integration-oauth.service.ts`·`workflow-versions.service.ts`·`workspaces.service.ts`·
  `tsconfig.build.json`·`repo-guards/__tests__/**`(신규 3파일)·`webhook-trigger.e2e-spec.ts`·
  `codebase/frontend/src/lib/api/workflows.ts`.
- 프롬프트 번들에 전문이 실린 plan: `spec-followups-batch-b.md`(이번 turn 이 실행 중인 바로 그
  plan, B-1~B-8) · `spec-draft-nullable-notation-followups.md`(상위 planner 트랙, B-1~B-8 의
  출처이자 8개 체크박스 플립 대상).
- 나머지 in-progress plan 62개는 예산 절단 — diff 가 건드린 파일·식별자(`tsconfig.build.json`,
  `pg-error`/`isPostgresUniqueViolation`, `listMembers`, `WorkflowVersionDetail`,
  `endpointPath`/`rethrowEndpointPathConflict`)로 전체 `plan/in-progress/**` 를 `grep -rl` 전수
  검색해 접점을 보완했다. 접점이 나온 것은 `auth-guard-reflection-hardening.md` 단 하나.

## 발견사항

- **[WARNING]** `tsconfig.build.json` exclude 확장(B-2)이 자매 plan 의 조건부 유예 결정을
  사전 통보 없이 앞질렀다
  - target 위치: `codebase/backend/tsconfig.build.json` exclude 배열 신규 3번째 항목
    `**/__test-utils__/**`(diff), `plan/in-progress/spec-followups-batch-b.md` B-2 /
    체크리스트 `- [x] B-2 tsconfig.build.json exclude(디렉터리 이름 규약)`
  - 관련 plan: `plan/in-progress/auth-guard-reflection-hardening.md` 미해결 항목(여전히
    `- [ ]`, 320행) — *"`__test-utils__` 디렉터리가 **devDependency 를 import 하기 시작하면**
    `tsconfig.build.json` 의 `exclude` 에 [추가한다]"*. 그 항목은 2026-08-29 재실측에서
    "지금 2곳(`common/`·`modules/integrations/`)은 순수 함수라 안전 → **유예 유지**, 트리거는
    devDependency import 여부" 로 명시적으로 **지금 넣지 않는다**를 결정해 둔 상태다. 이유로
    든 것은 *"지금 exclude 를 넣으면 그 디렉터리들이 타입체크 대상에서 빠져 `__test-utils__`
    의 타입 오류를 아무도 못 보게 된다"*.
  - 상세: batch-b 의 B-2 는 정확히 같은 사실관계(`__test-utils__` 전 파일이 node 내장 +
    로컬 import 뿐, devDependency 없음 — 본문 스스로 "지금은 지뢰가 아니다"라고 적음)를
    확인하고도 **정반대 결론**(exclude 를 지금 추가)을 내렸다 — 근거는 "죽은 코드가 dist 에
    실린다"는 다른 축이다. 즉 같은 증거로 한쪽 plan 은 "아직 넣지 마라", 다른 plan(batch-b)은
    "지금 넣는다"를 각각 독립적으로 결정했고, 서로를 인용하지 않았다(`grep -rn
    "auth-guard-reflection-hardening" plan/in-progress/spec-followups-batch-b.md
    plan/in-progress/spec-draft-nullable-notation-followups.md` → 0건).
    실측으로 부작용 여부를 확인한 결과, backend 전체-프로그램 타입체크 ratchet
    (`scripts/check-backend-typecheck-ratchet.py`)은 `tsconfig="tsconfig.json"`(exclude 없는
    베이스 config)을 쓰고 `tsconfig.build.json` 의 exclude 를 상속하지 않으므로,
    `auth-guard-reflection-hardening.md` 가 우려한 "타입체크 사각"은 **이번 변경으로는
    발생하지 않는다**(`codebase/backend/tsconfig.json` 에 `exclude` 키 자체가 없음을 직접
    확인). 그러나 이는 기술적 무해성이 확인된 것일 뿐, **plan 정합성 문제는 남는다**:
    `auth-guard-reflection-hardening.md` 의 해당 체크박스는 여전히 미체크 상태로 "트리거가
    오면 추가한다"는 조건부 서술을 유지하고 있는데, 그 조건(devDependency import)은 아직도
    충족되지 않았음에도 결과물(exclude 추가)은 이미 다른 이유로 존재한다. 다음 세션이 이
    plan 을 열면 "아직 추가 안 됐다"는 거짓 전제로 같은 판단을 반복하거나, 반대로 실제 코드를
    보고 "이미 있는데 왜 open 인가" 혼란을 겪는다.
  - 제안: `auth-guard-reflection-hardening.md` 의 해당 항목을 닫고, "2026-09-08 배치 B-2 가
    다른 사유(dead code, devDependency 무관)로 이미 exclude 를 추가했다 — 이 항목의 트리거
    조건(devDependency import)은 아직 미충족이지만 결과는 선반영됐다. 타입체크 사각 우려는
    `check-backend-typecheck-ratchet.py` 가 `tsconfig.json`(exclude 없음)을 써서 무관함을
    확인" 형태의 코멘트를 남기고 종결하거나, 최소한 상호 참조 링크를 단다.

## 요약

이번 배치(B-1~B-8)와 그 출처인 `spec-draft-nullable-notation-followups.md` 사이의 대응은
정확하며(8개 체크박스 플립·2건 신규 planner 항목 등재 모두 diff 와 1:1 확인), 직전 라운드
(`review/consistency/2026/09/08/13_22_38`)가 지적한 `spec-followups-batch-b.md` frontmatter
`spec_impact` 오기재는 이번 target 상태에서 이미 `none` + 근거 각주로 정정되어 있어 재발
없음을 확인했다. 다만 전체 `plan/in-progress/**` 를 diff 식별자 기준으로 전수 검색한 결과,
`tsconfig.build.json` 의 `__test-utils__` exclude 추가(B-2)가 `auth-guard-reflection-hardening.md`
가 아직 열어 둔 조건부 유예 결정(트리거: devDependency import)을 다른 근거로 앞질러
집행하면서도 그 plan 을 갱신·상호 참조하지 않은 흠이 하나 발견됐다. 실측 결과 실질적인
타입체크 회귀는 없음을 확인했으므로 CRITICAL 로 올리지는 않되, 두 plan 이 같은 대상에 대해
서로 다른 결론을 각각 기록한 채 방치되면 다음 세션의 판단 근거가 오염되므로 WARNING 으로
등재한다. 그 외 미해결 결정 우회·선행 plan 미해소·후속 항목 누락은 발견되지 않았다(sort/order
whitelist 미해결 항목은 batch-b 가 의도적으로 손대지 않았고 `spec_impact: none` 각주가 그
경계를 정확히 기록하고 있다).

## 위험도

LOW
