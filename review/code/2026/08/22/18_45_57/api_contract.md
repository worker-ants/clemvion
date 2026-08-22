# API 계약(API Contract) 리뷰

## 대상 변경 개요

이번 changeset 은 24개 파일 전부가 다음 범주에 속한다:

- `plan/in-progress/*.md` — plan 문서 (신설 draft + 기존 트래커 체크박스 갱신)
- `review/consistency/**/*.{json,md}` — `/consistency-check` 실행 산출물(재시도 상태·메타데이터·checker 리포트)
- `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`, `spec/conventions/node-output.md` — 기존 spec 문서에 **1개 신설 conventions 문서로의 상호 참조 콜아웃(3~4줄)** 추가
- `spec/conventions/egress-masking.md` — 신설 conventions 문서. egress 마스킹(깊이 상한·비교 연산자·마커)의 **좌표계를 서술**하는 문서로, 기존에 이미 구현·배포된 코드(`@workflow/masked-markers`, `sanitize-error-message.ts`, `strip-external-only-fields.ts`, `websocket.service.ts`, `reject-masked-resubmission.ts`, `lib/utils/masked-markers.ts`)의 동작을 문서화한 것

`codebase/backend`·`codebase/frontend`·`codebase/packages` 하위의 실제 코드(컨트롤러·DTO·라우트·서비스·미들웨어 등)는 **단 한 줄도 변경되지 않았다**. 신설된 `spec/conventions/egress-masking.md` 는 API 엔드포인트·요청/응답 스키마·URL 경로·페이지네이션·인증/인가 로직을 정의하거나 수정하는 문서가 아니라, 기존에 구현된 egress 마스킹 메커니즘(REST 응답·WS emit·재제출 거부 판정에 공통 적용되는 부수적 방어 계층)의 **내부 좌표계를 사후적으로 문서화**한 것이며, 신규 API 도입이나 기존 API 응답 스키마 변경을 수반하지 않는다.

## 발견사항

없음.

## 요약

이번 변경분은 spec/plan 문서와 consistency-check 산출물로만 구성되어 있으며, API 엔드포인트 정의·요청/응답 스키마·라우팅·에러 응답 형식·페이지네이션·인증/인가 등 실제 API 계약에 영향을 주는 코드(`codebase/backend`, `codebase/frontend`, `codebase/packages`)는 포함되어 있지 않다. 신설된 `spec/conventions/egress-masking.md` 는 기존 구현의 내부 마스킹 좌표계(깊이 상한·비교 연산자·마커)를 문서화할 뿐 API 표면 자체를 바꾸지 않으므로 API 계약 관점의 리뷰 대상이 아니다.

## 위험도
NONE
