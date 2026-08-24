# Consistency Check 통합 보고서

**BLOCK: YES** — cross_spec 이 `[CRITICAL]` 로 판정한 항목이 1건 있고, 이 등급은 통합 단계에서
하향하지 않는다(근거가 타당해도 규약상 금지). 다만 그 Critical 의 근본 원인은 호출자(developer)
권한 밖이므로 아래 **§planner 인계** 로 다음 행동을 지정한다 — 이 PR 자체를 되돌리라는 뜻이 아니다.

## 전체 위험도
**MEDIUM** — 5개 checker 중 4개(rationale_continuity/convention_compliance/plan_coherence/
naming_collision)는 LOW~NONE 이고 신규 실체적 위반이 없다. cross_spec 의 CRITICAL 1건은 **이번
diff 가 새로 만든 결함이 아니라 이미 발견·실측·등재·의도적 이연이 완료된 known issue**(직전
`12_24_55` 라운드 CRITICAL → `RESOLUTION.md` 로 스코프 확정)의 재확인이지만, 통합 규약상 등급을
낮출 수 없어 BLOCK 은 유지한다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `conversation-thread.md` §9.7/§1.1.1 이 target 이 이번에 정정한 `execution.node.failed` wire 의 `error` shape(문자열, 실측 4곳 전수)와 여전히 모순 — 여전히 "payload 의 `error.{code,message,details...}`" 구조화 객체로 서술. frontend `use-execution-events.ts` 의 `extractNodeErrorPayload`/`handleNodeFailed` 가 이 틀린 계약을 코드화해 라이브 WS 경로에서 `system_error` 재시도 배너 미표시 실결함으로 이미 관측됨 | `spec/5-system/6-websocket-protocol.md` §4.1 (정정 완료 지점) | `spec/conventions/conversation-thread.md` §9.7 `node.failed` 행, §1.1.1 | `conversation-thread.md` §9.7/§1.1.1 의 `node.failed` 서술을 "top-level `error` 는 string, 구조화 객체는 `output.output.error` 에서만" 으로 정정(원문 취소선 보존). `plan/in-progress/spec-sync-external-interaction-api-gaps.md:204-229` 착수 지침에 "frontend 코드 수정 시 이 문서 문구도 함께 정정" 한 줄 추가 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 근본 원인이 호출자 권한 밖이라 여기 싣는다. **등급은 CRITICAL 그대로이고
> `BLOCK: YES` 도 그대로입니다** — 이 표는 차단을 푸는 장치가 아니라 다음 행동을 지정하는
> 장치입니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `conversation-thread.md` 는 `spec/conventions/` 문서라 developer 는 read-only. WS payload `error` shape 은 API 계약이라 CLAUDE.md 의 자기-반증형 소정정 5조건 중 조건 2("제품 정의·요구사항·API 계약은 해당 없음")에 걸려 예외 적용 불가 — 정식 planner 턴 필요 | project-planner | `spec/conventions/conversation-thread.md` §9.7 `node.failed` 행 + §1.1.1: `payload.error` 구조화 객체 서술 → "`error` 는 string, 구조화 객체는 `output.output.error` 에서만" 정정(원문 취소선 보존 + 실측 인용). 겸사겸사 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:204-229` 착수 지침에 "문서 문구 정정" 항목 명시 추가 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:204-229` (🔴 항목, 2026-08-24 등재) |

## 경고 (WARNING)

