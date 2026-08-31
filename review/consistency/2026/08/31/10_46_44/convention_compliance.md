# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-lockout-and-alertrule.md`

## 검토 방법

target 은 `plan/in-progress/` 에 있는 **spec draft**(project-planner 산출물)로, 실제 `spec/**`
편집안을 담고 있다. 번들 프롬프트의 conventions 상당수가 예산 초과로 절단돼 있어
(`spec-impl-evidence.md`·`error-codes.md`·`migrations.md` 등), 절단된 원본은 워크트리
파일시스템에서 직접 읽었다. 아울러 target 이 인용하는 `1-data-model.md`·`5-system/1-auth.md`·
`data-flow/9-observability.md`·`alerts-evaluator.service.ts`·`plan/in-progress/spec-sync-auth-gaps.md`
를 모두 직접 열어 target 의 실측 주장(표 값·컬럼·anchor·번호)을 하나씩 대조했다.

## 발견사항

- **[WARNING] 신규 추상 타입 `Number` 가 `1-data-model.md` 의 기존 타입 어휘와 불일치**
  - target 위치: `## ② alert_rule(V016)` 처방 표, `threshold | Number | 임계치 (NUMERIC(12,4))` 행
  - 위반 규약: CLAUDE.md "기술 명세 | `spec/<영역>/*.md` 본문" (단일 진실) + target 자신이 §2.25 처방에서 명시한 "문서 관례를 따른다 — … 추상 타입(`Enum`/`Timestamp`/`Boolean`)"
  - 상세: `1-data-model.md` 전체(24개 엔티티, 필드 수백 개)를 훑으면 숫자 계열 추상 타입은 `Float`(예: `position_x`·`rerank_score_threshold`)·`Int`(`message_count`)·`BigInt`(`counter`) 세 가지만 쓰이고 **`Number` 는 단 한 번도 등장하지 않는다**. `threshold` 는 `NUMERIC(12,4)` 고정소수 필드인데, 이는 `Float`(부동소수)·`Int`·`BigInt` 어디에도 정확히 대응하지 않는 실제 어휘 공백이지만, target 은 그 공백을 채우려 기존에 없는 `Number` 를 새로 만들어 썼다. target 스스로 "문서 관례를 따른다"고 선언한 직후에 관례에 없는 타입명을 도입한 것이 모순이다.
  - 제안: 기존 `Float` 를 재사용하거나(정밀도 요구가 `Float` 로 충분하면), 고정소수 의미를 살리고 싶다면 새 추상 타입 `Decimal` 을 명시적으로 도입한다는 결정을 draft 본문(또는 Rationale)에 남긴다. 말없이 `Number` 를 쓰면 다음 엔티티 작성자가 `Number`/`Float`/`Decimal` 중 무엇이 정본인지 판단할 근거가 없다.

- **[INFO] 신설 인덱스 문단이 기존 `**인덱스**:` bold 표기를 따르지 않음**
  - target 위치: `## ②` 처방부, "인덱스: `(workspace_id)` · `(enabled) WHERE enabled = true` (partial …)." 문장
  - 위반 규약: 명시적 `spec/conventions/` 항목은 아니고 `1-data-model.md` 자체의 반복 관례 — DocumentChunk(§2.12.1)·Entity(§2.12.2)·Relation(§2.12.3)·ChunkEntity(§2.12.4)·ExecutionNodeLog(§2.13.1)·ExecutionToken(§2.13.2)·WorkflowTestDataset(§2.13.3)·LlmUsageLog(§2.24) 8개 엔티티 전부가 필드 표 직후에 **`**인덱스**: ...`** (볼드) 형식으로 인덱스를 적는다.
  - 상세: target 은 볼드 마커 없이 "인덱스: …" 로만 적었다. 8/8 정본 선례가 예외 없이 볼드를 쓰므로, 사소하지만 형식 이탈이다.
  - 제안: 실제 spec 반영 시 `**인덱스**: \`(workspace_id)\` · \`(enabled) WHERE enabled = true\` (partial — …).` 로 볼드를 맞춘다.

