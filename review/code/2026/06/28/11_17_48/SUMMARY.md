# Code Review 통합 보고서

리뷰 세션: `review/code/2026/06/28/11_17_48`
변경 의도: agent-memory Batch 3 (X-Deleted-Count CORS expose + spec back-flow) + consistency 검토 산출물 2회(23_02_31, 00_48_38) 커밋

---

## 전체 위험도
**MEDIUM** — Webhook endpointPath capability token 보안 모델 공동화 및 RBAC 불일치(보안), spec 보안 정책 후퇴 시 Rationale 미기록 + 인접 spec outdated 기술(문서화) 등 WARNING 6건이 잔존하나, CRITICAL 발견은 없음

---

## Critical 발견사항

해당 없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `endpointPath` 서버 측 UUID 형식 강제(`@IsUUID('4')`) 제거 — capability token 보안 모델 공동화. API 직접 호출 시 예측 가능한 경로 등록 가능. plan W1 미해소 상태에서 spec이 먼저 후퇴했으며 인접 spec(trigger-list, admin-console)과 보안 전제 불일치 잔존 | `spec/5-system/12-webhook.md` WH-SC-01 / WH-MG-02, `create-trigger.dto.ts` | 서버 측 `@IsUUID('4')` 검증 복원 또는 서버 자동 발급 전환. 현행 유지 시 (1) capability token 전제 공식 폐기·보안 모델 재정의 (2) 인접 spec UUID 기술 동기화 (3) plan W1 처리 방향 확정 |
| 2 | 보안 | 멤버 관리 Delete 권한 — auth spec §3.2(RBAC SoT: Admin = CRU, Delete 없음) vs user-profile spec §4.2/§6.1 API(Admin+ = 멤버 삭제 허용) 명시적 충돌. 실제 RoleGate가 어느 spec을 따랐는지에 따라 의도치 않은 권한 승격 위험 | `spec/5-system/1-auth.md §3.2` vs `spec/2-navigation/9-user-profile.md §4.2, §6.1` | Admin 멤버 Delete 권한 여부를 확정하고 auth spec §3.2(RBAC SoT)를 기준으로 user-profile spec 및 RoleGate 구현을 단일화. 구현 코드 RoleGate 즉시 점검 |
| 3 | 문서화 | `spec/5-system/12-webhook.md` WH-SC-01/WH-MG-02 de-specification 시 Rationale 섹션 미갱신 — CLAUDE.md "결정의 배경·근거는 해당 spec 문서 끝의 Rationale" 규약 명시적 위반 | `spec/5-system/12-webhook.md` `## Rationale` | Rationale에 (1) 서버 UUID 형식 강제 미구현 수용 사유 (2) 현 보안 모델 한계 (3) plan W1 연결 기술 |
| 4 | 문서화 | `spec/2-navigation/2-trigger-list.md` 139·325행 — "UUID가 사실상 capability token" 서술이 현행 정책(임의 문자열 허용)과 명백히 불일치. 독자 오독 유발 | `spec/2-navigation/2-trigger-list.md` 139, 325행 | 현행 정책("유일성은 DB UNIQUE 제약, 예측 불가능성은 클라이언트 책임")으로 수정 |
| 5 | 문서화 | `spec/7-channel-web-chat/5-admin-console.md` 111·112·228행 — "공개 UUID" 및 "형식·유일성 제약" 기술이 서버 UUID 강제 제거된 현행 구현과 불일치. 보안 보장 과장 | `spec/7-channel-web-chat/5-admin-console.md` 111, 112, 228행 | 228행 "공개 UUID" → "공개 endpoint path", 112행 형식 관련 기술 갱신 |
| 6 | 문서화 | `spec/data-flow/12-workspace.md` Rationale — WorkspaceInvitationsPrunerService 삭제 및 만료 row 영구 잔존 정책 전환 결정 근거가 Rationale에 없음. CLAUDE.md 규약 위반 | `spec/data-flow/12-workspace.md` `## Rationale` | Rationale에 pruner 제거 사유 및 만료 row 잔존이 기능 정합성에 미치는 영향 없음 기술 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | Prompt Injection 방어 — data-fence 설계는 의도적이나 LLM 모델 교체 시 fence 효과 재검증 절차 필요 | `spec/5-system/17-agent-memory.md §3`, Rationale | Rationale에 "모델 교체 시 data-fence 효과 재검증 필요" 명시(비차단) |
| 2 | 보안 | `workspace_id` 격리 의무 선언 — scope 전체 삭제 쿼리의 `WHERE scopeKey = $1 AND workspace_id = $ws` 구조를 diff에서 직접 확인 불가 | `spec/5-system/17-agent-memory.md §5, §6`, `DELETE /agent-memories?scopeKey=` 구현 | 구현 코드에서 `workspace_id` 격리 필터 포함 여부 확인 |
| 3 | 보안 | `X-Deleted-Count` CORS `exposedHeaders` — 삭제된 행 수(정수)만 노출, 정보 노출 위험 낮음 | `spec/5-system/17-agent-memory.md §6`, `codebase/backend/src/main.ts` | `exposedHeaders: ['X-Deleted-Count']` 최소 필요 범위 한정 확인(비차단) |
| 4 | 요구사항 | AGM-13 요구사항 ID가 `X-Deleted-Count` 헤더 행위 및 CORS `exposedHeaders` 요건을 미포함 — 요구사항 ID 범위 불완전 | `spec/5-system/17-agent-memory.md §6` `> 요구사항 AGM-13` | AGM-13에 "삭제 건수 `X-Deleted-Count` 헤더 echo (0 가능 — 멱등), CORS `exposedHeaders` 포함" 추가 |
| 5 | 요구사항 | `plan_coherence.md`(23_02_31) — "CSPRNG 명문화"로 기술하나 실제 구현은 UUID 강제 제거(반대 방향). 이후 plan 추적 의사결정 오해 유발 가능 | `review/consistency/2026/06/27/23_02_31/plan_coherence.md` | "CSPRNG 강제 요건 de-specification(완화)"으로 수정 |
| 6 | 요구사항 | 리뷰 산출물 내부 자기모순 — 23_02_31 `plan_coherence.md`는 W1·W7 "완료 이동됨" 기술, 동 세션 `cross_spec.md`·`rationale_continuity.md`는 "열린 체크박스 잔존"으로 모순 | `review/consistency/2026/06/27/23_02_31/` | 실제로는 plan이 in-progress 잔존·W1·W7 미완임이 다수 산출물에서 확인 — plan_coherence 기술이 오류 |
| 7 | 유지보수성 | 리뷰 산출물 파일에 diff 섹션 + 전체 파일 컨텍스트 섹션 내용 중복(DRY 위반). 한 쪽 갱신 시 stale 불일치 위험 | `review/consistency/2026/06/27/23_02_31/`, `review/consistency/2026/06/28/00_48_38/` 하위 모든 .md 파일 | orchestrator가 두 표현 모두 필요한 이유 명시 또는 단일 섹션 통일 |
| 8 | 유지보수성 | `_retry_state.json` 절대경로 하드코딩 — `ai-mem-admin-frontend` worktree를 가리키나 현재 worktree는 `ai-mem-admin-rebase-df13f9`. 타 머신·워크트리 이동 시 즉시 오동작 | `review/consistency/2026/06/28/00_48_38/_retry_state.json` | session_dir를 실행 시점 동적 주입 또는 상대경로로 저장 |
| 9 | 유지보수성 | `_retry_state.json` session_dir 경로 `00_48_37`(37초) vs 실제 파일 위치 `00_48_38`(38초) — 1초 불일치로 재시도 로직 파일 미탐 위험 | `review/consistency/2026/06/28/00_48_38/_retry_state.json` | session_dir 및 subagent_invocations 경로를 실제 디렉토리(`00_48_38`)와 일치시킴 |
| 10 | 유지보수성 | `meta.json` 파일 trailing newline 누락 (`\ No newline at end of file`) | `review/consistency/2026/06/27/23_02_31/meta.json`, `review/consistency/2026/06/28/00_48_38/meta.json` | 파일 작성 시 trailing newline 추가. orchestrator에서 보장 로직 추가 |
| 11 | 유지보수성 | `spec/5-system/17-agent-memory.md` §6 — `X-Deleted-Count` 설명이 API 테이블 셀과 별도 bullet 두 곳에 중복 기술. 하나만 갱신 시 stale 위험 | `spec/5-system/17-agent-memory.md` §6 (라인 1545, 1550) | 테이블 셀은 간결 요약, 상세는 bullet에만 기술해 중복 제거 |
| 12 | 유지보수성 | 두 리뷰 세션(23_02_31, 00_48_38) 완성도 비대칭 — 23_02_31에 SUMMARY.md 없어 완료 여부 불명 | `review/consistency/2026/06/27/23_02_31/` | 세션 완성도 상태 마커(SUMMARY.md 존재 또는 STATUS: COMPLETE) 규약화 |
| 13 | 문서화 | `plan/in-progress/trigger-review-deferred-fixes.md` W1 — 채택 방향(UUID 강제 제거)과 반대로 기술. W7 — pruner 서비스 삭제됐음에도 미완 체크박스 잔존 | `plan/in-progress/trigger-review-deferred-fixes.md` W1, W7 | W1 설명 채택 방향으로 수정 또는 닫기. W7 "pruner 서비스 삭제 처리(영구 잔존 정책)"로 기술 후 닫기 |
| 14 | 문서화 | `spec/data-flow/12-workspace.md` §3.1 데이터 접근 패턴 표 196행 — "만료 정리(§3.1)" + `pruneExpired` 참조가 "pruner 호출자 없어 만료 row 영구 잔존" 본문과 내부 모순 | `spec/data-flow/12-workspace.md` 196행 | 196행 pruneExpired 언급 제거 또는 "호출자 없음 — 미구현" 주석 추가 |
| 15 | 문서화 | `spec/5-system/17-agent-memory.md` — 프로젝트 최초 커스텀 응답 헤더 컨벤션(`X-Deleted-Count`)의 채택 근거가 Rationale 미포함. `2-api-convention.md`에도 커스텀 응답 헤더 정책 부재 | `spec/5-system/17-agent-memory.md` Rationale, `spec/5-system/2-api-convention.md` | Rationale에 "삭제 건수 반환 — X-Deleted-Count 헤더 채택" 항목 추가. 장기 `2-api-convention.md`에 멱등 DELETE + 커스텀 카운트 헤더 컨벤션 신설 |
| 16 | 문서화 | `spec/5-system/8-embedding-pipeline.md` 293행 — dead-declared 이벤트 `document:graph_error`를 능동 이벤트 6개 중 하나로 기술. SoT(`10-graph-rag.md §6`)는 5개 이벤트만 emit | `spec/5-system/8-embedding-pipeline.md` 293행 | 5개 이벤트로 수정, `_error`는 dead-declared 주석 추가 |
| 17 | 문서화 | `spec/5-system/1-auth.md §2.1` Refresh Token 행 — "7일"만 표기, rememberMe=true 시 30일 variant 미기술 | `spec/5-system/1-auth.md §2.1` | "7일 (기본) / 30일 (rememberMe=true)"로 갱신 |
| 18 | API 계약 | `DELETE /agent-memories?scopeKey=` 의 `204 + X-Deleted-Count` 패턴이 프로젝트 최초 커스텀 응답 헤더 관례이나 `2-api-convention.md` 미등재 — scope 전체 vs 단건 삭제 응답 헤더 비대칭 발생 | `spec/5-system/2-api-convention.md`, `spec/5-system/17-agent-memory.md Rationale` | `2-api-convention.md`에 커스텀 응답 헤더 정책 추가 또는 Rationale에 scope 전체 삭제 한정 명시(비차단) |
| 19 | 테스팅 | CORS `exposedHeaders: ['X-Deleted-Count']` 설정 검증 단위 테스트 부재. 설정값 스냅샷으로 회귀 방지 가능 | `codebase/backend/src/main.ts` (line 189–191), `web-chat-cors.spec.ts` | `web-chat-cors.spec.ts` 또는 CORS 관련 단위 테스트에 `exposedHeaders` 필드 검증 케이스 추가 |
| 20 | 테스팅 | `clearScope` 서비스 계층 SQL RETURNING 절 방어 분기 미검증 — `deleteMemory`는 명시 검증, `clearScope`는 확인 필요 | `codebase/backend/src/modules/agent-memory/agent-memory-admin.service.spec.ts` | `clearScope` 구현의 affected 카운트 추출 경로 확인, 방어 분기 테스트 추가 |
| 21 | 테스팅 | 프론트엔드 페이지 테스트에서 삭제 후 scope 목록 re-fetch(invalidate) 동작 미검증 | `codebase/frontend/src/app/(main)/agent-memory/__tests__/agent-memory-page.test.tsx` | `waitFor` + `toHaveBeenCalledTimes(2)`로 re-fetch 검증 케이스 추가(선택적) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | endpointPath UUID 서버 검증 제거(capability token 공동화) + 멤버 Delete RBAC 불일치 (WARNING 2건) |
| documentation | MEDIUM | spec 보안 정책 후퇴 시 Rationale 미기록(webhook·workspace) + 인접 spec outdated UUID 보안 기술 (WARNING 4건) |
| requirement | LOW | 리뷰 산출물 내부 기술 역전·모순(INFO 4건). CRITICAL/WARNING 없음 |
| maintainability | LOW | _retry_state.json 절대경로 하드코딩·1초 불일치 + 리뷰 산출물 중복 구조(WARNING 2건, INFO 5건) |
| testing | LOW | CORS exposedHeaders 단위 테스트 부재 등 (INFO 3건) |
| api_contract | LOW | X-Deleted-Count 패턴 api-convention 미등재 + 단건/scope 삭제 응답 비대칭 (INFO 2건) |
| scope | NONE | 범위 이탈 없음 |
| side_effect | NONE | 런타임 부작용 없음 |

