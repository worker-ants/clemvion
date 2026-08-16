# 정식 규약 준수 검토 — `plan/in-progress/eia-internal-rest-error-masking.md`

## 검토 범위

target 문서(`plan/in-progress/eia-internal-rest-error-masking.md`, 실물 309줄)와 그 안의 spec
초안(§R17 불릿 교체, `secret-store.md §1` 신설, `:910` 문구 정정)을 `spec/conventions/**`
(특히 `secret-store.md`·`error-codes.md`·`node-output.md`·`swagger.md`·`spec-impl-evidence.md`)
및 `.claude/docs/plan-lifecycle.md` frontmatter 스키마와 대조했다. 이전 라운드(`16_32_42`)가
지적한 CRITICAL 2건(`redactExecutionErrorValue` 잔존 · `NodeExecution.error` 범위 오판)은 실물
파일에서 이미 정정 확인됨(§R17 초안이 `redactStoredErrorForResponse` 로 갱신, `nodeExecutions[].error`
+ `background-runs` 가 마스킹 범위에 포함).

## 발견사항

- **[WARNING] frontmatter `spec_impact` 가 체크리스트가 예정한 세 번째 spec 편집을 누락**
  - target 위치: frontmatter (`spec_impact:` 블록, 문서 상단) vs `## 조치` 의 "planner 턴 ⓑ" 항목
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4/§5 (Gate C)` — `spec_impact` 는 완료(`complete/`)
    이동 시점에 **실제로 건드린 모든 spec 경로**를 나열해야 하며(`spec-plan-completion.test.ts` 가
    강제), CLAUDE.md "정보 저장 위치" 표가 이 스키마를 plan frontmatter 의 단일 진실로 지정한다.
  - 상세: 현재 frontmatter 는 `spec/5-system/14-external-interaction-api.md` 와
    `spec/conventions/secret-store.md` 두 건만 선언한다. 그러나 `## 조치` 의 "planner 턴 ⓑ —
    `14-execution-history.md` 에 `Execution.error` 마스킹 정책 별도 명시" 항목은
    `spec/2-navigation/14-execution-history.md` 편집을 명시적으로 예정하고 있다(R-5 오독 방지
    캐비엇). 이 편집이 실행되면 `spec_impact` 는 3건이어야 하는데 지금은 2건뿐이다. in-progress
    단계라 build gate 는 아직 발화하지 않지만(§4: "in-progress 단계에선 의무 아님"), 이 저장소는
    이미 "정본 트래커에 미래형 등재 약속 후 미이행"을 5회 자백한 파일을 이 plan 이 직접 참조하고
    있으므로, 같은 성격의 누락을 지금 방치하면 `complete/` 이동 직전에 재작업이 필요해진다.
  - 제안: `spec_impact` 에 `spec/2-navigation/14-execution-history.md` 를 지금 추가해 두면
    이동 시점의 Gate C 재작업을 없앤다.

- **[INFO] `pending_plans` 의 선언 방향이 실제 관계와 반대로 읽힐 소지**
  - target 위치: frontmatter `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]`
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4` — plan 레벨 `pending_plans` 의 정의는 "이 plan 이
    착수·완료하기 위해 **먼저 닫혀야 하는** 선행/의존 plan"이다.
  - 상세: 본문 "## 다른 plan 과의 관계"는 이 작업이 정본 트래커의 I1·D 항목을 **집행**하고, 완료 후
    트래커의 해당 항목을 **닫는** 관계로 서술한다(`## 조치` 마지막 항목 "정본 트래커 I1·D 닫기").
    즉 실제 의존 방향은 "트래커 → 이 plan(집행) → 트래커 갱신"이며, 트래커 자체가 이 plan의
    착수·완료 이전에 먼저 종료돼야 하는 선행조건은 아니다(트래커는 다수의 무관한 항목을 계속
    보유한 살아있는 마스터 백로그). 필드의 문서화된 의미(선행조건)와 실제 서술(원천/역참조)이
    엇갈린다.
  - 제안: 이 필드는 build guard가 없어(plan-lifecycle.md §4: "plan 레벨에는 가드가 없다") 어떤
    것도 깨지지 않지만, 다음 독자가 "트래커가 먼저 닫혀야 한다"로 오독할 수 있다. 본문에 이미
    관계가 명시돼 있으므로 CRITICAL/WARNING 은 아니며, 굳이 고치려면 frontmatter 옆에 한 줄
    주석("역참조 — 선행조건 아님")을 붙이거나 이 필드를 생략하고 본문 cross-link 만 남기는
    편이 더 정확하다.

