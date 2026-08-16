# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. `execution.failed`(EIA §6.4) 의 `error.message`/`error.details` 를 WS/SSE/outbound webhook egress 직전 `deepRedactSecrets` 로 마스킹하는 순수 보안 하드닝이며, 8개 reviewer(강제 화이트리스트 7곳 전원 포함) 결과 전문을 모두 확보했다. 남은 항목은 문서 정합성(SPEC-DRIFT 1건 포함)과 테스트 커버리지 미세 갭뿐이다.

**강제(router_safety) whitelist 이행 상태**: `documentation, maintainability, requirement, scope, security, side_effect, testing` 7개 전원 결과 확보 확인(prompt 자체가 "forced 전원 결과 확보됨" 명시, 인라인 전문 7건 모두 실재하며 디스크에도 이미 존재). 라우터가 제외한 `performance, architecture, dependency, database, concurrency, user_guide_sync` 6개는 이번 diff(egress 마스킹 유틸 확장, DB/성능/동시성/아키텍처 무관)와 실질적으로 무관해 보이며 강제 목록에도 없어 정상 제외로 판단.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/14-external-interaction-api.md` §6.4 가 이번에 도입된 `execution.failed` `error.message`/`error.details` 의 egress 마스킹(`deepRedactSecrets`, wire 바이트 변화)을 문서화하지 않는다. 구현·테스트·plan·CHANGELOG 는 모두 정확·상호 일치하며, 이는 코드 결함이 아니라 spec 본문이 새 wire 동작을 아직 못 따라가는 case. 같은 문서의 R17(§`1371`)이 동일 SoT·동일 egress-only 원칙 도입 시 전용 Rationale 절을 붙인 선례가 있다 | `spec/5-system/14-external-interaction-api.md:770-806`(§6.4) vs 구현 `codebase/backend/src/shared/utils/terminal-error-payload.ts:47-104` | `project-planner` 위임 — §6.4 페이로드 정의 아래 R17 형식의 짧은 노트 추가: (1) message/details 가 자격증명 패턴으로 egress 마스킹됨, (2) code/nodeId 는 대상 아님, (3) 자격증명 없는 연결 문자열 등 잔여 갭(이미 `spec-sync-external-interaction-api-gaps.md` 등재) |
| 2 | 문서/계약 | 외부 API 정본 계약 문서(§6.4)가 이번 값(value) breaking change 를 반영하지 않고, `CHANGELOG.md`(저장소 내부용)에만 고지되어 있다 — 외부 통합사가 참조하는 것은 §6.4 이지 CHANGELOG 가 아님 | `spec/5-system/14-external-interaction-api.md` §6.4 vs `CHANGELOG.md:3-26` | 위 SPEC-DRIFT 항목과 동일 조치로 해소 가능(§6.4 캐비엇 추가) |
| 3 | 테스트 | `toTerminalErrorPayload` 4개 반환 분기 중 값 공간이 secret-free 인 2개(스칼라·non-object)는 `redactTerminalError()` 래핑 제거 뮤턴트로도 판별되지 않는다(저자 자신의 뮤테이션 검증 로그가 실제로는 문자열·객체 2곳만 검증했음을 인정). 그런데 같은 함수 docstring 은 "호출부 5곳 전부 구조적으로 마스킹된다"는 전수 보장을 주장해 검증 범위가 실제보다 넓게 읽힌다 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:121-133`(스칼라 분기), `:134-137`(non-object 분기) | docstring 에 "문자열·객체 분기만 뮤테이션 판별 검증됨" 으로 명시하거나 RESOLUTION/plan 서술을 좁혀 적기 |
| 4 | 문서 | 같은 파일의 근접한 JSDoc 두 곳에서 "5곳"이 서로 다른 함수(취소 이벤트 `emitCancellationEvent` vs `toTerminalErrorPayload` 자신)의 호출부 수를 가리켜 혼동 유발. 핵심 안전성 논거("호출부 전수를 거치므로 마스킹이 구조적으로 빠질 수 없다")와 직결되는 대목이라 리더가 두 5곳을 같은 집합으로 오독할 위험 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:8-9`(기존, 취소 이벤트) vs `:63`(신규, toTerminalErrorPayload) | CHANGELOG(`:11`, "4+1"로 명확히 분해)와 같은 방식으로 게이트 63 을 "호출부 5곳(EXECUTION_FAILED 4 + chat-channel.dispatcher 1)" 으로 분해하거나 "(취소 이벤트의 5곳과 무관)" 구절 추가 |
| 5 | 문서 | 이번 PR 이 새로 작성한 `CHANGELOG.md`·plan 문서 2곳이 "EIA outbound webhook"의 spec 근거로 잘못된 섹션 번호(§3.3 = 실제로는 "인증" 섹션)를 검증 없이 그대로 복제. 실제 outbound webhook 요구사항은 §3.1(EIA-NX-02). 기존 `CHANGELOG.md:45`(#1174, diff 밖)에 이미 있던 오류를 이번 PR 이 새로 2곳에 전파했고, 같은 세션의 `api_contract.md` 도 동일 오표기를 인용해 확산 중 | `CHANGELOG.md:6`, `plan/in-progress/eia-terminal-error-sanitize.md:27`(신규 2곳) / 기존 `CHANGELOG.md:45` | 세 곳 모두 "§3.3"→"§3.1"(EIA-NX-02) 또는 "§6"으로 정정. 기존 `:45` 는 이번 PR 의무 아니나 재발 방지 위해 함께 정정 권장 |
| 6 | 유지보수성 | 신규 `describe` 블록의 두 단언(`toTerminalErrorPayload(null/undefined) → null`)이 기존 블록의 단언과 완전 동일(바이트 단위) — 의도는 RESOLUTION.md(W5)에 근거 있으나, 향후 로직 변경 시 한쪽만 갱신되고 다른 쪽이 stale 로 남을 drift 위험 | `terminal-error-payload.spec.ts:193-196`(신규) vs `:83-87`(기존) | 신규 블록에 "레거시 회귀와 동일 — 마스킹이 이 경로를 건드리지 않음을 확인" 주석 추가하거나 완전 동일 단언 제거하고 상단 참조만 남기기(강제 아님) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 자격증명 없는 연결 문자열·내부 호스트명·사설 IP·스택 프래그먼트는 여전히 마스킹되지 않는다(선존 갭, 이번 PR 이 악화시키지 않고 오히려 자격증명 범위에서 좁힘). `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 실측 근거·blast-radius 판단과 함께 이미 등재됨 | `terminal-error-payload.ts:96-104`(redactTerminalError), 근거 JSDoc `:69-87` | 후속 PR 에서 shared SoT 승격 시 `deepRedactSecrets` 의 다른 소비자(conversation-thread, ai_message, EIA nodeOutput) 전수 회귀 테스트 선행 |
| 2 | 보안 | `toTerminalErrorPayload`/`redactTerminalError` 출력에 길이 상한 없음(형제 유틸은 500자 절단하는데 이 경로는 마스킹만 함) — secret 노출 문제는 아니고 과대 payload 전달 가능성 | `terminal-error-payload.ts:111-150` | 조치 불요, 후속 검토 권장 |
| 3 | 부작용 | `chat-channel.dispatcher.ts:551`(diff 밖 기존 코드)이 이미 마스킹된 payload 를 재정규화 경로에서 `toTerminalErrorPayload` 로 다시 통과시켜 마스킹이 이중 실행됨(idempotent 라 관측 가능한 동작 변화 없음) | `terminal-error-payload.ts` redactTerminalError(96-104)/object 분기(140-149), 소비처 `chat-channel.dispatcher.ts:545-557` | 조치 불요. `SECRET_LEAK_PATTERNS` 가 향후 non-idempotent 하게 확장될 경우를 대비해 주석으로 남겨두면 유용 |
| 4 | 부작용 | 이전 라운드 WARNING("워크플로우 에디터가 마스킹값을 신뢰 채널에 렌더링") 을 프런트엔드 소스까지 추적 검증한 결과 현재 그 값을 렌더링하는 컴포넌트가 없음(dead store write) — WARNING→INFO 하향 근거 확보 | `use-execution-events.ts:264-276`, `execution-store.ts:736-746`, `run-results-drawer.tsx:254`(필터링만), `custom-node.tsx:506-510`(아이콘만) | 조치 불요. 향후 spec §3.5 배너를 실제 구현할 때 마스킹값/원문 중 무엇을 보여줄지 명시적으로 결정 필요 |
| 5 | 부작용 | `execution.cancelled` 의 `error` 는 여전히 이 마스킹 초크포인트를 완전히 우회(비대칭). 현재 raw 예외 메시지가 실리는 경로가 없어 안전(고정 코드·sentinel 뿐), plan 감사로 이미 확인됨 | `execution-engine.service.ts:1119`, 소비처 `chat-channel.dispatcher.ts:577-581` | 조치 불요, 향후 취소 사유 상세화 리팩터 시 캐너리로 인지 |
| 6 | 테스트 | `details: null`(명시적 null) 입력 경로가 여전히 미테스트(전 라운드부터 이월) | `terminal-error-payload.ts:100-103` | `toTerminalErrorPayload({message:'x', details:null})` 케이스 1개 추가 |
| 7 | 테스트 | JSDoc 이 표로 명시한 잔여 마스킹 갭(자격증명 없는 연결 문자열 등)을 고정하는 캐너리 테스트 없음 | `terminal-error-payload.ts:71-78`(위협 실측표) | `redactSecrets('postgres://db.internal:5432/prod')` 무변화 통과를 고정하는 부정 케이스 1개 추가 |
| 8 | API 계약 | `details` 필드의 키-이름 기반 wholesale 마스킹(`CREDENTIAL_KEY_PATTERN`)이 구조적 필드에 대해 message(prose)보다 넓은 리스크 표면 — 현재 실제 write 지점 3곳 모두 details 미사용이라 무영향 | `terminal-error-payload.ts:96-104` → `sanitize-error-message.ts` CREDENTIAL_KEY_PATTERN | 조치 불요, 향후 details 를 채우는 emit 경로 추가 시 인지 |
| 9 | 유지보수성 | 같은 파일 안 optional-키 생략 관용구가 두 스타일(명령형 if vs 조건부 spread) 혼재 — 전 라운드에서 이미 검토·기각(RESOLUTION W6) | `terminal-error-payload.ts:148` vs `:100-102` | 조치 불요(재검토 완료 사안) |
| 10 | 유지보수성 | `deepRedactSecrets` 반환값(`unknown`)을 `string` 으로 무검증 캐스트 | `terminal-error-payload.ts:99` | 캐스트 옆 불변식 설명 주석 권장(강제 아님) |
| 11 | 유지보수성 | 동일 basename `sanitize-error-message.ts` 가 두 디렉터리에 존재(기존 구조) | `modules/execution-engine/` vs `shared/utils/` | 조치 불요, 향후 대규모 리팩터 시 개명 고려 |
| 12 | 유지보수성 | 신규 함수 JSDoc(~48줄) 대비 본문(8줄) 비율이 매우 높음 — 저장소 컨벤션 부합, 반복 리뷰 대응 근거 축적 목적 | `terminal-error-payload.ts:47-104` | 조치 불요 |
| 13 | 문서 | 이전 consistency 라운드(`rationale_continuity`)의 "에디터가 error.message 를 렌더링한다"는 전제와 이번 PR 의 W3 해소 답변("REST 에서 온다")이 사실관계가 다른데 그 불일치가 plan 에 명시적으로 정리되지 않음 | `plan/in-progress/eia-terminal-error-sanitize.md` W3 문단 | plan 에 "§3.5는 데이터 출처를 규정하지 않으며 REST 경로는 마스킹 대상 아님(원문 유지, R17 부합)" 한 문장 추가 권장(저비용) |
| 14 | 요구사항 | `chat-channel.dispatcher.ts:551` 이 이미 마스킹된 error 에 `toTerminalErrorPayload` 를 재적용(idempotent, 새 결함 아님) | `chat-channel.dispatcher.ts:551` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | Critical/Warning 없음. `code`/`nodeId` 값 공간이 닫혀 있다는 설계 근거를 소스 레벨로 직접 검증해 정확함 확인. 자격증명 없는 연결 문자열 등 잔여 갭은 INFO(선존, 이미 등재) |
| requirement | LOW | 5개 호출부·raw write 3곳 전수 확인, 테스트 24/24 실행 확인. 유일 실질 발견은 SPEC-DRIFT(§6.4 wire 변화 미문서화) |
| scope | NONE | 이전 라운드 유일 WARNING(JSDoc 궤도 이탈) 해소 확인. 핵심 코드 변경 4개 파일로 좁게 유지, 스코프 확장 없음 |
| side_effect | LOW | 시그니처/DB/mutation/순환참조 전부 불변 확인. 에디터 렌더링 우려는 dead write 로 확인돼 WARNING→INFO 하향. 이중 마스킹 실행 신규 관측(idempotent, INFO) |
| maintainability | LOW | 함수 복잡도 낮음, 전 라운드 WARNING 2건(JSDoc 궤도이탈, 판별력 없는 테스트) 반영 확인. 남은 것은 이미 검토·기각된 경미한 흠 |
| testing | LOW | 전 라운드 WARNING 2건 반영 확인(adversarial 값, JSON 재직렬화 고정). 신규: 4개 반환분기 중 2개는 뮤테이션 판별 불가(WARNING). details:null·잔여 갭 캐너리 미테스트(INFO 2건) |
| documentation | LOW | 대부분 정정 확인. 신규 발견 2건 WARNING(동일 파일 내 "5곳" 혼동, §3.3 오표기 확산) |
| api_contract | LOW | 스키마 불변, 채널 간 일관성 확인. WARNING 1건(§6.4 정본 문서 미갱신, CHANGELOG 에만 고지) |

