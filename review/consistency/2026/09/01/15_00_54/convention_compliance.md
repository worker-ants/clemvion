# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-audit-write-failed-metric.md`

## 검토 범위

target 은 `--spec` draft (`clemvion.audit.write_failed` 를 NF-OB-07 카탈로그에 등재)이며, 실제 변경 대상은
`spec/5-system/_product-overview.md`(NF-OB-07 표) · `spec/data-flow/9-observability.md` ·
`spec/data-flow/1-audit.md` 세 곳이다. `spec/conventions/**` 를 기준으로 명명·출력 포맷·문서 구조·API 문서·
금지 항목 다섯 관점을 확인했다. 코드 실측(`business-metrics.service.ts`, `audit-logs.service.ts`)과 실제
spec 원문을 대조해 draft 의 diff·claim 정확성도 함께 확인했다.

## 발견사항

이번 검토에서 CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다. 확인한 항목과 근거는 다음과 같다.

- **[INFO]** 메트릭 명명·라벨 표기 — 규약과 일치
  - target 위치: A-2 표 신규 행, B 절 인프라 메트릭 나열
  - 대조 규약: `spec/5-system/_product-overview.md` §NF-OB-07 카탈로그 헤더("OTel instrument 이름은 dot 표기(`clemvion.*`)"), 기존 라벨 표기(snake_case: `node_type`, `error_code`, `queue`, `state`)
  - 상세: `clemvion.audit.write_failed` 는 `clemvion.<domain>.<event>` dot 표기를 따르고, 라벨 `resource_type` 은 기존 라벨과 동일한 snake_case. 실측(`business-metrics.service.ts:106`, `codebase/backend/.../business-metrics.service.ts` `recordAuditWriteFailed`)과 draft 의 서술(Counter, unit `{event}`, `resource_type` 라벨)이 정확히 일치한다.
  - 제안: 없음 — 준수.

- **[INFO]** `resource_type` 라벨의 "미enum 나열" 스타일이 `error_code` 선례와 일관
  - target 위치: A-2 표 신규 행 라벨 열
  - 대조 규약: 같은 표의 `error_code`(닫힌 나열 없이 라벨명만 표기) vs `status`/`type`/`reason`(괄호 안에 실제 값 나열)
  - 상세: `resource_type` 은 code 가 정하지만 시그니처가 `string`(열림)이라 진짜 닫힌 enum 이 아니다. draft 는 이를 괄호 안에 값 목록 대신 "코드가 정하는 값, 실측 12종" 이라는 서술로 표기했는데, 이는 같은 표에서 이미 열림-라벨인 `error_code` 가 값 목록을 나열하지 않는 것과 같은 스타일이다(닫힌 유니온 라벨인 `component`/`reason`/`status`/`type` 만 값을 나열). 즉 "왜 이 라벨만 다르게 적었는가" 에 대한 답이 표 안에서 자기-일관적이다.
  - 실측 교차검증: `resourceType` 실사용 값 전수(grep) = `alert_rule`·`auth_config`·`execution`·`integration`·`member`·`user`·`workflow`·`workspace`·`workspace_invitation`·`trigger`·`schedule`·`model_config` = **정확히 12종** — draft 의 "실측 12종" 주장과 일치.
  - 제안: 없음 — 준수 확인.

- **[INFO]** `resource_type` 개방형 라벨(클램핑) 채택이 같은 카탈로그의 두 기존 패턴 중 하나(`error_code`)와 정합
  - target 위치: A-3, Rationale "기각한 대안" 두 번째 항목
  - 대조 규약: `spec/data-flow/9-observability.md` Rationale "`clemvion.redis.fail_open` 의 `component` 를 실제 배선된 값만 열거하는 이유" — "라벨 값 집합은 코드의 리터럴 유니온이 정하는 닫힌 집합과 1:1 로 유지한다 … 라벨을 `string` 으로 열어 두지 않는 이유이기도 하다"
  - 상세: 이 문장만 보면 "라벨은 항상 닫힌 유니온이어야 한다" 는 프로젝트 전역 규칙처럼 읽히지만, 실제로는 `spec/conventions/**` 에 등재된 정식 규약이 아니라 `redis.fail_open` 한 메트릭에 대한 국소 Rationale 이다. 같은 `BusinessMetricsService` 안에는 이미 `error_code`(열림 `string` + 64자 클램핑) 라는 별도 선례가 존재하고, draft 의 `resource_type` 은 그 선례를 따른다 — 코드 주석(`business-metrics.service.ts:172-178`)도 "`record()` 가 닫힌 유니온을 받도록 바뀌면 그때 이쪽도 유니온으로 좁히는 것이 맞다" 고 명시해 draft 의 Rationale 과 문구까지 일치한다. 따라서 위반이 아니라 기존 이중 패턴(닫힌 유니온 vs 열림+클램프) 중 이미 선례가 있는 쪽을 재사용한 것이다.
  - 제안(선택, 규약 갱신 성격): 이 판단 기준(닫힌 유니온이 원칙, 열림+클램프는 "compiler 로 증명되지 않는 소스" 한정 예외)이 앞으로도 반복될 패턴이면, `9-observability.md` 의 해당 Rationale 문단에 "단, 소스 시그니처가 이미 `string` 으로 열려 있어 닫힘을 컴파일러로 증명할 수 없는 경우는 클램핑으로 방어한다(`error_code` 선례)" 한 문장을 덧붙이는 편이 다음 사람에게 더 명확하다. 다만 이 문서는 `spec/conventions/**` 가 아니라 `spec/data-flow/` 소속이라 본 checker 의 1차 관할 밖이며, 강제 사항이 아니라 제안이다.

