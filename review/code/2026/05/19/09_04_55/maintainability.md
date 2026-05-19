# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: `codebase/frontend/src/lib/api/auth.ts`

- **[WARNING]** `isTwoFactorChallenge` / `isAccessTokenResponse` 타입 가드 함수 제거로 재사용 패턴 붕괴
  - 위치: diff L130–161 (기존 `isTwoFactorChallenge`, `isAccessTokenResponse` 함수 삭제)
  - 상세: 삭제 전에는 `isTwoFactorChallenge(payload)` 한 줄로 의도를 표현하는 타입 가드가 존재했다. 이 함수는 이름 자체가 판별 로직의 문서화 역할을 했으며, 테스트 코드나 다른 소비처에서도 재사용 가능한 단위였다. 제거 후 동일 판별 로직이 호출 측 인라인으로 흩어지게 된다(아래 파일 1의 login-form.tsx 변경 참고). `LoginResponseData` 도 `AccessTokenResponse | TwoFactorChallengeResponse` 명명 유니온에서 익명 구조체 유니온으로 퇴보해 각 멤버를 참조할 이름이 사라졌다.
  - 제안: 타입 가드 함수와 명명 인터페이스(`AccessTokenResponse`, `TwoFactorChallengeResponse`)를 유지한다. 삭제가 불가피하다면 최소한 동등한 유틸 함수를 `auth.ts` 안에 남기고, `LoginResponseData` 를 인라인 익명 유니온 대신 명명 타입 별칭으로 선언한다.

- **[WARNING]** `@deprecated` 주석에서 "두 마이너 버전 후 제거 예정" 문구 삭제
  - 위치: diff L167 (`requiresTotp` 필드 JSDoc)
  - 상세: 변경 전 JSDoc 은 "두 마이너 버전 후 제거 예정" 으로 삭제 시점을 명시했다. 변경 후 주석에서 이 시점 기술이 빠졌다. 미래 유지보수자가 언제 이 필드를 안전하게 제거할 수 있는지 파악하기 어려워진다.
  - 제안: `@deprecated` 주석에 제거 조건(버전 또는 날짜 기준)을 복원한다.

- **[INFO]** `discriminated union` 설명이 JSDoc 에서 제거됨
  - 위치: diff L118–119 (`/auth/login 응답` JSDoc 첫 줄)
  - 상세: "discriminated union" 이라는 타입 패턴 명칭이 삭제되었다. 이 명칭은 타입을 어떻게 사용해야 하는지를 한 단어로 전달하는 가이드 역할을 했다.
  - 제안: 필요하다면 JSDoc 본문에 "두 케이스는 `requires2fa` 유무로 판별(discriminated union)" 정도의 한 줄을 추가해 사용 패턴을 안내한다.

---

### 파일 2: `codebase/frontend/src/components/auth/login-form.tsx`

- **[WARNING]** 인라인 판별 로직이 타입 가드 호출을 대체해 의도 불명확
  - 위치: diff L44–58
  - 상세: 변경 전 `if (isTwoFactorChallenge(payload))` 한 줄은 의도를 이름으로 표현했다. 변경 후 `if (payload && "requires2fa" in payload && payload.requires2fa)` 로 대체되어 판별 로직이 호출 측에 노출되었다. `LoginResponseData` 유니온의 discriminant 를 알아야만 코드 의미를 파악할 수 있게 된다. 같은 판별 로직이 다른 컴포넌트에서도 필요해질 때 중복 발생이 불가피하다.
  - 제안: `isTwoFactorChallenge` 타입 가드를 `auth.ts` 에 복원하고 이를 호출하는 원래 패턴으로 되돌린다.

- **[WARNING]** `accessToken` 접근 로직이 옵셔널 체이닝 없이 중첩 조건으로 작성됨
  - 위치: diff L54–58
  - 상세: 변경 전 `await completeLogin(payload.accessToken)` 은 타입 시스템이 `payload` 를 `AccessTokenResponse` 로 좁힌 상태에서 안전하게 호출되었다. 변경 후 `payload && "accessToken" in payload ? payload.accessToken : undefined` → `if (accessToken)` 이중 가드가 추가되었다. 타입 가드 없이 런타임 방어를 직접 해야 하므로 코드가 길어졌고, `accessToken` 이 `undefined` 인 경우를 조용히 무시(`completeLogin` 미호출)하는 동작이 명시적 에러 처리 없이 숨어 있다.
  - 제안: 타입 가드 패턴 복원 시 이 코드도 자연스럽게 `await completeLogin(payload.accessToken)` 으로 축약된다. 복원이 어렵다면 최소한 `accessToken` 이 없는 경우(예상치 못한 응답 shape) 에 대한 에러 로그 또는 에러 상태 처리를 추가한다.

---

### 파일 3: `codebase/frontend/src/components/editor/settings-panel/node-configs/shared/button-list-editor.tsx`

