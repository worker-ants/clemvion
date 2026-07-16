# RESOLUTION — W4/W2 후속 ai-review (14_32_05)

## 조치 항목

| SUMMARY # | 발견 | 조치 | commit |
|---|---|---|---|
| W1 (requirement + documentation) | SPEC-DRIFT: `spec/conventions/cafe24-api-metadata.md` 가 이제 없는 `Cafe24McpToolProvider.buildJsonSchema()` 를 "실제 production 구현" 으로 지목 (본 리팩터가 로직을 shared `operation-tool-schema.ts` 로 이관해 심화) | §2:153 헤더·§7 pseudo-code(391)·§7:398 말미 3곳을 `tool-providers/operation-tool-schema.ts` 의 `buildOperationJsonSchema()`(cafe24/makeshop 공유)로 정정. 타깃은 2 reviewer + 코드 diff 로 검증. makeshop-api-metadata.md·타 spec 은 제거 심볼 무참조 확인. | 본 커밋 |
| I1 (requirement) | oneOf 필터 후 `.fields` 접근 `?? []` 방어 완화 — concrete 카탈로그는 항상 `fields` 필수라 byte-identical, DRIFT-0 위반 아님 | 조치 불요 (기록). malformed 입력 시 과거 TypeError→현재 `anyOf: []`(무해). | — |
| I2 (requirement) | makeshop `.parameters` 직접 assert 통합 테스트 부재 — 본 PR 이전부터 존재(diff 밖) | 조치 불요. drift-0 identity + 신규 shared spec 간접 커버. 후속 backlog 검토 가능. | — |
| I3 (documentation) | 순수 내부 리팩터라 README/API/.env/CHANGELOG 갱신 불요(동작 불변) | 조치 불요 (기록). | — |

**Critical 0.** 코드 결함 없음(동작 불변 drift-0 리팩터). 유일 조치는 W1 spec pointer 정정.

## TEST 결과

직전 TEST WORKFLOW (구현 커밋 40de25889 직후):
- lint: 통과 (35s)
- unit: 통과 (backend 411 suites / 8207 tests, frontend·web-chat·channel-web-chat 포함)
- build: 통과 (tsc clean — eslint --fix 후 캐스트 제거 없음 확인)
- e2e: 통과 (256/256)

**재수행 불요 근거**: W1 조치는 `spec/conventions/cafe24-api-metadata.md` **문서 pointer 3줄 정정뿐**이며 코드·테스트 파일 무변경(`git diff` 로 spec 단일 파일 확인). 테스트가 커버하는 런타임 동작은 전혀 바뀌지 않아 직전 통과분이 유효하다.

## 보류·후속 항목

- I2 (makeshop `.parameters` 직접 assert 커버리지 갭): 본 PR 범위 밖(사전 존재). 필요 시 별도 backlog.
- (impl-prep 13_55_11 의 pre-existing Critical 2건 — out 포트 모순·count_max vs 카탈로그 — 은 W4/W2 무관, `task_3ac39ebd` project-planner 위임 유지.)
