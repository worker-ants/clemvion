# 변경 범위(Scope) 리뷰 결과

## 작업 의도

`plan/in-progress/webchat-session-storage.md` 기준:
- **A-1**: session-store.ts `localStorage → sessionStorage` 전환 + 주석 갱신
- **W1**: `use-widget.ts errMessage` 에러 문구 일반화 (UI 노출 방지, console 진단 유지)
- **테스트**: 위 두 변경에 대응하는 테스트 갱신 + 에러 일반화 검증 테스트 추가
- **부수**: e2e suite green 복구용 pre-existing drift 수정 (system-status.e2e-spec.ts)

## 발견사항

### 파일 1: codebase/backend/test/system-status.e2e-spec.ts

- **[INFO]** pre-existing e2e drift 수정 — `workspace-invitations-pruner` 큐 추가
  - 위치: `EXPECTED_QUEUE_NAMES` 배열 라인 37~38
  - 상세: 본 PR 의 주요 목표(sessionStorage 전환 / 에러 일반화)와 직접 무관한 백엔드 e2e 파일 수정. `system-status.constants`에 이미 등록된 큐가 테스트 기대 목록에서 누락된 pre-existing drift를 함께 수정했다. 코드 자체는 변경자가 주석으로 "본 PR 과 무관한 pre-existing e2e drift 수정 — 공유 e2e suite green 복구용"이라고 명시함.
  - 평가: 공유 e2e suite를 green 상태로 유지하기 위한 최소 수정(1줄 + 주석 2줄)으로, 실질적인 기능 변경 없음. 범위 일탈이나 리팩토링이 아닌 테스트 정합 복구이며, 수정 자체에 부작용이 없다. 단, 본 PR의 명시된 scope(channel-web-chat)와 영역이 다른 파일(codebase/backend)에 포함된 점은 주의가 필요하다.
  - 제안: 허용 가능한 수준. 단, 향후 유사 drift는 별도 PR로 분리하면 변경 추적이 명확해진다.

### 파일 2: codebase/channel-web-chat/src/lib/session-store.test.ts

- **[INFO]** 변경 범위 내 — localStorage → sessionStorage 참조 교체 + 명시적 검증 테스트 추가
  - 위치: 전체 diff
  - 상세: `beforeEach` clear 대상, `getItem` 단언, `setItem` 설정이 모두 `localStorage → sessionStorage` 로 일관되게 교체됨. 신규 테스트 "기본 저장소 = sessionStorage"는 실제 구현 변경(session-store.ts)을 직접 검증하는 적절한 추가.
  - 제안: 없음.

### 파일 3: codebase/channel-web-chat/src/lib/session-store.ts

- **[INFO]** 변경 범위 내 — 핵심 구현 변경
  - 위치: 파일 헤더 주석(3줄), `getStorage` 내부 반환 값(1줄)
  - 상세: `localStorage → sessionStorage` 단일 전환 + 근거 주석 추가. 나머지 함수 로직(saveSession, loadSession, clearSession)은 무변경. 포맷팅·불필요한 리팩토링 없음.
  - 제안: 없음.

### 파일 4: codebase/channel-web-chat/src/widget/use-widget-commands.test.ts

- **[INFO]** 변경 범위 내 — `window.localStorage.clear() → window.sessionStorage.clear()` 1줄 교체
  - 위치: `beforeEach` 블록
  - 상세: session-store.ts 변경에 대응하는 최소 테스트 픽스. 다른 코드 영역 무접촉.
  - 제안: 없음.

### 파일 5: codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts

- **[INFO]** 변경 범위 내 — `localStorage → sessionStorage` 교체 + W1 에러 일반화 테스트 추가
  - 위치: `beforeEach` clear, `setItem` 사전 설정, W1 신규 테스트 블록
  - 상세: 기존 테스트의 localStorage 참조 교체(2곳)는 session-store.ts 변경에 대응. W1 신규 테스트("webhook 실패 → state.error 는 일반화 문구")는 use-widget.ts `errMessage` 변경을 직접 검증하는 추가로 계획된 항목.
  - 제안: 없음.

### 파일 6: codebase/channel-web-chat/src/widget/use-widget.ts

- **[INFO]** 변경 범위 내 — errMessage 함수 전면 교체 (W1 구현)
  - 위치: `GENERIC_ERROR_MESSAGE` 상수 신설 + `errMessage` 함수 본문 교체
  - 상세: `EiaError` / `Error` 분기별 원문 반환에서 일반화 문구 단일 반환으로 전환. 원문은 `console.warn`으로 진단 보존. 함수 외부 코드 무변경, 불필요한 리팩토링 없음. `GENERIC_ERROR_MESSAGE` 상수화는 문구를 테스트와 구현 간 일치시키기 위한 적절한 선택.
  - 제안: 없음.

### 파일 7: plan/in-progress/webchat-session-storage.md

- **[INFO]** 변경 범위 내 — 신규 plan 파일 (작업 추적)
  - 위치: 전체 파일 신규 생성
  - 상세: CLAUDE.md 규약에 따른 정상적인 plan 파일 생성. worktree, spec_impact, 체크박스 목록 모두 본 작업 내용과 일치.
  - 제안: 없음.

### 파일 8: review/consistency/2026/06/27/22_55_00/SUMMARY.md

- **[INFO]** 변경 범위 내 — consistency-check --spec 산출물
  - 위치: 신규 파일
  - 상세: developer 의무 단계(`--spec` consistency check) 산출물로 정상 위치(`review/consistency/`)에 생성. 내용은 본 PR의 spec 변경에 국한.
  - 제안: 없음.

### 파일 9: review/consistency/2026/06/27/22_55_00/_retry_state.json

- **[INFO]** 변경 범위 내 — orchestration 상태 파일
  - 위치: 신규 파일
  - 상세: consistency-check 워크플로 오케스트레이터가 생성하는 내부 상태 파일. review/ 산출물 디렉터리에 포함됨.
  - 제안: 없음.

## 요약

변경 전체가 plan 명세(`webchat-session-storage.md §A`)의 두 목표 — localStorage→sessionStorage 전환과 errMessage 일반화(W1) — 에 직접 대응한다. 기능 추가·불필요한 리팩토링·포맷팅 변경·무관 임포트 정리는 전혀 없다. 유일하게 명시된 scope(channel-web-chat)를 벗어난 수정은 `system-status.e2e-spec.ts`(backend e2e) 1파일이나, 이는 pre-existing drift를 공유 e2e suite green 복구 목적으로 최소 수정(1줄 + 2줄 주석)한 것으로 변경자도 주석으로 명시했다. 실질적인 기능·로직 변경 없이 테스트 기대 목록을 실제 서버 상태에 맞게 정렬한 수준이므로 범위 일탈로 차단할 사유가 없다.

## 위험도

LOW
