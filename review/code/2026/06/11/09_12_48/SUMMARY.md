# Code Review 통합 보고서

## 전체 위험도
**LOW** — KB 배너 리팩터링은 기능 동등성을 유지하며 전반적으로 양호하다. Critical 발견사항 없음. Warning 4건(런타임 방어 부재, 범위 초과 리팩터링, 테스트 completeness 갭, 문서 필드 주석 누락)은 즉각적 버그 위험 없이 개선 권장 수준이다. SPEC-DRIFT 1건(배너 이중 데이터 출처 미반영) 확인.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] 배너 데이터 출처 이중성(REST vs 폴링)이 spec에 미반영. 구현은 배너가 `kb.reembedStatus`(KB REST+WS), 진행 박스가 `embeddingStats.reembedStatus`(polling)를 별도 소스로 보는 설계를 채택했으나 spec `2-navigation/5-knowledge-base §2.4.1`에 서술 없음. 코드 버그 아님, spec 갱신 누락. | `page.tsx` 라인 617–619 주석 | 코드 유지 + `spec/2-navigation/5-knowledge-base.md §2.4.1` "검색 불가 배너" 항목에 이중 출처 구조 및 일시적 불일치 가능성 한 줄 추가 |
| 2 | 방어코드 | `STATE_CONFIG[reembedStatus]`에 런타임 미지 상태 방어 없음. 현재 타입 유니온(`"idle" \| "in_progress"`) 범위 내 컴파일 타임 안전하나, API 타입 확장 시 `undefined` 접근으로 런타임 오류 가능. | `unsearchable-banner.tsx` 라인 1429 | `STATE_CONFIG[reembedStatus] ?? STATE_CONFIG["idle"]` fallback 추가 또는 타입 가드 삽입 |
| 3 | 테스트 | KB 상세 페이지(`[id]/page.tsx`)에 대한 통합 테스트 전무. `embeddingDimension == null` 조건 분기(배너 노출/비노출)를 검증하는 테스트 없어 향후 배너 조건 변경 시 회귀 감지 불가. | `codebase/frontend/src/app/(main)/knowledge-bases/[id]/` — `__tests__` 없음 | `[id]/__tests__/kb-detail-page.test.tsx` 추가해 `embeddingDimension` null/non-null 분기 smoke 테스트 작성 |
| 4 | 범위초과 | `unsearchable-banner.tsx`에서 `Props` → `UnsearchableBannerProps` 이름 변경, `STATE_CONFIG` 룩업 테이블 추출, `Icon` 동적 컴포넌트 패턴, `cn()` 추가 import, 파라미터 포맷팅 변경 등이 `reembedStatus` 타입 확장과 직접 관련 없는 리팩터링과 함께 포함됨. 기능 동등성 유지 및 테스트 통과, 즉각적 버그 위험 없음. | `unsearchable-banner.tsx` 전체 diff | 원칙적으로 별도 커밋/PR 분리 권장. 현 상태에서는 동작 정확성 이슈 없으므로 기록만. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `doc.embeddingErrorMessage` 툴팁에 서버 오류 메시지 직접 노출. 백엔드가 내부 스택 트레이스·DB 오류·내부 경로를 포함할 경우 인증된 사용자에게 인프라 정보 노출 가능. | `page.tsx` 라인 965–970 | 백엔드에서 사용자용/진단용 메시지 분리, 또는 프론트엔드 최대 길이(200자) 제한 + 허용 문자 필터링 |
| 2 | 보안 | `id` URL 파라미터 형식 검증 없이 API 호출에 직접 사용. | `page.tsx` 라인 159, 189, 199, 269 | UUID 정규식 사전 검증 추가(최종 책임은 백엔드) |
| 3 | 보안 | `RoleGate` 클라이언트 사이드 CTA 가시성 제한만, 뮤테이션 자체는 제한 없음. 설계 패턴상 정상이나 백엔드 API 역할 인가 확인 권고. | `unsearchable-banner.tsx`, `page.tsx`의 `RoleGate` 래퍼 | 백엔드 엔드포인트(`POST /re-embed`, `DELETE /documents/:id` 등)에 역할 인가 미들웨어 적용 확인 |
| 4 | 타입안전 | `STATE_CONFIG` 테이블 패턴 도입으로 `Record<ReembedStatus, ...>` 컴파일 타임 완전성 보장. API 타입 파생(`KnowledgeBaseData["reembedStatus"]`)으로 타입 동기화 부담 제거. | `unsearchable-banner.tsx` 라인 1381–1410 | 유지. |
| 5 | 문서화 | `STATE_CONFIG` 내부 `container` 필드 목적(적용 대상 요소) 주석 없음. | `unsearchable-banner.tsx` `STATE_CONFIG` 타입 정의 | `container: string` 앞에 단행 JSDoc(`/** role="alert" 래퍼에 병합되는 Tailwind 색상·테두리 클래스 */`) 추가 |
| 6 | 유지보수 | `KnowledgeBaseDetailPage` 함수 ~1050라인, 함수 본체 약 500라인. state 선언 18개, mutation 7개, 쿼리 5개 혼재. SRP 위반. 이번 diff가 직접 악화시키지는 않음. | `page.tsx` `KnowledgeBaseDetailPage` 전체 | `handleSaveSettings` 유효성 검사, embedding/graph 진행 박스, documents 테이블 패널을 별도 훅/컴포넌트로 단계적 추출 권장 |
| 7 | 유지보수 | 중복 폴링 패턴 — `stillProcessing ? 짧은_간격 : 긴_간격` 패턴을 세 쿼리에서 각각 구현. | `page.tsx` 라인 200–210, 244–252, 259–265 | `makePollingInterval(isStillProcessing, fast, slow)` 유틸 헬퍼 추출 |
| 8 | 유지보수 | 매직 넘버 산재(`1024`, `10_000`, `120_000`, `5_000`, `60_000`, `50` 등). | `page.tsx` 라인 149, 209, 250, 264, 394, 427–439 | 도메인 상수(`CHUNK_SIZE_MIN`, `POLLING_INTERVAL_FAST` 등) 추출 |
| 9 | 테스트 | `setRole(null)` 비인증 케이스 미테스트. `RoleGate` null 처리 미검증. `UnsearchableBanner`는 `embeddingDimension == null` 조건 렌더로 현실적 위험 낮음. | `unsearchable-banner.test.tsx` | `setRole(null)` 케이스 추가 선택적 권고 |
| 10 | 테스트 | `STATE_CONFIG` 키 확장 시 테스트 completeness 보장 없음. 컴파일 타임 가드는 구현 측에만 있고 테스트 측은 수동 관리 의존. | `unsearchable-banner.test.tsx` | `it.each(Object.keys(STATE_CONFIG))` 패턴으로 동적 열거 스모크 테스트 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `embeddingErrorMessage` 원문 노출(INFO), `RoleGate` 클라이언트 사이드 제한(INFO) — 전반적으로 양호 |
| requirement | LOW | `STATE_CONFIG` 런타임 미지 상태 방어 부재(WARNING 1건), SPEC-DRIFT 배너 이중 출처 미반영(WARNING 1건) |
| scope | LOW | `STATE_CONFIG` 도입 등 직접 관련 없는 리팩터링 범위 초과(WARNING 1건) |
| side_effect | NONE | 의도치 않은 부작용 없음. 공개 API 변경 없음, 전역 상태 영향 없음 |
| maintainability | LOW | `STATE_CONFIG` 패턴 도입 긍정적. `page.tsx` 함수 길이·중복 폴링·매직 넘버 기존 부채(INFO) |
| testing | LOW | 역할 커버리지 확장 긍정적. KB 상세 페이지 통합 테스트 부재(WARNING 1건) |
| documentation | LOW | 문서화 수준 전반 우수. `container` 필드 주석 누락(WARNING 1건) |

