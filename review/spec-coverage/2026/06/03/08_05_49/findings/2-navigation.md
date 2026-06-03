# Spec 감사 — 2-navigation

## 요약
- **감사 파일 수**: 20개 (상세 spec 16, 인덱스/레이아웃 `_layout.md`·`_product-overview.md` 2, backlog 1)
- **severity 분포**: none 1 · minor 4 · major 15 · severe 0
- **핵심 메시지**:
  1. 영역 전반의 가장 빈번한 drift는 **frontmatter `code:` 글로브가 프론트만 가리켜 백엔드 구현(dashboard/workflows/auth/statistics/schedules/integrations/knowledge-base/auth-configs 등)이 추적에서 누락**되는 문제. major 다수가 이 패턴을 동반.
  2. **`status: implemented` 과대평가**가 다수 — dashboard·workflow-list·auth-flow·error-empty-states·user-guide·schedule·config·statistics·user-profile·_layout 등 10건이 `partial` 강등 권고. spec이 약속한 surface(정렬 UI, 필터, CTA, 알림 설정, 아바타 업로드 등)가 미구현이거나 다르게 구현됨.
  3. 반대로 `_product-overview.md`의 NAV-TR-09/10/11은 **🚧(백엔드만) 표기가 stale** — 실제로는 트리거 드롭다운·상세 드로어·보안경고까지 완전 구현되어 ✅로 교정 필요(역방향 drift).

## 파일별 발견사항

