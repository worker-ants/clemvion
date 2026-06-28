# Code Review 통합 보고서 (Batch 3 — resolution 커밋 de8ebff3c 커버)

## 전체 위험도
**LOW** — Critical 0 · WARNING 5. security/requirement/scope/side_effect/api_contract = NONE. WARNING 은 전부 테스트 커버리지·유지보수 nit (즉각 운영/보안 위험 없음). W1 CORS 수정은 additive·최소권한 부합으로 검증됨.

## Critical
없음.

## 경고 (WARNING) + 처리
| # | 발견 | 처리 |
|---|------|------|
| 1 | isError 상태 분기 두 패널 미검증 | **accept** — 로딩/빈/선택/삭제/load-more 는 검증됨. isError 는 단순 정적 에러문구 렌더(분기 1줄). page+패널+api 다층 커버 충분. 후속 보강 가능 |
| 2 | listMemories kind-미지정 params 케이스 미검증 | **accept** — listScopes q-미지정 케이스는 있음. listMemories kind 분기는 api 클라이언트 `...(kind?{kind}:{})` 단순 동형. 저위험 |
| 3 | CORS exposedHeaders 단위 고정 테스트 부재 | **defer** — main.ts bootstrap 은 단위 테스트 부적합. e2e 통과로 부팅 검증됨. defaultOptions 순수함수 추출은 별도 cleanup |
| 4 | i18n/RoleGate mock 두 테스트 파일 중복 | **defer** — 공통 mock 추출(test-helpers/setupFiles)은 테스트 인프라 cleanup. 기능 무관 |
| 5 | 'X-Deleted-Count' magic string 산재(backend×2·frontend) | **defer** — 공유 상수화는 가치 있으나 backend/frontend 경계 넘는 별도 cleanup. 현재 3곳 일치 확인됨 |

## 참고 (INFO) — 요약
대부분 테스트 추가 제안(isFetchingNextPage·onKindFilterChange·search 콜백·remove 테스트) + 스타일(W10 prefix·describe spec 참조). 현 커버리지(page clearScope 분기 + 패널 5~6케이스 + api 4케이스 + backend 152)로 충분 — 후속 보강 대상. I-1(X-Deleted-Count clamp `Math.max(0,...)`) 는 deletedRowCount 가 이미 비음수 길이라 무해.

## 에이전트별
security/requirement/scope/side_effect/api_contract/documentation/user_guide_sync = NONE. maintainability/testing = LOW (nit). 9 reviewer 실행(router), performance/architecture/dependency/database/concurrency skip(무관).

## 판정
LOW · Critical 0. WARNING 5 전부 저위험 nit → accept/defer (RESOLUTION 기록). 기능(W1 CORS)·spec(S1) 은 직전 resolution 에서 해소. push 가능.