- **[INFO] §2.25 신설이 `## 3. 인덱스 전략` 중앙 표와의 정합 여부를 언급하지 않음**
  - target 위치: `## ②` 처방부 전체
  - 위반 규약: 역시 `spec/conventions/` 명문 규약은 아니고 `1-data-model.md` §3 자체의 내부 정합 이슈. §3 "인덱스 전략" 표에는 IntegrationUsageLog·ExecutionNodeLog·LlmUsageLog 처럼 **엔티티 인라인 `**인덱스**:` 문단 + §3 표 양쪽에 동시 등재**된 선례가 존재하는 반면, DocumentChunk·Entity·Relation·ChunkEntity·ExecutionToken·WorkflowTestDataset 처럼 **인라인에만** 있고 §3 표에는 없는 선례도 공존한다 — 저장소 관례가 이미 혼재돼 있어 강제할 근거는 약하다.
  - 상세: target 은 인라인 인덱스 문단만 지시하고 §3 표 갱신 여부를 결정하지 않았다. 혼재된 선례 중 어느 쪽을 따를지 draft 가 명시하지 않으면, 실제 반영 시 작성자가 임의로 택하게 된다.
  - 제안: 필수는 아니나, 처방에 "§3 표는 갱신하지 않는다(DocumentChunk/Entity 계열 선례를 따름)" 한 줄만 추가해 애매성을 없애는 편이 좋다.

## 그 외 대조 결과 (위반 아님 — 정확히 규약을 따름)

- `plan/in-progress/spec-draft-lockout-and-alertrule.md` 파일명·`spec-draft-` prefix, frontmatter `worktree`/`started`/`owner` 3필드, `spec_impact` 가 YAML 리스트인 것 모두 `project-planner/SKILL.md` + `plan-lifecycle.md §4` + Gate C 스키마와 일치.
- `## Rationale` 을 본문 끝에 두는 것은 SKILL.md §3 "본문 끝에 `## Rationale`" 요구와 일치. 3섹션(Overview/본문/Rationale) 강제는 실제 `spec/*.md` 파일에 적용되는 규칙이며 draft 자체에는 Rationale 만 의무이므로 Overview 절 부재는 위반이 아니다.
- 제안 anchor `../1-data-model.md#225-alertrule` 은 실측 slug 패턴(`#210-integration`·`#216-modelconfig`·`#2101-integrationusagelog` 등, github-slugger 결과)과 정확히 일치 — `spec-link-integrity.test.ts` 가 요구하는 heading-slug 대조 규칙을 미리 충족하는 형태다.
- 필드 표 `필드 | 타입 | 설명` 3컬럼, `FK → PascalCase`, `(CASCADE)`/`(SET NULL)` 표기는 §2.1~§2.24 전수와 일치(직접 확인).
- `1-data-model.md` 는 `spec-impl-evidence.md §1` 의 `EXCLUDE_BASENAMES` 에 등재된 frontmatter 면제 파일이고 `spec/data-flow/**` 전체도 frontmatter 의무 대상이 아니므로, target 이 두 파일에 frontmatter 추가를 요구하지 않은 것은 정확하다.
- §2.25 를 top-level 번호로 매긴 근거(§2.24 LlmUsageLog 의 "CASCADE 소유 부모가 Workspace 라 top-level" 선례)는 실측 각주(`1-data-model.md:833`)와 부합하고, `alert_rule` 도 `workspace_id` 가 필수 CASCADE·`workflow_id` 가 nullable CASCADE 라 같은 논리가 적용된다. Trigger(§2.8)·Schedule(§2.9) 처럼 workflow 하위 종속이 아닌 1급 리소스가 top-level 인 것과도 정합.
- `type`/`channel` enum 값 목록은 `data-flow/9-observability.md:157` 원문 컬럼 정의(`type ('failure_rate'|'duration'|'llm_cost')`, `channel ('in_app'|'email', default 'in_app')`)와 정확히 일치 — 임의 수정 없이 실측을 그대로 옮겼다.
- `alerts-evaluator.service.ts:213` 의 `` `alert_${rule.type}` `` 실측과 `1-data-model.md §2.19` 의 닫힌 `Notification.type` 7종 목록에 `alert_*` 3종이 없다는 대조(item ③) 도 grep 으로 재확인해 정확했다.
- `spec-sync-auth-gaps.md` §"추가 발견"(W1/W2)·"auth 트래커라 주제가 안 맞다" 메모의 인용은 원문과 축자 일치.

## 요약

target 은 두 건의 기존 spec 불일치(§1.1 이메일 알림 오기, `alert_rule` SoT 부재)를 다루는 spec draft 로, 실측(코드·다른 spec·anchor slug·번호 선례)을 촘촘히 대조해가며 작성돼 있고 plan frontmatter·파일명·Rationale 배치·anchor 포맷·엔티티 표 3컬럼·FK 표기 등 핵심 정식 규약은 전수 준수한다. 발견된 문제는 모두 낮은 강도다 — `threshold` 필드에 문서 전체 어휘에 없는 `Number` 타입을 새로 도입한 것(WARNING, 근거 없는 신규 타입명 도입)과, 인덱스 문단 볼드 표기·§3 중앙 인덱스 표 갱신 여부 명시 누락(INFO 2건, 저장소 자체가 혼재된 선례를 갖고 있어 강제력은 약함)이다. Critical 급 위반은 없다.

## 위험도

LOW
