# 정식 규약 준수 검토 — `spec/2-navigation/` (impl-done, diff-base=origin/main)

## 검토 범위 메모

- `spec/2-navigation/` 자체는 이 브랜치에서 **델타 0** — 번들에 실린 `3-schedule.md` / `1-workflow-list.md` / `2-trigger-list.md` (+ 예산 절단된 15개 파일 중 `9-user-profile.md` 는 diff 관련성 확인을 위해 직접 Read) 는 이 PR 이전부터 있던 내용이다.
- 구현 diff(3파일/213줄)는 `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` + swagger-DTO 계약 가드(`swagger-dto-contract-guard.ts` / `.spec.ts`) — **navigation 영역과 직접 관련 없음**(alerts 모듈). 점검 관점 4번(API 문서 규약)이 diff 에도 적용되므로 함께 검토했다.
- `spec/conventions/swagger.md`, `spec/conventions/error-codes.md`, `spec/5-system/2-api-convention.md` 를 직접 Read 해 대조(프롬프트 번들은 예산 초과로 conventions 본문이 전부 생략돼 있었음).

## 발견사항

- **[WARNING]** DTO JSDoc 에 내부 개발 서사가 그대로 공개 OpenAPI `description` 으로 노출
  - target 위치: diff `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` (`AlertRuleDto.threshold` JSDoc, `+` 라인 238~253)
  - 위반 규약: `spec/conventions/swagger.md` §3 "주석/설명 톤" (*"무엇을 하는지 + 제약/부수효과"를 담습니다*) 및 같은 §3 의 보안·정책 캐비엇 지시("**다만 상세 근거는 spec 본문에 두고 여기서는 요약 1~2문장 + SoT 링크로 적는다**")
  - 상세: `@nestjs/swagger` CLI 플러그인은 `introspectComments: true` 로 DTO JSDoc 을 그대로 OpenAPI `description` 에 싣는다(swagger.md 서두). 이번 diff 의 JSDoc 은 wire 가 문자열이라는 소비자 유용 정보 외에, "종전 이 자리는 `number` 라고 적었다 — 거짓이었다", "컨트롤러에 반환 타입이 없어 `tsc` 가 대조한 적이 없었고, 아무도 알아채지 못했다" 같은 **내부 회고/커밋 메시지 성격의 서사**를 포함한다. 이 필드가 §3 의 "응답 값이 저장된 값과 다를 수 있는 필드" 캐비엇과 완전히 같은 범주는 아니지만(값 자체는 저장값과 동일하고, 달랐던 건 *문서화된 타입*), 같은 정신 — "소비자가 알아야 할 wire 정보는 짧게, 상세 경위는 spec/Rationale 로" — 이 적용된다. 현재 형태는 최종 소비자(Swagger UI/OpenAPI 클라이언트) 에게 프로젝트 내부 감사 이력을 노출한다.
  - 제안: JSDoc 을 "임계값. wire 는 문자열이다(컬럼 `numeric(12,4)`, 정밀도 보존을 위해 TypeORM 이 문자열로 반환). 쓰기(`CreateAlertRuleDto.threshold`)는 `number`" 정도로 축약하고, "종전 오기였다"는 경위·근거는 `alerts` 관련 spec 문서(예: `spec/2-navigation/9-user-profile.md` §6.3 알림 규칙 API 또는 신설 `## Rationale` 항목)로 옮겨 SoT 링크만 남긴다.

