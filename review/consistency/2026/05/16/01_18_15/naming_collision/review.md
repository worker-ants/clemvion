# 신규 식별자 충돌 검토 결과

대상 문서: `plan/in-progress/spec-draft-cafe24-private-followup.md`
수정 대상 파일: `spec/2-navigation/4-integration.md`

---

## 발견사항

### 발견사항 1

- **[WARNING]** `request-scopes` 응답 분기 ① 에 `state` 필드 추가 — 기존 spec 과 불일치
  - target 신규 식별자: 변경 1의 분기 ① 응답 형태 `{ authUrl, state }`
  - 기존 사용처:
    - `spec/2-navigation/4-integration.md:673` — `POST /api/integrations/:id/request-scopes` 응답 "일반 provider — `{ authUrl }` (팝업 OAuth)"
    - `spec/2-navigation/4-integration.md:270` — §4.4 기존 행 "일반 OAuth provider(Google/GitHub/Cafe24 Public) — `authUrl` 반환"
    - `spec/2-navigation/4-integration.md:667` — `POST /api/integrations/oauth/begin` 응답이 `{ authUrl, state }` — `state` 필드는 **begin** 엔드포인트의 것
  - 상세: 기존 spec(§9.2 및 §4.4)은 `request-scopes` 의 일반 provider 응답을 `{ authUrl }` 단일 필드로 정의한다. `state` 는 `oauth/begin` 이 반환하는 CSRF 방지용 값이며, `request-scopes` 가 내부적으로 begin 을 호출하더라도 그 `state` 를 caller 에 노출한다는 기술이 기존 spec 어디에도 없다. target 이 `{ authUrl, state }` 를 새로운 응답 shape 으로 명시하면, 프런트엔드 구현 팀이 실제로 `state` 를 수신하는지 혼동하거나, 기존 §9.2 와 충돌하는 구현을 낳을 수 있다.
  - 제안: 분기 ① 응답을 기존 spec 과 동일하게 `{ authUrl }` 로 유지한다. `state` 를 UI 에서 직접 다루지 않는다면 spec 에 노출할 필요가 없다. 실제로 `state` 를 팝업 흐름의 부모 창에서 사용한다면, §9.2 의 `request-scopes` 응답 정의에도 해당 필드를 추가하고 용도를 명시한 뒤 target 에 반영한다.

---

### 발견사항 2

- **[INFO]** `toast.success` / `toast.info` 함수 호출 패턴 — 기존 spec 의 토스트 기술 방식과 표기 수준 차이
  - target 신규 식별자: `toast.success("Scope request window opened" / "권한 요청 창을 열었어요")`, `toast.info(<title>)`
  - 기존 사용처: `spec/0-overview.md §3.4` — "Toast: 성공/실패/정보 알림" 수준의 UI 패턴 기술. 다른 spec 파일에서 구체 함수 시그니처(`toast.xxx(...)`)를 직접 기재한 사례는 코퍼스에서 발견되지 않음.
  - 상세: 충돌은 아니지만, target 이 토스트 호출 코드까지 spec 에 박음으로써 다른 화면 spec 과 추상화 수준이 달라진다. 동일 라이브러리 이름(`toast`)을 가정하므로 향후 라이브러리 교체 시 spec 과 구현이 동시에 수정될 위험이 있다. 일관성 관점에서 "토스트(success)"/"토스트(info)" 수준의 서술이 권장된다.
  - 제안: 함수 호출 형태 대신 "즉시 토스트(info 레벨)" / "성공 토스트" 식으로 서술 수준을 통일한다. 문구 예시는 별도 줄에 인용 블록으로 두면 충분하다.

---

### 발견사항 3

- **[INFO]** `review/consistency/2026-05-14_18-23-55` → `review/consistency/2026/05/14/18_23_55` 경로 교정 — 기존 nested ISO 컨벤션과 일치함 (이상 없음)
  - target 신규 식별자: (없음 — 기존 flat 경로를 nested 경로로 교정)
  - 기존 사용처: `spec/2-navigation/4-integration.md:903` — `(참고: review/consistency/2026-05-14_18-23-55)` (flat 구형 형식)
  - 상세: 교정 방향이 CLAUDE.md 컨벤션(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)과 정확히 일치하고, 실제 디렉토리 `review/consistency/2026/05/14/18_23_55` 가 존재함을 plan 에서 확인. 식별자 충돌 없음.
  - 제안: 그대로 반영한다.

---

## 요약

target 이 도입하는 신규 식별자(응답 shape, UI 패턴, 경로 참조) 대부분은 기존 corpus(`spec/2-navigation/4-integration.md §4.4`, §9.2, Rationale)와 동일한 용어·shape 를 사용하여 충돌이 없다. `cafe24_private_pending`, `scopesAdded`, `appUrl`, `callbackUrl`, `integrationId`, `onChanged`, `onMutate` 는 모두 기존 spec 에 이미 동일 의미로 등장하므로 신규 충돌이 없다. 단 하나의 실질적 이슈는 분기 ① 응답에 `state` 를 추가하는 부분으로, 기존 §9.2 의 `{ authUrl }` 정의와 불일치한다. 이 항목은 WARNING 등급이며 spec 반영 전에 `state` 노출 여부를 §9.2 와 함께 정리해야 한다. 나머지는 추상화 수준 조율을 권장하는 INFO 수준이다.

---

## 위험도

LOW
