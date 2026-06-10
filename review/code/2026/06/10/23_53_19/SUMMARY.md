# Code Review 통합 보고서

## 전체 위험도
**LOW** — 주요 버그 수정(V-01/V-07/V-15) 구현은 완성도가 높고 보안 이슈는 없음. spec 다이어그램 미갱신 1건과 테스트 커버리지 공백(7d/3d 임계 알림 면제 검증 누락)이 LOW 위험도로 잔존.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope / Spec 정합 | `spec/data-flow/5-integration.md` §1.4 mermaid sequenceDiagram 내 `status_reason=NULL` 표기가 잔존. V-07 변경(0d 격하 시 `statusReason='token_expired'`)이 §1.4 표·의사코드에는 반영됐으나 같은 섹션 다이어그램에만 누락됨 | `spec/data-flow/5-integration.md` — §1.4 sequenceDiagram `Scan->>PG: UPDATE integration SET status='expired', status_reason=NULL` 라인 | 해당 라인을 `status_reason='token_expired'` 로 갱신하거나 다이어그램 노트에 "(token_expired — refresh_token 없는 provider)" 주석 추가 |
| 2 | Testing | refresh-capable provider(cafe24·makeshop)가 7d/3d 임계에서도 알림이 면제되는지 검증하는 테스트 케이스 없음. 0d 케이스만 커버됨 | `integration-expiry-scanner.service.spec.ts` | `cafe24 + refresh_token, tokenExpiresAt=now+5d` 및 `makeshop + refresh_token, tokenExpiresAt=now+2d` 케이스에서 `notificationsService.createMany` 호출 목록에 해당 `resourceId` 미포함 검증 추가 |
| 3 | Side Effect | refresh-capable provider에 대해 7d/3d claim 레코드가 전혀 생성되지 않음. 의도된 §11.2 동작이나 향후 알림 재활성화 시 dedup 레코드 부재 회귀 위험 있음. 운영 진단 단서도 제거됨 | `integration-expiry-scanner.service.ts` — `run()` 내 `isRefreshCapable` → `continue` 분기 | 코드 주석에 "refresh-capable 은 dedup claim 을 생성하지 않음(§11.2 의도적 설계)" 을 명시해 미래 수정 시 회귀 방지 |
| 4 | Maintainability | 알림 부재 검증 패턴(`createMany.mock.calls.flat().flat()`)과 `savedExpired` 검증 패턴이 3곳에 각각 복사·붙여넣기됨. 이중 `.flat()` 패턴은 "createMany 미호출 시도 통과"하는 약한 assertion | `integration-expiry-scanner.service.spec.ts` — `notifs`, `notifs3`, `mkNotifs`, `mk2Notifs` 관련 블록 | `getNotifResourceIds(svc)` 및 `hasSavedExpired(repo)` 헬퍼 함수 추출해 재사용. assertion 은 `toHaveBeenCalledTimes` + `mock.calls[0][0]` 형태로 강화 |
| 5 | Documentation | `system-status.constants.ts` 큐 추가 안내 주석이 e2e `EXPECTED_QUEUE_NAMES` 하드코딩 목록 갱신 의무를 언급하지 않아 다음 기여자가 e2e 갱신을 빠뜨릴 여지 있음 | `system-status.constants.ts` — `MONITORED_QUEUES` 바로 위 주석 | 주석에 "e2e `test/system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES` 도 함께 갱신할 것" 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 테스트 픽스처에 평문 형태의 더미 자격증명 사용(`access_token: 'a'` 등). 실제 시크릿 아님 | `integration-expiry-scanner.service.spec.ts` | 현 상태 유지. CI secret scanning 룰셋이 실제 토큰 패턴 커버 여부 별도 점검 |
| 2 | Security | credentials JSON 컬럼에서 `refresh_token` 존재 여부만 확인하고 값을 큐 payload/로그에 포함하지 않는 올바른 설계 | `integration-expiry-scanner.service.ts` — `isRefreshCapable`, `cafe24RefreshQueue.add` | credentials 컬럼 DB/앱 레벨 암호화 여부 별도 확인 권장 (이번 diff 밖) |
| 3 | Side Effect | 기존 `status_reason=null` 만료 레코드와 신규 `status_reason='token_expired'` 레코드 혼재. 소비자 레이어가 양쪽 처리 필요 | `integration-expiry-scanner.service.ts` — `integration.statusReason = 'token_expired'` | `null` → `'token_expired'` 마이그레이션 스크립트 또는 API 응답 레이어 정규화 검토 |
| 4 | Side Effect | `MONITORED_QUEUES`에 `MAKESHOP_REFRESH_QUEUE` 추가 시 상위 모듈 `BullModule.registerQueue` 등록 여부에 따라 런타임 에러 가능성 | `system-status.constants.ts` | `makeshop-token-refresh.module.ts` 또는 상위 모듈에서 해당 큐 등록 선행 여부 확인 |
| 5 | Requirement | spec §11.2 알림 표 "재인증 실패(Reauthorization failed)" 행이 스캐너 코드에서 처리되지 않고 어느 경로에서 발사되는지 spec 본문에 명시 없음 | `spec/2-navigation/4-integration.md §11.2` | 해당 알림 발사 경로를 spec에 명시. `project-planner` 위임 권장 |
| 6 | Maintainability | `isRefreshCapable`의 `'cafe24'`/`'makeshop'` 하드코딩과 `run()` 내 `integration.serviceType === 'cafe24'` 분기가 분리되어 신규 provider 추가 시 2곳 수정 필요 | `integration-expiry-scanner.service.ts` | `CAFE24_ENQUEUE_CAPABLE = new Set(['cafe24'])` 상수 또는 `isCafe24EnqueueCapable(integration)` 술어 추가 고려 |
| 7 | Maintainability | e2e 테스트 설명 문자열에 큐 개수 `14`가 하드코딩됨. 큐 추가 시 설명 문자열도 수동 갱신 필요 | `system-status.e2e-spec.ts` | `` `인증 시 ${EXPECTED_QUEUE_NAMES.length}개 큐의 집계 상태를 반환한다` `` 형태로 변경 |
| 8 | Testing | `integration-status-reason.ts`의 `normalizeStatusReason` 에 전용 단위 테스트 없음. `token_expired` 슬러그 신규 추가 반영 안됨 | `integration-status-reason.ts` | `integration-status-reason.spec.ts` 신설: `normalizeStatusReason('token_expired')`, `normalizeStatusReason(null)`, `normalizeStatusReason('unknown_garbage')` 3~4개 케이스 추가 |
| 9 | Testing | `demotes makeshop missing refresh_token at 0d` 테스트에서 `claimThreshold` 선행 검증(`dispatchRepo.__insertBuilder.values` 호출 확인) 없음 | `integration-expiry-scanner.service.spec.ts` 라인 435–476 | `expect(dispatchRepo.__insertBuilder.values).toHaveBeenCalledWith(expect.objectContaining({ integrationId: 'makeshop-int-2', threshold: '0d' }))` 추가 |
| 10 | Scope | `spec/1-data-model.md` `status_reason` 행 말미 네임스페이스 명료화 NOTE는 버그 수정 PR 필수 범위를 소폭 초과하는 문서 친절도 추가. 동작에는 영향 없음 | `spec/1-data-model.md` | 허용 가능. 분리 원하면 별도 docs PR |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 이슈 없음. credentials는 큐 payload/로그에 미포함. 테스트 더미 자격증명은 정상 패턴 |
| requirement | NONE | V-01/V-07/V-15 세 fix 모두 요구사항 완전 충족. spec 본문과 line-level 일치 |
| scope | LOW | mermaid 다이어그램 `status_reason=NULL` 잔존(WARNING). 나머지 10개 파일 모두 의도 범위 내 |
| side_effect | LOW | refresh-capable dedup claim 미생성(의도적이나 주석 명시 권장). `status_reason` null/token_expired 혼재. MAKESHOP 큐 모듈 등록 확인 필요 |
| maintainability | LOW | 테스트 내 알림 부재·savedExpired 검증 패턴 3중 중복. 서비스 코드 자체는 양호 |
| testing | LOW | 7d/3d 임계 refresh-capable 알림 면제 케이스 누락(WARNING). 이중 `.flat()` 약한 assertion. `normalizeStatusReason` 전용 테스트 없음 |
| documentation | LOW | `system-status.constants.ts` 큐 추가 안내 주석에서 e2e 갱신 의무 누락(WARNING). 나머지 문서화 완성도 높음 |

