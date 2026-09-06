# RESOLUTION — `review/consistency/2026/09/06/14_26_32` (+ code `14_25_40`)

**원 결과**: consistency **BLOCK: YES** · Critical **1** ·
코드 리뷰 Critical **0** · WARNING 4 · 위험도 LOW
**처분**: Critical 은 **구현으로** 닫았다(문서를 낮추지 않았다). 코드 리뷰 WARNING 2건 +
INFO 2건 수정, WARNING 2건은 확인 후 무조치, 나머지는 plan 등재.

---

## consistency Critical — 문서한 에러 계약이 구현보다 넓었다

`spec/2-navigation/2-trigger-list.md §3`:

> `(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT`
> (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)

**그 문자열이 저장소 어디에도 없었다** — 직접 grep 으로 확인(`spec/` 2건, `codebase/` 0건).
실제로는 `GlobalExceptionFilter` 의 전역 `isUniqueViolation` 분기가 `details` 없이
`RESOURCE_CONFLICT` 만 내고 있었다.

### 왜 이 PR 이 이걸 보게 됐나

**직전 라운드의 파서 수정이 게이트를 넓힌 결과다.** `workspace-response.dto.ts` 가 처음으로
spec-linked 로 잡히면서 `spec/2-navigation/` 이 게이트 범위에 들어왔고, 그 영역의 **기존
부채**가 드러났다. 이 PR 이 만든 결함이 아니다.

### 문서를 낮추지 않고 구현했다

두 경로가 있었다 — (a) 구현, (b) 문구를 실측대로 정정. (b)는 planner 턴이 필요하고
**클라이언트에게 한 약속을 조용히 줄인다.** (a)는 developer 권한 안이고 상태 코드를
바꾸지 않는 순수 additive 다. (a)를 택했다.

| 추가한 것 | 무엇 |
|---|---|
| `isEndpointPathUniqueViolation` | SQLSTATE 23505 **+ 인덱스명**(`idx_trigger_workspace_endpoint`, `V002__indexes.sql`)으로 좁힌다. 23505 만 보면 이 테이블의 **다른** UNIQUE 위반까지 `endpoint_path` 충돌로 오보한다 |
| `rethrowEndpointPathConflict` | 맞으면 문서한 형태로 던지고, **아니면 그대로 흘려보낸다** — 삼키면 전역 매핑이 하던 일을 가로챈다 |
| `create` · `update` 두 경로 | 둘 다 `endpointPath` 를 쓴다. 한쪽만 감싸면 같은 형태의 반쪽 방어다 |

**세부 코드를 `details` 안에 뒀다.** 처음엔 봉투 top-level 에 `subCode` 를 실었는데,
`GlobalExceptionFilter` 는 `code`·`message`·`requestId`·`details` 만 복사한다 — **wire 에
닿지 않는다.** 즉 그대로 뒀으면 *"문서한 보장이 구현보다 넓다"* 를 고치면서 같은 결함을
새로 만들 뻔했다. 봉투 스키마 자체는 `2-api-convention.md §5.3` 소유라 넓히지 않았다.

**뮤테이션 2건**:

| 뮤턴트 | 결과 |
|---|---|
| 인덱스명 검사 제거(`constraint !== undefined`) | **2 RED** — 반대 방향 대조군 둘이 잡는다 |
| `details.subCode` 제거 | **2 RED** — create·update 양쪽 |

---

## 코드 리뷰 `14_25_40`

### W1 (maintainability·testing 독립 발견) — 내 수정이 또 한 칸 좁았다

직전 라운드의 파서 수정은 **줄 전체 주석·빈 줄**만 건너뛴다. 항목과 **같은 줄**의 트레일링
`# comment` 는 여전히 값에 붙어 **어떤 파일과도 매치되지 않는 죽은 glob** 이 된다 — 항목이
사라지는 것과 같은 등급의 조용한 유실이다. 두 reviewer 가 정규식을 직접 실행해 독립 재현했다.

`_strip_comment` 를 두 자리에 적용했다 — `_clean`(블록 항목·인라인 원소)과 `rest`(단일값·
인라인 리스트). **인라인은 `[...]` 를 벗기기 전에** 걷어야 마지막 원소에 `]` 가 안 남는다.

