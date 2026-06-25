# Rationale 연속성 검토 결과

검토 모드: --impl-prep  
Target: `plan/in-progress/web-chat-snippet-queue-stub.md`  
관련 Spec Rationale: `spec/7-channel-web-chat/2-sdk.md ## Rationale`, `spec/7-channel-web-chat/0-architecture.md ## Rationale`

---

### 발견사항

기각된 대안 재도입, 합의 원칙 위반, 결정의 무근거 번복에 해당하는 항목이 없다.

아래는 부합 확인 항목이다.

**[INFO] 큐 스텁 패턴은 spec §1.4 합의 설계와 완전 정합**
- target 위치: plan 문서 "Root cause" 및 "수정" 섹션 전체
- 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §1` 산문 — "단일 전역 진입점 + 명령 큐 패턴", "loader.js 책임: … 명령 큐(boot 전 호출 버퍼링)"
- 상세: plan 이 채택하는 command-queue 스텁(`window.ClemvionChat=window.ClemvionChat||function(){...}`)은 spec §1 이 이미 명시한 설계다. example `snippet.html` 이 reference 구현으로 스텁을 포함하고, loader 의 `.q` replay 경로(`loader.ts:97-105`)도 기존 코드다. plan 은 스니펫 생성 함수·spec 예시·유저 가이드 문서가 이 설계를 따르지 않는 drift 를 수정하는 것이므로 Rationale 역행이 아니라 Rationale 복원이다.
- 제안: 변경 불필요. 수정 완료 후 spec §1 스니펫 예시에 큐 스텁이 포함됨을 확인하면 충분.

**[INFO] async 로더 + 동기 스텁 조합은 기각된 대안을 채택하는 것이 아님**
- target 위치: plan "수정" — "로더 IIFE 안, 로더 script 생성 전에 삽입(동기 정의)"
- 과거 결정 출처: `spec/7-channel-web-chat/0-architecture.md R1` — iframe 격리 채택 근거; `2-sdk.md §1` — async loader + queue pattern
- 상세: 과거 Rationale 어디에도 "async 로더 script 를 동기 로드로 전환" 또는 "defer 사용"을 채택·기각한 항목이 없다. plan 의 수정 방향(스텁을 동기로 삽입해 loader async 를 유지)은 spec §1 의 queue 패턴 의도와 일치하고, async 를 제거하거나 defer 로 교체하는 기각된 대안을 재도입하지 않는다.
- 제안: 변경 불필요.

**[INFO] spec §1 예시 수정 시 Rationale 보강 권고**
- target 위치: plan "수정 2번" — "spec/7-channel-web-chat/2-sdk.md §1 스니펫 예시 — 스텁 추가 + (필요시) Rationale 보강(왜 스텁 필수)"
- 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md ## Rationale` — R2, R3 (async loader 이유 미명시)
- 상세: spec §1 의 스니펫 예시가 큐 스텁 없이 작성된 것은 drift 이며 Rationale 에 별도 기각 사유가 없다. spec 수정 시 "왜 스텁이 필수인가" 항을 Rationale 에 명시하면 향후 동일 drift 재발을 예방한다.
- 제안: `spec/7-channel-web-chat/2-sdk.md ## Rationale` 에 신규 항 추가. 내용 골자: "async loader 는 DOMContentLoaded 를 차단하지 않아야 하므로 sync 로드로 전환하는 대안은 기각. 큐 스텁을 동기 선행 설치함으로써 boot 전 호출을 안전하게 버퍼링하며, 이것이 command-queue 패턴의 필수 전제조건이다." (plan 이 "(필요시) Rationale 보강" 으로 이미 인지한 내용이므로 수행 의지가 있음 — INFO 레벨 확인).

---

### 요약

`plan/in-progress/web-chat-snippet-queue-stub.md` 의 수정 방향은 `spec/7-channel-web-chat/2-sdk.md` Rationale 및 본문이 이미 합의한 command-queue 패턴(§1 명령 큐 버퍼링, loader replay)을 코드와 문서에 일관되게 복원하는 작업이다. 기각된 대안(동기 로더, defer, Shadow DOM 등)을 재도입하는 요소가 없고, 합의된 설계 불변식을 우회하는 요소도 없다. plan 자체가 "(필요시) Rationale 보강" 을 명시해 결정 번복 시 Rationale 갱신 원칙을 선제 인식하고 있다. 전체적으로 Rationale 연속성 관점에서 위험 없음.

### 위험도

NONE
