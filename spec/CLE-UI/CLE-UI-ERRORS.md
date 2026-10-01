---
id: "CLE-UI-ERRORS"
title: "오류 화면과 빈 상태"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-ERRPAGE-001", "REQ-ERRPAGE-002", "REQ-ERRPAGE-003", "REQ-ERRPAGE-004", "REQ-ERRPAGE-005", "REQ-ERRPAGE-006", "REQ-ERRPAGE-007", "REQ-ERRPAGE-008", "REQ-ERRPAGE-009", "REQ-ERRPAGE-010", "REQ-ERRPAGE-011", "REQ-ERRPAGE-012", "REQ-ERRPAGE-013", "REQ-ERRPAGE-014", "REQ-ERRPAGE-015", "REQ-ERRPAGE-016", "REQ-ERRPAGE-017", "REQ-ERRPAGE-018", "REQ-ERRPAGE-019", "REQ-ERRPAGE-020", "REQ-ERRPAGE-021", "REQ-ERRPAGE-022", "REQ-ERRPAGE-023", "REQ-ERRPAGE-024"]
basis_superseded: false
parent: "CLE-UI"
ancestors: ["CLE-VISION", "CLE-UI"]
area: "CLE-UI"
content_hash: "bcb255526423b22177fc309a16ff926c4d204f84355054781cf85afbb3dc770f"
read_as: "approved"
task: null
source_paths: ["spec/2-navigation/11-error-empty-states.md"]
mirror_sha256: "928855b8770ba36f866c0d31cbc36d10a5e40dcd384e34d6ab9e7949fd650bdf"
etag: "sha256-e615cf6539983ddf6bdd97509238da11b0a7c6de761eea2300426a532cb44e4e"
---
> 구현 상태: 구현됨 · 원문: `spec/2-navigation/11-error-empty-states.md` (전체) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 화면 전체를 바꾸는 전체 화면 오류(error page variant)와, 데이터가 없을 때 목록 자리에 보이는 빈 상태(empty state, `EmptyState`)를 정한다. 검색·필터 결과가 0건일 때의 "검색 결과 없음" 상태도 여기서 정한다.

범위 밖:

- 에러 응답 형식과 클라이언트의 토스트 처리는 [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md) 가 정한다.
- 화면 안의 작은 신호(배지·토스트·인라인 안내·스켈레톤)와 워크스페이스 슬러그 라우팅은 [레이아웃과 내비게이션](CLE-UI-LAYOUT.md) 이 정한다.
- 화면 문구의 실제 값과 문체 규칙은 [다국어와 화면 문구](CLE-UI-I18N.md) 가 정한다.

## 요구사항

### 전체 화면 오류

