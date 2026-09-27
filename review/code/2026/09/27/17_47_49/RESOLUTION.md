# RESOLUTION — 1R (`review/code/2026/09/27/17_47_49`, 판정 기준 HEAD `10af7d0e5`)

리뷰 뒤 `git status --short` 는 이 세션 디렉터리만(untracked), `git diff --stat HEAD` 는 빈 출력 — 리뷰어 9명 중 누구도 워크트리를
바꾸지 않았다. transcript 의 Write · Edit · `cp` · `mv` · `sed -i` · 리다이렉트도 세션 디렉터리 · scratch 밖으로는 0건.

## 조치 항목

| SUMMARY # | 판정 | 조치 | 커밋 |
|---|---|---|---|
| W1 (testing) 모델 설정 PATCH 에 유효 값 경로 e2e 없음 | 수용 | `test/patch-null-rejection.e2e-spec.ts` 에 «모델 설정 PATCH — 유효 값은 200 으로 저장되고, 생략한 키는 값이 그대로다» — 4필드 유효 값 PATCH 200 + 응답 `data` 일치, 이어 빈 바디 PATCH 200 + 값 유지. e2e 합계 458 → **459** (이 diff 가 더한 테스트는 이 하나) | `e5de5226c` |
| W2 (documentation) `endpointPath` 문서에 null 거부 없음 | 수용 | `update-trigger.dto.ts` JSDoc 에 «null 은 400 — 경로를 유지하려면 키 생략, 종전엔 200 과 함께 조용히 지워졌다», Swagger `description` 끝에 «null 은 400 VALIDATION_ERROR — 경로를 유지하려면 키를 생략한다» | `e5de5226c` |
| SPEC-DRIFT 1 (§5.4 tri-state 범위) | 코드 유지 | `--impl-prep` W2 로 이미 트래커 planner 항목 (10) 에 등재돼 있다(`plan/in-progress/spec-draft-nullable-notation-followups.md`). 새 조치 없음 | — |
| INFO 1 (43필드 표가 손으로 유지됨) | 조치 불요 | 표 스펙 docblock 이 이미 «새 필드는 자동 포착 아님» 을 적는다 | — |
| INFO 2 (다중 null 의 `details[]`) | 조치 불요 | `CustomValidationPipe` 의 다중 필드 매핑은 이 PR 이 바꾸지 않았다 — 데코레이터는 필드 단위다 | — |
| INFO 3 (`validationOptions.message` 가 고정 메시지를 덮음) | 조치 불요 | 전 호출부가 인자 없음. 덮는 것이 호출자가 원하는 동작일 수 있어 순서를 고정하지 않는다 | — |
| INFO 4 (`propertyKey as string`) | 조치 불요 | `PropertyDecorator` 타입을 반환하려면 `string \| symbol` 을 받아야 한다 — 스타일 차이 | — |
| INFO 5 · 6 · 7 | 조치 불요 | e2e 표 축약 · description 템플릿 · 데코레이터 위치 — 결함 아님(리뷰어도 그렇게 적었다) | — |
| INFO 8 (spec `code:` 미등재) | 조치 불요 | 트래커 planner 항목 (6) 에 모집단으로 이미 등재 | — |
| INFO 9 (교차 워크스페이스 참조 의심) | 조치 불요 | 트래커 «PATCH null 후속» 에 «미검증 · 보안 성격 — 착수 전 e2e 로 재현부터» 로 이미 등재 | — |
| INFO 10 (주석이 `plan/complete/` 를 앞질러 인용) | 마무리 커밋에서 해소 | plan 을 `plan/complete/patch-null-validation.md` 로 옮기는 커밋에서 경로가 맞는다 — 이동 뒤 `git show HEAD:<path>` 로 확인 | (마무리) |

## TEST 결과

- lint: PASS (`_test_logs/lint-20260927-180226.log`)
- unit: PASS (`_test_logs/unit-20260927-180324.log`)
- build: PASS (`_test_logs/build-20260927-180453.log`)
- e2e: 통과 — 459 passed / 459 (`_test_logs/e2e-20260927-180744.log`)
