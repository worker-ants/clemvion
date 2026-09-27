# 요구사항(Requirement) 리뷰 — patch-null-validation (2R, 1R fix 확인)

## 컨텍스트

이 라운드는 1R(`review/code/2026/09/27/17_47_49`)에서 나온 Warning 2건을 `e5de5226c` 로 조치하고,
그 결과를 문서화한 `3eec5f8be` 를 포함한 누적 diff다. `git show e5de5226c`, 실제 소스, e2e/lint/unit/build
로그(`_test_logs/*-20260927-18*.log`)를 직접 열어 1R 의 주장(RESOLUTION.md·SUMMARY.md)을 재검증했다.

## 발견사항

- **[INFO]** W1(모델 설정 PATCH 유효값 e2e 부재) 조치 확인 — `codebase/backend/test/patch-null-rejection.e2e-spec.ts` 끝에 추가된
  `모델 설정 PATCH — 유효 값은 200 으로 저장되고, 생략한 키는 값이 그대로다` 케이스가 실제로 (a) `provider`·`name`·`defaultModel`·`defaultParams`
  4필드를 유효값으로 PATCH → 200 + `data` 일치, (b) 빈 바디 PATCH → 200 + 직전 값 유지를 검증한다.
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts` (`e5de5226c` diff, 파일 끝 추가 블록)
  - 상세: `ids.modelConfig` 픽스처가 `kind: 'chat'` 으로 생성되므로 `defaultParams` PATCH 가 `model-config.service.ts` 의
    `if (dto.defaultParams !== undefined && config.kind === 'chat')` 분기를 실제로 타는지 직접 서비스 코드를 열어 확인했다 — 조건 충족.
    빈 바디 PATCH 는 서비스가 모든 필드를 `!== undefined` 가드로 묶어 두어 단순 재저장(no-op)이 되고 실패 경로가 없음을 확인했다.
    e2e 실측: 조치 전 `_test_logs/e2e-20260927-174241.log` = `458 passed`, 조치 후 `_test_logs/e2e-20260927-180744.log` = `459 passed` —
    RESOLUTION.md 의 "e2e 합계 458 → 459" 서술과 정확히 일치한다.
  - 제안: 없음 — 완전히 조치됨.

- **[INFO]** W2(`endpointPath` 문서 null-거부 미기재) 조치 확인 — `update-trigger.dto.ts` JSDoc 과 Swagger `description` 양쪽에
  "`null` 은 400 `VALIDATION_ERROR` 로 거부한다 ... 종전 `@IsOptional()` 은 null 을 통과시켜 웹훅 수신 경로가 200 과 함께 조용히 지워졌다"가
  추가됐다. CHANGELOG.md 가 명시한 핵심 동작 변화(경로 삭제 → 400)와 문구가 일치한다.
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` (`e5de5226c` diff)
  - 제안: 없음 — 완전히 조치됨.

- **[INFO]** SPEC-DRIFT 항목 처분 검토 — 1R 이 `[SPEC-DRIFT]` 로 분류한 `spec/5-system/2-api-convention.md` §5.4 항목을 `Read` 로 원문 재확인했다.
  블록쿼트 전문("적용 범위 — 응답 바디... 요청 바디는 대상이 아니다 — 특히 PATCH 부분 업데이트는 키 생략(=값 불변)·`null`(=초기화)·값(=설정)의
  tri-state 가 각각 의미를 갖는 별개 계약이라...")을 문맥까지 읽으면, 이 문장의 목적은 "§5.4 의 (키 생략 vs null) 응답 규칙을 요청 DTO 에
  그대로 적용하면 부분 갱신 계약이 깨진다"는 예외 근거 설명이지, "모든 PATCH 필드가 null=초기화 를 지원해야 한다"는 전칭 규칙 선언이 아니다.
  단독 문장만 발췌하면 43필드의 null-거부와 문면상 충돌해 보일 수 있다는 지적은 타당하나, 이 43필드는 전부 OpenAPI `nullable` 미선언
  필드이고 tri-state 대상(`extractionLlmConfigId`·`embeddingModelConfigId`·`llmConfigId` 등, 위 `update-knowledge-base.dto.ts` 확인)은
  이 PR 이 건드리지 않아 실제 충돌 인스턴스는 없다. **코드가 옳고 spec 문장이 오독 여지를 남긴 것**이므로 SPEC-DRIFT 분류가 맞다.
  - 위치: `spec/5-system/2-api-convention.md` §5.4 블록쿼트 (해당 spec 은 이 리뷰 diff 밖); 트래커 등재는
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (10) (diff 6402~6407행) — `Read`/`grep` 으로 실재 확인.
  - 제안: 코드 유지. spec 반영은 이미 트래커에 planner 항목으로 등재돼 있어 신규 조치 불필요 — 다음 planner 턴에서 §5.4 블록쿼트에
    "tri-state 의 null=초기화 분기는 `nullable: true` 선언 필드에만 적용" 한 문장만 추가하면 해소된다.

- **[INFO]** 43필드 전수 정합성 독립 재확인 — `grep -rn "@IsOptionalNonNull()" src --include='*.dto.ts' | wc -l` = **43**, 단위 테스트
  `patch-null-rejection.spec.ts` 의 `expect(CASES).toHaveLength(43)` 과 정확히 일치. `IsOptionalNonNull` 구현(`ValidateIf(v !== undefined)` +
  `IsDefined`)을 class-validator 의미대로 직접 추적한 결과: 키 생략(`undefined`) → 조건부 검증(ValidateIf) 이 property 전체를 skip →
  `{}` (에러 없음), `null` → skip 되지 않고 `IsDefined` + 타입 검증기가 모두 실행돼 두 constraint 가 동시에 실패 — 테스트 기대값
  (`{ name: ['isDefined', 'isString'] }` 등)과 정확히 일치. 기존에 `@ValidateIf()` 를 이미 쓰는 필드(`update-knowledge-base.dto.ts` 의
  `extractionLlmConfigId`/`embeddingModelConfigId`)는 `IsOptionalNonNull` 대상 필드와 겹치지 않아 conditional-validation 충돌도 없다.
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts`, `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts`
  - 제안: 없음 — 결함 아님, 기록용 확인.

- **[INFO]** TODO/FIXME/HACK/XXX — `git diff 10af7d0e5..3eec5f8be -- codebase`(이번 라운드에서 실제 코드가 바뀐 범위) 안에 매치 0건.

## 요약

이번 라운드는 1R 의 Warning 2건(모델 설정 PATCH happy-path e2e 부재, `endpointPath` 문서 갱신 누락)에 대한 후속 조치 diff이며,
직접 소스·로그를 열어 두 조치가 선언한 대로 완전히 구현됐음을 확인했다(e2e 458→459 실측 일치, JSDoc/Swagger 문구 CHANGELOG 와 부합).
새 결함·엣지 케이스 누락·반환값 오류를 찾지 못했다. 1R 이 SPEC-DRIFT 로 분류한 §5.4 tri-state 문장 모호성은 원문을 직접 재확인한 결과
"코드가 옳고 spec 문장이 오독 여지를 남긴" 케이스로 재확인되며, 이미 planner 트래커((10))에 등재돼 있어 이번 diff 를 막을 사유가 아니다.
Critical 은 없다.

## 위험도

NONE
