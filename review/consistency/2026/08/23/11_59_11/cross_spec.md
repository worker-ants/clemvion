# Cross-Spec 일관성 검토 — `plan/in-progress/swagger-decisions.md`

## 사전 참고: 번들 예산 절단

prompt 에 첨부된 "관련 spec 본문" 은 `spec/conventions/**` (swagger.md 포함) 전체와 그 외
112개 파일이 **컨텍스트 예산 초과로 완전히 생략**돼 있었다(기지 이슈,
`feedback_consistency_spec_mode_budget.md`). target 이 직접 수정하는
`spec/conventions/swagger.md` 자체가 빠져 있어 번들만으로는 이 검토가 불가능했으므로,
`Read`/`Bash` 로 아래 파일을 직접 열어 대조했다: `spec/conventions/swagger.md` 전문,
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` (정본 트래커, 해당 3항목
원문), `spec/4-nodes/7-trigger/0-common.md`, `spec/5-system/4-execution-engine.md`,
`spec/data-flow/10-triggers.md`, `spec/5-system/14-external-interaction-api.md`,
`spec/2-navigation/4-integration.md`, `spec/conventions/cafe24-api-catalog/_overview.md`,
그리고 `codebase/backend/src/modules/workflows/workflows.controller.ts` (런타임 검증).

## 발견사항

- **[WARNING]** ③ 의 "강제 대상 아님" 범위가 `swagger.md §3` 의 세 번째 길이 기준(엔드포인트
  `description` 50~150자)을 다루지 않는다
  - target 위치: `## ③ 길이 규칙 — 실측이 "규칙 아님" 을 말한다` (line 64-77), 특히
    "강제는 정말 필요한 곳에만 남긴다 — 엔드포인트 `summary` 는 ... DTO `description` 은
    그렇지 않다"
  - 충돌 대상: `spec/conventions/swagger.md` §3 본문 (L256-257) — "DTO `description`은
    10~40자 내외" / "`summary`는 10~20자 내외, `description`은 **50~150자 내외**"
    (엔드포인트 `@ApiOperation({ description })`)
  - 상세: §3 에는 독립된 세 길이 기준(DTO description 10~40 / 엔드포인트 summary 10~20 /
    엔드포인트 description 50~150)이 있는데, target 은 앞의 둘(DTO description=비강제,
    summary=강제 유지)만 판정하고 세 번째(엔드포인트 description)는 언급이 없다. 정본
    트래커(`spec-sync-external-interaction-api-gaps.md:924-926`)에 **바로 이 두 줄을
    혼동한 전례**가 이미 기록돼 있다 — "이 PR 은 한때 '가이드(150자) 안에 들어왔다' 고
    적었는데 틀렸다 ... 내가 엔드포인트 줄을 봤다". 같은 문서 안에서 같은 축의 혼동이
    재발할 위험이 실제로 선례가 있는 지점이다.
  - 제안: `spec/conventions/swagger.md §3` 개정 시 엔드포인트 `description`(50~150자)
    강제 여부도 명시적으로 판정해 3-way 표로 정리한다(DTO description / 엔드포인트
    summary / 엔드포인트 description 각각의 강제 여부).

- **[WARNING]** ③ 이 기존 §3 "보안·정책 캐비엇 예외" 절과의 관계를 정리하지 않는다
  - target 위치: `## ③ 길이 규칙` 전체 (line 64-77)
  - 충돌 대상: `spec/conventions/swagger.md` §3 본문의 "예외 — 보안·정책 캐비엇" 블록
    (L260-270) + `## Rationale` 의 "§3 보안·정책 캐비엇 예외" 절 (L406-431)
  - 상세: 현재 §3 은 "DTO description 10~40자 내외" 를 **원칙(강제)** 으로 두고, 보안·정책
    캐비엇 2 부류만 그 강제의 **명시적 예외**로 따로 카테고리화해 둔 구조다(Rationale 에
    "새 관행이 아니라 추인이었다"·"요청 쪽도 똑같이 '추인' 이다"로 근거를 쌓아 왔다).
    target 의 ③ 결정("DTO description 전체가 강제 대상 아님")이 그대로 반영되면, 이
    보안·정책 캐비엇은 더 이상 "예외"가 아니게 된다 — 강제되는 원칙이 없는데 그 원칙의
    예외만 남는 모순이 생긴다. target 자신도 이 두 트랙(§3 예외 확장 vs 기본 규칙
    비강제화)이 "별개 판단"이라고 트래커에 이미 적어 뒀지만(`spec-sync-...md:977-980`
    "(c) '내외' 라는 완충 표현대로 애초에 강제 대상이 아니라고 명문화"), 이 target 문서
    자체는 두 트랙을 합칠 때 예외 절을 어떻게 재서술할지(삭제/통합/격이 다른 "권장
    최소선"으로 재정의 등) 언급이 없다.
  - 제안: `swagger.md §3` 개정 시 보안·정책 캐비엇 절을 "비강제 원칙 위의 굳이 남긴 강제
    최소선"으로 재정의하거나, 캐비엇 절 문구 자체를 "스타일 힌트에서도 이 두 부류는 반드시
    설명을 담아야 한다"는 형태로 톤을 낮춰 재작성해 §3 전체가 자기모순 없이 읽히게 한다.

- **[INFO]** target 의 실측 표와 `swagger.md` 기존 Rationale 의 실측 수치가 미세하게
  어긋난다
  - target 위치: `## ③ 길이 규칙` 표 (line 66-70) — "요청 DTO 116/335 (34%)"
  - 충돌 대상: `spec/conventions/swagger.md` `## Rationale` §3 절 (L423-427) — "요청 DTO
    73개 파일의 `description` 333개 중 **114개(34%)**가 40자를 넘는다" (동일 문구가
    `spec-sync-external-interaction-api-gaps.md:931-935` 에도 있음, 2026-08-22 실측).
    직접 카운트한 결과 request DTO 파일 수는 현재 **74개**(target/기존 73개 어느 쪽과도
    다름).
  - 상세: 모집단(요청 DTO, `responses/`·`*-response.dto.ts` 제외, description>40자)이
    동일한데 파일 수(73/74/target 미기재)·분모(333 vs 335)·분자(114 vs 116)가 조금씩
    다르다. 백분율은 우연히 둘 다 34%로 일치해 눈에 안 띄지만, `swagger.md` 에 target 의
    새 수치를 그대로 얹으면 같은 문서 안(Rationale 문단 vs 새로 추가될 §3 본문/표)에
    **같은 모집단을 가리키는 서로 다른 실측값 두 개**가 남는다. (part 174/463=37.6%→반올림
    37%로 표기한 것도 38%가 더 정확한 반올림이라 사소한 산술 오차 후보.)
  - 제안: ③ 반영 시 `swagger.md` Rationale 의 기존 333/114 수치를 target 의 재실측치로
    교체(또는 병기하며 "재실측일" 명시)해 한 문서 안에 두 스냅숏이 남지 않게 한다.

