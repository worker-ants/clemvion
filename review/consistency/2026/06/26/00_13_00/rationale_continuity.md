# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/web-chat-snippet-queue-stub.md` (구현 완료 후 검토)
검토 범위: `spec/7-channel-web-chat/2-sdk.md` Rationale + 관련 코드 변경

---

## 발견사항

### INFO: Rationale R5 신설이 코드와 동일 PR 안에서 함께 수행됨 (정상 절차 확인)

- target 위치: `codebase/frontend/src/lib/web-chat/snippet.ts` JSDoc — "spec 2-sdk §1 명령 큐 패턴 / Rationale R5" 참조
- 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md ## Rationale` — R2·R3·R4 까지만 존재, R5 미존재
- 상세: 코드 주석이 "Rationale R5" 를 참조하는데, R5 는 본 PR 의 spec 변경에서 신규 추가됐다. 코드와 spec Rationale 추가가 동일 브랜치 안에서 함께 이루어졌으므로 "Rationale 없이 결정 번복" 에 해당하지 않는다. R5 내용("스니펫의 command-queue 스텁은 필수 전제")은 기존 R2~R4 결정을 번복하지 않으며 신규 불변식을 추가하는 것이다.
- 제안: 특별한 수정 불필요. 이미 올바른 절차를 따름.

### INFO: 기존 §1 스니펫 예시에 큐 스텁이 없었던 것이 "설계 의도"가 아닌 "drift" 임을 Rationale 에 명시 — 적절히 처리됨

- target 위치: `spec/7-channel-web-chat/2-sdk.md §1` (스니펫 예시 수정)
- 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §1` 본문 — 큐 스텁 없는 스니펫 예시
- 상세: 기존 §1 예시에 큐 스텁이 없었던 것은 기각된 대안이 아니라 drift다 (plan 파일의 root cause 분석에서 확인: "example snippet.html 에는 있고, 콘솔 생성 스니펫·spec §1·유저 가이드에는 누락"). 기존 단순 스니펫 형태가 "의도적으로 큐 스텁을 제외한" Rationale 결정이 아님이 확인되고, Rationale R5 신설로 의도가 명문화됐다.
- 제안: 특별한 수정 불필요.

### INFO: `spec/7-channel-web-chat/5-admin-console.md` 스니펫 예시도 동일 브랜치에서 갱신 — SoT 계층 정합

- target 위치: `spec/7-channel-web-chat/5-admin-console.md` 출력 예시
- 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §1` — "출력(SoT: 2-sdk §1)" 로 참조
- 상세: admin-console spec 의 스니펫 예시는 "출력(SoT: 2-sdk §1)" 참조를 이미 명시하고 있고, 이번 변경에서 큐 스텁이 추가됐다. SoT 계층 정합. 기각된 대안의 재도입 없음.
- 제안: 특별한 수정 불필요.

---

## 기각된 대안 재도입 여부

없음. 기존 Rationale(R2~R4)은 스니펫 로더/npm 이원화(R2), SPA 안전 통합(R3), show/hide vs open/close 축 분리(R4)를 다룬다. 이번 변경은 그 어떤 결정도 번복하거나 기각된 대안을 재도입하지 않는다.

## 합의 원칙 위반 여부

없음. `loader.js`(`installGlobal`)가 큐를 replay 하는 기존 구현(`loader.ts:97-105`)은 이미 command-queue 패턴을 전제한다. 스니펫 생성기·spec 예시·유저 가이드가 그 전제에 맞춰 정렬된 것이므로 합의 원칙에 부합한다.

## 암묵적 가정 충돌 여부

없음. `loader.ts` 의 `installGlobal` 은 `existing?.q` 큐를 replay 하는 코드가 이미 존재한다. 큐 스텁 추가는 이 invariant 를 활성화하는 복원이지 충돌이 아니다.

---

## 요약

이번 변경은 `spec/7-channel-web-chat/2-sdk.md` 의 Rationale R5 를 신설하면서 코드(`snippet.ts`)·spec 예시·유저 가이드·admin-console spec 예시를 일관되게 정렬했다. 기존 R2~R4 결정과 충돌하지 않으며, 기각된 대안을 재도입하지 않는다. 코드가 "Rationale R5" 를 참조하는데 해당 R5 가 동일 브랜치 안에서 동시에 추가됐으므로 "Rationale 없는 결정 번복" 에도 해당하지 않는다. Rationale 연속성 관점에서 CRITICAL·WARNING 항목 없음.

---

## 위험도

NONE
