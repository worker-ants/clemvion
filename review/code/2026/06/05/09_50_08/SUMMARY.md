# Code Review 통합 보고 — AI Agent 메모리 가시화/삭제 (A1)

**BLOCK: NO** — Critical 0건. 전 14개 중 10개 reviewer 수행(변경 성격에 맞춘 fan-out). 전원 BLOCK:NO.
대상 diff: `9f30216f..HEAD` (커밋 a3adf16a spec · 1b98ff02 backend · 862c736d frontend · 7d7c20d6 plan · 737f1a85 pre-existing fix).

전체 게이트: lint PASS · unit PASS(backend 6098 / frontend 191 files) · build PASS · e2e PASS(168).

## 위험도: LOW~MEDIUM (Critical 없음, 보안 1건은 즉시 fix 대상)

---

## Critical
_없음._

## Warning (조치 분류)

### 즉시 fix (보안·정합·spec·테스트)
| # | reviewer | 발견 | 조치 |
|---|---|---|---|
| F1 | side-effect/security | GET `/agent-memories(/scopes)` 에 `@Roles` 부재 → `X-Workspace-Id` 헤더 스푸핑으로 멤버 아닌 워크스페이스 조회 가능(RolesGuard 멤버십 미검증). DELETE 는 `@Roles('editor')` 로 이미 방어 | GET 2개에 `@Roles('viewer')` 추가 |
| F2 | testing/security | 신규 4 엔드포인트 **e2e 부재** — ValidationPipe/ParseUUIDPipe/RolesGuard 실 체인·cross-workspace 404·viewer 403·400 미검증 | `agent-memory-admin.e2e-spec.ts` 신규 |
| F3 | user-guide-sync | `agent-memory.en.mdx` frontmatter 완전 부재 → locale title/summary·registry 가드 영향 | ko 대칭 frontmatter 추가 |
| F4 | user-guide-sync | ko/en mdx `<ImplAnchor kind="ui-entry">` 부재(user-guide-evidence §3.1) | 양 파일에 anchor 추가 |
| F5 | requirement | 빈 상태 "설정 안내 링크"(spec §2 약속) 가 평문 텍스트로만 | 가이드/노드 안내 링크 추가 |
| F6 | testing | service 테스트 갭: kind+offset>0 파라미터 순서, clearScope 0건 | 테스트 추가 |
| F7 | maintainability | `memoryTotal` 헤더가 `scopes.count` i18n 키 재사용 | `memories.count` 키 신설 |

### 정리(quick win)
| # | reviewer | 발견 | 조치 |
|---|---|---|---|
| Q1 | maintainability | kind switch(badge/label) 이중 → `KIND_META` 레코드 | 통합 |
| Q2 | maintainability | 미사용 i18n 키 `memories.title`/`memories.createdAt` | 사용 또는 제거 |

### 백로그 (defer, 문서화) — admin 저빈도·중기 유지보수
- DB perf: listScopes `MAX(updated_at)` filesort(W1)·데이터+COUNT 이중 집계→`COUNT(*) OVER()`(W2)·`metadata->>'kind'` 인덱스 부재(W4). scope당 ≤1000·admin 저빈도라 즉시 차단 아님. 인덱스는 `CONCURRENTLY` 분리 배포.
- 페이지네이션 `offset` vs 프로젝트 표준 `page`(api-contract W1·architecture W2): spec §6 가 limit/offset 명시 + 프론트 infinite-scroll 에 offset 자연. 응답은 표준 `PaginatedResponseDto` 유지. **의도적 선택**으로 문서화(page 필드는 offset/limit 파생 근사).
- 동적 SQL 파라미터 번호 삼항 보간(W3/W4 다수): builder 패턴 리팩토링.
- `AgentMemoryAdminService` 분리(architecture W1, SRP) — 런타임/admin 책임 분리.
- `page.tsx` 412줄 컴포넌트 분해(maintainability W1).
- `limit=30` 기본값 상수화(maintainability W3), `AGENT_MEMORY_KINDS` 상수 파일 추출(architecture I-3).
- clearScope 0건 시 204(멱등) — toast 중립화 또는 `X-Deleted-Count`(side-effect W1).
- `looksLikeInstruction` 필터 직접 테스트(testing INFO), 프론트 page 컴포넌트 테스트(testing W).

## INFO 주요
- 보안: SQL 전 파라미터 바인딩, workspace_id 격리 강제, embedding 응답 제외 — 견고 확인.
- 범위: 변경 97% 가 기능 직결. `737f1a85`(5줄/3파일) 만 origin/main 선존 red 수정으로 격리 커밋(scope reviewer 정당 판정).
- side-effect: 기존 서비스 시그니처 무변경(additive), FK cascade 없음.

## reviewer별 BLOCK
security NO · api-contract NO · database NO · requirement NO · testing NO · side-effect NO · architecture NO · maintainability NO · scope NO · user-guide-sync NO
