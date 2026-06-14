# Plan 정합성 검토 결과

검토 모드: `--impl-done`
Target: `spec/2-navigation/6-config.md`
Diff base: `origin/main`

---

## 발견사항

### 발견사항 1

- **[WARNING]** `spec-sync-config-gaps.md` 편집 폼 항목이 미체크 상태로 잔존
  - target 위치: `spec/2-navigation/6-config.md` (target 이 아니라 plan 측 문제)
  - 관련 plan: `plan/in-progress/spec-sync-config-gaps.md` §미구현 — 결정 필요 / 후속 (본 PR 범위 밖), 마지막 항목 `[ ] §A.2 편집 폼 IP Whitelist / api_key Header 이름 입력`
  - 상세: plan 에 "편집 흐름 신설은 별도 범위" 로 기록된 `[ ]` 항목이 본 diff 에서 구현됐다. plan 체크박스가 여전히 미체크(unchecked)로 남아 있어 실제 구현 상태와 불일치한다. (해당 항목에는 "결정 필요" 마커가 없었으므로 의사결정 우회 문제는 없음 — 단순 추적 불일치.)
  - 제안: `plan/in-progress/spec-sync-config-gaps.md` 의 해당 항목을 `[x]` 로 체크하고 완료 날짜와 구현 브랜치를 메모 추가.

### 발견사항 2

- **[WARNING]** spec §A.2 본문 "현 UI 는 생성·토글·재생성·삭제만 제공" 서술이 구현 이후 stale
  - target 위치: `spec/2-navigation/6-config.md` §A.2 구현 현황 주석 — "(생성 후 편집 폼은 별도 — 현 UI 는 생성·토글·재생성·삭제만 제공.)"
  - 관련 plan: `plan/in-progress/spec-sync-config-gaps.md` (spec 정합 추적 plan)
  - 상세: 구현 diff 는 편집 버튼(Pencil 아이콘), `handleEditClick`, `updateMutation`, `dialogMode='edit'` 분기를 추가했다. spec 의 해당 구현 현황 주석은 "편집 폼 없음" 상태를 기술하고 있어 코드 현실과 어긋난다. spec 문서의 단일 진실 역할이 훼손된다.
  - 제안: spec `§A.2` 구현 현황 주석에 편집 폼 구현 완료 사실을 반영한다. 구체적으로 "(생성 후 편집 폼은 별도 — 현 UI 는 생성·토글·재생성·삭제만 제공.)" 문장을 편집 폼 지원 내용으로 갱신. project-planner 영역(spec 편집 권한).

### 발견사항 3

- **[INFO]** `spec-sync-config-gaps.md` §A.3 미결 결정 항목과 무관함을 확인
  - target 위치: 해당 없음 (충돌 없음 확인)
  - 관련 plan: `plan/in-progress/spec-sync-config-gaps.md` §미구현 — 결정 필요 / 후속 항목 3건 (소스 IP 컬럼, 응답 코드 컬럼, 기간별 호출 수)
  - 상세: plan 에 "결정 필요" 로 남겨진 §A.3 항목들(소스 IP 저장 스키마, 응답 코드 의미, 기간별 호출 수 표시형식)은 본 diff 가 전혀 건드리지 않았다. 일방적 결정이나 우회 없음.
  - 제안: 추적 메모 불요.

### 발견사항 4

- **[INFO]** `auth-config-webhook-followups.md` §1(CRUD audit) 과의 정합
  - target 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `update()` 메서드
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md` §1 (§1 완료 2026-06-11)
  - 상세: §1 이 이미 `update()` 에 `userId`/`ipAddress` + `recordAudit(AUTH_CONFIG_UPDATE)` 를 추가했고, 본 diff 의 `update()` 수정(shallow-merge 로직 추가)은 그 audit 호출을 보존하고 있다. 충돌 없음.
  - 제안: 추적 메모 불요.

---

## 요약

본 구현(AuthConfig 편집 폼 신설)은 `plan/in-progress/spec-sync-config-gaps.md` 가 "결정 필요" 로 보류한 §A.3 항목들(소스 IP, 응답 코드, 기간별 호출 수)을 건드리지 않아 미해결 결정 우회는 없다. 다만 plan 의 편집 폼 체크박스가 미체크 상태로 남아 있고, spec §A.2 구현 현황 주석이 "편집 폼 없음" 이라는 stale 서술을 담고 있어 각각 plan 갱신(체크박스)·spec 갱신(구현 현황 주석 수정)이 필요하다. 두 항목 모두 plan 추적 정합 수준의 이슈이며 설계 결정 충돌은 아니다.

---

## 위험도

LOW
