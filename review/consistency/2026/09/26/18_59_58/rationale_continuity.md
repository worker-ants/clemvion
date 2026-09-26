# Rationale 연속성 검토 — spec-draft-swagger-request-body.md

## 검토 범위와 방법

- target: `plan/in-progress/spec-draft-swagger-request-body.md` (spec draft, `--spec` 모드)
- 대조 대상 SoT: `spec/conventions/swagger.md`(`## Rationale` 전문, 740줄까지 직접 열람) — target 이 실제로 절을 추가하려는
  그 문서. **`_prompts` 번들에는 이 파일이 빠져 있었다**(아래 발견사항 참고) — swagger.md 는 `spec/conventions/**` 이고,
  기존에 알려진 `--spec` 모드 예산 문제(`related_specs` 청크가 conventions 폴더를 통째로 떨어뜨리는 현상)와 일치한다.
  이 리포트는 그 갭을 filesystem 직접 열람으로 메웠다.
- 보조로 `plan/in-progress/request-body-guard.md`(구현 plan), `plan/in-progress/spec-draft-nullable-notation-followups.md`
  의 해당 트래커 항목(«요청 본문 스키마의 규칙과 가드», line 5141 부근), 실제 코드
  (`chat-channel-rotate-bot-token-request.dto.ts` · `execute-workflow.dto.ts` · `hooks.controller.ts`)를 대조해 target 이
  인용하는 "선례"·"실측" 주장이 실제 이력에 근거하는지 확인했다.

## 발견사항

- **[INFO]** `--spec` 번들이 swagger.md 자기 자신의 `## Rationale` 을 놓쳤다
  - target 위치: 없음(입력 파이프라인 이슈)
  - 과거 결정 출처: `.claude/docs/` 의 알려진 결함 — consistency `--spec` 예산이 `spec/conventions/**` 를 통째로 떨어뜨리는 현상(사용자 메모리에도 기록됨)
  - 상세: 이번 target 문서는 `spec/conventions/swagger.md` 에 새 체크리스트 줄·frontmatter `code:` 항목·`## Rationale` 신규 절을 추가하는 것인데, 정작 그 swagger.md 의 기존 Rationale 이 `_prompts/rationale_continuity.md` 번들(`spec/5-system/*`, `spec/0-overview.md`, `spec/1-data-model.md` 등 무관 spec들의 Rationale 은 대량으로 실려 있음)에는 포함되지 않았다. Rationale 연속성 checker 입장에서는 가장 필요한 대조군이 빠진 상태로 호출된 셈이다.
  - 제안: `--spec` 번들링 로직이 `spec_impact:` 에 명시된 파일 자체의 `## Rationale` 은 무조건 포함하도록(예산과 무관하게 우선순위 최상단 고정) 개선을 트래커에 등재. 이번 리포트는 실제 파일을 직접 읽어 내용을 대조했으므로 결론 자체는 이 갭의 영향을 받지 않았다.

- **[INFO]** 가드 설계축(AST → reflection) 전환이 tracker 원문에 소급 반영되지 않음
  - target 위치: `plan/in-progress/spec-draft-swagger-request-body.md` §3 새 Rationale 절 "reflection 으로 센다" 단락
  - 과거 결정 출처: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 트래커 항목(«요청 본문 스키마의 규칙과 가드», 2026-09-26 등재)
    — 원문이 "2. **가드(developer)**: **AST** — `@Body()` 파라미터 타입이 클래스 참조가 아니면 …" 라고 명시
  - 상세: target 과 구현 plan(`request-body-guard.md`)은 AST 대신 **reflection**(`design:paramtypes`)을 판정 축으로 채택하며 "소스(AST)로는 interface·타입 별칭 참조가 런타임에 Object 가 되는 것을 클래스 참조와 구별할 수 없다" 는 근거를 명확히 남겼다 — 이는 **무근거 번복이 아니다**(criterion 3 통과, 새 Rationale 동반). 다만 그 전환이 일어난 원본 트래커 항목의 "AST" 문구 자체는 취소선 처리나 정정 각주 없이 그대로 남아 있어, 이 항목만 따로 다시 읽는 사람에게는 "AST 로 결정됐다"는 낡은 신호가 남는다.
  - 제안: 이 plan 을 닫는(체크리스트 "트래커 항목 좁히기") 시점에 트래커 5141행의 "AST" 를 취소선 처리하고 "reflection(사유: 위 draft/plan 참조)"로 정정 각주를 남긴다 — plan hygiene 문제이지 spec Rationale 위반은 아니다.

- **[INFO]** `@ApiBody({ schema: {} })` 예외가 §1-4/§6 의 "빈 껍데기 금지" 정신과 나란히 놓일 때 근거 연결이 없다
  - target 위치: `plan/in-progress/spec-draft-swagger-request-body.md` §1 체크리스트 신규 줄 — "형태를 발신자가 정하는 본문(외부 웹훅)은 `@ApiBody({ schema: {} })`"
  - 과거 결정 출처: `spec/conventions/swagger.md` §1-4 "열린/동적 map"(`additionalProperties: true` 권고) 및 §6 "레거시 패턴 제거"("빈 껍데기 는 반드시 DTO 기반 래퍼로 교체")
  - 상세: 이미 구현된 `hooks.controller.ts` 의 `receiveWebhook` 이 `@ApiBody({ schema: {} })` + 인라인 주석("본문 형태는 외부 발신자가 정한다(WH-EP-04·WH-EP-05 — JSON·form-urlencoded, 객체가 아닐 수도 있다)")으로 이미 §1-4 의 `additionalProperties: true`(객체 전제) 보다 더 넓은 "완전 임의 값" 스키마를 쓰고 있고, target 은 이 기존 패턴을 규칙화하는 것뿐이라 새로운 결정은 아니다. 다만 target 의 체크리스트 문구는 이 선택이 §1-4 의 "열린 map" 원칙과 왜 다른 표기(`{}` vs `additionalProperties:true`)를 쓰는지 연결하지 않는다 — §6 의 "빈 껍데기 금지" 정신만 보고 이 줄을 위반으로 오독할 여지가 있다.
  - 제안: 신규 Rationale 절이나 체크리스트 각주에 "본문이 객체임을 보장 못하는 경우(form-urlencoded 포함)만 `schema:{}` 를 쓰고, 객체는 보장되지만 키가 열린 경우는 §1-4 의 `additionalProperties:true` 를 쓴다"는 한 문장을 추가해 §1-4/§6 과의 관계를 명시.