- **[INFO] 응답 DTO가 여전히 엔티티-spread 형태를 유지 — `swagger.md §5-1` 이상과 부분 합치**
  - target 위치: `## 설계` 절의 "`toTerminalErrorPayload` 를 재사용하지 않는다... 내부 응답 계약은
    그대로 두고 값만 마스킹" 및 §표면 전수 표(엔티티 spread 자리 명시)
  - 위반 규약: `spec/conventions/swagger.md §5-1` "엔티티(`entities/*.entity.ts`)를 그대로
    노출하지 말고, API 응답 형태에 맞춰 별도 DTO를 만듭니다. 비밀값(credentials, passwordHash
    등)은 마스킹하거나 제외합니다."
  - 상세: 이 한 문장은 두 요구를 담고 있다 — (a) 엔티티 직접 노출 금지(별도 DTO), (b) 비밀값
    마스킹. 이번 계획은 (b)를 정확히 충족하도록 설계됐고 실제로 `ExecutionDto`/`ExecutionDetailDto`
    의 `error?: Record<string, unknown> | null` 필드는 이미 `@ApiPropertyOptional({ nullable:
    true })` 로 opaque 하게 선언돼 있어 값 마스킹과 wire 형식이 어긋나지 않는다(신규 위반 아님).
    다만 (a) — `findById`/`getChain`/`stop` 이 엔티티를 직접 spread 해 반환하는 기존 패턴 —
    는 이 PR이 명시적으로 "형태 통일이 아니라 값 마스킹" 이라 범위 밖에 두면서 그대로 남는다.
    이는 새로 도입되는 위반이 아니라 이 PR 이전부터 있던 아키텍처 부채이고, 문서도 그 트레이드오프
    (프런트 응답 계약 불변경의 이득)를 근거로 명시하고 있어 이번 스코프에서 고칠 것을 요구하기엔
    비용이 크다.
  - 제안: 조치 불요(이번 PR 스코프 밖 확인). 다만 향후 이 표면들을 정식 응답 DTO 인스턴스화로
    옮기는 별도 항목이 생기면 `swagger.md §5-1` (a) 조항을 근거로 등재할 수 있다는 점만 기록해 둔다.

## 명명·출력 포맷 규약 — 위반 없음 (확인 사항)

- `redactStoredErrorForResponse` 함수명은 기존 `deepRedactSecrets`/`redactSecrets` 계열의
  `redact*` 접두 관행과 일치하고, 폐기된 `redactExecutionErrorValue`(기존 `ExecutionError`
  예외 클래스명을 부분 문자열로 포함해 grep 충돌을 유발)를 회피한 이유가 함수 JSDoc과 plan
  본문 양쪽에 명시돼 있다(`16_03_57` W1 반영 확인).
- `secret-store.md §1`에 신설 예정인 "비대상 — `Trigger.config.interaction.triggerToken`" 블록은
  기존 "비대상 — `AuthConfig.config`" 블록과 동일한 굵은 헤더 + blockquote 서식을 따르고, §7
  "새 secret type 추가 절차"(URI scheme 신설 대상)와는 무관함을 스스로 밝혀 절차 오적용이 없다.
  근거를 `AuthConfig.config` 문구 재사용이 아니라 독립적으로 세운 점(`16_03_57` W2 반영)도
  두 예외의 성격 차이(암호화 유무)를 정확히 구분한다.
- §R17 교체안의 문장 서식("**굵은 소제목** (결정 YYYY-MM-DD): 설명")은 기존 R17 불릿들의 서식과
  동일하다. `code`·`nodeId` 를 마스킹 대상에서 제외한다는 서술도 기존 §R17 불릿(같은 문서 상단)의
  기존 결정과 일치해 새 모순을 만들지 않는다.
- `14-external-interaction-api.md` frontmatter `code:` 갱신 계획(체크리스트 ⓓ)이 가리키는 두 경로
  (`codebase/backend/src/shared/utils/redact-stored-error.ts`,
  `codebase/backend/src/modules/executions/executions.service.ts`)는 실제 존재하는 파일이며
  `spec-impl-evidence.md` 스키마와 어긋나지 않는다.
- `error-codes.md`(에러 코드 문자열 명명 규율)·`node-output.md §3.2`(`output.error` 노드 레벨
  계약)는 이번 변경이 다루는 `Execution.error` **값 마스킹**과 레이어가 달라 충돌하지 않는다 —
  target 문서도 이를 스스로 명시한다("`code`·`nodeId` 는 대상이 아니다").

## 요약

target 문서는 `spec/conventions/secret-store.md`의 기존 "비대상" 서식을 정확히 재사용하고,
`swagger.md`의 nullable/optional DTO 필드 규약과 어긋나지 않게 값-마스킹 전용으로 스코프를
좁혔으며, 직전 리뷰 라운드의 CRITICAL 2건(폐기 함수명 잔존·`NodeExecution.error` 범위 오판)도
실물 파일에서 정정이 확인된다. 남은 문제는 정식 규약 위반이라기보다 **plan frontmatter 의
자기 정합성** 문제 하나(`spec_impact` 목록이 체크리스트가 예정한 세 번째 spec 편집을 아직
반영하지 않음, WARNING)이며, 나머지 두 관찰(`pending_plans` 방향성, 엔티티-spread 잔존)은
정보성 INFO로 이번 PR의 실행을 막을 사유가 아니다.

## 위험도

LOW
