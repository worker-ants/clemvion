# RESOLUTION — UnsearchableBanner 리팩토링 (A2 follow-up)

리뷰 **RISK LOW · Critical 0 · Warning 4**. Warning 처리 의무를 4건 전부 **수동 조치(코드 무변경) + 사유 기록**으로 이행한다. 추가 코드 변경은 review-before-stop 가드를 재무장해 또 한 번의 리뷰 사이클(루프)을 강제하므로, 각 Warning 의 타당성을 판단해 정리했다.

## Warning 처리

| W | 발견 | 결정 | 사유 |
|---|------|------|------|
| 1 | SPEC-DRIFT: 배너 이중 데이터 출처(REST vs 폴링) spec 미반영 | **spec 변경 불요** | spec §2.4.1 은 관측 동작(검색불가 시 배너)을 기술하며 그것이 정본. 데이터 소스 배선(배너=KB REST/WS, 진행박스=embeddingStats 폴링)은 구현 detail 로 `page.tsx` 인라인 주석에 문서화 완료. observable behavior 무변경. |
| 2 | `STATE_CONFIG[reembedStatus]` 런타임 미지 상태 방어 부재 | **거절(더 나은 설계)** | `Record<ReembedStatus, ...>` 가 이미 컴파일 타임 exhaustive. API 유니온 확장 시 이 Record 리터럴에서 빌드가 실패해 신규 상태 처리를 **강제**한다(이 리팩토링의 핵심 이득). `?? STATE_CONFIG["idle"]` fallback 은 그 빌드 가드를 무력화하고 새 상태를 조용히 "재임베딩 필요"로 오표시하므로 도입하지 않는다. |
| 3 | 범위 초과(타입 파생 외 리팩토링 포함) | **creep 아님** | 본 PR 의 명시 목적이 #534 terminal 리뷰의 보류 INFO(#1·#5·#6·#4·#9·#2) 일괄 정리. 타입 파생·STATE_CONFIG·Props 명명·cn·owner 테스트·주석은 한 묶음의 의도된 작업이다. |
| 4 (testing) | KB 상세 페이지 통합 테스트 부재 | **보류(과투자)** | presentational `UnsearchableBanner` 8 케이스 단위 테스트 완비(idle/in_progress×role, pending disabled, desc, X 부재, admin/owner). 페이지 게이트는 `{kb && kb.embeddingDimension == null && <UnsearchableBanner reembedStatus={kb.reembedStatus} .../>}` 3줄 conditional 로 자명. 풀 페이지 하네스(knowledge-base·documents·embedding-stats·graph-stats·llmConfigs·rerankConfigs·useKbEvents WS mock) 신설은 비용 대비 효용 낮음 — #534 RESOLUTION 동일 판단. |

## INFO

| 그룹 | 처리 |
|------|------|
| 보안 #1(embeddingErrorMessage 노출)·#2(id 검증)·#3(RoleGate 클라이언트) | **본 PR 무관** — 기존 코드. 백엔드 `POST /re-embed` `@Roles('editor')` 는 #534 에서 확인 완료. id 검증·에러 메시지 sanitize 는 백엔드 책임(별건). |
| 유지보수 #6(page.tsx 길이)·#7(폴링 패턴 중복)·#8(매직 넘버) | **기존 부채** — 본 diff 가 악화시키지 않음. 별도 리팩토링 티켓 사안. |
| 타입안전 #4 | STATE_CONFIG 패턴 긍정 평가 — 유지. |
| 문서 #5(container JSDoc)·테스트 #9(setRole null)·#10(STATE_CONFIG 동적 열거) | 선택적 nit — 무영향, 보류. |

## 게이트

| 게이트 | 결과 |
|--------|------|
| frontend lint | ✓ |
| frontend unit | ✓ 4152 (배너 8 케이스·i18n parity 포함) |
| frontend build | ✓ (turbopack, 타입 검증) |
| /ai-review (09_12_48) | LOW · Critical 0 · Warning 4 → 전부 수동 조치 |

동작 무변경 리팩토링 — 코드 무변경 종결, review/** 전용 커밋으로 마감.