## 발견 없는 에이전트

없음(scope 는 발견사항 없음이나 위험도 NONE 으로 별도 표기, 위 요약표 참고)

## 권장 조치사항

1. `spec/5-system/14-external-interaction-api.md` §6.4 에 이번 egress 마스킹 캐비엇 추가 — SPEC-DRIFT(WARNING #1) 와 API 계약 WARNING(#2)을 동시에 해소. `project-planner` 위임 대상.
2. `CHANGELOG.md:6`·`plan/in-progress/eia-terminal-error-sanitize.md:27`(및 기존 `CHANGELOG.md:45`)의 "§3.3" outbound webhook 오표기를 "§3.1"(EIA-NX-02)로 정정(WARNING #5).
3. `terminal-error-payload.ts:63` 의 "호출부 5곳" JSDoc 을 CHANGELOG 방식으로 분해하거나 취소 이벤트의 "5곳"과 무관함을 명시(WARNING #4).
4. testing WARNING #3(뮤테이션 판별 불가 2개 분기) — docstring 의 전수 보장 서술을 검증 범위에 맞게 좁히거나 주석 추가.
5. (저비용, 강제 아님) 신규 테스트 블록의 완전 동일 단언에 의도 주석 추가(WARNING #6), `details: null` 케이스 및 잔여 갭 캐너리 테스트 추가(INFO #6, #7).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 이번 diff 는 문자열 마스킹 유틸(경량 regex 패스) 확장으로 성능 영향 범위 밖 |
  | architecture | 신규 함수 1개를 기존 egress 초크포인트에 배선하는 수준, 아키텍처 변경 없음 |
  | dependency | 신규 의존성 추가/변경 없음 |
  | database | DB write 경로 무변경(전 reviewer 가 공통 확인) |
  | concurrency | 동시성 관련 상태 변경 없음(순수 함수 마스킹 로직) |
  | user_guide_sync | 최종 사용자 가시 UI/가이드 변경 없음(내부 에디터는 렌더링 소비자 부재로 확인됨) |