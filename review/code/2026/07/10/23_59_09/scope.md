# 변경 범위(Scope) 리뷰 — commit `efc9e791e`

대상: `refactor(external-interaction): ai-review Warning 5건 반영`
기준: 직전 리뷰 SUMMARY(`review/code/2026/07/10/23_20_33/SUMMARY.md`) Warning 5건(W1~W5) + 동반 `RESOLUTION.md`

`git show efc9e791e --stat` 기준 19개 파일 변경(1092 insertions / 27 deletions). 실제 애플리케이션 코드 변경은 5개 파일뿐이고, 나머지 14개는 (a) 직전 리뷰 세션(`review/code/2026/07/10/23_20_33/`)의 산출물을 최초로 커밋에 편입한 것(SUMMARY/RESOLUTION/9개 reviewer .md/`_retry_state.json`/`meta.json`)과 (b) plan 체크리스트 1건이다. 프로젝트 관례(`review/` 는 gitignore 대상이 아니며 SUMMARY/RESOLUTION 도 커밋해야 함)에 정확히 부합하므로 이 14개 파일 자체는 범위 이탈이 아니다.

## 발견사항

- **[INFO]** 코드 diff 는 W1~W5 에 1:1 정확히 대응, 추가 리팩터·기능 확장 없음
  - 위치: `codebase/backend/src/modules/external-interaction/{dto/responses.dto.ts, dto/responses.dto.spec.ts, interaction.service.ts, interaction.service.spec.ts}`, `codebase/backend/test/external-interaction.e2e-spec.ts`
  - 상세: `git show efc9e791e` 를 파일별로 직접 확인했다.
    - **W1**(링크 off-by-one): `responses.dto.ts` 의 상대링크 4곳을 `../`×5 → `../`×6 으로 정정. 리포 루트 기준 경로가 실제로 존재하는지 `os.path.exists` 로 재검증(EXISTS) — 딱 그 4곳만 변경, 다른 텍스트 변경 없음.
    - **W2**(근접 동명 타입 혼동): `abstract class WaitingContextBaseDto` 에 `export` 추가, `export type WaitingContextBase = Pick<...>` 삭제, `interaction.service.ts` import/사용처를 `WaitingContextBaseDto` 로 교체. `grep -rn "WaitingContextBase\b" codebase/backend/src` 로 재검증 — 옛 이름을 참조하는 잔존 코드 0건(문서/리뷰 산출물 텍스트만 옛 이름 언급, 무해).
    - **W3**: `expect(context.type).not.toBe('object')` → `expect(context.type).toBeUndefined()`. 딱 1줄.
    - **W4**: `expect(currentNode.allOf ?? [{ $ref: ... }])` → `expect(currentNode.allOf)`. 딱 1줄(`??` fallback 제거).
    - **W5(a)**: `interaction.service.spec.ts` 의 중복 테스트를 `ai_agent`+`ai_conversation` fixture 에서 `Carousel`+`buttons`+`buttonConfig` fixture 로 교체, `expect('buttonConfig' in ctx).toBe(true)` 단언 추가. `Carousel`/`buttons` 조합은 같은 파일 내 이미 4곳에서 쓰이던 기존 패턴(신규 도입 아님).
    - **W5(b)**: `external-interaction.e2e-spec.ts` 에 `I-2` 신규 1건(55줄) 추가. 사용 헬퍼(`createTriggerWithInteraction`/`mintInteractionToken`/`nextE2eClientIp`/`randomUUID`) 전부 기존 import — 신규 import·신규 헬퍼 도입 없음.
  - 판정: 5개 코드 파일 diff 전부가 SUMMARY 의 해당 Warning 서술과 정확히 대응하며, 그 외 로직 변경·포맷팅 변경·불필요한 리팩터는 발견되지 않았다(공백-only 추가 라인 grep 결과 0건).

- **[INFO]** JSDoc/주석 추가는 각 Warning 수정의 근거 설명으로 범위 내
  - 위치: `responses.dto.ts:83-89`(W2 관련 신규 JSDoc 문단 — `export` 사유), `responses.dto.spec.ts:72,80`(W3/W4 관련 1줄 주석), `interaction.service.ts:307`(W2 관련 1줄 주석), `interaction.service.spec.ts:550-552`(W5(a) 관련 3줄 주석)
  - 상세: 모두 바로 위/아래에서 바뀐 코드가 "왜" 그렇게 바뀌었는지 설명하는 근접 주석이다. 무관한 기존 주석의 삭제·수정은 없음(diff 상 순수 컨텍스트 라인으로 유지된 기존 주석과 대조 확인).
  - 판정: 불필요한 주석 변경 아님, 각 Warning fix 의 직접 부속물.

