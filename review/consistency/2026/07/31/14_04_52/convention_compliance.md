# 정식 규약 준수 검토 — `spec-workflow-version-snapshot-drift`

## 검토 대상

- target: `plan/in-progress/spec-workflow-version-snapshot-drift.md` (spec draft, `--spec` 모드)
- 변경 스코프: `spec/1-data-model.md` §2.15 `WorkflowVersion.snapshot` 행의 서술 1건 정정. 신규 API·DTO·이벤트 페이로드·에러 코드·엔드포인트 도입 없음 (코드 변경 없는 순수 문서 정정).

## 사전 확인 사항 (프롬프트 페이로드 한계)

`prompt_file` 의 "정식 규약 모음" 은 컨텍스트 예산 초과로 `audit-actions.md` + `cafe24-api-catalog/**` 일부만 포함하고 이 target 과 직접 관련된 `spec-impl-evidence.md`·`migrations.md`·`error-codes.md` 등 258개 파일은 생략돼 있었다. 프롬프트 자체가 "여기 없다는 사실을 근거로 삼지 말라" 고 명시하므로, 아래 검토는 저장소의 `spec/conventions/**` 실파일을 직접 `Read` 하여 수행했다 (`spec-impl-evidence.md`, `migrations.md`, `error-codes.md` 전문 확인 + `spec/conventions/**` 전역 grep 으로 `workflow_version`/`WorkflowVersion`/JSONB 관련 규정 유무 확인).

## 점검 관점별 결과

1. **명명 규약** — 위반 없음. 신규 식별자·파일·API endpoint 도입이 없고, TO-BE 셀이 쓰는 필드명(`name`/`description`/`nodes`/`edges`/`workflow.settings`)은 모두 기존 엔티티 컬럼명을 그대로 재인용한다. `workflow.settings` 표기는 `spec/1-data-model.md` §2.4 Workflow 테이블의 실제 컬럼명과 일치하고(직접 대조 완료), `buildSnapshot()`(`codebase/backend/src/modules/workflows/workflows.service.ts:622-653`)이 반환하는 키(`name`/`description`/`nodes`/`edges`)와도 정확히 일치한다. 제목의 `WorkflowVersion.snapshot`(엔티티.필드 표기)과 본문의 `` `workflow_version.snapshot` ``(테이블.컬럼 표기)를 문맥에 따라 구분해 쓰는 것도 같은 문서 §2.14 "Execution.error ↔ NodeExecution.error 관계" 제목이 쓰는 것과 동일한 기존 표기 관례다.
2. **출력 포맷 규약** — 해당 없음. API 응답·이벤트 페이로드·에러 코드 변경이 target 에 없다. `spec/conventions/error-codes.md` Overview 를 직접 확인했으나 대상 범위가 `error.code` 문자열 명명뿐이라 이 변경과 무관하다.
3. **문서 구조 규약** — 위반 없음.
   - target(plan) 문서 자체가 `## Overview` → 본문(`## 1. Spec 변경안`, `## 2. …`) → `## 체크리스트` → `## Rationale` 순서로, CLAUDE.md 가 권장하는 Overview/본문/Rationale 3섹션 구성을 그대로 따른다.
   - frontmatter(`worktree`/`started`(ISO)/`owner`)는 `plan-frontmatter.test.ts`(SoT: `.claude/docs/plan-lifecycle.md §4`)가 요구하는 3필드를 정확히 채웠고, `worktree: spec-snapshot-drift` 는 실제 worktree 디렉토리명과 일치한다. `title`/`status`/`priority` 는 동 문서가 "허용된 추가 필드" 로 명시한 것들이다.
   - `spec_impact: \n  - spec/1-data-model.md` 는 Gate C(`spec-impl-evidence.md` R-8, `plan-lifecycle.md §5`)가 요구하는 **YAML 리스트** 형식이다 (bare string·빈 배열 아님 — 완료 시점 전이라 아직 강제 대상은 아니지만 선반영이 스키마에 부합).
   - `spec/1-data-model.md`(basename 매칭) 와 `spec/data-flow/11-workflow.md`(`spec/data-flow/**` prefix)는 `spec-impl-evidence.md §1` 이 frontmatter-evidence 가드(`id`/`status`/`code`) 대상에서 **명시적으로 제외**한 파일들이다 — 이번 정정이 두 파일의 frontmatter 를 건드리지 않는 것은 규약과 부합한다(위반도, 누락도 아님).
4. **API 문서 규약** — 해당 없음. OpenAPI/Swagger 데코레이터·DTO 가 target 범위에 없다.
5. **금지 항목** — `spec/conventions/**` 전역에 `workflow_version`/`WorkflowVersion` 을 언급하는 파일이 없고(grep 확인), JSONB/스냅샷 서술 방식을 규제하는 정식 규약도 존재하지 않는다. 명시적으로 금지된 패턴을 답습하는 사례는 발견되지 않았다.

## 발견사항

