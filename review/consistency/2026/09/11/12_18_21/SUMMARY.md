# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 전문 확보, 재시도 필요 항목 없음)

## 전체 위험도
**MEDIUM** — CRITICAL·기능 파손 없음. 이 PR(`2-api-convention.md §5.3` "details.field 를 실으면 code도 싣는다" 배선)은 정합적으로 구현됐으나, plan 이 자체 리뷰에서 정확히 진단한 두 후속 결정(§5.4.1 stale 서술 정정, `authConfigId` §5.3 "겹쳐쓰지 않는다" 충돌 판정)이 durable 트래커에 등재되지 않아 plan 이 `complete/` 로 이동하면 유실될 위험이 MEDIUM 등급의 근거다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드 Critical 발견 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `15-chat-channel.md` 의 "배선 전 관측값" 서술 3곳이 이 PR 로 stale 해지는데, 정정(planner PR)이 실행-항목으로 등재돼 있지 않음 | `spec/5-system/15-chat-channel.md` §5.4.1(375행)·§5.4.1.1(426행)·§5.4.1.2(411-416행) | `plan/in-progress/impl-details-code-wiring.md` 3라운드 처분(*"planner PR 대상은 3곳"* 결론이 있으나 미등재) | `impl-details-code-wiring.md` 체크리스트 또는 `spec-draft-nullable-notation-followups.md` 에 세 자리 정정 항목을 명시적으로 신설. `complete/` 이동 전 필수 |
| 2 | plan_coherence | `authConfigId` 가 top-level 특화 코드(`AUTH_CONFIG_NOT_FOUND`) + `details.code=INVALID_FIELD` 를 동시에 실어 §5.3 "둘을 겹쳐 쓰지 않는다" 규칙 위반 소지 — planner 판정 필요성이 durable 하게 등재 안 됨 | `spec/5-system/2-api-convention.md` §5.3 "도메인 세부 사유를 어디에 싣는가" | `triggers.service.ts` `assertAuthConfigInWorkspace` (신규 `details.code` 추가 지점) | (a) 코드 사이트에 미해결 상태 주석/트래커 앵커 추가, (b) `spec-draft-nullable-notation-followups.md` 에 "planner 판정 필요" 항목 신설 |
| 3 | cross_spec | `details[].code` 배선 완료 필드의 예시를 다른 spec 영역이 `code` 없이 여전히 인용 (2곳 신규 발견 + 1곳 이미 트래킹) | `spec/4-nodes/7-trigger/providers/slack.md:275`, `discord.md:297` (신규) / `spec/2-navigation/2-trigger-list.md:119-120,176-178,336` (이미 `impl-details-code-wiring.md` INFO 3 로 트래킹됨) | `triggers.service.ts` `assertInboundSigningPlaintextByProvider` 등 15개 `details.code` 발행 지점 | planner 턴에서 세 문서 모두 `details.code='INVALID_FIELD'` 를 예시에 반영해 SoT(§5.3)와 동기화. 코드 변경 불요 |
| 4 | convention_compliance | 신규 코드 주석 2곳이 리뷰 세션을 bare `hh_mm_ss` 로 인용 (`review-citations.md` §2 위반) | `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:923`, `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3094` | `review-citations.md` §2 (날짜 포함 의무) · §3 적용범위(`codebase/**` 코드·테스트 주석 적용 대상) | `` `/ai-review` `review/code/2026/09/11/11_05_27` ... `` 형태(전체 경로)로 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `common/`(리터럴 `'INVALID_FIELD'`) vs `modules/`(canonical `ErrorCode.INVALID_FIELD` import) 사이 layering 비대칭에 대한 spec Rationale 부재. 코드 주석으로 근거는 설명돼 있어 즉각 조치 불요 | `codebase/backend/src/common/utils/password.util.ts` | 다음 spec 갱신 시 `error-codes.md` §Overview 또는 `2-api-convention.md §5.3` 에 "common/ 레이어는 리터럴 유지" 한 줄 보강 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `details.code` 배선 완료를 slack/discord provider spec 이 예시에서 누락 (WARNING, 비파괴적 문서 gap) |
| rationale_continuity | LOW | `common/` vs `nodes/` ErrorCode 사용 비대칭에 spec Rationale 미기재 (INFO). 배선 자체는 §5.3·기존 Rationale(R-12, R-CC-10)과 전부 정합 |
| convention_compliance | LOW | bare `hh_mm_ss` 리뷰 인용 2건 (WARNING). 핵심 배선(`details.code`)·DTO 데코레이터 순서·명명·i18n sibling 은 전부 규약 준수 확인 |
| plan_coherence | MEDIUM | plan 이 정확히 진단한 두 후속 결정(§5.4.1 stale 서술 정정, `authConfigId` §5.3 충돌 판정)이 durable 트래커에 미등재 — `complete/` 이동 시 유실 위험 |
| naming_collision | NONE | 신규 식별자(상수 3개, 신규 파일 1개) 전부 저장소 전역에서 유일, 기존 컨벤션·canonical 값과 일치. 신규 endpoint/이벤트명/ENV 도입 없음 |

## 권장 조치사항
1. `plan/in-progress/impl-details-code-wiring.md` 또는 `spec-draft-nullable-notation-followups.md` 에 `15-chat-channel.md` §5.4.1/§5.4.1.1/§5.4.1.2 "배선 전 관측값" 정정 항목을 명시적으로 신설 (plan `complete/` 이동 전 필수).
2. `authConfigId` 의 top-level 특화 코드 + `details.code` 동시 존재가 §5.3 "겹쳐 쓰지 않는다" 위반인지 planner 판정을 요청하는 항목을 durable 트래커에 신설하고, 코드 사이트에도 앵커 주석을 남긴다.
3. `slack.md:275`·`discord.md:297`·`2-trigger-list.md:119-120,176-178,336` 에 `details.code='INVALID_FIELD'` 예시를 추가해 SoT(§5.3)와 동기화 (planner 턴).
4. `trigger-dto-validation.spec.ts:923`·`triggers.service.spec.ts:3094` 의 bare `hh_mm_ss` 인용을 전체 경로(`review/code/2026/09/11/11_05_27`)로 정정.
5. (선택) 다음 spec 갱신 시 `error-codes.md` 또는 `2-api-convention.md §5.3` 에 `common/` 레이어 리터럴 유지 근거 한 줄 보강.
