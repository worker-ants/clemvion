# Code Review 통합 보고서

## 전체 위험도
**LOW** — SSE/webhook/chat-channel fanout 의 `nodeOutput` 을 REST `getStatus` 와 동일한 fail-closed allowlist 로 전환한 보안 강화 변경. Critical 급 결함은 발견되지 않았으며, WARNING 4건은 모두 "이미 의도된 설계 위에 남은 확인/문서 갭"(REST 표면 확장 미검증, buttonConfig copy-on-change 통합 미검증, CHANGELOG 미갱신, breaking behavior change 공지 부재) 수준이다. forced reviewer 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 확보되어 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect / api_contract (중복 통합) | `NODE_OUTPUT_ALLOWED_KEYS` 가 이번 PR 로 REST(`getStatus`)와 WS(`toFanoutEnvelope`)에 처음 공유되면서, chat-channel 전용으로 추가한 4키(`payload`·`title`·`rendered`·`nodeType`, 특히 `payload`·`title`은 범용적인 이름)가 REST 공개 응답에도 그대로 열린다. 위젯·chat-channel 소비 경로는 실측 검증됐지만 REST 쪽에 이 4키 통과를 확인하는 canary 는 없다. | `codebase/backend/src/shared/utils/node-output-allowlist.ts:85-88`, `codebase/backend/src/modules/websocket/websocket.service.ts:9,182-205`, 소비처 `codebase/backend/src/modules/external-interaction/interaction.service.ts:392,431-435` | `interaction.service.spec.ts` 에 REST `getStatus` 응답에서 이 4키 통과 여부(또는 무해함)를 확인하는 canary 추가. 표면별 위험 허용치가 다르면 spec/plan 에 예외 근거 한 줄 남길 것 |
| 2 | testing | `allowlistFanoutNodeOutput` 의 두 배선 지점(top-level `nodeOutput` / `buttonConfig.nodeOutput`) 중 top-level 은 "무변경 시 참조 보존"(copy-on-change) 이 테스트로 고정돼 있으나, `buttonConfig.nodeOutput` 분기는 항상 "제거할 키가 있는" 픽스처만 써서 이 계약이 통합 레벨에서 미검증. `if (narrowed !== inner)` 가드를 제거해도 잡는 테스트가 없음(뮤테이션 표 M1~M4 에 이 조합 부재) | `codebase/backend/src/modules/websocket/websocket.service.ts:193-202` (특히 198행) | `buttonConfig.nodeOutput` 에 allowlist 밖 키가 없는 픽스처로 `next.buttonConfig === envelope.buttonConfig` 참조 동일성을 단언하는 캐너리 추가, 뮤테이션 표에 M5(buttonConfig 분기만 copy-on-change 제거)로 등재 |
| 3 | documentation | `CHANGELOG.md` Unreleased 항목이 "SSE·fanout 은 여전히 deny-list(잔여)" 라고 명시했는데, 이번 PR 이 정확히 그 잔여 gap 을 닫았음에도 `CHANGELOG.md` 는 diff 16개 파일에 포함되지 않아 그 서술이 이제 거짓이 됨. 직전 PR(#1205, `16f3e3625`)도 같은 성격의 CHANGELOG 누락을 문서 리뷰에서 지적받아 별도 fixup 커밋으로 고친 선례가 있음 | `CHANGELOG.md:24-25` (diff 밖) | Unreleased 항목에 "SSE/fanout 도 fail-closed 로 닫혔다" 절 추가하거나 기존 문장을 자기반증형 소정정 관례(취소선+정정)로 갱신 |
| 4 | api_contract | SSE/webhook fanout 의 `nodeOutput` narrowing 은 이미 운영 중인 외부 API 응답 바디를 소급 축소하는 하위 호환성 변경. `swagger.md` 상 스키마(열린 map) 자체는 위반하지 않지만, 버전 분리·Deprecation 공지·실 트래픽 기반 "현재 사용 중인 키" 감사 없이 즉시 전체 트래픽에 적용됨. 알려진 두 소비처(위젯, chat-channel) 밖의 제3자 webhook 구독자가 다른 키를 참조 중이었다면 조용히 사라질 위험 | `codebase/backend/src/modules/websocket/websocket.service.ts:182`, `codebase/backend/src/shared/utils/node-output-allowlist.ts:65`, `spec/5-system/14-external-interaction-api.md:1760` | 배포 전/후 webhook payload 로그에서 `nodeOutput` 최상위 키 분포 표본 감사, EIA changelog/공지 채널이 있다면 breaking behavior change 로 기록(코드 변경 자체를 막을 사유는 아님) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | allowlist 8키(위젯 4 + chat-channel 4)는 `NodeHandlerOutput` 타입 결속 밖이라 우연히 같은 이름의 내부 전용 필드가 생기면 통과할 수 있는 구조적 한계. 리터럴 테스트로 최대한 보강돼 있음 | `codebase/backend/src/shared/utils/node-output-allowlist.ts:85` | 조치 불요(설계 트레이드오프, 향후 리뷰 체크리스트에 참고) |
| 2 | security | `nodeOutput.nodeType`(외부 노출)과 `waitingNodeType`(내부 전용)이 동일 원본 값을 담는 동명 필드 — 이미 spec 각주로 disambiguation 반영됨 | `button-interaction.service.ts:404,579`, `form-interaction.service.ts:121,342` | 조치 완료 확인만 |
| 3 | performance | allowlist 멤버십 검사가 `.includes()` 선형 탐색(13개 원소) — 자매 코드 `WIRE_PRESERVED_FIELDS` 는 이미 `Set` 사용, 패턴 불일치 | `codebase/backend/src/shared/utils/node-output-allowlist.ts:125,128` | `Set` 파생 후 `.has()` 로 전환 검토(체감 영향 미미) |
| 4 | performance | 한 envelope 안에서 top-level·buttonConfig 양쪽이 동시에 걸리면 shallow copy 2회 발생(이론적 케이스) | `codebase/backend/src/modules/websocket/websocket.service.ts:182-205` | 변경 불필요 |
| 5 | requirement | `plan/in-progress/sse-nodeoutput-allowlist.md` frontmatter `spec_impact` 가 `6-websocket-protocol.md` 갱신을 누락 | `plan/in-progress/sse-nodeoutput-allowlist.md:7-8` | 후속 커밋에서 리스트에 추가 권장(차단 사유 아님) |
| 6 | scope | allowlist 확장이 초안 4키 → 실제 8키로 증가 — 착수 후 실측(chat-channel 렌더 파손 방지)에 따른 필수 보정으로 범위 이탈 아님 | `codebase/backend/src/shared/utils/node-output-allowlist.ts:77-88` | 조치 불요 |
| 7 | maintainability | `allowlistFanoutNodeOutput` 내 "narrow 후 참조 비교 병합" 패턴이 top-level/buttonConfig 두 곳에 반복(24줄, 3중 중첩) | `websocket.service.ts:182-205` | 3번째 소비 지점 생기면 공용 헬퍼로 통합 검토 |
| 8 | maintainability | 로컬 변수명(`top`/`bc`/`inner`/`next`/`narrowed`)이 두 블록에서 문맥 구분 없이 축약형 | `websocket.service.ts:187-197` | 우선순위 낮음, 참고용 |
| 9 | maintainability | allowlist 그룹 설명이 JSDoc 표와 배열 인라인 주석 두 곳에 미러링되어 손-동기화 지점 존재 | `node-output-allowlist.ts:43-51` ↔ `65-91` | 그룹 4개 이상으로 늘면 파생 생성/테스트 검증 고려 |
| 10 | testing | `envelope.nodeOutput`/`buttonConfig` 가 명시적 `null` 인 방어 분기가 테스트로 exercise 되지 않음 | `websocket.service.ts:188,194` | `null` 케이스 캐너리 1~2건 추가(우선순위 낮음) |
| 11 | documentation | `node-output-allowlist.ts:15` 예시 문장이 여전히 `getStatus` 만 언급, 상단 문단(소비처 둘)과 톤 불일치 | `node-output-allowlist.ts:15` | "`getStatus`·`toFanoutEnvelope` 는 둘 다 지난다"로 갱신하거나 문장 제거 |
| 12 | api_contract | REST/SSE allowlist 소스 통합으로 "출구 넷 중 하나만 닫힌다" 클래스의 불일치를 구조적으로 제거 — 긍정적 변경 | `websocket.service.ts:468`, `node-output-allowlist.ts:120` | 없음(양호) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | fail-closed·프로토타입 오염 방어·컴파일타임 결속·단일 chokepoint 확인, 신규 CRITICAL/WARNING 없음 |
| performance | NONE | hot path 설계 양호(copy-on-write), `.includes()` 선형 탐색은 INFO 수준 |
| requirement | NONE | 실측 1031건 GREEN, chokepoint·wire 4키 보존 실코드 대조 완료. spec_impact 누락만 INFO |
| scope | NONE | 16개 파일 전부 단일 목표 직결, drive-by 리팩토링 없음 |
| side_effect | LOW | 순수함수·copy-on-change 확인, REST 표면 확장이 canary 미검증(WARNING) |
| maintainability | LOW | 함수 길이/복잡도 양호, 반복 패턴·변수명·이중 문서 미러링은 INFO |
| testing | LOW | 캐너리·리터럴·뮤테이션 검증 충실, buttonConfig copy-on-change 통합 미검증(WARNING) |
| documentation | LOW | spec/plan/JSDoc 정합성 높음, CHANGELOG 미갱신(WARNING) |
| api_contract | LOW | REST/SSE allowlist 통합은 긍정적, breaking behavior change 공지·감사 부재(WARNING) |

## 발견 없는 에이전트

없음(9명 전원 최소 INFO 이상 기록, security/performance/requirement/scope 는 실질 결함 없이 NONE).

## 권장 조치사항
1. `buttonConfig.nodeOutput` 의 copy-on-change(무변경 시 참조 보존) 계약을 검증하는 캐너리 추가 — hot path 성능 계약이 회귀해도 현재는 아무 테스트도 잡지 못함(WARNING #2).
2. REST `getStatus` 응답에 신규 chat-channel 4키(`payload`·`title`·`rendered`·`nodeType`)가 실제로 어떻게 노출되는지 확인하는 canary 추가 — 의도치 않은 REST 표면 확장 여부를 실측으로 닫을 것(WARNING #1).
3. `CHANGELOG.md` Unreleased 항목을 갱신해 "SSE 는 여전히 deny-list" 서술을 정정 — 직전 PR 과 동일한 문서 갭 재발(WARNING #3).
4. 가능하면 최근 webhook payload 로그에서 `nodeOutput` 키 사용 분포를 표본 확인하고, breaking behavior change 로 기록할지 판단(WARNING #4).
5. INFO 항목들(변수명·이중 문서 미러링·`.includes()`→`Set` 등)은 우선순위 낮음 — 다음 관련 변경 시 함께 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (9명)
  - **제외**: 5명 (표 참조)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단상 이번 diff 는 아키텍처 구조 변경(모듈 경계·의존 방향) 해당 없음 |
  | dependency | 신규 패키지/의존성 변경 없음 |
  | database | DB 스키마·쿼리 변경 없음 |
  | concurrency | 동시성 프리미티브(락·트랜잭션·레이스) 변경 없음, 순수 in-memory 동기 변환 |
  | user_guide_sync | 사용자 가이드 문서 대상 변경 없음 |