- **[INFO]** SoT 인용 링크에 `#anchor` 없음 — 같은 문서 내 3회 확립된 관례와 편차
  - target 위치: `plan/in-progress/spec-workflow-version-snapshot-drift.md` §1.1 TO-BE 셀 — `` [data-flow §1.1 / Rationale "버전 스냅샷 = JSONB"](./data-flow/11-workflow.md) ``
  - 위반 규약: 명문화된 `spec/conventions/*.md` 항목은 없음 — **`spec/1-data-model.md` 자신의 확립된 내부 관례**와의 편차. 동일 파일이 "다른 spec 문서의 Rationale 서브섹션" 을 인용할 때는 예외 없이 `#rationale` 앵커를 붙인다: (1) `spec/1-data-model.md:927` `` [Spec 통합 화면 §9.2 Rationale "Cafe24 App URL 100자 한도 대응" 항](./2-navigation/4-integration.md#rationale) ``, (2) `spec/1-data-model.md:652` `` [Spec Webhook Rationale R-A](./5-system/12-webhook.md#rationale) ``, (3) `spec/1-data-model.md:769` `` [spec/5-system/1-auth.md §1.4 Rationale 1.4.C](./5-system/1-auth.md#rationale) ``. 특정 절(§) 인용 시에도 §2.10 `install_token` 행이 `#6-상태-전이`·`#92-인증--회전--scope` 처럼 구체 앵커를 쓰는 선례가 있다.
  - 상세: TO-BE 링크는 §1.1 과 Rationale 이라는 **서로 다른 두 섹션**을 하나의 링크 텍스트에 뭉치면서 href 는 문서 최상단(`./data-flow/11-workflow.md`, 앵커 없음)만 가리킨다. 링크 자체는 유효하며(`spec-link-integrity.test.ts` 는 앵커가 없으면 통과) build 를 깨지 않지만, 클릭 시 관련 섹션으로 바로 이동하지 못해 문서를 열람하는 사람이 직접 스크롤해야 한다. `spec/data-flow/11-workflow.md` 는 실제로 `## Rationale`(line 223) 헤딩을 갖고 있어 `#rationale` 슬러그가 유효하다.
  - 제안: 기존 선례처럼 두 인용을 분리하거나(§2.10 install_token 행 패턴) 최소한 Rationale 부분에 `#rationale` 을 붙인다 — 예: `` [data-flow §1.1](./data-flow/11-workflow.md#11-워크플로우-생성--노드엣지-편집) 및 Rationale "버전 스냅샷 = JSONB" ([data-flow](./data-flow/11-workflow.md#rationale)) ``. §1.1 앵커의 정확한 slug 는 실제 렌더러(rehype-slug) 출력으로 재확인 필요. 블로킹 아님 — INFO.

- **[INFO]** JSONB 구성 서술 표기가 문서 내 기존 두 관례와 다른 세 번째 형태
  - target 위치: TO-BE 셀 — `` 워크플로우 캔버스 스냅샷 — `name`, `description`, `nodes`, `edges`. ``
  - 위반 규약: 명문화된 규약 없음(파일-로컬 관행 수준). `spec/1-data-model.md` 안에서 JSONB 필드의 내부 구조를 설명하는 기존 두 패턴은 (a) 중괄호 표기 — §2.14 `error`(line 552) `` `{ code, message, stack? }` ``, `interaction_data`(line 554) `` `{ interactionType: "…", buttonId?, … }` ``, Execution.error 관계 표(line 562) `` `{ nodeId: "uuid", code: "ERROR_CODE", message: "에러 설명" }` `` — 및 (b) "알려진 키:" 산문 표기 — §2.4 `settings`(line 121) "알려진 키: `maxConcurrentExecutions: number?`". TO-BE 는 쉼표로 구분된 backtick 나열(제3의 형태)을 쓴다. 참고로 SoT 인 `spec/data-flow/11-workflow.md:234` 자체도 `` name + description + nodes + edges `` (plus 연결, backtick 없음)로 또 다른 표기를 쓰고 있어, SoT 문서조차 이 파일의 두 관례 중 어느 쪽과도 일치하지 않는다.
  - 상세: 순수 표기 일관성 문제로 기능적 영향은 없다. 다만 §2.14 의 확립된 중괄호 표기(`{ name, description, nodes, edges }`)를 따랐다면 "이 JSONB 는 이런 shape 다" 라는 신호가 한눈에 더 명확했을 것이다.
  - 제안: (선택) `` `{ name, description, nodes, edges }` `` 형태로 통일 고려. 강제 사항 아님 — INFO.

## 요약

target 은 신규 명명·API 계약·출력 포맷·API 문서 데코레이터를 전혀 도입하지 않는 순수 spec 텍스트 정정(`spec/1-data-model.md` §2.15 한 행)이며, 검토 5개 관점 중 3개(출력 포맷/API 문서/금지 항목)는 사실상 해당 없음으로 확인됐다. 명명 규약은 기존 코드·data-flow SoT 와 정확히 일치하는 필드명을 재사용해 위반이 없고, 문서 구조 규약(plan frontmatter 3필드, Gate C `spec_impact` 리스트 형식, `1-data-model.md`/`data-flow/**` 의 frontmatter-evidence 가드 제외 대상 여부)도 모두 부합을 직접 대조 확인했다. 발견된 2건은 모두 INFO 등급으로, `spec/conventions/**` 에 성문화된 규칙을 어긴 것이 아니라 같은 문서(`spec/1-data-model.md`) 안에서 이미 3회 이상 확립된 자체 관례(Rationale 인용 시 `#rationale` 앵커 부착, JSONB 구조를 중괄호로 표기)와의 소소한 편차이며 build 를 깨지 않는다. 채택해도 다른 시스템의 invariant 가 깨질 위험은 없다.

## 위험도

LOW
