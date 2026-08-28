# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원이 전문을 보고했고, Critical 등급 위배는 0건이다.

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, 신설 §6.3.1 의 배치 위치·판별 기준 정밀도에 관한 WARNING 이 rationale_continuity·convention_compliance·cross_spec 세 checker에 걸쳐 중복 확인됐고 plan SoT 인용 누락도 있어, spec 반영 전 문구 보강이 필요하다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 이 없으므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, convention_compliance | 신설 §6.3.1 의 배치 위치가 §6("로깅 레벨·민감정보 마스킹"으로 스스로 범위를 선언한 섹션)인데, target 이 제시하는 필요성 근거는 "노드 에러가 Activity API 를 통해 사용자에게 노출"이라는 **클라이언트/응답 채널** 문제 — 로그 채널이 아니다. CWE-209 고정 문구 선례의 실제 본문 위치도 §6 이 아니라 §1.3/`GlobalExceptionFilter`이고, 기존 위임처인 `node-output.md §3.2`(`output.error` 표준 형태 정본)도 배치 후보 검토에서 누락됐다 | `plan/in-progress/spec-draft-error-cause-criterion.md` "## 제안", "## 왜 `spec/conventions/` 가 아니라 여기인가" | `spec/5-system/3-error-handling.md` Overview("§6=로깅 마스킹") 및 §6.3 본문, `conventions/node-output.md §3.2` | §6.3.1 서두에 "이 절은 로그가 아니라 클라이언트에 노출되는 객체 구성을 다룬다"는 채널 명시 문장 추가, 또는 §2(에러 응답 형식)/`node-output.md §3.2` 인접 배치를 대안으로 검토. §2 에도 상호 참조 추가 |
| 2 | cross_spec | 신설 §6.3.1 원칙문("catch 한 에러를 새 에러로 감쌀 때 … cause 를 부착한다")이 레이어 구분 없이 일반형으로 서술돼, `2-api-convention.md §5.3`의 REST 표준 에러 봉투 무조건 no-echo(CWE-209) 정책과 스코프가 겹친다. `preserve-caught-error` ESLint 룰이 백엔드 전역(REST 컨트롤러/서비스 포함)에서 발화하므로, 향후 그 레이어 개발자가 §6.3.1 을 문자 그대로 따르면 "message 원문을 embed 한 것 자체가 §5.3 위반"이라는 사실이 가려질 위험 | target 문서 "## 제안" 절, 신설 `#### 6.3.1` 원칙 문장 | `spec/5-system/2-api-convention.md §5.3`(내부 구현 원문 echo 무조건 금지) | §6.3.1 앞에 "본 기준은 message 내용 자체의 노출 적법성을 판정하지 않는다. REST 표준 봉투(§1.3/§5.3)는 원문 embed 자체가 이미 금지 — 그 경로는 §5.3 위반 여부를 먼저 확인한다" 는 스코프 한정 문구 추가 |
| 3 | rationale_continuity | `cause` 판별 기준이 "감싼 message 가 원본 message 를 포함하는가"만 검사 — `#814`(SSRF 메시지 일반화)가 확립한 "필드가 아니라 raw content 노출 여부가 판단축" 원칙을 message 텍스트 하나로만 근사. `{ cause: err }` 로 부착되는 것은 message 문자열이 아니라 `err` 객체 전체이므로, `err` 가 message 외 부가 속성(DB `detail`/`hint`/`where`, HTTP 헤더 등)을 가지면 message 겹침 조건이 성립해도 cause 부착이 새 정보를 노출할 수 있다 | target 문서 "## 제안" 첫 bullet | `spec/4-nodes/4-integration/1-http-request.md §8.3` Rationale "기각된 대안 (B)"(필드만 옮기는 안 기각 근거) | 원칙 문장에 "`err` 가 message 외 새 민감 정보를 own-property 로 갖지 않는다고 가정" caveat 추가, 또는 "cause 부착 시 `err` 의 own enumerable 속성이 message/name 뿐임을 확인" 조건 포함 |
| 4 | plan_coherence | target 이 이 판별 기준 명문화를 이미 위임받은 실제 SoT `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 후속 항목을 인용하지 않고 review 산출물(`#1226`)만 근거로 삼음. 완료 시 그 plan 체크박스를 닫는 교차참조 절차도 없어, 실제로는 해소된 결정이 미해결로 남아 재검토될 위험 | target 문서 `## Overview`, `## 체크리스트` | `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 "(후속, INFO) `cause` 부착 판단 근거" 항목 | target 에 선행 plan 으로 명시 인용 + 체크리스트에 "완료 후 `deps-peer-gating-and-eslint10.md` §2 에 교차참조 추가" 단계 신설. 반영 시 원 plan 체크박스 옆에 "완료 (날짜, `spec-draft-error-cause-criterion`)" 남기기 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `secret-resolver.service.ts` 비부착 근거를 `secret-store.md` SS-SE-05 로 직접 교차 인용 권장 | target "### 왜 이 기준이 필요한가" | §6.3.1 비부착 규칙 옆에 `secret-store.md#SS-SE-05` 참조 추가 |
| 2 | rationale_continuity | "`.cause` 를 직렬화하는 곳이 0곳" 문구가 스코프(클라이언트 응답 경로 기준)를 명시하지 않음 — 실제로는 `telegram-client.ts describeFetchError` 가 로그 전용으로 `.cause` 를 읽는 기존 코드가 있음 | target "### 왜 이 기준이 필요한가" | "클라이언트 응답 경로로 직렬화하는 곳이 0곳"으로 스코프 한정, 또는 `describeFetchError`를 로그 전용 unwrap 선례로 각주 처리 |
| 3 | convention_compliance | 중첩 backtick으로 인한 마크다운 렌더링 결함(`#### 6.3.1 …` 중 "cause"만 코드서식 이탈) | target "## 제안" 첫 문장 | 인용 전체를 단일 backtick 쌍으로 감싸거나 코드펜스로 분리 |
| 4 | convention_compliance | conventions 272개 중 269개(swagger.md 포함)가 컨텍스트 예산 초과로 절단된 기지 harness 이슈 — target 판단에 직결되는 `node-output.md`는 별도 확인함 | 전체 conventions 번들 | 조치 불요 (기존 harness 트래킹 대상, 이번 결론에 영향 없음) |
| 5 | plan_coherence | "인라인 주석 3곳 정리" 후속 항목의 등재처 미지정 — 이미 같은 파일들을 추적 중인 `deps-peer-gating-and-eslint10.md`가 있음 | target `## 체크리스트` 3번째 항목 | 체크리스트에 "`deps-peer-gating-and-eslint10.md` §2 후속에 등재" 명시 |
| 6 | plan_coherence | 같은 spec 파일(`3-error-handling.md`)의 다른 절(§1.2)을 겨냥한 `spec-update-node-cancellation-shutdown-classification.md` plan 이 로컬에 존재 — 섹션 불일치로 충돌은 아님 | target "## 제안" | 조치 불요, 착수 시 같은 turn 에서 겹치지 않도록만 유의 |
| 7 | naming_collision | "root cause"(기존 6곳, 서술적 개념)와 신설 `Error.cause`(JS 프로퍼티) 간 용어 동음이의 — 실질 충돌 아님 | 신설 §6.3.1 본문 | §6.3.1 본문에 두 개념이 무관함을 한 줄 명시(선택) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §6.3.1 원칙문이 레이어 미구분으로 §5.3 REST no-echo 정책과 스코프 겹침(WARNING 1건). 데이터모델/API계약/요구사항ID/RBAC 등은 충돌 없음 |
| rationale_continuity | MEDIUM | 배치 위치가 실제 노출 채널(클라이언트)과 선언 범위(로그)가 어긋남 + `#814` "필드 아닌 content" 원칙을 message 텍스트로만 근사(WARNING 2건). CRITICAL급 대안 재도입은 없음 |
| convention_compliance | LOW | §6 배치와 API노출 근거의 스코프 불일치(WARNING 1건, rationale_continuity와 동일 이슈 중복 확인). frontmatter/Gate C/heading depth 등 형식 규약은 전부 준수 |
| plan_coherence | LOW | 실제 SoT `deps-peer-gating-and-eslint10.md` 미인용 + 완료 교차참조 절차 부재(WARNING 1건). 코드 실측·타 plan 과의 직접 충돌은 없음 |
| naming_collision | NONE | 신규 식별자 표면 없음(요구사항ID·엔티티·API·이벤트·ENV 전부 미도입). 헤딩번호 §6.3.1 충돌 없음. "root cause" 동음이의는 INFO |

