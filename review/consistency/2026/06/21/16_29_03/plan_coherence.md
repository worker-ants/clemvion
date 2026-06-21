# Plan 정합성 검토 결과

## 검토 대상

- **target 문서**: `spec/5-system/6-websocket-protocol.md`
- **검토 모드**: `--impl-done` (scope=`spec/5-system/6-websocket-protocol.md`, diff-base=origin/main)
- **참조 plan**: `plan/in-progress/refactor/02-architecture.md` §M-7

---

## 발견사항

### 발견 없음 — 정합

target spec(`spec/5-system/6-websocket-protocol.md`)은 이번 변경 diff 에서 **수정되지 않았다** (prompt 의 "구현 대상 spec 영역: (없음)" 명시). diff 는 전적으로 `codebase/` 구현 파일(`websocket.gateway.ts`·`websocket.module.ts`·`executions.module.ts`·`knowledge-base.module.ts`·`workflows.module.ts` + 신규 authorizer 5종 + 공유 uuid 유틸)에 국한된다.

검토 3개 관점 각각에 대해:

1. **미해결 결정과의 충돌**

   `02-architecture.md §M-7` 은 구현 완료(`[x] 완료, Option A, 2026-06-21`)로 표기되어 있고, "개선 방안(재정의)" 의 모든 세부 결정(authorizer 4개 도메인 이동·`CHANNEL_AUTHORIZER` token·multi-provider → useFactory 전환·서비스-레벨 forwardRef 3개 제거·`executionsService`/engine/retry 유지)이 구현 결과에 그대로 반영되어 있다. target spec 이 아예 편집되지 않았으므로 spec 상의 미해결 결정 우회가 발생하지 않았다.

   `spec-sync-websocket-protocol-gaps.md` 가 열거한 미구현 항목(`in-band 토큰 갱신`·`notifications:{userId}` emit 등)은 본 diff 가 건드리지 않는다. `notifications:` authorizer 의 신설은 **채널 구독 인가**(join 전 userId 일치 검증)이며, spec gaps 목록의 "`notifications` emit 경로 부재"와는 별개다 — 충돌 없음.

2. **선행 plan 미해소**

   M-7 은 선행 조건으로 spec 갱신 불요("주입 메커니즘 spec 무언급", D 판정)를 명시했다. 실제로 target spec 은 건드리지 않았으므로 플랜이 요구한 선행 조건이 모두 충족된 상태다.

   C-2 §2·3 에서 "M-7 로 해소" 로 명시된 항목(gateway 역참조 감소·KB gateway 의존 제거)도 diff 가 올바르게 구현했다 — 미해소 선행이 없다.

3. **후속 항목 누락**

   M-7 구현 완료로 인해 `02-architecture.md §C-2` 의 "2. WS gateway → 4개 서비스: M-7 authorizer 역전으로 해소", "3. KB cluster: gateway→KB 를 M-7 로 끊으면 단방향 import" 항목이 해소된다. plan 내에서 이미 M-7 완료로 C-2 관련 효과가 기록되어 있어(`§M-7 구현 결과` 항목이 "C-2 클러스터(gateway 변·KB gateway 의존)의 해소 수단을 겸하므로 투자 대비 효과가 가장 크다"를 언급) 별도의 후속 항목 누락이 없다.

   신규 채널 추가 시 편집 지점이 "도메인 모듈 authorizer+export" + "WS factory inject 한 줄" 2곳으로 늘어났음(원안 multi-provider 대비 1지점 추가)이 `§구현 결과` 에 이미 명문화되어 있어 추적상 누락 없음.

---

## 요약

target spec(`spec/5-system/6-websocket-protocol.md`)은 이번 diff 에서 수정되지 않았고, 구현 변경 내용은 `plan/in-progress/refactor/02-architecture.md §M-7` 의 확정된 Option A 결정을 정확히 이행한다. 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 중 어느 항목도 해당하지 않는다. `spec-sync-websocket-protocol-gaps.md` 가 열거한 Planned 미구현 항목과도 충돌이 없다.

---

## 위험도

NONE
