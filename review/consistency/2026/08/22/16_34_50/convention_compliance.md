# 정식 규약 준수 검토 — `plan/in-progress/eia-error-code-unify.md`

## 검토 방법

target plan 이 인용하는 모든 실측(파일·라인·grep 결과·spec 문장)을 실제 저장소에서
재실행/재대조했다. `spec/conventions/error-codes.md`(전문), `spec/conventions/node-output.md`,
`spec/conventions/swagger.md`, `spec/conventions/spec-impl-evidence.md`, `.claude/docs/plan-lifecycle.md`
및 target 이 걸고 있는 6개 spec 파일(해당 절)·백엔드/프런트 코드·`plan/in-progress/spec-sync-external-interaction-api-gaps.md`(정본 트래커)를 대조했다.

결론 먼저: target 이 인용한 **파일·라인·grep 결과·spec 문장은 전수 정확**했다(예외 0건 — 아래
"검증 완료 항목" 참조). 규약 준수 관점에서 실제로 걸리는 것은 계획 실행 시 발생할 수 있는
**§4 표 구조 충돌 위험** 하나와, 인용 정확성 관련 경미한 항목 둘이다.

---

## 발견사항

### [WARNING] `error-codes.md §4` 표에 trigger-parameter 코드를 추가하면 그 표 자신의 scope 선언과 충돌한다

- **target 위치**: "같은 절의 spec 편집 3건" 세 번째 불릿 (line 136-138), "동반 개정 표면 > spec (6파일)" 표의 `conventions/error-codes.md | §4 표 · §5 Rename 이력 | 아래 두 항목` 행 (line 111)
- **위반 규약**: `spec/conventions/error-codes.md §4` (내부 전용 분류 코드) 자신의 scope 선언
- **상세**: target 은 `error-codes.md §4` "패턴" 표에 `missing_required`/`coerce_failed`/`invalid_schema`/`masked_value_resubmitted` 같은 trigger-parameter reason 계열 행이 없어서 `12-webhook.md:313`·`3-error-handling.md:189` 의 `[error-codes 규약 §4]` 참조가 "착지하지 않는다"고 진단한다 — **이 진단 자체는 실측대로 정확**하다(직접 확인: 현재 §4 표는 `EXECUTION_TIMEOUT`/`EXECUTION_MEMORY_EXCEEDED`/`CODE_RUNTIME_ERROR` 3행뿐).

  문제는 처방이다. `error-codes.md §4` 의 본문은 이 표를 명시적으로 **"Code 노드 핸들러 내부의 분류 단계 문자열"**로 한정하고 있고("`classifyCodeNodeError` 가 산출... `LEGACY_TO_NORMALIZED` 표가 발행 직전 public 코드로 정규화... `codebase/backend/src/nodes/data/code/code.handler.ts`"), 표의 두 번째 열 헤더 자체가 **"정규화 → public 코드 (노드 `output.error.code`)"** 다.

  반면 target 이 추가하려는 trigger-parameter reason 코드는 완전히 다른 파이프라인이다 — `toTriggerParameterErrorDetails`(`execution-engine/types/trigger-parameter.types.ts`)가 정규화하며, 목적지는 노드의 `output.error.code` 가 **아니라** HTTP 에러 봉투의 `error.details[].code` 다(webhook/manual/manual re-run 3개 소비처, Code 노드와 무관).

  이 상태로 "§4 표에 두 행을 추가"하면, 같은 표 안에 (a) "Code 노드 핸들러 내부" 한정 코드와 (b) trigger-parameter 파이프라인 코드가 섞이고, 표 자신이 선언한 "정규화 → public 코드 (노드 `output.error.code`)" 열 의미가 (b) 행에는 거짓이 된다(trigger-parameter 코드는 `output.error.code` 가 아니라 `details[].code` 로 정규화된다). 즉 target 이 정확히 진단한 "참조가 착지하지 않는 문제"를, **표의 scope 선언을 깨뜨리는 방식으로 봉합**할 위험이 있다.

- **제안**: 실제 spec 편집 시 단순히 기존 표에 행을 추가하지 말고, (1) §4 를 "§4.1 Code 노드 내부 분류" / "§4.2 trigger-parameter 내부 분류" 로 분리하거나, (2) §4 상단 scope 문장("다음은 Code 노드 핸들러 내부의…")과 표 두 번째 열 헤더를 두 파이프라인을 모두 포괄하도록 일반화("정규화 → public 코드 (해당 계층의 발행 지점)" 등)한 뒤 추가할 것. target 체크리스트에 이 결정을 명시적으로 적어 두는 편이 안전하다 — 현재는 "아래 두 항목" 한 줄로만 걸려 있어 실행자가 단순 append 로 처리할 여지가 있다.