### spec/2-navigation/0-dashboard.md — major / partial / fix-code-paths, patch-content, fix-frontmatter
- **headline**: 대시보드 spec의 요약카드 구성·성공률 공식·정렬 기준·summary 응답 필드가 실제 코드와 다수 어긋남; code 글로브가 백엔드 모듈 전체 누락
- **findings**:
  | claim | reality | evidence |
  | --- | --- | --- |
  | 요약 카드 4개 = Total(Active/Inactive)/Runs(7d)/Success/**Avg Time** (§2,§3) | 실제 4카드 = Total/Active/Runs(7d)/Success. **Avg Time 카드 없음**, Active/Inactive가 별도 카드로 분리. avgExecutionTime 미표시 | dashboard/page.tsx:146-176 (major) |
  | Success Rate = completed/(completed+failed)×100 (§3) | 분모가 7일 전체 실행 건수(running/pending/cancelled 포함). failed만이 아님 | dashboard.service.ts:96-107 (major) |
  | 최근 워크플로우 정렬 = max(updatedAt, lastExecutedAt) DESC (§4) | `w.updatedAt DESC` 단일 컬럼만, lastExecutedAt 미고려 | dashboard.service.ts:138 (major) |
  | summary 응답 = ...inactiveWorkflows...avgExecutionTime(초) (§7) | inactiveWorkflows 없음, spec에 없는 runs7dPrevious/runs7dChangePercent 추가, avgExecutionTime은 **ms** 단위 | dashboard-response.dto.ts:8-30 (major) |
  | Avg Time 단위 초/분 자동 전환 (§3) | ms 정수 반환 + 표시 카드 자체 부재 → 전환 로직 없음 | dashboard.service.ts:118-120 (minor) |
  | 실행 상태 3종(completed/failed/running) (§5) | 프론트 6종(+pending/cancelled/waiting_for_input), DTO enum 5종 | page.tsx:87-94 (minor) |
  | 빈 상태 문구 영문 명시 (§4,§5) | i18n 키 처리 — 동작은 일치, 문구 정확 일치는 번역 리소스 의존 | page.tsx:232-235,290-293 (minor) |
- **frontmatterIssues**: code 글로브가 page.tsx 하나만 — 백엔드 dashboard 모듈(controller/service/dto) 전부 누락, §7 API 절 추적 끊김. `status: implemented` → partial 강등 검토.
- **structuralNotes**: 파일명 `0-dashboard.md`의 `0-` prefix는 컨벤션상 기술개요(0-overview)에 해당하나, 본 영역에서 랜딩/진입 문서 역할이면 의도된 연번일 수 있어 단정하지 않음. 분류 자체는 정상.

### spec/2-navigation/1-workflow-list.md — major / partial / patch-content, fix-code-paths
- **headline**: 정렬·태그·폴더 필터 UI 부재, 상태필터 param 불일치(isActive vs status), 테이블 컬럼이 spec과 상이 — partial 수준
- **findings**:
  | claim | reality | evidence |
  | --- | --- | --- |
  | 상태 필터를 status(active/inactive)로 전달 (§2.3) | 프론트는 `isActive` 전송, 백엔드는 `status`만 수용 → 화이트리스트 탈락, **end-to-end 비동작** | page.tsx:112-113 vs query-workflow.dto.ts:18-19 (major) |
  | 정렬 드롭다운 4기준(수정/이름/생성/마지막실행) (§2.4,§1) | 정렬 UI 전무, getSortColumn은 created_at/updated_at/name만, last_run 미지원 | page.tsx + workflows.service.ts:646-653 (major) |
  | 태그(멀티)·폴더 필터 상시 노출 (§2.3) | 태그/폴더 필터 UI 없음(태그는 배지 표시만). 백엔드는 지원하나 미연결 | page.tsx + service.ts:82-87 (major) |
  | 테이블 컬럼: 상태/이름/트리거요약/노드수/마지막실행/공유/더보기 (§2.1) | 실제 = Status/Name(+Team)/Tags/Last Updated/Actions. 트리거요약·노드수 없음, 마지막실행 대신 updatedAt | page.tsx:409-415,475-479 (major) |
  | '마지막 실행' = 실행 시각 상대시간 (§2.1) | updatedAt(없으면 now) 상대시간 — last-run 미사용 | page.tsx:475-479 (major) |
  | 빈 상태에 마켓플레이스 템플릿 추천 링크 (§2.7) | 추천 링크 없음, firstWorkflowHint + 생성 버튼만 | page.tsx:379-402 (minor) |
  | 더보기 메뉴 5종 (§2.6) | 실제 6종 — '실행 이력' 액션 추가 | page.tsx:511-516 (minor) |
  | 삭제 시 연결 트리거/스케줄 비활성화 (§2.6) | DB cascade 삭제에 의존, 명시적 '비활성화' 로직 없음 | workflows.service.ts:167-170 (minor) |
- **frontmatterIssues**: API contract 불일치가 backend(query-workflow.dto/service)·frontend api client 양쪽 — code 글로브에 추가 필요. `status: implemented` 과대평가, partial 정확.
- **structuralNotes**: 네이밍/위치/연번 정합. §1 ASCII 목업이 실제 UI와 크게 괴리 → 본문 patch 필요.

### spec/2-navigation/10-auth-flow.md — major / partial / patch-content, fix-frontmatter, fix-code-paths, reclassify
- **headline**: 대부분 플로우는 일치하나 resend-verification 부재·라우트 경로(/auth 접두사) 불일치·강도바 단계수·중복확인 미연동 등 다수 drift
- **findings**:
  | claim | reality | evidence |
  | --- | --- | --- |
  | POST /api/auth/resend-verification + Resend 버튼/60초 쿨다운 (§2.5,§8) | 백엔드 핸들러 전무, verify-email 화면에 Resend 없고 'Back to Sign in'만 | auth.controller.ts; verify-email-content.tsx:99-109 (major) |
  | 인증 라우트 /auth/* (login/callback…), 미인증 시 /auth/login 리다이렉트 (§7) | route group `(auth)`라 URL 세그먼트 없음 → /login,/register 등. 가드도 /login?redirect= | login/page.tsx; auth-provider.tsx:47-52 (major) |
  | 비밀번호 강도바 3단계 (§2.3) | 실제 5단계(weak~very strong), 5세그먼트 | password.ts:37-62; register-form.tsx:294-307 (minor) |
  | Email blur 시 중복확인 API 호출 + POST check-email (§2.2,§8) | checkEmail 정의는 있으나 어떤 폼도 호출 안 함 — 미구현 | auth.ts:132; register-form.tsx (minor) |
  | 재설정 안내 화면 Resend 버튼 (§4.2) | 'Back to Sign in' 링크만 | forgot-password-form.tsx:72-80 (minor) |
  | oauth/providers Cache-Control: **public**, max-age=300 (§5.0) | 실제 `private, max-age=300` | auth.controller.ts (minor) |
  | Password = 8자+문자유형 3종 이상 (§2.2) | zodResolver는 min(1).min(8)만, 유형 규칙 없음(강도바는 안내용) | register-form.tsx:136-139 (minor) |
- **frontmatterIssues**: code 글로브가 프론트 UI만 — §8 API/§5.3 OAuth 콜백/§3.3 토큰 TTL의 백엔드 동작(backend/auth/**) 미포함. `status: implemented` → partial.
- **structuralNotes**: 본문이 backend/auth 동작을 1차 SoT 수준으로 기술 — 일부는 5-system/1-auth.md 위임이나 §2.5/§8의 resend-verification처럼 위임 없이 직접 약속한 항목이 코드에 없는 게 drift 핵심.

### spec/2-navigation/11-error-empty-states.md — major / partial / patch-content, fix-frontmatter
- **headline**: 에러 페이지(§1)는 완전 일치하나, 빈 상태(§2.2 Triggers/Schedules CTA 누락·§2.3 필터 초기화 화면 전체 미구현)에서 major drift
- **findings**:
  | claim | reality | evidence |
  | --- | --- | --- |
  | 검색-결과-없음 + '필터 초기화' CTA 공통 적용 (§2.3) | 전용 상태·리셋 버튼 전무. workflows는 description 분기만, integrations는 전체-빈에만 EmptyState | workflows/page.tsx:386; integrations/page.tsx:285-286 (major) |
  | Triggers 빈 상태 + '트리거 추가' CTA (§2.2) | 공유 EmptyState 미사용, 인라인 Inbox + "트리거가 없어요." CTA 없음 | triggers/page.tsx:618-622 (major) |
  | Schedule 빈 상태 + '스케줄 추가' CTA (§2.2) | 인라인 Inbox + noneFound, CTA 없음 | schedules/page.tsx:978-983 (major) |
  | Executions 빈 상태 CTA → /workflows 이동 (§2.2) | per-workflow 라우트만, CTA는 'openInEditor' → 에디터. 목적지·라벨 모두 다름 | executions/page.tsx:192-205 (minor) |
  | Integration 빈 상태 아이콘 = 연결 아이콘 (§2.2) | generic Inbox 사용 | integrations/page.tsx:286 (minor) |
  | 에러 페이지 5종 전 동작 (§1) | **완전 일치** — 5 variant·ICONS·i18n 1:1·401 redirect·errorToVariant·4xx→server 폴백 | error-page.tsx:20-77; error.tsx:35-43 (minor) |
- **frontmatterIssues**: `status: implemented` → §2.2/§2.3 미구현으로 partial. §1만 implemented 수준. 빈 상태 사용 화면 7개 page.tsx가 code 글로브에 누락(empty-state.tsx만 있음).
- **structuralNotes**: 에러+빈상태 묶음 합리적, 분할 불필요. 구조적 이슈 없음.

### spec/2-navigation/13-user-guide.md — major / partial / patch-content, fix-code-paths
- **headline**: spec은 단일언어 /docs로 기술하나 구현은 ko/en 이중언어(locale-prefixed 라우트·en.mdx sibling·title_en/summary_en). 라우트·frontmatter·IA가 코드와 어긋남
- **findings**:
  | claim | reality | evidence |
  | --- | --- | --- |
  | /docs/[...slug]가 파일 경로 1:1 (2세그먼트) (§3) | slug[0]은 locale. 실제 /docs/ko|en/...; 최소 3세그먼트 요구 | route.ts:19-22; [...slug]/page.tsx (major) |
  | frontmatter 7키만 정의 (§4) | title_en/summary_en 정식 지원·소비, MDX 다수가 채움 | registry.ts:10-20; ai.mdx:1-9 (major) |
  | 한글 단일 콘텐츠 전제 (§2) | 전 페이지 .en.mdx sibling, LOCALES=[ko,en] 운용·폴백 고지. 이중언어 핵심인데 한 절도 없음 | registry.ts:25,157-194; doc-body-notice.tsx (major) |
  | 06-integrations IA 4개 (§2) | cafe24/discord/slack/telegram/web-chat 추가 → 9개 | content/docs/06-.../ (minor) |
  | 05-run-and-debug 4개 (§2) | validation-errors 추가 → 5개 | validation-errors.mdx (minor) |
  | 07-workspace IA 1개 (§2) | security-2fa/system-status 추가 → 3개 | content/docs/07-.../ (minor) |
  | /docs → what-is-this 하드코딩 리다이렉트 (§3) | index.sections[0].pages[0] 동적 + locale prefix | docs/page.tsx:8-14 (minor) |
  | MDX 컴포넌트 표 5종 (§8) | 미문서화 flow-diagram.tsx 추가 존재 | mdx/flow-diagram.tsx (minor) |
  | code: locale.ts만 명시 | route.ts·links.ts·i18n core 등 핵심 모듈 글로브 밖 | lib/docs/{route,links}.ts (minor) |
- **frontmatterIssues**: `status: implemented` → 이중언어 구현과 어긋나 partial. code 글로브에 lib/docs/route.ts·links.ts·lib/i18n/** 추가. components/docs/** 글로브는 유효.
- **structuralNotes**: 분류는 정상, 내용 stale — §2 IA·§3 라우트·§4 프론트매터 3절 동시 개정 + IA 추가 페이지 반영 필요.

### spec/2-navigation/14-execution-history.md — major / partial / patch-content
- **headline**: 실행 내역 목록 Nodes 열이 항상 "—" — 목록 API가 nodeExecutions 미반환으로 클라이언트 집계 무력화. 나머지는 정합
- **findings**:
  | claim | reality | evidence |
  | --- | --- | --- |
  | Nodes 열에 완료/전체(실패시 N failed) 표시 (EH-LIST-02,§2.4) | 목록 API가 nodeExecutions 미포함 → 프론트 length로 집계 → 항상 0 → '—'. §5 예시도 빈 배열로 모순 | executions.service.ts:648,575; executions/page.tsx:252-305 (major) |
  | Chain badge 원본 ID 새 탭 이동 (§3.7) | 평범한 next/link, target=_blank 없음 | [executionId]/page.tsx:429 (minor) |
  | manual 보조 라벨 = name(없으면 email) | name만 사용, email fallback 없음(PII 보안 노트) | execution-trigger.ts:55-60 (minor) |
  | 상세 nodeExecutions 필드 = executionId/nodeId/inputData/retryCount/중첩 node (§5) | Swagger DTO는 평탄 nodeLabel만. findById는 raw 엔티티 반환 → 문서·DTO 둘 다 런타임 shape과 어긋남 | execution-response.dto.ts:103-156; executions.service.ts:485-523 (minor) |
- **frontmatterIssues**: code 글로브가 frontend executions 라우트만 — 백엔드 API·trigger 유틸·re-run/chain·result-detail 컴포넌트 미포함. EH-LIST-02 깨짐으로 엄밀히는 partial 요소.
- **structuralNotes**: 네이밍·분류 적절. Rationale 섹션 부재하나 명세 위주라 치명적 아님.

### spec/2-navigation/2-trigger-list.md — major / implemented / patch-content
- **headline**: 대체로 정합하나 '생성 금지' 명시가 실제 Add Webhook 생성 다이얼로그와 충돌, formMode enum·일부 PATCH 키 표현이 stale
- **findings**:
  | claim | reality | evidence |
  | --- | --- | --- |
  | 트리거 생성은 에디터에서만, 목록은 관리만 (§3) | 목록에 'Add Webhook' 버튼 + 생성 다이얼로그, POST /api/triggers 직접 호출 | triggers/page.tsx:272,302,377; TriggersController.create() (major) |
  | formMode enum = multi_step만(v1), 향후 single_page (§2.3.1,R-CC-11) | 실제 ['multi_step','native_modal','auto'] default auto. single_page 없음 | chat-channel-config.dto.ts (major) |
  | PATCH body = config.notification/interaction/chatChannel.* (§138) | top-level 키로 수신 후 config JSONB merge | update-trigger.dto.ts; triggers.service.ts:198 (minor) |
  | API 표 6종 | rotate-secret·revoke-token 2개 EIA endpoint 추가 노출, §3 표 누락 | triggers.controller.ts:169,192 (minor) |
- **frontmatterIssues**: code 글로브 정합. `status: implemented` 대체로 맞으나 §3 '생성 금지' 명시가 실제 구현과 어긋남(문서 측 stale).
- **structuralNotes**: 네이밍·연번·3섹션 구성 정합. Rationale R-9~R-11 결번이나 무해. 리네임 불필요.

### spec/2-navigation/3-schedule.md — major / partial / patch-content, fix-code-paths
- **headline**: API에 없는 /toggle 엔드포인트 명시, UI는 ⋮메뉴 대신 인라인 버튼·'실행이력/트리거에서보기' 액션·삭제경고·생성안내문구 부재. §5 실행출처 규약은 정확 일치
- **findings**:
  | claim | reality | evidence |
  | --- | --- | --- |
  | PATCH /api/schedules/:id/toggle 존재 (§4) | /toggle 라우트 없음. 일반 PATCH /:id에 {isActive} | schedules.controller.ts:183; page.tsx:606-607 (major) |
  | ⋮ 메뉴에 '실행 이력','트리거에서 보기' (§2.1) | 인라인 버튼(Run/Toggle/Edit/Delete)만, 해당 액션 자체 부재 | page.tsx:1033-1077 (major) |
  | 삭제 시 '연결 트리거도 함께 삭제' 안내 (§3) | "되돌릴 수 없어요."만, 트리거 경고 없음 | schedules.ts:43; page.tsx:945 (minor) |
  | 생성 다이얼로그 '트리거 자동 등록' 안내 (§2.2) | 해당 인포 텍스트 미렌더, i18n 키 없음 | page.tsx:786-937 (minor) |
  | 다이얼로그 필드 목록 (§2.2) | spec에 없는 '파라미터 값(JSON)' textarea 추가 | page.tsx:896-919 (minor) |
  | 워크플로우 이름 클릭 시 에디터 이동 (§2.1) | 일반 텍스트만, 링크 아님 | page.tsx:1032 (minor) |
  | 타임존 기본값 = 워크스페이스 설정 (§2.2) | 'Asia/Seoul' 하드코딩 fallback | schedules.service.ts:82 (minor) |
  | GET /api/schedules sort/order 지원 (§4) | DTO는 받으나 findAll이 무시, created_at DESC 고정 | schedules.service.ts:45 (minor) |
  | 빈 cron 시각탭 디폴트 'daily 09:00' (§2.2.1) | selectedDays:[평일]도 설정 → weekly 전환 시 미세 불일치 | cron-to-visual.ts:38-44 (minor) |
  | §5 cron=schedule, run-now=manual 분류 | **정확 일치** | schedule-runner.service.ts:165-166; execution-trigger.ts:55-66 (minor) |
- **frontmatterIssues**: code 글로브가 frontend 2파일만 — backend/schedules/** 누락으로 §4 API·§5 규약 추적 불가. `status: implemented` → partial.
- **structuralNotes**: 네이밍·위치·연번 정합. 핵심은 본문 drift + code 글로브 backend 누락.

### spec/2-navigation/6-config.md — major / partial / patch-content
- **headline**: API/스키마/마스킹/Reveal/select-only 모델로딩은 정확 일치하나, §A.3 사용량 이력(소스IP·응답코드·일/주/월)·§A.2 IP Whitelist·API Key Header 이름 필드는 UI 미구현
- **findings**:
  | claim | reality | evidence |
  | --- | --- | --- |
  | 호출 이력에 소스IP·대상트리거·응답코드 + 일/주/월 (§A.3) | totalCalls+lastUsedAt+recentCalls(id/triggerName/status/startedAt)만. IP·응답코드·기간분해 없음 | auth-configs.service.ts:399-450; authentication/page.tsx:30-41 (major) |
  | 공통 IP Whitelist 설정 필드 (§A.2) | DTO는 지원, 폼에 입력 UI 전무 | authentication/page.tsx:81-89; create-auth-config.dto.ts:59-68 (major) |
  | API Key Header 이름 필드(default X-API-Key) (§A.2) | 폼에 headerName 없음(HMAC header만). 백엔드는 fallback 읽기만 | authentication/page.tsx:333-365; service.ts:312 (minor) |
  | 모델 파라미터 기본값(temp 0.7/max 2048/top_p/penalties) (§B.4) | defaultParams free-form JSONB(검증·주입 없음). penalty 심볼 부재, example은 maxTokens 2000 | create-llm-config.dto.ts:75-85 (minor) |
  | Authentication/LLM API 표 (§3) | 컨트롤러 라우트 1:1 정확 일치 | auth-configs.controller.ts:47-199; llm-config.controller.ts:50-222 (minor) |
- **frontmatterIssues**: code 글로브 3개 실존하나 Part A 단일진실인 backend/auth-configs/** + llm-preview.service.ts 누락. §A.3 미구현으로 partial 검토.
- **structuralNotes**: 네이밍·Part A/B 구조 양호. 핵심 결정(select-only R-1, HMAC/자동발급 R-2)은 코드와 강하게 일치.

### spec/2-navigation/7-statistics.md — major / partial / patch-content, fix-code-paths
- **headline**: API 경로(llm-usage 분할·prefix)·에러집계 의미(유형 vs 워크플로우)·기간옵션(today/custom)·Total Runs 증감률 미구현 등 다수 drift. code 글로브 백엔드 누락
- **findings**:
  | claim | reality | evidence |
  | --- | --- | --- |
  | GET /api/statistics/llm-usage 단일 | 실제 llm-usage/summary + /timeseries 분할, 단일 경로 없음 | statistics.controller.ts:116,131 (major) |
  | errors = 에러 '유형별' 집계(파이) | 실제 '워크플로우별' 실패 집계(GROUP BY w.name) | statistics-response.dto.ts:42-55; service.ts:141-152 (major) |
  | 기간: 오늘/7d/30d/90d/커스텀 | 프론트 ['1d','7d','30d','90d'], 백엔드 ['7d','30d','90d','custom'] — 양쪽 다 불일치 | statistics/page.tsx:107; query-statistics.dto.ts:15-16 (major) |
  | Total Runs 카드 전기간 대비 증감률 | DTO·프론트 모두 증감 필드/표시 없음 | statistics-response.dto.ts:4-22; page.tsx:343-350 (major) |
  | LLM 일별 추이 차트 | timeseries endpoint는 있으나 프론트 미호출/미렌더 | page.tsx(미참조); controller.ts:131 (minor) |
  | top-workflows 실행순 | 동작 일치, 상위 N 한도 spec 미기재 | controller.ts:88,71 (minor) |
  | LlmUsageSummary에 promptTokens/completionTokens/topProvider | 백엔드는 byModel/totalTokens/totalCostUsd만 — 계약 불일치 | page.tsx:90-98 vs dto:117-126 (minor) |
- **frontmatterIssues**: code 글로브가 page.tsx 하나만 — backend/statistics/** 전부 누락. `status: implemented` → partial.
- **structuralNotes**: 네이밍·위치 적절. API 표가 실제 엔드포인트와 어긋나 본문 patch 필요.

### spec/2-navigation/9-user-profile.md — major / partial / patch-content, fix-code-paths
- **headline**: 코어 readonly 프로필/세션/2FA는 일치하나, §6 API 표 다수 엔드포인트·워크스페이스 슬러그 URL·알림 설정·아바타 업로드가 어긋나거나 미구현
- **findings**:
  | claim | reality | evidence |
  | --- | --- | --- |
  | 워크스페이스 전환 시 슬러그 URL(/w/team-alpha/...) (§3) | /w/[slug] 라우트 부재. currentWorkspaceId localStorage + 헤더 주입, URL 불변 | workspace-store.ts:18-47 (major) |
  | POST /api/users/me/avatar + 아바타 업로드/제거 (§6.1,§2.1) | 엔드포인트 없음(GET/PATCH me·change-password만). UI는 이니셜만, PATCH me의 avatarUrl만 갱신 | users.controller.ts:44,72,104; profile-info-card.tsx:134-156 (major) |
  | GET/PATCH /api/notifications/settings + 채널 on/off·일일요약·unsubscribe (§6.2,§5) | settings 라우트 전무. 채널/요약/unsubscribe 코드 부재. list/read 등만 | notifications.controller.ts:42-133 (major) |
  | DELETE /api/users/me/sessions/:familyId (§6.1) | 실제 POST .../revoke (DELETE body 제거 대비). 메서드·경로 다름 | sessions.controller.ts:77; sessions.ts:61-64 (major) |
  | users 스코프 enable-2fa/confirm-2fa 표 row (§6.1) | 코드 0건. 프론트는 /auth/2fa/setup·verify·disable만 호출 | auth.controller.ts:250-290; grep 0건 (minor) |
  | 테마 Light/Dark/System 3종 (§2.1) | light/dark 2종만, System 부재 | users.ts:3; profile-preferences-card.tsx:190-203 (minor) |
  | POST /workspaces/:id/members 이메일 즉시 추가 (§6.1) | **일치** — 400/409 처리 | workspaces.controller.ts:237 (minor) |
- **frontmatterIssues**: code 글로브가 profile/** 1개뿐 — backend users/workspaces/notifications/auth sessions·webauthn 컨트롤러, workspace/settings, lib/api/* 광범위 누락. 또 profile/alerts/page.tsx(무관 기능)는 과포함. `status: implemented` → partial.
- **structuralNotes**: 네이밍·위치 정합. §6 API 표가 canonical 출처(5-system/1-auth, data-flow/8-notifications)와 중복 정의하며 일부 row가 코드와 어긋남 — 링크 위임 또는 코드 일치로 정리 권장.

### spec/2-navigation/_layout.md — major / partial / add-frontmatter, fix-code-paths, patch-content
- **headline**: 사이드바 메뉴/로고/반응형은 정확 일치하나, §3.2 유저 팝업 메뉴(테마전환·알림설정·워크스페이스 관리)·§2.3 에디터 자동축소·§5 공통헤더가 어긋남. **frontmatter 전무**
- **findings**:
  | claim | reality | evidence |
  | --- | --- | --- |
  | 메뉴 11개 순서·경로·아이콘 (§2.2) | **정확 일치** | sidebar.tsx:111-127 (minor) |
  | 유저 팝업 6항목(프로필/전환/관리/알림설정/테마/로그아웃) (§3.2) | 실제 프로필+로그아웃 2개만. 전환/관리는 별도 switcher, 알림설정·테마는 팝업에 없음 | sidebar.tsx:741-784 (major) |
  | 테마 전환이 유저 팝업 항목 (§3.2) | 사이드바에 없음, profile preferences 카드에 위치 → 오해 유발 | profile-preferences-card.tsx; sidebar.tsx (major) |
  | 에디터 진입 시 사이드바 자동축소 (§2.3) | collapsed 읽기만, 자동축소 트리거 없음 | (editor)/layout.tsx; editor-content.tsx:7,14 (minor) |
  | 레이아웃 차원 공통 헤더 (§5) | layout 레벨 공유 PageHeader 부재, 각 page가 개별 구현 | layout/* (minor) |
  | 알림 벨 전체 동작 (§3.1) | **정확 구현**(unread/list/markRead/dismiss/deep-link, 백엔드 엔드포인트 모두 존재) | sidebar.tsx:192-312,452-628 (minor) |
  | 반응형 breakpoint (§2.4) | **정확 일치**(1279/1280-1439, w-16/w-60) | sidebar.tsx:170-171,387 (minor) |
- **frontmatterIssues**: frontmatter 전무(status/code/id 부재) — sidebar.tsx·sidebar-store.ts·(main)/layout.tsx 추적성 끊김. 최소 code 글로브 + status 추가 권장. §3.2·§5 부분 구현이므로 partial 정확.
- **structuralNotes**: `_layout.md` prefix 컨벤션 부합. §3.2 팝업·§5 헤더가 실제로는 분산 구현(테마→profile, 워크스페이스→switcher, 헤더→per-page)되어 '단일 사이드바 팝업' 기술이 구조적 현실과 어긋남.

### spec/2-navigation/_product-overview.md — major / N/A(frontmatter status 필드 없음) / patch-content
- **headline**: 사이드바 11개 메뉴는 정확 일치하나, NAV-TR-09/10/11 트리거 액션 UI가 🚧(백엔드만)로 stale — 실제로는 드롭다운·상세 드로어·보안경고까지 완전 구현(역방향 drift)
- **findings**:
  | claim | reality | evidence |
  | --- | --- | --- |
  | NAV-TR-09 ⋮ 드롭다운 액션 — 🚧(UI 미노출) | UI 완전 구현. MoreVertical 드롭다운+RoleGate editor 게이팅. 🚧 아닌 ✅ | triggers/page.tsx:745-824,167,375 (major) |
  | NAV-TR-10 상세 드로어 GUI 수정 — 🚧 | name 인라인 편집·authConfigId·editInSchedule 모두 구현. ✅ | trigger-detail-drawer.tsx:188-217,325-376,398 (major) |
  | NAV-TR-11 AuthConfig 상태+무인증 보안경고 — 🚧 | 인증 열 뱃지+AlertTriangle 보안경고 렌더. ✅ | triggers/page.tsx:107-140,65 (major) |
  | NAV-SS-02 health(정상/지연/점검) | 코드값 healthy\|degraded\|**down** — 세번째가 '점검' 아닌 '다운'. 라벨만 상이 | system-status/page.tsx:13,56-69 (minor) |
- **frontmatterIssues**: frontmatter 전무(PRD overview라 형식상 허용). status 요약 frontmatter 부여 고려 가능(선택).
- **structuralNotes**: 네이밍·위치 정합. 사이드바 11항목 1:1 일치, Marketplace ❌도 코드 일치. 본문 표 NAV-TR-09/10/11 상태칸 🚧→✅ 교정 필요.

## 일치 확인됨
다음 파일은 spec 본문이 코드와 (거의) 완전 일치 — drift 미미하거나 없음:
- **spec/2-navigation/12-workflow-version-history.md** (minor / implemented) — API·스냅샷 스키마·데이터모델·복원·UI 모두 매칭. 유일 결함은 frontmatter code 글로브가 프론트만 가리켜 backend(workflow-versions/**, workflows.service.ts, 마이그레이션) 누락 → fix-code-paths.
- **spec/2-navigation/15-system-status.md** (minor / implemented) — 화면 spec이 구현과 거의 일치. refetchInterval 에러 시 폴링 중단·KB 그룹 라벨('지식 저장소') 차이 등 minor 3건. i18n dict·sidebar 링크 code 글로브 보강은 선택.
- **spec/2-navigation/4-integration.md** (minor / implemented) — 본문 1628줄이 코드와 정밀 일치(엔드포인트·status enum·에러코드·install token·derived DTO·throttle 전부 매칭). frontmatter code 글로브가 프론트만 가리켜 방대한 backend surface 미커버 → fix-code-paths.
- **spec/2-navigation/5-knowledge-base.md** (minor / implemented) — API·graph 파라미터·409·3D 시각화·R-1 select-only 모두 일치. API 표에 실재 엔드포인트 4개(retry-failed/embedding-stats/search/embedding-probe) 누락이 유일 minor → patch-content. backend 글로브 추가 권장.
- **spec/2-navigation/8-marketplace.md** (none / backlog) — backlog 미구현 명세로 frontmatter(status:backlog, code:[])와 코드 부재가 정확히 일치. drift 없음.

## 영역 구조·네이밍 이슈
- **연번/네이밍**: 상세 문서는 모두 `N-name.md` 컨벤션 정합. `0-dashboard.md`의 `0-` prefix만 컨벤션상 기술개요(0-overview)와 혼동 소지 — 본 영역의 진입/랜딩 문서면 의도된 것일 수 있어 단정 보류.
- **인덱스/레이아웃 문서**: `_layout.md`는 **frontmatter 전무** — 레이아웃 문서라도 code 글로브·status 부여로 추적성 확보 권장(add-frontmatter). `_product-overview.md`는 PRD라 형식상 허용이나 NAV-TR-09/10/11 상태칸 stale.
- **분류**: `12-workflow-version-history.md`는 워크플로우 편집기 기능으로 3-workflow-editor와 강결합(문서 상단도 ../3-workflow-editor/ 참조). 2-navigation 분류 근거가 약하나 cross-area 영향이 커 reclassify 보류.
- **frontmatter code 글로브 정규화(영역 전반 최우선)**: 거의 모든 상세 문서가 frontmatter code를 **프론트 page.tsx만** 가리킨다. 본문이 backend API/DTO/service를 SoT 수준으로 기술하는 dashboard/workflow-list/auth-flow/schedule/integration/knowledge-base/statistics/version-history/config/user-profile 문서에 `codebase/backend/src/modules/<영역>/**`를 일괄 추가해야 spec-impl 추적이 닫힌다.
- **status 정규화**: dashboard·workflow-list·auth-flow·error-empty-states·user-guide·schedule·config·statistics·user-profile·_layout 10건이 `implemented`→`partial` 강등 대상. 반대로 `_product-overview.md`는 stale `🚧`→`✅` 상향 교정.

## 우선 액션 (정렬)

### major — API 계약/동작 불일치 (사용자 영향 큼)
1. **spec/2-navigation/1-workflow-list.md** — 상태 필터 param 불일치(isActive vs status)로 **필터 end-to-end 비동작**. spec/코드 중 한쪽 정렬 필요(코드 수정 또는 §2.3 patch). 정렬·태그·폴더 필터 UI 미구현 명시.
2. **spec/2-navigation/14-execution-history.md** — Nodes 열 **항상 '—'**(목록 API nodeExecutions 미반환). EH-LIST-02 실효성 회복(목록 DTO 필드 추가) 또는 spec §2.4/§5 patch.
3. **spec/2-navigation/9-user-profile.md** — §6 API 표 다수 엔드포인트(avatar·notifications/settings·sessions DELETE→POST revoke·users 2FA 별칭)가 코드와 어긋남. 슬러그 URL·알림 설정·아바타 업로드·테마 System 미구현 반영(patch-content) + code 글로브 backend/api 대폭 추가.
4. **spec/2-navigation/7-statistics.md** — API 경로(llm-usage 2분할)·errors 의미(워크플로우별)·기간 옵션·Total Runs 증감률 patch-content + backend/statistics/** 글로브 추가.
5. **spec/2-navigation/0-dashboard.md** — 성공률 공식·정렬 기준·summary 응답 필드·Avg Time 카드 부재 patch-content + backend/dashboard/** 글로브 추가.
6. **spec/2-navigation/3-schedule.md** — /toggle 엔드포인트 부재·UI 액션 부재 patch-content + backend/schedules/** 글로브 추가.
7. **spec/2-navigation/10-auth-flow.md** — resend-verification 부재·/auth 라우트 접두사 불일치·강도바 단계 patch-content + backend/auth/** 글로브.
8. **spec/2-navigation/13-user-guide.md** — 이중언어(ko/en) 미반영: §2 IA·§3 라우트·§4 frontmatter 3절 동시 개정 + lib/docs/route·links·i18n 글로브.
9. **spec/2-navigation/11-error-empty-states.md** — §2.2 Triggers/Schedules CTA·§2.3 필터 초기화 화면 구현(코드) 또는 spec 하향 patch.
10. **spec/2-navigation/6-config.md** — §A.3 usage 이력(IP·응답코드·기간)·§A.2 IP Whitelist·API Key Header 필드 구현 또는 spec patch.

### major — 문서 stale (코드는 정상, 문서 교정)
11. **spec/2-navigation/_product-overview.md** — NAV-TR-09/10/11 상태칸 🚧→✅, NAV-SS-02 '점검'→'다운' 라벨 교정.
12. **spec/2-navigation/2-trigger-list.md** — §3 '목록 화면 생성 금지' 명시 삭제(Add Webhook 실재), formMode enum·PATCH 키·API 표(rotate-secret/revoke-token) patch.
13. **spec/2-navigation/_layout.md** — §3.2 유저 팝업·테마 위치·§5 공통헤더 현실(분산 구현) 반영 + **frontmatter 추가**(add-frontmatter).

### minor / frontmatter-only — code 글로브 보강(추적성)
14. **spec/2-navigation/4-integration.md** / **5-knowledge-base.md** / **12-workflow-version-history.md** / **15-system-status.md** — 본문은 정합, frontmatter code에 backend 모듈(+ KB API 표 4개 endpoint, version-history 마이그레이션) 추가.
15. **spec/2-navigation/8-marketplace.md** — 조치 불필요(keep).
