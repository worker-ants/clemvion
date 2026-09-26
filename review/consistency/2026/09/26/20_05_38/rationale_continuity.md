# Rationale 연속성 검토 — request-body-guard

## 검토 범위

- target: `spec/conventions/swagger.md` §5-4 체크리스트 신설 항목("요청 본문을 받는 라우트는 본문 스키마를 광고한다") + 동 문서 `## Rationale` 신설 절("§5-4 요청 본문 스키마 — 왜 클래스로 받게 강제하지 않고, 왜 reflection 으로 세는가", 2026-09-26)
- 구현 diff: `common/pipes/validation.pipe.ts`(`UNVALIDATED_METATYPES` export) · `repo-guards/__tests__/request-body-advertised{-guard,}.ts`(신규 가드) · `shared/testing/swagger-probe.ts`(`bodyArgIndexes` 신설)
- 대조 대상: 같은 문서 기존 `## Rationale` 전 항목(§1-4/§1-6/§1-7/§3/§5/§5-4 403코드/§2-4), `spec/5-system/2-api-convention.md`·`3-error-handling.md`·`15-chat-channel.md`(R-CC-10/18/21)·`0-overview.md`·`1-data-model.md` 의 `## Rationale`, 그리고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커 원문(가드의 최초 제안 형태)

## 발견사항

- **[INFO] 소급 적용 여부를 이 절만으로는 판단할 수 없음 — 인접 절과 비대칭**
  - target 위치: `spec/conventions/swagger.md` `## Rationale` → "§5-4 요청 본문 스키마 — 왜 클래스로 받게 강제하지 않고, 왜 reflection 으로 세는가"
  - 과거 결정 출처: 같은 문서 Rationale의 "§1-4 닫힌 union…"/"§3 DTO 길이는 왜 강제가 아닌가"(**신규 변경에만 적용, 소급 정리 대상 아님**을 명시) vs 바로 위 "§5-4 403 설명의 거부 코드"(**"기존 라우트까지 소급한다"**를 별도 문장으로 명시)
  - 상세: `request-body-advertised` 가드는 베이스라인 0으로 `src/modules` 전 라우트(78개 `@Body()` 자리)를 즉시 검사하므로 실질적으로 **기존 라우트까지 소급 적용**하고 있다(§2-4·403-코드 가드와 동일 범주 — "광고가 실제와 맞는가"). 그러나 해당 신설 Rationale 절 본문에는 §2-4·403-코드 절이 각각 명시한 "왜 §1-4/§3 의 '신규 변경 한정' 원칙과 달리 이 규칙은 소급하는가"라는 문장이 없다. 결과 자체(베이스라인 0·전수 스캔)는 모순되지 않지만, 이 문서만 읽는 다음 사람이 "왜 이 규칙은 §1-4/§3 처럼 신규 한정이 아닌가"를 스스로 재구성해야 한다.
  - 제안: §5-4 403코드 절의 마지막 항목("기존 라우트까지 소급한다…")과 동형인 한 문장을 request-body 절에 추가 — 비차단, 다음 편집 시 반영 권장.

## 결정 이력 검증 (기각된 대안 재도입 여부)

