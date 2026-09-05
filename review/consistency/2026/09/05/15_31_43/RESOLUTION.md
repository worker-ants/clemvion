# RESOLUTION — `review/consistency/2026/09/05/15_31_43`

**BLOCK: NO** · Critical **0** · WARNING **2** (둘 다 `plan_coherence`) · INFO **3**.
**WARNING 2건 모두 조치 완료.**

두 지적은 같은 성격이다 — **plan 이 스스로 건 "다음에 이 조건이 오면 하라" 트리거가 이번
PR 에서 충족됐는데 후속이 안 왔다.**

## 조치 항목

| # | 지적 | 조치 | 커밋 |
|---|---|---|---|
| W1 | `spec-sync-auth-gaps.md` 가 *"`codebase/` 편집이라 리뷰 게이트를 리셋하므로 다음에 이 파일을 손댈 때 함께"* 라며 미뤄 둔 주석 오기(`"12개+"` → `"12개"`)가, 이 PR 이 그 파일을 실제로 편집했는데도 안 왔다 | **반영.** 같은 배치에서 고쳤다 | `5fcb5c625` |
| W2 | `spec-draft-nullable-notation-followups.md` 가 *"2단계 착수 시 `execution-status-response.dto.spec.ts` 패턴으로 신설한다"* 고 못 박은 `ExecutionDto` 스키마-레벨 가드가, 2단계 착수분(`ExecutionDto` 배선)과 함께 안 왔다 | **신설.** `execution-response.dto.spec.ts` (26 테스트) | `5fcb5c625` |

## W2 — 왜 e2e 계약 대조로 부족한가

`assertMatchesContract` 는 **선언을 기준으로 값**을 본다. 데코레이터와 TS 타입이 **동시에**
optional 로 되돌아가면 선언이 함께 움직이므로 그 대조를 그대로 통과한다. plan 이
*"AST 가드도 tsc 도 못 잡는다"* 고 지목한 형태가 정확히 이것이고, 그래서 **선언 자체를
고정하는 층**이 따로 필요하다.

가드는 광고된 22 프로퍼티를 세 목록으로 갈라 고정한다:

| 목록 | 개수 | 형태 |
|---|---|---|
| required + non-nullable | 11 | `@ApiProperty()` |
| required + nullable | 1 | `@ApiProperty({ nullable: true })` — §5.4 의 기본형 |
| **optional + nullable** | **10** | §5.4 가 응답 바디에서 **금지**하는 조합 — 트래커가 drift 로 추적 중인 기존 상태다. 이 가드는 **고치는 것이 아니라 고정한다** |

세 목록의 합이 프로퍼티 전체와 같은지를 **먼저** 단언한다 — 그러지 않으면 스키마가 비어도
개별 단언이 전부 통과한다.

**판별력을 실측했다**: `triggerLabel` 의 데코레이터와 TS 타입을 동시에 optional 로 되돌린
뮤턴트에 **RED 2건**.

## W1 — 부분 반영이고, 그렇게 적었다

해당 plan 항목은 셋을 묶고 있다 — `clampLabel` 대칭 테스트 · `record()` JSDoc · 주석 오기.
**주석 오기만 반영**했다. 나머지 둘은 Prometheus 라벨 관측에 관한 것이라, §5.4 검증과 감사
로그 유출 수정이 범위인 이 PR 에 얹으면 drive-by 다. plan 항목에 취소선 + 사유로 그 갈림을
적어 다음 사람이 "함께 했다" 고 오해하지 않게 했다.

부수로 그 항목의 줄 번호 인용을 제거했다 — `:105` 를 가리켰는데 실제로는 `:128` 로 밀려
있었다. 같은 파일이 편집되면 줄 번호는 낡는다.

## INFO 처분

| # | 지적 | 처분 |
|---|---|---|
| 1 | `response-contract.ts` 가 `2-api-convention.md` frontmatter `code:` 미등재 | **이미 등재** — developer 는 `spec/` 쓰기 권한이 없어 planner 트랙 항목으로 남긴다 |
| 2 | 신규 테스트 인프라 배치가 `swagger-probe.ts` 관례와 일치 | 확인 기록 |
| 3 | `AuditLogDto.user` 의 optional+nullable 은 diff 밖 선행 drift | **이미 등재** |

## 프롬프트 번들 관찰 — 구현 diff 가 예산에 잘렸다

5개 checker 프롬프트 **전부**에서 `## 구현 변경 사항` 섹션이 헤더만 있고 본문이 없었다
(`+++` 마커 0건, 실려야 할 양은 8파일/1129줄). 프롬프트 자체가 그 경우를 예상해
*"구현이 없다 가 아니라 예산에 잘렸다"* 고 적고 워킹트리를 절대경로로 읽으라고 지시한다.

**checker 들이 실제로 그렇게 했다** — 판정이 `findAll()` join 축소·`AuditLogListItem` 신설
같은 실제 코드 내용을 정확히 짚었고, "코드에 없다/미구현" 류 거짓 결론은 한 건도 없었다.
그 안내 문구가 제 역할을 한 사례로 기록해 둔다.

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`15:43:33`) |
| unit | **PASS** — 447 스위트 / 9,404 통과 (`15:44:38`) |
| build | **PASS** (`15:46:14`) |
| e2e | **PASS** — 51 스위트 / 295 통과 (`15:48:54`) |

## 보류·후속 항목

없음. 이 라운드가 새로 만든 후속은 없고, `spec-sync-auth-gaps.md` 의 잔여 2건은 원래 항목에
그대로 남아 있다.
