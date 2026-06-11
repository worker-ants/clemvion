# RESOLUTION — auth-config-audit (auth-config-webhook-followups §1)

본 PR: `spec/5-system/1-auth.md §4.1` 이 약속한 **AuthConfig CRUD 감사 로그**(`auth_config.create/update/delete/regenerate`) 구현. 기존엔 `reveal` 만 기록. G-01 const 인프라(PR #543) 위에서 진행.

검토 산출물:
- **ai-review** `review/code/2026/06/11/21_50_33` (authoritative, diff-base=`origin/main..HEAD`) — RISK LOW, Critical 0, **Warning 3**.
- **consistency** `review/consistency/2026/06/11/22_00_31` (`--impl-done`) — **BLOCK: NO**, Warning 7.

판정: **차단 없음.** ai-review Warning 3 + 저비용 INFO + SPEC-DRIFT 는 fix, 나머지는 pre-existing/out-of-scope 로 백로그 이월. substantive reviewer 중 scope=NONE, 그 외 전부 LOW.

---

## 0. stale-base 경위 (중요)
최초 ai-review `21_50_33` 이전에 실행한 `21_35_35` 는 **무효**다. 브랜치 base(d1cf5cdc) 이후 origin/main 이 **#544**(`fix(model-config): /api/model-configs 400`)로 advance 했고, 2-dot `origin/main..HEAD` diff 가 내 브랜치를 "#544 model-config fix 를 되돌린 것" 으로 오표시 → model-config CRITICAL 2건은 전부 **stale-base False Positive**(내 7파일에 model-config 전무, 3-dot diff 로 확인). **origin/main(7d1d6472)으로 rebase** 후 `21_50_33` 재실행 = 내 변경만 검토된 authoritative 결과. `21_35_35` 는 삭제.

---

## 1. ai-review (21_50_33) 조치 항목

| # | 발견 | 처분 | commit |
|---|------|------|--------|
| W-1 | controller `@ApiForbiddenResponse` 'Editor 미만'→'Admin 미만' (create/update/remove 는 `@Roles('admin')`) | **fix** | `6ed63bf0` |
| W-2 | `ipAddress=undefined`(req.ip 미설정) 케이스 테스트 부재 | **fix** (create 케이스 추가) | `6ed63bf0` |
| W-3 | update/regenerate/remove JSDoc `@param` 미기재 | **fix(결정)** — `{@link create}` 단일 참조로 param·best-effort 계약 중앙화(리뷰어가 허용한 옵션). 4메서드 중복 @param 대신 의도적 단일 SoT | `17dea2e7` |
| INFO#7 | regenerate 테스트 `workspaceId` 검증 누락 | fix | `6ed63bf0` |
| INFO#9 | reveal 성공 테스트 `ipAddress` 검증 누락 | fix | `6ed63bf0` |
| INFO#10 | reveal passwordHash-none 케이스 `mockClear`+음성 단언 누락 | fix | `6ed63bf0` |
| INFO#14 | `'auth_config'` 리터럴 4중 → `AUTH_CONFIG_RESOURCE_TYPE` 상수(5 call site) | fix | `6ed63bf0` |
| SPEC-DRIFT#12 | data-flow §1.1 call site 수 9→13 | fix | `6ed63bf0` |
| (best-effort 명시) | service 4메서드 JSDoc `@remarks` — record() 내부 swallow, 롤백 없음 | fix | `17dea2e7` |

### 보류 (pre-existing / out-of-scope — 백로그)
- **INFO#1/#2** (`req.ip` vs spec §2.3 IP 추출 정책 CF-Connecting-IP→XFF→req.ip): **기존 reveal 핸들러와 동일 패턴**(내가 도입한 회귀 아님). 공통 IP 헬퍼 추출은 reveal 포함 광범위 변경 — 이미 `auth-config-webhook-followups.md §3`(project-planner)이 IP 정책 명시를 추적. 이월.
- **INFO#11** (`basic_auth` regenerate 무동작-but-audit): regenerate 의 basic_auth no-op 은 **pre-existing 동작**(자동 발급 secret 없음). audit 만 추가됐을 뿐. BadRequestException 추가는 동작 변경 → spec 결정 필요(project-planner). 이월.
- **INFO#15** (`crypto` namespace+named 이중 import), **INFO#17** (`getUsage` magic `20`): 내 diff 밖 pre-existing 위생. cross-audit G-01 review 에서도 동일 백로그 처분. 이월.
- **INFO#13** (`WORKSPACE_TRANSFER_OWNERSHIP` 시제 근거): const JSDoc 의 도메인별 시제 노트가 integration/execution/auth_config 를 커버. 복합명사 1건 근거는 minor. 이월.
- **INFO#16** (테스트 `USER`/`userId` 중복 상수): 순수 cosmetic, 기능·커버리지 무관. 이월.
- **INFO#3/#4/#5/#6/#8** (basic_auth at-rest 암호화 문서·constantTime 길이·Object.assign·reveal rate-limit·controller 전파 단위테스트): 전부 pre-existing 설계 또는 plan §4 추적 중. 컨트롤러 userId/ip 전파는 **webhook-trigger·audit-logs e2e(188 통과)가 end-to-end 검증**. 이월/커버됨.

---

## 2. consistency --impl-done (22_00_31) Warning 처분

| # | 발견 | 처분 |
|---|------|------|
| W-6 | auth_config 현재형 근거가 code JSDoc 에만, spec 미반영 | **fix** — §4.1 naming 단락에 근거 한 문장 추가 (docs commit) |
| W-1 | 동일 worktree 병렬 §4.1 편집(audit-coverage-naming) | **이미 해소** — audit-coverage-naming=PR #543 머지 완료, 본 브랜치는 그 위(7d1d6472)로 rebase 됨. silent overwrite 불가 |
| W-2 | OPEN PR #545 가 §4.1 의 const 링크 경로 수정 중 | merge 조율 사안(내 결함 아님). #545 머지 시 충돌 가능 — merge-coordinator/머지 시점 해소. 이월 |
| W-3 | Planned `password_change`/`2fa_*` dot-prefix 미준수 | 내가 **구현 안 하는** Planned(auth/user 도메인). resource prefix(auth.* vs user.*) 결정 필요 → spec-sync 백로그(project-planner) |
| W-4 | `4-integration §14.3` 에 `integration.updated` 누락 | 파생 문서 갭(내 diff 밖). PR #543 consistency 에서도 동일 백로그. project-planner 이월 |
| W-5 | `document:graph_error` dead-declared 잔류(nav/websocket) | 무관 KB/graph-rag 도메인 pre-existing. 백로그 |
| W-7 | `11-mcp-client.md` `## Rationale` 섹션 부재 | 무관 MCP spec 구조 nit. 백로그 |

INFO I-12(stale worktree cleanup), I-10/I-11(plan 추적) 등은 housekeeping/추적 메모.

---

## 3. TEST 결과
- **lint**: 통과 (eslint 0 errors, auth-configs+audit-logs)
- **unit**: 통과 (backend 전체 337 suites / 6620 passed; auth-configs+audit-logs 47 passed — CRUD audit 4 + ipAddress-undefined 1 + reveal 음성 포함)
- **build**: 통과 (`nest build` clean)
- **e2e**: 통과 (32 suites / **188 passed**, audit-logs.e2e 포함). 기능 코드 최종본(`17dea2e7`) 기준 실행. 이후 커밋 `6ed63bf0`(Swagger 설명·JSDoc·`AUTH_CONFIG_RESOURCE_TYPE` 상수=동일 문자열·테스트·spec) 및 W-6(spec)은 **런타임 무변경**이라 e2e 결과 유효.

## 4. 보류·후속 항목 (별건)
- spec-sync 백로그(project-planner): Planned 감사 액션 dot-prefix 통일(W-3), `4-integration §14.3` integration.updated(W-4), `document:graph_error` 정리(W-5), `11-mcp-client.md` Rationale(W-7).
- IP 추출 정책 공통 헬퍼(§2.3) — `auth-config-webhook-followups.md §3`.
- PR #545 와 §4.1 const 링크 경로 충돌 — 머지 시점 조율.
- `auth-config-webhook-followups.md` §2~4(chatChannel 순서·spec 보완·reveal rate-limit) 미착수 잔여.
