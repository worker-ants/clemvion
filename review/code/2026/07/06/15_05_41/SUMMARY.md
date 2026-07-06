# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL/구조적 결함은 없으나, 순환참조 회피(`ModuleRef` 지연 해석)의 런타임 신뢰성을 검증하는 e2e/예외 경로 테스트가 부재해 WS emit 파이프라인의 회귀 감지력이 얕다. 또한 4개 reviewer(requirement, side_effect, documentation, api_contract)의 출력 파일이 디스크에 기록되지 않았다(disk-write 갭).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | WS emit 관련 e2e 커버리지 부재 — notify()/createMany() → emitNew() → emitNotificationEvent() → notifications:<userId> 브로드캐스트 전체 파이프라인이 unit(mock) 레벨에서만 검증. ModuleRef.get(strict:false) 가 실제 AppModule 부팅 하에서 정상 해석되는지는 "부팅 실패 안 함" 간접 신호로만 커버 | notifications.service.ts emit 경로 | ModuleRef 해석 계약 유닛 테스트 + (firing source 존재 시) socket.io e2e |
| 2 | testing | moduleRef.get 예외/미해석 경로 테스트 없음 — getWebsocket() 이 ModuleRef.get 실패 시 throw 하면 save() 커밋 후에도 notify()/createMany() 가 reject 되어 호출자에 미처리 예외 전파 가능. emitNotificationEvent 내부 try/catch 는 broadcast 만 방어 | notifications.service.ts getWebsocket/emitNew | getWebsocket() 호출도 try/catch 로 감싸 적재/emit 완전 격리 + 실패 케이스 유닛 테스트 |

## 참고 (INFO)

1. security — emitNotificationEvent payload 가 sanitizePayloadForWs 미통과 (현재 title/message 시스템 생성이라 위험 낮음; 향후 사용자 입력 유입 대비 주석 근거 또는 sanitize)
2. security — notify()/createMany() title/message 길이·내용 제한 없음 (프런트 이스케이프 확인 또는 정책 문서화)
3. security — notify() 가 diff 범위 내 프로덕션 호출자 없는 dead surface (PR3 wiring 시 CurrentUser/WorkspaceId 데코레이터 기반)
4. architecture — forwardRef vs ModuleRef(strict:false) 두 순환회피 기법 병존, 선택 기준 명문화 권장
5. architecture — ModuleRef(strict:false) 암묵 의존 (런타임 첫 호출 실패 가능) — 주석 문서화로 완화됨
6. architecture — NotificationsService 영속+emit 겸함 (best-effort + 누락방지 목적에 부합, 현 규모 수용 가능)
7. maintainability — notify()/createMany() row 매핑 중복 → buildRow 헬퍼
8. maintainability — 동일 shape 파라미터 타입 인라인 중복 → NotifyEntry 타입 추출
9. maintainability — resourceType/resourceId null 정규화 이중화 (의도적 이중 방어 — 주석 명시)
10. maintainability — require 순환 회피가 주석 의존, no-restricted-imports 룰 고려
11. testing — channel 무관 항상 emit 계약 테스트 부재 (PR2 이메일 도입 시 회귀 기준)
12. testing — circular-import 정적 회귀 가드 없음 (e2e 부팅이 잡아준다는 점 문서화)
13. testing — createMany 루프 내 개별 emit 실패 내결함성 테스트 없음
14. scope — ModuleRef 지연 해석은 계획 외이나 nodes 배럴 순환(실측) 해결 위한 정당한 범위 내 대응
15. scope — 계획 문서 2건 동시 갱신 + consistency 산출물 커밋은 의도된 범위 내 동기화

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 |
|----------|--------|------|
| security | LOW | sanitize 미적용·입력검증·dead surface (모두 INFO); IDOR/인가는 fail-closed authorizer 재사용으로 안전 |
| architecture | LOW | 두 순환회피 기법 병존·암묵 DI·SRP 다축 (INFO, 수용 가능) |
| scope | NONE | PR1 범위와 정확히 일치 |
| maintainability | LOW | row 매핑·타입·null 정규화 중복 (INFO, 소규모) |
| testing | MEDIUM | ModuleRef 해석 실패/circular-import 재발 커버리지 부재 (WARNING 2) |
| requirement / side_effect / documentation / api_contract | 재시도 필요 | 출력 파일 disk-write 갭 |

## 판정
critical_count=0, warning_count=2 (둘 다 testing). BLOCK: NO. WARNING 2건은 resolution 에서 조치. disk-write 갭 4 reviewer 는 substantive 결론(Critical=0)에 영향 없음 — security/architecture/scope/maintainability/testing 이 코드 실질을 커버.
