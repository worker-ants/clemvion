---
worktree: integration-attention-filter-053b74
started: 2026-05-16
owner: developer
---

# Integrations 페이지 "주의 필요" 배너 — Attention 필터 도입

## 배경

`/integrations` 페이지 상단의 "주의 필요" 배너가 spec 의도와 어긋남:

- `needsAttention()` (frontend/src/app/(main)/integrations/_shared/status-badge.tsx:89) 은 `expiring + expired + error` 3종 합산
- 알림 문구도 "(만료, 만료 임박, 또는 오류)" 로 3종 언급
- 그러나 클릭 핸들러는 `updateParam("status", "expiring")` 하드코딩 → 만료 임박 1종 필터로만 이동
- 결과: 사용자가 알림에 표시된 만큼의 항목을 필터 화면에서 보지 못함 (특히 `error` 케이스)

Spec `spec/2-navigation/4-integration.md` §2.4 는 이미 "클릭 시 상태 필터를 `Expiring | Expired | Error`로 자동 전환" 을 명시 → 구현 버그 + spec 의 운용 모드(단일 선택 칩 vs. 합집합) 명세가 미진함.

## 적용 안 (안 A — "주의 필요" 통합 필터)

### 백엔드

- `INTEGRATION_STATUSES` 에 `'attention'` 추가 (backend/src/modules/integrations/dto/integration.dto.ts:20)
- `IntegrationsService.findAll` 의 status 분기에 `attention` 추가 (backend/src/modules/integrations/integrations.service.ts:190 부근):

  ```ts
  else if (status === 'attention') {
    qb.andWhere(
      `(i.status IN ('expired','error')
        OR (i.status = 'connected'
            AND i.token_expires_at IS NOT NULL
            AND i.token_expires_at > NOW()
            AND i.token_expires_at <= NOW() + INTERVAL '7 days'))`
    );
  }
  ```

  > `pending_install` 은 spec §2.4 에 따라 attention 에서 제외.

- DTO Swagger description 갱신 — `attention=주의 필요(만료/만료 임박/오류 합집합)` 추가

### 프론트

- `ListStatusFilter` 에 `"attention"` 추가 (frontend/src/lib/api/integrations.ts:5-10)
- `STATUS_FILTERS` 에 `{ value: "attention", labelKey: "integrations.statusAttention" }` 추가 (frontend/src/app/(main)/integrations/page.tsx:36)
- 알림 배너 (line 168-181):
  - 클릭 시 `updateParam("status", "attention")` 으로 변경
  - **분해 카운트** 표시: "통합 N건이 주의가 필요해요 — 만료 X · 만료 임박 Y · 오류 Z"
  - **단일 건일 때**: 클릭 시 `/integrations/<id>` detail 페이지로 직접 점프 (필터링 단계 생략)
  - **error 가 포함된 경우**: 배너 톤을 amber → red 미세 강조 (좌측 dot/border 색만 변경)
- `status-badge.tsx` 에 `attentionBreakdown(integrations)` 헬퍼 추가 — `{ expired, expiring, error, total, mostUrgentId }` 반환

### i18n

- `dict/{ko,en}/integrations.ts` 에 신규 키:
  - `statusAttention` — `"주의 필요"` / `"Attention"`
  - `attentionTitlePlural` — `"통합 {{count}}건이 주의가 필요해요"`
  - `attentionTitleSingle` — `"통합 1건이 주의가 필요해요"`
  - `attentionBreakdown` — `"만료 {{expired}} · 만료 임박 {{expiring}} · 오류 {{error}}"`
  - `attentionClickToFilter` — `"필터링하려면 클릭"` / `"Click to filter"`
  - `attentionClickToOpen` — `"열려면 클릭"` / `"Click to open"`
- 옛 키 `attentionPrefix`, `attentionSuffix`, `attentionSingle` 은 제거 (사용처 한 곳뿐).

### Spec 갱신 (project-planner 위임 예정)

- §2.1 ascii: 상태 칩 라인에 `[Attention]` 칩 추가, 배너 카피를 분해 카운트 형태로 수정
- §2.3 상태 칩 옵션에 `Attention` (= `Expiring | Expired | Error` 합집합) 추가, 단일 선택 의미 유지
- §2.4 배너:
  - 클릭 동작을 "Attention 필터(=합집합)로 전환" 으로 명확화
  - 본문에 분해 카운트(만료/만료 임박/오류 별 N) 표시 명세 추가
  - 단일 건일 때는 detail 페이지로 점프 명세 추가
  - error 가 ≥1 포함되면 톤 강조 명세 추가
- Rationale 보강 — "왜 합집합 필터를 단일 상태로 노출하는가" (단일 칩 + 다중 status 의 표현 한계)

