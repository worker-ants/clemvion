# 정식 규약 준수 검토 — trigger-canary-hardening

## 검토 전제

- 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- **`spec/conventions/**` 델타 0개** — 이 브랜치는 정식 규약 문서 자체를 바꾸지 않았다. 실제 diff 는 `codebase/backend` 의 **테스트 전용 6개 파일**(트리거 비밀 컬럼 3중 사본 가드 신설 + `expectTriggerWorkflowRef` e2e 적용 확대 + 주석 정리)이다. 따라서 본 검토는 "그 테스트 diff 가 기존 `spec/conventions/**` 규약을 위반하는가" 를 중심으로 진행했다. 델타 0 자체는 위반 근거로 삼지 않았다.
- 예산 절단으로 프롬프트 번들에 없는 파일(`secret-store.md`, `review-citations.md`, `swagger.md`, `error-codes.md` 등 본문)은 워킹트리 절대경로에서 직접 `Read`/`grep` 하여 대조했다.

## 발견사항

- **[INFO]** 리뷰 인용 3건 삭제 — `review-citations.md` §1 "인용은 유지한다" 와의 긴장
  - target 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (헤더 docstring, 가드 3·5 케이스 docstring), `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` (`afterAll` 주석)
  - 위반 규약: `spec/conventions/review-citations.md` §1 "인용은 유지한다" (코드 주석의 리뷰 산출물 인용은 `review/**` 가 커밋되므로 이력으로 해소되는 것을 전제로 유지하는 관례) · §3 (`codebase/**` 코드·테스트 주석은 본 규약 적용 대상)
  - 상세: diff 가 세 지점에서 기존 **완전 형식**(전체 경로+세션 ID, §2 "권장" 형태) 리뷰 인용을 제거했다 — `review/code/2026/09/10/14_34_18 side_effect W2`(고아 `secret_store` row 관련), `review/code/2026/09/10/15_52_06 maintainability W3`(원문자 번호 표기가 규약을 깼다는 지적), `review/code/2026/09/10/16_26_57 documentation W1`(목록에서 ⑤ 누락). `review-citations.md` 는 "인용 형식"(bare vs 전체 경로)을 주로 규율하고 "삭제 금지"를 명문화하지는 않지만, §1 표제 자체가 인용의 지속성을 규약의 근거로 세운다. 다만 **동일 세션 ID(`14_34_18`/`15_52_06`/`16_26_57`)가 같은 두 파일 안에서 여전히 각각 다른 지적 라벨(`api_contract ④`·`testing W1`·`testing W3`·`testing INFO`)로 남아 있음**을 확인했다 — 즉 세션 자체의 인용이 파일에서 사라진 것이 아니라, **그 세션의 특정 지적 하나가 새 실측(§ "그 고아 row 가 무해함을 이제 두 경계에서 실측했다" 표)으로 대체되면서 그 개별 인용만 제거**된 것이다. 원래 주장("검증 안 됨")이 이번 커밋에서 실측으로 대체됐으므로 그 문장을 삭제한 것 자체는 자연스럽지만, 규약이 "인용은 유지한다"를 원칙으로 세운 문서인 만큼 대체 시에도 원 인용을 흔적으로 남기는 편(예: "~~구 인용~~ → 아래 실측으로 대체")이 더 안전했다.
  - 제안: 조치 불요에 가깝다 (동일 세션의 다른 인용이 파일에 남아 근거 추적이 가능하고, 삭제된 주장 자체가 새 실측으로 대체됐다). 다만 재발 시 참고할 수 있도록 `review-citations.md` §4 부근에 "주장이 실측으로 대체되면 그 인용을 지우고 새 근거로 교체해도 된다"는 문장을 명시적으로 추가하는 것을 고려할 만하다 (규약 갱신 성격의 제안).

## 준수 확인 (문제 없음으로 판정한 항목)

