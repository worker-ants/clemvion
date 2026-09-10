# Consistency Check 통합 보고서 — 라운드 1

**BLOCK: YES** (Critical 2건 — 동일 사안. 라운드 2 `12_28_11` 에서 정정 검증)

> 이 파일은 호출자(main)가 썼다. `SUMMARY.md` basename 은 sub-agent Write 가 훅으로 차단된다
> ([`subagent-call-contract.md §7`](../../../../../.claude/docs/subagent-call-contract.md)).

**대상**: `plan/in-progress/spec-draft-ws-protocol-intro.md` — `spec/5-system/6-websocket-protocol.md`
의 `> 관련 문서:` 註와 `## 1. 연결` 사이에 `## Overview` 삽입.

## 집계 (5개 리포트 원문을 세어 산출)

| Checker | 위험도 | Critical | Warning | INFO |
|---|---|---|---|---|
| `cross_spec` | MEDIUM | **1** | 0 | 4 |
| `convention_compliance` | MEDIUM | **1** | 1 | 1 |
| `rationale_continuity` | LOW | 0 | 1 | 3 |
| `plan_coherence` | LOW | 0 | 1 | 1 |
| `naming_collision` | LOW | 0 | 1 | 1 |
| **합계** | — | **2** | **4** | **10** |

Critical 2건은 **같은 사안**이다(§6.2). 따라서 실질 Critical 은 1건.

## Critical — §6.2 는 seq 기반 복구가 아니다 (2개 checker 독립 검출)

**초안 문구**: *"놓친 이벤트는 `seq` 기반으로 복구한다(§6.2)."*

**실제**: §6.2 는 스스로 소제목을 「native WebSocket 복구 모델 — `execution.snapshot`」이라 달고,
재구독 시 현재 전체 상태를 1회성 `execution.snapshot` 으로 발행한다고 적는다. `seq` 기반 5분
replay 버퍼는 **EIA SSE 어댑터 소유**다(§4.7 「5분 버퍼는 SSE 어댑터 소유」·
`14-external-interaction-api.md §R7` 이 seq 공유를 **SSE 와 notification 사이로 한정**).

**`convention_compliance` 가 결정적 증거를 더했다** — 이 문서 `## Rationale` 에
「재연결 복구 — native WS 는 snapshot, seq 버퍼-replay 는 SSE 전송 (§6.2)」 항목이 이미 있고,
그 항목은 *"초기 §6.2 초안은 native WS `subscribe.lastSeq` → 5분 버퍼 재전송을 **약속했으나** …
구현에 맞춰 정정한다"*, 끝에 *"초기 초안의 문구는 WS 가 버퍼를 갖는다는 **폐기된 전제**였으므로
**철회한다**"* 라고 못박는다.

즉 초안 문구는 단지 틀린 것이 아니라 **이 문서가 이미 쓰고 공식 철회한 주장을 입구에 되살린
것**이었다 — 기각된 대안의 재도입. `cross_spec` 은 또한 *"바로 다음 문단이 '한 표면만 보고 고치면
갈린다' 고 경고하는데 그 앞 문장이 정확히 그 오류를 범한다"* 고 지적했다.

**처분**: 정정 완료. 현재 문구는 *"끊긴 동안 놓친 것은 재구독 시 **1회성 `execution.snapshot`**
으로 재동기화한다(§6.2) — `seq` 기반 replay 버퍼는 **native WS 에 없다**(SSE 어댑터 소유, §4.7)"*.
라운드 2(`12_28_11`)가 이 정정을 검증한다.

## Warning 4건 — 전부 반영

