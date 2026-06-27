# Code Review 통합 보고서

리뷰 대상: Channel Web Chat 위젯 리팩터(B2/B3/B5/B6) + 테스트 보강(C)
리뷰 일시: 2026-06-27
리뷰 기준: `--branch main` (commit df77e61e6)

---

## 전체 위험도
**LOW** — behavior-preserving 리팩터 전반이 안전하게 수행됨. Critical/Warning 발견 없음. 모든 발견사항은 INFO 수준이며, 그중 일부는 기존 설계에서 유래한 pre-existing 사항이거나 향후 개선 제안이다.

> **main 후속 검증 노트**: INFO #2·#3(submitMessage·flush effect 가 구 denylist 유지)은 **stale 오탐** — reviewer 가 pre-edit line 번호(L305–309·L330)를 참조했으나, 커밋된 코드는 isTextInputSurface 를 3곳(panel.tsx:112·use-widget submitMessage:325·flush effect:346) 전부 적용했고 denylist 직접 비교는 0건이다(grep 확인). 따라서 #2·#3 무조치.

---

## Critical 발견사항
_없음_

## 경고 (WARNING)
_없음_

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 처리 |
|---|----------|----------|------|
| 1 | SPEC-DRIFT | `isTextInputSurface` `pending=null` 텍스트표면 취급 근거 `1-widget-app §2` 미기재 | **pre-existing 동작**(본 리팩터가 도입 아님), INFO 비차단 → planner spec polish followup 으로 이관 |
| 2 | 요구사항 | submitMessage 구 denylist 유지 주장 | **stale 오탐** — 이미 헬퍼 적용(상단 노트) |
| 3 | 요구사항 | flush effect 구 denylist 유지 주장 | **stale 오탐** — 이미 헬퍼 적용 |
| 4 | 문서화 | backlog §B·§C 체크박스 미갱신 | 본 후속에서 갱신 |
| 5 | 보안 | 에러 메시지 UI 원문 노출 | pre-existing, backlog §A(W1) 등록됨 |
| 6 | 보안 | configFromQuery apiBase 무검증 | pre-existing, 범위 밖 — backlog 메모 |
| 7 | 보안 | per_execution 토큰 localStorage 잔류 | pre-existing, backlog §A 등록됨 |
| 8 | 보안 | isTextInputSurface denylist — unknown type 시 텍스트 활성 | 저위험 — parseWaitingForInput 이 unknown 을 ai_conversation 으로 정규화(상류 차단). JSDoc 에 명시 |
| 9 | 유지보수성 | TERMINAL_EVENTS 이중 캐스트 이유 불명확 | 주석 보강 |
| 10 | 유지보수성 | teardownSession "W9" 레퍼런스 | 본 파일 기존 컨벤션(W9/W10 review-finding 라벨) — 현행 유지 |
| 11 | 유지보수성 | C1 flush 테스트와 installControllableSse 중복 | 비차단 — 기존 테스트 보존(불필요한 diff 회피) |
| 12 | 테스팅 | isTextInputSurface 직접 단위 테스트 부재 | 본 후속에서 추가 |
| 13 | 테스팅 | fake timer `>= 1` 느슨함 | 주석으로 재예약 고려 의도 명시 |
| 14 | 테스팅 | phase=blocked Panel 테스트 부재 | 비차단 INFO — backlog 메모 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 에러 메시지 UI 노출·localStorage 토큰·configFromQuery apiBase (모두 pre-existing, backlog 등록) |
| requirement | LOW | isTextInputSurface 미적용 주장 2곳 — stale 오탐(실제 적용 완료) |
| scope | NONE | 모든 변경이 plan §B·§C 선언 범위 내 |
| side_effect | NONE | behavior-preserving 확인 |
| maintainability | NONE | 헬퍼 추출로 중복 제거. 장기 제안 INFO 만 |
| testing | NONE | 신규 5 테스트 명확. 갭: isTextInputSurface 직접 단위 테스트 |
| documentation | NONE | JSDoc 충실. 백로그 체크박스 갱신 권고만 |

router 실행: security·requirement·scope·side_effect·maintainability·testing·documentation (7). 제외: performance·architecture·dependency·database·concurrency·api_contract·user_guide_sync.

---

## 권장 조치사항(본 후속 반영)
1. isTextInputSurface 직접 단위 테스트 추가(#12).
2. backlog §B·§C 체크박스 갱신(#4) + #6/#14 backlog 메모.
3. TERMINAL_EVENTS 캐스트 주석(#9) + fake-timer 의도 주석(#13).
4. SPEC-DRIFT #1 은 planner spec polish followup 이관(pre-existing·INFO).
