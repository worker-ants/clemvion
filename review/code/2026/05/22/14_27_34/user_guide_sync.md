# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

매트릭스 trigger 7개 중 이번 변경 set 에 매칭된 trigger 는 1개이고, 해당 trigger 의 동반 갱신 요건은 충족됐습니다. 나머지 trigger 는 매칭되지 않습니다.

---

### [INFO] trigger 관리 화면 UX 행동 변경 — 유저 가이드 페이지 부재

- 변경 파일: `codebase/frontend/src/app/(main)/triggers/page.tsx`, `codebase/frontend/src/components/triggers/trigger-history-dialog.tsx`
- 매트릭스 항목: 매트릭스에 "Triggers 관리 화면 ⋮ 메뉴 UX 변경 → 유저 가이드 업데이트" 에 해당하는 trigger 행이 없음 (회색 지대)
- 누락된 동반 갱신: 현재 docs 트리에 Triggers 관리 화면 전용 유저 가이드 페이지(`codebase/frontend/src/content/docs/` 하위)가 존재하지 않아 갱신 대상 파일 자체가 없음
- 상세: 이번 변경으로 트리거 목록 화면의 ⋮ 메뉴 "호출 이력" 항목 클릭 동작이 detail drawer 오픈에서 별도 Dialog(Recent Calls 전용) 오픈으로 바뀌었음. 사용자가 두 메뉴 항목의 차이를 인지하는 데 도움이 되는 가이드 페이지가 없으면 UX 변경이 문서에 반영되지 않은 채로 남음. 다만 `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 307행에 "트리거 화면의 호출 이력" 언급이 있어 stale 위험이 있으나, 해당 문서는 Trigger 노드 설명 페이지이고 관리 화면 ⋮ 메뉴 동작을 직접 설명하지는 않으므로 매트릭스 trigger 에 명확히 해당하지는 않음.
- 제안: 현 시점에서는 가이드 페이지가 없어 강제 갱신 대상이 없음. 향후 Triggers 관리 화면 전용 유저 가이드 페이지(`codebase/frontend/src/content/docs/` 하위)가 신설될 경우, "⋮ 메뉴 — 상세 보기 vs 호출 이력 Dialog 차이" 를 해당 페이지에 기술하도록 plan 노트 작성 권장.

---

### 매칭된 trigger 충족 확인 — 신규 UI 문자열 (PASS)

- 매트릭스 항목: "신규 UI 문자열 (TSX)" — `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` 양쪽 등록 필수
- trigger-history-dialog.tsx 에서 사용된 i18n 키: `triggers.history.title`, `triggers.history.empty`, `triggers.history.loadFailed`, `triggers.history.viewFullDetail`, `triggers.history.close` — 5개
- `dict/ko/triggers.ts`: `history.{title, empty, loadFailed, viewFullDetail, close}` 5개 모두 추가 확인
- `dict/en/triggers.ts`: `history.{title, empty, loadFailed, viewFullDetail, close}` 5개 모두 추가 확인
- KO/EN parity: 완전 일치 (CRITICAL 없음)

---

### 기타 trigger 비매칭 사유

| 매트릭스 trigger | 비매칭 사유 |
|---|---|
| 새 노드 추가 | backend `codebase/backend/src/nodes/` 에 변경 없음 |
| 노드 schema 변경 | 노드 필드 변경 없음 |
| 통합 신규/제공자 변경 | provider 코드 변경 없음 |
| 유저 가이드 신규 섹션 디렉토리 | `codebase/frontend/src/content/docs/<NN>-<name>/` 신규 디렉토리 없음 |
| 신규 warningCode/errorCode 발행 | backend warning/error code 변경 없음 |
| 인증·권한·세션 흐름 변경 | `codebase/backend/src/auth/**` 및 권한 미들웨어 변경 없음 |
| 표현식 언어 변경 | `codebase/packages/expression-engine/**` 변경 없음 |
| 실행·디버깅 흐름 변경 | backend 실행 엔진·디버그 로깅 변경 없음 |

---

## 요약

PROJECT.md §변경 유형 → 갱신 위치 매핑 표의 trigger 8개 중 매칭된 trigger 는 "신규 UI 문자열 (TSX)" 1개이며, KO/EN dict parity (`triggers.history.*` 5키 양쪽 동시 등록) 가 완전히 충족됐습니다. 나머지 7개 trigger 는 이번 변경 set 과 무관합니다. 추가로 Triggers 관리 화면 전용 유저 가이드 페이지 부재라는 회색 지대 INFO 1건을 기록하며, 현재 필수 동반 갱신 누락은 없습니다.

## 위험도

NONE
