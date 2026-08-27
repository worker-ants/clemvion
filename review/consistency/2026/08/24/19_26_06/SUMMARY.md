# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 있음(3개 checker 가 각도만 다르게 같은 근본 위배 지적: `spec/2-navigation/14-execution-history.md` R-5 의 보안 근거가 target 착수로 무효화되는데 `spec_impact` 밖에 있음)

## 전체 위험도
**CRITICAL** — target(`masking-expression-egress-split`)이 착수하려는 코드 변경(어댑터의 `maskSensitiveFields(config)` 제거)이 기존 spec 의 명시적 보안 근거 문장(R-5: "저장 시점에 이미 마스킹되어 안전")을 문자 그대로 반증하는데, 이를 정정하는 작업이 현재 plan 의 `spec_impact`/체크리스트 범위 밖이다. 근본 원인은 developer 권한 밖(spec Rationale 정정)이라 planner 인계가 필요하다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, naming_collision (3건 동일 근본 위배, 통합) | `NodeExecution.outputData`(config 포함) 마스킹 "시점"에 대한 서술이 target 착수로 사실과 어긋나게 됨. `spec/2-navigation/14-execution-history.md` R-5 는 "config echo 는 엔진 boundary(`handler-output.adapter.ts` 의 `maskSensitiveFields`)에서 **저장 시점에 이미 마스킹**되어 안전 — 안전성은 롤 게이팅이 아니라 서버 boundary masking parity 에 의존"이라고 명시하는데, target 이 정확히 그 boundary 마스킹을 제거해 DB 를 원문 보존으로 바꾼다. 또한 `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 은 이미(착수 전인 현재도) `outputData` 를 "DB 원본 보존 + read-time 변환"으로 서술해 R-5 와 상반되며, 실측(`handler-output.adapter.ts:36`)은 현재는 R-5 가 맞고 4-ai-assistant.md 가 틀렸음을 보여준다 — target 착수 후에는 반대로 R-5 가 stale 해진다. | `plan/in-progress/masking-expression-egress-split.md` (spec_impact: `spec/conventions/egress-masking.md` 단독) | `spec/2-navigation/14-execution-history.md:469` R-5, `spec/3-workflow-editor/4-ai-assistant.md:259` §4.1.1, `spec/4-nodes/3-ai/1-ai-agent.md:480` | `spec_impact` 에 `spec/2-navigation/14-execution-history.md` 추가하고 R-5 본문을 "egress(WS/REST) 마스킹 parity — DB 는 원문 보존, 표현식은 원문을 읽음" 으로 정정. 동일 이유로 `spec/4-nodes/3-ai/1-ai-agent.md:480`("adaptHandlerReturn boundary" 서술)도 정정. 이 문장들은 developer 가 쓴 "예고" 가 아니라 보안 설계 Rationale 이므로 자기-반증형 소정정 예외 대상이 아님 — planner 턴 필요. |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 근본 원인이 호출자(developer) 권한 밖이다. **여기 실려도 등급은 CRITICAL 그대로이고 `BLOCK: YES` 도 그대로입니다** — 이 표는 차단을 푸는 장치가 아니라 다음 행동을 지정하는 장치입니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/2-navigation/14-execution-history.md` R-5 와 `spec/4-nodes/3-ai/1-ai-agent.md:480` 은 "제품 정의·요구사항·보안 설계 근거(Rationale)" 문장이며 developer 자신이 쓴 예고·트리거가 아니다 — CLAUDE.md 의 "자기-반증형 소정정" 예외(조건 1: 대상 문장을 developer 자신이 썼을 것)를 충족하지 못한다. `spec/` 은 developer read-only. | project-planner | (1) `spec/2-navigation/14-execution-history.md` R-5: "저장 시점에 이미 마스킹" / "boundary masking parity" → "egress(WS/REST) 마스킹 parity, DB 는 원문 보존, 표현식은 원문을 읽음" 으로 정정. (2) `spec/4-nodes/3-ai/1-ai-agent.md:480`: "`adaptHandlerReturn` boundary" → "egress 마스킹(WS/REST 각자 경유)" 로 정정. (3) `spec/conventions/node-output.md` Principle 7 인접부에 "config 도 이제 egress-only" 명문화. (4) `spec/5-system/4-execution-engine.md` "Engine Raw Config Exposure" 결정에 storage-time 마스킹 부재를 명시하는 한 문장 추가. (5) `spec/conventions/egress-masking.md` §1 좌표계 표에 `handler-output.adapter.ts`/`maskSensitiveFields` 행을 "폐기됨(2026-08-24)" 로 추가하거나 잔존 소비처(`explore-tools.service.ts`)용으로 정식 편입. (6) `spec/3-workflow-editor/4-ai-assistant.md:261` "다른 소비처" 열거에서 "노드 config echo boundary" 항목 제거. (7) `plan/in-progress/spec-sync-external-interaction-api-gaps.md:601-612` 자매 트래커 항목을 이 PR 결과로 닫거나 재기술. | cross_spec.md, rationale_continuity.md, naming_collision.md, plan_coherence.md |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/conventions/egress-masking.md` §1 마스커 좌표계 표가 이번 변경의 당사자인 `handler-output.adapter.ts`/`maskSensitiveFields` 를 누락(frontmatter 에만 경로 등재, 본문 표에는 행 없음) | `spec/conventions/egress-masking.md` §1 | frontmatter `code:` vs 본문 §1 좌표계 표 | 어댑터 마스킹 제거 후 §1 표에 "폐기됨(2026-08-24)" 명시 또는 잔존 소비처용 정식 행 추가 |
| 2 | convention_compliance | Cafe24/Makeshop 노드의 에러 포트·에러 코드가 `node-output.md` Principle 3.3 레지스트리에는 있으나 `3-error-handling.md` 의 cross-cutting 카탈로그(§1.4·§3.2)에서 누락 (오래된 drift, 이번 masking 작업과 무관) | `spec/5-system/3-error-handling.md` §1.4, §3.2 | `spec/conventions/node-output.md` Principle 3.3, `spec/conventions/error-codes.md` §1 SoT 선언 | §1.4 에 Cafe24/Makeshop 카테고리 행 추가(§1.5~§1.9 패턴 재사용), §3.2 "에러 포트 보유 노드" 목록에 `cafe24`/`makeshop` 추가. `node-output.md` Principle 3.3 에도 `makeshop` 미등재 — 함께 갱신 |
| 3 | rationale_continuity | "표현식 경로만 마스킹에서 제외" 라는 target 표제보다 실제 조치(어댑터 전체 제거) 범위가 넓다 — DB 저장 원문화라는 부수 결정이 별도 결정 문장으로 명시되지 않음 | `plan/in-progress/masking-expression-egress-split.md` 제목 및 §"왜 어댑터에서 뺀다 인가" | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:588-615` (키축/값축, 표현식/DB·WS 를 의도적으로 분리해 둔 관례) | "DB 저장이 원문으로 바뀐다" 를 별도 결정 문장으로 명시하고 그 자체의 근거(egress-time 재마스킹으로 충분한 이유) 기재 |
| 4 | rationale_continuity | "이 작업은 중복 한 겹을 걷어내는 것" 이라는 target 프레이밍이 `spec/5-system/14-external-interaction-api.md` R17 의 "두 층은 경쟁하지 않고 쌓인다" 는 기존 설계 철학과 표면적으로 상충 | `plan/in-progress/masking-expression-egress-split.md` §"왜 '출구로 옮긴다' 가 아니라 '어댑터에서 뺀다' 인가" | `spec/5-system/14-external-interaction-api.md` `## Rationale` R17 | planner 턴에서 egress-masking.md/EIA §R17 갱신 시 "다른 매칭 축(키 완전일치 vs 값 정규식) 검사 하나를 다른 축 검사로 대체하는 것이지 같은 자리의 중복 제거가 아니다" 로 명시적으로 화해 |
| 5 | plan_coherence | target 이 변경하는 바로 그 코드를 서술하는 자매 트래커 항목(`spec-sync-external-interaction-api-gaps.md:601-612`, "값 축은 아직 열려 있다")이 구현 후 stale 화되는데 target 체크리스트에 닫기/재기술 단계가 없음 | `plan/in-progress/masking-expression-egress-split.md` 체크리스트 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:601-612` | 체크리스트에 "(planner 턴) 자매 트래커 항목(601-612)을 이 PR 결과로 닫거나 재기술" 단계 추가 (planner 인계 표 항목 (7) 과 동일 조치) |
| 6 | plan_coherence | "포함관계 캐너리" 전제가 `CREDENTIAL_KEY_PATTERN` 이 REST(`sanitize-error-message.ts:112`)와 WS(`websocket.service.ts:78`) 에 **독립적으로 두 번 선언**된 사실(오늘도 실제로 다름 — REST 만 `x[_-]api[_-]?key` 보유)을 단수 서술로 가려, `egress-masking.md` §1 이 이미 경계한 "동명이인 상수" 실수 패턴을 재현할 위험 | `plan/in-progress/masking-expression-egress-split.md` §"안전성은 키 집합 포함관계에 걸려 있다" + 체크리스트 "포함관계 캐너리" | `spec/conventions/egress-masking.md` §1 "동명이인 스캐너" 경고 콜아웃 | 체크리스트의 "포함관계 캐너리" 항목을 "`sanitize-error-message.ts` 와 `websocket.service.ts` 의 `CREDENTIAL_KEY_PATTERN` **각각에 대해** 포함관계 단언" 으로 명시적 복수화 |
| 7 | naming_collision | `spec/4-nodes/3-ai/1-ai-agent.md:480` 의 credential 마스킹 서술("`maskSensitiveFields` 에 의해 자동 마스킹, `adaptHandlerReturn` boundary")도 R-5 와 동일 이유로 target 착수 후 stale | `spec/4-nodes/3-ai/1-ai-agent.md:480` | 삭제 대상 `handler-output.adapter.ts` 의 `adaptHandlerReturn` boundary 호출 | planner 인계 표 항목 (2) 로 이미 반영 — 같은 planner 턴에서 "egress 마스킹" 으로 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | target(`spec/5-system/`) 자신은 `config` 의 storage-time 마스킹 여부에 대해 완전히 침묵 — 다른 두 문서(R-5, 4-ai-assistant.md)가 각자 다른 가정을 채운 정황상 근본 원인 중 하나 | `spec/5-system/4-execution-engine.md` "Engine Raw Config Exposure" 결정 구간 | PR 완료 후 "config 는 egress 에서만 마스킹되고 엔진→핸들러→저장 전체에서 raw 유지" 한 문장 명문화 (planner 인계 표 항목 (4)) |
| 2 | convention_compliance | `spec/5-system/3-error-handling.md` §3.2 예시가 이번 변경의 당사자 boundary 를 인용하고 있어 인접 위험(본 checker 범위 밖) | `spec/5-system/3-error-handling.md` §3.2 예시 "config" 주석 | 별도 조치 불요, R-5 정정 시 함께 확인 |
| 3 | plan_coherence | `mask-sensitive-fields.util.ts:22-24` 헤더 주석("이 상수는 handler-output.adapter.ts 도 쓰고...")이 PR 이후 stale — 소비처가 사라짐 | `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:22-24` (코드 주석) | 같은 PR 에서 주석 정정 (코드리뷰 단계에서도 포착 가능) |
| 4 | naming_collision | `spec/3-workflow-editor/4-ai-assistant.md:261` "다른 소비처(AI Agent 노드 · 노드 config echo boundary)" 열거에서 후자가 사라지는 소비처를 계속 가리키게 됨 | `spec/3-workflow-editor/4-ai-assistant.md:261` | planner 인계 표 항목 (6) 으로 이미 반영 |
| 5 | naming_collision | `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md`(전문 검토된 3개) 에는 신규/미검토 식별자 충돌 없음 | 해당 3개 파일 전체 | 조치 불요(참고 기록) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | `NodeExecution.outputData`(config) 마스킹 시점에 대해 R-5 와 4-ai-assistant.md §4.1.1 이 정면 모순, target 착수로 방향이 뒤집힘 |
| rationale_continuity | HIGH | R-5 의 안전 근거가 target 으로 반증되는데 정정 계획 부재 + "표현식만" 표제보다 넓은 실제 범위 + "레이어는 쌓인다" 철학과 프레이밍 상충 |
| convention_compliance | LOW | cafe24/makeshop 에러 카탈로그 누락(masking 작업과 무관한 기존 drift) 외 특이사항 없음 — 전문 검토 3개 파일은 규약 준수 양호 |
| plan_coherence | MEDIUM | 자매 트래커 stale 화 미대응 + 포함관계 캐너리의 REST/WS 이중 선언 미반영 |
| naming_collision | HIGH | R-5·`1-ai-agent.md:480` 두 문서가 삭제되는 boundary 를 안전 근거로 인용 중이며 둘 다 spec_impact 밖 |

## 권장 조치사항
1. (BLOCK 해소 우선) planner 턴 착수: `spec/2-navigation/14-execution-history.md` R-5 정정("저장 시점 마스킹" → "egress-time parity, DB 원문 보존"), `spec/4-nodes/3-ai/1-ai-agent.md:480` 정정, `spec/conventions/node-output.md` Principle 7 인접부 명문화, `spec/5-system/4-execution-engine.md` 한 문장 추가, `spec/conventions/egress-masking.md` §1 표 갱신 — `masking-expression-egress-split.md` 의 `spec_impact` 에 이 문서들을 모두 추가.
2. `plan/in-progress/spec-sync-external-interaction-api-gaps.md:601-612` 자매 트래커 항목을 이 PR 결과로 닫거나 재기술하는 단계를 `masking-expression-egress-split.md` 체크리스트에 추가.
3. "포함관계 캐너리" 체크리스트 항목을 REST(`sanitize-error-message.ts`)·WS(`websocket.service.ts`) 의 `CREDENTIAL_KEY_PATTERN` 각각에 대해 명시적으로 복수 검증하도록 보강.
4. (이번 PR 과 독립, 별도 planner 소작업 가능) cafe24/makeshop 에러 포트·에러코드를 `spec/5-system/3-error-handling.md` §1.4/§3.2, `spec/conventions/node-output.md` Principle 3.3 에 등재.
5. "중복 제거" 프레이밍을 EIA R17 "레이어는 쌓인다" 원칙과 화해시키는 문장을 `egress-masking.md` 갱신 시 포함.
6. `mask-sensitive-fields.util.ts` 헤더 주석, `spec/3-workflow-editor/4-ai-assistant.md:261` 소비처 열거를 같은 planner 턴 또는 코드리뷰 단계에서 정정.