## 권장 조치사항
1. §6.3.1 원칙문 서두에 채널/레이어 스코프 한정 문구 추가 — "로그가 아니라 클라이언트 노출 객체 구성을 다룬다" + "REST 표준 봉투(§1.3/§5.3)는 이 기준 이전에 §5.3 위반 여부를 먼저 확인" (WARNING #1, #2 동시 해소)
2. 판별 기준에 "`err` 의 own enumerable 속성이 message/name 외 새 민감 정보를 갖지 않는다" caveat 추가 (WARNING #3)
3. target 문서에 `plan/in-progress/deps-peer-gating-and-eslint10.md` 를 선행 plan 으로 명시 인용하고, 완료 시 그 plan §2 항목에 교차참조를 남기는 체크리스트 단계 신설 (WARNING #4)
4. (선택) `secret-store.md#SS-SE-05` 교차 인용, "0곳 직렬화" 문구 스코프 한정, backtick 렌더링 수정, 인라인 주석 후속 등재처를 `deps-peer-gating-and-eslint10.md` §2 로 명시 (INFO 항목들)

이상은 모두 project-planner 가 이 draft 를 실제 `spec/5-system/3-error-handling.md` 에 반영하기 전 문구 보강으로 해소 가능한 수준이며, 착수를 막는 사유는 없다.