# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `errMessage` 함수 — `console.warn` 전역 출력 부작용 추가
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `errMessage` 함수
- 상세: 변경 전 `errMessage` 는 순수 함수(입력 → 문자열 반환, 부작용 없음)였다. 변경 후 `console.warn("[widget] conversation error:", ...)` 가 추가되어 호출마다 전역 콘솔에 출력된다. 이는 테스트 환경에서 예상치 못한 콘솔 노이즈를 생성하고, 테스트 러너(vitest)의 콘솔 스파이 검증이 있는 경우 거짓 실패를 유발할 수 있다.
- 제안: 테스트 환경에서 `console.warn` 이 스파이되지 않는다면 즉시 문제는 없다. 다만 테스트에서 `console.warn` mock 없이 errMessage 경로를 타는 케이스(W1 테스트 포함)는 콘솔 출력이 발생한다. W1 테스트(`use-widget-eager-start.test.ts`)가 에러 문구만 단언하고 `console.warn` 을 명시적으로 suppressed 하지 않으므로, CI 로그에 예상치 못한 경고 메시지가 출력된다. 의도한 동작이면 수용 가능(WARNING 급이 아닌 INFO).

---

### [INFO] `getStorage` 기본값 변경 — `localStorage` → `sessionStorage` 전역 스토리지 대상 이동
- 위치: `codebase/channel-web-chat/src/lib/session-store.ts` `getStorage` 함수
- 상세: `saveSession` / `loadSession` / `clearSession` 세 함수가 `storage` 파라미터를 생략할 때 사용하는 기본 스토리지가 `localStorage` 에서 `sessionStorage` 로 전환됐다. 이는 의도된 변경이나, 다음 암묵적 부작용이 있다:
  1. **기존 `localStorage` 잔존 데이터**: 이전 버전에서 `localStorage` 에 저장된 세션 항목(`clemvion-web-chat:session:*`)은 이 변경 후 `loadSession` 이 읽지 못한다. 기존 사용자가 탭을 reload 했을 때 세션 복원 실패(세션 없음으로 처리 → 새 세션 시작). 이는 정책 의도(이전 localStorage 항목은 orphan으로 자연 소거)와 일치하나 배포 시점에 진행 중인 사용자의 세션이 단절될 수 있다.
  2. **탭 간 세션 공유 소멸**: `localStorage` 는 같은 origin 의 모든 탭에서 공유됐으나 `sessionStorage` 는 탭 단위 격리다. 두 탭에서 같은 위젯을 열었던 사용자는 탭 간 세션이 더 이상 공유되지 않는다. spec §R6 에서 의도 트레이드오프로 명시했으나 런타임 동작 변화임.
- 제안: 배포 시 기존 `localStorage` 잔존 항목 클린업 로직(1회 migration 또는 무시) 여부를 문서화하면 충분. 현재 구현은 잔존 항목을 그냥 남겨두므로 `localStorage` 에 `clemvion-web-chat:session:*` 키가 영구적으로 남는다. 보안 목표(탭 종료 시 소거)가 sessionStorage 전환의 핵심이므로, 기존 localStorage 항목도 마이그레이션 시점에 삭제하는 1회 클린업 코드를 고려할 수 있다(선택적).

---

### [INFO] e2e 테스트 큐 목록 추가 — 공유 e2e suite 큐 기대값 변경
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` `EXPECTED_QUEUE_NAMES` 배열
- 상세: `'workspace-invitations-pruner'` 큐가 기대 목록에 추가됐다. 이 변경 자체가 부작용을 생성하지는 않으나, 이 e2e 테스트는 실제 백엔드가 해당 큐를 BullMQ 에 등록·구동 중일 때만 pass 한다. 큐가 비활성화되거나 제거되는 경우 해당 e2e 가 false-negative 를 생성한다. 의도된 정합 복구 변경으로 수용 가능.
- 제안: 해당 없음(pre-existing drift 복구이며 의도된 변경).

---

### [INFO] 테스트 파일들의 `localStorage.clear()` → `sessionStorage.clear()` 전환
- 위치: `session-store.test.ts`, `use-widget-commands.test.ts`, `use-widget-eager-start.test.ts` 의 `beforeEach`
- 상세: `beforeEach` 에서 정리하는 스토리지 대상이 `localStorage` 에서 `sessionStorage` 로 변경됐다. 구현 변경과 일관적이나, 각 테스트는 이제 `localStorage` 를 beforeEach 에서 정리하지 않는다. `session-store.test.ts` 의 새 테스트 케이스("기본 저장소 = sessionStorage") 는 `localStorage.clear()` 를 직접 호출하여 `localStorage` 를 정리하므로 해당 테스트 내 다른 테스트가 `localStorage` 에 무언가를 남겼다면 오염될 가능성이 있다. 실제로 세션 키를 `localStorage` 에 저장하는 코드는 이 PR 이후 없으므로 오염 가능성은 사실상 없다.
- 제안: 해당 없음.

---

### [INFO] `GENERIC_ERROR_MESSAGE` 상수 — 모듈 스코프 전역 도입
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` 모듈 최상단
- 상세: `GENERIC_ERROR_MESSAGE` 가 모듈 스코프 `const` 로 도입됐다. ES 모듈의 모듈-스코프 상수는 "전역 변수" 에 해당하지 않으며 export 되지 않으므로 외부 사용자 영향 없음. 순수 내부 상수로 무방하다.
- 제안: 해당 없음.

---

## 요약

이번 변경의 핵심은 `session-store.ts` 의 `getStorage` 기본 스토리지를 `localStorage` 에서 `sessionStorage` 로 전환하고, `use-widget.ts` 의 `errMessage` 가 UI 에 내부 원문을 노출하지 않도록 일반화한 것이다. 의도하지 않은 부작용 측면에서 주목할 점은 두 가지다: (1) `errMessage` 에 `console.warn` 이 추가되어 순수 함수였던 `errMessage` 가 콘솔 부작용을 갖게 되었으나, 이는 진단 목적의 의도된 동작이며 런타임 안정성에 영향이 없다. (2) `localStorage` → `sessionStorage` 전환으로 인해 기존 `localStorage` 에 남아 있는 `clemvion-web-chat:session:*` 키가 orphan으로 잔존하게 되며, 진행 중 세션이 있는 사용자는 배포 시점에 세션이 단절된다. 이는 spec §R6 의 의도 트레이드오프로 인식되었으나, 기존 localStorage 항목의 클린업 정책이 코드 상 명시되어 있지 않다. 공개 API(함수 시그니처) 변경은 없으며, 이벤트/콜백/네트워크/환경변수 관련 의도치 않은 부작용은 발견되지 않는다.

## 위험도

LOW
