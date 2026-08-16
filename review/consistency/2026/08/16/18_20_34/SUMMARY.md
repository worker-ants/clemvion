# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건, WARNING 0건, INFO 3건만 신규 관측)

## 전체 위험도
**LOW** — 내부 읽기 경로(`Execution.error`/`NodeExecution.error`) egress 마스킹 확장 diff 는 이전 라운드(`16_48_55`)가 지적한 drift 2건을 실제로 해소했고, 5개 checker 모두 CRITICAL/WARNING 없이 INFO 수준(교차 인용·앵커 형식)만 남겼다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | §R17 "내부 읽기 경로" 마스킹 불릿이 §5.3(HTTP 에러 envelope 비echo 원칙)과 교차 인용되지 않음 — 직접 모순은 아니나 같은 CWE-209 동기를 공유하는 두 필드가 다른 강도의 정책을 갖는다는 점이 명시돼 있지 않음 (이전 라운드 INFO 이월, 미반영) | `spec/5-system/14-external-interaction-api.md` §R17 불릿 | §R17 불릿 옆에 "본 마스킹은 §5.3(HTTP 에러 envelope)과 다른 레이어(도메인 데이터)이며 자격증명 패턴만 겨냥한다" 한 줄 추가 |
| 2 | rationale_continuity | §R17 안에서 자기 자신의 구판 문구를 인용할 때("종전 서술이 이 갭을 '내부 REST vs WS' 라 불렀는데") 원문("내부 REST 와의 비대칭은 미결이다")과 축자적으로 일치하지 않음 — 실질 의미는 합리적 해석이라 이력 조작은 아님 | `spec/5-system/14-external-interaction-api.md` §R17 | 인용을 원문에 맞게 정정 |
| 3 | convention_compliance | `secret-store.md §1` cross-reference 에 앵커 누락 — 저장소 내 동일 절 인용 3곳(`discord.md:288`, `slack.md:266`, `15-chat-channel.md:89`)은 모두 `#1-uri-scheme` 앵커를 명시하는데 이번 신규 링크만 앵커 없이 문서 전체를 가리킴 (빌드 가드는 통과 — 형식 불일치만) | `spec/5-system/14-external-interaction-api.md` §7.1 | `#1-uri-scheme` 앵커 보강 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 이전 라운드(`16_48_55`) WARNING 2건(WS `execution.snapshot` drift, `12-background.md` §8.2 drift) 모두 해소 확인. 5개 spec 문서가 동일 결정(2026-08-16)으로 동기화됨 |
| rationale_continuity | LOW | 과거 "미결" 항목을 근거·기각사유·잔여 스코프와 함께 결정으로 전환, 기존 원칙(egress-only, R-5 스코프 분리) 위반 없음 |
| convention_compliance | LOW | secret-store.md SoT 위임, `code:` frontmatter 분업, swagger DTO JSDoc 의무, node-output.md 에러 형태 invariant 모두 준수 |
| plan_coherence | NONE | target diff 는 정본 트래커에 사전 등재된 미결 항목(I1·D)의 사용자 택일 결정을 그대로 집행. 신규 잔여 3항목도 "결정 아님"으로 명시하고 트래커에 별도 등재 |
| naming_collision | NONE | 이번 델타가 신설한 식별자는 TS 타입 `ResponseNodeExecution` 하나뿐이며 충돌 없음 |

## 권장 조치사항
1. (선택, 비차단) `secret-store.md §1` 링크에 `#1-uri-scheme` 앵커 추가
2. (선택, 비차단) §R17 자기-인용을 원문에 맞게 정정
3. (선택, 비차단) §R17 불릿 옆에 §5.3 과의 레이어 차이 한 줄 명시

---

> **조치 (main)**: INFO 3건 **전부 반영**했다(전부 spec-only, 비차단이지만 값싸다).
>
> **③ 을 고치다 내 실수를 하나 더 잡았다** — INFO 1 을 반영하며 `§5.3` 을 이 문서 내부
> 앵커(`#53-에러-응답`)로 걸었는데, 이 문서의 §5.3 은 *"단발 상태 조회"* 다. 체커가 말한
> §5.3 은 **`2-api-convention.md`** 쪽(*"에러 응답"*)이었다. 앵커 형식을 고치라는 지적에
> 답하면서 **틀린 앵커를 새로 만들 뻔했다** — 실측 후 `./2-api-convention.md#53-에러-응답`
> 으로 정정했다. 문서 가드 20파일 · 2,956 tests PASS.
