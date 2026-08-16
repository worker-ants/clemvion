# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

대상: `spec/5-system/` (--impl-done, diff-base=`origin/main`). 실제 diff 는
`spec/5-system/14-external-interaction-api.md`(§7.1·§R17) · `spec/5-system/6-websocket-protocol.md`(§4.1) ·
`spec/1-data-model.md`(§2.14) · `spec/2-navigation/14-execution-history.md`(R-5) ·
`spec/4-nodes/1-logic/12-background.md`(§8.2) · `spec/conventions/secret-store.md`(§1) 6개 spec 파일과
대응 코드(`redact-stored-error.ts` 신규 등)에 걸쳐 있다. 5개 checker 모두 전문 확보.

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건(둘 다 서술/문서 동기화 수준, 코드·데이터 계약 위반 아님).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | EIA §R17 "잔여(범위 밖) ③" 이 workflow-assistant 노출 스코프를 "같은 두 컬럼"으로 적어 실제 마스킹 대상(3개 필드: `inputData`/`outputData`/`error`)과 불일치·모호 — R17 자신이 명시한 "열거이지 총칭이 아니다" 원칙을 그 자리에서 위반 | `spec/5-system/14-external-interaction-api.md` §R17 잔여 ③ | `spec/3-workflow-editor/4-ai-assistant.md` §"마스킹 규칙"(3필드 명시) + `explore-tools.service.ts:462-464`/`:482-484` 실코드 + 트래커 L213(제목↔본문 불일치도 동일 오염 상속) | R17 ③을 세 필드로 정정 + `4-ai-assistant.md` 링크. 트래커 제목도 동시 정정 |
| 2 | convention_compliance | plan `spec_impact` 목록이 실제 수정 spec 파일 하나(`spec/1-data-model.md`)를 누락 — Gate C 취지 훼손 우려 (현재 in-progress 라 build 미차단) | `plan/in-progress/eia-internal-rest-error-masking.md` frontmatter | `git diff --stat -- 'spec/**'` = 6개 변경, plan 은 5개만 나열 | `spec_impact:` 에 `spec/1-data-model.md` 추가. `complete/` 이동 전 필수 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | `redactStoredErrorForResponse` — 초안명이 `ExecutionError` 예외 클래스와 혼동 소지였던 것은 이전 라운드에서 정정됨. 잔존 참조 0건 | `redact-stored-error.ts:57` | 없음 |
| 2 | naming_collision | 신규 파일 경로/명명이 디렉토리 컨벤션과 일치, 자매 파일과 충돌 없음 | `codebase/backend/src/shared/utils/` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §R17 ③ "같은 두 컬럼" 표현이 실제 3-필드 범위와 불일치 (WARNING 1). 그 외 데이터모델/WS/R-5/secret-store/chat-channel 정합 전부 확인 |
| rationale_continuity | NONE | 과거 "미결" 을 사용자 택일 결정으로 정당하게 전환, 기존 원칙 위반 없음. 이전 라운드 INFO 3건(§R17 자기인용·`triggerToken` 근거·`stopInternal` 반환지점 수) 모두 후속 커밋에서 수정 확인 |
| convention_compliance | LOW | plan `spec_impact` 에 `spec/1-data-model.md` 누락 (WARNING 1). 명명·DTO/Swagger·SoT 상호참조·frontmatter `code:` 는 전부 준수 |
| plan_coherence | NONE | 정본 트래커의 미결 I1/D 와 정확히 대응, 잔여 3건 반영 확인 |
| naming_collision | NONE | 신규 식별자 2개 모두 충돌 없음 |

## 권장 조치사항
1. §R17 잔여 ③ 을 `inputData`/`outputData`/`error` 세 필드로 정정 + `4-ai-assistant.md` 링크
2. 트래커 항목 제목을 본문과 일치하도록 정정
3. plan `spec_impact` 에 `spec/1-data-model.md` 추가

---

> **조치 (main, 같은 턴)**: WARNING 2건 **전부 반영**.
>
> **W1 이 특히 아프다** — §R17 잔여 ③ 이 *"같은 두 컬럼"* 이라 총칭했는데 실제로는 **세 필드**
> (`inputData`·`outputData`·`error`)다. **R17 이 바로 그 자리에서 "총칭이 아니라 열거" 를
> 선언해 놓고 내가 그 원칙을 어겼다.** 세 필드로 열거하고 `4-ai-assistant.md` 를 SoT 로 링크했으며,
> 같은 오염을 상속한 트래커 항목 제목도 함께 정정했다.
>
> **W2**: `spec_impact` 를 실제 변경 6파일과 대조하는 스크립트로 재측정해 `spec/1-data-model.md`
> 누락을 확인하고 추가했다 — 이제 **누락 0** (Gate C 는 `complete/` 이동 시점에 실행된다).