- REQ-ERRPAGE-001 WHEN 시스템 수준 에러가 나면 THE SYSTEM SHALL 화면 전체를 에러 페이지로 바꾼다. (원본: 11 §1)
- REQ-ERRPAGE-002 WHEN 에러 페이지를 그리면 THE SYSTEM SHALL 아이콘, 제목, 설명, CTA 버튼을 화면 가운데에 세로로 둔다. (원본: 11 §1.1)
- REQ-ERRPAGE-003 WHEN 에러 페이지를 그리면 THE SYSTEM SHALL 라이트와 다크 테마를 모두 지원한다. (원본: 11 §1.1)
- REQ-ERRPAGE-004 WHEN 세션이 만료되면(401) THE SYSTEM SHALL 사이드바 없는 `/login?redirect=<현재 경로>` 로 넘겨 로그인 뒤 원래 URL 로 돌아오게 한다. (원본: 11 §1.3)
- REQ-ERRPAGE-005 WHEN 401 이 에러 바운더리까지 전파되면 THE SYSTEM SHALL `(main)/error.tsx` 가 같은 로그인 리다이렉트를 한다. (원본: 11 §1.3)
- REQ-ERRPAGE-006 WHEN API 응답 403 을 받으면 THE SYSTEM SHALL 권한 없음 에러 페이지를 보인다. (원본: 11 §1.3)
- REQ-ERRPAGE-007 WHEN 존재하지 않는 라우트에 접근하거나 API 404 응답을 받으면 THE SYSTEM SHALL 페이지 없음 에러 페이지를 보인다. (원본: 11 §1.3)
- REQ-ERRPAGE-008 WHEN API 5xx 응답을 받으면 THE SYSTEM SHALL 서버 에러 페이지를 보인다. (원본: 11 §1.3)
- REQ-ERRPAGE-009 IF API 호출이 네트워크 타임아웃·DNS 실패 같은 이유로 응답 없이 실패하면 THE SYSTEM SHALL 네트워크 오류 페이지를 보인다. (원본: 11 §1.3)
- REQ-ERRPAGE-010 WHEN 요청이 응답 없이 실패하면(`!response && request`, `ERR_NETWORK`, `ECONNABORTED`) THE SYSTEM SHALL 그 실패를 네트워크 오류로 분류한다. (원본: 11 Rationale)
- REQ-ERRPAGE-011 IF 전파된 에러가 402·405·408·429 처럼 정의하지 않은 4xx 이면 THE SYSTEM SHALL 서버 에러 페이지로 보인다. (원본: 11 Rationale)
- REQ-ERRPAGE-012 WHEN 세션 만료를 처리하면 THE SYSTEM SHALL 사이드바를 숨긴다. (원본: 11 §1.3)
- REQ-ERRPAGE-013 WHEN 권한 없음·페이지 없음·서버 에러·네트워크 오류 페이지를 보이면 THE SYSTEM SHALL 로그인 상태가 유지되므로 사이드바를 보인다. (원본: 11 §1.3)
- REQ-ERRPAGE-014 WHEN 사용자가 세션 만료 페이지의 "다시 로그인" 을 누르면 THE SYSTEM SHALL 로그인 페이지로 이동한다. (원본: 11 §1.2)
- REQ-ERRPAGE-015 WHEN 사용자가 권한 없음·페이지 없음·서버 에러 페이지의 "대시보드로 이동" 을 누르면 THE SYSTEM SHALL 대시보드로 이동한다. (원본: 11 §1.2)
- REQ-ERRPAGE-016 WHEN 사용자가 서버 에러·네트워크 오류 페이지의 "다시 시도" 를 누르면 THE SYSTEM SHALL 현재 페이지를 새로 고친다. (원본: 11 §1.2)
- REQ-ERRPAGE-017 IF `/w/<slug>/…` 의 슬러그가 없는 워크스페이스이거나 사용자가 멤버가 아니면 THE SYSTEM SHALL 404·403 이 아니라 기본 워크스페이스로 편의 리다이렉트한다. (원본: 11 §1.3)
- REQ-ERRPAGE-018 IF `/w/<slug>/…` 경로가 어떤 라우트에도 맞지 않으면 THE SYSTEM SHALL 404 페이지 없음 에러로 끝낸다. (원본: 11 §1.3)

### 빈 상태

- REQ-ERRPAGE-019 WHEN 목록에 데이터가 없으면 THE SYSTEM SHALL 목록 영역 가운데에 아이콘, 안내 문구, CTA 버튼을 보인다. (원본: 11 §2.1)
- REQ-ERRPAGE-020 WHILE 빈 상태를 보이는 동안 THE SYSTEM SHALL 위쪽 검색·필터 바를 그대로 둔다. (원본: 11 §2.1)
- REQ-ERRPAGE-021 WHEN 빈 상태 아이콘을 그리면 THE SYSTEM SHALL 그 리소스를 상징하는 라인 아이콘을 쓴다. (원본: 11 §2.1)
- REQ-ERRPAGE-022 WHEN 대시보드·워크플로우·통합·실행 내역·트리거·스케줄 목록이 비면 THE SYSTEM SHALL 공유 `EmptyState` 컴포넌트로 화면별 안내와 CTA 를 보인다. (원본: 11 §2.2)
- REQ-ERRPAGE-023 WHEN 검색이나 필터 적용 결과가 0건이면 THE SYSTEM SHALL 일반 빈 상태와 다른 "검색 결과 없음" 상태를 보인다. (원본: 11 §2.3) (부분 구현)
- REQ-ERRPAGE-024 WHEN 사용자가 "검색 결과 없음" 상태의 "필터 초기화" 를 누르면 THE SYSTEM SHALL 검색어와 필터를 모두 지우고 전체 목록을 보인다. (원본: 11 §2.3) (부분 구현)

## 전체 화면 오류

### 화면 구성

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 아이콘·일러스트 | 가운데 맨 위 | 에러 종류별 아이콘 | — |
| 제목 | 아이콘 아래 | H1 제목 | — |
| 설명 | 제목 아래 | 본문 설명 | — |
| CTA | 설명 아래 | 버튼 1~2개 | 로그인·대시보드·새로 고침 |
| 사이드바 | 왼쪽 | 에러 종류에 따라 보이거나 숨긴다 | 세션 만료만 숨긴다 |

