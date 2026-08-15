# Rationale 연속성 검토 결과

## 검토 범위 정정 (선행 확인)

prompt 의 "Target 문서" 는 `spec/5-system/` 전체를 --impl-prep 번들로 담고 있으나, 실제 로컬
상태를 대조한 결과 이 워크트리(`eia-r8-cache-scope-4ae434`)의 **실질 in-progress 작업은
워크트리 이름이 가리키는 "R8 캐시 스코프"가 아니라 `plan/in-progress/eia-terminal-payload.md`
(종결 이벤트 `durationMs` 확장, "재판정 ④", 2026-08-15)** 였다 — plan 파일 자체가 "워크트리
이름이 작업과 무관하다"고 명시한다. R8(Idempotency-Key 캐시 스코프) 결정은 이미 완료·병합된
상태(spec #1156, 코드 #1157~#1163, `git log` 로 확인)이므로 아래 검토는 실제 진행 중인
durationMs 확장을 대상으로 한다. bundle 예산 초과로 생략된 `spec/5-system/14-external-interaction-api.md`
본문은 `Read` 로 직접 열어 확인했다.

## 발견사항

- **[INFO]** `durationMs` Planned→구현됨 전환 시 비용-비대칭 설명을 삭제 대신 "해소" 형태로 보존할 것
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6 "종결 이벤트의 필드 집합" 표
    `durationMs` 행(L575) — *"`completed` 는 emit 직전에 계산돼 있으나 `cancelled` 계열은
    계산·영속조차 하지 않는다"* — 및 §6.3(L743)·§6.4(L777) 의 "Planned" 캐비엇, §6.5(cancelled,
    현재 durationMs 언급 없음). `plan/in-progress/eia-terminal-payload.md` "재판정 ④ § spec
    동반 변경(전수)" 가 이 자리들을 "Planned → 구현됨" 으로 뒤집을 예정.
  - 과거 결정 출처: 같은 문서 §6.4 Rationale(L792-797) — `error` 필드가 string→object 로
    일원화됐을 때 *"종전의 '일부 경로는 string' 캐비엇은 해소됐다"* 라고 **삭제가 아니라 이력
    보존 형태**로 정정한 선례.
  - 상세: durationMs 필드는 "삭제된 약속"(`finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId`,
    L577-580, "**되살리지 않는다**")과 달리 애초에 정식으로 유지되던 Planned 필드라 이번
    구현은 기각된 대안의 재도입이 아니다. 다만 cost-differential 설명(completed 는 쉽고
    cancelled/stalled 는 DB write·시그니처 확장이 필요했다는 근거)을 구현 시 통째로 지워버리면,
    "왜 completed 만 먼저 Planned 로 남아 있었는지"의 근거가 사라져 이 저장소가 반복적으로
    지켜온 "정정은 삭제가 아니라 해소로 남긴다" 관행과 어긋난다.
  - 제안: §6 필드 표·§6.3/§6.4 캐비엇을 단순 삭제하지 말고, `(2026-08-xx 해소)` 형태로
    "종전엔 completed 경로만 emit 시점에 계산돼 있었다 — cancel/stalled 경로도 DB write·시그니처
    확장으로 해소했다" 식 한 줄을 남길 것. plan 의 "spec 동반 변경(전수)" 체크리스트에 이 캐비엇
    문구를 명시적으로 추가하는 편이 안전하다.

- **[INFO]** R8(Idempotency-Key 캐시 스코프) 결정은 target 범위 안에서 완전히 보존됨 — 확인 완료, 액션 불필요
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R8(L1187-1206), EIA-IN-11(L82),
    EIA-RL-02(L141), `spec/data-flow/15-external-interaction.md` L93/L98/L258, `spec/conventions/redis-keys.md` L59
  - 과거 결정 출처: `plan/complete/spec-draft-eia-idempotency-key-scope.md` — "캐시 키는
    execution+route 로 스코프, 토큰(jti) 스코프·전역 키 복귀 모두 기각"
  - 상세: 워크트리 이름이 이 결정을 가리키고 있어 혼동 가능성이 있었으나, `git log`(#1155~#1163)
    로 코드·spec 양쪽이 이미 이 결정대로 병합돼 있음을 확인했다. 이번에 실제로 진행 중인
    durationMs 확장은 이 캐시 네임스페이스·closed-list 정책(2xx/409/410 만 캐시, 400
    VALIDATION_ERROR·5xx 제외)을 전혀 건드리지 않는다 — 별개 subsystem(outbound 종결 이벤트
    payload vs inbound idempotency 캐시)이다.
  - 제안: 없음(회귀 없음 확인).

## 요약

target 범위(`spec/5-system/`)의 현재 텍스트와, 이 워크트리에서 실제로 착수 예정인 durationMs
종결 페이로드 확장(`eia-terminal-payload.md` 재판정 ④)은 기존 Rationale 과 충돌하지 않는다.
"삭제된 약속"(`finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId`)의 부활은 없고, durationMs
필드 부가는 §12 호환성 Rationale("기존 클라이언트는 unknown field 를 무시 → 영향 없음")과
일치하며, WS `duration` vs EIA `durationMs` 표기 차이도 이미 문서화된 의도적 비정합이다. R8
Idempotency-Key 캐시 스코프 결정(토큰이 아니라 execution+route 로 스코프, 전역 키 기각)도
target 전역에서 완전히 보존돼 있다. 유일한 개선 여지는 Planned→구현됨 전환 시 기존
비용-비대칭 캐비엇을 삭제 대신 "해소" 형태로 남기라는 문서 품질 권고(INFO)뿐이며, 이는 이미
저장소가 §6.4 error 필드 전환에서 실제로 지킨 관행을 그대로 따르라는 것이다.

## 위험도

LOW
