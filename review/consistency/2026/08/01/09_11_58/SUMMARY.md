# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음. 다만 실질적 리스크가 있는 WARNING 3건이 있어 구현 착수 전 정정을 권장.

## 전체 위험도

**MEDIUM** — Critical 은 없으나(cross_spec MEDIUM, naming_collision MEDIUM, 나머지 LOW), endpoint 표기 불일치(404 유발 가능)와 다른 도메인 문서의 감사 상태 오기술이 문서 신뢰도·구현 스코프 판단에 실질 영향을 줄 수 있음.

## Critical 위배 (BLOCK 사유)

_Critical 위배 없음._

## planner 인계 (권한 밖 Critical)

(없음) — Critical 항목이 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | `spec/data-flow/1-audit.md`(8곳) 및 `3-execution.md`(1곳) 의 REST endpoint 표기가 global prefix `/api` 를 일관되게 누락 — 실제 서버 경로(`main.ts` `setGlobalPrefix('api')`)·SoT(`5-system/1-auth.md`)·같은 target 번들의 형제 문서(`2-auth.md`) 와 문자열 층위에서 불일치 | `spec/data-flow/1-audit.md` §1.1/§2 (`GET /audit-logs` L451, `GET /users/me/login-history` L463, `/auth/2fa/*` L382-387 등), `3-execution.md` L728 | `codebase/backend/src/main.ts:186`(`setGlobalPrefix('api')`), `codebase/backend/.../audit-logs.controller.ts`, `spec/5-system/1-auth.md:499,502`, `spec/data-flow/2-auth.md:2051,2076` (동일 endpoint 를 `/api` 포함해 표기) | `1-audit.md`·`3-execution.md` 의 REST endpoint 표기 전부를 `/api/...` 전체 경로로 정정해 `2-auth.md`/`11-workflow.md`/`12-workspace.md`/`7-llm-usage.md`/`0-overview.md`/`5-system/1-auth.md` 와 통일. 재발 방지로 `spec/data-flow/0-overview.md §3`(공통 규약)에 "본문 산문의 endpoint 표기는 항상 전체 경로(`/api/...`) — 시퀀스 다이어그램 화살표 라벨만 예외" 규칙 명문화 권장 |
| 2 | naming_collision | `11-workflow.md` L1276-1277 의 `/sessions` 축약 표기가 인증 도메인에 이미 존재하는 리소스 `/api/users/me/sessions` 와 문자열 층위에서 겹쳐 혼동 유발. 같은 문서 L1255 는 바로 위에서 전체 경로(`/api/workflow-assistant/sessions`)로 썼는데 두 줄 뒤 `workflow-assistant/` 세그먼트까지 생략한 축약형이 등장해 문서 내에서도 자기모순 | `spec/data-flow/11-workflow.md:1276-1277` | `codebase/backend/.../workflow-assistant.controller.ts:41,50,88`(`@Controller('workflow-assistant')`), `codebase/backend/.../sessions.controller.ts`(`@Controller('users/me')` `@Get('sessions')` — 별개 리소스), `spec/data-flow/2-auth.md:2050` | L1276-1277 을 `GET /api/workflow-assistant/sessions?workflowId=…`, `GET /api/workflow-assistant/sessions/:id` 로 완전한 경로로 수정해 인증 세션 엔드포인트와 표기 층위에서 명확히 구분 |
| 3 | cross_spec | `spec/2-navigation/2-trigger-list.md` 가 미구현 `trigger.delete`/`trigger.update` 감사 기록을 현재형·단정문("…기록된다", Rationale "…기록한다")으로 "이미 기록됨"처럼 서술 — target(감사 도메인 SoT)이 명시한 Planned(미구현) 상태와 정면 모순. 코드로 재확인한 결과 target 이 맞고 trigger-list.md 가 stale(2026-06-11~14 감사 액션 정리 작업이 `5-system/1-auth.md` 는 고쳤지만 이 문서는 놓쳤고, 이후 약 2개월간 미수정) | `spec/data-flow/1-audit.md` §1.1 (L82-88, "`trigger.*` 액션은 여전히 미구현"), `spec/5-system/1-auth.md` §4.1 (L414-436, Planned 표), `spec/conventions/audit-actions.md` §3 (레지스트리, `trigger` 행="미구현") | `spec/2-navigation/2-trigger-list.md` (frontmatter `status: implemented`) L182 "audit log 의 `trigger.delete` action 항목으로 기록된다", L252 (Rationale) "활성/비활성 전환도 `trigger.update` 로 기록한다" | (project-planner) L182/L252 를 "Planned(미구현) — [data-flow §1.1]/[5-system/1-auth.md §4.1] 참조" 로 정정해 target 과 정합화. 이번 audit-logging 작업이 `trigger.created/updated/deleted` 구현까지 포함한다면, 완료 후 `1-audit.md §1.1` + `1-auth.md §4.1`(Planned→구현 이동) + `audit-actions.md §3`(상태 컬럼) + `2-trigger-list.md` L182/L252 를 한 커밋에서 동시 갱신할 것(SoT 가 4곳에 흩어져 있어 하나만 고치면 재drift) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/5-system/15-chat-channel.md` §5.4.1 Rationale 이 `trigger.update` 감사 기록 전제를 재생산(기각된 대안 정당화 문맥). 언급된 `chat-channel.rotate-bot-token` 액션명도 `AUDIT_ACTIONS`/`audit-actions.md` 레지스트리 어디에도 없는 가상의 이름 | `spec/5-system/15-chat-channel.md` L377, L609-611 | trigger.* 감사가 실제 구현될 때 실제 액션명(확정된 `trigger.update` 여부, `chat-channel.*` 네임스페이스 채택 여부)에 맞춰 함께 정정. 지금 당장 비차단 |
| 2 | cross_spec | `spec/0-overview.md §6` 로드맵 표(§6.1 완료/§6.2 백엔드만 존재/§6.3 로드맵) 어디에도 "Audit Log" 백엔드 기능(API+RBAC 이미 구현됨)이 등재되지 않음 — frontend 에 audit-log 페이지 0건이라 UI 부재는 맞으나 §6.2 "백엔드만 존재" 표에도 누락 | `spec/data-flow/1-audit.md` §2.1(`GET /audit-logs` API), `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스(`Audit Log \| R \| R \| — \| —`) | 이번 작업이 열람 UI 를 포함하면 완료 후 `0-overview.md §6.1` 내비게이션 행 + `spec/2-navigation/_product-overview.md` IA 에 신규 진입점 등재. 백엔드 유지 범위라면 `§6.2` 에 "Audit Log(API-only, UI 없음)" 한 줄 추가 권장(비차단) |
| 3 | rationale_continuity | `5-integration.md §4` 의 Audit 액션 요약 표(5건: created/updated/deleted/rotated/reauthorized)가 SoT(`1-audit.md §1.1`, 6건) 대비 `integration.scope_changed` 1건 누락. 코드 확인 결과 `integrations.service.ts:1228` 가 `AUDIT_ACTIONS.INTEGRATION_SCOPE_CHANGED` 를 실제로 기록하므로 `1-audit.md` 가 맞고 `5-integration.md` 쪽이 누락 | `spec/data-flow/5-integration.md §4`(외부 의존 표, Audit 행) | Audit 행에 `integration.scope_changed` 추가(6건으로). 감사 로깅 커버리지 확장 작업에서 이 파일을 함께 손대지 않는다면 범위 밖 사소 정정으로 별도 처리 가능 |
| 4 | convention_compliance | `1-audit.md` §2("Read path")/§3("보존 정책") 섹션 순서가 형제 문서(canonical: Source→Sink/Schema매핑/상태전이/외부의존)와 다른 것은 `0-overview.md` Rationale 에서 이미 사전 승인됐으나(위반 아님), 그 승인 근거가 `1-audit.md` 본문에는 역참조 각주로 없어 이 문서만 단독으로 여는 리뷰어가 이탈로 오인할 수 있음 | `spec/data-flow/1-audit.md` §2, §3 헤더 | 선택 사항. §2 헤더 아래 "형제 문서와 섹션 순서가 다른 이유는 [0-overview.md §Rationale] 참고" 1줄 역참조 추가 시 탐색성 개선. 규약 갱신은 불요 |
| 5 | plan_coherence | 번들에서 컨텍스트 예산으로 생략됐던 `plan/in-progress/spec-sync-auth-gaps.md` 를 직접 Read 로 확인 — target 의 "workflow/trigger/schedule/model_config 감사 미구현" 서술과 정확히 일치, 상충 없음. 오히려 이 plan 은 "§4.1 감사 로깅 갭이 남아 있는 한 `1-auth.md` 를 `status: implemented` 로 승격 금지" 조건을 명시하며 명명·시제 규약도 완결된 상태 | `spec/data-flow/1-audit.md:82-86`, `spec/5-system/1-auth.md:429-438` / `plan/in-progress/spec-sync-auth-gaps.md:13-31` | 조치 불요(검증 완료, 충돌 없음). 구현 완료 후 ① plan §4.1 체크 ② `audit-actions.md §3` 4개 행 "미구현"→"구현" 갱신 ③ `1-auth.md §4.1` Planned 표에서 해당 행 이동을 한 세트로 수행할 것. LDAP/SAML(§1.3) 이 별도 남아 있어 이번 작업만으로는 `status: implemented` 승격 불가함을 인지 |
| 6 | plan_coherence | `audit_log` 보존 정책이 spec 자체에서 "미정 — 현재 무제한(pruner 없음)"으로 명시된 상태에서, Planned 카탈로그의 `workflow.*` 에 CRUD 3종(`created/updated/deleted`, 저빈도) 외 카디널리티가 다른 `executed`(트리거/webhook 발동마다 기록 가능, 고빈도)가 포함돼 있음. 이 결정 공백을 다루는 plan 이 `plan/` 전체에 0건 | `spec/data-flow/1-audit.md:162`(§3 보존 정책), `spec/5-system/1-auth.md:433`(`workflow.executed` Planned), `:448`(§4.2 "보존 정책 미정") | 이번 작업 범위에 `workflow.executed` 포함 여부 먼저 확인. 포함 시 착수 전 보존 정책(예: `login_history` 와 동일한 pruner 도입 여부)을 결정 항목으로 명시적으로 올릴 것을 권장. 또는 범위를 CRUD 3종으로 한정하고 `executed` 는 보존 정책 결정과 묶어 별도 plan 으로 분리 |
| 7 | plan_coherence | 동일 target 폴더를 다루던 선행 plan `spec-data-flow-structural-followups.md` 가 체크리스트 5항목 중 4항목 완료(커밋 `0d20a9cc9` 로 실현되어 `origin/main` 에 이미 반영, `git log` 확인)인데 "push+PR" 체크박스만 미완료로 `plan/in-progress/` 에 잔류. §4 "서술형 LLM Config 표기 잔여"(data-flow 밖 범위)도 별도 backlog 로 분리되지 않은 채 방치 | `plan/in-progress/spec-data-flow-structural-followups.md:71-93`(체크리스트), `:95-104`(§4 잔여) | 이번 audit-logging 작업과 무관, 차단 사유 아님. 같은 target 디렉터리를 다루는 후속 검토 혼선 방지를 위해 planner 턴에서 이 plan 을 `plan/complete/` 로 이동(또는 push+PR 체크 확정)하고 §4 잔여를 별도 plan 항목으로 분리 권장 |
| 8 | naming_collision | `spec/0-overview.md §8` 문서 맵의 "데이터 흐름 … 알파벳 순 숫자 prefix" 서술이 최근 추가된 3개 파일(`13-agent-memory`/`14-chat-channel`/`15-external-interaction`)과 어긋남 — 최초 12개(`1-audit`~`12-workspace`)는 도메인명 기준 완벽한 알파벳 순이나, 뒤 3개는 기존 파일 재넘버링을 피해 끝에 순차 추가된 것으로 전체 알파벳 순은 아님 | `spec/0-overview.md §8`(문서 맵 표), `spec/data-flow/0-overview.md §2`(도메인 인덱스 표 L145-166) | 서술을 "최초 12개 도메인은 알파벳 순, 이후 신규 도메인은 기존 파일 번호 보존을 위해 끝에 순차 추가"로 정정하거나, `data-flow/0-overview.md §2` 부근에 신규 도메인 추가 시 번호 배정 규칙을 명문화 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `2-navigation/2-trigger-list.md` 가 target 이 명시한 Planned(미구현) `trigger.*` 감사를 "이미 기록됨"으로 오기술(WARNING, 코드로 재확인해 target 이 맞음). 부수 INFO 2건(`15-chat-channel.md` 동일 전제 재생산, `0-overview.md §6` 로드맵 누락) |
| rationale_continuity | LOW | 최근 3개 커밋(RBAC 표·SIGTERM 분류·명칭 통일 정비)이 안정적으로 반영됨을 재확인. 기각된 대안 재도입·무근거 번복 없음. `5-integration.md §4` SoT 사본 drift 1건(INFO)만 |
| convention_compliance | LOW | audit action 명명(`<resource>.<verb>`, dot-prefix, 시제 3분류)·금지 패턴·출력 포맷(Swagger 래퍼) 이 conventions·인접 spec·실제 코드 3곳과 전수 일치. CRITICAL/WARNING 없음, 섹션 순서 각주 부재 INFO 1건만 |
| plan_coherence | LOW | 유일하게 직결되는 plan(`spec-sync-auth-gaps.md`, 번들 생략분 직접 확인)이 target 과 정확히 일치, 미해결 결정 우회 없음. 보존 정책 미정 상태의 `workflow.executed` 카디널리티 이슈 등 INFO 3건 |
| naming_collision | MEDIUM | `1-audit.md`/`3-execution.md` endpoint 표기 8+1건이 global prefix `/api` 누락(WARNING) + `11-workflow.md` `/sessions` 축약이 인증 도메인 리소스와 표기 층위 혼동(WARNING). 신규 식별자(action/타입/이벤트/env) 층위 충돌은 0건 |