## 발견 없는 에이전트

없음 (전 에이전트 발견사항 존재, side_effect는 NONE 위험도).

## 권장 조치사항

1. **[SPEC-DRIFT] spec 갱신**: `spec/2-navigation/5-knowledge-base.md §2.4.1` 검색 불가 배너 항목에 이중 데이터 출처 구조(KB REST+WS vs embeddingStats 폴링) 및 재임베딩 직후 일시적 불일치 가능성을 명시한다.
2. **런타임 방어 fallback 추가**: `unsearchable-banner.tsx` 라인 1429의 `STATE_CONFIG[reembedStatus]` 접근에 `?? STATE_CONFIG["idle"]` fallback 또는 타입 가드를 추가한다.
3. **KB 상세 페이지 smoke 테스트 추가**: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/__tests__/kb-detail-page.test.tsx`를 신설해 `embeddingDimension` null/non-null 분기별 배너 노출 여부를 검증한다.
4. **`container` 필드 JSDoc 추가**: `STATE_CONFIG` 타입 정의의 `container: string` 앞에 `/** role="alert" 래퍼에 병합되는 Tailwind 색상·테두리 클래스 */` 한 줄 추가.
5. **백엔드 역할 인가 확인**: `POST /re-embed`, `DELETE /documents/:id` 등 대응 엔드포인트에 역할 인가 미들웨어가 적용되어 있는지 백엔드 코드에서 별도 확인 권고(현 PR 범위 외).
6. **(장기) `page.tsx` 점진적 분리**: 함수 길이·중복 폴링 패턴·매직 넘버는 별도 리팩터링 티켓으로 관리.

## 라우터 결정

라우터가 선별 실행했습니다.

- **실행** (7명): `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`
- **강제 포함(router_safety)** (6명): `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (7명):

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 판단: 해당 변경에서 성능 검토 불필요 |
| architecture | 라우터 판단: 해당 변경에서 아키텍처 검토 불필요 |
| dependency | 라우터 판단: 해당 변경에서 의존성 검토 불필요 |
| database | 라우터 판단: 해당 변경에서 DB 검토 불필요 |
| concurrency | 라우터 판단: 해당 변경에서 동시성 검토 불필요 |
| api_contract | 라우터 판단: 해당 변경에서 API 계약 검토 불필요 |
| user_guide_sync | 라우터 판단: 해당 변경에서 사용자 가이드 동기화 검토 불필요 |
---