- **[INFO]** 문서 구조 — SKILL 이 요구하는 draft 구조·명명 컨벤션 준수
  - target 위치: 파일 전체
  - 대조 규약: `.claude/skills/project-planner/SKILL.md` §작업 워크플로 3 ("`plan/in-progress/spec-draft-<name>.md` 에 변경안 작성. 본문 끝에 `## Rationale`"), §Spec 문서 구조 3섹션
  - 상세: 파일명이 `spec-draft-<name>.md` 패턴(선례: `plan/complete/spec-draft-web-chat-console.md`)을 따르고, `## Overview` → `## 변경안`(SKILL 이 쓰는 용어 그대로) → `## Rationale`(폐기된 대안 포함) → `## 관련` 순서로 구성돼 요구된 3섹션 + 부가 cross-reference 섹션 구조를 만족한다. frontmatter 도 `plan-lifecycle.md §4` 의 필수 3필드(`worktree`/`started`/`owner`)를 모두 포함한다.
  - 제안: 없음 — 준수.

- **[INFO]** frontmatter 면제 대상 정합 — `_product-overview.md`·`data-flow/**` 프론트매터 요구 없음
  - target 위치: A절(`_product-overview.md`), B·C절(`data-flow/*.md`)
  - 대조 규약: `spec/conventions/spec-impl-evidence.md` §1 (제외 목록: `_*.md` 밑줄 prefix, `spec/data-flow/**` 는 애초에 적용 대상 외)
  - 상세: draft 는 세 파일 모두에 frontmatter(`id`/`status`/`code`) 추가를 제안하지 않는데, 실제로 세 파일 다 이 가드의 면제 대상(`_product-overview.md` 는 밑줄 prefix, `data-flow/**` 는 inclusive list 자체에 없음)이라 정확하다. 실측(`head -6 spec/5-system/_product-overview.md`, `head -5 spec/data-flow/9-observability.md`)에서도 두 파일 다 frontmatter 가 없는 것으로 확인돼 draft 의 무갱신이 옳다.
  - 제안: 없음 — 준수.

- **[INFO]** anchor 링크 형식 — 기존 slug 규칙과 일치
  - target 위치: C 절 `[NF-OB-07 카탈로그](../5-system/_product-overview.md#nf-ob-07-메트릭-카탈로그)`
  - 대조 규약: `spec/conventions/spec-impl-evidence.md` §4.2 `spec-link-integrity.test.ts`(rehype-slug/github-slugger 파이프라인과 동등한 slug 검증)
  - 상세: 실측 결과 `spec/data-flow/9-observability.md:207`, `spec/5-system/4-execution-engine.md:1746` 두 기존 링크가 이미 정확히 동일한 anchor(`#nf-ob-07-메트릭-카탈로그`)를 쓰고 있어 draft 의 신규 링크도 build-time 링크 무결성 가드를 통과할 형식이다.
  - 제안: 없음 — 준수.

- **[INFO]** API 문서 규약(Swagger/DTO) — 해당 없음
  - target 위치: 전체
  - 상세: 이번 변경은 메트릭 카탈로그·서술 텍스트 동기화이며 API 엔드포인트·DTO·컨트롤러 데코레이터를 건드리지 않는다. `spec/conventions/swagger.md` 관할 밖.

- **[INFO]** 금지 항목 — 해당 없음
  - target 위치: 전체
  - 상세: `error-codes.md`(rename 금지·인라인 문자열 금지)·`audit-actions.md`(action 인라인 문자열 금지, union 강제) 등에서 명시적으로 금지한 패턴(에러 코드 rename, action 인라인 문자열, resource dot-prefix 누락 등)에 해당하는 변경이 없다. 신규 메트릭 이름·Counter 타입 신설이며 rename 이 아니다.

## 요약

target draft 는 `spec/conventions/**` 에 정의된 정식 규약(문서 구조 3섹션·frontmatter 스키마·frontmatter 면제 목록·링크 anchor 형식) 을 모두 준수하며, 메트릭 명명(dot 표기)·라벨 표기(snake_case)·라벨 카디널리티 서술 스타일도 `spec/5-system/_product-overview.md` NF-OB-07 카탈로그의 기존 관행과 정합하다. 코드 실측(`business-metrics.service.ts`, `audit-logs.service.ts`)과 draft 의 서술(Counter 타입, unit, 라벨명, "실측 12종")이 정확히 일치해 사실관계 오류도 없다. 유일하게 짚을 만한 지점은 `spec/data-flow/9-observability.md` 자체 Rationale 이 "라벨을 string 으로 열어두지 않는다" 는 문구를 국소적으로 남기고 있어, 그 옆에 새로 추가되는 열림+클램프 방식 라벨(`resource_type`)과 표면적 긴장이 있어 보인다는 점인데 — 이는 같은 서비스 안의 기존 `error_code` 선례를 따른 것으로 실제 위반은 아니며, 대상 문서도 `spec/conventions/**` 가 아니라 `spec/data-flow/` 소속이라 본 checker 의 1차 관할 밖이다(정보 제공 목적으로만 기록).

## 위험도

NONE
