# 변경 범위(Scope) 리뷰 — triggers-auth-column

리뷰 대상: 14개 파일 (프론트엔드 구현 3 + plan/spec 문서 5 + consistency 검토 산출물 6)
작업 의도: `/triggers` 목록 테이블에 "인증" 컬럼 추가 + 무인증 webhook 경고 아이콘 (R-15)

---

## 발견사항

### [INFO] triggers-page.test.tsx — `mockTriggersResponse` 시그니처 변경은 기존 테스트에 영향 없음
- 위치: 파일 1, diff 라인 37
- 상세: `authConfigs: unknown[] = []` 기본값 파라미터 추가. 기존 테스트(pagination, RBAC 섹션)는 두 번째 인수를 넘기지 않으므로 동작 변경 없음. 범위 내 수정으로 판단.
- 제안: 없음.

### [INFO] page.tsx — `authConfigById` 맵 빌드 위치가 컴포넌트 최상위 렌더 레벨
- 위치: 파일 2, diff 라인 522-524
- 상세: `new Map(authConfigs.map(...))` 가 매 렌더마다 재생성된다. 기능적으로는 범위 내이며, 추가 최적화(`useMemo`)는 요청된 변경 외 over-engineering이 된다. 성능 영향은 미미(authConfig 목록은 워크스페이스 당 수십 건)하므로 현재 범위 유지가 적절하다.
- 제안: 범위 내. 별도 최적화 불필요.

### [INFO] lucide-react 임포트 블록 포맷 변경 (단일 라인 → 멀티 라인)
- 위치: 파일 2, diff 라인 472-481
- 상세: `AlertTriangle` 신규 임포트 추가를 위해 기존 인라인 임포트를 멀티 라인으로 재포맷했다. 추가된 `AlertTriangle`은 신규 기능에 실제 사용되므로 불필요한 포맷 변경이 아니다. 라인 수 변화가 있지만 의미 변경은 신규 임포트 1개뿐으로 범위 내.
- 제안: 없음.

### [INFO] `auth-config-select` 임포트 블록 포맷 변경 (단일 라인 → 멀티 라인)
- 위치: 파일 2, diff 라인 484-489
- 상세: `useAuthConfigs` 와 `AUTH_CONFIG_TYPE_LABEL_KEYS` 를 추가로 임포트하기 위한 블록 분리. 두 심볼 모두 신규 인증 열 렌더링에 실제 사용된다. 범위 내.
- 제안: 없음.

### [INFO] en/ko triggers.ts — 기존 키(`authenticationLabel`)는 이미 존재, 신규 키 2개만 추가
- 위치: 파일 3, 4
- 상세: `authConfigured` 와 `authUnauthenticatedWarning` 두 키가 추가됐다. 기존 `authenticationLabel`("Authentication"/"인증")은 컬럼 헤더 i18n 으로 page.tsx 가 재사용하며 변경되지 않았다. i18n 키 추가는 신규 UI 요소와 1:1 대응하므로 범위 내.
- 제안: 없음.

### [INFO] spec/2-navigation/2-trigger-list.md — 기존 spec 의 `§2.1` 표와 `Rationale` 섹션에만 추가
- 위치: 파일 14
- 상대: §2.1 표에 "인증" 행 삽입, Rationale R-15 추가. 나머지 섹션(§2.2~§2.4, §3, §4, R-1~R-14)은 모두 untouched. 범위 정확.
- 제안: 없음.

### [INFO] plan/in-progress 두 파일 및 consistency 산출물 6개 — 워크플로우 산출물로 범위 내
- 위치: 파일 5-13
- 상세: `spec-draft-triggers-auth-column.md` 와 `triggers-auth-column.md` 는 본 작업 추적 plan 이다. consistency 산출물(파일 7-13)은 `--spec` 게이트 검토 결과물로 CLAUDE.md 규약에 따라 `review/consistency/**` 위치에 저장된다. 모두 작업 절차상 필수 파일이며 범위 외 수정이 아니다.
- 제안: 없음.

---

## 요약

변경 범위 관점에서 이 PR 은 의도된 작업(트리거 목록 인증 컬럼 + 무인증 webhook 경고)에 정확히 집중하고 있다. 구현 파일 3개(test, page, i18n 2개)는 각각 신규 기능을 위한 최소 변경만 포함하며, 관련 없는 코드 정리·리팩토링·기능 확장이 없다. spec 변경(§2.1 행 삽입 + R-15)과 plan/consistency 산출물은 이 프로젝트의 SDD 워크플로우가 요구하는 파일들이다. lucide-react 및 auth-config-select 임포트 블록 포맷 변경은 신규 심볼 추가에 따른 필연적 재포맷으로, 실질 변경 이외의 포맷-only 수정이 아니다. 범위 이탈 항목 없음.

---

## 위험도

NONE