- **명명 규약**: 신설 가드 쌍 `trigger-secret-columns-guard.ts` + `trigger-secret-columns.spec.ts` 는 `codebase/backend/src/repo-guards/__tests__/` 의 기존 명명 패턴(`redis-fail-open-catalog-guard.ts`/`.spec.ts`, `masked-reject-callers-guard.ts`/`.spec.ts` 등)과 정확히 일치. 상수명 `CANONICAL_SOURCE`/`CANONICAL_CONST`/`MIRROR_SOURCES`/`MIRROR_CONST` 도 참조하는 실제 식별자(`TRIGGER_RESPONSE_STRIP_COLUMNS`, `TRIGGER_SECRET_COLUMNS`)와 정확히 일치함을 워킹트리에서 직접 확인 (`triggers.service.ts:104`, `schedule-trigger-ref.ts:24`, `trigger-workflow-ref.ts:45`). `spec/conventions/secret-store.md:70` 이 이미 `TRIGGER_RESPONSE_STRIP_COLUMNS` 를 인용하고 있어 새 가드가 기존 SoT 와 drift 없이 정합.
- **secret-store.md §R4 인용 정확성**: `trigger-workflow-ref.e2e-spec.ts` 의 새 주석이 "R4 는 프로덕션 삭제 경로에만 적용되고 이 e2e teardown 은 그 범주 밖"이라고 설명하는데, `secret-store.md` §Rationale R4 원문("`ON DELETE CASCADE` 는 채택하지 않는다 — implicit DB 동작과 explicit application 동작이 섞이면 추적이 어려워지기 때문")과 대조 시 정확한 인용·해석이다. 왜곡 없음.
- **API 응답 계약 규약(swagger.md §5-1)과의 정합**: 새로 추가된 `expectTriggerWorkflowRef(row, { present: true, ... })` 호출은 `assertMatchesContract(row, await contractForDto(TriggerDto))` 직후에 위치하며, 이는 swagger.md §5-1 이 명시한 "선언끼리만 대조하는 정적 가드"와 "실제 응답의 초과 키를 잡는 런타임 계약 검증(`response-contract.ts`)"의 역할 분리, 그리고 diff 주석이 스스로 밝히듯 "`TriggerDto.workflow` 는 키 생략형이라 계약 대조가 부재를 위반으로 보지 않는다"는 사실과 정합적으로 보완 관계를 이룬다. 새 DTO·데코레이터 변경은 없다.
- **금지 항목**: 이 diff 는 테스트 전용이며 새 에러 코드·API endpoint·DTO·감사 액션을 도입하지 않는다. `error-codes.md`/`audit-actions.md`/`node-output.md` 등이 금지하는 패턴(인라인 action 문자열, 엔티티 그대로 노출 등)에 해당하는 변경이 없다.
- **정규식 대신 AST 사용**: 신설 가드(`trigger-secret-columns-guard.ts`)가 TypeScript AST(`typescript` 패키지)로 상수 배열을 읽는 방식은 형제 가드(`redis-fail-open-catalog-guard.ts`)와 동일한 기존 관례를 따른다 — 별도 `spec/conventions/` 문서화 대상은 아니나 저장소 전반의 가드 설계 관례와 어긋나지 않는다.

## 요약

이번 PR(`efb0e4b36`, 트리거 캐너리 하드닝)은 `spec/conventions/**` 문서를 전혀 변경하지 않으며, 실제 변경은 backend 테스트 6개 파일(비밀 컬럼 3중 사본 정합 가드 신설 + `TriggerDto.workflow` 응답 검증 확대 + 기존 주석 정리)에 국한된다. 검증 결과 신설 식별자·파일 명명은 `repo-guards/__tests__/` 의 기존 패턴과 완전히 일치하고, `secret-store.md` §R4·`swagger.md` §5-1 응답 계약 관례에 대한 인용·활용도 정확하다. 유일하게 짚을 점은 `review-citations.md` §1 "인용은 유지한다"의 취지와 다소 거리가 있는 리뷰 인용 3건 삭제인데, 동일 세션의 다른 인용이 같은 파일에 남아 있고 삭제된 주장 자체가 새 실측으로 대체된 맥락이라 실질적 위반으로 보기 어렵다(INFO). 정식 규약 관점에서 이 PR 을 차단할 사유는 없다.

## 위험도

LOW
