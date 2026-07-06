# RESOLUTION — 알림 파이프라인 PR1 (notification.new WS emit)

review session: `review/code/2026/07/06/15_05_41/` · risk=MEDIUM, Critical=0, Warning=2

## 조치 항목

| SUMMARY # | 유형 | 조치 | commit |
| --- | --- | --- | --- |
| WARNING 1 | testing | ModuleRef 지연 해석 계약을 유닛 테스트로 고정(`getWebsocket — strict:false 해석 + 1회 캐시`). 전체 socket.io 배달 e2e 는 **보류→PR3** — PR1 에는 사용자向 발사 소스가 없어 end-to-end 로 알림을 몰아줄 경로가 없다(createMany 호출자는 기존 background/alert/integration 흐름). app-boot e2e(236 통과)가 DER/init-order 순환 수정을 검증했고, ModuleRef 해석은 유닛으로 커버. | (본 커밋) |
| WARNING 2 | testing | `emitNew()` 를 try/catch 로 감싸 `getWebsocket()`(ModuleRef.get) 해석 실패까지 삼킴 — 적재(save) 성공을 emit 실패와 완전 격리. 실패 케이스 유닛 2건 추가(notify/createMany 모두 reject 하지 않음). | (본 커밋) |

INFO(1~15)는 비차단. 주요 판단:
- INFO#1/#5 (sanitize): payload 는 고정 스칼라 shape(id/type/title/message/resource*)이고 title/message 는 시스템 생성 문자열이라 즉시 위험 없음. 향후 사용자 입력 유입 시 재평가 — PR3(발사 소스 wiring) 에서 입력 출처와 함께 검토.
- INFO#3 (notify() dead surface): 의도적 — PR3 에서 execution_failed/schedule_failed/team_invite 가 notify() 를 wiring.
- INFO#7/#8 (row 매핑/타입 중복): 저우선, 후속 리팩터.
- INFO#4/#6 (아키텍처): 현 규모 수용 가능, 조치 불필요.

## 보류·후속 항목

- **socket.io 배달 e2e** → PR3(발사 소스 wiring 시 end-to-end 경로 확보). 트래커 `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` PR3 노트에 반영.
- **SPEC-DRIFT (Planned 배지)**: 본 구현으로 `spec/5-system/6-websocket-protocol.md §4.4`·`spec/data-flow/8-notifications.md §1/§2.2` 의 "notification.new emit = 미구현(Planned)" 서술이 stale. `/consistency-check --impl-done` 경로로 spec 역류 처리.

## TEST 결과

- lint: 통과 (`stage=lint status=PASS`)
- unit: 통과 (388 suites, 7665 tests; fix 후 재실행 PASS)
- build: 통과 (`stage=build status=PASS`)
- e2e: 통과 (`stage=e2e status=PASS tests=236 passed`; fix 후 재실행)
