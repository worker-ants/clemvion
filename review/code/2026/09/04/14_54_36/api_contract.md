# API 계약(API Contract) 리뷰

## 대상 개요

응답 DTO 83필드(20개 `*-response.dto.ts` 파일)를 `@ApiPropertyOptional({ nullable: true }) field?: T | null`
→ `@ApiProperty({ nullable: true }) field: T | null` 로 일괄 전환한 변경. `CHANGELOG.md` +
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 배경·방법론(§5.4 정정 후속,
`tsc` 전수 재조립 검증, 요청/응답 분리)이 상세히 기록되어 있다.

## 발견사항

- **[INFO]** OpenAPI `required` 플립은 wire 는 불변이지만 **생성 클라이언트 타입 계약**을 좁힌다
  - 위치: `codebase/backend/src/modules/*/dto/responses/*.dto.ts` (20개 파일, 예: `alert-rule-response.dto.ts:25`,
    `execution-response.dto.ts:19-20`, `workspaces/dto/responses/workspace-response.dto.ts:109`)
  - 상세: `required: false → true` 로 바뀌면 OpenAPI 로 타입을 생성하는 SDK/클라이언트는 해당
    83필드에 대해 `field?: T | null` → `field: T | null` 로 좁아진다. **런타임 wire 는 그대로**이므로
    기존 optional-check 코드는 계속 동작하지만(하위호환 유지), 코드젠 패키지를 재생성/재배포하는
    소비자가 있다면 그 시점에 타입 재생성이 필요하다는 점은 별도 공지 없이는 드러나지 않는다.
    CHANGELOG 에 이미 "영향" 섹션으로 명시돼 있어 실질적 조치는 불필요해 보이나, SDK 패키지를
    별도 배포하는 파이프라인이 있다면 그 재생성 트리거를 확인할 가치가 있다.
  - 제안: 조치 불요(문서화 완료). SDK 자동 재생성 파이프라인이 있다면 이번 배치가 그 트리거를
    거쳤는지만 확인 권장.

- **[INFO]** "상시 존재" 판정은 `tsc` 구조적 타입체크에 의존 — 알려진 사각지대(스프레드 widening·
  `as`·직렬화 인터셉터)는 새 가드 범위 밖
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (§"기계화되지 않는다 던 판정을
    타입체커가 했다" 문단) — 관련 가드: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
  - 상세: 이번 배치의 "83필드 전부 항상 채워진다" 근거는 응답 조립부가 `: SomeDto` 로 타입된
    리터럴을 반환할 때 `tsc` 가 필드 누락을 잡는다는 것이다. 이는 강력한 근거이지만, (a) object
    spread 가 fresh literal 타입을 widening 하는 경우, (b) `as`/`any` 캐스트가 개입하는 경로, (c)
    `ClassSerializerInterceptor` 류가 `undefined` 값을 가진 필드를 직렬화 단계에서 키째 생략하는
    경우는 컴파일 타임 검사로 잡히지 않는다. 새로 세운 `swagger-dto-contract-guard.ts` 는 "선언 형태
    일치"(nullable ↔ `| null`, required ↔ `@ApiProperty`/`@ApiPropertyOptional`)를 검사하는 정적
    가드이지 "실제로 항상 채워지는가" 를 런타임으로 검증하지는 않는다. 이 사각지대는 이번 diff
    가 만든 것이 아니라 검증 방법론 자체의 한계이며, 작성자 스스로 같은 세션에서 스프레드
    widening 함정을 다른 DTO(`WaitingContextBaseDto`)에서 이미 인지하고 우회한 이력이 있어
    (`ExecutionStatusDto.context` 주석) 신뢰도는 높다.
  - 제안: 조치 불요. 다만 고빈도 응답 경로(예: `ExecutionDto`, `WorkflowDto`)에 한해 실제 HTTP
    응답 스냅샷/e2e 단언이 있다면 이번 회귀를 잡아줄 안전망이 되므로 유지 권장.

## 항목별 점검 결과 (요약)

1. **하위 호환성**: wire 포맷 무변경, `required` 만 정확해짐 — 논브레이킹. CHANGELOG 에 영향 명시.
2. **버전 관리**: API 버전 변경 없음 — 문서 정확도 수정이라 버전업 불필요.
3. **응답 형식**: `null`(키 present) 계약이 §5.4 신 문면과 일치하도록 정정됨. 응답측 83곳 전수
   확인, 요청측 21곳(PATCH tri-state)은 의도적으로 배제 — 요청/응답 분리가 정확히 유지됨. 순수
   optional(키 생략, `null` 아님) 필드들(`nodeLabel?`, `cronExpression?`, `timezone?`, `latencyMs?`,
   `params?`, MCP-only 필드 등)은 이번 배치에서 건드리지 않고 그대로 두어 구분이 정확하다.
4. **에러 응답**: 변경 없음(해당 파일들에 에러 응답 DTO 없음).
5. **요청 검증**: 요청 DTO 는 이번 diff 범위 밖 — 영향 없음.
6. **URL/경로 설계**: 컨트롤러·라우트 변경 없음.
7. **페이지네이션**: 목록 응답 DTO(`WorkflowVersionListItemDto` 등) 포함되나 페이지네이션 구조
   자체는 변경 없음.
8. **인증/인가**: 변경 없음.

## 요약

응답 DTO 83필드의 `@ApiPropertyOptional`→`@ApiProperty` 전환은 §5.4 정정(#1277/#1280)에 따른
문서 drift 해소이며, 서버가 실제로 내보내는 값(wire)에는 변화가 없다. 요청측 PATCH tri-state
필드는 명확히 배제됐고, 진짜 optional(키 생략) 필드는 그대로 유지돼 두 계약(null-present vs
key-omitted)의 구분이 20개 파일 전체에서 일관되게 지켜졌다. `tsc` 전수 재조립 검증 + AST 가드
신설이라는 방법론은 견고하나, "상시 존재" 판정이 컴파일 타임 구조적 체크에 의존한다는 본질적
한계(스프레드 widening·직렬화 인터셉터 등)는 남아 있다 — 다만 이는 새로운 리스크가 아니라
검증 방법론의 알려진 경계이고, CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

LOW