### 에러 페이지 다섯 가지

제목과 설명은 원문 표기를 따옴표로 옮긴다. 화면에 실제로 보이는 문구는 화면 문구 사전이 기준이다(문체 문제는 [미결 사항](#미결-사항)).

| 에러 | HTTP | 아이콘 | 제목 | 설명 | CTA |
| --- | --- | --- | --- | --- | --- |
| 세션 만료 | 401 | 자물쇠 | "세션이 만료되었습니다" | "보안을 위해 자동 로그아웃 되었습니다. 다시 로그인해주세요." | "다시 로그인" → 로그인 페이지 |
| 권한 없음 | 403 | 차단 | "접근 권한이 없습니다" | "이 페이지에 접근할 권한이 없습니다. 워크스페이스 관리자에게 문의하세요." | "대시보드로 이동" → 대시보드 |
| 페이지 없음 | 404 | 돋보기 | "페이지를 찾을 수 없습니다" | "요청하신 페이지가 존재하지 않거나 이동되었습니다." | "대시보드로 이동" → 대시보드 |
| 서버 에러 | 500 | 경고 | "문제가 발생했습니다" | "서버에서 예기치 않은 오류가 발생했습니다. 잠시 후 다시 시도해주세요." | "다시 시도" → 현재 페이지 새로 고침, "대시보드로 이동" → 대시보드 |
| 네트워크 오류 | — | 연결 끊김 | "네트워크에 연결할 수 없습니다" | "인터넷 연결을 확인하고 다시 시도해주세요." | "다시 시도" → 현재 페이지 새로 고침 |

### 감지 규칙

| 규칙 | 설명 |
| --- | --- |
| 401 | 세션이 만료되면 사이드바 없는 `/login?redirect=<현재 경로>` 로 넘겨, 로그인 뒤 원래 URL 로 돌아오게 한다. 401 이 에러 바운더리까지 전파되면 `(main)/error.tsx` 가 같은 리다이렉트를 한다 |
| 403 | API 응답 403 을 받으면 권한 없음 페이지를 보인다. 토스트로 보일지와 정의가 갈린다. [미결 사항](#미결-사항) 참조 |
| 404 | 존재하지 않는 라우트에 접근하거나 API 404 를 받으면 보인다 |
| 500 | API 응답 5xx 를 받으면 서버 에러 페이지를 보인다. 토스트로 보일지와 정의가 갈린다. [미결 사항](#미결-사항) 참조 |
| 네트워크 오류 | 네트워크 타임아웃·DNS 실패 같은 이유로 API 호출이 실패하면 보인다 |
| 사이드바 | 401 은 숨김. 403·404·500·네트워크 오류는 로그인 상태가 유지되므로 보인다 |
| 슬러그 해석 실패 | 404·403 이 아니다. `/w/<slug>/…` 의 슬러그가 없는 워크스페이스이거나 사용자가 멤버가 아니면, `[slug]` 레이아웃이 그리는 공용 `WorkspaceSlugGate` 가 기본 워크스페이스로 넘긴다. 폴백 규칙은 `resolve-fallback.ts` 의 `resolveFallbackWorkspace` 다. 이것은 화면 편의 리다이렉트이고 인가 경계가 아니다. 헤더 위조 같은 실제 인가는 백엔드 `RolesGuard` 가 403 으로 막는다. 라우트에 `@Roles()` 가 있든 없든 워크스페이스 멤버십을 검사한다([워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)). `(main)`·`(editor)` 두 슬러그 레이아웃이 이 게이트를 함께 쓴다 |
| `/w/<slug>` 아래 알 수 없는 경로 | 404 다. `/w/<slug>/…` 가 어떤 라우트에도 맞지 않으면(예: `/w/<slug>/docs`, `/docs` 는 워크스페이스 밖 라우트) 옛 경로 흡수 라우트가 슬러그를 다시 붙이지 않고 `notFound()` 로 끝낸다. 다시 붙이면 무한 리다이렉트가 되기 때문이다([레이아웃과 내비게이션](CLE-UI-LAYOUT.md)). 위 행과 다르다. 위는 라우트는 있고 슬러그 해석만 실패한 경우이고, 이 행은 라우트 자체가 없는 경우다. `/w/<slug>` 만이면 그 워크스페이스 대시보드로 넘긴다(404 아님) |

## 빈 상태

### 공통 패턴

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 아이콘 | 목록 영역 가운데 맨 위 | 리소스를 상징하는 라인 아이콘 | — |
| 안내 문구 | 아이콘 아래 | 본문 안내 | — |
| CTA | 안내 아래 | 버튼 1개(없을 수 있다) | 생성 화면이나 다른 목록으로 이동 |
| 검색·필터 바 | 목록 위 | 기존 검색·필터 | 빈 상태에서도 그대로 둔다 |

### 화면별 빈 상태

공유 `EmptyState` 컴포넌트(아이콘 + 안내 문구 + CTA)를 대시보드·워크플로우·통합·실행 내역·트리거·스케줄 목록에 쓴다. 안내 문구는 원문 표기를 옮긴다. 화면에 실제로 보이는 문구는 화면 문구 사전이 기준이고, 지금 사전의 빈 상태 문구는 해요체다(예: "등록된 워크플로우가 없어요").

| 화면 | 아이콘 | 안내 문구(원문 표기) | CTA | 상태 |
| --- | --- | --- | --- | --- |
| 대시보드 — 최근 워크플로우 | 워크플로우 | "아직 워크플로우가 없습니다. 첫 워크플로우를 만들어보세요." | "워크플로우 만들기" → 워크플로우 생성 | 구현됨 |
| 대시보드 — 최근 실행 | 실행 | "아직 실행 기록이 없습니다. 워크플로우를 실행하면 여기에 표시됩니다." | 없음 | 구현됨 |
| 워크플로우 목록 | 워크플로우 | "워크플로우가 없습니다. 자동화를 시작하려면 새 워크플로우를 만들어보세요." | "새 워크플로우" → 워크플로우 생성 | 구현됨 |
| 트리거 목록 | 트리거 | "트리거가 없습니다. 워크플로우를 자동으로 시작하려면 트리거를 추가하세요." | "트리거 추가" → 트리거 생성 | 구현됨 |
| 스케줄 목록 | 달력 | "스케줄이 없습니다. 워크플로우를 정기적으로 실행하려면 스케줄을 추가하세요." | "스케줄 추가" → 스케줄 생성 | 구현됨 |
| 통합 목록 | 연결 | "연동된 서비스가 없습니다. 외부 서비스를 연결하여 워크플로우에서 활용하세요." | "서비스 연결" → 통합 추가 | 구현됨 |
| 실행 내역 목록 | 실행 | "실행 기록이 없습니다. 워크플로우를 실행하면 여기에서 결과를 확인할 수 있습니다." | "워크플로우 목록" → 워크플로우 목록 이동 | 구현됨 |

현재 구현은 생성 권한이 필요한 CTA 를 편집자 이상에게만 보이는 화면이 있다. 예를 들어 트리거 목록의 "트리거 추가" 는 `RoleGate minRole="editor"` 로 감싸 있다.

### 검색 결과 없음

검색이나 필터 적용 결과가 0건이면 일반 빈 상태와 다른 전용 상태를 보인다.

| 항목 | 설명 |
| --- | --- |
| 아이콘 | 돋보기 |
| 안내 문구(원문 표기) | "검색 결과가 없습니다. 다른 키워드로 검색하거나 필터를 변경해보세요." |
| CTA | "필터 초기화" → 검색어와 필터를 모두 지우고 전체 목록을 보인다 |
| 적용 범위 | 검색바나 필터가 있는 모든 목록 화면 공통 |

현재 구현은 워크플로우 목록에만 있다(`workflows.resetFilters`). 트리거·스케줄 목록은 필터 결과가 0건이어도 일반 빈 상태를 보인다. 적용 범위를 어떻게 할지는 [미결 사항](#미결-사항) 에 있다.

## 미결 사항

- **403·5xx 를 전체 화면 에러 페이지로 보일지 토스트로 보일지**: 이 문서의 감지 규칙은 API 응답 403·5xx 를 받으면 전체 화면 에러 페이지를 보인다고 정한다. [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md) 의 클라이언트 처리 규칙은 같은 응답에 토스트("권한이 없습니다", "서버 오류가 발생했습니다")를 보인다고 정한다. 이 문서의 Rationale 은 "페이지까지 전파된 에러만 전체 화면, 컴포넌트가 국소 처리한 에러는 인라인" 으로 두 규칙을 나누지만, 에러 응답 문서는 그 구분을 적지 않는다. 현재 구현은 Next.js 에러 바운더리로, 전파된(처리하지 않은) 에러만 `errorToVariant()` 가 전체 화면 variant 로 바꾼다. 어느 경우를 "전파" 로 볼지 정하고 규칙을 한 문서에 두어 다른 쪽이 인용하게 해야 한다. 결정 필요.
- **에러 페이지 문구의 문체**: [다국어와 화면 문구](CLE-UI-I18N.md) 는 화면에 보이는 한국어 문자열을 해요체로 통일하라고 정한다. 이 문서의 에러 페이지 제목·설명은 합니다체이고, 현재 화면 문구 사전의 에러 페이지 문구도 합니다체다. 에러 페이지 문구를 해요체로 바꿀지, 에러 페이지를 문체 규칙의 예외로 둘지 정해야 한다. 빈 상태 문구는 사전이 이미 해요체이므로 원문 표기만 낡았다.
- **"검색 결과 없음" 의 적용 범위**: 이 문서는 검색바나 필터가 있는 모든 목록에 "필터 초기화" CTA 를 가진 전용 상태를 둔다고 정한다. 현재 구현은 워크플로우 목록에만 있고, [워크플로우 목록과 폴더](../CLE-WF/CLE-WF-LIST.md) 는 초기화 버튼 없이 "필터를 조정해 보세요" 안내만 적는다. 적용 범위를 워크플로우 목록으로 좁힐지, 나머지 목록에도 구현할지 정해야 한다.

## 구현 위치

- `codebase/frontend/src/components/ui/empty-state.tsx`
- `codebase/frontend/src/components/ui/error-page.tsx`
- `codebase/frontend/src/app/not-found.tsx`
- `codebase/frontend/src/app/global-error.tsx`
- `codebase/frontend/src/app/(main)/error.tsx`
- `codebase/frontend/src/app/(main)/not-found.tsx`
- `codebase/frontend/src/app/(main)/[...rest]/page.tsx` (`/w/<slug>` 아래 알 수 없는 경로를 404 로 끝내는 `notFound()` 호출)
- `codebase/frontend/src/app/(main)/w/[slug]/dashboard/page.tsx`
- `codebase/frontend/src/app/(main)/w/[slug]/workflows/page.tsx`
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/page.tsx`
- `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/page.tsx`
- `codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx`
- `codebase/frontend/src/app/(main)/w/[slug]/schedules/page.tsx`
- `codebase/frontend/src/lib/workspace/workspace-slug-gate.tsx`
- `codebase/frontend/src/lib/workspace/resolve-fallback.ts`

## Rationale

### 권한 없음 페이지의 CTA 가 대시보드로 가는 이유

처음에는 권한 없음 페이지의 CTA 를 "워크스페이스 선택 화면(목록)" 으로 정했다. 그러나 지금 앱에는 워크스페이스를 고르거나 전환하는 화면이 없고 워크스페이스 설정(`/workspace/settings`)만 있다. 여러 워크스페이스를 고르는 화면이 구현되지 않았으므로, 권한과 상관없이 언제나 들어갈 수 있는 대시보드(`/dashboard`)로 보낸다. 워크스페이스 선택 화면이 생기면 이 CTA 를 그 경로로 바꾼다.

### 감지를 Next.js 에러 바운더리로 구현한 이유

401·403·404·500·네트워크 감지는 전역 인터셉터가 화면을 가로채는 방식이 아니라 Next.js App Router 에러 바운더리(`error.tsx`, `not-found.tsx`, `global-error.tsx`)로 구현한다. 페이지에서 전파된(처리하지 않은) 에러의 HTTP 상태를 `errorToVariant()` 가 variant 로 바꾼다. 컴포넌트가 스스로 처리하는 에러(인라인 메시지 등)는 화면을 덮지 않는다. "모든 403 이 화면 전체를 덮는" 문자 그대로의 인터셉터보다 실제 사용 흐름에 맞다고 보았다.

- **401 사이드바 숨김**: 세션 만료는 `(main)/error.tsx` 가 사이드바 없는 `/login?redirect=` 로 넘겨 충족한다. 인증 프로바이더의 세션 만료 처리와 같은 경로다.
- **정의하지 않은 4xx(402·405·408·429 등)**: 이 문서가 정하지 않은 상태 코드는 서버 에러 variant 로 보인다. 보수적인 기본값이다. 개별 4xx 페이지가 필요하면 이 문서를 고쳐 더한다.
- **네트워크 감지**: axios 기준으로 `!response && request`, `ERR_NETWORK`, `ECONNABORTED` 를 네트워크 오류로 본다.
