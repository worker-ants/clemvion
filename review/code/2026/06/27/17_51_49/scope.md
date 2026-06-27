# 변경 범위(Scope) 리뷰

## 발견사항

분석 기준 — 계획 문서(`plan/in-progress/mc-config-polish.md`)에 정의된 4개 항목과 1차 리뷰 RESOLUTION.md(I-1~I-17) 조치 지시사항을 기준으로 29개 파일 전체의 범위 이탈 여부를 검토한다.

### 긍정 — 범위 이탈 없음

**계획 4항목 ↔ 파일 대응:**

| 계획 항목 | 대응 파일 |
|-----------|-----------|
| (1) SENSITIVE_ACTION_THROTTLE SoT | `common/constants/throttle.ts`(신규), `llm-model-config.controller.ts`, `workspaces.controller.ts`, `spec/5-system/2-api-convention.md` |
| (2) MODEL_TYPE_ENUM/ModelTypeFilter DTO | `model-config/dto/model-type.ts`(신규), `llm-model-config.controller.ts`, `llm.service.ts` |
| (3) @ApiQuery enumName | `llm-model-config.controller.ts`(`enumName: 'ModelTypeFilter'` 추가) |
| (4) listModels cap 500 | `list-models-cap.ts`(신규), `list-models-cap.spec.ts`(신규), `llm.service.ts`, `llm.service.spec.ts`, `llm-preview.service.ts`, `llm-preview.service.spec.ts`, `spec/5-system/7-llm-client.md`, `spec/data-flow/7-llm-usage.md`, `spec/2-navigation/6-config.md` |

**Resolution 조치 ↔ 파일 대응:**

| Resolution # | 조치 | 대응 파일 |
|--------------|------|-----------|
| W-1 | `INVITATION_THROTTLE` const 선언을 모든 import 이후로 이동 | `workspaces.controller.ts` |
| W-3 | spy 복원을 `try/finally` 로 감싸 | `list-models-cap.spec.ts` |
| I-1 (SPEC) | api-convention §7 초대/sensitive-action tier 행 추가 | `spec/5-system/2-api-convention.md` |
| I-2 (SPEC) | 6-config §3 preview-models 행에 cap 500 보강 | `spec/2-navigation/6-config.md` |
| I-3 | 3 핸들러에 `@ApiTooManyRequestsResponse` 추가 | `llm-model-config.controller.ts` |
| I-7 | `SENSITIVE_ACTION_THROTTLE`에 `as const` 추가 | `common/constants/throttle.ts` |
| I-9 | 빈 배열 케이스 `toBe`(참조 동일)로 통일 | `list-models-cap.spec.ts` |
| I-13 | `capModelList` JSDoc `@param`/`@returns` 추가 | `list-models-cap.ts` |
| I-17 | `7-llm-client.md` frontmatter `code:`에 `list-models-cap.ts` 등록 | `spec/5-system/7-llm-client.md` |

**나머지 파일:**
- `plan/in-progress/mc-config-polish.md` — 프로젝트 규약상 plan 파일(정상)
- `review/code/2026/06/27/17_23_53/` 하위 15개 파일 — 1차 리뷰 산출물(RESOLUTION.md, SUMMARY.md, 에이전트별 리뷰 파일), 프로젝트 규약상 커밋 대상(정상)

**범위 이탈 가능성 검토:**
- `@ApiTooManyRequestsResponse` 3개 추가(I-3): 계획 원문에는 없지만 RESOLUTION.md에서 명시 조치된 항목 — 범위 내
- `workspaces.controller.ts` const 위치 이동(W-1): 계획 항목 (1)의 부수적 레이아웃 정리로 RESOLUTION.md 명시 — 범위 내
- spec 4개 파일 변경: plan 메모 "cap 은 같은 위치에 1줄씩 문서화" + RESOLUTION I-1·I-2·I-17 지시사항 이행 — 범위 내
- 포맷팅·공백·무관한 코드 수정: 없음
- 의도하지 않은 설정 파일 변경: 없음

## 요약

총 29개 파일(코드 10개 + plan 1개 + review 산출물 15개 + spec 4개) 전체가 계획 문서에서 정의한 4개 polish 항목과 1차 리뷰 RESOLUTION.md에서 명시한 조치 지시사항에 1:1 대응한다. 계획 범위를 초과하는 불필요한 리팩토링·기능 확장·무관한 파일 수정·포맷팅 오염은 발견되지 않는다. spec 4개 파일은 plan 메모와 resolution 지시에 따른 spec-impl 동기화로, developer 규약(구현 완료 후 spec 연결 코드 변경 시 동기화 의무)에 부합한다.

## 위험도

NONE

---

STATUS=success ISSUES=0
