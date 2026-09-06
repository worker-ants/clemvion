# RESOLUTION — `review/consistency/2026/09/06/00_48_52`

**원 결과**: BLOCK: NO · Critical 0 · WARNING 2 · 위험도 LOW

두 WARNING 모두 같은 세션의 코드 리뷰(`review/code/2026/09/06/00_48_51`)와 겹치므로
**처분 전문은 그쪽 RESOLUTION.md** 에 있다. 여기서는 요지와 대응 지점만 적는다.

## WARNING 1 (Cross-Spec) — 신설 가드가 진단 문구를 500 바디로 echo

`spec/5-system/3-error-handling.md` 의 `INTERNAL_ERROR` 고정 문구 원칙과
`http-exception.filter.ts` 의 CWE-209 방지 설계를 우회했다. **직전 라운드에서 내가 넣은
수정 자체가 만든 결함**이다.

→ 진단은 `this.logger.error(...)`, 응답은 `{ code: 'INTERNAL_ERROR', message: <고정 문구> }`.
리뷰어가 제안한 신규 코드(`SCHEDULE_TRIGGER_MISSING`)는 **공개 에러 카탈로그 등재가 필요해
planner 몫**이므로 택하지 않고, 기존 코드로 규약을 만족시켜 이 브랜치에서 닫았다.
회귀는 unit 으로 고정했고 뮤턴트 2종(첫 판 복원 · 가드 삭제)이 모두 RED 였다.

## WARNING 2 (Naming Collision) — `TriggerWorkflowRefDto` ↔ `ScheduleTriggerWorkflowRefDto`

이름은 접두어 하나만 다른데 shape 가 다르다(`id`+`name` vs `name`).

→ **개명하지 않았다.** 필드 차이는 결함이 아니라 의도이고(각 응답의 소비처가 읽는 것만
담는다), 개명은 공개 OpenAPI 스키마 이름 변경이다. checker 가 "최소한" 으로 제시한
**상호 참조 JSDoc** 을 두 클래스에 넣어, 왜 다른지와 갈아 끼우지 말 것을 명시했다.

## INFO 5건 — 조치 불요

`secret-store.md §1` stale 화 · `*RefDto` 명명 미성문화 · `consecutiveNetworkFailures` ·
`spec_impact` 범위 · ratchet fixture `code:` 미등재. 전부 이미 plan 트래커가 추적 중이거나
`spec/` 쓰기라 **developer 권한 밖**이다 — 이 브랜치에서 집행하지 않는다.

## 검증

lint PASS · unit PASS · build PASS · e2e PASS 297.
