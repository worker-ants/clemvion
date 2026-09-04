# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 대상 요약

실질 코드/테스트 변경은 3개 파일이다.

- `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — 죽은 쿼리 필드(`workflowId`) 제거 + 미사용 import(`IsUUID`, `Transform`) 정리 + 클래스 JSDoc 신설
- `codebase/backend/src/common/pipes/validation.pipe.spec.ts` — `forbidNonWhitelisted` 축을 고정하는 신규 `describe` 블록(테스트 2건)
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — `@Transform` 예외 JSDoc 재서술(로직 `findSwaggerContractMismatches` 불변, `Read` 로 확인)

나머지(`CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `review/code/2026/09/04/{18_34_04,18_56_22}/**`, `review/consistency/2026/09/04/18_51_26/**`)는 문서 또는 이전 리뷰·일관성 검토 라운드가 생성한 신규 리포트 산출물(prose/JSON, 로직 없음)이며, `CLAUDE.md` "정보 저장 위치" 관례상 `review/**` 에 영구 보존되는 것이 정상이라 함수 길이·중첩·순환 복잡도 등 코드 구조 지표 대상이 아니다. 아래 발견사항은 실질 코드/테스트 3파일과, 그것들이 문서화한 사실이 일치하는지에 집중했다.

이번 라운드는 직전 두 라운드(`18_34_04`, `18_56_22`)의 누적 diff를 다시 검토하는 구조다. `18_56_22` maintainability 리뷰가 낸 WARNING(같은 파일 안 언어 혼재)과 INFO(ephemeral 리뷰 세션 ID 인용)를 현재 저장소 상태로 재확인했다.

## 발견사항

- **[INFO]** (재확인, 해결됨) 직전 라운드가 지적한 언어 혼재·ephemeral 인용이 실제로 고쳐져 있다
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.spec.ts` — `Read` 로 파일 전체(117줄)를 직접 열어 확인
  - 상세: `18_56_22/maintainability.md` WARNING이 지적한 "신규 테스트 2건만 한국어, 기존 3건은 영어" 문제는 지금 신규 `describe('CustomValidationPipe — forbidNonWhitelisted', ...)` 블록의 두 `it()`(96행 `'rejects a key the DTO does not declare'`, 112행 `'accepts declared keys only — proves the assertion above is not vacuous'`)가 모두 영어로 다시 쓰여 있어 파일 전체가 영어로 통일됐다. 같은 라운드 INFO가 지적한 "ephemeral 리뷰 세션 ID(`18_34_04` W2)를 근거로 인용" 문제도 84행이 `Tracking: \`plan/in-progress/spec-draft-nullable-notation-followups.md\` §후속.` 로 SoT 문서를 가리키도록 교체돼 있다. 새 결함이 아니라 이전 발견이 실제로 닫혔다는 확인이라 조치 불요.
  - 제안: 없음(확인용 기록).

- **[INFO]** 같은 사건("QueryExecutionDto.workflowId 제거, 200→400, 실측 1,095/17/0")의 서술이 여전히 4곳(CHANGELOG, plan, DTO JSDoc, pipe spec JSDoc)에 중복된다
  - 위치: `CHANGELOG.md:23-40`(게이트, "영향"·"부수" 절) / `plan/in-progress/spec-draft-nullable-notation-followups.md:307-323`(게이트) / `codebase/backend/src/modules/executions/dto/query-execution.dto.ts:5-14`(게이트, 클래스 JSDoc) / `codebase/backend/src/common/pipes/validation.pipe.spec.ts:72-85`(게이트)
  - 상세: `18_34_04`·`18_56_22` 두 라운드가 이미 이 중복을 INFO로 지적했고 이번 라운드에서도 해소되지 않았다(구조를 바꾸는 조치는 없었다). 다만 정량 수치(1,095/17/0) 자체는 세 곳(CHANGELOG·plan·guard JSDoc)에서 `grep` 대조로 정확히 일치함을 재확인했고, `plan/...md:173` 에 남은 "1,096개" 구스냅샷은 그 문서 스스로 "잰 시점의 값" 캐비엇을 달아 의도된 것임을 확인했다 — 즉 중복이 아직 동기화 오류로 발현하지는 않았다. 두 라운드 연속 INFO로 유지되고 실질 피해(수치 drift)가 관측되지 않아 등급을 올릴 근거는 없다.
  - 제안: 조치 불요. 향후 다섯 번째 자리가 또 생기면 그때는 한쪽을 SoT로 지정하고 나머지는 링크로 축약하는 편을 고려.

- **[INFO]** `query-execution.dto.ts` 필드 제거 diff는 여전히 모범적
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` 전체(39줄, `Read` 로 재확인)
  - 상세: 죽은 필드(`workflowId`)와 함께 더는 쓰이지 않는 `IsUUID`(class-validator)·`Transform`(class-transformer) import를 정확히 제거했다. 남은 `status` 필드의 `@ApiPropertyOptional`/`@IsIn` 구조는 그대로라 diff 범위가 제거 대상에 정확히 국한된다.
  - 제안: 없음 — 긍정적 관찰.

- **[INFO]** `swagger-dto-contract-guard.ts` 변경은 순수 JSDoc 재서술, 로직 불변
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:92-121`(게이트) — `findSwaggerContractMismatches` 본문(122행 이하)은 `Read` 로 대조한 결과 diff 밖이며 `hasTopLevelNull`·`@Transform` 판정 조건(`!decorators.some((d) => d.name === 'Transform')`)이 모두 그대로다.
  - 제안: 없음.

CRITICAL/WARNING 은 발견되지 않았다.

## 요약

이번 diff의 실질 코드/테스트 변경(DTO 필드 제거 1건, 신규 단위 테스트 2건, JSDoc 재서술 1건)은 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 관점에서 구조적 영향이 없는 소규모 변경이다. 직전 두 라운드가 지적한 실질 결함 — 같은 파일 안 언어 혼재(WARNING), ephemeral 리뷰 세션 ID를 영구 주석 근거로 인용(INFO) — 은 이번 diff에서 실제로 고쳐져 있음을 `Read`로 직접 재확인했다. 유일하게 남는 것은 "workflowId 제거" 서사가 CHANGELOG·plan·DTO JSDoc·pipe spec JSDoc 네 곳에 중복 기재된 것인데, 두 라운드 연속 INFO로만 유지됐고 정량 수치는 세 곳 모두 `grep` 대조로 일치해 실질적 동기화 사고로 이어지지 않았다. 병합을 막을 유지보수성 결함은 없다.

## 위험도

NONE
