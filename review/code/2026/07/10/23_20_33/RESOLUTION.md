# RESOLUTION — EIA getStatus context 스키마화 (review 23_20_33)

Critical 0 / Warning 5. Warning 5건 **전부 수정**(defer 없음). 수동 처리(main).

## 조치 항목

| SUMMARY # | 검출 reviewer | 내용 | 조치 | commit |
| --- | --- | --- | --- | --- |
| W1 | documentation | `responses.dto.ts` 의 spec 상대링크 4곳이 5단계(`../`×5)라 `codebase/spec/...` 로 깨짐. 루트까지는 6단계 | 4곳 `../`×6 으로 정정. `os.path.exists` 로 4/4 EXISTS 재검증 | `efc9e791e` |
| W2 | maintainability | `WaitingContextBaseDto`(abstract·비-export) vs `WaitingContextBase`(export type) 근접 동명 쌍. 후자가 부모 대신 **형제** `NodeOutputContextDto` 에서 `Pick` — variant 가 필드를 override 하면 조용히 어긋남 | `WaitingContextBaseDto` 를 export 하고 `WaitingContextBase` alias **삭제**. 서비스는 base 클래스로 직접 annotate. export 사유(spread widening)를 클래스 JSDoc 에 명시 | `efc9e791e` |
| W3 | testing | `expect(context.type).not.toBe('object')` — 어떤 값이든 통과하는 약한 negative assertion | `toBeUndefined()` 로 강화 | `efc9e791e` |
| W4 | testing | `currentNode.allOf ?? [{ $ref: currentNode.$ref }]` — `??` 우측이 영구 도달 불가(죽은 분기) | 실측 확정 shape(`allOf`)을 직접 단언 | `efc9e791e` |
| W5(a) | testing | 신규 `conversationThread` 부재 테스트가 기존 테스트와 실질 중복(동일 fixture `ai_conversation`+`null` thread) | 미커버 조합인 **`buttons` variant + thread 부재**로 교체 | `efc9e791e` |
| W5(b) | testing | 본 PR 핵심 대상인 `buttons`/`buttonConfig` variant 의 **e2e 커버리지 전무**(`ai_conversation` 만 존재) | `external-interaction.e2e-spec.ts` 에 `I-2` 신규 — 실 HTTP+DB round-trip 으로 buttonConfig variant 선택·`nodeOutput` 키 부재·`conversationThread` 키 생략·형제 `null` 공존을 함께 검증 | `efc9e791e` |

### 미조치 (INFO, 근거)

- **api_contract INFO** — variant 에 `additionalProperties: false` 가 없어 `oneOf` 상호배타가 스키마 레벨로 강제되지 않음. 조립부가 두 키를 동시에 싣는 분기가 존재하지 않고(진리표 검증됨), `false` 를 걸면 향후 봉투 필드 추가 시 기존 클라이언트가 깨진다. 실질 위험 없어 미조치.
- **maintainability INFO** — `getStatus` 길이(≈115줄) → `buildWaitingContext()` 추출. 본 PR 은 런타임 무변경이 계약이라 추출 리팩터는 범위 밖. 다음 관련 변경 시 후보.

## TEST 결과

fix 후 TEST WORKFLOW 전 단계 재수행 (§8 순서대로):

| 단계 | 결과 |
| --- | --- |
| lint | **PASS** (79s) |
| unit | **PASS** (57s) |
| build | **PASS** (107s) |
| e2e | **통과** — 250 passed (fix 전 249 → 신규 `I-2` 1건 증가) |

## 보류·후속 항목

없음 (Warning 5건 전부 본 PR 에서 해소).

아래 2건은 review INFO 에서 파생된 **별도 후속**으로 `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` §후속 에 등재:

1. `external-interaction` 모듈 `dto/responses.dto.ts` flat → `dto/responses/` 서브디렉토리 이관 (swagger.md §5-1 — 25개 모듈 중 본 모듈만 미준수. impl-prep W1).
2. 위젯 `eia-types.ts` `ExecutionStatus.context` 를 variant union 으로 좁히기 (현재 backend 만 정밀화된 타입 비대칭).

## 비고 — stale base

리뷰 시점 `origin/main..HEAD` diff 에 `spec/7-channel-web-chat/1-widget-app.md` §R7 삭제가 나타나 requirement·documentation 두 reviewer 가 독립 지적했다. 우리 두 커밋이 건드리지 않은 파일로, 분기 이후 **PR #899(`52f46f95f`)가 origin/main 에 먼저 병합**된 데 따른 아티팩트였다. `origin/main` 으로 rebase 완료(충돌 없음 — #899 는 본 PR 의 spec 3파일과 무접점). 리뷰 결론에는 영향 없음.
