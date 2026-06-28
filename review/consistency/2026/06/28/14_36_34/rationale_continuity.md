# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 영역: `spec/7-channel-web-chat/`

---

## 발견사항

### [INFO] `0-architecture §2.1` — `srcdoc` 기각과 admin 콘솔 carve-out 의 경계 명문화 완료

- target 위치: `0-architecture.md §2.1` + `§R5 carve-out`
- 과거 결정 출처: `0-architecture §R5` (정적 CDN 자산·`srcdoc` 기각)
- 상세: `srcdoc`/`about:blank` 자가 생성을 기각한 근거(cross-origin 격리 파괴)가 §R5에 명시돼 있으며, admin 콘솔 내부 미리보기는 "cross-origin 격리가 목적이 아님"이라는 다른 목적을 갖는다는 carve-out이 §R5 하단과 `4-security §R5`에 이중으로 설명돼 있다. 기각된 `srcdoc`가 carve-out 대상에도 적용 금지라고 명시(`srcdoc 자가 생성은 여기서도 금지`)되어 있어 역전 없음.
- 제안: 이슈 없음. 기존 기각과 carve-out 경계가 일관됨.

---

### [INFO] `1-widget-app §R6` — lazy 시작 기각 후 eager-start 전환 Rationale 완비

- target 위치: `1-widget-app.md §R6`
- 과거 결정 출처: `1-widget-app §R6` 자체 (초기 결정이 "패널 open 만으로 미시작" lazy 모델)
- 상세: lazy 모델에서 eager-start 로의 번복이 `§R6`에 원 결정(기각된 대안), 전환 결정(채택), 전환 날짜(2026-06-06 사용자 결정), 낙관적 비용 재평가(LLM 토큰 0)까지 명기돼 있다. `firstMessage` 메커니즘 폐기 이유도 병기. 새 Rationale 동반 번복으로 연속성이 보존된다.
- 제안: 이슈 없음.

---

### [INFO] `2-sdk §R3` — `off()` 미결정 보류 → 추가 확정, 구 spec 언급과 정합

- target 위치: `2-sdk.md §R3`
- 과거 결정 출처: `2-sdk §R3` 본문("기존 v1 spec 은 `off()` 없이 `on()` 만 두었으나 이는 미결정(단순화 보류) 상태")
- 상세: 기존 "미결정 보류" 상태를 명시하고 SPA 통합 피드백으로 추가한다는 근거가 §R3에 기재됐다. 과거 결정을 번복하면서 새 Rationale(`on()` 반환 해제 함수 + `off()` 표준 DX 정합)을 동봉해 기각 없이 보충 결정으로 연장되었다. 이슈 없음.
- 제안: 이슈 없음.

---

### [INFO] `5-admin-console §R2` — 외형 미저장 결정의 부분 번복 Rationale 명시 완비

- target 위치: `5-admin-console.md §R2`
- 과거 결정 출처: `5-admin-console §R2` 본문("초기 v1 은 외형을 boot 옵션으로 emit-only 하고 백엔드에 저장하지 않았다")
- 상세: 초기 결정(외형 미저장, localStorage-only)이 "복잡도 회피"라는 근거로 채택됐음을 명시하고, 2026-06-24 결정으로 per-instance 서버 저장을 추가한 전말을 담았다. "별도 외형 관리 시스템을 만들지 않는다"는 복잡도 근거는 보존되고 "기존 trigger config 한 필드"만 확장하는 좁은 번복임을 설명한다. `_product-overview §2` 비목표 항목과의 관계도 명시(per-workspace 테마 관리 콘솔은 여전히 백로그).
- 제안: 이슈 없음.

---

### [INFO] `4-security §R5` — `allow-same-origin` 과 `0-architecture §R1` 완전 격리 원칙 간 표면 긴장 해소

