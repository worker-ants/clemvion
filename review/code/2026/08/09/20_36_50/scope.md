# 변경 범위(Scope) 리뷰

## 검토 방법

`git show --stat HEAD`(커밋 `1bacb69be`)로 실제 diff 파일 목록(19개)이 프롬프트에 실린 14개
항목(파일 8~10, 5, 7 은 프롬프트 크기 제한으로 일부/전체 축약)과 정확히 일치함을 먼저 확인했다.
이후 축약된 파일(`roles.guard.spec.ts`, `secret-resolver.service.spec.ts`,
`http-request.handler.spec.ts`)은 `Read`/`git show`로 전문을 직접 열어 대조했고, 커밋 메시지가
선언한 "5건" 목록과 실제 diff 를 1:1 매핑했다.

## 발견사항

이번 diff 는 커밋 메시지가 선언한 5개 항목(README 재구성, fixture 통합, 캐너리 주석 수치 정정,
`deleteByPrefix` 가드 e2e/unit 보강, 죽은 mock 스캐폴딩 제거)과 정확히 1:1 대응하며, 각 항목은
직전 두 plan 파일(`auth-guard-reflection-hardening.md`, `backend-lint-gate-broken-on-main.md`)의
기존 체크리스트 항목을 그대로 완결시키는 후속 작업이다. 범위를 벗어나는 발견사항은 없다.

- **[INFO]** `review/consistency/2026/08/09/20_02_21/**` 8개 파일(SUMMARY.md·`_retry_state.json`·
  `meta.json`·4개 checker 리포트)이 이번 diff 에 포함되어 있으나, 이는 CLAUDE.md 가 강제하는
  `developer` 착수 전 `consistency-check --impl-prep` 게이트의 산출물이며 커밋 메시지 말미에도
  "사전 검토: /consistency-check --impl-prep spec/5-system/ → BLOCK: NO" 로 명시돼 있다.
  `review/` 는 gitignore 대상이 아니라 커밋되는 것이 이 저장소의 정상 관행이다(과거 세션 교훈:
  "review/ 는 gitignored 아님"). 코드 변경 자체가 아니라 필수 워크플로 부산물이라 CRITICAL/WARNING
  대상은 아니지만, PR 리뷰어가 "이 커밋의 실제 코드 변경"과 "게이트 증적"을 혼동하지 않도록
  참고로 남긴다.
  - 위치: `review/consistency/2026/08/09/20_02_21/` 디렉토리 전체 (파일 12~19)
  - 제안: 조치 불요. 필요하면 커밋 메시지 본문에 "(1)~(5) 코드 변경 + 사전 게이트 증적 8파일"처럼
    두 종류를 한 번 더 구분해 적으면 리뷰 가독성이 좋아진다.

## 항목별 대조

| # | 커밋 선언 항목 | 대응 파일 | 판정 |
|---|---|---|---|
| 1 | README §배포 주의 소절 분리 | `codebase/backend/README.md` | 선언대로 순수 문서 재구성. 코드 변경 없음. |
| 2 | 워크스페이스 UUID fixture 공용화 | `common/__test-utils__/workspace-id-fixtures.ts`(신규) + `workspace.decorator.spec.ts` · `roles.guard.spec.ts` · `workspace-context.util.spec.ts` | 세 spec 파일 모두 로컬 상수 선언 삭제 + import 로 대체. 값 자체는 보존(`WS1`→용법별 `SAME_WS`/`HEADER_WS`로 해소, `OWN_WS`→`TOKEN_WS` 개명은 plan 에 근거 명시). import 된 식별자는 각 파일에서 전부 실사용 확인(미사용 import 없음). |
| 3 | 캐너리 주석 "73건"→"142건" 정정 + 상위/하위집합 관계 명시 | `workspace-reflection-canary.ts` | 주석(JSDoc)만 변경, 코드 로직 변경 없음(`git show` 로 확인). |
| 4 | `deleteByPrefix` 가드 존재근거 실행 가능화 | `secret-resolver.service.spec.ts`(mock 계측 추가 + 신규 unit 2건) + `test/secret-store-like-prefix.e2e-spec.ts`(신규 e2e 3건) | plan 파일 11 의 미착수 항목("이 PR 밖")을 정확히 그 범위로 완결. mock 의 `LastDeleteQuery` 관측점 추가는 새 단언(연결점 테스트)에 필요한 최소 계측이라 범위 내. |
| 5 | `http-request.handler.spec.ts` 죽은 mock 스캐폴딩 제거 | 동 파일 | `fetchPromise`/`_reject` 참조 2곳만 삭제하는 8줄 diff. plan 파일 11 이 "#1111 이 남긴 잔재"로 명시. |

추가로 확인한 사항: fixture 개명(`OWN_WS`→`TOKEN_WS`, `WS1` 해소)에 따른 모든 사용처(roles.guard.spec.ts
17곳 포함)가 동일 커밋에서 함께 갱신되어 있어 "부분 리네임으로 인한 미스매치" 류의 숨은 변경은 없다.
plan 문서 2건(파일 10, 11)의 diff 는 해당 커밋이 완결한 체크박스 항목에 `[x]` 전환 + "처리
(2026-08-09, ...)" 인용문만 추가하는 형태로, 실제 코드 변경 내용과 1:1 대응하며 무관한 항목을
건드리지 않았다.

## 요약

커밋 `1bacb69be`("문서·테스트 위생 5건")의 19개 변경 파일은 커밋 메시지가 선언한 5개 항목과
정확히 대응하며, 각 항목은 선행 plan 문서(`auth-guard-reflection-hardening.md`,
`backend-lint-gate-broken-on-main.md`)에 이미 등재돼 있던 "이 PR 밖"/"차후 처리" 항목을 그대로
완결하는 후속 작업이다. 의도 이상의 변경, 요청받지 않은 기능 확장, 무관한 파일 수정, 의미 없는
포맷팅 뒤섞임은 발견되지 않았다. 코드 로직이 바뀐 파일은 하나도 없고(테스트/문서/주석만), fixture
공용화에 따른 리네임도 전 사용처가 함께 갱신돼 일관성이 유지된다. `review/consistency/**` 8개
파일은 필수 사전 게이트 산출물로 스코프 위반이 아니다.

## 위험도

NONE
