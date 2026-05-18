# Code Review Resolution

PR #199 (send-email-to-array-only) ai-review 후속 조치 결과.

## WARNING 처리

| # | 항목 | 처리 | 위치 |
|---|---|---|---|
| W-1 | legacy DB 레코드 silent 실패 | **FIXED** — `normalizeRecipients` 비-array 입력 시 `Logger.warn` 추가 (NestJS `@nestjs/common` Logger). undefined/null 은 silent, 그 외 비-array (string, number 등) 만 warn. 메시지에 type + spec §8 reference 포함 — 로그로 legacy/bypass 경로 추적 가능 | `send-email.handler.ts` `normalizeRecipients` |
| W-2 | `sendEmailNodeOutputSchema` narrowing 의 DB 이력 파싱 영향 | **NOT APPLICABLE** — grep 확인 결과 `outputSchema` 는 `node-component.registry.ts:78` 에서 `z.toJSONSchema(c.outputSchema)` 로 frontend metadata 생성에만 사용됨. `parse/safeParse` 호출 path 없음 — DB 이력은 별도 path 로 read (raw JSON, schema validation 없음) | `node-component.registry.ts` |
| W-3 | 에러 메시지 변경 외부 영향 | **NOT APPLICABLE** — grep `"non-empty string or array"`, `"string or array of email"` 결과 review/_prompts 안의 review 컨텐츠에만 존재. 코드/테스트/labels 에 구형 메시지 직접 비교 없음 | grep 검증 완료 |
| W-4 | output schema legacy parse 동작 미검증 | **TRACKED** — W-2 가 NOT APPLICABLE 이므로 legacy parse 회귀 테스트 자체가 의미 없음. spec §8.1 layer 표가 storage(zod) layer 의 array-only 명시 |
| W-5 | `validate()` 주석 "cc/bcc sum-type guards" 잔존 | **FIXED** — "cc/bcc array-only guards (2026-05-19 정준화, spec §8.1)" | `send-email.handler.ts:54-58` |
| W-6 | `warningRules` 주석 "sum-type validation" 잔존 | **FIXED** — "Recipient array-only validation (non-empty array of non-empty trimmed strings) ... 2026-05-19 정준화 (spec §8.1)" | `send-email.schema.ts` warningRules 위 주석 |
| W-7 | `node-output-redesign/send-email.md` JSON 예시 단일 string 잔존 | **FIXED** — L13 의 `"to": "{{ $input.email }}"` → `"to": ["{{ $input.email }}"]` | `plan/in-progress/node-output-redesign/send-email.md:13` |
| W-8 | `isOptionalRecipientSet` 암묵적 동작 의도 미명시 | **FIXED** — JSDoc 추가: "비-배열 truthy 도 set 으로 판단해 true 반환. isRecipientsLike 가 다시 reject 하는 패턴 의도" + "직접 호출자 외 단독 사용 시 함수명이 오해를 부를 수 있음" 경고 | `send-email.schema.ts` `isOptionalRecipientSet` JSDoc |
| W-9 | plan 추적성 (backend-labels.ts 항목) | **FIXED** — "ko 매핑 자체가 없어 동기화 불필요" → "초기 판단 이후 consistency-check I-2 지적으로 validator 에러 3종 ko 매핑 추가 완료" | `plan/in-progress/send-email-to-array-only.md` |

## INFO 처리

| # | 항목 | 처리 |
|---|---|---|
| I-1 | 이메일 형식 검증 (`z.string().email()`) | **OUT OF SCOPE** — 표현식 원소 (`{{ ... }}`) 예외 처리 필요. 별 검토 사안 |
| I-2 | `safeMessage` SMTP 마스킹 확인 | **CONFIRMED** — `toLogError(new Error(msg)).message` 가 sanitize. 본 PR 범위 외 |
| I-3 | configEcho 화이트리스트 패턴 유지 | **CONFIRMED** — 현행 적절 |
| I-4 | SSRF 방어 (`disableUrlAccess`) | **CONFIRMED** — `disableFileAccess: true` / `disableUrlAccess: true` 하드코딩 |
| I-5 | bcc string reject 대칭 테스트 | **FIXED** — `send-email.schema.spec.ts` 에 `rejects bcc when set but is a string` + `rejects bcc when set but malformed (array with non-string)` 2 케이스 추가 |
| I-6 | `EMAIL_NO_RECIPIENTS` → `port:'error'` P1 후보 | **TRACKED** — `node-output-redesign/send-email.md` plan 의 기존 follow-up 항목. 본 PR 범위 외 |
| I-7 | `normalizeRecipients` defensive 분기 테스트 | **DEFERRED** — Logger.warn 부수효과 검증은 mock 필요. 본 PR 범위 외 follow-up |
| I-8 | 부분 거부 시나리오 | **TRACKED** — 기존 갭, 본 PR 무관 |
| I-9 | `length(to)` DSL on string fire | **NOT APPLICABLE** — array-only 정준화로 raw string 은 zod 단계 reject. 해당 case 도달 경로 없음 |
| I-10 | cc/bcc string reject 에러 메시지 내용 검증 | **FIXED** — `handler.spec.ts` 의 `rejects cc/bcc when raw is a string` 케이스에 `errors.join(' ').toContain('cc')` / `('bcc')` 추가 |
| I-11 | i18n 키 frontend 테스트 | **OUT OF SCOPE** — frontend 테스트 신설은 별 follow-up |
| I-12 | backend-labels.ts 알파벳 정렬 | **NOT APPLICABLE** — 정식 정렬 정책 없음. 본 PR 의 추가 위치 (validator 메시지 그룹) 유지 |
| I-13 | 테스트 한·영 혼용 | **PARTIALLY ADDRESSED** — 본 PR 신규 분은 한국어 단문 + 영문 it 제목 패턴. 전면 정리는 별 follow-up |
| I-14 | 자유 텍스트 에러 메시지 | **OUT OF SCOPE** — 구조화 (`{code, message}`) 는 장기 개선, 별 follow-up |
| I-15 | CHANGELOG | **NOT APPLICABLE** — 프로젝트 CHANGELOG 관리 정책 없음. spec §8 Rationale + plan 으로 추적성 확보 |

## 후속 추적

- **I-6** EMAIL_NO_RECIPIENTS port:'error' 이동: `node-output-redesign/send-email.md` 의 기존 P1 후보로 등록됨. 별 worktree 처리.
- **I-1** 이메일 형식 z.email() 강화: 표현식 원소 예외 처리 검토 필요. 별 follow-up.
- **I-7** normalizeRecipients defensive Logger 부수효과 테스트: Nest Logger mock 검토 필요. 별 follow-up.
- **W-1 후속**: production 에 legacy string 데이터 없음 확인 시 Logger.warn → throw 로 tightening 가능 (주석에 명시됨).

## 테스트 결과 (후속 fix 적용 후)

- `nodes/integration/send-email` 전체 테스트 통과
- **68 tests pass** (이전 66 → +2: I-5 의 bcc string + bcc malformed 대칭 케이스)

## e2e

본 변경은 schema·validator·handler·spec·테스트·i18n·plan 변경. 외부 SMTP 전송 동작에는 영향 없음 (수신자 array → string[] 변환 path 가 동일). spec §8.1 의 layer 표 (frontend → storage → validator → handler → output → 표현식) 가 명시.

PROJECT.md e2e 면제 화이트리스트 적용 가능 여부는 사용자 확인 영역. 본 변경은 사용자 가시 동작에 (raw 입력 형식 reject 외) 영향이 없으며, 그 reject 도 frontend widget 이 이미 array 라 정상 경로 영향 없음.