- target 위치: `4-security.md §R5`
- 과거 결정 출처: `0-architecture §R1` (iframe 격리 — CSS·JS·전역·storage·쿠키 완전 분리)
- 상세: `sandbox="allow-same-origin"` 이 §R1 완전 격리 선언과 표면적으로 충돌하는 항을 `4-security §R5`가 네 단락 (a)~(d)로 공식 해설한다 — (a) §R1 기준 모델은 cross-origin CDN 배포, (b) 동봉 same-origin 경로에서 `allow-same-origin` 없으면 opaque origin 강등·sessionStorage·postMessage origin 핀이 깨짐, (c) 공급망 무결성(동봉=제품 동일 릴리스)을 전제로 수용, (d) §R5 carve-out 과 동일 근거. 기각이 아닌 구체 조건부 허용으로 invariant 를 우회하지 않는다.
- 제안: 이슈 없음.

---

### [INFO] `3-auth-session §R6` — localStorage → sessionStorage 전환, 구 잔류 항목 처리 명시

- target 위치: `3-auth-session.md §R6`
- 과거 결정 출처: `3-auth-session §R6` 본문 ("구 `localStorage` 잔류 항목" 단락)
- 상세: 이전 버전에서 localStorage 를 쓴 흔적이 남아 있을 수 있다는 점을 §R6 말미에서 언급하고 "무시(별도 마이그레이션·1회 클린업 미수행)"라고 의도를 명시한다. per_execution 단명 토큰이라 보안·기능 영향이 없다는 근거도 기재. 기존 결정을 뒤집은 게 아니라 전환 방침과 이전 흔적의 처리를 명확히 했다.
- 제안: 이슈 없음.

---

### [WARNING] `0-architecture §R2` 와 `5-admin-console §2` — EIA 단일 sink 원칙과 trigger 재사용 원칙의 참조 연결 불균형

- target 위치: `5-admin-console.md §2` ("신규 백엔드 트리거 유형·테이블·엔드포인트·facade 를 추가하지 않는다 ([0-architecture R5](./0-architecture.md)의 client-consumer 원칙 유지)")
- 과거 결정 출처: `0-architecture §R2` ("위젯은 외부 브라우저에서 순수 HTTP 로만 EIA 를 호출하는 client 케이스 … EIA §R10 의 단일 sink·facade 계층에 새 listener 를 추가하지 않는다.")
- 상세: `5-admin-console §2` 에서 참조하는 것이 "R5"(정적 CDN 자산 결정)인데, 실질적으로 주장하는 "facade 미신설·신규 엔티티 없음"의 원 근거는 `0-architecture §R2`(client-consumer 원칙)다. R5 는 정적 CDN 결정이라 약간 엇나간 참조다. 기능적으로는 §R1 의 의도를 따르고 있으나, Rationale 참조 링크가 다른 항을 가리켜 독자가 혼동할 수 있다.
- 제안: `5-admin-console §2` 의 `[0-architecture R5]` 참조를 `[0-architecture §R2]`(또는 R2+R5 병기)로 수정해 신규 엔티티 미신설의 정확한 근거 항을 가리키도록 한다.

---

## 요약

`spec/7-channel-web-chat/` 전 문서는 기존 Rationale 에서 명시적으로 기각된 대안(Shadow DOM 인라인 마운트·`srcdoc` 자가 생성·per_trigger 토큰·동적 서버 렌더링·`off()` 없는 이벤트 API·외형 미저장 등)을 재도입하지 않으며, 합의된 설계 원칙(iframe 완전 격리·EIA 단일 sink·정적 CDN 자산·per_execution 단일 토큰)을 일관되게 따른다. 결정 번복이 있는 경우(eager-start 전환·`off()` 추가·외형 서버 저장)는 모두 새 Rationale 를 동봉해 무근거 번복 없이 처리됐다. `allow-same-origin` 의 완전 격리 원칙 표면 긴장도 `4-security §R5` 가 조건부 허용으로 해소한다. 단 하나의 WARNING 은 `5-admin-console §2` 의 Rationale 참조 링크가 `§R5`(정적 CDN 결정)를 가리키나 실질 근거는 `§R2`(client-consumer 원칙)인 엇나간 참조다 — 설계 위반은 아니나 독자 혼동 가능성이 있어 수정 권장한다.

## 위험도

LOW
