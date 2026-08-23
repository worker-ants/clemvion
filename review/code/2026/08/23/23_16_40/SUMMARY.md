# Code Review 통합 보고서

## 전체 위험도
**LOW** — SSE/webhook/chat-channel fanout `nodeOutput` allowlist 하드닝. CRITICAL 없음. WARNING 1건은 이미 CHANGELOG·spec 정정으로 문서화·수용된 하위 호환성 변경(제3자 webhook 구독자 감사만 세션 범위 밖)으로, 신규 차단 사유가 아니다. forced whitelist 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect / api_contract | SSE/webhook fanout `nodeOutput`(및 `buttonConfig.nodeOutput`) narrowing 이 이미 운영 중인 외부 응답 바디를 소급 축소하는 하위 호환성 변경. 알려진 두 소비처(위젯·chat-channel)는 실측으로 무손실 확인됐으나, 제3자 webhook 구독자는 검증 범위 밖이며 버전 분리·유예 기간 없이 전체 트래픽에 즉시 적용됨 | `codebase/backend/src/modules/websocket/websocket.service.ts:182-205`(`allowlistFanoutNodeOutput`), `:468-476`(`toFanoutEnvelope` 배선), `codebase/backend/src/shared/utils/node-output-allowlist.ts:66-92` | 조치 불요(코드 변경 막을 사유 아님) — 이미 CHANGELOG 자기반증형 정정 + spec §R17 flip 으로 문서화 완료. 후속으로 배포 전/후 webhook payload 키 분포 표본 감사가 가능해지면 수행 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | allowlist 가 이름 기반 매칭이라, wire 전용 8키(위젯 4 + chat-channel 4) 중 하나와 우연히 같은 이름의 내부 전용 필드가 향후 다른 경로로 `nodeOutput` 최상위에 붙으면 통과 가능 — 기존 설계 트레이드오프의 연장, 리터럴 테스트로 보강됨 | `codebase/backend/src/shared/utils/node-output-allowlist.ts:66-92` | 조치 불요. 향후 `nodeOutput` 신규 top-level 필드 추가 리뷰 시 allowlist 8키와 이름 충돌 여부 체크리스트화 |
| 2 | security | `nodeOutput.nodeType`(외부 노출)과 wire top-level `waitingNodeType`(내부 전용)이 동일 원본값을 담는 동명 필드 — 이번 diff 의 spec §R17 disambiguation 각주로 이미 해소 | `button-interaction.service.ts:404,579`, `spec/5-system/14-external-interaction-api.md` §R17 | 조치 불요(확인용) |
| 3 | performance | `allowlistNodeOutputKeys` 의 `.includes()` 선형 탐색(9→13 원소) — 직전 라운드에서 `Set` 전환을 검토했으나 `as const` 컴파일타임 타입 결속이 깨진다는 근거로 명시적 보류됨 | `codebase/backend/src/shared/utils/node-output-allowlist.ts:126,129` | 조치 불요. 원소 수가 수십 단위로 늘 때만 재검토 |
| 4 | performance | `allowlistFanoutNodeOutput` 이 top-level/`buttonConfig` 양쪽에서 동시에 키가 걸리면 shallow copy 최대 2회 — 이론적 비용, copy-on-change 로 대부분 이벤트는 신규 객체 생성 없음 | `codebase/backend/src/modules/websocket/websocket.service.ts:182-205` | 변경 불필요 |
| 5 | architecture | `shared/utils/` 계층이 도메인 타입(`NodeHandlerOutput`)에 컴파일타임 결속 — 하위 계층이 상위 도메인을 참조하는 구조적 긴장이나, 이번 PR 에서 재검토 후 무변경 결론(재배치 defer 사유 기록됨). `import type` 이라 런타임 순환 의존 없음 | `codebase/backend/src/shared/utils/node-output-allowlist.ts:1,107` | 조치 불요. 소비처 3번째 생기거나 역방향 런타임 의존 생기면 재론 |
| 6 | architecture | fanout 단일 chokepoint(`toFanoutEnvelope`)가 타입/캡슐화가 아닌 컨벤션(JSDoc)으로만 강제됨 — `broadcastToChannel` 이 여전히 public 이라 향후 신규 emit 경로가 `toFanoutEnvelope` 를 우회하면 이 PR 이 막는 정보노출이 재발 가능(기존 구조, 이번 diff 가 만든 문제 아님) | `codebase/backend/src/modules/websocket/websocket.service.ts` (`emitExecutionEvent`/`emitNodeEvent` vs `emitBackgroundRunEvent`/`emitNotificationEvent`) | 신규 external emit 메서드 추가 시 "`toFanoutEnvelope` 를 거치는가" 를 리뷰 체크리스트에 명시 |
| 7 | architecture / side_effect / api_contract | 공유 `NODE_OUTPUT_ALLOWED_KEYS` 가 REST(`getStatus`)·WS(`toFanoutEnvelope`) 두 표면의 노출 계약을 동시에 결정 — chat-channel 용으로 넓힌 4키가 REST 응답에도 자동 통과. 의도된 설계(표면별 미분리)이며 REST 캐너리로 의도 고정됨 | `codebase/backend/src/shared/utils/node-output-allowlist.ts:66-92`, `interaction.service.spec.ts:733-763` | 조치 불요(캐너리로 고정됨). 3번째 소비처 또는 표면별 정책 분기 필요 시 재검토 |
| 8 | requirement | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:119` 취소선 정정 중 markdown 볼드 마크 중첩 오류(`**wire-only ~~4키~~ **8키**가...**`) — 기능/spec 무관 서식 문제 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:119` | 안쪽 `**` 제거 또는 별도 span 분리. 차단 사유 아님 |
| 9 | maintainability | `allowlistFanoutNodeOutput` 내 "narrow 후 참조비교 병합" idiom 이 top-level/`buttonConfig` 두 곳에 반복, 후자는 3중 중첩 | `websocket.service.ts:182-205` | 3번째 소비 지점 생기면 공용 헬퍼(`applyIfNarrowed`) 검토 |
| 10 | maintainability | 로컬 변수명 축약(`top`/`bc`/`inner`/`next`/`narrowed`)이 두 서브트리를 오갈 때 문맥 파악 부담 | `websocket.service.ts:187,189,193,195,197` | 우선순위 낮음 — `topNodeOutput`/`nestedNodeOutput` 등으로 개선 가능 |
| 11 | maintainability | allowlist 그룹 설명이 JSDoc 표와 배열 인라인 주석 두 곳에 중복 — 손-동기화 지점 둘, 코드 주석이 "미러 갱신 필수"임을 명시해 drift 위험은 낮춤 | `node-output-allowlist.ts:44-48` ↔ `:66-92` | 그룹 4개 이상으로 늘면 표를 배열에서 파생 생성 검토 |
| 12 | testing | `emitNodeEvent` 경로는 신규 캐너리가 exercise 하지 않음 — `emitExecutionEvent` 경로로만 검증(둘 다 같은 private `toFanoutEnvelope` 공유, 실도메인상 `nodeOutput` 을 싣는 이벤트는 `emitExecutionEvent` 뿐이라 위험 낮음) | `websocket.service.ts:327,394,468` | `emitNodeEvent` 가 실제로 `nodeOutput` 을 싣는 케이스 생기면 캐너리 추가 |
| 13 | testing | `envelope.nodeOutput`/`buttonConfig` 명시적 `null` 방어 분기가 WS 통합 레벨에서 미검증(직전 라운드 defer 유지, `undefined` 는 간접 커버) | `websocket.service.ts:188,194` | 우선순위 낮음. `nodeOutput: null` 을 내는 실 경로 생기면 재개 |
| 14 | testing | 신규 캐너리 4건이 `describe('llmCalls strip — 외부 fanout 수신자 보호', …)` 블록 안에 위치해 블록명이 실제 검증 대상(allowlist)과 어긋남 | `websocket.service.spec.ts:604,762,803,848,882` | 다음 정리 라운드에서 별도 `describe` 로 이동 검토 |
| 15 | documentation | `allowlistFanoutNodeOutput` JSDoc 의 `{@link WebsocketService.toFanoutEnvelope}` 가 모듈-레벨 함수에서 클래스 프라이빗 메서드를 참조 — 링크 자체는 유효, 툴체인에 따라 렌더링 이슈 가능성 | `websocket.service.ts:177` | 문서 생성 파이프라인 도입 시 점검 |
| 16 | documentation | 직전 라운드(`22_51_46`) 리뷰 산출물의 인용 줄 번호가 코드 이동으로 이미 어긋남 — 아카이브 성격상 정상 | `review/code/2026/08/23/22_51_46/SUMMARY.md` | 조치 불요 |
| 17 | scope | 변경 파일 31개 중 21개가 이전 리뷰(`22_51_46`)·consistency-check(`22_26_33`) 산출물 — CLAUDE.md 표준 워크플로 증적, 범위 이탈 아님 | `review/code/2026/08/23/22_51_46/**`, `review/consistency/2026/08/23/22_26_33/**` | 조치 불요 |
| 18 | scope | allowlist 가 계획 초안(위젯 4키)보다 넓은 8키로 확장 — 착수 후 실측(chat-channel 렌더러가 flat legacy shape 을 읽음)에 따른 필수 보정, 테스트로 뒷받침 | `node-output-allowlist.ts:77-88` | 조치 불요 |
| 19 | user_guide_sync | `spec/5-system/14-external-interaction-api.md`, `6-websocket-protocol.md` 가 doc-sync-matrix `spec-major-change` 행에 glob 매칭되나, target(frontmatter 정합)은 diff 자체에서 이미 충족되고 별도 consistency-check(`22_26_33`, BLOCK:NO)로 해소 확인됨 | matrix rows[], spec/5-system/** | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | fail-closed 설계·프로토타입 오염 방어·단일 chokepoint 확인. 이름 기반 allowlist 구조적 한계는 기존 트레이드오프(INFO) |
| performance | NONE | hot path 비용 무시 가능 수준, `Set` 전환은 타입 결속 트레이드오프로 보류 유지 |
| architecture | NONE | chokepoint 패턴·copy-on-change·추상화 수준 견고. 구조적 긴장 3건은 기존 트레이드오프로 이미 재검토·기록됨 |
| requirement | NONE | 직전 라운드 WARNING 4건 전부 반영 확인, spec-코드 line-level 정합 |
| scope | NONE | 31개 파일 전부 단일 목표에 직접 연결, drive-by 변경 없음 |
| side_effect | LOW | 하위 호환성 소급 축소(WARNING, 이미 문서화·수용) + 공유 allowlist 표면 결합(INFO) |
| maintainability | LOW | narrow-and-merge idiom 반복·축약 변수명·JSDoc 이중관리 — 전부 defer 조건 미도래 |
| testing | LOW | `emitNodeEvent` 미검증·명시적 null 미검증·describe 블록명 불일치 — 전부 근거 있는 낮은 우선순위 |
| documentation | NONE | 직전 라운드 WARNING 전부 자기정정 관례로 처리 확인, spec 참조 실재 검증 |
| api_contract | LOW | 하위 호환성 축소(side_effect 와 동일 항목) 재확인, 필드명 교차오염 없음 확인 |
| user_guide_sync | NONE | frontend/channel-web-chat 미영향, 유저 가이드 갱신 대상 없음 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 INFO 이상 기록(대부분 조치 불요·확인용).

## 권장 조치사항

1. (선택) 후속 세션에서 배포 전/후 webhook payload 의 `nodeOutput` 키 분포 표본 감사 수행 — 제3자 구독자 영향 실측(WARNING #1, 코드 변경 자체를 막을 사유는 아님).
2. 신규 external emit 메서드 추가 시 "`toFanoutEnvelope` 를 거치는가"를 리뷰 체크리스트에 반영(architecture INFO #6).
3. 나머지 INFO 항목은 전부 재개 조건(3번째 소비처, 그룹 4개 이상, 실제 null 경로 등)이 명시돼 있어 즉시 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (11명)
  - **제외**: 표 (3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 누락 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 diff 범위(백엔드 로직 필터링 + 테스트 + 문서)에 신규/변경 외부 의존성 없음 |
  | database | 스키마/쿼리 변경 없음 |
  | concurrency | 동기 순수 함수 변환 로직으로 동시성 표면 없음 |