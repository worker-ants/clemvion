# 신규 식별자 충돌 Check — send-email-to-array-only

검토 대상: `plan/in-progress/send-email-to-array-only.md`
검토 모드: plan draft (--plan)
검토 일시: 2026-05-19

---

### 발견사항

- **[INFO]** `§8.1` 섹션 번호 참조 vs. spec 실제 구조
  - target 신규 식별자: plan 내 JSDoc/코드 주석에서 `spec §8.1` 로 참조
  - 기존 사용처: `spec/4-nodes/4-integration/3-send-email.md` 내 기존 섹션들 (`§5.1`~`§5.8`, `§6`, `§7`)
  - 상세: plan 의 작업 항목(schema.ts / handler.ts / spec 주석)은 `spec §8.1` 을 참조하도록 명시되어 있다. 실제 spec 파일을 확인한 결과 `## 8. Rationale` / `### 8.1 \`to\`/\`cc\`/\`bcc\` array-only 정준화 (2026-05-19)` 가 신설되어 있으며, 코드 주석(`send-email.schema.ts`, `send-email.handler.spec.ts`, `send-email.schema.spec.ts`)도 이미 `§8.1` 또는 `§8 Rationale` 로 일관되게 정렬되어 있다. 번호 충돌은 없다. 다만 `§5.8` 이 `### 5.8 (D4 — 2026-05-17)` 로 기존에 이미 존재하므로 스캔 범위에서 확인: §5.8 과 §8.1 은 별개 섹션이라 겹치지 않는다.
  - 제안: 충돌 없음. 현재 naming 유지.

- **[INFO]** `isRecipientsLike` / `isOptionalRecipientSet` 함수명 — 내부 전용 식별자 유지
  - target 신규 식별자: plan 이 "sum-type 경로 제거" 를 지시한 두 함수명. 제거 후에도 함수 자체는 `send-email.schema.ts` 에 `array-only` 의미로 **재정의되어 존속**한다.
  - 기존 사용처: `send-email.schema.ts` (정의), `send-email.handler.ts` (코멘트에 "removed from this file" 명시), `send-email.schema.spec.ts` (간접 사용 없음 — `validateSendEmailConfig` 를 통해서만 접근)
  - 상세: 두 함수는 모듈 외부로 export 되지 않으며, 다른 노드 모듈이나 frontend 코드에서 직접 참조하는 사용처가 없다. 함수명 자체는 기존과 동일하게 유지되고 내부 구현만 array-only 로 변경되므로 외부 식별자 충돌 가능성 없음.
  - 제안: 충돌 없음. 내부 리팩토링이므로 별도 조치 불필요.

- **[INFO]** `send_email:no-recipient` warningRule ID — 의미 확장 주의
  - target 신규 식별자: plan 이 `validateSendEmailConfig` 의 `to` 검사를 string → array-only 로 좁히면서 동일한 warningRule ID `send_email:no-recipient` 를 유지
  - 기존 사용처: `send-email.schema.ts:283`, `send-email.schema.spec.ts:23,178–189`, `send-email.schema.spec.ts:234` — "rejects to when raw is a string" 케이스가 이 ID 하에서 실행됨
  - 상세: 기존에는 `to` 가 없거나 빈 배열일 때만 `send_email:no-recipient` 가 발화됐다. 이번 변경 후에는 `to: "a@example.com"` (raw string) 도 이 경로를 통해 reject 된다. warningRule ID 의 이름(`no-recipient`)은 "수신자 없음" 을 의미하는데, raw string reject 는 "형식 불일치" 에 가깝다. 의미 범위가 살짝 넓어지지만 사용자가 보는 에러 메시지(`"Recipient (To) must include at least one address."`)가 string 케이스에서도 맥락상 이해 가능한 수준이며, frontend `backend-labels.ts:356` 번역도 "수신자 (To) 를 한 명 이상 입력해야 합니다." 로 유지되고 있다. 기존 rule ID 와 메시지가 동일하게 재사용되므로 식별자 충돌은 없으나, string reject 케이스의 에러 메시지가 최적이 아닐 수 있다는 점에서 INFO 등급.
  - 제안: 현재 상태로 큰 문제는 없다. 향후 더 정확한 피드백이 필요하다면 `send_email:invalid-recipient-type` 를 별도 추가하는 것을 검토할 수 있으나, 현 스테이징 단계에서는 현행 유지가 적절하다.

- **[INFO]** `loop-count-policy` plan 참조 — dangling reference
  - target 신규 식별자: plan 의 "관련 문서" 섹션이 `loop-count-policy.md` (PR #192, 머지 대기) 를 링크
  - 기존 사용처: `plan/in-progress/` 에 `loop-count-policy.md` 가 존재하지 않음. `plan/complete/` 에도 없음.
  - 상세: 해당 plan 이 다른 worktree 에서만 존재하거나 이미 완료·아카이브됐을 가능성이 있다. 식별자 의미 충돌은 없으나 링크가 유효하지 않아 추적성이 손상된다.
  - 제안: PR #192 머지 후 `loop-count-policy.md` 가 `plan/complete/` 로 이동되면 링크를 갱신하거나 제거한다. 현재 단계에서는 "(PR #192, 머지 대기 — 별 worktree)" 식으로 주석을 보완하면 충분하다.

---

### 요약

`send-email-to-array-only` plan 이 도입하는 신규 식별자(`§8.1` 섹션, `isRecipientsLike` / `isOptionalRecipientSet` 함수, `sendEmailNodeOutputSchema`, `send_email:no-*` warningRule ID 등)는 모두 `send-email` 모듈 내에서만 사용되며, 다른 노드 모듈, frontend, spec 영역과 이름 충돌이 발견되지 않았다. spec 섹션 번호 `§8.1` 은 신설이고 기존 `§5.1`~`§5.8`·`§6`·`§7` 과 겹치지 않는다. `send_email:no-recipient` warningRule ID 는 의미 범위가 소폭 확장되지만 외부 충돌은 아니며 사용자 가시 에러 메시지도 허용 가능 수준이다. `loop-count-policy.md` 링크는 dangling 상태이나 식별자 충돌이 아닌 참조 정합성 이슈다.

### 위험도

LOW
