# 정식 규약 준수 검토 결과

검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`

이번 PR 에서 실제로 변경된 convention 파일은 `spec/conventions/error-codes.md` 하나다. Prompt payload 에 포함된 `spec/conventions/cafe24-api-catalog/` 파일들은 pre-existing(이번 PR 에서 변경 없음)이므로 해당 파일들은 기존 규약 준수 상태 확인에 한해 검토한다.

---

## 발견사항

### `spec/conventions/error-codes.md` — 신규 `WORKSPACE_REQUIRED` rename 이력 행 (§5)

- **[INFO]** §5 섹션 서두 문구와 신규 row 의 실제 상황 간 미묘한 어긋남
  - target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-followups-batch-de949d/spec/conventions/error-codes.md` 89–91행 (§5 Rename 이력 섹션 서두)
  - 위반 규약: `spec/conventions/error-codes.md §2` — "에러 코드 rename 은 breaking change", §5 의 예외 적용 기준이 되는 "소비자가 자사 클라이언트뿐이라 breaking 영향이 없음"
  - 상세: 섹션 서두가 갱신돼 **"외부 client 코드에 분기로 노출된 적이 없다(문서 목록에만 노출됐던 코드는 신규 코드로 동기화)"** 라는 신규 조건을 괄호 추가 형태로 붙였다. 기존 두 row(`LLM_CONFIG_*`)는 "코드베이스에서 완전 제거"에 해당하나, 신규 `WORKSPACE_REQUIRED` row 는 "코드베이스에서 완전 제거"라기보다 "user-docs 목록에만 노출, client 하드코딩 분기 없음"에 해당한다. 섹션 서두가 두 케이스를 하나의 문장으로 뭉뚱그려 묶어 읽혔을 때 적용 기준이 미묘하게 혼재된다. 그러나 99행의 row 비고(比較) 설명과 R-CC-18 rationale 이 이미 충분한 맥락을 제공하고 있어 실질적 혼동 가능성이 낮다.
  - 제안: 서두 문구를 "구 코드는 더 이상 발행되지 않으며 — (a) 코드베이스에서 완전 제거됐거나, (b) user-docs 목록에만 노출됐다가 신규 코드로 동기화된 경우 — 어느 쪽이든 외부 client 코드에 분기로 노출된 적이 없음을 확인한 뒤 교체했다" 식으로 두 케이스를 명시적으로 나열하면 더 정확하다. 단, 현재 문구도 규약 위반이 아니므로 필수 수정은 아니다.

- **[INFO]** §5 표의 `HTTP` 컬럼 값이 `400`으로 기재됐으나 구 코드의 HTTP status 는 `401`이었다
  - target 위치: line 97 `| `WORKSPACE_REQUIRED` | `WORKSPACE_ID_REQUIRED` | 400 | …`
  - 위반 규약: 규약에 `HTTP` 컬럼이 "대체 코드의 HTTP status 인가, 구 코드의 HTTP status 인가"에 대한 명시 정의가 없다. 기존 두 row(PR4b)는 구·신 모두 400 이라 이 모호성이 드러나지 않았다.
  - 상세: 신규 row 의 경우 구 코드 `WORKSPACE_REQUIRED` → HTTP 401, 대체 코드 `WORKSPACE_ID_REQUIRED` → HTTP 400 이다. 표의 `HTTP` 컬럼 값 `400`은 대체 코드 기준으로 채워진 것인데, 비고 란에 "HTTP status 도 401→400 정정"이라고 써 있어 맥락은 이해할 수 있다. 그러나 표 헤더만 보면 어느 코드의 status 인지 불명확하다.
  - 제안: 표 헤더를 `| 구 코드 | 대체 코드 | 대체 HTTP | PR | 비고 |` 로 명시하거나, 또는 비고 컬럼에서 status 변경을 이미 서술하고 있으므로 현행 유지도 허용 가능. 단, 이후 HTTP status 변경이 동반되는 rename 이력 추가 시 일관성을 위해 컬럼 정의를 명시하는 것을 권장한다. 규약 내 명시 항목이 없어 해당 규약 갱신이 적절하다.

