# AI Review SUMMARY (fresh) — fix commit `efc9e791e`

- scope: `--commit efc9e791e` (직전 리뷰 `23_20_33` 의 Warning 5건 fix 를 커버하는 **fresh review**)
- 사유: fix 로 `codebase/` 5개 파일이 원 리뷰 이후 변경 → 원 SUMMARY 가 stale. push gate 해소를 위한 fresh 리뷰 (RESOLUTION 만으로는 불충분).
- 실행 reviewer 8: testing · documentation · side_effect · maintainability · scope · security · requirement · api_contract
- skip: performance · dependency · database · concurrency · user_guide_sync · architecture — 본 커밋은 타입 rename + 테스트 보강 + 링크 정정으로 해당 표면 없음.

## 종합

| 항목 | 값 |
| --- | --- |
| **Critical** | **0** |
| **Warning** | **1** (이미 후속 커밋으로 해소 — 아래) |
| 위험도 | NONE ×6, LOW ×2 |

**추가 RESOLUTION 불요.** 유일한 Warning 은 리뷰 대상 스냅샷 밖에서 이미 정정됐고, 신규 조치 항목이 없다.

## Warning (자체 해소됨)

### W-fresh-1. `RESOLUTION.md` 의 commit 해시가 `efc9e791e` 스냅샷 시점엔 부재
**scope**

`RESOLUTION.md` 는 조치 커밋으로 `d47e0d4d5` 를 적었으나 `git cat-file -e d47e0d4d5` → invalid. RESOLUTION 을 생성하는 커밋 자신의 해시를 미리 알 수 없는 **self-reference chicken-and-egg** 구조적 한계.

→ **판정: 조치 불요.** 바로 다음 커밋 `b1d69ed8c`("docs(review): RESOLUTION 조치 commit hash 정정", 13초 후)가 6곳 전부 `efc9e791e` 로 정정했다. reviewer 본인도 "이미 후속 커밋으로 해소되어 재조치 불요" 로 결론.

## 실증 검증 (정적 독해 아님)

- **phantom 스키마 없음 — 3인 독립 실측**: `side_effect`·`security`·`requirement` 가 각각 임시 probe 로 `SwaggerModule.createDocument()` 를 실제 호출해 `components.schemas` 키를 덤프. 결과 `["ButtonsContextDto","NodeOutputContextDto","CurrentNodeDto","ExecutionStatusDto"]` — export 된 `abstract WaitingContextBaseDto` 는 등장하지 않는다(`@ApiExtraModels` 미등록). 세 reviewer 모두 probe 파일 삭제 + `git status` clean 확인.
- **OpenAPI 문서 동등성**: `api_contract` 가 커밋 전/후 `responses.dto.ts` 를 교차 실행해 `context.oneOf`·`nullable`·`required`·`additionalProperties`·`allOf` 가 동등함을 실측. 데코레이터 인자 변경 0건.
- **JSDoc 주장 재현**: `documentation` 이 `const base` 의 타입 annotation 을 실제로 지우고 `tsc --noEmit` 을 돌려, JSDoc 이 예고한 그 에러(`TS2322` at `interaction.service.ts:313`)가 정확히 발생함을 확인. 즉 "지우면 컴파일 에러로 드러난다" 는 주석이 사실.
- **W1 링크**: `realpath`/`test -f` 로 4/4 실존 확인.
- **W2 alias 제거**: `grep -rw WaitingContextBase` 전 리포(compiled `dist/` 포함) 0 매치.
- **W3/W4 단언**: 생성된 실 스키마에서 `context.type` 이 진짜 `undefined`, `currentNode.allOf` 가 진짜 존재함을 덤프로 확인.
- **W5(a) 커버리지 무손실**: 제거된 중복 테스트가 덮던 `ai_conversation` + thread 부재 조합은 기존 별 테스트(`interaction.service.spec.ts:771-790`)가 이미 커버함을 코드 추적으로 확인.
- **W5(b) e2e `I-2` 유효성**: envelope `res.body.data.context` 가 `TransformInterceptor` 래핑 계약(api-convention §5.1)과 일치. variant 선택이 회귀하면 `context.buttonConfig.buttons` 가 TypeError 로 크게 실패한다(vacuous pass 불가). DB fixture(`node.type='carousel'`, `category='presentation'`)가 실제 `V001__initial_schema.sql` 과 정합.
- **e2e 상태 누수 없음**: 본 e2e 파일은 원래부터 no-cleanup + `randomUUID()` 스코핑 컨벤션이며 `I-2` 도 동일. 인접 파일의 count 쿼리도 전부 execution_id/node_id 스코프.
- **하위 호환**: `WaitingContextBase` 타입 alias 제거는 `packages/sdk`(published `@workflow/sdk`)·`web-chat-sdk`·`channel-web-chat` 어디에서도 참조 0건 → breaking 아님. SDK 는 backend DTO 를 import 하지 않는 독립 손타이핑.
- **redaction 불변**: `deepRedactSecrets`(L280)·`redactThreadForPublic`(L266) 호출이 여전히 `base`/`context` 조립보다 앞서 실행. 타입 rename 3줄 외 diff 없음. `I-2` 는 시크릿을 seed 하지 않으며 기존 마스킹 테스트(I-1·J)를 대체·약화하지 않는다.
- 테스트 재실행: `responses.dto.spec.ts` 15/15, external-interaction 모듈 전체 220/220, eslint·`nest build` clean.

## Info (본 PR 미조치)

- **documentation**: 본 커밋 **밖**의 `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.types.ts:6` 에 **동일 클래스의 off-by-one 링크 버그**(`../`×4, 5단계 필요)가 있다. 회귀 아니고 본 커밋 범위 밖 — 지금 고치면 방금 통과한 이 fresh review 가 다시 stale 해진다. → 후속 plan 에 등재.
- **testing**: `npx tsc --noEmit -p tsconfig.json` 이 `interaction.service.spec.ts` 의 `as Record<string, unknown>` 캐스트(TS2352)를 지적하나, `git show 60c4c8900` 대조 결과 **이 fix 커밋 이전부터 존재**하고 `tsconfig.build.json` 이 `*.spec.ts` 를 제외하므로 빌드 영향 없음. 회귀 아님.
- **maintainability**: `NodeOutputContextDto` 라는 이름만으로는 그것이 `form`/`ai_conversation`/fallthrough `buttons` 3종을 담당하는 fallback variant 임이 드러나지 않는다. 클래스 JSDoc 이 명시하고 있어 허용 수준. 본 커밋이 만든 문제 아님.
- **scope**: 코드 diff 5파일이 W1~W5 에 1:1 정확 대응. 기회주의적 추가 변경·무관 파일·포맷팅 노이즈 0건. 나머지 14개 변경 파일은 프로젝트 관례상 커밋 대상인 `review/` 산출물 + plan 체크리스트.

## TEST WORKFLOW

본 fresh review 이후 `codebase/` 변경 없음 → 재수행 불요. 직전 상태(= 현재 코드) 기준 lint · unit · build · e2e(250) 전부 PASS 기록: `review/code/2026/07/10/23_20_33/RESOLUTION.md §TEST 결과`.
