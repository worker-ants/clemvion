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

> **구현 진척 (2026-06-14, impl-config-auth-gaps PR)**: decision-free §A.2 폼 2건 구현.
> §A.3 항목은 데이터 캡처/스키마·표시형식 결정이 필요해 분리(아래).

## 구현 완료 (decision-free)
- [x] §A.2 공통 **IP Whitelist 설정 폼 UI**: `authentication/page.tsx` 생성 폼에 모든 type 공통 textarea(한 줄에 IP/CIDR 하나) 추가, 빈 줄 제거 후 top-level `ipWhitelist` 배열로 송신(비면 미송신). i18n ko/en. 테스트 `authentication-form.test.tsx`.
- [x] §A.2 API Key **Header 이름 입력 필드** (default `X-API-Key`): api_key type 선택 시 노출, `config.headerName` 으로 송신(비우면 백엔드 기본값).

## 미구현 — 결정 필요 / 후속 (본 PR 범위 밖)
- [ ] §A.3 **소스 IP** 컬럼 — **결정 필요**. webhook 호출의 소스 IP 가 `execution` 등 어디에도 저장되지 않는다(`hooks.service.ts` 가 `extractClientIp` 로 추출만 하고 미저장). 스키마(컬럼/별도 call-log) + 캡처 경로 결정 선행.
- [ ] §A.3 **응답 코드** 컬럼 — **결정 필요**. 현재 `execution.status`(워크플로 상태 enum)만 존재하고 HTTP 응답 코드 미저장. "응답 코드" 의미(HTTP code vs status enum) + 스키마 결정 선행.
- [ ] §A.3 **기간별 호출 수 (일/주/월)** — **표시형식 결정 필요**. `started_at` 데이터는 존재(버킷팅만 필요)하나, 롤링 윈도(24h/7d/30d) vs 캘린더 버킷·숫자 vs 차트 표시 결정 선행.
- [ ] §A.2 **편집 폼** IP Whitelist / api_key Header 이름 입력 — 현재 생성 폼만 지원(편집 폼 자체가 없음, UI 는 생성·토글·재생성·삭제만). 편집 흐름 신설은 별도 범위.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 및 `auth-configs.service.ts:399-450`, `authentication/page.tsx:81-89` 참조.
- §3 API 표 및 마스킹/Reveal/select-only(B.2/Rationale)는 코드와 1:1 정합 — 강등 대상 아님.
