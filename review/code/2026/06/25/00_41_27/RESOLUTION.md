# RESOLUTION — 00_41_27 (resolution fix diff 재리뷰)

대상 SUMMARY: `review/code/2026/06/25/00_41_27/SUMMARY.md` — 커밋 `fac49ee5`(resolution fix diff) 재리뷰.
**위험도 LOW, Critical 0, WARNING 5, INFO 11.**

## 재리뷰 사유
resolution fix(`fac49ee5`)가 1차 리뷰 세션(`00_08_13`)보다 나중이라 review_guard 가 stale 판정 → 가드 우회 없이
**정석 재리뷰**. 이 라운드는 **코드 동결**(아래 모두 dismiss/defer)로 종결해 review-fix 루프를 차단한다.

## WARNING 처분 (전부 코드 무변경)

| # | 처분 | 근거 |
|---|------|------|
| W1 (getStatus form/ai_conversation/unknown interactionType 테스트 미커버) | **defer** | `rawInteractionType` 화이트리스트는 단순 분기(3값+null fallback). `external-interaction.e2e-spec`(214 PASS)가 통합 경로를 커버. 단위 엣지 3건은 저비용 후속 |
| W2 (`@Index` full vs Flyway V095 partial 중복) | **dismiss** | `app.module.ts:103` **`synchronize: false`** 확인 — entity `@Index` 는 TypeORM 메타 인식만이고 실제 DB 인덱스는 Flyway V095(`idx_node_execution_exec_status_active`, 단일 진실)가 생성한다. 중복 인덱스 생성 없음(`chunk-entity.entity.ts` 주석도 동일 원칙 명시) |
| W3 (cancel 응답 `status` vs `currentStatus` drift) | **defer** | **본 커밋 미도입(사전 존재)** — `InteractAckDto` 는 기존 정의. spec §5.4 표기 정합은 별도 spec grooming |
| W4 (getStatus ~85줄 복잡도) | **defer** | `buildWaitingContext` private 헬퍼 분리 — 우선순위 낮은 리팩터링 후속 |
| W5 (useWidget ~435줄) | **defer** | 사전 부채, 중장기 리팩터링 |

## INFO (전부 defer)
- 보안: outputData allowlist 런타임 필터(INFO1, JSDoc 제약은 본 라운드 명기됨)·`itk_*` 평문 저장(INFO2, 기존 설계)·`apiBase` query schema 제한(INFO3, 직접 URL 접근 한정)·select 최적화(INFO4)
- 요구사항: updatedAt 계산 규칙(INFO5, 사전)·중복 WAITING dispatch 멱등성(INFO6 — reducer 가 최신값 덮어쓰기라 무해, 1차 RESOLUTION W5/W8 와 동일 근거)
- SPEC-DRIFT(INFO7/11): §5.2 SSE 절에 `?lastEventId=0` 첫 연결 의미론 1줄 — 이미 §3.2(EIA-IN-07)·§5.3 에 명기됨, §5.2 대칭 보강은 저비용 후속
- 테스트: SSE_SEQ_PLACEHOLDER export(INFO8)·seedWaitingFromStatus soft-fail(INFO9)
- 문서: interact/cancel/refreshToken public JSDoc(INFO10, 기존 누락)

## 코드 동결
이 라운드 **코드 무변경**(WARNING 5 dismiss/defer, INFO defer). 세션(`00_41_27`)이 newest codebase(`fac49ee5`)보다
나중이라 push gate(review_guard) freshness 를 충족한다 — review-fix 루프 종결.

## TEST
- 1·2차 라운드에서 lint·unit(backend 28·cwc 16)·build·**e2e 36 suites/214 PASS(make e2e-test, dockerized)** green.
- 이 라운드는 코드 무변경이라 재실행 불요.