- **[WARNING]** 신규 repo-wide DTO 불변식이 `spec/conventions/swagger.md` 에 규약화되지 않음
  - target 위치: diff `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 의 `findNumericAsNumber` (신규 export) + `swagger-dto-contract.spec.ts` 의 신규 `describe('numeric 컬럼을 number 로 문서화한 응답 DTO', ...)`
  - 위반 규약: `spec/conventions/swagger.md` — 정확히는 "규약 부재" 갭. CLAUDE.md 정보 저장 표의 "정식 규약 → `spec/conventions/<name>.md`" 단일 진실 원칙, 그리고 swagger.md 자신이 §1-5(`writeOnly`/`readOnly` 의무), §5-1(형제 DTO enum `*.literal.ts` 분리 의무) 등 **저장소 전체에 적용되는 새 DTO 불변식은 §1/§5 에 소절로 규약화**해 온 기존 관행
  - 상세: 이 diff 는 "`numeric`/`decimal` 컬럼을 엔티티 그대로 반환하는 응답 DTO 는 그 필드를 `number` 로 선언하면 안 된다"는 규칙을 **저장소 전체 스캔 가드**(`collectTsFiles(SRC_ROOT)`)로 신설해 앞으로 이 규칙을 어기면 CI 가 막는다 — 이미 국지적 수정이 아니라 전역 규칙이다. 그런데 이 규칙은 guard 소스 코드의 JSDoc 과 `AlertRuleDto.threshold` 한 필드의 주석에만 존재하고, `spec/conventions/swagger.md` (§1 DTO 패턴)에는 대응 항목이 없다. 다른 개발자가 `numeric`/`decimal` 컬럼을 새로 노출하는 응답 DTO 를 작성할 때, swagger.md 만 읽고는 이 제약을 알 방법이 없다(가드가 나중에 CI 에서 막아 줄 뿐 사전 지침이 아니다).
  - 제안: swagger.md §1 에 짧은 소절(예 "1-6. `numeric`/`decimal` 컬럼 → 응답은 `string`")을 추가해 규칙 자체와 근거(정밀도 보존)를 1~2문장 + `swagger-dto-contract-guard.ts` 링크로 명문화한다. 다만 swagger.md 자신의 §Rationale 이 "사례가 하나뿐일 때는 규칙으로 올리지 않는다(rule of three)"는 원칙(§1 `deprecated` 패턴 사례)도 갖고 있다는 점은 인지 — 이번 건은 **이미 저장소 전수 스캔 가드로 전역 강제**되고 있어 "국지적 1회성 명명 해소"와는 성격이 다르므로 그 유보의 적용 대상은 아니라고 판단했다. 규약 갱신이 부담스러우면 최소한 guard 파일 경로를 swagger.md 어딘가(§1 도입부 등)에서 1줄로 pointer 하는 것으로도 갭을 줄일 수 있다.

- **[INFO]** 점검 대상 spec 문서(`spec/2-navigation/*.md`) 자체는 API/명명/에러코드 규약과 잘 정렬됨 — 특기 사항 없음
  - target 위치: `spec/2-navigation/3-schedule.md` §4, `1-workflow-list.md` §3, `2-trigger-list.md` §3~§4
  - 위반 규약: 없음 (positive confirmation)
  - 상세: 엔드포인트 명명(`GET/POST/PATCH/DELETE /api/{resource}`, RPC-style sub-channel `/triggers/:id/chat-channel/rotate-bot-token` 등)이 `spec/5-system/2-api-convention.md §2.2` 의 규칙·명시된 예외와 정확히 일치(오히려 그 규약의 예시 원천). `isActive`/`is_active` 토글이 전용 `/toggle` 엔드포인트 없이 `PATCH /:id { isActive }` 로 통일된 것은 `§12.1 상태 토글 패턴` 을 정확히 따름(R-4/R-16 Rationale 이 이를 명시적으로 검토·채택). 에러 코드(`VALIDATION_ERROR`, `RESOURCE_CONFLICT`, `TRIGGER_ENDPOINT_PATH_CONFLICT`, `AUTH_CONFIG_NOT_FOUND`, `DUPLICATE_NODE_LABEL`)는 `spec/conventions/error-codes.md §1` 의 `UPPER_SNAKE_CASE` + 선택적 도메인 prefix 규칙을 위반하지 않는다. 페이지네이션·부재표현(`null` vs 키 생략) 언급도 `api-convention.md §5.2/§5.4` 를 명시적으로 인용하며 그 정의와 어긋나지 않는다.
  - 제안: 해당 없음(유지)

## 요약

검토 대상 `spec/2-navigation/*.md` (본 PR 델타 0) 자체는 API 엔드포인트 명명·상태 토글 패턴·에러 코드 표기·페이지네이션/부재표현 인용 모두 `spec/conventions/`·`spec/5-system/2-api-convention.md` 규약과 잘 정렬되어 있으며 직접적 위반은 발견되지 않았다. 이번 PR 의 실제 코드 변경(alerts DTO 타입 정정 + swagger 계약 가드 신설)은 navigation 영역과 무관하지만 점검 관점 4번(API 문서 규약)에 해당해 함께 검토했고, 여기서 두 건의 WARNING 을 발견했다 — (1) DTO JSDoc 에 소비자용 wire 정보를 넘어선 내부 개발 서사가 그대로 공개 OpenAPI `description` 으로 노출되는 점(swagger.md §3 정신 위반), (2) 신규 전역 DTO 불변식(`numeric`/`decimal` 컬럼→응답 `string`)이 repo-guard 코드로는 전수 강제되지만 `spec/conventions/swagger.md` 자체에는 아직 규약화되지 않아 문서·코드 SoT 가 이원화된 점. 둘 다 채택 시 다른 시스템의 invariant 를 직접 깨는 CRITICAL 은 아니며, 문서 다듬기·규약 보강으로 해소 가능한 수준이다.

## 위험도

LOW