테스트 4건 추가:

| 테스트 | 수정 전 |
|---|---|
| 블록 항목 트레일링 주석 | **RED** |
| 단일값·인라인 트레일링 주석 | **RED** |
| 리스트 첫 줄이 주석 (INFO#8) | GREEN — 경계 고정 |
| **`a#b.ts` 는 값이다** (앞에 공백 없는 `#`) | GREEN — **넓힌 술어의 반대 방향 대조군** |

마지막 것이 없으면 술어가 `#` 을 무조건 자르는 쪽으로 넓어져도 통과해, 이번엔 **값을 잘라
먹는** 쪽으로 같은 유실이 난다. 저장소 전수 재확인: **731 대 731, 갈리는 파일 0**.
harness 1,128 pass + 1,254 subtest.

### 나머지

| # | 처분 |
|---|---|
| W2 architecture (파서 이원 구현 SSOT 부재) | **plan 등재** — 한 형태씩 쫓는 것이 문제라는 지적에 동의한다. 두 언어가 같은 golden fixture 코퍼스를 읽고 *"같은 입력 → 같은 출력"* 을 계약으로 단언하는 것이 근본 해결. 당장의 안전망(전수 대조 731/731)은 실측으로 확인했고, 그 대조를 **테스트로 상시화**하는 것이 그 항목이다 |
| W3·W4 scope (3단 연쇄 확장) | **무조치** — 리뷰어가 *"기능은 건실하고 충분히 disclose 됨, 되돌릴 필요 없음"* 으로 판정. 하네스 수정은 별도 커밋(`8b67300b5`)으로 분리돼 있어 cherry-pick 가능. 권고(*"향후 유사 확장은 별도 브랜치"*)는 접수 |
| INFO#1 docstring | `_parse_frontmatter_code` docstring 에 두 처리(줄 주석·트레일링 주석)와 두 파서 일치 계약을 명시 |
| INFO#2 stale 주석 | `findByWorkflow` 헤더가 `WorkflowVersionListItem` 을 *"snapshot 만 제외"* 로 인용 — 이제 `creator` 투영·`workflow` 제외도 포함한다. **정의를 옮겨 적지 않고** 타입 선언을 SoT 로 가리키게 바꿨다(옮겨 적은 문장이 곧 낡았다) |
| INFO#3 공유 select 6키 | **plan 등재** — 이 PR 이 고친 결함 클래스의 축소판이지만, `creator`(보안 경계)는 이미 공유했고 남은 6키는 갈려도 표시 버그다 |
| INFO#4·5·6·7·9 | 확인 기록 · 이미 처분 · 범위 밖 |

### 관측 사항에 대해

security·api_contract 두 reviewer 가 `review_guard.py` 를 일시적으로 수정된 상태로 봤다고
보고했다. 원인은 testing reviewer 의 뮤테이션 검증과 시간대가 겹친 것이고, 최종 상태는
무결하다(`git diff` + `pytest`). **병렬 reviewer 가 공유 워크트리를 뮤테이션하는 것은
알려진 오염 경로**이므로, 다음 라운드 프롬프트에 scratch 강제·동시 실행 고지를 넣는 것이
맞다 — 이번엔 세 reviewer 가 서로를 정확히 교차 설명해 오판으로 이어지지 않았다.

---

## consistency 나머지

| # | 처분 |
|---|---|
| WARNING 1 (`User` 7컬럼 규범 문장) | 이미 plan 에 등재 — 행 번호까지 확인 |
| INFO 1 (`joinedAt` 이 §4.1 에 미기술) | UI 노출 계획이 서면 planner 턴. wire 는 이미 나가던 값의 사후 선언 |
| INFO 2·3 | 범위 밖 · 이미 추적 중 |
| INFO 4 (`2-trigger-list.md §2.3.1` dangling plan 인용) | 그 절을 다음에 손댈 때 정리 — `spec/` 쓰기라 developer 권한 밖 |
| INFO 5 (`WorkflowVersionDetail` 동명) | 직전 라운드에 JSDoc 상호 참조로 처분, 유지 확인 |
