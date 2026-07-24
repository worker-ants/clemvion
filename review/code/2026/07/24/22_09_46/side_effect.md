# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `loadSession` 공개 함수 시그니처 변경 (breaking change)
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:70-74` (`export function loadSession(triggerEndpointPath, expectedApiBase, storage?)`)
  - 상세: 기존 `loadSession(triggerEndpointPath, storage?)` 사이에 필수 인자 `expectedApiBase: string` 이 새로 삽입됐다. 기존 호출부를 그대로 두면 `storage` 자리에 문자열이 들어가는 타입 불일치가 난다. 저장소 전체(`grep -rn "loadSession(" codebase/channel-web-chat/src`)를 확인한 결과 실제 프로덕션 호출부는 `use-widget.ts` 1곳뿐이고 이미 `loadSession(cfg.triggerEndpointPath, cfg.apiBase)` 로 갱신돼 있다. `channel-web-chat` 은 `private: true` 단독 Next.js 앱(배포 파이프라인 내부 전용)이라 외부 소비자(퍼블리시된 패키지)도 없다. `npx tsc --noEmit` 도 클린 통과해 다른 누락 호출부가 없음을 확인했다. 의도적 설계(주석: "필수 인자인 것이 의도다 — optional 이면 호출부가 조용히 검사를 건너뛸 수 있고, 그게 바로 이 함수가 막으려는 결함이다")이므로 차단 사유는 아니나, 향후 이 함수를 새로 호출하는 코드가 컴파일 전까지는 인지 못 할 breaking-change 라는 점은 기록해 둔다.
  - 제안: 조치 불필요(설계 의도대로 동작 확인됨). 향후 리팩터링 시 이 시그니처 계약(필수 3번째 인자 없음, 2번째가 apiBase)을 유지할 것.

- **[INFO]** `PersistedSession.apiBase` 필수 필드 도입 → 배포 시점 활성 세션 전체가 페일-세이프로 폐기됨
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:13-20` (인터페이스 정의), `:87-96` (`!parsed.apiBase` 미기록 세션도 폐기하는 분기)
  - 상세: 이 필드 도입 이전에 `sessionStorage` 에 저장된 세션(과거 배포 버전)은 `apiBase` 가 없으므로, 이 변경이 배포된 뒤 사용자가 탭을 새로고침하면 `loadSession` 이 그 세션을 무조건 `clearSession` 으로 폐기(`sessionStorage.removeItem`)하고 새 대화로 전환시킨다. 이는 코드가 의도적으로 만드는 실제 부작용(진행 중이던 대화의 소리 없는 종료)이며, `plan/complete/webchat-session-apibase-binding.md` 에 "최악의 비용 = 새 대화 1회" 로 비용-편익이 명시돼 있고 테스트(`session-store.test.ts` "apiBase 미기록(레거시 세션) → null + 폐기 (fail-safe)")로도 고정돼 있다. 버그가 아니라 알려진 트레이드오프이므로 정보 제공 목적으로만 기록한다.
  - 제안: 조치 불필요. 배포 노트/릴리스 공지에 "이 배포 이후 새로고침 시 진행 중이던 대화가 1회 초기화될 수 있음" 을 남기고 싶다면 참고할 것(코드 변경 요구 아님).

- **[INFO]** `use-token-refresh.ts` 는 diff 밖이지만 `apiBase` 보존 여부를 교차 확인함
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts` 의 `scheduleRefresh` 콜백 (`const updated = { ...currentSession, token, expiresAt };`)
  - 상세: 이 diff 대상 파일은 아니지만, 토큰 갱신 시 세션 객체를 스프레드로 재구성하는 지점이라 `apiBase` 를 실수로 누락시킬 위험이 있는 곳이다. 확인 결과 `{ ...currentSession, token, expiresAt }` 형태로 기존 필드(=`apiBase` 포함)를 보존한 뒤 `token`/`expiresAt` 만 덮어써 저장하므로, 세션 갱신 후에도 원래 발급 origin 바인딩이 그대로 유지된다. 문제 없음 — 회귀 없음을 확인한 결과만 남긴다.

## 요약

핵심 변경은 `PersistedSession` 에 필수 필드 `apiBase` 를 추가하고 `loadSession` 에 그 값을 검증하는 필수 인자를 신설한 것이다. 시그니처 변경은 breaking 이지만 프로덕션 호출부가 저장소 전체에서 1곳뿐이며 이미 갱신돼 있고, `tsc --noEmit` 이 클린해 다른 누락 호출부가 없음을 확인했다. 배포 이후 `apiBase` 미기록 레거시 세션이 페일-세이프로 일괄 폐기되는 것은 실사용자에게 보이는 실질 부작용이지만, plan 문서와 전용 회귀 테스트로 이미 의도된 트레이드오프임이 명시돼 있다. 전역 변수 도입, 예상치 못한 파일시스템/네트워크/환경변수 접근, 이벤트·콜백 오발화 등은 발견되지 않았고, 토큰 갱신 경로(`use-token-refresh.ts`)도 스프레드로 `apiBase` 를 정상 보존해 새 필드가 조용히 소실되는 경로는 없음을 교차 확인했다.

## 위험도

LOW
