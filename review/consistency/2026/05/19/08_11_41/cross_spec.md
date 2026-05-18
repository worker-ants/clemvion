# Cross-Spec 일관성 검토 — send-email-to-array-only

검토 대상: `plan/in-progress/send-email-to-array-only.md`
검토 모드: `--plan` (plan draft 검토)
검토 시각: 2026-05-19

---

## 발견사항

### [INFO] `§4 step 1` 의 "recipient sum-type" 표현이 정준화 완료 후에도 잔존

- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §4 실행 로직 step 1
- **충돌 대상**: 같은 파일의 §1 설정 표 · §8.1 Rationale · §4 step 2 ("array-only (§8 Rationale)")
- **상세**: step 1 본문이 `validateConfig (recipient sum-type)` 으로 표기되어 있다. 반면 §8.1 Rationale 은 sum-type 을 폐기하고 array-only 로 정준화했음을 선언하며, step 2 도 "array-only (§8 Rationale)" 로 갱신되어 있다. step 1 의 `(recipient sum-type)` 라벨만 옛 표현이 남아있어 동일 문서 안에서 비일관성이 발생한다.
- **제안**: step 1 의 `validateConfig (recipient sum-type)` → `validateConfig (recipient array-only 강제)` 또는 `validateConfig (§8.1)` 로 갱신. 동일 PR 안에서 처리 가능.

---

### [INFO] `validateSendEmailConfig` 반환 오류 문자열 3종의 ko 매핑 부재 — CONVENTIONS 적용 범위 외이나 명시 권장

- **target 위치**: plan §작업 항목 `frontend backend-labels.ts` 항
- **충돌 대상**: `spec/conventions/i18n-userguide.md` Principle 3 — 백엔드 발행 warningCode / 노드 라벨의 frontend 매핑 의무
- **상세**: plan 은 "recipient 에러 메시지는 ko 매핑 자체가 없어 동기화 불필요"라고 단정한다. `WARNING_KO` 에는 warningRule static message `'Recipient (To) must include at least one address.'` 의 매핑(line 356)이 존재한다. 그러나 `validateSendEmailConfig` 가 반환하는 `'to is required and must be a non-empty array of email addresses'` · `'cc must be an array of email addresses'` · `'bcc must be an array of email addresses'` 세 메시지는 WARNING_KO 에 없으며 canvas 검증 오류로 사용자에게 노출된다. Principle 3 의 자동 가드(P1-B) 는 정적 파싱 기반이라 `validateConfig` 반환 문자열은 커버하지 않으므로 규칙 위반으로 강제 차단되지는 않는다. 단, 사용자가 영문 오류 메시지를 그대로 보게 되는 UX 결함이 잠재한다.
- **제안**: 단기적으로 plan 의 판단("동기화 불필요")은 기술적으로 CONVENTIONS 위반 아님. 다만 후속 PR 에서 위 3개 메시지를 `WARNING_KO` 에 추가해 UX 정합성을 확보하도록 follow-up 항목으로 기록 권장.

---

## 확인된 비충돌 영역

| 점검 관점 | 결과 | 근거 |
|---|---|---|
| 데이터 모델 충돌 | 없음 | `Node.config` 는 JSONB — DB 레벨 타입 제약 없음. `to`/`cc`/`bcc` 를 array-only 로 좁혀도 DB schema 충돌 없음. `spec/1-data-model.md` 는 `config JSONB` 로 정의하며 내부 구조를 규정하지 않는다 |
| API 계약 충돌 | 없음 | Send Email 노드 설정은 REST API 의 `Node.config` JSONB 필드로 저장된다. 외부 API endpoint·method·response shape 변화 없음. `data-flow/5-integration.md` 에서 `send_email` 언급은 참조 수준이며 수신자 타입을 명시하지 않는다 |
| 요구사항 ID 충돌 | 없음 | plan 이 새 요구사항 ID 를 부여하지 않으며, 기존 warningRule ID (`send_email:no-recipient` 등) 도 변경 없음 |
| 상태 전이 충돌 | 없음 | 노드 실행 상태 머신 (`pending → running → completed/failed`) 및 D4 결정(handler.validate 실패 = throw, execute 실패 = port error)의 정의가 변경 없음. `spec/5-system/3-error-handling.md` · `spec/5-system/4-execution-engine.md` 와 충돌 없음 |
| 권한·RBAC 모델 충돌 | 없음 | 수신자 타입 정준화는 RBAC/권한 모델에 영향 없음 |
| 계층 책임 충돌 | 없음 | 변경은 backend 노드 handler/schema 와 spec 문서에 국한. frontend 는 `widget: 'field-array'` 를 이미 사용 중 — 추가 widget 변경 불필요. `spec/conventions/i18n-userguide.md` 의 Principle 3 자동 가드(P1-B) 가 커버하는 정적 warningRule 메시지(`'Recipient (To) must include at least one address.'`)의 ko 매핑은 `backend-labels.ts` line 356 에 이미 존재하므로 테스트 실패 없음 |
| node-output CONVENTIONS 충돌 | 없음 | `sendEmailNodeOutputSchema.config.to/cc/bcc` 를 `z.unknown()` → `z.array(z.string())` 로 좁히는 것은 Principle 7 (config echo — raw 보존) 과 정합. raw 자체가 이미 array-only 이므로 echo 도 array-only 가 된다. Principle 0(5-field 불변), Principle 3.2(output.error 구조) 모두 영향 없음 |

---

## 요약

`send-email-to-array-only` plan 은 `to`/`cc`/`bcc` 수신자 필드를 sum-type (`string | string[]`) 에서 array-only (`string[]`) 로 좁히는 내용이며, 데이터 모델·API 계약·RBAC·상태 전이·계층 책임 관점에서 기존 spec 과 충돌하는 항목이 없다. `spec/1-data-model.md` 의 `Node.config JSONB` 정의나 `data-flow/` 참조 문서 어디에도 `to`/`cc`/`bcc` 의 구체적 타입을 명시하지 않으므로 array-only 로 좁혀도 모순이 발생하지 않는다. 발견된 두 건은 모두 INFO 등급으로, 하나는 이미 완료된 spec 수정 내의 잔존 표현(step 1 의 "sum-type" 라벨), 다른 하나는 CONVENTIONS 자동 가드 범위 밖의 UX 개선 권장 사항이다. plan 이 구현 완료 체크리스트를 모두 달성하면 두 항목 모두 단순 편집 수준에서 해소 가능하다.

---

## 위험도

LOW
