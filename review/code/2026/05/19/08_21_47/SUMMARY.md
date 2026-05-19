# Code Review 통합 보고서

세션: `review/code/2026/05/19/08_21_47`
대상: `origin/main..HEAD` (send-email-to-array-only PR #199)

## 전체 위험도

**MEDIUM** — `to/cc/bcc` 필드를 array-only 로 정준화하는 breaking change. 검증 레이어 정합성 확보 방향은 올바르나, legacy DB 레코드의 silent 실패 경로와 output schema 타입 narrowing 의 이력 파싱 영향을 본 PR 안에서 명시·완화함.

## Critical 발견사항

없음.

## 경고 (WARNING) — 9건

| # | 카테고리 | 발견사항 | 처리 |
|---|----------|----------|------|
| W-1 | Side Effect / API Contract | legacy DB 레코드(string `to`) silent 실패 경로 | **FIXED** — `normalizeRecipients` 비-array 입력 시 `Logger.warn` 추가 (NestJS `@nestjs/common` Logger) — 관찰 가능성 확보 |
| W-2 | Side Effect | `sendEmailNodeOutputSchema` narrowing 의 DB 이력 파싱 영향 | **NOT APPLICABLE** — grep 확인 결과 `outputSchema` 는 `node-component.registry.ts:78` 에서 `z.toJSONSchema` 로 frontend metadata 생성에만 사용. DB 이력 파싱에 `parse/safeParse` 호출 없음 |
| W-3 | Side Effect | 에러 메시지 변경의 외부 영향 | **NOT APPLICABLE** — grep 결과 구형 메시지(`"non-empty string or array..."` / `"string or array of email..."`) 는 review 자체 컨텐츠에만 존재. 코드/테스트/labels 에 직접 비교 없음 |
| W-4 | Testing | output schema legacy parse 동작 미검증 | TRACKED — W-2 NOT APPLICABLE 이므로 회귀 테스트 불필요. spec §8.1 의 layer 표가 의도 명시 |
| W-5 | Documentation | `handler.validate()` 주석의 "sum-type guards" 잔존 | **FIXED** — "array-only guards (2026-05-19 정준화, spec §8.1)" 로 갱신 |
| W-6 | Documentation | `warningRules` 위 주석의 "sum-type validation" 잔존 | **FIXED** — "array-only validation ... 2026-05-19 정준화 (spec §8.1)" 로 갱신 |
| W-7 | Documentation | `node-output-redesign/send-email.md` JSON 예시 단일 string 잔존 | **FIXED** — `"to": ["{{ $input.email }}"]` 로 갱신 |
| W-8 | Architecture | `isOptionalRecipientSet` 의 암묵적 동작 의도 미명시 | **FIXED** — JSDoc 추가 ("set-but-invalid 로 간주하고 isRecipientsLike 에 위임") |
| W-9 | Scope | plan 추적성 (backend-labels.ts 항목 갱신) | **FIXED** — plan "ko 매핑 자체가 없어 동기화 불필요" → "I-2 지적으로 3건 추가 완료" 로 갱신 |

## 참고 (INFO) — 15건

- I-1~I-4 (Security): 이메일 형식 검증, safeMessage 마스킹, SSRF 등 — 기존 방어 확인됨, 본 PR 범위 외
- **I-5** (Requirement/Testing): bcc string reject 대칭 테스트 — **FIXED** (schema.spec.ts 2 케이스 추가)
- I-6 (Requirement): `EMAIL_NO_RECIPIENTS` P1 후보 — node-output-redesign plan 의 별 follow-up
- I-7 (Testing): `normalizeRecipients` defensive 분기 테스트 — Logger 부수효과 검증은 mock 필요, 본 PR 보류
- I-8 (Testing): 부분 거부 시나리오 — 기존 갭, 별 follow-up
- I-9 (Testing): `length(to)` DSL on string — array-only 정준화로 string raw 가 zod 단계에서 reject, 해당 케이스 도달 불가
- **I-10** (Testing): cc/bcc 에러 메시지 내용 검증 — **FIXED** (handler.spec.ts 강화)
- I-11 (Testing): i18n 키 frontend 테스트 — 별 follow-up
- I-12 (Maintainability): backend-labels.ts 정렬 — 알파벳 정렬 정책 명문화 없음, 본 PR 위치 유지
- I-13 (Maintainability): 테스트 한·영 혼용 — 본 PR 신규 분은 영문 통일
- I-14 (API Contract): 자유 텍스트 에러 메시지 — 장기 개선
- I-15 (Documentation): CHANGELOG — spec §8.1 + plan 으로 추적성 확보

상세는 `RESOLUTION.md` 참고.

## 라우터 결정

router 가 9명 선별 실행.

- **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (9명)
- **제외**: performance, dependency, database, concurrency (4명)

| 제외된 reviewer | 이유 |
|---|---|
| performance | 배열 처리 로직 단순화 — 성능 영향 없음 |
| dependency | package.json/lock 변경 없음 |
| database | DB 마이그레이션/쿼리 변경 없음 (schema validation 단계만) |
| concurrency | async/Promise/락 변경 없음 (동기 helper) |

## 에이전트별 위험도

| reviewer | 위험도 | 핵심 |
|---|---|---|
| security | LOW | 이메일 형식 검증 부재(INFO), 기존 방어 확인 |
| architecture | LOW | W-8 fix 완료, 4-layer 계약 정렬 |
| requirement | LOW | W-5/W-6 fix, I-5 fix |
| scope | LOW | W-9 fix, 나머지 plan 범위 내 |
| side_effect | MEDIUM | W-1 fix, W-2/W-3 NOT APPLICABLE 확인 |
| maintainability | LOW | INFO 5건, 본 PR 범위 외 |
| testing | LOW | I-5/I-10 fix, 나머지 follow-up |
| documentation | LOW | W-5/W-6/W-7 fix |
| api_contract | MEDIUM | W-1 fix, 자유 텍스트 에러 메시지(I-14) 장기 개선 |

## 본 PR 처리 결과

- WARNING 9건 → 6건 즉시 fix, 2건 NOT APPLICABLE (W-2/W-3 영향 없음 확인), 1건 TRACKED (W-4)
- INFO 15건 → 2건 즉시 fix (I-5/I-10), 13건 follow-up 추적 또는 범위 외
- 테스트: 66 → 68 pass (+2)
