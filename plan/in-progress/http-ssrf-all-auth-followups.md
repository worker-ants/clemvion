---
worktree: (unstarted)
started: 2026-06-11
owner: developer
---

# Follow-ups — HTTP Request SSRF 전 인증 적용 후속

> 출처: `http-ssrf-all-auth` PR(04 C-3)의 ai-review(`review/code/2026/06/11/23_00_44`,`23_14_40`)
> + `--impl-done`(`review/consistency/2026/06/11/23_00_44`,`23_14_40`) Warning/INFO 중 본 P0 범위
> 밖으로 분리한 항목. C-3 핵심(SSRF 가드 전 인증 ungate)은 ai-review Critical 0 으로 종결.

## 코드
- [ ] **SSRF 에러 메시지 클라이언트 일반화**: `http-safety.ts` 의 `SSRF_BLOCKED: hostname "..."` 메시지가 차단 host/IP 를 `output.error.message` 로 노출(정찰 면). 클라이언트엔 일반화("Request blocked by SSRF policy"), 상세는 서버 로그 — 단 http-safety 는 HTTP/DB/Email 공용이라 3노드 영향 audit 동반.
- [x] **`HTTP_BLOCKED` enum 참조화**: `http-request.handler.ts` 의 `new IntegrationError('HTTP_BLOCKED', ...)` → `ErrorCode.HTTP_BLOCKED`. `error-codes.ts` 주석에 opt-out/`http-safety.ts` SoT 참조 추가(EMAIL_HOST_BLOCKED 주석 대칭). **(완료, PR errcode-wiring)**: `IntegrationError` + usage 로그 `error.code` 양쪽 literal → `ErrorCode.HTTP_BLOCKED`. `error-codes.ts` 주석에 http-safety SoT·opt-out env 추가.
- [ ] **(선택) env-read-once**: `ALLOW_PRIVATE_HOST_TARGETS` 시작시 1회 상수화 — 단 런타임 토글성 상실 트레이드오프 평가 후.
- [x] **(기획 결정) `DB_HOST_BLOCKED` 신설**: Database Query SSRF 차단이 generic `INTEGRATION_CALL_FAILED` 로 surface — HTTP(`HTTP_BLOCKED`)·Email(`EMAIL_HOST_BLOCKED`)과 비대칭. 신설 시 `2-database-query §4/§6.2`+`3-error-handling §1.4` 동기. **(사용자 결정=신설, PR db-host-blocked 그룹2b)**: ErrorCode 추가 + database-query.handler 가 SSRF 차단을 `DB_HOST_BLOCKED` IntegrationError 로 승격(EMAIL 패턴 대칭, 메시지 일반화로 host/IP 미노출). classifier INTERNAL_CODES 등재(spec §3.1 `DB_*` 일치, group1 INTERNAL_CODES 편집과 trivial 중복). spec `2-database-query §4/§5.3/§6.2`·`3-error-handling §1.4/§3.2` 동기. DB SSRF 교차조합 + opt-out + no-warn 테스트 추가.

## 테스트
- [x] none/custom × {IMDS, RFC1918, localhost} 교차 조합 `test.each`. custom opt-out. dry-run × none/custom SSRF skip. SSRF 차단(error 경로) configEcho Principle 7 D1 credential 미포함 단언. `backend-labels HTTP_BLOCKED` i18n 매핑 테스트. **(완료, PR test-code-http-hardening 그룹3)**: http 6-combo test.each + custom opt-out + dry-run skip test.each + configEcho userinfo strip(error 경로) + frontend backend-labels.test 에 HTTP_BLOCKED·DB_HOST_BLOCKED LOCALIZED_ERROR_CODES 등재 + translateBackendError 단위테스트.

## Spec (planner)
- [x] **§4 step8 dry-run 노트**: "dry-run 실행 시 실제 fetch 없으므로 SSRF 가드 생략(`13-replay-rerun §7`)" 1줄(ai-review I6/SPEC-DRIFT). **(완료, PR spec-errcode-catalog 그룹2a)**
- [x] **node-output.md D4 callout / Principle 7 D1 anchor**: 링크 anchor 정밀화. **(완료, 그룹2a — D4 callout 의 1-http-request §5.8 링크에 정밀 anchor 추가. Principle 7 D1 은 bold inline 이라 heading anchor 부재 — 구조 변경 보류, 본문 참조로 충분.)**
- [x] **§4.2 Usage 로깅 매트릭스**: SSRF 차단 행에 "integration 한정 기록; none/custom 은 error 포트만" 비고. **(완료, 그룹2a — 매트릭스 하단 note 추가)**
- [ ] **0-overview §6.1·mcp-client §3.2·4-execution-engine §10**: SSRF 전 인증 공통/meta.durationMs 동기화(--impl-done INFO). **(보류 — 별도 cross-spec 동기화 항목, 그룹2a 범위 밖.)**

## 타 plan/worktree 정리
- [ ] stale worktree 6건(`prod-fail-closed-guards` 등 PR MERGED) `cleanup-worktree-all.sh` 정리.
- [ ] `spec-fix-prod-guards-prose.md` frontmatter `worktree` stale 갱신.
