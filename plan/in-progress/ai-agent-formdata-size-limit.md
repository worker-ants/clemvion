---
worktree: ai-agent-formdata-size-limit-2ad8ff
started: 2026-05-24
owner: developer
---

# ai-agent-formdata-size-limit — render_form submit 후 formData 크기 cap

PR #301 (form-resubmit-fix) 의 ai-review `security` INFO #1 후속 hardening.

## 배경

PR #301 의 ai-review `security` reviewer 가 다음을 식별:

> `formData` 전체를 `JSON.stringify` 해 LLM tool_result 에 전달 시 입력 크기 제한 없어 토큰 DoS 잠재 위험.

현재 (PR #301 적용 후) `ai-agent.handler.ts` 의 `form_submitted` 분기:

```ts
const newToolResult: ChatMessage = {
  role: 'tool',
  toolCallId: pendingFormToolCall.toolCallId,
  content: JSON.stringify({
    ok: true,
    type: 'form_submitted',
    data: formData,            // ← 크기 제한 없음
    message: FORM_SUBMITTED_GUIDANCE_MESSAGE,
  }),
};
```

사용자가 form 에 대량 텍스트 (예: 100KB textarea) 를 입력하면 그 전체가 LLM 컨텍스트로 직접 들어가 token 비용 폭주 + LLM rate limit / context window 초과 위험.

## 채택안 (consistency-check 권고 반영 — 2026-05-24)

`render-tool-provider.ts` 의 `PRESENTATION_MAX_BYTES = 1MB` 패턴에서 **영감을 얻되 독립 결정** (알고리즘: per-field string truncate / 목적: 토큰 DoS 방어):

- **`FORM_SUBMITTED_MAX_BYTES = 10 * 1024` (10KB)** — form 입력은 텍스트 위주이므로 1MB 보다 작은 cap. ai-review security INFO #1 권장값.
- cap 초과 시 동작: 각 string field 의 값을 균등 truncate (`...<truncated>` 마커 부착). 모든 필드명/구조 보존 — LLM 이 어떤 필드가 잘렸는지 식별 가능.
- tool_result content 에 **`formDataTruncation` 메타 필드** 추가 (LLM-facing): `{originalBytes, bytesAfterCap, truncatedFields: string[]}`. LLM 이 truncate 사실을 reasoning 에 반영.
  - 필드명 `formDataTruncation` (consistency-check W-2 권고): 기존 `PresentationPayload.truncation` (carousel/table tail-truncate 메타) 과 키 이름 충돌 회피.
  - 프로퍼티명 `bytesAfterCap` (consistency-check W-5 권고): render-tool-provider 의 로컬 변수 `cappedBytes` 와 충돌 회피.
- `message` 필드는 truncation 케이스에도 동일 안내문 (재호출 금지 + 후속 행동 유도) 유지.

## 변경 범위

### 코드 (codebase) — developer skill 영역

선행 의존: **project-planner 위임 (spec 갱신) 완료 후 진행**. 순서 강제.

1. `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
   - `FORM_SUBMITTED_MAX_BYTES = 10 * 1024` 상수 신설 (`export const` — 테스트 import 용).
   - `capFormDataBytes(formData: Record<string, unknown>, capBytes: number): { capped, formDataTruncation? }` 헬퍼 신설.
     - JSON.stringify(formData) byte 길이 측정. cap 이하면 unchanged.
     - 초과 시 string 필드만 균등 truncate. 비-string (boolean / number / array / object) 은 그대로 유지 (보통 작음).
     - truncation 메타 반환.
   - `form_submitted` 분기 (현 line 1644-1657) 에서 헬퍼 호출 → tool_result content 에 truncation 메타 합성.

2. `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts`
   - cap 미만 input → unchanged 검증.
   - cap 초과 input → 각 string 필드 truncate + `formDataTruncation` 메타 부착 검증.
   - 비-string 필드 보존 검증.

### Spec (spec/) — project-planner 위임 영역

CLAUDE.md `spec/` read-only 룰 준수. consistency-check 의 W-1 (4개 checker 동일 지적) 반영:

1. `spec/4-nodes/3-ai/1-ai-agent.md` — **§12.7 신설** (§12.6 와 분리, 단일 책임).
   - 절 제목: "12.7 `render_form` submit 후 formData 크기 cap (2026-05-24)"
   - 본문: 문제·결정·shape 갱신(§4.1/§6.1.d.ii/§6.2 step 2.c 표기는 그대로, `formDataTruncation` 은 옵셔널 메타 한정)·다른 layer 영향 없음·근거.

2. `spec/4-nodes/6-presentation/0-common.md` — **§10.9 (4) layer 행 보강** (consistency-check W-3 반영).
   - (4) LLM tool_result content layer shape 에 `formDataTruncation?: {originalBytes, bytesAfterCap, truncatedFields[]}` 옵셔널 필드 명시.
   - 본 변경은 LLM-facing layer 한정 — (1)(2)(3) layer 영향 없음.
   - §Changelog 행 추가 (2026-05-24).

## 제외

- formData 외 field (workflow form 노드 본체의 form submit 등) 의 크기 제한 — 본 PR scope 외 (render_form tool 한정).
- production sessions / users.service 의 password_hash 입력 크기 — 본 PR scope 외 (별 plan task #14).
- `FORM_SUBMITTED_MAX_BYTES` 의 `truncate-output.util.ts` co-locate (consistency-check I-1 권고) — 별 chore 검토.

## 진행 체크리스트

1. - [x] plan 신설 (2026-05-24)
2. - [x] consistency-check `--plan` (`review/consistency/2026/05/24/18_00_25/`) — BLOCK: NO. W-1~W-5 모두 반영해 plan rewrite.
3. - [ ] project-planner 위임 — spec §12.7 신설 + 0-common.md §10.9 (4) layer 행 보강 + §Changelog.
4. - [ ] consistency-check `--impl-prep spec/4-nodes/3-ai` — dev 진입 의무.
5. - [ ] 테스트 선작성 (handler.spec — cap 미만/초과/비-string 보존).
6. - [ ] 헬퍼 + handler 분기 구현.
7. - [ ] TEST WORKFLOW (lint → unit → build → e2e).
8. - [ ] REVIEW WORKFLOW — 변경 면적 작아 router 가 알아서 부분집합 선별.
9. - [ ] plan complete 이동.

## consistency-check 발견사항 반영 요약

| # | Checker | 발견 | 본 plan 반영 |
|---|---------|------|--------------|
| W-1 | Cross-Spec / Rationale / Convention / Plan-Coherence (통합) | "dev 안 spec 직접 갱신" 자기-예외 근거 없음 | 본 rewrite — project-planner 위임으로 단일화 |
| W-2 | Convention / Naming | `truncation` 필드명이 PresentationPayload.truncation 과 키 공유 | `formDataTruncation` 으로 변경 |
| W-3 | Cross-Spec / Rationale / Convention | §10.9 동반 갱신 누락 | 보강 목록에 명시 |
| W-4 | Rationale | "동형" 표현 오도 — 알고리즘·목적 이형 | "영감 + 독립 결정" 으로 수정 |
| W-5 | Naming | `cappedBytes` 가 render-tool-provider 로컬 변수와 충돌 | `bytesAfterCap` 으로 변경 |
| I-2 | Cross-Spec / Naming | §12.6 vs §12.7 모호 | §12.7 신설로 단일화 |
| I-3 | Plan-Coherence | multiturn-error-preserve 와 동일 파일 (변경 절 다름) | 추적 — worktree 미개시 상태 (충돌 없음) |