---

## 발견 없는 에이전트

- **scope**: 15개 파일 모두 변경 의도에 부합, 범위 이탈 없음
- **side_effect**: 실행 가능 코드 변경 없음, 부작용 없음. `_retry_state.json` session_dir 불일치는 INFO 수준

---

## 권장 조치사항

1. **(즉시·필수)** 멤버 Delete RBAC 불일치 해소: `spec/5-system/1-auth.md §3.2`(RBAC SoT)와 `spec/2-navigation/9-user-profile.md §4.2/§6.1` API, 실제 RoleGate 구현 중 Admin Delete 허용 여부를 확정하고 단일화. 권한 승격 위험 직결 사안.
2. **(중요·필수)** Webhook spec 보안 정책 방향 확정 및 인접 spec 동기화: (a) 서버 UUID 강제 복원 or 영구 완화 중 방향 결정 (b) 결정 근거를 `spec/5-system/12-webhook.md Rationale`에 기록 (c) `spec/2-navigation/2-trigger-list.md` 139·325행, `spec/7-channel-web-chat/5-admin-console.md` 111·112·228행 현행 정책으로 수정 (d) plan W1 처리 방향 확정.
3. **(중요·필수)** `spec/data-flow/12-workspace.md Rationale`에 pruner 제거 결정 근거 기록. §3.1 표 196행 pruneExpired 언급 제거 또는 "호출자 없음" 주석 추가.
4. **(권장)** `plan/in-progress/trigger-review-deferred-fixes.md` W1·W7 상태 수정: W1은 채택 방향(UUID 강제 제거)으로 기술 갱신, W7은 "pruner 삭제 처리" 기술 후 닫기.
5. **(권장)** AGM-13 요구사항 ID 범위에 `X-Deleted-Count` 헤더 echo 및 CORS `exposedHeaders` 추가.
6. **(권장)** `spec/5-system/17-agent-memory.md Rationale`에 X-Deleted-Count 헤더 채택 근거 및 scope 전체 삭제 한정 여부 명시. 장기 `2-api-convention.md`에 커스텀 카운트 헤더 컨벤션 신설.
7. **(선택)** CORS `exposedHeaders` 단위 테스트, `clearScope` 서비스 방어 분기 테스트, 삭제 후 목록 re-fetch 검증 케이스 추가.
8. **(인프라)** orchestrator `_retry_state.json` 생성 시 절대경로 대신 동적 주입·상대경로 사용, session_dir 1초 불일치 방지, meta.json trailing newline 보장.

---

## 라우터 결정

라우터가 reviewer를 선별 실행했습니다 (`routing_status=done`).

- **실행** (8명): `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`
- **강제 포함(router_safety)** (2명): `documentation`, `requirement`
- **제외** (6명):

  | 제외된 reviewer | 이유 |
  |-----------------|------|
  | performance | 변경 대상이 spec/review 문서 파일로 런타임 성능 영향 없음 |
  | architecture | spec back-flow 및 산출물 커밋, 아키텍처 변경 없음 |
  | dependency | 신규 의존성 추가 없음 |
  | database | DB 스키마/마이그레이션 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | user_guide_sync | 사용자 가이드 동기화 불필요 |