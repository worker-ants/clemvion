# 신규 식별자 충돌 검토 — naming_collision

검토 모드: `--impl-done` (origin/main 재베이스 후 재검토, PR #903 흡수분 포함)
diff-base: `origin/main` (`49c2185d1` #903 · `ab5abc1a6` #901 · `581d16811` #905 포함)
target: `spec/5-system/14-external-interaction-api.md`
검증 SoT: HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-execution-context-schema-9bb60b`) 절대경로 `git grep`/`git show` 직접 확인.

## 검증 방법

1. `git log --oneline origin/main -5` 로 리베이스가 #903(`49c2185d1`)·#901(`ab5abc1a6`)·#905(`581d16811`)를 실제로 흡수했음을 확인.
2. HEAD 워킹트리에서 `git grep -l`(node_modules/dist 제외)로 4개 신규 DTO 식별자 각각의 전체 사용처를 열거.
3. `STATUS_PROJECTION_COLUMNS` 를 도입한 커밋(`49c2185d1`)의 실제 diff 와 HEAD 의 `interaction.service.ts` 를 대조.
4. `2-api-convention.md`·`14-external-interaction-api.md`·#901/#905 가 손댄 4개 webchat spec 파일의 헤딩 목록을 전수 추출해 `5.4` 넘버링 충돌 여부 확인.

## 발견사항

### (a) 신규 DTO 4종 — 충돌 없음

- **`CurrentNodeDto`** / **`WaitingContextBaseDto`**(abstract, exported) / **`ButtonsContextDto`** / **`NodeOutputContextDto`**
  - 정의: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` (61·91·118·134행)
  - 전체 저장소 사용처(`git grep -l`, dist/node_modules 제외): `responses.dto.ts`, `responses.dto.spec.ts`, `interaction.service.ts`(type-only import), `spec/conventions/swagger.md`(§1-4 예시 코드 블록 — 본 PR 이 함께 갱신한 규약 문서, 실제 클래스 아님), `channel-web-chat/src/lib/eia-types.ts`(주석에서 `CurrentNodeDto` 를 텍스트로 언급할 뿐 별도 타입 선언 아님), `plan/complete/spec-draft-eia-context-schema-absence-convention.md`, `review/**`(과거 리뷰 산출물).
  - 4종 모두 이 PR 계열 이전에는 저장소 어디에도 존재하지 않던 이름이며, #903/#901/#905 diff 도 이 이름을 도입하지 않았다(아래 확인). 동일 이름의 기존 엔티티·다른 의미의 DTO 와 충돌 없음.
  - 판정: 충돌 없음.

### (b) `STATUS_PROJECTION_COLUMNS` (PR #903) — 충돌 없음

- #903(`49c2185d1`)이 `codebase/backend/src/modules/external-interaction/interaction.service.ts` 에 도입한 **module-private**(non-export) `const STATUS_PROJECTION_COLUMNS` — TypeORM `select` projection 컬럼 리스트, `satisfies (keyof Execution)[]`.
- HEAD 의 `interaction.service.ts` 67행에 그대로 존재. 본 브랜치의 `git diff origin/main...HEAD -- .../interaction.service.ts` 에는 이 식별자를 건드리는 라인이 **0건**(추가·삭제·참조 전무) — 본 브랜치는 `WaitingContextBaseDto` 타입 import 및 `getStatus()` 조립부 리팩터만 손댔다.
- 파일도 다르고(`interaction.service.ts` vs `responses.dto.ts`), 성격도 다르며(SQL projection 컬럼 배열 vs Swagger DTO 클래스), export 되지 않아 모듈 밖에서 이름이 보이지도 않는다. 이름 문자열 자체도 겹치지 않는다.
- 판정: 충돌 없음 (사용자 사전 예상대로).

### (c) spec 앵커 — `§5.4` 넘버링 중복은 파일이 다르고 이미 명시적으로 disambiguate 됨

- 본 브랜치(`c44673cfd`)가 신설한 것은 `spec/5-system/2-api-convention.md` 의 **새 `### 5.4 부재 표현 — null vs 키 생략`** 섹션(172행)이다. `14-external-interaction-api.md` 자신은 기존부터 **별도의** `### 5.4 명시적 취소`(482행, `POST /interact/.../cancel`) 를 갖고 있으며 본 브랜치는 이 섹션을 건드리지 않았다 — 두 "§5.4" 는 서로 다른 파일에 있는 동명 섹션 번호일 뿐, 마크다운 앵커 문자열은 각각 `#54-부재-표현--null-vs-키-생략` 과 `#54-명시적-취소--...` 로 실제로는 겹치지 않는다.
- 커밋 메시지 자체가 이 잠재적 혼동을 인지하고 있다: "`§5.3/§R17` 에 API 규약 §5.4 cross-ref 추가 (EIA 자신의 §5.4=명시적 취소 와 혼동되지 않도록 파일명 qualify)". 실제로 `14-external-interaction-api.md` 본문(§5.3 주석, §R17 Rationale)의 모든 신규 cross-ref 가 `[API 규약 §5.4](./2-api-convention.md#54-...)` 형태로 파일명을 명시해 qualify 하고 있음을 grep 으로 확인(`git grep -n "API 규약 §5.4"`).
- `#901`/`#905` 가 건드린 4개 webchat spec 파일(`spec/7-channel-web-chat/{1-widget-app,3-auth-session,4-security}.md`, `spec/conventions/conversation-thread.md`)의 전체 헤딩을 추출한 결과 **`5.4` 라는 섹션 번호를 가진 헤딩이 하나도 없다** — 이 두 PR 은 `§5.4` 앵커를 신설하지 않았으므로 본 브랜치의 신규 `§5.4`(`2-api-convention.md`)와 부딪힐 표면 자체가 없다.
- 저장소 전체에서 `§5.4` 문자열을 참조하는 곳(`git grep "§5\.4" -- spec/`)은 본 브랜치가 만든 `2-api-convention.md`/`14-external-interaction-api.md` 상호 참조뿐이며, 이미 파일명 qualify 로 모호성이 해소돼 있다.
- 판정: 신규 앵커 충돌 없음. (참고: 순수 "가독성" 관점에서 한 EIA 문서 안에 "§5.4"(자기 자신, 명시적 취소)와 "API 규약 §5.4"(타 문서)가 함께 등장하는 것은 사람이 빠르게 훑을 때 혼동 여지가 남지만, 저자가 이미 모든 신규 참조에 파일명을 qualify 했으므로 실질 리스크는 낮음 — 신규 조치 불필요, INFO 수준으로만 기록.)

## 요약

리베이스로 흡수된 PR #903(`STATUS_PROJECTION_COLUMNS`)·#901/#905(webchat spec 정정)는 본 브랜치가 도입한 4개 신규 DTO(`CurrentNodeDto`/`WaitingContextBaseDto`/`ButtonsContextDto`/`NodeOutputContextDto`)나 신규 spec 섹션(`2-api-convention.md §5.4`)과 파일·이름·앵커 어느 차원에서도 겹치지 않는다. 4개 DTO 는 저장소 전체에서 `external-interaction` 모듈과 그 문서화 지점(swagger.md 예시, channel-web-chat 주석) 밖에는 나타나지 않는 신조어이고, `STATUS_PROJECTION_COLUMNS` 는 본 브랜치가 손대지 않은 별개 파일의 non-export 상수다. 유일하게 사람이 읽을 때 순간적으로 헷갈릴 수 있는 지점은 `14-external-interaction-api.md` 자신의 기존 `§5.4`(명시적 취소)와 본 브랜치가 신설한 `2-api-convention.md §5.4`(부재 표현)가 같은 섹션 번호를 공유하는 것인데, 저자가 이미 모든 cross-ref 를 "API 규약 §5.4" 로 파일명 qualify 해 실질적 충돌은 발생하지 않는다. 신규 식별자 충돌 관점에서 조치 필요 항목 없음.

## 위험도

NONE
STATUS: SUCCESS