## 권장 조치사항

1. (BLOCK 해소 항목 없음 — Critical 0건, 구현 착수를 막는 사유 없음)
2. WARNING 3건 우선 정정:
   a. `spec/data-flow/1-audit.md`(8곳)·`3-execution.md`(1곳) REST endpoint 표기에 `/api` prefix 추가해 `2-auth.md`/`5-system/1-auth.md`/실제 코드와 통일
   b. `spec/data-flow/11-workflow.md` L1276-1277 을 `/api/workflow-assistant/sessions[...]` 완전 경로로 수정
   c. (project-planner) `spec/2-navigation/2-trigger-list.md` L182/L252 를 "Planned(미구현)" 으로 정정
3. 이번 작업 범위에 `workflow.executed` 가 포함되는지 확인 — 포함 시 `audit_log` 보존 정책(pruner 도입 여부)을 착수 전 결정 항목으로 명시(INFO 6)
4. 감사 로깅 커버리지 확장(workflow/trigger/schedule/model_config) 구현 완료 시 다음 4개 SoT 를 한 커밋에서 동시 갱신: `data-flow/1-audit.md §1.1` 표, `5-system/1-auth.md §4.1`(Planned→구현 이동), `conventions/audit-actions.md §3`(상태 컬럼), `2-navigation/2-trigger-list.md`(WARNING 3 정정분과 합류)
5. 여유 있을 때 나머지 INFO(§5-integration.md 누락 1건, §15-chat-channel.md 전제, §0-overview.md §6/§8 서술, §1-audit.md 각주, 선행 plan 마감) 일괄 정리 — 모두 비차단