없음 — 5개 checker 모두 WARNING 급 위반을 보고하지 않았다.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | provider 3개 문서(`telegram.md`/`slack.md`/`discord.md`) CCH-MP-06 이 여전히 `output.rendered`(단일 단계) 표기, `chat-channel-adapter.md` §3 은 이미 `output.output.rendered` 로 정정됨 | `spec/4-nodes/7-trigger/providers/{telegram,slack,discord}.md` | 이미 등재됨(`spec-sync-external-interaction-api-gaps.md:231-241`), 별도 planner 턴 스코프 — 반복 지적 불요 |
| 2 | rationale_continuity | `.failed` 프런트 결함(`system_error` 배너 미표시)의 spec 정정과 코드 수정 간 시차 — spec 은 이미 정정, 코드는 별도 트래커로 이연 | `spec/5-system/6-websocket-protocol.md` §4.1 정정 blockquote | 별도 조치 불요, 다음 세션이 🔴 항목 집행 시 착수 지침 그대로 따르면 됨 |
| 3 | convention_compliance | `node-output.md` 에 WS wire `output` 이중 네이밍(전송 봉투가 `output` 필드명 재사용 → `output.output` 형태) 교차참조 없음 — Principle 8.1 의 이중 중첩 금지와 표면적으로 유사해 보일 수 있음 | `spec/conventions/node-output.md` Principle 0 / 8.1 | `node-output.md` 에 "WS/EIA fanout wire 는 전송 봉투 필드명으로 `output` 재사용 — SoT: WS §4.1" 교차참조 한 줄 추가 검토(규약 갱신 제안, target 자체는 정확) |
| 4 | convention_compliance | REST 엔드포인트 `/api` prefix 표기 불일치(사전 존재, 본 PR 변경분 아님) | `spec/5-system/6-websocket-protocol.md` §1.3/§4.2/§4.6/§6.2 | 별도 소정정 turn 에서 `/api` prefix 통일 검토(이번 PR 범위 밖) |
| 5 | convention_compliance | 절대 라인 번호 인용(`execution-engine.service.ts:6302` 등) — 확인 결과 위반 아님(egress-masking.md §1 규칙은 자기 좌표계 표에 스코프 한정, 문서 기존 관행과 일관) | `spec/5-system/6-websocket-protocol.md` §4.1 정정 블록 | 조치 불요, 확인 기록용 |
| 6 | plan_coherence | `plan/complete/node-output-envelope.md` 가 `status: complete` 로 이동된 뒤에도 같은 scope 파일에 `spec-sync-external-interaction-api-gaps.md` 경유로 추가 CRITICAL 정정이 계속 커밋됨 — 패턴 자체는 기존 관행과 일치 | `plan/complete/node-output-envelope.md` | 조치 불요. 다음 세션은 "complete" 라벨만 보지 말고 `spec-sync-external-interaction-api-gaps.md` 최신 항목도 함께 훑을 것 |
| 7 | naming_collision | `plan/complete/node-output-envelope.md`(egress 필터링, 전송 계층) 와 `plan/in-progress/node-output-redesign/`(노드 핸들러 출력 스키마 재설계, 도메인 계층) 이 `node-output-` 접두를 공유 — 주제는 명확히 다름 | `plan/complete/node-output-envelope.md` vs `plan/in-progress/node-output-redesign/` | 조치 불요. 향후 `grep node-output` 검색 시 혼선 가능성만 인지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | CRITICAL 1건(known/tracked) — `conversation-thread.md` §9.7 이 target 정정과 모순. 그 외 신규 cross-spec 충돌 0건 |
| rationale_continuity | LOW | `#1208` 유예 번복이 취소선+실측+교훈 동반, 과거 명시 기각 결정(C3/R10/llmCalls strip-only 등)과 무충돌. 신규 위반 없음 |
| convention_compliance | LOW | CRITICAL/WARNING 없음. INFO 3건(규약 교차참조 갭, 사전 존재 `/api` 불일치, 라인번호 인용 확인-무해) |
| plan_coherence | NONE | target scope 가 `plan/complete/node-output-envelope.md` `spec_impact` 와 정확히 일치, 미해결 결정 충돌·후속 누락 없음 |
| naming_collision | NONE | 신규 식별자 도입 자체가 없어 충돌 표면 없음. INFO 1건(plan 슬러그 접두어 유사, 실질 위험 낮음) |

## 권장 조치사항
1. **(BLOCK 해소 우선)** planner 턴에서 `spec/conventions/conversation-thread.md` §9.7/§1.1.1 의
   `node.failed` payload `error` shape 서술을 "string, 구조화 객체는 `output.output.error` 에서만"
   으로 정정(취소선 보존 + 실측 인용). `plan/in-progress/spec-sync-external-interaction-api-gaps.md:204-229`
   착수 지침에 "frontend 코드 수정 시 이 문서 문구도 함께 정정" 한 줄을 추가한다.
2. (선택) `spec/conventions/node-output.md` Principle 0/8.1 에 WS/EIA fanout wire 의 `output`
   이중 네이밍에 대한 교차참조 한 줄 추가.
3. (선택, 이번 PR 범위 밖) `spec/5-system/6-websocket-protocol.md` 내 REST 엔드포인트 `/api`
   prefix 표기를 별도 소정정 turn 에서 통일.
4. (선택) `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 🔴 항목(frontend
   `extractNodeErrorPayload` 수정)은 이미 등재돼 있으므로 다음 세션에서 착수.