# 유지보수성(Maintainability) 리뷰

리뷰 대상: triggers auth column 추가 변경 (파일 1–4)
리뷰 일시: 2026-05-29

---

## 발견사항

### [WARNING] IIFE 패턴 사용 — 셀 렌더링 로직을 인라인 함수로 추출 권장
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` 추가된 `<td>` 블록 (라인 659–696)
- 상세: `{(() => { ... })()}` 형태의 즉시실행함수(IIFE)가 JSX 안에서 40줄 이상 사용됨. 동일 파일 내 다른 셀(type 뱃지, endpoint 셀)은 인라인 조건식으로 처리하거나 외부 컴포넌트로 분리된 패턴을 따르는데, 인증 셀만 IIFE 패턴을 선택해 스타일 일관성이 깨진다. IIFE 내부에 if-return 분기가 3개 존재해 읽는 사람이 스캔할 때 실행 흐름을 다시 한번 추론해야 한다.
- 제안: 별도 컴포넌트 또는 순수 함수(`renderAuthCell(trigger, authConfigById, t)`)로 추출해 `<td>` 안에서 단순 호출 형태로 사용한다. 이미 동일 파일에서 `TYPE_BADGE_STYLES` 맵이나 `getWebhookUrl` 헬퍼를 외부로 분리한 패턴이 존재하므로 그 관례를 따른다.

### [WARNING] `authConfigById` Map 이 렌더링마다 재생성됨
- 위치: `page.tsx` 라인 207 — `const authConfigById = new Map(authConfigs.map((c) => [c.id, c]));`
- 상세: 해당 선언이 컴포넌트 함수 본문 최상위에 있어 모든 렌더링 사이클마다 새 `Map` 인스턴스와 전체 `authConfigs` 배열 순회가 발생한다. `authConfigs` 데이터는 react-query 캐시에서 제공되므로 레퍼런스가 바뀌지 않는 한 재계산이 불필요하다.
- 제안: `useMemo(() => new Map(authConfigs.map((c) => [c.id, c])), [authConfigs])` 로 메모이제이션한다. 유사한 메모이제이션 패턴이 동일 파일 내 다른 데이터 파생 로직에도 적용되어 있다면 일관성 차원에서도 필요하다.

### [WARNING] 테스트 코드의 fixture row 객체 중복 — `beforeEach` 또는 팩토리 함수로 통합 권장
- 위치: `triggers-page.test.tsx` `describe("TriggersPage — auth column")` 블록 (추가된 4개 테스트 케이스)
- 상세: 4개의 `it` 블록 각각에서 `{ id: "t1", name: "Hook A", type: "webhook", isActive: true, workflowId: "w1", workflow: { id: "w1", name: "WF" }, authConfigId: ... }` 형태의 동일한 기본 행 구조가 반복된다. `authConfigId` 값과 `type` 필드(schedule 케이스)만 차이가 있다. 이미 동일 파일의 `describe("TriggersPage — RBAC")` 블록에서 내부 `row()` 헬퍼 함수를 정의해 재사용하는 패턴을 따르고 있다.
- 제안: `describe("TriggersPage — auth column")` 블록 안에 `function webhookRow(authConfigId: string | null)` 및 필요 시 `function scheduleRow()` 팩토리를 추가해 공통 필드를 한 곳에서 관리한다.

### [INFO] 매직 문자열 — 하드코딩된 `"ac-1"`, `"Prod HMAC"`, `"hmac"` 테스트 픽스처 값
- 위치: `triggers-page.test.tsx` 라인 105–107
- 상세: `authConfigs` 픽스처에 사용된 `{ id: "ac-1", name: "Prod HMAC", type: "hmac" }` 값이 테스트 assertion 과 매칭 관계로 쓰이는데, 이 값들이 인라인 리터럴로만 존재해 `ac-1` 이 실제로 어떤 authConfig ID를 대표하는지 테스트를 처음 읽는 사람에게 즉시 전달되지 않는다. 현재 테스트 규모에서는 허용 가능하지만, 픽스처가 늘어날 경우 혼동 위험이 있다.
- 제안: `const HMAC_AUTH_CONFIG = { id: "ac-1", name: "Prod HMAC", type: "hmac" } as const` 형태로 describe 스코프 상수로 선언해 의도를 명확히 한다.

### [INFO] `authConfigured` i18n 키 — "Configured" 는 타입 정보가 없는 폴백 텍스트
- 위치: `en/triggers.ts` 라인 603, `ko/triggers.ts` 라인 918; `page.tsx` 라인 677
- 상세: `authConfigId` 가 존재하지만 `authConfigs` 목록에 해당 ID가 없을 때 "Configured"/"설정됨" 이라는 폴백 텍스트를 보여준다. 이 상태는 AuthConfig가 다른 워크스페이스에서 삭제됐거나 권한이 없는 경우인데, "Configured"라는 문구는 "정상 설정됨"과 "orphan ID"를 구분하지 못한다. 사용자 입장에서 잘못된 안도감을 줄 수 있다.
- 제안: 현재 리뷰 범위에서 즉시 수정을 요구하는 수준은 아니나, "Unknown auth" 또는 "Auth config unavailable" 과 같이 상태를 명확히 전달하는 텍스트를 사용하는 것을 권장한다. 별도 후속 개선 아이템으로 등록 적합.

### [INFO] JSX 인라인 스타일 문자열 반복 — 뱃지 클래스명이 다른 뱃지 패턴과 분리됨
- 위치: `page.tsx` 라인 671 — `"inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"`
- 상세: 이 클래스 조합은 Chat Channel chip(라인 632)의 `bg-cyan-*` 패턴과 구조가 동일하다. 색상 토큰만 다르다. 현재 파일에서 `TYPE_BADGE_STYLES` 맵으로 뱃지 스타일을 관리하는 패턴이 있는데, auth 상태 뱃지는 별도로 인라인으로 작성되어 유지 관리 지점이 분산된다.
- 제안: `AUTH_BADGE_BASE_CLASS` 등의 상수나 작은 helper를 추출하는 것을 고려하되, 현재 코드 규모에서는 강제하지 않아도 되는 INFO 수준이다.

---

## 요약

이번 변경(auth column + 무인증 webhook 경고)은 범위가 작고 기능 의도가 코드에 잘 반영되어 있다. i18n 키 추가는 en/ko 양쪽 모두 일관되게 처리됐고, 테스트 케이스 4개가 핵심 시나리오를 커버한다. 유지보수성 관점의 주요 약점은 두 가지다: 첫째, 셀 렌더링 로직을 IIFE로 인라인 처리해 기존 코드베이스의 컴포넌트 추출 패턴과 불일치하며, 테스트 코드에서 동일한 fixture 구조가 4회 반복된다. 이 두 항목은 향후 셀 종류가 늘거나 테스트 케이스가 추가될 때 수정 비용을 직접적으로 높이므로 WARNING으로 분류한다. `authConfigById` Map의 렌더링마다 재생성 문제도 메모이제이션 미적용으로 인한 WARNING이다.

---

## 위험도

LOW
