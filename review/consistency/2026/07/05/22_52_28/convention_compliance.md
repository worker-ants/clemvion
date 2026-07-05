# 정식 규약 준수 검토 — spec/4-nodes/4-integration

## 발견사항

- **[WARNING] `INVALID_PARAMETERS` 에러 코드가 도메인 prefix 컨벤션·중앙 enum 등록 관행에서 이탈**
  - target 위치: `spec/4-nodes/4-integration/2-database-query.md` §5.3 표(866행), §6.2 표(910-913행)
  - 위반 규약: `spec/conventions/error-codes.md` §1 "의미 기반 명명" / "도메인 prefix (권장)" — 같은 노드의 다른 모든 코드(`DB_QUERY_FAILED`, `DB_CONNECTION_ERROR`, `DB_CONSTRAINT_VIOLATION`, `DB_PERMISSION_DENIED`, `DB_HOST_BLOCKED`)는 전부 `DB_` prefix 로 그룹화되어 있고, §1 이 명시한 prefix-less 예외는 시스템 전역 공용 코드(`VALIDATION_ERROR` 등)뿐이다.
  - 상세: `INVALID_PARAMETERS` 는 Database Query 노드 전용(파라미터 JSON parse 실패) 신규 코드인데 `DB_` prefix 를 따르지 않는다. 코드 확인 결과(`codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:552,558`) 실제로도 문자열 리터럴로만 존재하고 `codebase/backend/src/nodes/core/error-codes.ts` 의 중앙 `ErrorCode` enum 에 등록되어 있지 않다 — 같은 문서·같은 노드의 형제 코드(`DB_QUERY_FAILED` 등)는 모두 그 enum 에 등록되어 있다(대칭 확인: `error-codes.ts:25-32`). `error-codes.md` "적용 범위" 절은 그 enum 을 "명명이 중앙화된 대표 surface" 로 규정하므로, 신규 노드 전용 코드가 그 밖에 방치된 것은 명명 규약과 실제 구현 간 불일치의 근거가 된다.
  - 제안: (a) 코드명을 `DB_INVALID_PARAMETERS` 로 domain-prefix 정정하거나, (b) 현재 이름을 유지할 근거(예: 향후 타 노드 공용화 계획)가 있다면 `error-codes.md` §3 historical-artifact 예외 레지스트리에 등재해 의도적 예외임을 명문화한다. 어느 쪽이든 `error-codes.ts` 의 중앙 enum 에 정식 등록해 spec 문서와 구현의 SoT 정합성을 맞추는 편을 권장.

- **[INFO] `0-common.md` 에 `## Rationale` 섹션 부재**
  - target 위치: `spec/4-nodes/4-integration/0-common.md` (전체 — Overview/본문만 있고 Rationale 섹션 없음)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"(권장, 각 SKILL.md 3섹션 구성 참고)
  - 상세: 본 문서 §6.1("`meta.duration` vs `meta.durationMs` 명명 통일") 은 사실상 breaking-change 결정의 배경 서술로 Rationale 성격이지만 본문 섹션(§6.1)에 인라인되어 있다. 단, 이는 이 target 문서만의 개별 이탈이 아니라 `spec/4-nodes/*/0-common.md` 7개 중 5개(logic·flow·integration·data·trigger)가 동일하게 Rationale 섹션이 없는 **기존 프로젝트 전반의 패턴**이다(ai·presentation 의 `0-common.md` 만 Rationale 보유). 신규로 도입된 이탈이 아니라 이미 존재하던 문서 구조 관행.
  - 제안: 이번 target 만 개별 수정하기보다, `0-common.md` 문서군 전체에 대해 project-planner 가 일괄 Rationale 섹션 도입 여부를 정책으로 결정하는 편이 일관적이다. 급하지 않은 INFO 성격.

## 요약

`spec/4-nodes/4-integration` 대상 4개 문서(0-common, 1-http-request, 2-database-query, 3-send-email)는 `spec/conventions/node-output.md` 의 5필드 invariant(Principle 0)·config/output 직교성(Principle 1.1)·config echo 명시 enumeration 의무(Principle 7 D1)·에러 컨트랙트 D4 라우팅(Principle 3)·Case 문서화 포맷(Principle 11)을 정확히 준수하고 있으며, `HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED` 등 신설 에러 코드 명명은 `spec/conventions/error-codes.md` 의 의미 기반 명명·도메인 prefix 원칙 및 `spec/5-system/3-error-handling.md` 마스터 카탈로그와 대칭적으로 정합한다(코드 검증: `error-codes.ts`, `http-request.handler.ts` 실물 대조 완료). 파일 명명(`0-`/`1-`/`2-`/`3-` prefix, `_product-overview.md`)도 CLAUDE.md 규약과 일치한다. 유일하게 명확한 규약 이탈은 Database Query 의 `INVALID_PARAMETERS` 코드가 형제 코드군의 `DB_` 도메인 prefix 를 따르지 않고 중앙 `ErrorCode` enum 에도 미등록된 점(WARNING)이며, `0-common.md` 의 Rationale 섹션 부재는 프로젝트 전반의 기존 패턴이라 INFO 로 낮춘다. 전체적으로 정식 규약 준수도는 높다.

## 위험도

LOW
