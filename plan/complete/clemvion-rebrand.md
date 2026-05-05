# Plan: 제품명 Idea Workflow → Clemvion 전환

> 외부 플랜 파일: `~/.claude/plans/crystalline-hugging-milner.md` (전체 설계). 본 문서는 프로젝트 내부 실행 체크리스트.

## 배경

제품명을 **Idea Workflow → Clemvion**으로 변경한다. 신규 브랜드 컨셉은 덩굴식물 모티브 ("흐름은 설계하는 것이 아니라 자라나야 한다"). 사용자 자산이 빈약했던 로고/브랜드 가이드도 함께 마련한다.

## 사용자 결정 사항

| 항목 | 결정 |
| --- | --- |
| `Workflow AI Assistant` 명칭 | 서브 브랜드로 그대로 유지 (변경 없음) |
| 이메일 도메인 | `noreply@example.com` placeholder로 변경 |
| localStorage / OTEL / MCP_CLIENT_NAME 등 기술 식별자 | 전부 `clemvion`으로 일괄 변경, 호환 마이그레이션 없음 |
| 로고/브랜드 자산 | 브랜드 가이드 문서 + 임시 SVG 자산 둘 다 |

## 명시적 비변경 영역 (사용자 지정)

- k8s 매니페스트 (`k8s/**`)
- Docker 이미지 태그 (`docker build -t idea-workflow/...`, `Dockerfile`, `docker-compose.yml`의 컨테이너/이미지 명)
- git repo 이름·remote URL
- 디렉터리명 (`idea-workflow/` 루트, `frontend/`, `backend/`)
- DB 이름 (`docker-compose.yml`의 `POSTGRES_DB=workflow` 변경 제외 → `.env.example`/README도 `workflow`로 통일하여 일관성 유지)
- `Workflow AI Assistant` 정확 토큰
- `review/**` 시점 기록 문서, `plan/complete/**`

## 체크리스트

### Phase 1 — 문서/브랜드 ✅

- [x] `plan/in-progress/clemvion-rebrand.md` 생성 (본 문서)
- [x] `prd/brand.md` 신규 작성 (브랜드 스토리·컬러·타이포·로고 가이드)
- [x] `README.md` 갱신 (제목·서두·.env 예시; docker 이미지 태그 영역은 보존)
- [x] `prd/0-overview.md` 갱신 (제품 비전 + brand.md 링크)
- [x] `backend/README.md` 갱신 (제목; docker 이미지 태그 영역은 보존)
- [x] `frontend/README.md` 갱신 (i18n 섹션 storage key 표기)
- [x] `k8s/README.md` 본문 텍스트 갱신 (yaml 매니페스트는 보존)
- [x] `prd/`/`spec/`/`memory/`/`user_memo/` 잔존 표기 grep 점검 — 의도 외 잔존 없음

### Phase 2 — Backend ✅

- [x] `backend/src/main.ts` Swagger title/description
- [x] `backend/src/modules/mail/mail.service.ts` 이메일 제목·HTML·텍스트 본문 7개 위치
- [x] `backend/src/modules/mail/mail.service.spec.ts` expect 문자열
- [x] `backend/src/modules/auth/totp.service.ts` ISSUER 상수
- [x] `backend/src/instrumentation.ts` OTEL 기본 서비스명 + 주석
- [x] `backend/src/modules/mcp/mcp-client.service.ts` MCP_CLIENT_NAME 상수
- [x] `backend/src/common/config/mail.config.ts` from 폴백
- [x] `backend/.env.example` MAIL_FROM, OTEL_SERVICE_NAME
- [x] `backend/example.env` MAIL_FROM (별도 dev 샘플)

### Phase 3 — Frontend ✅

- [x] `frontend/src/app/layout.tsx` metadata.title / description
- [x] `frontend/src/lib/stores/locale-store.ts` STORAGE_KEY
- [x] `frontend/src/lib/i18n/cookie.ts` LOCALE_COOKIE_NAME
- [x] `frontend/src/lib/stores/__tests__/locale-store.test.ts` 키 표기
- [x] `frontend/src/lib/i18n/__tests__/locale-sync.test.tsx` 키 표기

### Phase 4 — 임시 브랜드 자산 ✅

- [x] `frontend/public/logo.svg` (워드마크)
- [x] `frontend/public/logo-mark.svg` (덩굴 모티브 심볼)
- [x] `frontend/src/app/icon.svg` (Next.js 메타데이터 컨벤션, 32x32 SVG)
- [~] `frontend/src/app/apple-icon` — Next.js가 svg 미지원이라 정식 PNG 자산 도입 시 추가 (brand.md §8.3 메모)

### Phase 5 — 검증 ✅

- [x] `grep -rn "Idea Workflow\|idea-workflow\|ideaworkflow\|아이디어 워크플로우"` 잔존 영역 확인 → docker 태그·k8s 매니페스트·디렉터리·plan 메타 문서에 한정 (의도)
- [x] `grep -rn "Workflow AI Assistant"` 16개 위치 그대로 보존됨 (의도)
- [x] `cd backend && npm run build` exit 0
- [x] `cd backend && npm test -- --testPathPatterns=mail.service.spec` 11/11 통과
- [x] `cd frontend && npm run lint` exit 0 (오류 없음)
- [x] `cd frontend && npx vitest run locale-sync.test locale-store.test` 15/15 통과
- [x] 본 plan 문서 → `plan/complete/`로 `git mv`

## 리스크 메모

- localStorage 키 변경으로 기존 사용자의 locale 선택이 1회 초기화됨 (사용자 결정대로 호환 무시).
- OTEL 서비스명 변경 시 기존 대시보드/알람 필터를 `clemvion-backend`로 갱신해야 함 (인프라 변경은 본 작업 범위 밖).
- `noreply@example.com`은 RFC 2606 reserved 도메인 → 실제 발송 시 reject됨. 배포 환경에서 `MAIL_FROM` env로 실제 도메인 주입 필요.