### [INFO] `spec-impl-evidence` "R-1" 인용이 실제 규칙 위치와 다르다

- **target 위치**: "같은 절의 spec 편집 3건" 첫 번째 불릿 (line 133) — `spec-impl-evidence R-1 은 충족해 가드는 통과하지만`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §4 vs Rationale 번호 체계
- **상세**: target(및 그 출처인 정본 트래커 `spec-sync-external-interaction-api-gaps.md:796`)이 "`code:` 글로브가 ≥1 파일에 매치해야 한다"는 규칙을 "`spec-impl-evidence` R-1"로 지칭한다. 그러나 실제로 그 build-time 강제 규칙은 `spec-impl-evidence.md §4` 표의 `spec-code-paths.test.ts` 행이 소유한다. 문서의 "R-1"은 §Rationale 의 "R-1. `code:` 글로브 허용 vs 명시 파일만" — **글로브를 왜 허용했는지의 배경 논의**이지, "≥1 매치" 규칙 자체의 선언 위치가 아니다. 인용된 절 번호와 실제 규칙 소재가 어긋난다.
  이 프로젝트는 같은 형태의 인용 오류(§3.3 인용이 실제로는 §5.1, `spec-sync-external-interaction-api-gaps.md` "consistency 라운드가 넷을 더 잡았다" 절 #1)를 독립된 checker 두 명이 CRITICAL 급으로 이미 잡은 이력이 있어 재발 방지 가치가 있다.
- **제안**: 실제 spec/plan 텍스트 편집 시 "R-1" 대신 "§4 `spec-code-paths.test.ts`" 로 정정. target 자체는 계획 서술이라 지금 당장 blocking 은 아니나, 이 문구를 그대로 옮겨 적을 스텝(코드·spec 편집)에서 정정 필요.

### [INFO] `error-codes.md §5` 진입 조건의 "자사 클라이언트뿐" 전제가 이번 케이스에서는 완전히 충족되지 않음을 target 스스로 인정 — §5 등재 시 비고에 명시 필요

- **target 위치**: "이것은 규약의 명시적 예외다 — 근거를 실측했다" 절 전체 (line 58-84), 특히 "남는 위험을 숨기지 않는다" 콜아웃 (line 81-84)
- **위반 규약**: `spec/conventions/error-codes.md §5` 본문 — "소비자가 자사 클라이언트뿐(프론트엔드가 구·신 코드를 양쪽 매핑)이라 breaking 영향이 없음을 확인한 뒤 교체했다"
- **상세**: §5 기존 3개 선례(`LLM_CONFIG_NOT_FOUND`·`LLM_CONFIG_INVALID`·`WORKSPACE_REQUIRED`)는 전부 **내부/관리용 엔드포인트**(모델 설정 조회, chat-channel bot token rotate)로, "소비자가 자사 클라이언트뿐"이라는 전제를 안정적으로 만족한다. 반면 `POST /executions/:id/re-run` 은 target 자신이 "인증된 공개 API"라 부르며, 저장소 밖 제3자 클라이언트가 이 값으로 분기했을 가능성을 **코드로는 배제할 수 없다**고 명시적으로 인정한다. 이는 §5 진입 조건의 문면("자사 클라이언트뿐")을 엄밀하게는 충족하지 못하는, 더 넓은 리스크 등급의 사례다.
  target 이 이 위험을 숨기지 않고 사용자 결정으로 명시한 것은 규약의 정신(§5 Rationale: "'client 코드 분기 미존재'가 진짜 기준")에 부합하는 좋은 처리이며, 이 자체가 위반은 아니다. 다만 이 판단이 향후 §5 표의 새 선례가 되므로, 실제 표 등재 시 "비고" 열에 "공개 REST 엔드포인트 — 제3자 분기 가능성은 코드로 배제 불가, 관측(grep) 기준으로만 판단, 잔여 위험은 사용자 결정으로 수용"이라는 식으로 **이번 사례가 기존 3건과 다른 리스크 등급임을 명시**해야, 후속 기여자가 "§5 는 아무 공개 API 든 안전"으로 과잉 일반화하지 않는다.
- **제안**: `error-codes.md §5` 표 신규 행의 "비고" 열에 위 리스크 등급 차이를 명문화. target 의 이번 절 자체는 수정 불필요(이미 투명하게 서술됨) — 후속 spec 편집 단계에 반영할 사항으로 기록.

---

## 검증 완료 항목 (규약 준수 관점에서 문제 없음)

- **명명 규약**: `INVALID_TRIGGER_PARAMETERS` 는 `UPPER_SNAKE_CASE` — `error-codes.md §1`·`node-output.md §3.2` 표기 규약 준수. 기존에 이미 발행 중인 코드로 통일하는 것이라 신규 명명 이슈 없음.
- **frontmatter**: `worktree`/`started`/`owner` 3필드(plan-lifecycle §4 필수 스키마) 모두 존재. `spec_impact` 는 YAML 리스트 형식(Gate C 요구 형식) 준수, bare string·빈 배열 아님.
- **사실관계 전수 대조** — 아래 전부 실제 파일과 라인 단위로 일치 확인:
  - `workflows.controller.ts:324`(execute) / `workflows.service.ts:931`(save) / `executions.service.ts:506`(re-run) 이 모두 동일하게 `resolveTriggerParametersRejectingMasked` → `TriggerParameterValidationException` catch 구조. execute/save 는 `INVALID_TRIGGER_PARAMETERS`, re-run 만 `INVALID_INPUT`.
  - `rerun-modal.tsx` `ERROR_CODE_TO_KEY` 는 정확히 `RERUN_PERMISSION_DENIED`/`RERUN_CHAIN_DEPTH_EXCEEDED`/`RERUN_WORKFLOW_DELETED`/`RERUN_DRY_RUN_NOT_APPLICABLE` 4종만 매핑, `INVALID_INPUT` 은 미매핑(generic fallback).
  - `grep -rn INVALID_INPUT codebase/frontend/src codebase/channel-web-chat` = `triggers.mdx:33`·`triggers.en.mdx:22` 2건만(코드 0건) — target 주장과 정확히 일치.
  - `resolveTriggerParametersRejectingMasked` grep spec = 0건(target 주장과 일치).
  - `14-external-interaction-api.md` §R17 "닫는 조건" 표: 4행 중 4번째("서버 (Manual 실행 경로)")만 볼드, 나머지 3행 평문 — target 주장과 정확히 일치.
  - 인용 라인 번호 전수 일치: `1-manual-trigger.md:181`, `13-replay-rerun.md:246`(§8.1 표)·`:377`(§10.2 콜아웃), `3-error-handling.md:80`(카탈로그)·`:189`(details[] 노트), `12-webhook.md:313`, `executions.controller.ts:274`, `executions-rerun.service.spec.ts:330,422`.
  - 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)의 4개 항목(결정 항목 line 759-761, wrapper 함수명 line 794-796, §R17 볼드 line 797-798, §4 표 line 799-801) 문구가 target 서술과 정확히 대응.