## 정합성 확인 (위반 없음으로 판정한 항목들)

- **소급 적용 판단**: target 은 새 규칙을 기존 라우트까지 소급 적용한다고 명시하며 그 근거로 "§2-4·403 과 같은 부류(광고가 실제와 맞는가)" 를 든다. 실제 swagger.md Rationale 은 §1-4/§3 은 "신규 변경 한정"(소급 안 함), §2-4/§5-4-403 은 "광고 정확성 문제라 소급"으로 이미 두 갈래를 명확히 구분해 뒀다(§2-4 Rationale "이번에 고친 14곳", §5-4-403 Rationale "기존 라우트까지 소급한다"). target 의 분류는 이 기존 이분법과 정확히 일치한다 — 원칙 위반 없음.
- **§1-7 명명 규칙을 이번에 정하지 않는 결정**: target 은 `<Domain><Action>RequestDto` 명명을 이번 변경에서 보류하고 트래커에 남긴다. 이는 swagger.md §1-7 Rationale 이 이미 세운 원칙("규칙에 범위를 함께 적는다" · "집합을 넘은 일반화를 하지 않는다")과 같은 결의 판단이며, 서로 다른 결정(가드 존재 여부 vs 이름 규칙)을 섞지 않겠다는 것으로 원칙 위반이 아니라 원칙의 재적용이다.
- **"요청 DTO 승격" 기각의 이력 검증**: target 의 "트래커가 처음 적었던 처방(«요청 DTO 승격»)을 택하지 않는다"는 문장은 실제로 `plan/in-progress/spec-draft-nullable-notation-followups.md`(line 2466 부근, `#1408` 완료 기록: "위 처방의 «RotateBotTokenDto 요청 DTO 승격» 은 **하지 않았다**")과 정확히 일치한다 — 지어낸 이력이 아니다.
- **"문서 전용 DTO"(class-validator 없이 `@ApiProperty` 만) 패턴의 선례 검증**: `ExecuteWorkflowDto`(`execute-workflow.dto.ts`) 와 이미 구현된 `ChatChannelRotateBotTokenRequestDto`(#1408) 를 직접 열람해 실제로 class-validator 데코레이터 없이 `@ApiProperty`/`@ApiPropertyOptional` 만 사용하고, 그 이유(전역 `CustomValidationPipe` 가 클래스 파라미터에서만 진입해 계약을 바꾼다)를 파일 내 주석으로 이미 명시하고 있음을 확인했다. target 의 주장은 실제 코드 이력과 일치한다.
- **reflection 채택과 §5-4-403 가드의 선례 정합**: target 이 reflection 을 택한 논거("소스 텍스트로는 최종 값을 알 수 없다")는 swagger.md §5-4-403 Rationale 이 `forbidden-response-codes` 가드에 이미 쓴 동일 논거("설명은 상수 보간이라 소스 텍스트로는 최종 문장을 알 수 없다")와 같은 결의 판단이라 저장소 내 기존 설계 원칙과 정합적이다.
- **Rationale/체크리스트/frontmatter 삽입 위치**: 신규 체크리스트 줄의 삽입 지점("경로 UUID 파라미터" 줄 앞), frontmatter `code:` 삽입 지점("forbidden-response-codes*.ts" 뒤), 신규 Rationale 절 삽입 지점("§5-4 403 설명의 거부 코드" 절 뒤 — 실제로 swagger.md 의 마지막 Rationale 절)이 모두 현재 swagger.md 의 실제 줄 순서·구조와 정확히 일치함을 확인했다.

## 요약

target 은 `spec/conventions/swagger.md` 자체의 확인 가능한 실제 Rationale(§1-4/§3 신규-한정 vs §2-4/§5-4-403 소급-적용의 이분법, §1-7 의 "범위를 넓히지 않는다" 원칙, "문서 전용 DTO" 패턴, reflection 채택 논거)을 정확히 계승하며, 인용하는 과거 처방(«요청 DTO 승격» 기각, `ExecuteWorkflowDto` 선례)도 실제 트래커·코드 이력과 대조해 사실로 확인됐다 — 기각된 대안의 무단 재도입이나 합의 원칙의 무단 위반은 발견되지 않았다. 유일한 구조적 문제는 이 checker 호출 자체의 입력 갭(`--spec` 번들이 대조 대상인 swagger.md 의 Rationale 을 누락)이었으며, 이는 filesystem 직접 열람으로 보완해 결론에는 영향이 없었다. 남은 두 건은 실질 위반이 아니라 문서 간 소급 정정·상호 참조를 다듬으라는 INFO 수준 제안이다.

## 위험도

LOW
