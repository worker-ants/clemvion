---
worktree: form-resubmit-fix-b1caa8
started: 2026-05-24
owner: developer
---

# form-resubmit-fix — render_form submit 후 동일 form 재호출 회귀 차단

관련 spec:
- `spec/4-nodes/3-ai/1-ai-agent.md` §4.1 도구 카탈로그 표 / §6.1.d.ii / §6.2 step 2.c / §12 Rationale
- `spec/4-nodes/6-presentation/0-common.md` §10.9 4-layer SSOT (4) layer / §Rationale `form submission wire format wrap` / §Changelog

관련 commit (회귀 시점 추정):
- `30e02117` — tool_result content shape 이 `{ok:true, pending:'form_submission'}` (stub) → `{type:'form_submitted', data:{…}}` (submit 후) 로 바뀌면서 `ok:true` 가드 신호 소실.

## 문제

사용자가 AI Agent 의 `render_form` 으로 띄운 form 을 submit 한 직후, 같은 turn 의 LLM 응답이 **동일한 `render_form`** 을 다시 emit 해 form 이 또 떠 버린다. (스크린샷 2026-05-24: subject=대량구매 / content=1000개 구매하려는데… 제출 후 "샘플상품 1 문의하기" form 이 재렌더링됨.)

## 원인

- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` §6.2 step 2.c 분기 — submit 시 tool_result content 가 `JSON.stringify({type:'form_submitted', data: formData})`. 안내문 / `ok` 가드 신호 모두 없음.
- 같은 파일 `PRESENTATION_TOOLS_GUIDANCE` — "재호출 금지" 가드가 `{ok:true, rendered:true, ...}` 패턴만 명시. `form_submitted` 케이스 미커버.
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` display-only 경로의 tool_result 와 대조 시, "Do NOT call render_${type} again" 안내가 form_submitted 경로엔 없음.
- handler 의 `form_submitted` 분기는 `messages.push({role:'user', ...})` 도 안 함. 모델이 보는 마지막 메시지가 tool_result 한 개뿐 → 그 안의 `data.{subject, content}` 가 user 입력처럼 읽혀 LLM 이 "새 문의 요청" 으로 오독.

## 채택 shape (consistency-check 반영 — 2026-05-24)

tool_result content:

```ts
{
  ok: true,               // LLM 재호출 가드 신호 (display-only 경로와 동형)
  type: 'form_submitted', // 기존 SoT 유지 (4-layer (4))
  data: formData,         // 기존 SoT 유지
  message: '<안내문>',     // LLM-facing 재호출 금지 + 후속 행동 유도
}
```

**기각된 추가 필드** (consistency-check 권장 반영):
- `rendered: false` — display-only 의 `rendered: true` (성공 표시 신호) 와 같은 키를 공유해 LLM 이 "표시 실패" 로 오독할 위험. 제거.
- `status: 'form_submitted'` — 기존 `type: 'form_submitted'` 와 동일 값 중복. 권위 신호 모호. 제거.

shape SoT 유지 (기존 `{type, data}` 호환) + 가드 필드 2개 (`ok`, `message`) 만 보강 → 4-layer SSOT 의 다른 layer (NodeOutput interaction.type / internal bus sentinel / WS wire) 영향 0.

## 변경 범위

### 코드 (codebase) — developer skill 영역

선행 의존: **project-planner 위임 (spec 갱신) 완료 후 진행**. 순서 강제.

