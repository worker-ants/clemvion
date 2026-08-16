# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. WARNING 1건은 코드 결함이 아니라 `[SPEC-DRIFT]`(spec 문서가 이미 구현된 안전한 마스킹 하드닝을 아직 반영하지 못한 것)이며, 나머지는 전부 INFO(이월/기결정 포함). forced whitelist(7명) 전원 결과 확보 — 미이행 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `Execution.error.message`/`details` 값-패턴 마스킹(신규 `redactTerminalError` egress 초크포인트)이 `spec/5-system/14-external-interaction-api.md` §6.4 필드 표와 R17 "표면 제약(보안)" 마스킹 카탈로그에 아직 반영되지 않았다. R17 기존 3번째 불릿("`nodeOutput.conversationConfig` + terminal `result`/`error`")은 이름이 비슷하지만 실제로는 `getStatus`의 `outputData` 기반 `error`를 가리키는 **다른 컬럼**이라 이번 변경을 포괄하지 못한다 — 코드가 구현한 새 보안 불변식을 spec 이 아직 모른다. | spec: `spec/5-system/14-external-interaction-api.md:770-789`(§6.4), `:1414-1457`(R17) / 코드: `codebase/backend/src/shared/utils/terminal-error-payload.ts`(`redactTerminalError`) | developer 권한 밖(`spec/` read-only) — 이 PR 을 막을 사유 아님. `project-planner` 턴에서 §6.4 필드 표에 마스킹 캐비엇 추가 + R17 에 5번째 불릿("`Execution.error`→종결 emit `error.message`/`details`: `redactTerminalError` 값-패턴 마스킹") 등재. 이미 `plan/in-progress/eia-terminal-error-sanitize.md` "후속" 절에 미체크 항목으로 정직하게 등재돼 있음. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `toTerminalErrorPayload`/`redactTerminalError` 경로에 길이/크기 상한이 없다 — 자매 유틸 `sanitize-error-message.ts`(500자 절단)와 달리 마스킹 후 그대로 무제한 전달될 수 있다(secret 노출은 아님, 선존 갭). | `codebase/backend/src/shared/utils/terminal-error-payload.ts` (`redactTerminalError`, `toTerminalErrorPayload`) | 별도 후속으로 길이/크기 상한 검토 등재 권장(차단 사유 아님). |
| 2 | security / requirement | `SECRET_LEAK_PATTERNS`는 자격증명 패턴만 겨냥 — 자격증명 없는 연결 문자열·내부 호스트명·IP 는 여전히 마스킹 없이 통과한다. 의도적으로 범위를 좁힌 잔여 갭이며 JSDoc·CHANGELOG·테스트 캐너리·`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 4곳에 일관되게 등재돼 은폐되지 않았다. | `terminal-error-payload.ts:80-93`(실측표) / `terminal-error-payload.spec.ts:211-217`(캐너리) | 조치 불요(이미 트래킹). 승격 시 `deepRedactSecrets` 의 다른 소비자 회귀 테스트 선행 필요하다는 점도 문서화됨. |
| 3 | security | `execution.cancelled` 경로(`emitCancellationEvent`, 5곳)는 이번 마스킹 초크포인트를 거치지 않는다. 현재는 raw 예외 메시지를 안 써서 안전하지만, 향후 취소 사유를 상세화하면 초크포인트를 우회하는 표면이 생길 수 있다. | `terminal-error-payload.ts` 상단 JSDoc | 코드 변경 불요. 향후 raw 메시지 유입 시 `deepRedactSecrets`/`toTerminalErrorPayload` 경유를 강제하는 캐너리 주석 고려. |
| 4 | maintainability | `sanitize-error-message.ts` docstring 에 "과거 서술이 틀렸던 이유" 서사가 두 겹으로 쌓여, 표가 이미 확정한 사실(호출부 범위)을 산문이 다시 설명한다 — 정보가 두 표현에 흩어져 향후 한쪽만 갱신될 여지. | `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts:4-20` | 조치 불요(강한 요구 아님). 세 번째 자기수정 레이어가 쌓이면 "현재 사실"은 표만 남기고 역사적 서사는 `plan/in-progress/eia-terminal-error-sanitize.md` 로 포인터 이관 고려. |
| 5 | testing | 실제 5개 emit 호출부(`execution-engine.service.ts`/`retry-turn.service.ts`/`chat-channel.dispatcher.ts`)에서 나가는 WS/SSE/webhook payload 가 마스킹되는지 검증하는 통합 테스트가 없다 — 순수 함수 단위 테스트만 존재(이월, `11_04_07` RESOLUTION 에서 의도적 무조치로 명시, 뮤테이션 7/7 RED 근거). | `terminal-error-payload.ts:122`(`toTerminalErrorPayload`), 소비처 3파일 | 강제 조치 불요. plan 후속에 이미 등재. |
| 6 | testing | `chat-channel.dispatcher.ts` 의 `toTerminalErrorPayload` 이중 재적용이 fixed-point(idempotent)임을 고정하는 캐너리 테스트가 없다(이월, 우선순위 낮음). | `terminal-error-payload.ts:107`(`redactTerminalError`), `chat-channel.dispatcher.ts` | 강제 조치 불요. |
| 7 | documentation | `plan/in-progress/eia-terminal-error-sanitize.md` "리뷰가 잡은 것" 절 제목이 여전히 `09_51_00` 라운드만 가리킨다 — `10_19_30`/`10_41_55`/`11_04_07` 은 체크리스트 옆 메모로만 존재, 별도 서사 절 미러링은 채택 안 됨(원래 soft 제안이었음). | `plan/in-progress/eia-terminal-error-sanitize.md` (체크리스트 직전 절 제목) | 조치 불요. 필요 시 절 제목을 "리뷰가 잡은 것(`09_51_00`~`11_04_07`)"로 일반화. |
| 8 | side_effect / documentation | `sanitize-error-message.ts` docstring 정정(`background-execution.processor` 가 결과를 WS 채널 `background:run:<id>` 에도 싣는다는 서술)이 실제 코드·회귀 테스트와 일치함을 직접 확인 — 새 부작용 아니고 기존 동작의 뒤늦은 정확한 문서화. | `sanitize-error-message.ts:1-24`, `background-execution.processor.ts:70,76` | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 4개 반환 경로 전부 마스킹 확인. Critical/Warning 없음, INFO 4건(길이 상한 부재, 잔여 갭 문서화, cancelled 경로 비대칭, 합성 테스트 시크릿). |
| requirement | LOW | 실측 검증(호출부 수·spec 인용·채널 격리) 전부 정확. WARNING 1건 = SPEC-DRIFT(§6.4/R17 미반영). |
| scope | NONE | 발견 없음. 핵심 코드 변경 4개 파일로 시종일관 좁게 유지, 이전 라운드 지적 전부 해소 재확인. |
| side_effect | LOW | `codebase/**` 이번 델타 0줄(직전 라운드 이후). 시그니처/mutation/DB write/네트워크 무변경 재확인. INFO 3건. |
| maintainability | LOW | 이번 델타는 docstring 정정 1건뿐, 순개선. INFO 1건(표+산문 중복 서사). |
| testing | NONE | 실측(jest 36/36 PASS)으로 회귀 없음 확인. 신규 Critical/Warning 없음, 이월 INFO 2건(통합 emit 테스트·idempotence 캐너리 부재). |
| documentation | NONE | 프롬프트의 모든 정량 주장 grep/소스 대조로 재검증, 전부 정확. INFO 1건(plan 서사 미러링 미채택, soft). |

## 발견 없는 에이전트

- scope — 발견사항 없음(NONE)
- testing — Critical/Warning 없음(이월 INFO 2건만, NONE)
- documentation — Critical/Warning 없음(INFO 1건만, NONE)

## 권장 조치사항

1. (project-planner 턴) `spec/5-system/14-external-interaction-api.md` §6.4 필드 표에 `error.message`/`error.details` egress 마스킹 캐비엇 추가 + R17 "표면 제약(보안)" 카탈로그에 5번째 불릿("`Execution.error`→종결 emit `error.message`/`details`: `redactTerminalError` 값-패턴 마스킹") 등재. `plan/in-progress/eia-terminal-error-sanitize.md` 후속 절에 이미 등재돼 있으므로 그 항목을 그대로 집행.
2. (선택, 비차단) 후속 PR 로 `toTerminalErrorPayload` 결과에 길이/크기 상한 검토, 자격증명 없는 연결 문자열/내부 호스트명까지 마스킹 범위 확대 검토(단, `deepRedactSecrets` 공유 SoT 승격 시 다른 소비자 회귀 테스트 선행 필요).
3. (선택, 비차단) 5개 emit 호출부 대상 통합 테스트(실제 WS/SSE/webhook payload 마스킹 검증) 및 `chat-channel.dispatcher.ts` 이중 재적용 idempotence 캐너리 테스트 추가 — plan 후속으로 이미 등재됨.
4. 이번 PR 자체는 push 게이트 통과 후 그대로 진행 가능. Critical 0, 실질 코드 결함 0.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — forced whitelist 전원 결과 확보됨(미이행 없음)
  - **제외**: 7명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(문자열 마스킹 유틸 확장) 와 무관 |
  | architecture | router 판단상 이번 diff 와 무관 |
  | dependency | router 판단상 이번 diff 와 무관(신규 의존성 없음) |
  | database | router 판단상 이번 diff 와 무관(DB write 없음) |
  | concurrency | router 판단상 이번 diff 와 무관(순수 함수, 동시성 표면 없음) |
  | api_contract | router 판단상 이번 diff 와 무관(인터페이스 시그니처 불변) |
  | user_guide_sync | router 판단상 이번 diff 와 무관(사용자 가이드 대상 아님) |