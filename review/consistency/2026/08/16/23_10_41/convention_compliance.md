# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-eia-fanout-masking.md`

## 검토 방법 메모

번들된 `spec/conventions/**` 중 이 target 과 실질적으로 관련 있는 파일(`secret-store.md`·`audit-actions.md`)은
전문이 포함돼 있었으나, `error-codes.md`·`swagger.md`·`node-output.md`·`execution-context.md`·
`spec-impl-evidence.md`·`redis-keys.md` 등은 예산 초과로 번들에서 절단돼 있었다. 이 checker 는 파일시스템
직접 read 권한이 있으므로 절단된 파일들을 `spec/conventions/` 에서 직접 읽어 규약 원문을 확인했다(누락 없이
검토). 아울러 target 이 인용하는 `22_22_36` 리뷰 세션(`review/consistency/2026/08/16/22_22_36/`)과
target 이 편집 대상으로 지목하는 실제 spec 본문(`spec/5-system/14-external-interaction-api.md` §R17,
`6-websocket-protocol.md` §4.1/§4.4/Rationale, `12-webhook.md` §5.3)을 직접 열어 인용 정확성을 대조했고,
`redactStoredDataForResponse`/`redactStoredErrorForResponse`/`deepRedactSecretsPreserving` 등 언급된
코드 식별자가 실제로 `codebase/backend/src/...` 에 그 이름 그대로 존재하는지도 grep 으로 확인했다.

## 발견사항

- **[WARNING]** draft 산출물에 `## Rationale` 마감 섹션이 없다
  - target 위치: target 문서 전체 — `## 변경 1` → `## 변경 2` → `## 변경 3` → `## 검토 요청 관점` 순으로
    끝나며 `## Rationale` 헤딩이 없다.
  - 위반 규약: [`.claude/skills/project-planner/SKILL.md`](.claude/skills/project-planner/SKILL.md) 작업
    워크플로 3번 — *"**draft 작성**: `plan/in-progress/spec-draft-<name>.md` 에 변경안 작성. 본문 끝에
    `## Rationale` 로 결정 근거 명시."*
  - 상세: 같은 패턴(`spec-draft-<name>.md`, "변경 N" 나열 구조)의 기존 완료 draft 를 표본 조사하면
    (`plan/complete/spec-draft-ws-types-canonical-location.md`, `spec-draft-eia-context-schema-absence-convention.md`,
    `spec-draft-error-codes.md`, `spec-draft-node-cancellation-chat-channel-correction.md`) **전부**
    `## Rationale` 섹션을 갖고 있다 — 이는 build guard(`plan-frontmatter.test.ts`)가 강제하는 항목은
    아니지만(frontmatter 3필드만 검사, 본문 섹션은 미검사), SKILL.md 명문 지시 + 100% 일관된 선례라는 점에서
    이번 draft 만 이탈했다. target 자체의 "왜"는 각 변경 항목 안에 산재해 있으나("왜 새는가"·"처방"·"근거" 등
    inline 서술), 한 곳에 모인 결정 근거 섹션이 없어 이 draft 가 spec 반영 후 `project-planner` 5단계
    ("spec 반영: draft 의 변경을 `spec/<영역>/*.md` 에 적용")를 수행할 때 근거를 다시 흩어진 조각에서
    재조립해야 한다.
  - 제안: `## Rationale` 섹션을 신설해 (a) ①·② flip 판단 근거, (b) egress-only 원칙과 ingestion 마스킹의
    공존 논리, (c) §4.1 vs 기존 중복 `### 4.4` 사이에서 §4.1 을 택한 이유를 한 곳에 모아 명시할 것. 또는
    "이 draft 는 `22_22_36` 세션의 산발적 WARNING/rationale 후속조치 모음이라 Rationale 을 각 변경 항목에
    inline 으로 남긴다"는 의도라면, 그 의도 자체를 문서 서두에 한 줄로 밝혀 SKILL.md 지시와의 괴리가
    의도적 예외임을 표시할 것(규약 갱신이 아니라 예외 표시만으로 충분).