## 작업 체크리스트

- [x] (developer) plan 노트 작성 — 본 파일
- [x] (developer) /consistency-check --impl-prep — `review/consistency/2026/05/16/13_26_15/`. BLOCK: NO. WARNING 7건은 (a) spec 갱신 선행 (W2/W1/W3 → 처리됨), (b) 본 plan 과 함께 처리할 네이밍 충돌 (W6/W7 → 구현 단계에서 처리), (c) 별 plan 영향 (W4/W5 → 본 plan 자체에 spec phase 격상)
- [x] (developer in-skill) spec 갱신 §2.1/§2.3/§2.4/§9.1/§11.4 + Rationale "Attention 가상 필터값"
- [x] (developer) /consistency-check --spec — `review/consistency/2026/05/16/13_36_06/`. BLOCK: NO. WARNING 9건 중 본 작업 관련 W3/W7 처리. 나머지(W1·W2·W4·W5·W6·W8·W9)는 [follow-up](#follow-up--본-작업-범위-밖) 참고
- [ ] (developer) i18n dict 갱신 (ko/en parity) — 신규 키 `statusAttention`, `attentionTitlePlural`, `attentionTitleSingle`, `attentionBreakdown`, `attentionClickToFilter`, `attentionClickToOpen`; 옛 키 `attentionPrefix`/`attentionSuffix`/`attentionSingle` 제거
- [ ] (developer) backend status='attention' 분기 + 단위 테스트
- [ ] (developer) frontend banner/filter/jump 구현 + 단위 테스트
  - `computeAttentionBreakdown(integrations)` 헬퍼 — `needsAttention()` 재사용해 단일 진실 유지 (W7 해소)
  - i18n 키 `attentionBreakdown` 과 함수 `computeAttentionBreakdown` 의 prefix 분리 — W6 해소
- [ ] (developer) TEST WORKFLOW (lint·unit·build·e2e)
- [ ] (developer) /ai-review + RESOLUTION

## Follow-up — 본 작업 범위 밖

본 worktree 의 PR 범위 밖이며, 별 plan 또는 본 plan 머지 후 후속 정리 대상:

- **W1 (cross_spec)**: `spec/5-system/4-execution-engine.md §10` Integration handler 계약과 본 spec §14.1 의 `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` 구분 cross-link 확인. 별 spec consistency 작업.
- **W2 (cross_spec)**: `spec/5-system/11-mcp-client.md` Internal Bridge 의 `IntegrationSelector` 가 `pending_install` 을 선택 불가 처리하는지 spec 명시. 별 spec 작업.
- **W4 (cross_spec/convention)**: `spec/5-system/2-api-convention.md` 또는 `spec/conventions/swagger.md` 에 "가상 필터값" 규약 추가. 본 spec §2.3 와 §9.1 에는 명시했으나 규약 문서 자체에 박제 필요.
- **W5 (convention)**: §9.4 에러 응답 포맷 `{ code, message }` vs `{ error: { code, message } }` 모순. 본 spec 갱신과 무관한 기존 이슈.
- **W6 (convention)**: spec 본문 상단 `## Overview` 섹션 누락 — 영역 패턴(다중 spec 파일에서 `_product-overview.md` 가 담당) 으로 의도된 것일 수 있음. CLAUDE.md 권장 3섹션 규약에 예외 명문화 필요.
- **W8 (plan_coherence)**: `spec-update-cafe24-background-refresh.md` 가 산출물 반영 완료지만 체크박스 미갱신. `git mv` 로 `plan/complete/` 이동 — 본 worktree 와 무관한 별 plan 의 housekeeping.
- **W9 (plan_coherence)**: `spec-update-cafe24-app-url-reuse.md` (worktree `cafe24-app-url-reuse-f9a2e3`) 가 동일 spec 파일의 §3.2·§4.4·§6·§9.2 를 다룸 — 본 worktree 와 수정 영역(§2.x, §9.1, §11.4) 이 겹치지 않으므로 merge 시 conflict risk 낮음. 본 PR merge 시점에 재확인.

## 영향 범위

- 백엔드: `backend/src/modules/integrations/` (DTO + service + spec)
- 프론트: `frontend/src/app/(main)/integrations/page.tsx`, `_shared/status-badge.tsx`, `lib/api/integrations.ts`, `lib/i18n/dict/{ko,en}/integrations.ts`
- spec: `spec/2-navigation/4-integration.md`
- 기존 동작과의 호환성: 옛 URL `?status=expiring` 은 그대로 동작 (filter 옵션 일부로 남음). 신규 `?status=attention` 은 추가 옵션.
