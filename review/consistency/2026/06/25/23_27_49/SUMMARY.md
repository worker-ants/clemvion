# Consistency Check 통합 보고서 (--impl-done)

**BLOCK: NO** — Critical 없음. 대상 `1db58757`. 5/5 checker 성공. 본 run 이 terminal 게이트.

## 전체 위험도
**LOW** — WARNING 2(전부 문서/plan advisory, 코드 정합) / INFO 12.

## Critical
없음.

## 경고 (WARNING) — 처분

| # | Checker | 위배 | 처분 |
|---|---------|------|------|
| W-1 | Cross-Spec | render_template body 필드명 — spec §10.1 은 `template`, backend `render-tool-provider.ts` 는 `payload.content` 사용(toTemplate content fallback 의 근본 원인) | **DEFER(코드 정확)** — 위젯 `toTemplate` 은 backend 실제(`content` 필수, render-tool-provider:204-207)와 정합. spec §10.1 ↔ backend 의 `content` vs `template` divergence 는 **본 위젯 버그수정 이전부터 존재**한 spec-impl 갭. 해소(spec 명시 또는 backend 정렬)는 project-planner/backend 후속(본 PR 범위 외). |
| W-2 | Plan-Coherence | `web-chat-preview-improvements.md §핵심 단순화`(#703)의 "presentation.ts 는 flat {config,output} 만 읽음" 가정이 본 dual-shape 변경으로 무효화 | **DEFER(별 plan)** — #703 이 가정한 envelope-동일 이해가 바로 본 PR 이 교정한 불완전 이해. #703 은 머지 완료된 plan 이라 `plan/complete/` 이동이 올바른 hygiene(별도, 본 PR 범위 외). 현재는 무해(완료 plan 의 시점 기록 + 본 SUMMARY 가 교정 기록). |

## 참고 (INFO) — 처분
- I-1(form 이 §7.10 PresentationPayload type 에 포함되나 PRESENTATION_KINDS 제외): 코드 정합(form=waiting_for_input 경로). 코드 주석(PRESENTATION_KINDS)에 명시함. spec 보충은 후속.
- I-2/I-4(asEnvelope dual-shape 정규화 결정 spec/Rationale 미기록): presentation.ts 모듈 주석·asEnvelope JSDoc 에 결정 명시(코드 SoT). spec Rationale 보충은 후속.
- I-3(carousel static+itemButtons): 코드 정합. carousel spec 보충 후속.
- I-5(content fallback 결정 spec 미명시): W-1 과 동일 — render-tool-provider 가 SoT, 코드 정합. spec-doc 후속.
- I-6/I-7(plan 완료 이동 시 status:complete·spec_impact:none): **완료 이동 PR 에서 처리**(현 in-progress 단계 무결).
- I-8(#703 Phase 4 §I1 추적): W-2 와 동일, 별 plan.
- I-9~I-12(naming): 충돌 없음, 조치 불요.

## Checker별
- Cross-Spec LOW(W-1 spec-impl 갭, 코드 정합) / Rationale LOW(결정 spec 미기록, 코드 주석 보완) / Convention NONE / Plan-Coherence LOW(W-2 별 plan) / Naming NONE.

## 종합
BLOCK:NO. WARNING 2 전부 코드 무관 문서/plan advisory(W-1 기존 spec-impl 갭·코드는 backend 정합, W-2 #703 완료 plan hygiene). 위젯 코드는 backend·spec 계약(presentations inline 렌더) 충족. 머지 가능. spec-doc 보충(W-1/I-5, asEnvelope Rationale)은 project-planner 후속 백로그.
