# Code Review 통합 보고서

- 세션: `review/code/2026/05/16/01_00_34`
- 대상: Cafe24 Private `request-scopes` UI 분기 추가 (scope-tab 모듈 분리 + pending 안내 구현)
- 리뷰어: 13명 전원 성공 (pending 0건, fatal 0건)

---

## 전체 위험도

**MEDIUM** — 핵심 기능 구현은 완전하나, 테스트 커버리지에 WARNING 수준 공백이 다수 존재하며 API 타입 계약 불일치가 유지보수 위험을 유발함.

→ **RESOLUTION** 에서 W-1·W-2·W-3·W-4·W-5·W-8·W-9·W-11·W-12 조치 완료. W-6·W-7·W-10·W-13 은 합리적 보류 (RESOLUTION 참조).

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 | 조치 |
|---|----------|----------|------|------|------|
| W-1 | 테스트 | `onChanged` 콜백 호출 검증 누락 | `scope-tab.test.tsx` | `vi.fn()` 으로 교체, `toHaveBeenCalledTimes` 단언 | ✅ 조치 |
| W-2 | 테스트 | `onError` 분기 테스트 케이스 부재 | `scope-tab.test.tsx` | `mockRejectedValue` 실패 시나리오 추가 | ✅ 조치 |
| W-3 | 테스트 | `onMutate` 의 `cafe24Pending` 리셋 동작 비검증 | `scope-tab.test.tsx` | 두 번 연속 mutate 케이스 | ✅ 조치 |
| W-4 | API 계약 | `OAuthBeginResult` / `RequestScopesResult` cafe24 variant 필드 불일치 | `frontend/src/lib/api/integrations.ts` | 공유 `Cafe24PrivatePendingBase` 추출 | ✅ 조치 |
| W-5 | API 계약 | `requestScopes` 반환 타입 변경 영향 | 전 코드베이스 | 소비처 grep 확인 | ✅ 조치 — 소비처는 `scope-tab.tsx` 1곳뿐 |
| W-6 | 아키텍처 | `openOAuthPopup` 위치가 라우트 세그먼트 안 | `[id]/open-oauth-popup.ts` | `lib/` 로 이동 | ⏸ 보류 — 두 번째 사용처 미발생, YAGNI |
| W-7 | 아키텍처 | `cafe24_private_pending` 문자열 하드코딩 (OCP 경고) | `scope-tab.tsx` | 호출측으로 분기 위임 | ⏸ 보류 — 현 시점 mode 는 단일, 미래 가정 기반 |
| W-8 | 요구사항 | `allOptions` 빈 배열 빈 상태 부재 | `scope-tab.tsx` | 빈 상태 메시지 | ✅ 조치 — `noScopeOptionsAvailable` 추가 |
| W-9 | 요구사항 | 알 수 없는 mode silent 처리 | `scope-tab.tsx` | else 분기 toast | ✅ 조치 |
| W-10 | 유지보수성 | `ScopeTab` 다중 책임 (193줄) | `scope-tab.tsx` | 4개 컴포넌트로 분리 | ⏸ 보류 — 현 가독성 양호, 분리는 과도 |
| W-11 | 유지보수성 | 루프 내 `includes` 중복 호출 | `scope-tab.tsx` | `isGranted` 변수 추출 | ✅ 조치 |
| W-12 | 문서화 | plan 체크리스트 미갱신 | `plan/in-progress/cafe24-request-scopes-ui.md` | `[x]` 갱신 + follow-up | ✅ 조치 |
| W-13 | 범위 | consistency-check 산출물이 구현 커밋에 함께 포함 | `review/consistency/.../` | 분리 커밋 | ⏸ 보류 — 이미 커밋, 향후 절차 개선으로 반영 |

---

## 참고 (INFO)

총 24건 — RESOLUTION 본문 참조. 보안 (URL scheme 화이트리스트, 팝업 차단 안내), 성능 (`Set` 변환), JSDoc, 상수 명명, 테스트 픽스처 정리 등 자질구레한 권고. 주요 권고는 RESOLUTION 에 반영.

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | URL scheme 미검증, 팝업 차단 UX (전부 INFO) |
| performance | LOW | `includes` O(n×m) (전부 INFO) |
| architecture | LOW | `openOAuthPopup` 위치, mode 하드코딩 (WARNING 2건 — 보류) |
| requirement | LOW | silent 실패, 빈 상태 (WARNING 4건 — 조치 완료) |
| scope | LOW | consistency 산출물 커밋 동봉 (WARNING 1건 — 보류) |
| side_effect | LOW | 반환 타입 변경 영향 (WARNING 1건 — 조치 완료) |
| maintainability | LOW | 중복 호출, 타입 중복 (WARNING 2건 — 조치 완료) |
| testing | MEDIUM | 핵심 콜백 검증 부재 (WARNING 3건 — 조치 완료) |
| documentation | LOW | plan 미갱신 (WARNING 1건 — 조치 완료) |
| dependency | NONE | 신규 외부 의존성 없음 |
| database | NONE | DB 접점 없음 |
| concurrency | NONE | 동시성 결함 없음 |
| api_contract | LOW | 타입 필드 불일치 (WARNING 2건 — 조치 완료) |