- **§2 rename 정책과의 관계**: 이번 변경은 "이름 정확성 향상만을 위한 rename"(§2 금지 대상)이 아니라 "동일 검증 실패에 두 개의 서로 다른 top-level 코드가 우연히 붙어 있던 drift 를 통일"하는 케이스로, target 은 이를 §2 예외로 신중하게 취급(오히려 규약보다 보수적으로 접근) — 문제 없음.
- **API 문서(Swagger) 규약**: target 이 걸어놓은 `executions.controller.ts:274` `@ApiBadRequestResponse({ description: 'INVALID_INPUT / RERUN_DRY_RUN_NOT_APPLICABLE' })` 은 실제 파일과 일치하며, `swagger.md` 의 decorator 패턴상 특별한 위반 없음(단순 description 문자열 교체 범위).
- **문서 구조 규약(Overview/본문/Rationale)**: target 은 plan 문서이므로 spec 3섹션 규약의 직접 대상은 아니나, 말미에 `## Rationale`(기각한 대안 3건, 본문에서 이미 다룬 사실에 기반 — 지어낸 이력 없음)을 두어 관행에 부합.

---

## 요약

target plan 은 정식 규약 준수 관점에서 **드물게 높은 정확도**를 보인다 — 인용한 모든 파일·라인·grep 결과·spec 문장이 전수 실측과 일치했고, `error-codes.md §2`(rename=breaking)·§5(예외 등재 조건)의 관계를 스스로 정확히 짚어내며 잔여 위험(공개 API 제3자 분기 가능성)까지 투명하게 노출했다. 유일하게 실질적인 규약 위험은 "같은 절의 spec 편집 3건" 중 세 번째 — `error-codes.md §4` 표에 trigger-parameter reason 코드를 단순 추가하면 그 표 자신이 선언한 scope("Code 노드 핸들러 내부"·"노드 `output.error.code`")와 충돌한다는 점이며, 이는 실제 spec 편집 단계에서 표 구조 조정(분리 또는 scope 문구 일반화)을 병행해야 피할 수 있다. 나머지 두 건(§4.2 R-1 인용 위치 오류, §5 신규 행의 리스크 등급 명시 필요)은 INFO 수준의 정밀도 보강 사항이다.

## 위험도

LOW
