---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# config — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/2-navigation/6-config.md
>
> **Scope**: 본 plan 은 `6-config.md` 중 **Part A(인증 설정)** 의 미구현 gap 만 다룬다. **Part B/C(Models — Chat/Embedding/Rerank 통합)** 는 `plan/in-progress/unified-model-management.md` 가 담당한다 (두 plan 이 같은 spec frontmatter 에 공존하므로 scope 분리 명시).

## 미구현 항목
- [ ] §A.3 인증 사용량/이력 — **소스 IP** 컬럼 (호출 이력 테이블). 현재 `getUsage`(auth-configs.service.ts:399-450) 의 `recentCalls` 는 triggerName/status/startedAt 만 반환.
- [ ] §A.3 인증 사용량/이력 — **응답 코드** 컬럼 (호출 이력 테이블). 현재 미반환.
- [ ] §A.3 인증 사용량/이력 — **기간별 호출 수 (일/주/월 분해)**. 현재 누적 `totalCalls` 만 반환하고 기간 분해 없음.
- [ ] §A.2 공통 **IP Whitelist 설정 폼 UI**. 백엔드 DTO(`ipWhitelist`)는 지원하나 `authentication/page.tsx` 폼에 입력 UI 전무.
- [ ] §A.2 API Key **Header 이름 입력 필드** (default `X-API-Key`). 백엔드 DTO(`headerName`)는 지원하나 폼에 입력 필드 없음.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 및 `auth-configs.service.ts:399-450`, `authentication/page.tsx:81-89` 참조.
- §3 API 표 및 마스킹/Reveal/select-only(B.2/Rationale)는 코드와 1:1 정합 — 강등 대상 아님.
