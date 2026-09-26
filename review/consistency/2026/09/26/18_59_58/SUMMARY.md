# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 성공, Critical 발견 0건.

- 검토 대상: `plan/in-progress/spec-draft-swagger-request-body.md` (`spec/conventions/swagger.md` §5-4 체크리스트 한 줄 · frontmatter `code:` 가드 등재 · Rationale 한 절, `--spec` 모드)
- 전문 확보 상태: 5개 checker 모두 인라인 전문 확보(authoritative) + 디스크 파일(`cross_spec.md`·`rationale_continuity.md`·`convention_compliance.md`·`plan_coherence.md`·`naming_collision.md`) 기존 존재 확인 완료 — 누락 없음, 재시도 필요 항목 없음.

## 전체 위험도

**LOW** — WARNING 1건(가드 면제 범위 서술 격차) 외에는 전부 INFO/NONE. 신규 엔티티·API 계약·RBAC·요구사항 ID 도입이 없고 유일한 실질 변경(reflection 판정 축 채택)은 형제 가드·기존 헬퍼와 정합함이 코드 대조로 확인됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 새 체크리스트 문구의 가드 면제 범위가 같은 PR 구현 plan·형제 가드의 실제 동작보다 좁다 — `@ApiExcludeEndpoint()`만 언급, `@ApiExcludeController()` 누락 | `spec-draft-swagger-request-body.md` §"1. §5-4 체크리스트 — 한 줄 추가" | `plan/in-progress/request-body-guard.md`(둘 다 면제 명시) · 형제 가드 `forbidden-response-codes-guard.ts:146`(컨트롤러 단위 `@ApiExcludeController()`도 검사) | 체크리스트 문구를 "(`@ApiExcludeEndpoint()` · `@ApiExcludeController()` 제외)"로 맞추거나, 가드가 실제로 컨트롤러 단위 제외를 보지 않기로 확정하면 구현 plan 쪽 문구를 spec에 맞춰 좁힌다. 가드 구현 후 `--impl-done` 단계에서 실측 재확인 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `§5.4`/`§5-4` 절 번호가 문서마다 다른 의미로 이미 혼용 중(기존 상태, target이 유발한 것 아님) | Rationale 절 "INVALID_BOT_TOKEN(15-chat-channel.md §5.4)" 인용부 | target은 문서명 병기로 이미 모호성 해소함, 수정 불요. 향후 `conventions/`에 "절 번호는 문서명과 병기" 메타 규칙 고려 가능(이번 범위 밖) |
| 2 | rationale_continuity | `--spec` 번들이 대조 대상인 swagger.md 자신의 `## Rationale`을 놓침(알려진 예산 갭) | 입력 파이프라인 이슈, target 위치 없음 | `--spec` 번들링이 `spec_impact`에 명시된 파일의 Rationale은 예산과 무관하게 최우선 포함하도록 트래커 등재. 이번 리포트는 filesystem 직접 열람으로 갭을 메워 결론에는 영향 없음 |
| 3 | rationale_continuity | 트래커(`spec-draft-nullable-notation-followups.md` 5141행)의 "AST" 문구가 draft/plan의 "reflection" 채택 이후에도 취소선·정정 없이 원문 그대로 남음(무근거 번복 아님, 근거 있는 정정) | draft §3 "reflection으로 센다" 단락 | plan 마감(트래커 항목 좁히기) 시 트래커의 "AST"를 취소선 처리하고 "reflection(사유: 위 draft/plan 참조)" 정정 각주 추가 |
| 4 | rationale_continuity | `@ApiBody({ schema: {} })` 예외가 §1-4의 "열린 map"(`additionalProperties:true`) 원칙과 왜 다른 표기를 쓰는지 연결 서술 없음 | draft §1 체크리스트 "형태를 발신자가 정하는 본문(외부 웹훅)은 `@ApiBody({ schema: {} })`" | Rationale 절이나 각주에 "본문이 객체임을 보장 못하면 `schema:{}`, 객체는 보장되지만 키가 열린 경우는 §1-4 `additionalProperties:true`" 한 문장 추가 |
| 5 | convention_compliance | "문서 전용 DTO"라는 새 용어가 선례 코드 자기 서술("OpenAPI 스키마 전용")과 문구가 다름 | draft §1 "**문서 전용 DTO**(class-validator 데코레이터 없이 `@ApiProperty`만)" | 이번 반영 차단 사유 아님. §1-7 정식 승격 시점에 두 표현 중 하나로 통일 권장 |
| 6 | plan_coherence | 트래커 항목 1("§5-4 체크리스트" + "§1-7 표 행")의 절반만 이번 draft로 닫힘 — 이미 draft/plan 양쪽에 명시된 의도적 분리 | draft §"왜 §1-7 명명 행은 이번에 넣지 않나" | 트래커 마감 시 항목 1을 "§5-4(닫힘)"/"§1-7(남음)"으로 명시적으로 쪼갤 것 — 이미 계획된 단계, 별도 조치 불요 |
| 7 | plan_coherence | 트래커의 가드 판정축("AST")과 draft/plan의 최종 선택("reflection")이 다름(기술적으로 더 타당한 정정, 형제 가드·`CustomValidationPipe.toValidate()` 실측과 정합) | draft "Rationale" "reflection으로 센다" 절 | 트래커 항목을 닫을 때 "AST" → "reflection(근거: interface/타입 별칭이 런타임에 Object로 붕괴)"로 정정 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 신규 엔티티·API 계약·RBAC 미도입. 유일한 실질 지점(요청 DTO 클래스 강제 여부)은 오히려 `15-chat-channel.md` §5.4의 `INVALID_BOT_TOKEN` 계약을 보호하는 방향으로 설계됨(코드 대조 확인). §5.4/§5-4 절 번호 혼용은 INFO(기존 상태) |
| rationale_continuity | LOW | swagger.md 실제 Rationale(신규-한정 vs 소급-적용 이분법, §1-7 "범위 안 넓힘" 원칙, 문서 전용 DTO 패턴, reflection 채택 논거)을 정확히 계승. 인용 이력(«요청 DTO 승격» 기각, `ExecuteWorkflowDto` 선례)도 실제 트래커·코드와 일치. `--spec` 번들 입력 갭은 INFO |
| convention_compliance | LOW | 명명·frontmatter·삽입 위치·실측 수치(78개 `@Body()`, 74/4 분포 등) 전부 기존 규약과 일치. 가드 면제 범위 서술 격차 1건 WARNING |
| plan_coherence | NONE | 트래커 항목 1·2·3(부분)을 구현 plan과 정합되게 좁혀 닫으려는 구조. 미룬 §1-7 명명 행은 명시적으로 별도 보존. reflection 축 정정은 근거 있는 기술적 정정 |
| naming_collision | NONE | 신규 식별자는 가드 이름 `request-body-advertised` 하나뿐이며 저장소 전체 선행 사용처 없음(신규), 형제 가드 명명 축과 일치. API endpoint·이벤트·ENV·타입명 신규 도입 없음(vacuous pass) |

## 권장 조치사항

1. (WARNING 해소) 체크리스트 문구의 가드 면제 범위를 구현 plan·형제 가드 실제 동작(`@ApiExcludeEndpoint()` + `@ApiExcludeController()`)과 맞추거나, 가드가 컨트롤러 단위 제외를 보지 않기로 확정 시 구현 plan 문구를 spec에 맞춰 좁힌다. 가드 구현 후 `--impl-done`에서 실측 재확인.
2. 트래커(`spec-draft-nullable-notation-followups.md` 5141행) 마감 시 "AST"→"reflection" 정정 각주 및 "§5-4(닫힘)"/"§1-7(남음)" 항목 분리 기록.
3. Rationale 절 또는 체크리스트 각주에 `@ApiBody({schema:{}})` vs §1-4 `additionalProperties:true` 사용 기준 한 문장 추가.
4. (선택) "문서 전용 DTO" 용어를 §1-7 정식 승격 시점에 코드 주석("OpenAPI 스키마 전용")과 통일.
5. `--spec` 번들링이 `spec_impact` 대상 파일 자체의 `## Rationale`을 예산 무관 최우선 포함하도록 개선 검토(트래커 등재, 이번 세션 범위 밖).
