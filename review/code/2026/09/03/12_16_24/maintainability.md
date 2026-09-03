# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** JSDoc 재배치 수정이 불완전 — `*/` 와 대상 선언 사이에 빈 줄이 남음 (파일 컨벤션과 불일치)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:176` (`armExpiryTimers` 선언 직전),
    `codebase/backend/src/modules/websocket/websocket-events.types.ts:302` (`AuthTokenExpiredPayload` 선언 직전)
  - 상세: 직전 리뷰 라운드(RESOLUTION.md W1·W2)가 "신규 심볼이 기존 JSDoc 과 그 대상 선언 사이에
    끼어들어 JSDoc 이 고아가 됐다"는 지적을 받고, 신규 심볼(`clearExpiryTimers` 메서드,
    `MSG_AUTH_TOKEN_EXPIRING` 상수)을 대상 선언 뒤로 옮겨 인접성을 복원했다고 기록했다. 실제로
    JSDoc 은 이제 올바른 대상(`armExpiryTimers`, `AuthTokenExpiredPayload`) 바로 앞에 있어 오귀속은
    해소됐다 — 다만 이동 과정에서 `*/` 와 선언 사이에 빈 줄이 하나 남았다. 같은 파일의 다른 모든
    JSDoc(`TOKEN_EXPIRY_LEAD_MS`, `expiryTimers` 필드, `clearExpiryTimers` 메서드 자신)은 빈 줄 없이
    바로 선언이 이어지는데, 이 두 곳만 다르다(직접 `awk` 로 파일 전체를 스캔해 대조 확인). 동작에
    영향은 없으나 파일 자체가 확립한 "JSDoc 뒤에 빈 줄 없이 바로 선언" 컨벤션과 어긋나 일관성이
    깨졌고, 애초 지적이 "JSDoc 위치를 원래 대상에 정확히 재인접시킨다"였던 만큼 사소하게 미완성인
    수정이다.
  - 제안: 두 곳 모두 `*/` 다음 줄의 빈 줄을 제거해 선언과 바로 붙인다.

- **[INFO]** `Math.max(0, …)` clamp 근거 주석이 두 지점(`untilNotice`, `cutoff`)에 유사한 내용으로
  반복
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `armExpiryTimers` 내부
    `untilNotice` 계산부(§ "의도적으로 중복 방어" 주석)와 `cutoff` 계산부(§ "위 `untilNotice` 와
    같은 이유" 주석)
  - 상세: 로직 중복은 아니고(각각 실제로 필요한 개별 clamp), 주석도 완전한 복붙이 아니라 두 번째가
    첫 번째를 명시적으로 참조("위 `untilNotice` 와 같은 이유")하며 축약한 형태라 실질적인
    유지보수 부담은 낮다. 다만 두 clamp 의 근거가 사실상 동일하므로, 셋 이상으로 늘어날 경우를
    대비해 공통 설명을 한 곳(예: 클래스 JSDoc 이나 헬퍼 함수 이름)으로 모으는 편이 다음 사람이
    "왜 두 번 설명돼 있나"를 되짚지 않아도 된다.
  - 제안: 낮은 우선순위 — 현재 2곳뿐이라 조치 불필요. 향후 세 번째 clamp 가 추가되면 공통 주석으로
    통합 검토.

## 요약

이번 diff 는 직전 리뷰 라운드(11_57_58)의 WARNING 3건(JSDoc 오귀속 2건 + rearm 조기-return 누수
1건)과 INFO 3건을 닫는 후속 커밋이다. 실제 소스(`websocket.gateway.ts`,
`websocket-events.types.ts`)를 직접 열어 확인한 결과 지적된 문제들은 실질적으로 잘 해소됐다 —
`clearExpiryTimers` 헬퍼로 해제 로직을 한 곳에 모아 `handleDisconnect` 의 중복 코드를 제거했고,
`expiryTimers` 맵 타입을 non-optional 로 좁혀 도달 불가능한 방어 분기를 없앴으며, 신규 테스트들이
`connectWithExp` 헬퍼를 공유해 중복 없이 각 시나리오(재무장·exp 없는 재무장·unref)를 명확한 한국어
설명과 함께 검증한다. 이름·구조·주석 밀도 모두 기존 파일 컨벤션과 잘 맞는다. 유일한 흠은 JSDoc
재배치 시 대상 선언과의 사이에 빈 줄이 하나 남아, "재인접시켰다"는 수정 의도를 100% 완수하지
못한 점이다(위 INFO 참고) — 기능·가독성에 실질적 영향은 없는 사소한 잔여물이다.

## 위험도
LOW
