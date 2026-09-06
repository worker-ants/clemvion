# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base origin/main)

검토 범위: 이번 브랜치는 `spec/5-system/` 델타가 0개 파일이므로(정상), 검토는 코드 diff
(23개 파일 / 975줄, `origin/main..HEAD`)가 `spec/5-system/2-api-convention.md` §5.4(부재
표현 — `null` vs 키 생략) 및 그 자매 규약 `spec/conventions/swagger.md` §1-3/§1-4/§5-1을
따르는지에 집중했다. diff 본문이 프롬프트 예산으로 잘려 있어(§5-system 번들 note 참고),
워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`)
를 절대경로로 직접 읽어 실측했다.

## 발견사항

- **[CRITICAL]** 이번 PR이 새로 선언한 응답 DTO 필드 16개가 §5.4가 "요청 바디 전용"으로
  한정한 tri-state 조합(`@ApiPropertyOptional({ nullable: true })` + `field?: T | null`)을
  **응답 DTO**에 그대로 썼다
  - target 위치: `spec/5-system/2-api-convention.md` §5.4 "DTO 선언이 wire 를 반영해야
    한다" 절 (번들 라인 1136~1158) — "적용 범위 — 응답 바디... **요청 바디는 대상이
    아니다**... 요청 DTO 에서는 `@ApiPropertyOptional({ nullable: true })` + `field?: T |
    null` 조합이 **정당하다**"는 문장이 명시적으로 이 조합을 request-only로 못박는다.
    같은 문서가 두 canonical 패턴을 표로 못박는다: "키 생략 → `@ApiPropertyOptional()` +
    `field?: T` (`| null` 금지)" / "`null`(상시 존재) → `@ApiProperty({ nullable: true })`
    + `field: T | null`".
  - 위반 규약: `spec/5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략` +
    `spec/conventions/swagger.md` §1-4 (`ExecutionStatusDto.context` 예제가 정확히 같은
    이유로 `@ApiProperty({ nullable: true })`를 쓰고 `@ApiPropertyOptional`을 명시적으로
    기각한다: "이 필드는 **상시 존재**하고 값만 없을 수 있다... `@ApiPropertyOptional` 은
    `ApiProperty({ required: false })` 의 별칭이라 쓰면 OpenAPI 가 키를 optional 로
    문서화한다").
  - 상세: 이번 diff(`codebase/backend/src/modules/*/dto/responses/*-response.dto.ts`)가
    "§5.4 응답-계약 스윕"으로 24개 신규 필드를 선언했는데(`CHANGELOG.md` "함께 — 선언이
    현실에 뒤처져 있던 24필드를 선언했다" 절), 그중 아래 16개가 엔티티 컬럼이 **항상
    존재**(TypeORM `nullable: true` 컬럼이지만 쿼리가 전 컬럼을 select — `select: false`
    없음 확인됨)하는데도 Optional로 선언했다:
    - `trigger-response.dto.ts:82,86,90,98,102` — `chatChannelLastError` ·
      `chatChannelSetupAt` · `chatChannelRotatedAt` · `notificationLastError` ·
      `notificationRotatedAt` (엔티티 `trigger.entity.ts:95,116,132,140,157` 모두
      `T | null`, non-optional, `select:false` 없음 — 로테이션 스윕이 읽어야 하므로
      의도적으로 컬럼 레벨로 끄지 않는다고 diff 자신이 주석에 적음)
    - `alert-rule-response.dto.ts:62,66` — `createdBy` · `lastTriggeredAt`
      (엔티티 `alert-rule.entity.ts:51,54` 모두 `T | null`, non-optional)
    - `integration-response.dto.ts:126,130,134,138,142` — `appUrl`(서비스가 `toPublic()`
      에서 항상 키를 세팅, `integrations.service.ts:1419,1433`) · `mallId` ·
      `tokenExpiresAt` · `lastRotatedAt` · `lastUsedAt`
      (엔티티 `integration.entity.ts:89,100,103,106` 모두 `T | null`, non-optional)
    - `knowledge-base-response.dto.ts:105,117,121,125` — `embeddingModelConfigId` ·
      `rerankScoreThreshold` · `rerankConfigId` · `rerankLlmConfigId`
      (엔티티 `knowledge-base.entity.ts:61,103,115,119` 모두 `T | null`, non-optional)
    - `schedule-response.dto.ts:91` — `trigger?: ScheduleTriggerRefDto | null` — 반대
      방향 오류: `schedule.entity.ts:25-30`의 `triggerId: string`(NOT NULL FK) +
      `trigger: Trigger`(non-optional 타입)이므로 relation 이 로드되면 join 이 실패할
      길이 없다 — 컨트롤러 코드(`schedules.controller.ts` `toResponse`)의
      `t ? {...} : t` 도 `t`가 `undefined`일 때만 값을 통과시키고 리터럴 `null`을 만드는
      코드 경로가 저장소 전체에 없다(grep 0건). 즉 이 필드는 **순수 키-생략** 케이스인데
      `nullable: true`까지 붙여 §5.4가 "키 생략 → `| null` 금지"라 못박은 반대쪽 조합도
      함께 어겼다.
  - 왜 CRITICAL 인가: (1) 이번 필드들은 **이번 PR에서 신규 선언**된 것이라 §5.4의
    "소급 적용 대상 아님"(이미 문서화된 키-생략 필드 한정 열거)의 은신처가 없다.
    (2) 자동 검증기(`shared/testing/response-contract.ts` `visit()`)는 `isRequired`가
    `false`(Optional)면 missing 여부 자체를 안 문고, `nullable:true` 선언과 실제 `null`
    값이 일치하면 통과시키므로 — 이 특정 오분류(등록된 컬럼이 사실은 상시 필수인데
    Optional로 선언)를 **구조적으로 못 잡는다**(코드로 직접 확인: `nullable` 분기는
    `isRequired`와 무관하게 `value===null && !nullable`만 위반으로 문다). e2e 스펙도
    이 필드들에 `allowMissing`을 걸지 않았다(신규 e2e 4곳 grep 확인) — 즉 지금 이 오분류를
    잡아줄 안전망이 하나도 없다. (3) api-convention.md Overview 자체가 "OpenAPI 문서가
    실제 wire 와 어긋나면 그 어긋남이 소비자 코드로 전파된다"를 §5.4의 존재 이유로
    선언하는데, 바로 그 어긋남을 닫으려던 이번 스윕이 다른 축(optional 정밀도)에서
    새 어긋남을 만들었다.
  - 제안: 5개 파일의 위 16개 필드를 `@ApiProperty({ nullable: true })` + `field: T |
    null`(required, `?` 제거)로 정정한다. `ScheduleDto.trigger`는 반대로
    `@ApiPropertyOptional({ type: () => ScheduleTriggerRefDto })` + `trigger?:
    ScheduleTriggerRefDto`(`nullable: true` 제거)로 정정한다. 자동 검증기가 이 축을 못
    잡으므로, 가능하면 `response-contract.ts`에 "선언이 optional인데 e2e 관측값이 한 번도
    비지 않았다"를 감지하는 보조 점검을 여는 것도 후속으로 고려할 만하다(별건).

- **[WARNING]** 같은 diff에서 6개 필드가 "항상 존재 + 항상 non-null"인데도
  `@ApiPropertyOptional()`(nullable 없이)로 선언됐다
  - target 위치: 위와 동일한 §5.4 절 + swagger.md §1-3(Optional 필드는 "생략 가능"을
    뜻함)의 암묵 전제
  - 위반 규약: `spec/5-system/2-api-convention.md#54` (선언이 wire 를 반영해야 한다는
    원칙의 세 번째 변형 — non-nullable 인데 optional 로 선언하는 경우는 표에 명시된
    두 canonical 패턴 어디에도 안 든다)
  - 상세: `trigger-response.dto.ts:78` `chatChannelHealth?: string` · `:94`
    `notificationHealth?: string` (엔티티 `notificationHealth`/`chatChannelHealth` 는
    DB `default` 있는 non-nullable 컬럼, `trigger.entity.ts:88,128`) ·
    `knowledge-base-response.dto.ts:101` `documentCount?: number` · `:109`
    `rerankMode?: string` · `:113` `rerankCandidateK?: number` (엔티티 모두 non-nullable
    `default` 컬럼) · `integration-response.dto.ts:152`
    `consecutiveNetworkFailures?: number`(엔티티 non-nullable). 위 CRITICAL 항목만큼
    위험하진 않다(소비자가 방어적으로 `?.`를 써도 안전) — 하지만 "선언이 wire 를 반영"
    원칙에서 여전히 어긋나고, 자동 검증기도 이 방향(과소 요구)은 절대 못 잡는다.
  - 제안: `@ApiProperty()`(required)로 통일. 근거 부족하면 최소한 왜 optional로 남겨
    두는지 JSDoc 옆 `//` 주석에 남긴다(swagger.md §3 "내부 서사는 `//` 에" 규칙과 정합).

- **[INFO]** `CHANGELOG.md`의 "함께 — 선언이 현실에 뒤처져 있던 24필드를 선언했다" 절이
  "wire 변경 없음"만 확인하고 optional/nullable 축의 정밀도는 언급하지 않는다
  - target 위치: `CHANGELOG.md` 신규 절 (원본 diff 상단)
  - 위반 규약: 직접 위반은 아니고, §5.4 검증 층 절이 스스로 적어 둔 "두 축이 서로 다른
    규칙을 시행한다"는 경고와 궤를 같이하는 관찰 — CHANGELOG 저자가 "선언되지 않은 키"
    축만 닫고 "optional/required 정밀도" 축은 별도로 검토하지 않은 것으로 보인다.
  - 제안: 후속 커밋에서 위 CRITICAL/WARNING 정정을 반영하며 CHANGELOG에 짧게 추가 기록.
    (필수는 아님 — 정보 제공용.)

## 요약

이번 브랜치는 `spec/5-system/` 문서 자체를 변경하지 않았으나, 그 문서 §5.4가 정한 "부재
표현" 규약을 구현하는 5개 응답 DTO(`TriggerDto`·`ScheduleDto`·`AlertRuleDto`·
`IntegrationDto`·`KnowledgeBaseDto`)에 신규 필드 24개를 선언하면서, 그중 16개가 §5.4가
명시적으로 "요청 바디 전용"이라 못박은 `@ApiPropertyOptional({nullable:true})` +
`field?: T|null` 조합을 응답 DTO에 사용했고(반대 방향 오류 1건 포함), 추가로 6개가
"항상 존재·non-null"인데 Optional로 선언됐다. 두 문제 모두 이 프로젝트의 런타임 검증기
(`response-contract.ts`)가 구조적으로 검출하지 못하는 사각지대이며, §5.4 스스로가
"선언이 wire 를 반영해야 한다"고 요구하는 원칙에 정면으로 반한다. 이 PR의 목적(§5.4 스윕
— 선언 누락을 실제에 맞추는 것) 자체는 타당하고 보안 수정(트리거 secret 이중 유출 차단)도
정확했으나, 새로 추가한 선언들이 §5.4의 두 canonical 패턴 중 어느 쪽도 아닌 제3의(금지된)
조합을 기계적으로 반복 적용해, 이 PR이 닫으려던 "문서-실제 드리프트" 문제를 다른 축에서
재생산했다.

## 위험도

HIGH