1. `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `form_submitted` 분기 (현재 §6.2 step 2.c 의 tool_result content 채우는 라인) — `JSON.stringify({type:'form_submitted', data: formData})` 를 위 채택 shape 으로 변경.
2. 같은 파일 `PRESENTATION_TOOLS_GUIDANCE` — `form_submitted` 처리 라인 추가:
   - 수신 시 같은 form 재호출 금지
   - 결과를 받아 후속 답변 / 다른 도구 호출 / turn 종결로 진행

### Spec (spec/) — project-planner 위임 영역

1. `spec/4-nodes/3-ai/1-ai-agent.md`
   - §4.1 도구 카탈로그 표의 `render_form` 행 `tool_result` 칸 — 채택 shape 표기로 갱신 (`{ok:true, type:'form_submitted', data:{…}, message:'<...>'}`).
   - §6.1.d.ii `render_form` interactive — submit 시 tool_result content 채움 설명에 가드 필드 (`ok:true`, `message`) 명시.
   - §6.2 step 2.c — 동일.
   - §12 Rationale 신설 절 "render_form submit 후 LLM 의 동일 form 재호출 회귀 차단 (2026-05-24)":
     - 회귀 시점 (`30e02117` PR #299) 식별
     - 가드 필드 (`ok`, `message`) 도입 근거
     - `rendered: false` / `status: 'form_submitted'` 기각 이유 (§12.5 의 `rendered:true` 와의 의미 충돌 + `type:'form_submitted'` 와의 중복)
     - LLM reasoning autonomy 침해 금지 원칙 (§12.5) 과의 정합: 본 `message` 는 상태 신호이며 행동 강제가 아님

2. `spec/4-nodes/6-presentation/0-common.md`
   - §10.9 4-layer SSOT 표 (4) layer 행 — 채택 shape 표기로 갱신.
   - §Rationale `form submission wire format wrap` 의 "LLM tool_result content (`{type:'form_submitted', data:{…}}`, ai-agent §6.2 step 2.c) 는 LLM-facing layer. 변경 불요 — 이미 동형 shape 으로 명시되어 있다." 단락 갱신 — LLM-facing layer 에 재호출 가드 필드 (`ok:true`, `message`) 가 함께 직렬화된다는 점 + 그 외 layer 는 변경 없음을 명시.
   - §Changelog 행 추가 (2026-05-24, 변경 사유 한 줄).

### 테스트 (codebase) — developer skill 영역

선행 의존: 위 spec 갱신 완료 후.

- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts` 또는 `ai-agent.thread.spec.ts`
  - form submit 후 LLM 에 들어가는 messages 의 마지막 tool_result content 가:
    - `ok: true` 포함
    - `type: 'form_submitted'` 포함
    - `data` 가 formData 와 동등
    - `message` 가 "다시 호출하지" 안내문 substring 포함
  - 검증하는 unit test 추가.
- `PRESENTATION_TOOLS_GUIDANCE` (또는 systemPrompt 생성 통합 테스트) 에 `form_submitted` 라인이 포함되는지 검증 unit test 1건.

## 제외 (이 PR 에서 안 함)

- render-tool-provider 의 same-execution form idempotency 가드 — 위 변경으로 회귀가 닫히는지 먼저 검증. 추후 별도 plan.

## 진행 체크리스트

1. - [x] 스펙 분석 (§6.2 step 2.c / §10.9 step 4 의 LLM tool_result content layer 표현 확인)
2. - [x] 사용자 결정: spec 동반 갱신을 본 PR 에 포함 (2026-05-24, AskUserQuestion 응답)
3. - [x] consistency-check `--plan plan/in-progress/form-resubmit-fix.md` (`review/consistency/2026/05/24/16_37_48/`) — Critical 3건 (frontmatter) + WARNING 다수 → plan 본 rewrite 로 해소
4. - [x] project-planner 위임 — spec 본문 + Rationale 보강 (§4.1 표 / §6.1.d.ii / §6.2 step 2.c / §12 Rationale 신설 / §10.9 (4) layer / §Rationale `form submission wire format wrap` / §Changelog)
5. - [x] consistency-check `--impl-prep spec/4-nodes/3-ai spec/4-nodes/6-presentation` — developer 흐름 진입 의무 (`/consistency-check --impl-prep ...`)
6. - [x] 테스트 선작성 (handler.spec, 실패 확인)
7. - [x] 코드 구현 (handler.ts form_submitted 분기 + PRESENTATION_TOOLS_GUIDANCE + FORM_SUBMITTED_GUIDANCE_MESSAGE export)
8. - [x] 테스트 보강 (`__raw__` fallback 경로, toEqual(상수) 단언 강화, mock.calls.at(-1))
9. - [x] TEST WORKFLOW — lint / unit (4687) / build / e2e (108/108) 모두 PASS. 부수: chat-channel-{slack,discord} e2e fixture schema 정합 (PR #300 의 사전 결함, 사용자 결정으로 본 PR 결합)
10. - [x] REVIEW WORKFLOW — `/ai-review` (review/code/2026/05/24/17_12_34/) 9 reviewer 활성. Critical 0, WARNING 7 모두 처리, RESOLUTION.md 작성. 보류: W1 e2e password_hash 평문 (별 plan)
11. - [x] plan complete 이동 (본 commit)

## 부수 후속 (본 PR 외)

- `plan/in-progress/ai-presentation-tools.md` — PR #271 머지 (2026-05-22) 후 `plan/complete/` 이동 누락. 본 작업 안에서 처리하지 않음 (scope drift 방지). 별도 chore PR 또는 다음 grooming session 으로 분리.
- `plan/in-progress/ai-timezone-kst-e2e.md` Phase B systemPrompt substring 단언이 본 PR 의 `PRESENTATION_TOOLS_GUIDANCE` 추가 라인을 fixed 값으로 포함하지 않도록 작성 시 주의 (호환성 확보용 노트). 본 PR 의 직접 변경 대상 아님.
