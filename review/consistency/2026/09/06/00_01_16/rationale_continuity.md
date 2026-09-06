# Rationale 연속성 검토

## 검토 범위와 방법

- target: `spec/5-system/` (impl-done, diff-base `origin/main`)
- **scope 델타 0개 파일** — 이 브랜치는 `spec/5-system/` 을 직접 수정하지 않았다. 따라서 본
  검토는 (a) 코드 diff(31파일/2169줄)가 `spec/5-system/2-api-convention.md §5.4`·
  `spec/conventions/secret-store.md §1.1` 에 이미 박힌 Rationale/invariant 를 위반하는지,
  (b) 관련 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 기록한 과거
  결정과 이번 코드 변경이 정합하는지를 대조했다.
- 프롬프트 예산 절단으로 `spec/5-system/` 의 17개 파일 본문이 생략돼 있어, §5.4·§Rationale 이
  실린 `1-auth.md`·`2-api-convention.md` 본문 전체와 diff 대상 코드(`triggers.service.ts`,
  `schedules.controller.ts`/`.service.ts`, `response-contract.ts`,
  `swagger-dto-contract-guard.ts`, 신규 응답 DTO 5종)를 워크트리에서 직접 절대경로로
  대조했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** §5.4 신규 "금지 조합" 축(`optional+nullable`)의 소급 면제가 원문 문맥의 유추 적용임을 재확인
  - target 위치: 코드 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 의 `findOptionalNullableResponseFields`/`EXPECTED_OPTIONAL_NULLABLE_DRIFT`(78건 래칫 베이스라인)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §5.4` "소급 적용 대상 아님" 문단(현재 이미 "표현 선택과 **DTO 선언 형태 양쪽 모두**" 로 명시돼 있음) + `plan/in-progress/spec-draft-nullable-notation-followups.md` ③ 하단 "§5.4 의 소급 면제 조항 …은 유추 적용이다(`--spec` INFO#1)"
  - 상세: 이번 diff 가 세운 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 78건 래칫은 "새 규칙 도입 이전에 규약을 정확히 지켰던 필드는 즉시 강제하지 않는다"는 §5.4 비소급 원칙을 **금지 조합 축**까지 유추 적용한 것이다. spec §5.4 문면은 이미 "DTO 선언 형태" 까지 포함하도록 갱신돼 있어 문언상 모순은 없으나, 이 축(선언 형태의 *조합* 금지)이 원래 비소급 조항이 예정한 대상(표현 선택 백로그)과 정확히 같은 사례인지는 spec 텍스트만으로는 애매하다. 다만 이는 새로운 위반이 아니라 **이미 한 차례 `--spec` 리뷰(INFO#1)에서 식별·수용된 유추**이고, 이번 diff 는 그 유추를 코드 가드로 구현했을 뿐이다.
  - 제안: spec 정정 의무는 없음(계획서에 이미 유추 적용임이 명시돼 있고 방향 전환도 없음). 다음에 §5.4 를 편집할 기회가 있으면 "DTO 선언 형태 위반 조합"도 비소급 대상에 포함된다는 문장을 한 줄 보태 유추를 명문화하면 이 항목은 닫힌다 — 급하지 않음.

## 정합성이 확인된 주요 지점 (참고용, 위반 아님)

- **§5.4 부재 표현 규칙 준수**: `TriggerDto`/`ScheduleTriggerRefDto` 의 신규 필드(`chatChannelHealth` 등 7종, `workflow?`)는 전부 §5.4 표의 두 형태(상시 존재→`@ApiProperty({nullable:true})`, 선택적 부가 컨텍스트→`@ApiPropertyOptional()` + 기준 (a)/(b) 명시)를 그대로 따른다. `ScheduleDto.trigger` 를 종전 키 생략에서 필수·상시 존재로 뒤집은 것도 실측(4개 경로 전부 채움)과 함께 새 Rationale(코드 주석 + `review/consistency/2026/09/05/21_40_38` W1 인용)을 동반해 "무근거 번복" 에 해당하지 않는다.
- **secret-store.md §1.1 준수**: `triggerToken` 응답 노출 금지 근거 (c)("발급 응답에 1회만 노출")가 목록·상세 응답 유출로 무너지는 것을 `INTERACTION_RESPONSE_STRIP_KEYS` 로 봉합했고, 계획서의 "RED 는 응답 스트립으로만 해소하고 DTO 선언으로 해소하지 말 것" 경고(§5.4 drift 배치 2단계 항목)를 정확히 따랐다 — `notificationSecretV2`/`chatChannelTokenV2` 를 DTO 에 선언해 위반을 "합법화" 하는 기각된 경로를 taking 하지 않았다.
- **§5.4 "검증 층" 구조 위반 없음**: 신규 축(`findOptionalNullableResponseFields`)은 별도 3번째 검증자를 신설한 것이 아니라 이미 spec §5.4 "검증 층" 표에 등재된 `swagger-dto-contract-guard.ts`(선언↔선언, 정적) 내부에 축을 추가한 것이다. §5.4 가 "판정 규칙 상세는 코드 JSDoc 이 단일 진실, spec 에 옮기면 drift 소스만 는다" 고 명시적으로 위임했으므로 spec 미갱신은 결함이 아니라 규정된 동작이다.
- **자기 반증형 소정정 패턴**: `contractForDto` JSDoc 의 "worker 단위"→"테스트 파일 단위" 캐시 격리 정정은 코드 주석 내에서 실측 인용(`review/code/2026/09/05/21_40_37` W2)과 함께 이뤄져 CLAUDE.md 의 자기반증 원칙과 형태가 같다(단, 이는 `spec/` 문서가 아니라 코드 JSDoc이라 그 예외 조항의 직접 적용 대상은 아니다).
- **PR 내부 자기 교정도 은폐 없이 기록됨**: "§5.4 금지 조합"을 이 PR 초판이 스스로 어겼다가(17개 필드) 같은 세션에서 되돌린 이력이 `CHANGELOG.md`·plan 파일·신규 래칫 가드 세 곳에 모두 남아 있어, "결정의 무근거 번복" 이 아니라 감사 가능한 자기 교정이다.

## 요약

이 브랜치는 `spec/5-system/2-api-convention.md §5.4`(부재 표현·DTO 선언 3형태)와
`spec/conventions/secret-store.md §1.1`(민감 필드 응답 노출 금지)에 이미 확정된 Rationale을
정확히 그 문면대로 구현·확장하는 코드 전용 PR이다. 트리거/스케줄 응답의 비밀 필드 스트립
확장(`sanitizeForResponse`), `ScheduleDto.trigger` 필수화, 신규 DTO 필드의 null-vs-omission
선택은 전부 §5.4 기준 (a)/(b)에 근거를 남기며, 과거에 기각된 대안(예: `select:false` 컬럼
숨김 — fail-silent 우려로 명시적으로 배제 유지, DTO 선언으로 시크릿 노출을 "해소"하는
경로 — 계획서가 명시적으로 금지)을 재도입하지 않았다. PR 초판이 §5.4 금지 조합을 스스로
어겼던 사건도 은폐 없이 CHANGELOG·plan·코드 가드 세 곳에 남아 있어 감사 가능하다. Rationale
연속성 관점에서 위반 사례는 발견되지 않았고, 유일한 INFO는 이미 계획서 단계에서 식별된
"유추 적용" 문구를 spec 본문에 한 줄 더 명문화하면 좋겠다는 낮은 우선순위 제안이다.

## 위험도
NONE