- **가드 판정 방식: AST → reflection.** 트래커 원안(`plan/in-progress/spec-draft-nullable-notation-followups.md` 5150행)은 "가드(developer): **AST** — `@Body()` 파라미터 타입이 클래스 참조가 아니면 같은 메서드에 `@ApiBody` 가 있어야 한다"였다. 실제 구현(`request-body-guard.md` 방향 절, swagger.md 신설 Rationale)은 **reflection** 으로 번복했다. 이 번복은 무근거가 아니다 — "`interface`·타입 별칭 참조는 런타임에 `Object` 가 되어 AST 로는 클래스 참조와 구별할 수 없다"는 새 근거가 계획 단계(`--impl-prep` INFO "AST→reflection 정정")와 최종 Rationale 본문 양쪽에 명시돼 있다. 기준(3. 결정의 무근거 번복) 위반 아님 — 오히려 번복+근거 명시의 정상 사례.
- **"요청 DTO 승격"(클래스로 강제) 기각.** target Rationale 은 "트래커가 처음 적었던 처방(«요청 DTO 승격»)을 택하지 않는다"고 명시하며, 그 근거(전역 `CustomValidationPipe` 가 클래스 파라미터에만 진입해 `whitelist`/`forbidNonWhitelisted` 를 켜 계약이 바뀐다 — `rotate-bot-token` 이 `INVALID_BOT_TOKEN` 대신 `VALIDATION_ERROR` 를 내게 됨)를 구체적으로 든다. 이는 `15-chat-channel.md` R-CC-18(rotate-bot-token 의 canonical 에러 코드 계약)과 R-CC-21(PATCH 비밀 처리의 계약 민감성)이 세운 "이 엔드포인트의 에러 코드 계약은 함부로 바꾸지 않는다"는 취지와 **정합**한다 — 새 가드가 그 계약을 건드리지 않기 위해 일부러 클래스 승격을 피했다는 점에서 기존 결정을 존중하는 방향.
- **naming(`<Domain><Action>RequestDto`) 규칙은 이번 PR 범위에서 의도적으로 보류.** 트래커 원안 1항은 "문서 전용(비검증) top-level 요청 DTO" 명명 규칙(§1-7 표 행)도 포함했으나, `request-body-guard.md` 계획 단계에서 "3의 DTO 어순 리네임과 1의 §1-7 명명 행은 남긴다"고 명시적으로 범위를 좁혔다. target 의 §5-4 체크리스트·Rationale 은 실제로 이 명명 규칙을 도입하지 않았다 — 계획과 결과가 일치하며, 트래커에도 잔여 항목으로 남아 있어 "합의를 무시하고 조용히 빠뜨린 것"이 아니다.

## 설계 원칙 위반 여부

- **SoT 중복 회피 원칙과 정합.** `UNVALIDATED_METATYPES` 를 `validation.pipe.ts` 에서 export 하고 가드가 그 상수를 그대로 import 하는 구조는, 이 프로젝트가 반복해서 강조하는 "판정 축은 실제로 동작을 가르는 그 값이어야 한다"는 원칙(§5-4 403코드 절의 `lowestRequiredRole` 공유 함수, R-CC-22 의 "글로브를 옮겨 적지 않고 정본 매처를 그대로 쓴다")과 동형이며 이를 위반하지 않는다.
- **reflection 기반 가드 패턴과 정합.** 같은 문서 §2-4(광고한 성공 코드)·§5-4 403코드 절이 이미 "이름→코드 표를 손으로 쓰지 않는다", "reflection 으로 센다"는 원칙을 확립해 두었고, 신설 가드는 그 패턴을 그대로 재사용한다. `api-convention.md` §5.4 "검증 층" 표(swagger-dto-contract-guard 등, AST 정적 검증)와는 대상(요청 vs 응답 null/키생략)이 달라 그 표의 AST 원칙과 충돌하지 않는다 — 같은 문서 내 다른 절 번호 우연 일치일 뿐.

## 요약

target 이 도입한 "요청 본문 스키마 광고 강제" 규칙과 이를 뒷받침하는 신설 Rationale 은, 실제 작업 이력(`plan/in-progress/request-body-guard.md`·`spec-draft-nullable-notation-followups.md`·연속 3회 consistency-check·2회 code-review)으로 뒷받침되는 진짜 결정 과정을 담고 있으며, 트래커 원안 대비 판정 방식(AST→reflection)을 번복한 지점에는 구체적 반증 근거가 함께 적혀 있다. 기존 spec(`15-chat-channel.md` R-CC-18/21, `swagger.md` 자체의 §1-4/§1-6/§1-7/§3/§5/§2-4/403코드 Rationale)이 세워 둔 원칙·계약과 충돌하는 지점은 발견되지 않았고, 오히려 rotate-bot-token 의 기존 에러 코드 계약을 보존하기 위해 "클래스 승격"이라는 더 侵襲적인 대안을 의도적으로 피한 점에서 기존 결정과 정합적이다. 유일한 지적은 인접한 §2-4/403코드 Rationale 이 각각 명시한 "왜 이 규칙은 §1-4/§3 의 신규-한정 원칙과 달리 소급되는가"라는 대칭 문장이 이번 절에는 빠져 있다는 서술상의 비대칭으로, 차단 사유가 아닌 INFO 수준 보완 제안이다.

## 위험도
NONE