| Checker | 지적 | 처분 |
|---|---|---|
| `convention_compliance` | 헤딩 표기 카운트 **8/2 가 아니라 9/3**(`8-embedding-pipeline`·`1-auth` 누락). 그리고 **`1-auth.md` 가 판별 기준을 반증**한다 — 제품 표면인데 접미사 없음 | 카운트 정정. **판별 축을 갈았다** — `SKILL.md` 가 접미사를 "사용자 가치·요구사항·목표(옛 PRD 자리)" 로 정의하므로 기준은 **문서 주제가 아니라 그 절의 내용**이다. 그러면 `1-auth.md` 는 반례가 아니라 증거가 된다 |
| `naming_collision` | 앵커 인용 **"116건" 이 어느 계산과도 안 맞는다**(occurrence 96 / line 93 / 초안 표 합 94) | 스코프별로 재측정: `spec/` 89 + `plan/` 7 + `codebase/` 0 = **96**, `review/` 96 더해 전체 192. **116 은 단순 덧셈 오류** — 정정 |
| `rationale_continuity` | *"같은 실행 상태가 두 표면으로 나간다"* 가 **대칭으로 읽힌다.** 실제로는 §4.7 이 선택적 매핑이고 `llmCalls` 등은 외부 strip — **보안 목적의 의도적 비대칭** | 한정 추가. 오독 방향이 **유출** 쪽이라 위험하다는 지적이 핵심이었다 |
| `plan_coherence` | archive stale 앵커 처분이 **남의 미결 결정을 선점**한다 — 같은 두 앵커가 `spec-sync-external-interaction-api-gaps.md` 에 *"archive 를 검사 대상에서 뺄지부터 정해야 착수할 수 있다"* 로 등재돼 있다 | 자체 근거를 지우고 **교차 참조로 교체**. 이 초안은 아무것도 결정하지 않는다 |

## INFO 10건 — 요지

- `cross_spec`: 채널 열거가 §3.2 의 5종 중 4종(`background:run:` 누락) · 1문단 서두가 문서 범위보다
  좁다(§4.3 KB·§4.5 알림 누락) · "에러 코드 어휘 규약" 표현이 `error-codes.md` 자신의 scope 선언과
  결이 다르다 · 3문단이 EIA 를 "REST 표면" 으로만 축약(2문단과 자기모순). **네 건 다 반영.**
- `rationale_continuity`: raw-WS 열거의 "등" 이 §4.6 의 **구현 완료** 항목(`auth.token_expired`)까지
  끌어당길 수 있다(반영) · Socket.IO 를 정착 사실로 쓴 것은 두 이력과 정합(조치 불요) ·
  **헤딩 선택 근거가 plan 에만 남으면 유실된다** — 자매 선례가 그 권고를 못 지켜 실제로 유실됐다
  (반영: 대상 문서 `## Rationale` 에 항목 신설).
- `plan_coherence`: "두세 줄" vs 실제 산출물 — 자매 실측 686/1,514/1,742자 범위 안이라 **trim 불요**.
- `naming_collision`: `#overview` 앵커 충돌 0 · 선-인용 0 · 번호 앵커 13종 전부 현재 heading 과 일치 ·
  archive 선재 깨짐 2건 재확인.

## 검증 절차에 대한 기록

- **`naming_collision` 의 spec 서브코퍼스가 예산에 잘려 대상이 빠졌다.** 프롬프트를 파싱해 확인한
  뒤 dispatch 프롬프트에 세 파일 직독을 명시했고, checker 가 어느 파일을 열었는지 리포트에 적었다.
  갭이 열린 채 판정되지 않았다.
- **`cross_spec` 은 대상을 100,380자 전문으로 실었다** — 예산 1,200,000 으로 준비했고, 그 전에
  무관한 트래커 편집을 [#1305](https://github.com/worker-ants/clemvion/pull/1305) 로 분리해 tier-1
  오염을 제거한 결과다. 분리 전에는 대상이 생략됐다(적재 7 / 생략 106).
- `convention_compliance` 는 문서 가드 알고리즘(remark + github-slugger)을 재현해 앵커를 검증했다.
  단 앵커 인용 개수는 "정확히 116건" 이라 보고했는데 **스코프를 밝히지 않아 재현되지 않는다** —
  내 재측정은 96(spec+plan+codebase) / 192(전체)다.

## 두 checker 가 정면으로 갈린 지점 — 기록해 둔다

**대상 문서 `## Rationale` 에 헤딩 선택 근거를 남길 것인가.**

- `convention_compliance`: *"선례(`2-api-convention.md`)도 Rationale 에 안 남겼으니 안 남기는 것이
  선례와 일치"* → 남기지 마라.
- `rationale_continuity`: *"선례의 `--spec` 이 그걸 권고했는데 병합본에 반영되지 않았다. 즉 선례는
  일치의 근거가 아니라 **유실의 증거**"* → 남겨라.

**후자를 택했다.** 형태 일치보다 근거 유실 방지가 이 항목의 목적에 부합하고, 유실이 실제로
일어났다는 증거(권고는 있었고 병합본엔 없다)가 있다.