- **[INFO]** JSDoc 보강이 의도를 명확히 전달하여 유지보수성 향상
  - 위치: diff L82–90 (JSDoc 블록 신규 추가)
  - 상세: 기존 한 줄 주석에서 다중 줄 JSDoc 으로 확장해 `maxButtons = 5` default 의 근거(backend 상수·spec 참조), 오버라이드 허용 조건, 캐러셀 합산 모델(item 5 + global 5 = 10)까지 설명한다. 매직 넘버 `5` 가 JSDoc 에서 spec 과 backend 상수로 연결되어 있어 가독성이 높다.
  - 제안: 없음. 이 변경은 긍정적인 유지보수성 개선이다.

- **[INFO]** `maxButtons = 10` → `maxButtons = 5` default 변경: 매직 넘버 일부 잔존 우려
  - 위치: diff L94–95
  - 상세: default 값 `5` 는 JSDoc 에서 backend `MAX_BUTTONS_PER_NODE` 와 연결을 설명하지만, 코드 레벨에서 상수를 직접 import 해 `maxButtons = MAX_BUTTONS_PER_NODE` 처럼 쓰지 않아 frontend-backend 간 SSOT 가 텍스트 주석에만 존재한다. 값이 다시 바뀔 때 JSDoc 도 함께 수정해야 해서 이중 관리 지점이 생긴다.
  - 제안: `packages/` 공유 상수 추출을 장기 follow-up 으로 추진하고(consistency-check W-5 와 동일 방향), 단기적으로는 현재 JSDoc 이 의도를 충분히 표현하므로 허용 가능하다.

---

### 파일 4–6: `plan/in-progress/*.md` (plan 문서들)

- **[INFO]** plan 문서의 구조와 가독성이 전반적으로 양호
  - 위치: `button-cap-spec-validator.md`, `presentation-button-render-investigation.md`, `2fa-webauthn-followups.md` 전체
  - 상세: 각 plan 은 배경 → 결정 → 인벤토리 → 작업 항목 → 관련 문서 순서로 일관되게 구성되어 있다. 체크박스 기반 작업 추적이 명확하고, 완료/미완료 구분이 시각적으로 잘 드러난다. frontmatter 는 CLAUDE.md 규약을 준수한다.
  - 제안: 없음.

- **[INFO]** `2fa-webauthn-followups.md` 에서 완료 항목 롤백이 가독성 저하 가능성
  - 위치: `2fa-webauthn-followups.md` diff L300–318 (섹션 9, 10 완료 표기 → 미완료로 롤백)
  - 상세: 이전에 `[x]` 로 완료 표기된 항목이 `[ ]` 로 되돌려지고, 완료 근거 설명도 제거되었다. 히스토리를 diff 외부에서 읽는 사람은 왜 완료 처리가 취소되었는지, 기존에 어떤 작업이 있었는지 파악하기 어렵다. 항목 롤백 사유가 plan 본문에 없다.
  - 제안: 롤백 이유를 짧은 코멘트로 해당 섹션 상단에 추가한다(예: "재검토 필요 — 선행 구현이 되돌려짐").

---

### 파일 7–19: `review/consistency/**` (consistency check 산출물)

- **[INFO]** 내부 구조 파일(`_retry_state.json`)에 절대 경로 하드코딩
  - 위치: `_retry_state.json` — `session_dir`, 각 `prompt_file`, `output_file` 필드
  - 상세: `/Volumes/project/private/clemvion/...` 형태의 로컬 머신 절대 경로가 JSON 에 고정되어 있다. 다른 개발자 환경이나 CI 에서 재활용하면 경로가 깨진다. 이 파일은 orchestrator 가 생성하는 기계 생성 파일이므로 실제 유지보수 부담은 낮지만, 이식성(portability) 관점에서 개선 여지가 있다.
  - 제안: session 관련 JSON 을 생성할 때 절대 경로 대신 프로젝트 루트 기준 상대 경로 또는 환경변수 치환을 고려한다(orchestrator 레벨 개선 사항).

---

## 요약

이번 PR 의 유지보수성 관점 핵심 우려는 `auth.ts` 와 `login-form.tsx` 에 집중된다. `isTwoFactorChallenge` / `isAccessTokenResponse` 타입 가드 제거와 `AccessTokenResponse` / `TwoFactorChallengeResponse` 명명 인터페이스 해체로 인해, 복잡한 discriminated union 판별 로직이 호출 측 인라인으로 흩어졌다. 이로 인해 가독성이 떨어지고 동일 판별 로직이 향후 중복될 위험이 높아졌다. `completeLogin` 호출 누락을 조용히 무시하는 패턴도 의도가 명확하지 않다. 반면 `button-list-editor.tsx` 의 JSDoc 보강과 `maxButtons = 5` 변경은 유지보수성 개선에 기여하는 긍정적인 변경이다. 특히 spec·backend 상수·테스트·frontend default 가 동일 값으로 정렬된 점은 일관성 측면에서 우수하다. 전반적으로 버튼 cap 통일 변경(파일 2~6)은 양호하지만, auth 관련 타입 안전성 퇴보(파일 1~2)가 중기적 유지보수 비용을 높일 가능성이 있다.

## 위험도

MEDIUM