## 발견 없는 에이전트

없음 (모든 에이전트에서 발견사항 존재, 단 security·requirement는 INFO 수준만)

## 권장 조치사항

1. **(필수)** `spec/data-flow/5-integration.md` §1.4 sequenceDiagram의 `status_reason=NULL` → `status_reason='token_expired'` 갱신 (spec-구현 불일치 해소)
2. **(권장)** `integration-expiry-scanner.service.spec.ts`에 cafe24/makeshop + refresh_token 보유 상태에서 7d/3d 임계 알림 면제 검증 케이스 2개 추가
3. **(권장)** `integration-expiry-scanner.service.ts` `run()` 내 `isRefreshCapable` → `continue` 분기에 "refresh-capable은 dedup claim 미생성(§11.2 의도적 설계)" 코드 주석 추가
4. **(권장)** 테스트 내 알림 부재 검증 패턴(`getNotifResourceIds`) 및 savedExpired 검증 패턴(`hasSavedExpired`) 헬퍼 함수 추출 — 이중 `.flat()` 약한 assertion 동시 강화
5. **(권장)** `system-status.constants.ts` 큐 추가 안내 주석에 e2e `EXPECTED_QUEUE_NAMES` 갱신 의무 문구 추가
6. **(낮은 우선순위)** `integration-status-reason.spec.ts` 신설해 `normalizeStatusReason` 3~4 케이스 커버
7. **(낮은 우선순위)** `status_reason=null` 기존 만료 레코드 처리 전략(마이그레이션 또는 API 정규화) 검토
8. **(낮은 우선순위)** e2e 테스트 설명 문자열 큐 개수 하드코딩 → `EXPECTED_QUEUE_NAMES.length` 동적 참조로 교체

## 라우터 결정

라우터가 선별 실행함.

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명, 모두 router_safety 강제 포함)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (전원)
- **제외**: performance, architecture, dependency, database, concurrency, api_contract, user_guide_sync (7명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 미선택 |
| architecture | 라우터 미선택 |
| dependency | 라우터 미선택 |
| database | 라우터 미선택 |
| concurrency | 라우터 미선택 |
| api_contract | 라우터 미선택 |
| user_guide_sync | 라우터 미선택 |