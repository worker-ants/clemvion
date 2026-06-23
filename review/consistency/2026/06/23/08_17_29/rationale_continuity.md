# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-web-chat-console.md`
검토 일시: 2026-06-23

---

### 발견사항

- **[INFO]** `_product-overview §2 비목표` 문구 "명확화" — 기각 결정 번복은 아니나 신규 경계 정의에 대한 Rationale 보완 필요
  - target 위치: §1.2 "외형은 boot 옵션으로만 — 비목표와의 정합 (중요)" 및 §2.2 EDIT `_product-overview`
  - 과거 결정 출처: `spec/7-channel-web-chat/_product-overview.md §2 비목표` — "위젯 외형의 서버사이드 관리 콘솔 — 외형은 v1·v2 모두 **로더(boot) 옵션으로만** 주입(백엔드 미저장)"
  - 상세: 기존 비목표 항목은 "서버사이드 관리 콘솔" 전체를 비목표로 선언한다. target 은 이를 "백엔드가 외형을 저장·서빙하는 관리 콘솔" 로 좁히고, "외형을 boot 옵션으로 emit 하는 스니펫 빌더 콘솔" 은 v1 목표로 추가한다. 이는 기존 비목표 문구의 자연독해("서버사이드 관리 콘솔"의 종류 한정)와 논리적으로 일치하며, Rationale 기각 결정을 직접 뒤집는 것은 아니다. 다만 기존 `_product-overview` 의 Rationale 절에는 비목표 항목 선정 근거가 기록되어 있지 않아, target 이 주장하는 "스니펫 빌더는 비목표와 충돌 안 함" 논리가 기존 문서에서 지지를 받지 못한다. 새 Rationale 항목(`_product-overview` Rationale 에 §1.2 정합 근거 추가)을 target 이 §2.2 에서 명시하고 있어 형식 요건은 충족한다.
  - 제안: target 의 §2.2 에서 예고한 대로 `_product-overview` Rationale 갱신 시 "비목표 항목이 처음 설정될 때 '스니펫 빌더 콘솔' 유형을 검토했는지, 검토했다면 기각했는지" 를 명시적으로 기록할 것. 기록이 없으면 "v1.1 추가 검토 결과 스니펫 빌더는 비목표 설정 당시 고려 대상에 없었음" 이라는 보충 언급으로 기존 결정과의 연속성을 확보한다.

- **[INFO]** `0-architecture R5` 원칙 준수 확인 — EIA client-consumer 한정 + 신규 트리거 유형·facade 미신설
  - target 위치: §1.1 마지막 bullet "신규 백엔드 트리거 유형·facade·in-process 우회를 추가하지 않는다"
  - 과거 결정 출처: `spec/7-channel-web-chat/0-architecture.md §R5`
  - 상세: target 이 콘솔을 "기존 trigger API 소비자" 로 설계해 R5 를 명시적으로 인용하고 있다. 충돌 없음.
  - 제안: 없음.

- **[INFO]** `localStorage` 외형 보존 선택 — 신규 결정으로 기존 Rationale 에 대응 기록 없음
  - target 위치: §1.2 "폼 상태는 운영자 편의를 위해 **브라우저 localStorage** 에만 보존(선택)"
  - 과거 결정 출처: 해당 없음 (기존 Rationale 에 localStorage 선택/기각 기록 없음)
  - 상세: 기존 비목표("백엔드 미저장")와는 일관하지만, localStorage 선택의 이유(백엔드 미저장 강제 + 브라우저 단위 보존 편의)는 target 의 Rationale 절("외형 백엔드 미저장 유지" 항)에서 암묵적으로만 다뤄지며 localStorage 의 명시적 채택 이유가 없다. 쿠키·sessionStorage·indexedDB 등 대안이 기각된 이유도 미기술.
  - 제안: target 의 Rationale 또는 `5-admin-console.md §Rationale` 에 "localStorage 선택 근거 (vs sessionStorage: 탭 닫아도 유지, vs backend: 비목표 준수, 단점: 브라우저 제한·도메인 공유 주의)" 를 한 항으로 추가.

- **[INFO]** 신규 env `NEXT_PUBLIC_WIDGET_CDN_BASE` 도입 — 기존 아키텍처 §4 플레이스홀더에서 최초 키 이름 확정이나 채택 Rationale 미기술
  - target 위치: §1.3 "`<widget-cdn-base>`: **신규 env `NEXT_PUBLIC_WIDGET_CDN_BASE`** (현재 프론트에 위젯 cdn-base 노출 경로 없음 → 신규 필요)"
  - 과거 결정 출처: `spec/7-channel-web-chat/0-architecture.md §4` — `<widget-cdn-base>` 플레이스홀더, "배포(env/config)로 주입"
  - 상세: 아키텍처 §4 는 env 키 이름을 확정하지 않았으므로 target 의 키 이름 결정이 충돌은 아니다. 그러나 `5-admin-console.md` §5 와 Rationale 에 이 env 신설의 근거(기존 경로 부재, 프론트엔드에서 필요한 이유, 기존 `NEXT_PUBLIC_WEBHOOK_BASE_URL`/`NEXT_PUBLIC_API_URL` 과 분리되어야 하는 이유)를 명시할 필요가 있다.
  - 제안: `spec/7-channel-web-chat/5-admin-console.md §Rationale` 에 env 신설 결정 항 추가.

---

### 요약

target draft 는 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 사항을 포함하지 않는다. 핵심 설계 결정(트리거 재사용 · EIA client-consumer 원칙 준수 · 백엔드 외형 미저장)은 `0-architecture R5` 와 `_product-overview §2 비목표` 와 방향이 일치하며, target 이 이를 명시적으로 인용하고 있다. 주요 INFO 항목들은 모두 "새로운 결정(localStorage, `NEXT_PUBLIC_WIDGET_CDN_BASE`)의 Rationale 미기술" 또는 "비목표 문구 명확화 시 기존 결정과의 맥락 연결 보완 필요" 수준이다. target 이 `_product-overview` Rationale 갱신을 §2.2 에서 이미 예고하고 있어 형식 요건은 충족하나, 새 결정들의 Rationale 기술 범위를 좀 더 완결해야 spec 문서로서 연속성이 완전히 보장된다.

### 위험도

LOW

---

STATUS: SUCCESS