- **[INFO]** `12-webhook §5.3` 교차 참조가 기존 정밀 앵커 관행과 다르다
  - target 위치: `## 변경 1` → `1-d. ingestion-time ↔ egress-time 마스킹 철학 상호 참조` 첫 문장 —
    `[12-webhook §5.3](./12-webhook.md) 은 민감 헤더를 **ingestion 시점**에 지우고(...)`.
  - 위반(정확히는 불일치) 규약: 명시적 conventions 파일 규정은 아니고 **동일 대상 절에 대한 기존 spec 상호
    참조 관행**과의 불일치다 — `spec/5-system/5-expression-language.md` 는 정확히 같은 절
    (`12-webhook.md` §5.3 민감 헤더 마스킹)을 세 곳에서
    `[12-webhook §5.3](./12-webhook.md#53-민감-헤더-마스킹-ingestion)` 형태로 **앵커까지 포함**해 인용한다
    (`:240`, `:242`, `:539`).
  - 상세: draft 의 새 문단이 그대로 spec 본문에 반영되면, 같은 절을 가리키는 링크가 파일 안에서
    앵커-포함(3곳, `5-expression-language.md`)과 앵커-미포함(신규 1곳, `14-external-interaction-api.md`)으로
    갈린다. 기능적으로는 두 형태 모두 파일까지는 도달하지만, 앵커 없는 링크는 문서 최상단으로 이동해
    사용자가 §5.3 을 직접 찾아야 한다. (참고: `[EIA §R17](./14-external-interaction-api.md)` 처럼 앵커 없이
    긴 Rationale 섹션 전체를 가리키는 기존 선례도 있어 "앵커 생략"이 이 저장소에서 전면 금지된 패턴은
    아니다 — 다만 §5.3 은 이미 앵커-포함 인용이 다수 확립돼 있는 절이라 이번 신규 인용만 다른 스타일을
    쓰는 것이 국소 불일치다.)
  - 제안: `[12-webhook §5.3](./12-webhook.md#53-민감-헤더-마스킹-ingestion)` 로 앵커를 붙여 기존 세 인용과
    통일할 것.

## 검토 관점별 결론

1. **명명 규약**: 위반 없음. `redactStoredDataForResponse`/`redactStoredErrorForResponse`/
   `deepRedactSecretsPreserving`/`toResponseExecution`/`toNodeExecutionDto` 등 target 이 언급하는 식별자는
   실제 코드(`codebase/backend/src/modules/executions/executions.service.ts`,
   `codebase/backend/src/shared/utils/{redact-stored-error,sanitize-error-message}.ts`)에 정확히 그 이름으로
   존재해 새 명명을 만들지 않고 기존 명명을 정확히 인용한다. `1-c` 의 "여섯 표면" 목록은
   `executions.service.ts:1012-1019` 의 정본 표와 항목·순서까지 1:1 일치한다. plan draft 파일명
   (`spec-draft-eia-fanout-masking.md`)·frontmatter(`worktree`/`started`/`owner` 3필드)도
   `plan-lifecycle.md §4` 스키마 준수.
2. **출력 포맷 규약**: 위반 없음. `2-a` 의 `nodeName`→`nodeLabel` 정정은 실측(`nodeName:` 코드베이스 0건,
   `nodeLabel: node.label ?? node.type` 다수 emit 지점)과 일치해 spec-wire 드리프트를 바로잡는 방향이며,
   `error-codes.md`/`node-output.md` 가 규정하는 필드 표기 규칙과 충돌하지 않는다. 신규 API 응답 필드·
   에러 코드 신설은 없다.
3. **문서 구조 규약**: draft 가 편집하는 대상 spec 파일들(`14-external-interaction-api.md`,
   `6-websocket-protocol.md`, `12-webhook.md`) 자체의 Overview/본문/Rationale 3섹션 구조는 훼손하지
   않는다 — `1-a`~`1-c`·`3` 은 본문(§R17/§5.3) 안에, `2-c` 는 명시적으로 기존 `## Rationale` 절 내부
   해당 항목 바로 아래에 삽입되도록 위치를 정확히 지정했다(실제 라인 대조 확인). 다만 위 WARNING 은
   draft **자기 자신**의 구조(SKILL.md 가 요구하는 `## Rationale` 마감)에 대한 것이다.
4. **API 문서 규약**: 해당 없음 — target 은 신규 Controller/DTO/`@Api*` 데코레이터를 도입하지 않는다
   (기존 REST 응답 필드의 값 마스킹만 다룬다).
5. **금지 항목**: 위반 없음. `secret-store.md`(마스터키 미노출·IV 재사용 금지 등)·`swagger.md`(닫힌
   union 을 `additionalProperties` 로 뭉개지 말 것 등) 의 금지 패턴에 해당하는 변경이 target 안에 없다.

## 요약

target draft 는 이미 머지된 구현(`1b8fd5cc7`·`fe6a54c80` 등)을 spec 에 사후 등재하는 문서이며, 인용하는
코드 식별자·라인 위치·선행 리뷰(`22_22_36`) 항목번호가 실제 소스와 정확히 일치해 "정식 규약" 관점에서
CRITICAL 로 볼 위반은 발견되지 않았다. 명명·출력 포맷·API 문서 규약은 모두 기존 확립된 패턴을 정확히
답습한다. 유일한 실질적 이탈은 draft 자신이 `project-planner` SKILL.md 가 명시하고 다수 선례가 지키는
"본문 끝 `## Rationale`" 구조를 갖추지 않은 점(WARNING)이며, 부가로 신규 교차 참조 하나가 같은 절을
가리키는 기존 앵커-포함 인용 스타일과 다르다(INFO).

## 위험도

LOW
