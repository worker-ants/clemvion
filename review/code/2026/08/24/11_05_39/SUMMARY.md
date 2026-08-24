# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. 9개 reviewer(강제 화이트리스트 7명 포함) 전원 결과 확보, 누락 없음. `websocket.service.ts` 의 `envelope.output` fail-closed allowlist 확장은 순수 방어 강화(egress narrowing)이며 새 취약점·아키텍처 위반·회귀는 발견되지 않았다. 남은 WARNING 은 전부 코드 동작이 아닌 문서 정확성(리팩터 후 stale JSDoc, breaking-change 고지 범위, 정량 서술 오류) 문제다.

> **강제 화이트리스트(router_safety) 확인**: `documentation, maintainability, requirement, scope, security, side_effect, testing` 7명 전원 forced 대상이며, 7명 모두 결과 전문이 인라인으로 확보되어 있다(누락 없음). "forced 인데 결과 없음" 케이스는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성/문서화 | 함수 분리 리팩터(`allowlistFanoutNodeOutput` → `narrowTopLevelNodeOutput` 헬퍼 추출 + `output` 키 신규 처리) 후 JSDoc 이 옛 함수(현재는 orchestrator) 범위 그대로 남아, 새 파라미터(`key: 'nodeOutput' \| 'output'`)·`buttonConfig.nodeOutput` 미처리 사실을 반영하지 못함. 정작 세 자리를 조립하는 실제 chokepoint `allowlistFanoutNodeOutput` 은 함수 레벨 JSDoc 자체가 없음. 이 파일은 몇 줄 위에 정확히 같은 클래스의 과거 결함(`14_55_29` maintainability W4)을 라인 주석으로 남겨둔 이력이 있어 재발로 볼 수 있음 | `codebase/backend/src/modules/websocket/websocket.service.ts:171`(JSDoc)~`190`(`narrowTopLevelNodeOutput`), `:192`~`214`(`allowlistFanoutNodeOutput`) | JSDoc 을 둘로 분리 — `allowlistFanoutNodeOutput` 위에 "세 자리(`nodeOutput`/`output`/`buttonConfig.nodeOutput`) 조립" 설명, `narrowTopLevelNodeOutput` 위에 "top-level 한 키만 좁히는 제네릭 헬퍼, 호출자가 두 키에 각각 호출" 설명 (maintainability·documentation·requirement 공통 지적) |
| 2 | API계약/문서화 | CHANGELOG 의 2026-08-24 정정 문단이 "이전 유예 근거가 틀렸다"는 기술적 반증만 서술하고, `execution.node.completed`/`.failed` 의 `envelope.output` narrowing 이 **외부 SSE/webhook 수신자에게는 동작 변경**이라는 고지를 담지 않음 — 형제 표면(`#1208`, `nodeOutput`/`waiting_for_input`)의 CHANGELOG 항목은 이 고지를 명시했던 것과 비대칭. `spec/5-system/14-external-interaction-api.md` §R17, `plan/in-progress/node-output-envelope.md` 에도 동일하게 "외부 수신자"/"breaking"/"webhook" 문구 없음(grep 무매치) | `CHANGELOG.md:30-38`(신규 정정 블록, 비교 대상 `CHANGELOG.md:41-46`) | "과거 응답에 `_retryState` 등 목록 밖 필드가 이미 노출됐을 수 있다"는 breaking-change 문장을 CHANGELOG 에 추가하고, 동일 문장을 EIA §R17 정정 블록에도 반영 (documentation·api_contract 공통 지적) |
| 3 | 요구사항 정확성 | "emit 5곳" 정량 서술이 실제와 다름 — `grep`으로 직접 세면 `execution-engine` 2 · `form-interaction` 1 · `button-interaction` 1 · `ai-turn-orchestrator` **2**(FAILED/COMPLETED 분기 각각) = 총 **6곳**인데 세 위치 모두 5곳으로 서술 | `codebase/backend/src/modules/websocket/websocket.service.ts:475`(JSDoc), `websocket.service.spec.ts:913`(JSDoc), `spec/5-system/14-external-interaction-api.md` §R17 정정 블록 | 세 곳 모두 "emit 5곳"→"emit 6곳", breakdown 을 "`execution-engine` 2 · `form-interaction` 1 · `button-interaction` 1 · `ai-turn-orchestrator` 2"로 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `envelope.output` allowlist 확장은 정보 노출을 줄이는 방향의 순수 하드닝 — 새 인젝션/인가/암호화 취약점 없음. 값 레벨 credential 마스킹(`maskWireEnvelope`)은 이 필터보다 앞 단계에서 이미 적용되어 두 방어선이 순서상 올바르게 겹침. 내부 WS(에디터) 경로는 `toFanoutEnvelope` 호출 이전에 이미 분기돼 영향 없음(캐너리로 고정) | `websocket.service.ts:182-214`, `:317`, `:328` | 조치 불요 |
| 2 | 아키텍처 | `buttonConfig.nodeOutput` 자리는 여전히 별도 인라인 중복으로 남아 `narrowTopLevelNodeOutput` 로 통일되지 않음(top-level 두 자리만 일반화됨) | `websocket.service.ts:192-211`(`allowlistFanoutNodeOutput`) | 지금 반영 불요 — 향후 4번째 nested 자리가 생기면 경로 기반 헬퍼로 일반화 검토 |
| 3 | 아키텍처/명명 | wire 레벨 `output`(envelope 최상위, `NodeHandlerOutput` 래퍼)과 `NodeHandlerOutput.output`(도메인 값)이 같은 식별자를 다른 레벨에서 공유해 추상화 경계가 흐림 | `websocket.service.ts:199`, `NodeHandlerOutput` 타입 정의 | 이미 같은 세션 consistency-check WARNING 으로 `spec/5-system/6-websocket-protocol.md` §4.1 표가 래퍼/도메인값 구분으로 정정 처리됨 — 추가 조치 불요 |
| 4 | 스코프/절차 | 코드 변경 + API 계약 spec(EIA/WS) 수정("(planner 턴)" 처리) + 자기-반증형 소정정(`conversation-thread.md`) 세 종류 권한 역할이 한 커밋 세트(19개 파일)에 혼재 | `plan/in-progress/node-output-envelope.md` frontmatter, `spec/5-system/14-external-interaction-api.md:1748-1802`, `spec/5-system/6-websocket-protocol.md:187-188,425` | 이미 `/consistency-check --impl-prep`(`review/consistency/2026/08/24/10_44_28`)가 CRITICAL 로 다루고 RESOLUTION 으로 처분됨 — 이 라운드에서 추가 조치 불요. 향후 유사 작업은 "(planner 턴)" 항목을 별도 커밋으로 분리 권장 |
| 5 | 부작용 | `nodeOutputCache` flat 폴백(이번 PR 범위 밖, 기존 코드)이 발현하면 새 필터가 `parameters`/`items` 등을 에러·로그 없이 조용히 떨어뜨릴 수 있음 — 캐너리로 동작은 고정됐으나 프로덕션 발동 여부를 감지할 계측은 없음 | `ai-turn-orchestrator.service.ts:1449-1458`(폴백), `websocket.service.spec.ts:976`(캐너리) | 후속 작업 시 `allowlistNodeOutputKeys` 가 실제로 키를 떨어뜨렸을 때 저수준 debug 로그 추가 — "재개 신호" 자동 포착 |
| 6 | 유지보수성 | 동일 서사("유예 근거 반증 + 실 DB 조회 결과")가 코드 JSDoc·테스트 JSDoc·CHANGELOG·plan 등 5곳 이상에 유사하지만 미묘하게 다른 문장으로 중복 서술 — drift 위험 | `websocket.service.ts:472-483`, `websocket.service.spec.ts:906-923`, `CHANGELOG.md`, `plan/complete/sse-nodeoutput-allowlist.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` | 다음에 이 결정이 다시 바뀌면 코드/테스트 JSDoc 은 plan 문서를 가리키는 짧은 참조로 축약 검토 |
| 7 | 유지보수성 | 신규 캐너리 테스트 2건이 주제와 무관한 `describe('llmCalls strip …')` 블록 안에 위치 — 이미 트래커에 등재된 기존 describe 배치 이슈의 연장 | `websocket.service.spec.ts:925`, `:976` (describe 시작 `:604`) | 이번 PR 에서 필수 아님 — 기존 트래커 항목 처리 시 이번에 추가된 2건도 함께 이동 명시 |
| 8 | 테스팅 | 신규 `output` 경로가 chat-channel 4키(`rendered`/`payload`/`title`/`nodeType`) 보존을 직접 단언하지 않고 `nodeOutput` 경로 검증에만 의존(같은 헬퍼 공유라 논리적으로는 보장되나 직접 증거는 없음) | `websocket.service.spec.ts:882`(기존 `it.each`) vs `:925`(신규 `output` 캐너리) | `it.each` 4키 캐너리를 `output`/`nodeOutput` 두 경로에 파라미터화하거나 `output` 키 버전 테스트 추가 |
| 9 | 테스팅 | `WebsocketService`(allowlist 필터링)와 `ChatChannelDispatcher`(소비)를 잇는 통합 테스트가 구조적으로 없음(이번 PR 이 만든 갭 아님, 기존 아키텍처) | `chat-channel.dispatcher.spec.ts:648-696`(손-조립 fixture 로 `toChatChannelEvent` 직접 호출) | 향후 `emitNodeEvent` → `toChatChannelEvent` 를 잇는 e2e/통합 캐너리 검토 |
| 10 | 문서화 | `spec/5-system/6-websocket-protocol.md` §4.1 표에 `.failed` 행 `output` 열 신규 추가, `output` 래퍼/도메인값 명명 정정 — 작업 범위를 살짝 넘지만 같은 자리 자매 오류를 함께 처리(이 저장소 기존 관례와 일치) | `spec/5-system/6-websocket-protocol.md:187-188` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | egress 마스킹 확장은 새 취약점 없는 순수 하드닝. 잔여 flat 폴백은 이미 캐너리·트래커로 처분됨 |
| architecture | NONE | chokepoint 단일화·DIP·copy-on-change 불변식 보존. `buttonConfig` 잔여 중복·명명 재사용은 INFO |
| requirement | LOW | "emit 5곳"→실제 6곳 오류, `narrowTopLevelNodeOutput` stale JSDoc (WARNING 2건). 독립 재검증(테스트 84건 통과, tsc 클린) 결과 실질 로직은 정확 |
| scope | NONE | 요청 범위 밖 리팩토링/기능 확장/무관 파일 변경 없음. 절차적 권한 쟁점은 이미 consistency-check 로 처분됨 |
| side_effect | LOW | wire 계약 좁힘은 의도된 변경이며 코드 대조로 다른 `output` 의미 오염 없음 확인. flat 폴백 미계측만 INFO |
| maintainability | LOW | stale JSDoc(WARNING), 서사 중복·describe 배치·이중 타입단언(INFO). 전반적으로 DRY 개선(헬퍼 추출)된 양호한 리팩터 |
| testing | LOW | 58/58 GREEN 직접 실행 확인, 대조군·뮤테이션 자기검증 우수. output 경로 직접 커버리지·통합테스트 갭은 INFO |
| documentation | LOW | stale JSDoc + CHANGELOG breaking-change 고지 누락(WARNING 2건). `toFanoutEnvelope` JSDoc·3곳 spec 정정은 모범적 |
| api_contract | LOW | CHANGELOG 고지 범위(WARNING). 하위호환성 리스크는 e2e 285건+실DB조회로 낮게 관리됨 확인 |

