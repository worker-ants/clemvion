# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 구현은 spec §2.4.1·R-3 요건을 완전히 충족하며 Critical 발견이 없다. 테스트 커버리지 갭(page 레벨 통합 테스트 부재, `pending=true` 브랜치 미검증) 및 백엔드 role guard 확인 권고가 LOW 위험도를 구성한다.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `pending=true` 브랜치(CTA disabled + Loader2) 단위 테스트 누락 | `unsearchable-banner.test.tsx` | `pending=true` disabled 케이스 추가 |
| 2 | Testing | `[id]/page.tsx` 배너 게이트·CTA 배선 페이지 레벨 통합 테스트 부재 | `app/(main)/knowledge-bases/[id]/` | 통합 테스트 신설 |
| 3 | Testing | 배너 desc 단락 렌더 검증 없음 | `unsearchable-banner.test.tsx` | desc 텍스트 검증 추가 |
| 4 | Testing | `owner`/`admin` 역할 CTA 노출 명시 테스트 없음 | `unsearchable-banner.test.tsx` | admin/owner 케이스 추가 |
| 5 | Security | 백엔드 `POST /re-embed` role guard 적용 여부 미확인 (PR 범위 외) | 백엔드 `reEmbedAll` | guard 적용 확인 |
| 6 | Security | `embeddingErrorMessage` 툴팁 직접 렌더 — 민감정보 노출 가능성 (기존 코드, 범위 외) | `[id]/page.tsx` L974–980 | sanitize 확인 |
| 7 | Maintainability | `== null` vs `!= null` 비교 연산자 혼용 | `[id]/page.tsx` | 통일 고려 (기능 영향 없음) |
| 8 | Documentation | 배너 렌더 블록에 spec 배치 의도 주석 없음 | `[id]/page.tsx` | spec §2.4.1 주석 1줄 |
| 9 | Side Effect | `kb.reembedStatus` vs `embeddingStats.reembedStatus` 이중 출처 | `[id]/page.tsx` | 현재 구조 유지 가능 |
| 10 | Requirement | `pending=true` CTA 비활성화 동작 미테스트 | `unsearchable-banner.tsx` | pending disabled 테스트 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 프론트 RoleGate 적절; 백엔드 re-embed role guard 확인 권고; 기존 embeddingErrorMessage 노출 주의 |
| requirement | NONE | spec §2.4.1·R-3 모든 요건 line-level 일치 |
| scope | NONE | 6개 변경 파일 모두 plan 범위 내 수렴 |
| side_effect | NONE | 순수 presentational, 신규 상태 없음, 기존 mutation 재사용 |
| maintainability | NONE | 단일 책임 분리, JSDoc 완비, i18n parity 유지 |
| testing | LOW | 핵심 4종 커버; pending·페이지 통합·desc 갭 |
| documentation | NONE | 컴포넌트 JSDoc 우수; page.tsx 위치 주석 선택적 |

## 라우터 결정

라우터 선별 실행 (`routing_status=done`). 실행 7명(security·requirement·scope·side_effect·maintainability·testing·documentation, 전원 router_safety 강제). 제외 7명(performance·architecture·dependency·database·concurrency·api_contract·user_guide_sync — frontend-only presentational 배너라 비해당).

---

## 호출자(main Claude) 처리 결과 — 2026-06-11

**RISK LOW · Critical 0 · Warning 0 → resolution-applier auto-fix 의무 트리거 없음.** INFO 중 저비용·고가치 항목을 선별 반영(상세 RESOLUTION.md):

- **#5 (Security, 검증)**: 백엔드 `POST /knowledge-bases/:id/re-embed` 의 role guard 실재 여부를 코드로 확인 → 결과 RESOLUTION.md 기록.
- **#1·#10·#3·#4 (Testing)**: `unsearchable-banner.test.tsx` 에 pending disabled·desc 렌더·admin 역할 케이스 보강.
- **#8 (Docs)**: `[id]/page.tsx` 배너 블록에 spec §2.4.1 의도 주석 1줄.
- **#2 (page 통합 테스트)**: 상세 페이지 전용 테스트 하네스(6+ API·WS mock) 신설은 presentational 배너 대비 과투자 → 보류(컴포넌트 단위 + 기존 ConfirmModal/mutation 검증으로 커버). RESOLUTION.md 에 보류 사유 기록.
- **#6·#7·#9 (pre-existing/stylistic)**: 본 PR 범위 밖 또는 의미상 정상(반대 조건) → no-op, RESOLUTION.md 기록.
