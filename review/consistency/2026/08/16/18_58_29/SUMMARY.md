# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker 전원 전문 확보.

대상: `spec/5-system/` (--impl-done, diff-base=`origin/main`).

## 전체 위험도
**LOW** — CRITICAL 0. WARNING 1건(문서 서술 범위, 코드·데이터 계약 위반 아님).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `1-data-model.md` §2.14 관계 표의 "응답 마스킹" 행이 **무조건문**으로 *"두 필드 모두 응답 egress 에서 마스킹을 거친다"* 라 서술 — 형제 문서보다 넓은 보장 | `spec/1-data-model.md:564` | 같은 diff 의 `14-external-interaction-api.md` §R17 이 스스로 *"적용 범위는 총칭이 아니라 열거다"* 라며 4+1 경로로 한정하고 **잔여 ①(WS `execution.node.*` emit 은 원문)** 을 명시. `6-websocket-protocol.md` 도 바로 옆 문장에서 같은 구분을 함 | data-model 문장에 §R17 과 동일한 스코프 한정어 추가. 코드 변경 불필요 |

> **왜 위험한가**: data-model 만 읽는 개발자(새 엔드포인트 추가자)가 *"이 두 컬럼은 어디서
> 나가든 이미 마스킹된다"* 로 오독해 새 read 경로에 마스킹을 빠뜨리고도 안전하다고 오판할 수
> 있다 — 이 저장소가 반복 겪은 *"문서한 보장이 구현보다 넓다"* 와 같은 클래스다.

## 참고 (INFO)

- **naming_collision · plan_coherence · rationale_continuity · convention_compliance** —
  발견 0건. 이전 라운드 지적(§R17 잔여 ③ 총칭 · `spec_impact` 누락 · `triggerToken` 근거 ·
  자기 인용)이 전부 해소됐음을 확인.

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | data-model 응답 마스킹 행이 무조건문 (WARNING 1) |
| rationale_continuity | NONE | 위반 없음 |
| convention_compliance | NONE | 위반 없음 |
| plan_coherence | NONE | 위반 없음 |
| naming_collision | NONE | 위반 없음 |

## 권장 조치사항
1. `spec/1-data-model.md:564` 에 스코프 한정어 추가

---

> **조치 (main)**: **반영했다.** 무조건문을 **열거**(`ExecutionsService` 4곳 +
> `BackgroundRunsService` body 노드)로 바꾸고, *"어디서 나가든 마스킹된다 로 읽으면 안 된다 —
> WS `execution.node.*` emit 은 미포함"* 캐비엇을 명시했다.
>
> **이 세션에서 "내 주장이 실제보다 넓다" 가 여섯 번째다** — 마스킹 범위 → 표면 전수 →
> 반환 지점 수 → 평문 보관 근거 → 커밋 메시지 → 이 무조건문. 공교롭게도 R17 이 *"총칭이
> 아니라 열거"* 를 못박은 **같은 diff 안에서** 다른 문서에 총칭을 썼다.