## 발견 없는 에이전트

없음 — 9개 reviewer 모두 최소 1건 이상의 발견(대부분 INFO)을 보고했다. 다만 `security`·`architecture`·`scope` 세 에이전트는 Critical/Warning 없이 위험도 NONE 을 판정했다.

## 권장 조치사항

1. **[WARNING #1]** `narrowTopLevelNodeOutput`/`allowlistFanoutNodeOutput` JSDoc 재작성 — 헬퍼 고유 계약과 조립부 chokepoint 설명을 분리.
2. **[WARNING #2]** CHANGELOG(및 EIA §R17)에 `execution.node.completed`/`.failed` `envelope.output` narrowing 에 대한 외부 SSE/webhook breaking-change 고지 문장 추가.
3. **[WARNING #3]** "emit 5곳" → "emit 6곳"으로 세 위치(코드 JSDoc 2곳 + spec 1곳) 동시 정정.
4. (낮은 우선순위) INFO #8 — `output` 경로에 대한 chat-channel 4키 보존 직접 단언 테스트 추가 검토.
5. (낮은 우선순위) INFO #5 — `nodeOutputCache` flat 폴백 발동 시 debug 로그 계측 추가 검토(후속 세션).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 확인됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(이번 diff 는 성능 특성에 영향 없는 in-memory 필터 배선으로 스코프 밖 판정) |
  | dependency | router 판단(패키지 의존성 변경 없음) |
  | database | router 판단(DB 스키마/쿼리 변경 없음 — 인용된 SQL 은 수동 진단 쿼리) |
  | concurrency | router 판단(동시성 제어 로직 변경 없음) |
  | user_guide_sync | router 판단(사용자 가이드 문서 대상 변경 없음) |