## 검증한 항목(충돌 없음 — 참고용)

- ① `execute` 여분 키 비거부: `spec/5-system/2-api-convention.md`·
  `spec/5-system/14-external-interaction-api.md` 어디에도 `execute` 가 top-level 여분
  키를 400 으로 거부한다는 서술이 없다. EIA §의 `MASKED_VALUE_RESUBMITTED` 거부는
  **값-레벨** 마커 검사(`resolveTriggerParametersRejectingMasked`)로, 구조적
  whitelist(`forbidNonWhitelisted`) 와는 다른 메커니즘이라 target 의 "전역 파이프
  미진입" 서술과 모순되지 않는다.
- ② `input` deprecation: `spec/4-nodes/7-trigger/0-common.md:30`·
  `spec/data-flow/10-triggers.md:41` 이 이미 `parameterValues` 를 1순위로,
  `input`(및 `input?`)을 2순위/선택으로 문서화하고 있어 target 의 "parameterValues 가
  preferred" 서술과 일치한다. 런타임 코드
  (`workflows.controller.ts:304-309`, `// Accepts parameterValues (preferred) or
  input.parameters`)도 동일하게 확인된다. `legacyInput` 리네임 기각 논리도
  `spec/2-navigation/4-integration.md:1552` 의 기존 "rename 시 deprecated 처리·alias
  추가 등 호환성 부담만 발생" 원칙과 형태가 같아 선례와 정합적이다.
- swagger.md §3 자체의 Rationale 이 이미 "§3 이 자기 도입 때 쓴 '이미 굳은 관행의 추인'
  논리"를 인용하며 기본 규칙 비강제화 판단을 **별개 후속 결정으로 예견**해 두고 있다
  (L429-431 "넓히지 않은 것 ... 그건 이 예외의 문제가 아니라 별개 판단이라 여기서
  건드리지 않는다") — target ③ 은 그 예견된 후속 판단을 정확히 메우는 자리라 구조적으로는
  이미 자리가 마련돼 있었다.
- DTO description 길이에 대한 자동 lint/CI 강제가 코드베이스에 없음을 확인 — ③ 의
  "비강제 명문화"가 실제 tooling 과 충돌할 여지도 없다.
- `deprecated` 라는 동일 어휘가 `spec/conventions/cafe24-api-catalog/_overview.md` 등에서
  이미 "외부 API endpoint 폐기 상태"(카탈로그 enum 값)로 쓰이고 있으나, 그 문서 자체가
  "본 도메인은 spec 문서 자체의 폐기와는 별 도메인"이라고 명시적으로 경계를 그어 둔
  선례가 있어 OpenAPI `deprecated: true` 필드 플래그(target ②)와 의미 도메인이 충돌하지
  않는다.

## 요약

Cross-spec 관점에서 **직접적 모순(CRITICAL)은 발견되지 않았다**. ①②는 오히려 기존
`spec/4-nodes/7-trigger/0-common.md`·`spec/data-flow/10-triggers.md`·런타임 코드와
정합적이며, target 이 제시하는 근거(런타임 `parameterValues` preferred, 전역 파이프
미진입)는 직접 검증으로 확인됐다. ③은 swagger.md 자신의 Rationale 이 이미 예견해 둔
후속 판단 자리를 메우는 결정이라 구조적으로 무리가 없으나, (a) §3 의 세 번째 길이 기준
(엔드포인트 description 50~150자)을 언급하지 않은 점 — 같은 문서에서 이미 한 번 혼동된
전례가 있는 축이라 재발 위험이 실측된다 — 과 (b) 기존 보안·정책 캐비엇 예외절이 비강제
원칙 아래서 자기모순으로 남을 위험, (c) target 표와 swagger.md 기존 Rationale 사이의
사소한 실측 수치 drift 를 실제 `swagger.md §3` 문면 개정(작업 목록 3번째 항목) 시점에
명시적으로 처리해야 한다. 이 셋은 spec 간 직접 모순이라기보다 "같은 파일 안에서
새 서술과 기존 서술이 정합적으로 봉합되는가"의 문제이므로 WARNING 등급으로 남긴다.

## 위험도

LOW
