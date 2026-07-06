# Cross-Spec 일관성 검토

- 대상: `spec/2-navigation/3-schedule.md` §2.1 (commit `54f8aaac9`, "inbound `?triggerId=` 딥링크" 노트 추가)
- 비교 대상: `spec/2-navigation/2-trigger-list.md` §2.1 / §2.3, `spec/5-system/2-api-convention.md` §4.1 / §5.2
- diff 요약: `> **inbound `?triggerId=` 딥링크**: ...` 한 문단 삽입 (61행 다음, 63행). 신규 요구사항 ID 없음, 코드 변경 없음(commit 은 spec 문서만 수정).

## 발견사항

이번 diff 범위에서 CRITICAL / WARNING 급 충돌은 발견되지 않았다. 확인한 관점과 근거는 다음과 같다.

### [INFO] 양방향 딥링크 서술의 비대칭은 구현 방식 차이에 기인 — 문서만으로는 의도 판단 근거가 spec 안에 약함

- target 위치: `spec/2-navigation/3-schedule.md` §2.1 신규 노트 (63행)
- 대응 대상: `spec/2-navigation/2-trigger-list.md` §2.3 (72행) "inbound `?triggerId=` 딥링크로 진입해도... 상세 패널이 착지 시 자동으로 열린다"
- 상세: trigger→schedule 방향(신규 노트)은 "행 강조 + 1회 스크롤, 현재 페이지에 있을 때만, 편집 다이얼로그 자동 오픈 안 함"이고, schedule→trigger 방향(기존 §2.3)은 "상세 drawer 자동 오픈, 페이지네이션 제약 언급 없음"이다. 코드 확인 결과(`codebase/frontend/src/app/(main)/triggers/page.tsx:161-167`) trigger 쪽은 `useState` 초기값으로 `triggerId` 를 받아 개별 리소스(`GET /api/triggers/:id`) 기반 drawer 를 여는 구조라 목록 페이지네이션과 무관하게 동작 가능 — 반면 schedule 쪽은 "목록 행 강조"라는 UI 특성상 해당 행이 현재 페이지에 로드돼 있어야만 하므로 제약이 발생한다. 즉 비대칭은 실제로 의도적/구조적이며 모순이 아니다.
- 제안: 현재는 코드 주석(`schedules/page.tsx:494-497`)에만 이 근거가 남아 있고 spec 본문에는 "왜 두 방향이 다른가"에 대한 명시적 설명이 없다. 필수는 아니지만, 다음 스케줄/트리거 spec 동기화 기회에 `3-schedule.md` 또는 `2-trigger-list.md` 의 Rationale 절에 "drawer(개별 조회) vs 목록 행 강조(페이지 종속)" 비대칭 근거를 1줄 추가하면 향후 재검토 시 코드까지 확인하지 않아도 되어 리뷰 비용이 준다.

### [INFO] 페이지네이션 한계 서술은 API 규약과 정합

- target 위치: 신규 노트 "목록은 페이지네이션되고 서버 목록에 triggerId 필터가 없으므로..."
- 비교 대상: `spec/5-system/2-api-convention.md` §4.1(목록 조회 쿼리 파라미터: page/limit/sort/order/search) §5.2(목록 응답 `{data, pagination}`), `spec/2-navigation/3-schedule.md` §4 API 표(`GET /api/schedules` 쿼리: page, limit, search, sort, order)
- 상세: `GET /api/schedules` 의 쿼리 파라미터 목록에 실제로 `triggerId` 필터가 없음을 확인했다(§4 표, API 규약 §4.1/§4.2 어디에도 schedules 리소스의 triggerId 필터 정의 없음). 신규 노트가 "서버 목록에 triggerId 필터가 없다"고 서술한 것은 기존 API 계약과 정확히 일치하며 모순이 없다. 참고로 `trigger-list` 는 `GET /api/triggers?interactionEnabled=...` 같은 JSONB 필터를 이미 갖고 있어(§3 API), "필터 신설이 필요한 후속"이라는 노트의 표현도 기존 패턴(리소스별 확장 쿼리 파라미터 추가)과 어긋나지 않는 자연스러운 확장 여지다.
- 제안: 없음 (정보성 확인).

### [INFO] status:implemented 상태에서의 문서 정정은 계약 파괴 없음

- target 위치: `spec/2-navigation/3-schedule.md` frontmatter `status: implemented`
- 상세: 이번 변경은 신규 API·신규 필드·신규 상태 전이를 도입하지 않고, 이미 구현된 프런트엔드 동작(`schedules/page.tsx:494-499`, `focusTriggerId` 기반 강조 로직)을 문서에 사후 반영하는 성격이다. 코드 주석이 "Spec §2.1" 을 이미 인용하고 있어 코드와 신규 spec 문단이 상호 참조 일치한다. 요구사항 ID 신규 부여 없음 — 다른 영역과의 ID 충돌 가능성 없음.
- 제안: 없음.

## 요약

target 노트는 신규 API·데이터 모델·요구사항 ID·권한 규칙을 도입하지 않고, 이미 구현된 프런트엔드 동작을 `2-trigger-list.md` §2.1의 "스케줄 관리에서 편집" 항목과 상호 링크되는 형태로 문서화한 것이다. `GET /api/schedules` 의 실제 쿼리 파라미터(§4, API 규약 §4.1/§5.2)와 서술이 일치하고, trigger→schedule / schedule→trigger 양방향의 UX 비대칭(행 강조-페이지 종속 vs drawer 자동오픈-페이지 무관)은 각각 목록 인라인 강조와 개별 리소스 조회 기반 drawer 라는 서로 다른 구현 메커니즘에서 기인하는 의도적 차이로 확인되어 모순이 아니다. CRITICAL/WARNING 없음.

## 위험도

NONE

BLOCK 아님 — 그대로 채택 가능.