## 호출자(main Claude) 처리 결과 — 2026-06-11

**RISK LOW · Critical 0 · Warning 4 → Warning 처리 의무.** 4건 전부 **수동 조치(코드 무변경) + 사유 기록**으로 해소 (추가 코드 변경은 review-before-stop 가드 재무장→루프이므로, 각 Warning 의 타당성을 판단해 정리). 상세 RESOLUTION.md.

- **W2 (런타임 fallback 부재)** → **거절(더 나은 설계)**: `Record<ReembedStatus, ...>` 가 이미 컴파일 타임 exhaustive — API 유니온이 늘면 이 Record 리터럴에서 빌드가 실패해 신규 상태 처리를 강제한다. `?? STATE_CONFIG["idle"]` fallback 은 그 빌드 가드를 무력화(새 상태를 조용히 idle 로 오표시)하므로 도입하지 않는다.
- **W1 (이중 출처 SPEC-DRIFT)** → **spec 변경 불요**: spec §2.4.1 은 관측 동작(검색불가 시 배너 노출)을 기술하며 그것이 정본. 배너가 KB REST/WS 의 reembedStatus 를, 진행 박스가 embeddingStats 폴링을 보는 것은 구현 배선 detail 로, page.tsx 인라인 주석에 이미 문서화. observable behavior 변화 없음.
- **W3 (범위 초과)** → **creep 아님**: 본 PR 의 명시 목적이 #534 리뷰 보류 INFO 의 nit 묶음 리팩토링(A2 follow-up). 타입 파생·STATE_CONFIG·Props 명명·cn 은 한 묶음의 의도된 정리다.
- **W4 / testing (페이지 통합 테스트 부재)** → **보류(과투자)**: presentational `UnsearchableBanner` 는 8 케이스 단위 테스트 완비. 페이지 게이트는 `{kb && kb.embeddingDimension == null && <UnsearchableBanner .../>}` 3줄 conditional 로 자명하며, 풀 페이지 하네스(6+ query·WS mock) 신설은 비용 대비 효용이 낮다(#534 RESOLUTION 동일 판단).
- INFO(보안 #1·#2·#3·page.tsx 부채 #6·#7·#8 등): 기존 코드·백엔드 별건 또는 본 PR 무관. 백엔드 re-embed `@Roles('editor')` 는 #534 에서 확인 완료.

결론: 코드 무변경 종결, review/** 전용 커밋으로 마감.