- **[INFO]** plan 체크리스트 갱신은 본 fix 작업 자체의 상태 기록 — 범위 내
  - 위치: `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md:174-182`
  - 상세: 테스트 건수(`14건`→`15건`, `it.each` 2쌍 포함해 실제로 15건임을 `grep -n "it(\|it\.each"` 로 재검증 — 이 15건 자체는 이전 세션 이미 존재, 이번 커밋이 생성한 게 아니라 서술 정정) · e2e 249→250 · `/ai-review` 체크·`Warning 5건 fix`·`origin/main rebase` 항목 추가. 전부 "이 리뷰-수정 사이클을 거쳤다"는 사실 기록이며 새로운 작업 항목·요구사항 추가가 아니다.
  - 판정: 범위 내 정상 bookkeeping.

- **[WARNING]** `RESOLUTION.md` 의 `commit` 컬럼이 커밋 `efc9e791e` 시점에는 존재하지 않는 해시(`d47e0d4d5`)를 가리킴
  - 위치: `review/code/2026/07/10/23_20_33/RESOLUTION.md` (커밋 `efc9e791e` 로 신규 추가된 버전, W1~W5(b) 6개 행 전부의 `commit` 컬럼)
  - 상세: `git cat-file -e d47e0d4d5` → `fatal: Not a valid object name` — 이 리포지토리에 존재하지 않는 오브젝트다. `efc9e791e` 자신이 이 파일을 처음 생성하는 커밋이므로, 작성 시점에 자기 자신의 최종 해시를 알 수 없어 추정치(placeholder)를 적어 넣은 것으로 보인다(선-계산된 해시가 실제 커밋 해시와 어긋난 전형적 chicken-and-egg 오류). 다만 이 오류는 **바로 다음 커밋 `b1d69ed8c`("docs(review): RESOLUTION 조치 commit hash 정정", 같은 세션 13초 후)에서 6곳 전부 `efc9e791e` 로 정정**되어 있다 — 그러나 `b1d69ed8c` 는 이번 리뷰 대상(`efc9e791e`) 에 포함되지 않으므로, **`efc9e791e` 단독 스냅샷 기준으로는 RESOLUTION.md 의 commit 참조가 부정확한 상태로 커밋되었다**는 점은 사실이다.
  - 제안: 이번 리뷰 시점 기준으로는 이미 후속 커밋으로 해소되어 있어 재조치 불요. 다만 향후 유사 패턴(같은 커밋이 자신의 해시를 문서에 기록해야 하는 경우)에서는 `git commit --amend` 로 동일 커밋에 합치거나, RESOLUTION 커밋 컬럼을 아예 생략하고 "본 커밋" 같은 상대 표현을 쓰는 것을 고려할 것.

- **[INFO]** `I-2` e2e 테스트는 W5(b) 서술과 정확히 일치, 무관한 검증 없음
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:411-461`
  - 상세: 테스트가 검증하는 4가지 — (a) `buttons`+`buttonConfig` → `ButtonsContextDto`(=buttonConfig) variant 선택, `nodeOutput` 키 부재, (b) durable thread 미기록 시 `conversationThread` 키 자체 부재(`null` 아님), (c) 형제 `result`/`error` 는 `null` 관례(부재 표현 2종 공존 확인), (d) `currentNode.interactionType` — 은 SUMMARY W5(b) 서술("buttonConfig variant 선택·nodeOutput 키 부재·conversationThread 키 생략·형제 null 공존을 함께 검증")과 커밋 메시지가 명시한 4항목에 정확히 대응한다. `currentNode.interactionType` 검증도 같은 응답 객체의 일관성 확인이지 별도 기능 테스트가 아니다. 인증/트리거 등록/전혀 다른 EIA 엔드포인트 등 무관한 표면을 건드리지 않음.
  - 판정: W5(b) 범위 내, 스코프 이탈 없음.

## 요약

코드 변경 5개 파일은 직전 리뷰의 Warning 5건(W1~W5(b))에 정확히 1:1 대응하며, 각 항목은 부분 수정 없이 전부 완결됐다(링크 4/4 재검증 EXISTS, 옛 타입명 잔존 참조 0건, 약한 assertion 2건 모두 강한 단언으로 교체, 테스트 중복 해소 + e2e 신규 추가 확인). 코드 외 변경(review 산출물 13개 신규 파일, plan 체크리스트 1건)은 프로젝트 관례상 커밋되어야 하는 문서화 부산물로 범위 이탈이 아니다. 유일한 흠은 `RESOLUTION.md` 의 `commit` 컬럼이 이 커밋(`efc9e791e`) 스냅샷 시점에 존재하지 않는 해시(`d47e0d4d5`)를 가리킨다는 점인데, 이는 자기 참조 해시의 구조적 한계(커밋 전 자신의 해시를 알 수 없음)에서 비롯된 것으로 바로 다음 커밋(`b1d69ed8c`, 같은 세션 13초 후)에서 6곳 전부 정정되어 있다. 새로운 기능·불필요한 리팩터·무관한 파일 수정·의미 없는 포맷팅 변경은 발견되지 않았다.

## 위험도

LOW
STATUS: SUCCESS