### `spec/conventions/cafe24-api-catalog/` (pre-existing 파일)

- **[INFO]** `application/appstore-orders.md` 응답 파라미터 표에서 `order` 래퍼 설명이 잘못 기재됨
  - target 위치: `/Volumes/project/private/clemvion/spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `GET appstore/orders/{order_id}` 및 `POST appstore/orders` 응답 표 1행 `order` 의 설명
  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §7.2` — "응답 파라미터 표 … property list 에 없는 wrapper 는 `(응답 객체)`/`(목록)`"
  - 상세: 두 operation 의 응답 표 최상위 `order` 행의 설명이 `(응답 객체)` 대신 **"정렬 순서 asc : 순차정렬 · desc : 역순 정렬"**로 기재되어 있다. 이는 전혀 다른 `order` 파라미터(정렬 order)의 설명이 잘못 전파된 것으로, §7.2 가 규정한 `(응답 객체)` 표현과 어긋난다. 이번 PR 에서 변경된 파일이 아니나, 규약 위반 상태로 존재한다.
  - 제안: `| `order` |  | (응답 객체) |` 로 수정. 이 파일은 생성기 산출물이지만 `spec-frontmatter-parse.ts` 의 frontmatter 의무 제외 대상이며, 필드 단위 내용 오류는 수동 정정이 필요하다.

- **[INFO]** `application.md` 인덱스 표의 status 값에 `[^seed]` 형태 각주가 없는데 `category.md` 에는 있는 비일관성
  - target 위치: `spec/conventions/cafe24-api-catalog/application.md` (각주 없음) vs `spec/conventions/cafe24-api-catalog/category.md` (line 1494–1495, `supported [^seed]`)
  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §3` — status enum 은 `supported` / `planned` / `deprecated` 중 하나. §4 규칙7 — 테스트가 이 값을 파싱함
  - 상세: `category.md` 의 `mains_update` / `mains_delete` row 에는 `supported [^seed]` 라고 쓰여 있다. `catalog-sync.spec.ts` 의 MD 표 파서가 `status` 컬럼 값을 어떻게 파싱하는지에 따라 `supported [^seed]` 가 `supported` 로 인식되거나 trim 실패할 수 있다. 단, 이는 pre-existing 파일이고 PR4b 이전부터 존재하며, 테스트가 현재 통과하고 있다면 파서가 각주를 허용하는 것으로 보인다.
  - 제안: `_overview.md §3` 의 status enum 정의에 각주 허용 여부를 명시하거나, `catalog-sync.spec.ts` 의 파서 동작을 주석으로 명시해 이 패턴이 의도된 것임을 확인 가능하게 한다. 이번 PR 에서 변경된 내용 아님 — 별도 트랙.

---

## 요약

이번 PR 의 `spec/conventions/error-codes.md` 변경(§5에 `WORKSPACE_REQUIRED → WORKSPACE_ID_REQUIRED` rename 이력 추가)은 정식 규약의 직접 위반 없이 기존 패턴을 따른다. 신규 케이스가 기존 두 row 와 미세하게 다른 조건(HTTP status 변경 동반, user-docs 만 노출)을 가짐에 따라 섹션 서두 문구와 표 헤더 정의가 약간 모호해졌으나, 비고 및 R-CC-18 rationale 이 맥락을 보완한다. Pre-existing `cafe24-api-catalog/application/appstore-orders.md` 에서 응답 래퍼 설명 오기재(`(응답 객체)` 대신 정렬 파라미터 설명이 복사됨)가 확인되나 이번 PR 에서 변경된 파일이 아니다.

## 위험도

LOW

---

STATUS: OK
