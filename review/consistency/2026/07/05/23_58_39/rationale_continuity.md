### 발견사항

- **[WARNING]** `4-cafe24.md` §4 step 2 가 CONVENTIONS Principle 7 D1(spread 금지)을 여전히 위반 서술
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §4 실행 로직 step 2 ("Config echo 빌드 (Principle 7): `context.rawConfig` 를 그대로 spread")
  - 과거 결정 출처: `spec/conventions/node-output.md` Principle 7 **D1** ("config echo 구현 방식 — 명시 enumeration 의무화", "❌ 금지 — spread 패턴: `{ ...context.rawConfig }` … credential leak 위험·회귀 감지 곤란·dead field echo"). 같은 target 세트의 형제 문서 `1-http-request.md` §4 step 2 는 D1 을 인용하며 명시 열거로 전환되어 있다.
  - 상세: 같은 `0-common.md` 공통 규약 아래 있는 형제 노드 문서(`4-cafe24.md`)가 D1 이 정확히 금지한 spread 패턴을 여전히 채택 중이라고 스스로 문서화하고 있다. D1 은 살아있는 컨벤션(unit test 로 강제 예정/강제 중인 것으로 인접 plan 이 취급)이라 폐기되지 않았다. 현재 cafe24 config 스키마엔 credential-shape 필드가 없어 즉시 누출은 없으나, 이는 이번 세션(cafe24 metadata field-set 대량 확장, `G-1-remaining`)이 새로 유발한 위반이 아니라 이전부터 존재한 문서 간 불일치이며 이번 diff 로도 정정되지 않았다.
  - 제안: (a) cafe24 handler 를 명시 enumeration 으로 리팩터링 + spec 문구를 `1-http-request.md` 패턴과 정렬, 또는 (b) cafe24 전용 예외(예: "`fields`/`pagination` 은 사용자 정의 key-value 라 열거가 무의미하고 구조적으로 credential 필드가 있을 수 없음")를 D1 옆에 **새 Rationale 항목**으로 명문화. 현재 둘 다 부재.

- **[INFO]** 이번 diff(cafe24 metadata field-set 대량 확장, `codebase/backend/src/nodes/integration/cafe24/metadata/*.ts` 22개 파일)는 spec Rationale 이 지정한 정당한 위치에서 이루어짐 — 연속성 문제 없음
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.3 근방 ("메타데이터 **형식**은 `cafe24-api-metadata.md`, 실제 row 는 backend metadata 모듈에 저장" / "명단을 spec 본문에 직접 enumerate 하지 않는 이유는 drift 방지")
  - 과거 결정 출처: 해당 없음 (신규 Rationale 요구 아님) — 기존 SoT 분리 원칙 확인
  - 상세: 실제 코드 diff 는 `product.ts`(8→다수 필드), `order.ts`, `category.ts` 등 metadata 테이블의 필드 목록을 대폭 확장한 것으로, `4-cafe24.md` 본문 자체는 field 개수나 목록을 하드코딩하지 않으므로 stale 위험이 구조적으로 차단되어 있다. `catalog-required-fields.spec.ts`/`product-fields.spec.ts` 신설도 메타데이터 정확성을 코드측에서 검증하는 것으로 spec 의 "SoT=backend metadata 모듈" 원칙과 정합한다.
  - 제안: 조치 불요. 향후 다른 resource 로 확장될 때도 동일 원칙(spec 본문에 field 개수 미기재) 유지 권장.

### 요약

이번 세션의 실제 코드 변경(cafe24 metadata 22개 파일의 field-set 대량 확장, G-1-remaining 후속)은 spec 이 명시적으로 지정한 "메타데이터 SoT = backend 모듈, spec 본문은 enumerate 하지 않음" 원칙과 정합하며 새로운 Rationale 연속성 위반을 유발하지 않았다. SSRF 관련 Rationale 체인(§8.2 all-auth 적용 → §8.3 메시지 일반화, DB/Email 대칭, D4 throw→error 포트 전환)도 근거·기각 대안·breaking-change 고지가 모두 갖춰진 채 이미 origin/main 에 병합되어 있어 연속성 문제가 없다. 다만 target 문서 세트를 전체적으로 대조하는 과정에서 이전부터 존재해온 잔존 이슈 하나를 재확인했다 — `4-cafe24.md` 가 형제 문서(`1-http-request.md`)는 이미 준수 중인 CONVENTIONS Principle 7 D1(config echo spread 금지)을 여전히 위반 서술하고 있으며, 이는 이번 diff 가 유발한 것은 아니지만 아직 해소되지 않았다.

### 위험도
LOW
