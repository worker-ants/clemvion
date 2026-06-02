# Rationale 연속성 검토 결과

**검토 대상**: `spec/7-channel-web-chat/2-sdk.md`
**검토 일시**: 2026-06-02
**검토 모드**: spec draft (--spec)

---

## 발견사항

### [INFO] R2 Rationale 번호 체계 — R1 미존재
- target 위치: `spec/7-channel-web-chat/2-sdk.md §Rationale` — 섹션이 `R2`, `R3` 로 시작하고 `R1` 이 없음
- 과거 결정 출처: `spec/7-channel-web-chat/0-architecture.md §Rationale` — `R1`(iframe 격리), `R5`(client consumer), `R6`(신규 영역), `R7`(단일 iframe), `R8`(정적 CDN)
- 상세: 2-sdk.md 의 Rationale 은 R2, R3 로 시작하는데 R1 이 없다. 0-architecture 에서 R1~R8 번호를 이미 사용하고 있으므로, 2-sdk.md 의 R2/R3 가 문서 로컬 번호체계인지 영역 공유 번호체계인지 불명확하다. 두 doc 이 같은 번호 공간을 쓴다면 R2/R3 충돌은 없으나 R1 gap 이 의도된 것인지 해석 불가.
- 제안: 2-sdk.md Rationale 번호 앞에 문서 prefix (`SDK-R2` / `SDK-R3`) 를 붙이거나, 혹은 R1 생략 이유를 짧은 주석으로 남긴다. 현재 상태로도 기능상 문제는 없으나 다음 Rationale 추가자가 번호 충돌을 겪을 수 있다.

### [INFO] postMessage 프로토콜 설계 Rationale 부재
- target 위치: `spec/7-channel-web-chat/2-sdk.md §3` — `wc:` namespace prefix 채택, 양방향 origin 검증, `wc:resize` host 처리 필수
- 과거 결정 출처: 해당 결정 근거를 다루는 Rationale 항목이 2-sdk.md 와 0-architecture.md 어디에도 없음
- 상세: `wc:` prefix 선택 이유(타 채널·OAuth popup 과의 혼용 방지 언급은 본문에 있으나 Rationale 로 정리되지 않음), origin 화이트리스트 방식 채택 사유, `wc:resize` 를 host 의무로 지정한 사유가 Rationale 에 기록되지 않았다. 특히 resize 처리를 host 의무로 지정한 이유는 구현 시 누락되기 쉬운 contract 이다.
- 제안: 2-sdk.md `## Rationale` 에 `R-postMessage` 또는 `R4` 항목을 추가해 wc: prefix 선택 이유, origin 검증 필수 이유, resize host 의무 이유를 기술한다.

### [INFO] BootConfig appearance 현 phase 제한 근거 미기재
- target 위치: `spec/7-channel-web-chat/2-sdk.md §4` — `appearance?: { primaryColor?, position?, zIndex? }  // 색·위치만(현 phase)`
- 과거 결정 출처: 해당 제한 결정 근거를 다루는 Rationale 없음
- 상세: appearance 를 색·위치·zIndex 만으로 제한하고 폰트·패딩·border-radius 등 추가 외형 옵션을 현 phase 비목표로 둔 근거가 없다. 구현 단계에서 임의로 필드를 추가/제거할 여지가 생긴다.
- 제안: Rationale 에 appearance 현 phase 제한 이유(구현 복잡도, 호스트 CSS 충돌 회피 전략 등)를 간략히 기술한다.

---

## 요약

target 문서(`spec/7-channel-web-chat/2-sdk.md`)는 기존 spec 들의 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하는 항목이 없다. iframe 격리 채택·Shadow DOM 기각(0-architecture R1), per_execution 단일 토큰·per_trigger 배제(3-auth-session R3, EIA R4), npm-only/snippet-only 기각(2-sdk R2), 단일 코어 공유, EIA R10 facade 원칙 준수 등 기존 결정들과 정합이 모두 확인된다. 발견된 항목 3건은 모두 INFO 수준으로, 기각된 결정의 재도입이나 invariant 위반이 아니라 Rationale 기록이 부재하거나 번호 체계가 불명확한 관리상 gap 이다.

## 위험도

LOW
