# RESOLUTION — 웹채팅 운영 콘솔 코드 리뷰 (증분 1)

대상 SUMMARY: `review/code/2026/06/23/10_07_47/SUMMARY.md` (Critical 0, WARNING 18, INFO 다수).
선행 spec 리뷰 SUMMARY: `review/code/2026/06/23/09_58_47/SUMMARY.md` (Critical 0, WARNING 3 — 모두 해소).

## 조치 항목

| SUMMARY # | 발견 | 조치 |
|---|---|---|
| 코드 W-1 | useAppearanceDraft 이중 setState | loadedId 제거, key 리마운트+lazy init 신뢰 |
| 코드 W-2 | setState 업데이터 내 localStorage 쓰기 | localStorage 를 별도 sync effect 로 분리 |
| 코드 W-3 | create 후 `["triggers"]` 캐시 미무효화 | onSuccess 에서 web-chat-instances + triggers 동시 invalidate(Promise.all 반환) |
| 코드 W-5,6,7,18 | 테스트 갭(인스턴스 전환·에러·로딩·admin) | 4 케이스 추가(web-chat-page.test) |
| 코드 W-9 | escapeForScript U+2028/U+2029 미처리 | 유니코드 라인구분자 이스케이프 + 테스트 |
| 코드 W-10 | localStorage 역직렬화 검증 부재 | sanitizeDraft(hex color·position·locale 화이트리스트) |
| 코드 W-11 | isLoading skeleton 부재 | Loader2 + common.loading 로딩 표시 |
| 코드 W-12 | onCreated 응답 래핑 미방어 | extractCreatedId(`data?.id ?? id`) |
| 코드 W-13 | useWorkflowOptions staleTime 0 | staleTime 60s |
| 코드 W-15 | mutationFn 반환 타입 미명시 | CreatedWebChat 타입 명시 |
| 코드 W-16 | limit:100 매직넘버 중복 | MAX_LIST_LIMIT 상수 |
| 코드 W-17 [SPEC-DRIFT] | 5-admin-console status spec-only·code:[] | status: partial + code globs 갱신 |
| 코드 W-18 [SPEC-DRIFT] | §5 fallback Phase1 전 동작 미기술 | §5 증분 단계 주석 추가 |
| 코드 INFO-1,2,8,14,15 | 미사용 import·미사용 i18n 키·중복 필터 주석·CRLF·prune 테스트 | 제거/주석/테스트 추가 |
| spec W-1(09_58) | §6 boot config 전달 메커니즘 미정의 | Phase 3(증분2) 선결로 plan 등록 |
| spec W-2(09_58) | env 불일치 CORS 위험 | 0-architecture §4 주석 추가 |
| spec W-3(09_58) | §2.1 들여쓰기 | 2-space 교정 |

fix 는 단일 REVIEW 커밋에 포함.

## SPEC-CONSISTENCY (--impl-done)

`/consistency-check --impl-done spec/7-channel-web-chat/` → **BLOCK: NO** (Critical 0,
`review/consistency/2026/06/23/10_27_50/SUMMARY.md`). WARNING/INFO(상태 표·plan 체크박스·.env.example·
per_trigger 주석·0-overview §6.2) grooming 반영 — NAV-WC-01~05 ✅·06 🚧(증분2), plan Phase 0 [x],
`.env.example` 에 `NEXT_PUBLIC_WIDGET_CDN_BASE` 주석, use-web-chat per_trigger 주석. 보류: EIA §14
authType(선재), spec-draft fallback 이력(계획 산출물).

## TEST 결과

- **lint**: 통과 (grooming 후 재통과 `_test_logs/lint-20260623-103925.log`)
- **unit**: 통과 — frontend 220 files / 4567 tests passed; web-chat 타깃 4 files / 27 tests passed
  (grooming 후 재통과 `_test_logs/unit-20260623-104000.log`)
- **build**: 패키지 빌드 통과 (frontend `next build` 성공, `/web-chat` 라우트 생성). **docker 이미지 빌드는 환경 차단**
  (`DeadlineExceeded: context deadline exceeded` — `FROM node:24-alpine` 단계; frontend-only 변경·Dockerfile 무변경과 무관, 실측 확인).
- **e2e**: 환경 차단 — `make e2e-test` 의 docker 이미지 빌드가 `DeadlineExceeded`(`FROM flyway/flyway:10-alpine`)로 실패.
  실측 확인(`_test_logs/e2e-*.log`). 본 변경은 frontend-only 이며 해당 backend e2e 스위트에 대응 시나리오 부재.

## 보류·후속 항목

- **코드 W-4 (by-design)**: 클라이언트 `crypto.randomUUID()` endpointPath 는 spec 2-trigger-list §2.5 규약(클라 생성 공개 webhook path).
  이중 제출은 dialog `isPending` 가드로 차단, 뮤테이션 자동 retry 0. 변경 불요.
- **코드 W-8 (증분 2)**: `/web-chat` 운영 콘솔 user guide docs — 미리보기 포함 완성(증분 2) 시 `user-guide-writer` 로 작성.
  `plan/in-progress/web-chat-console.md` Phase 4 / 증분 2 에 등록.
- **코드 W-14·INFO(아키텍처/네이밍 저영향)**: createButton 컴포넌트 추출·TriggerListItem 타입 통합 등 — 증분 2 리팩터 시 검토.
- **spec W-1(09_58, §6 boot config 전달)**: Phase 3(증분 2) 착수 전 project-planner 가 §6 에 명세. plan Phase 3 선결 항목 등록.
