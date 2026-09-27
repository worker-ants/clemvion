# 문서화(Documentation) 리뷰 — patch-null-validation (2R)

## 컨텍스트

이 diff 는 이전 리뷰 라운드(`review/code/2026/09/27/17_47_49`)가 낸 WARNING 2건(테스트 커버리지 갭·`endpointPath` 문서 갱신 누락)에 대한 조치 커밋(`e5de5226c`)과 그 RESOLUTION/SUMMARY 산출물(`3eec5f8be`)까지 포함한 전체 브랜치 diff다. 아래는 그 조치가 실제로 반영됐는지 재검증한 결과이며, 새로 발견한 항목만 별도 표시했다.

## 발견사항

- **[INFO]** (재확인, 신규 아님) 테스트 docblock 이 아직 존재하지 않는 경로를 인용한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts` 파일 상단 docblock(“이 표는 `plan/complete/patch-null-validation.md` §전수…”) — `Read` 로 확인한 현재 줄 번호는 28행. 같은 인용이 `plan/in-progress/spec-draft-nullable-notation-followups.md`(1457행 “완료 (2026-09-27, `plan/complete/patch-null-validation.md`)”, 1464행)에도 있다.
  - 상세: 인용 대상 plan 파일은 이 diff 시점 기준 여전히 `plan/in-progress/patch-null-validation.md` 에 있고 `plan/complete/`로 옮겨지지 않았다(`ls plan/complete/ | grep patch-null-validation` 0건, `plan/in-progress/patch-null-validation.md` 존재 확인). 1R 리뷰가 이미 이 항목을 지적했고(SUMMARY.md INFO #10) RESOLUTION.md 는 “마무리 커밋에서 해소 — 이동 뒤 `git show HEAD:<path>` 로 확인”으로 명시적으로 미룬 상태다. 즉 이 상태는 **의도된 지연**이며 새 결함이 아니다 — 다만 이 병합이 그 마무리 커밋 전에 일어나면 링크가 죽은 채로 남는다는 점만 재확인해 둔다.
  - 제안: 조치 불요(이미 트래커·RESOLUTION 에 등재, 마무리 커밋에서 plan 이동과 함께 해소 예정). 마무리 커밋에서 `grep -rn "plan/complete/patch-null-validation" codebase/ plan/` 로 재확인만 하면 된다.

- **[INFO]** 1R WARNING #2(`endpointPath` null-거부 미문서화) 조치 검증 — 정상 반영 확인
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` JSDoc(약 49-60행) 및 `@ApiPropertyOptional({ description: … })`(약 61-69행)
  - 상세: `e5de5226c` 커밋이 JSDoc 에 “`null` 은 400 `VALIDATION_ERROR` 로 거부한다(`IsOptionalNonNull`) — 경로를 유지하려면 키를 생략한다. 종전 `@IsOptional()` 은 null 을 통과시켜 웹훅 수신 경로가 200 과 함께 조용히 지워졌다.” 를, Swagger `description` 끝에 “null 은 400 VALIDATION_ERROR — 경로를 유지하려면 키를 생략한다.” 를 추가했다. 기존 서술(v4 UUID 강제·변경 시 404·schedule 타입 거부)과 충돌 없이 자연스럽게 이어진다. 1R WARNING 은 해소됐다.
  - 제안: 없음(확인용 기록).

- **[INFO]** 1R WARNING #1(모델 설정 PATCH happy-path e2e 부재) 조치 검증 — 정상 반영 확인
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts` — `it('모델 설정 PATCH — 유효 값은 200 으로 저장되고, 생략한 키는 값이 그대로다', …)`(약 267-288행), 바로 위 인라인 주석(약 265-266행)이 "왜 이 테스트가 필요한가"(모델 설정만 다른 e2e 로 유효값 경로를 안 밟음)를 설명한다.
  - 상세: 유효 값 4필드 PATCH → 200 + 응답 `data` 일치, 이어 빈 바디 PATCH → 200 + 값 유지까지 검증해 WARNING 이 요구한 두 가지(유효 값 경로, 키 생략 경로)를 모두 커버한다. 테스트 자체는 documentation 카테고리 결함은 아니지만, 이 테스트가 보강하는 문서적 계약("생략 = 값 유지")이 정확히 표현돼 있다.
  - 제안: 없음(확인용 기록).

- **[INFO]** CHANGELOG 항목 재확인 — 기준 충족, 새 커밋들은 추가 항목 불필요
  - 위치: `CHANGELOG.md:26-35`
  - 상세: 이번 diff 에 포함된 후속 커밋(`e5de5226c` 테스트+문서 보강, `10af7d0e5`/`3eec5f8be` plan·리뷰 산출물)은 제품 동작을 바꾸지 않으므로(이미 CHANGELOG 가 서술한 계약 그대로) `CHANGELOG.md` 상단 기준(“항목을 내지 않는다 — … 문서 · plan · 리뷰 산출물만의 변경”)에 따라 추가 항목이 필요 없다. 기존 항목(`## Unreleased — PATCH 에 null 을 보내면 500 대신 400 이다`)은 43필드·409→400·200→400(경로 삭제) 세 사례를 정확히 서술한다.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/patch-null-validation.md` 체크리스트의 `/ai-review`·`--impl-done` 미체크는 diff 시점 실제 상태와 일치
  - 위치: `plan/in-progress/patch-null-validation.md` 하단 `## 체크리스트`
  - 상세: 1R 리뷰·조치는 끝났지만 이 2R 리뷰가 아직 진행 중이고 `--impl-done` 도 아직 돌지 않았으므로, 두 항목이 미체크로 남아 있는 것은 stale 이 아니라 정확한 현재 상태다. (참고: memory `feedback_plan_checkbox_actual_state` — 체크는 "수행 후"에만 하는 규약과 부합.)
  - 제안: 없음. 이 2R 이 마무리되고 `--impl-done` 이 통과하면 그때 체크와 `plan/complete/` 이동을 한 커밋에서 함께 한다.

## 저장소 상태

리뷰 중 저장소 파일을 수정하지 않았다(뮤테이션 없음). `Read`/`Bash(grep, git show)` 만 사용했고 `git status --short` 는 확인하지 않았다(쓰기 작업이 없어 생략) — 필요시 재확인 가능.

## 요약

이 PR 은 문서화 관점에서 이미 높은 완성도를 갖췄고, 1R 코드 리뷰가 낸 두 건의 WARNING(모델 설정 PATCH happy-path e2e 부재, `endpointPath` JSDoc/Swagger 의 null-거부 미문서화)은 `e5de5226c` 커밋에서 정확하고 충분하게 조치됐다 — 재확인 결과 새로운 문서화 결함은 발견하지 못했다. 유일하게 남은 항목은 테스트 docblock 과 트래커 문서가 아직 `plan/in-progress/` 에 있는 plan 파일을 `plan/complete/patch-null-validation.md` 로 앞질러 인용하는 것인데, 이는 1R 이 이미 발견해 RESOLUTION.md 에 "마무리 커밋에서 해소"로 명시적으로 미뤄 둔 상태라 새 결함이 아니다 — 병합/마무리 커밋 시 plan 이동과 함께 그 경로가 실재하는지만 재확인하면 된다. CHANGELOG 항목은 기준(제품 동작 변화: API 에러 코드 500/409/200 → 400)을 정확히 충족하며, 이번 diff 에 포함된 후속 커밋들은 추가 CHANGELOG 항목이 필요 없다.

## 위험도

NONE
