---
worktree: nav-spec-doc-fix
started: 2026-06-27
owner: project-planner
status: complete
completed: 2026-06-27
spec_impact:
  - spec/2-navigation/10-auth-flow.md
  - spec/2-navigation/14-execution-history.md
base: origin/main @ e7e8aa7a4 (#721 포함)
source: #721 impl-done(spec/2-navigation/) 가 노출한 무관 pre-existing nav-doc 결함 (별 트랙으로 deferred)
---

# nav-spec doc 정합 (consistency-check 노출 pre-existing)

#721 의 consistency-check --impl-done(scope spec/2-navigation/)이 노출한, 본 변경과 무관한
기존 nav-spec 문서 결함을 planner 트랙으로 정리. **코드 변경 없음.**

## 대상 (WARNING + 동일 파일 cheap INFO)

1. **`10-auth-flow.md` §2.5/§2.6 순서 (WARNING)** — §2.4→§2.6→§2.5 역순(§2.6 가 나중 삽입되며 §2.5 미재배치).
   §2.5(이메일 인증 화면)·§2.6(초대 토큰 가입) 블록 swap 으로 §2.4→§2.5→§2.6 오름차순 확보.
   섹션 번호·앵커 보존(번호 재부여 아님). §2.4 의 "§2.6 분기 참고" 참조 유효 유지.
2. **`14-execution-history.md §5` 응답 예시 래퍼 주의 (WARNING)** — **FALSE POSITIVE, 수정 안 함**.
   검증 결과(sub-agent): list 응답은 **single-wrap** `{data:[...], pagination:{...}}`. `TransformInterceptor`
   는 이미 `data` 키가 있는 객체를 pass-through 하고(`'data' in data` → 그대로 반환), 핸들러가
   `PaginatedResponseDto`(`{data, pagination}` 2개 top-level 키)를 반환하며, e2e 가 `res.body.data`·
   `res.body.pagination` 를 top-level 로 단언(`agent-memory-admin.e2e-spec`), api-convention §5.2 도
   `{data, pagination}` top-level 로 명시. 따라서 §5 예시는 **이미 완전·정확** — 0-dashboard 식
   "data 내부 형태" 주석을 추가하면 오히려 double-wrap 으로 **오도**(틀림). checker 가 pass-through
   로직 미확인으로 오탐. 0-dashboard 주석은 bare-value 예시(래핑됨)에만 적용, list 예시엔 부적용.
3. **`14-execution-history.md §2.1` 목업 Trigger 열 (INFO, 동일 파일)** — 목업 4열(Trigger 누락)
   vs §2.4 5열. ASCII 재배치 리스크 회피 위해 목업 하단 1줄 주석으로 처리.

## 체크리스트

- [x] (항목 1) `10-auth-flow.md` §2.5/§2.6 블록 swap → §2.4→§2.5→§2.6 오름차순
- [x] (항목 2) `14-execution-history.md §5` 래퍼 주의 — **FALSE POSITIVE 확인, 수정 안 함**(single-wrap 검증)
- [x] (항목 3) `14-execution-history.md §2.1` 목업에 5열 안내 주석 추가
- [x] consistency-check --spec (19_01_08) → **BLOCK NO**. 실제 편집 anchor·cross-ref·Rationale 충돌 0
- [x] (WARNING 해소) swagger double-wrap 추적 plan 신설(`swagger-double-wrap-fix.md`)

## 제약·프로세스

- project-planner: 산출물 spec/** 본문만. spec 쓰기 직전 consistency-check --spec 의무(이행).
- 우선순위 LOW (pre-existing doc 정합).

## 별도 발견 (본 PR 아님 — 안내 대상)

- **paginated 응답 swagger double-wrap 버그** (§5 검증 중 발견): `common/swagger/api-wrapped.ts`
  의 `wrapPaginatedSchema`/`ApiOkPaginatedResponse` 와 `spec/conventions/swagger.md §5-2` 가
  paginated 응답을 `{ data: { data:[], pagination } }`(double-wrap)로 문서화하나, 실제 런타임은
  single-wrap `{ data, pagination }`. ModelListDto 버그(#721)와 동형 — swagger 가 outlier.
  코드(api-wrapped.ts)+convention(swagger.md) 동반 수정 필요 → 별 트랙.

## 미포함 (별 트랙)

- #720 impl-done 노출: `10-graph-rag.md` self-link/dual-overview, `security-backlog-invitation-token-hash` plan staleness(§1.5.D "raw 유지" 확정 미반영). 본 PR 후 안내.
- 기타 nav INFO: 16-agent-memory `/api/` prefix·Rationale 헤딩, waiting_for_input 아이콘 비일관, Overview 섹션 구조, PreviewModelListDto rename — 영역 정비 시 일괄.
