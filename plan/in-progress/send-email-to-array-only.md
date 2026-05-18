---
worktree: send-email-to-array-only
started: 2026-05-19
owner: developer
---

# Send Email 수신자 필드 array-only 정준화 (breaking, 스테이징)

## 배경

`spec/4-nodes/4-integration/3-send-email.md` 의 `to/cc/bcc` 는 표 상 `String[] / String` (sum type) 으로 명시되어 있고:

- **zod** `sendEmailNodeConfigSchema` — `to: z.array(z.string()).default([])` (array-only)
- **validator** `validateSendEmailConfig.isRecipientsLike` — `string | string[]` 둘 다 허용 (sum type)
- **handler** `normalizeRecipients` — string (콤마 split) + array (trim+filter) 둘 다 정규화
- **output schema** `sendEmailNodeOutputSchema.config.to` — `z.unknown()` (둘 다 echo 허용)

비대칭의 결과: 사용자 raw 가 single string 이면 zod parse 가 실패하지만 validator 는 통과 가능 — 두 layer 가 서로 다른 진실을 주장.

ai-review W-2 / consistency-check I-2 지적사항. node-config-required-defaults-sweep PR (#188) 의 후속 follow-up.

## 결정 (사용자, 2026-05-19)

② validator 를 array-only 로 좁힘 + **마이그레이션 skip (스테이징)**.

근거:
- 현재 스테이징 단계 — production 데이터에 단일 string 형태 `to` 가 저장된 워크플로우가 무시해도 될 수준
- 두 layer (zod + validator) 가 array-only 로 정렬되어 sum-type 의 진실 분기 해소
- frontend widget 이 이미 `field-array` 라 사용자 입력 경로도 array
- 표현식은 array 원소 단위로 사용 — `["{{ $input.email }}"]` 식

## 작업 항목

> 모든 변경은 **단일 commit** — schema/validator/handler/spec/i18n 동시 정렬이 의미를 가진다 (부분 적용 시 동일한 sum-type 비대칭 재현).

- [x] plan 생성
- [x] `send-email.schema.ts`:
  - `validateSendEmailConfig` / `isRecipientsLike` / `isOptionalRecipientSet` 에서 `typeof string` 경로 제거 — array-only
  - JSDoc 의 "sum type" 표현 → "array-only" 로 갱신 + spec §8.1 참조
  - `sendEmailNodeOutputSchema.config.to/cc/bcc` `z.unknown()` → `z.array(z.string())`
  - 출력 schema JSDoc 의 "either a comma-separated string template or an array" 단락 제거 → array-only 명시
- [x] `send-email.handler.ts`:
  - `normalizeRecipients` 의 `typeof string` 분기 제거 (콤마 split 경로)
  - JSDoc 보강 — defensive `[]` safety net + spec §8.1 참조
- [x] `send-email.schema.spec.ts` — array-only 회귀 + string raw reject 케이스 추가
- [x] `send-email.handler.spec.ts` — `to: string` baseConfig → array, "comma-separated string" / "expression template string" / "rejects empty string" / "allows cc to be absent (empty string)" 등 string raw 케이스 모두 array-only 의미로 갱신
- [x] `spec/4-nodes/4-integration/3-send-email.md`:
  - 표의 `to/cc/bcc` 타입: `String[] / String (표현식)` → `String[] (각 원소 표현식 지원)`
  - §5.1 example 의 `"to": "{{ $input.email }}"` → `"to": ["{{ $input.email }}"]` (§5.1/§5.3/§5.4 모두)
  - §5.1 표의 `config.to/cc/bcc` 행: `string | string[]` → `string[]` + raw 보존 단문
  - §4 실행 로직 step 2 "수신자 정규화" 의 "문자열 → 콤마 split" 분기 제거
  - §Principle 7 echo 단락 갱신
  - **§8 Rationale 신설** — array-only 정준화 결정 + 3개 선택지 비교 + breaking + 스테이징 마이그레이션 skip 근거 + 6 layer 동작 명시
- [x] `frontend backend-labels.ts` — 초기 판단 ("ko 매핑 없어 동기화 불필요") 이후 consistency-check I-2 지적으로 validator 에러 3종 ko 매핑 추가 완료 (i18n Principle 3 양방향 가드 통과)
- [x] 본 sweep plan `node-config-required-defaults-sweep.md` 후속 follow-up 섹션에서 B 항목을 "→ send-email-to-array-only 로 분리" 로 마킹
- [ ] consistency-check 통과
- [ ] tests + lint + typecheck (현 시점: 66 tests pass, lint clean)
- [ ] /ai-review
- [ ] PR + merge
- [ ] `git mv plan/in-progress/send-email-to-array-only.md plan/complete/`

## 관련 문서

- 원 sweep plan: [`node-config-required-defaults-sweep`](./node-config-required-defaults-sweep.md)
- 관련 plan (병행 진행): [`loop-count-policy`](./loop-count-policy.md) (PR #192, 머지 대기)
- ai-review 산출물: `review/code/2026/05/18/23_11_13/SUMMARY.md` W-2
- consistency-check 산출물: `review/consistency/2026/05/18/23_26_44/SUMMARY.md` I-2
