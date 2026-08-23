# Plan 정합성 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 검토 범위 메모

본 target 은 `spec/5-system/`(전체 번들, 컨텍스트 예산으로 다수 파일 절단됨)이지만, `origin/main..HEAD`
diff 를 직접 확인한 결과 **이 브랜치(`rerun-dto-shorthand-730035`)가 실제로 작성한 커밋은
`re-run.dto.ts` open-map 수정 1건뿐**이다(`33b4c8dbb`, `236ea668a`, `b7805c70c`). `spec/5-system/14-external-interaction-api.md`
등에서 두-점(`..`) diff 상 "되돌려진 것처럼" 보이는 변경(`node-output-allowlist.ts` 삭제 등)은
이 브랜치가 만든 것이 아니라 **origin/main 이 이 브랜치의 merge-base(`04fe5962f`) 이후 별도로
5개 커밋을 더 쌓은 결과**(마커 재제출 가드 통합 작업, `b677564e0`·`4287cdd5b` 등)다. 다른
worktree/branch 간 동시 작업 분기는 검토 대상이 아니므로(병렬 세션 충돌은 `/merge-coordinate`
책임) 이 divergence 자체는 findings 에 포함하지 않았다.

## 발견사항

- **[WARNING]** Swagger `createDocument` boilerplate 의 "4번째 사례" 임계값을 이 PR 이 이미
  충족했는데 그 사실이 어느 `plan/in-progress/**` 에도 기록되지 않았다
  - target 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts`(신설, 이번
    커밋 `33b4c8dbb`/`236ea668a`) — `SwaggerModule.createDocument` + `ApiResponseSchemaHost['schema']`
    파생 패턴
  - 관련 plan: `plan/in-progress/eia-context-schema-followups.md` §잔여(체크리스트) 의
    `- [ ] EIA dto/responses spec 의 Swagger buildDocument 보일러플레이트 dedup` 항목(트리거
    ="3번째 스키마 회귀 spec 추가 시점", 2026-08-08 시점 실측 "2곳"으로 등재) — 이 항목이
    같은 계열의 유일한 살아있는(sealed 아닌) 추적처다
  - 상세: 저장소 전체에서 이 패턴(`SwaggerModule.createDocument` + `ApiResponseSchemaHost['schema']`
    파생)을 쓰는 스펙 파일을 실측하면(`grep -rl "SwaggerModule.createDocument\|ApiResponseSchemaHost"
    codebase/backend/src --include="*.spec.ts"`) 현재 **4개**다: `workflows/workflows-execute-body.spec.ts`
    (이 브랜치 착수 전부터 존재, PR #1201) · `external-interaction/dto/responses/execution-status-response.dto.spec.ts` ·
    `external-interaction/dto/responses/interact-ack-response.dto.spec.ts` · 그리고 이번에
    신설된 `executions/dto/re-run.dto.spec.ts`. 이번 브랜치 자체의 `/ai-review` 두 라운드가
    이 사실을 **서로 다르게 집계**했다 — `20_36_01` testing.md 는 `workflows-execute-body.spec.ts`
    를 세지 않고 "3번째 중복"이라 적었고, 뒤 라운드 `20_58_05` maintainability.md 는 "자매
    스펙 3개(`workflows-execute-body.spec.ts` 등)"라 정정해 이 파일이 **사실은 4번째**임을
    스스로 밝혔다. 그런데도 두 라운드 모두 결론은 "4번째 유사 스펙이 생기는 시점에 공유
    헬퍼 추출"로 남았다 — **이미 4번째인 이 파일 자신을 미래형 트리거로 미룬 것**이다.
    이 판단·근거는 `review/code/2026/08/23/{20_36_01,20_58_05}/*.md`(SoT 아님, sealed)와
    `plan/complete/rerun-dto-shorthand.md`(sealed) prose 에만 남아 있고, 살아있는
    `plan/in-progress/eia-context-schema-followups.md` 의 동일 계열 항목은 여전히 "EIA
    `dto/responses` 2곳, 트리거 미도달"이라는 2026-08-08 시점 좁은 스코프·수치 그대로다 —
    두 트래커가 서로 다른 스코프(EIA `dto/responses` 전용 vs 전 모듈)·다른 카운트로 같은
    기술부채를 이중 장부화하고 있고, 어느 쪽도 "지금 4개다"라는 사실을 반영하지 않는다.
    다음 세션이 5번째 유사 DTO 스펙을 추가할 때 이 문서고고학을 다시 하지 않는 한 임계값이
    이미 넘었다는 걸 알 방법이 없다.
  - 제안: `plan/in-progress/eia-context-schema-followups.md` §잔여의 해당 항목을 갱신해
    (a) 스코프를 "EIA `dto/responses`" 로 좁게 유지할지 전 모듈로 넓힐지 명시적으로 재결정하고,
    (b) 현재 실측 카운트(4개, 3개 모듈)를 반영하거나, 별도로 `spec-sync-external-interaction-api-gaps.md`
    (이번 DTO 작업이 실제로 등재됐던 트래커)에 새 체크박스로 "Swagger boilerplate 공유 헬퍼
    추출 — 4번째 사례 도달(`re-run.dto.spec.ts`), 실제 착수는 다음 터치 시점" 을 명문화할 것.
    review/** 산출물이나 sealed plan/complete/ 의 prose 는 다음 세션의 backlog 탐색 경로가
    아니므로 SoT 로 기능하지 않는다.

## 요약

이 브랜치의 실질 변경은 `re-run.dto.ts` 의 `inputOverride` 를 OpenAPI 축약형(`type: Object`)에서
명시적 열린 map(`type:'object', additionalProperties:true`)으로 바꾸는 좁은 범위 수정이며, 그
자체는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 대응 체크박스를 정확히
`[x]` 로 플립하고 완료 plan(`plan/complete/rerun-dto-shorthand.md`)으로 봉인하는 등 plan
라이프사이클 절차를 잘 따랐다 — 미해결 결정을 우회하거나 선행 plan 을 무시한 CRITICAL 급 충돌은
발견되지 않았다. 다만 이 PR 이 신설한 회귀 테스트가 저장소 전체 기준 "Swagger boilerplate 공유
헬퍼 추출" 이라는 자체 선언 임계값(4번째 사례)을 이미 충족시켰는데도, 그 사실이 살아있는
`plan/in-progress/**` 어디에도 반영되지 않고 review 산출물과 sealed plan 안에만 흩어져 있다는
후속 항목 추적 갭이 하나 있다(WARNING). target(`spec/5-system/`) 자체는 이 브랜치 커밋으로 변경된
바가 없다 — 두-점 diff 상 보이는 spec 변경분은 origin/main 이 이후 별도로 진행한 마커 가드
통합 작업(동시 브랜치 분기)이며 본 검토 범위 밖이다.

## 위험도

LOW
