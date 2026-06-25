# Consistency Check 통합 보고서 (--impl-prep)

**BLOCK: NO** — Critical 없음. 구현 착수 가능.

> 대상 plan: `web-chat-ai-presentation-render.md`. WARNING 처분은 아래(전부 해소/비이슈/별 plan).

## 전체 위험도
**MEDIUM** — WARNING 3 / INFO 8. Critical 0.

## Critical
없음.

## 경고 (WARNING) — 처분

| # | Checker | 위배 | 처분 |
|---|---------|------|------|
| W-1 | Cross-Spec | PresentationPayload.type 은 5종(form 포함), plan 은 fast-path "4종" | **비이슈/올바름** — form 은 `ai_message.presentations[]` 가 아니라 `waiting_for_input(ai_form_render)` 경로로 옴(EiaAiMessageEvent 주석: "4종 display-only만 발화 대상, render_form 별도"). 위젯 PresentationBlock 도 form 렌더러 없음. 구현은 `PRESENTATION_KINDS`(4종)에 form 미포함 → form 은 fast-path fall-through→null(올바른 동작). |
| W-2 | Cross-Spec | `toTemplate` 의 `payload.content` 가 폐기 필드 의심, `payload.template` 유력 | **검증 후 content 확정** — `render-tool-provider.ts:71-72,204-207`: AI `render_template` 도구는 **`payload.content` 가 필수**("content (HTML/Markdown 본문) 가 필수"; `template.content must be a non-empty string`). 제 `toTemplate` 의 `output.rendered ?? output.content` 가 정확(노드=rendered, AI tool payload=content). spec 의 rendered/content-폐기 서술은 **노드 output 맥락** — AI tool payload 와 별개. |
| W-3 | Plan-Coherence | `web-chat-preview-improvements.md`(#703) 의 "AI render_* 와 동일 envelope 계약" 주장이 본 root cause 와 충돌 | **별 plan lifecycle** — #703 plan 의 그 가정이 바로 본 PR 이 교정하는 불완전 이해였음. #703 머지 완료된 plan 이라 `plan/complete/` 이동은 별도 hygiene(본 PR 범위 외). 현재는 무해(완료 plan 의 시점 기록). |

## 참고 (INFO) — 처분
- I-1(asEnvelope config=output=payload 의미혼용): 기능 정합 영향 없음(to* 가 양쪽 읽음). 수용.
- I-2(버튼 클릭 submit 책임 미명시): 버튼 클릭은 기존 `clickButton(id)→click_button` 그대로(범위 외). plan §주의 + 코드에 반영.
- I-3~I-5(완료 plan 이동/타 plan TBD): 별 plan, 직교. 조치 불요.
- I-6(`status:` frontmatter 중복): INFO, 현행 유지(#703 plan 도 동일).
- I-7(title/related_* 추가필드): 허용 범위.
- I-8(asEnvelope 명명 충돌 없음): OK.

## Checker별
- Cross-Spec: MEDIUM (W-1 비이슈, W-2 content 검증 완료)
- Rationale: NONE
- Convention: NONE
- Plan-Coherence: LOW (W-3 별 plan)
- Naming: NONE (asEnvelope 충돌 없음)

## 종합
BLOCK:NO. W-1(form)·W-2(content) 모두 코드로 검증해 현 구현이 올바름 확인. W-3 는 #703 완료 plan 의 별도 hygiene. 구현 진행.
