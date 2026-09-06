# Cross-Spec 일관성 검토 — `spec-draft-review-citations-enforcement.md`

## 검토 방법 관련 사전 고지

전달받은 `_prompts/cross_spec.md` 번들은 `spec/conventions/**` 를 **전량 예산 초과로 절단**했다
— 정작 target draft 가 고치려는 두 파일(`spec/conventions/review-citations.md`,
`spec/conventions/spec-impl-evidence.md`) 자체가 번들에 없었다(이미 알려진 반복 갭:
`--spec` 기본 예산이 conventions 를 통째로 떨어뜨림). 번들만으로는 이 target 을 제대로 검토할
수 없어, 워킹트리의 실제 파일(`spec/conventions/review-citations.md`,
`spec/conventions/spec-impl-evidence.md`, `spec/5-system/2-api-convention.md`,
`spec/conventions/swagger.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`,
`codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` 등)을 직접 읽어
대조했다. 이 조치 자체를 아래 발견사항에 INFO 로 남긴다 — 다음 라운드에서 번들이 그대로면
같은 갭이 재발한다.

## 발견사항

- **[INFO]** 검토 대상 파일이 cross-spec 번들에서 누락됨 (harness 갭, target 결함 아님)
  - target 위치: 해당 없음 (조립 단계 이슈)
  - 충돌 대상: `_prompts/cross_spec.md` 의 번들 조립 로직 (컨텍스트 예산)
  - 상세: target draft 가 수정하려는 `spec/conventions/review-citations.md` ·
    `spec/conventions/spec-impl-evidence.md` 두 파일이 번들에 전혀 포함되지 않고 "본문
    생략됨 — 컨텍스트 예산 초과" 로 절단됐다. 이번엔 실제 파일을 직접 읽어 우회했지만,
    번들에만 의존하는 라운드는 이 target 을 "충돌 없음" 으로 **잘못** 판정할 수 있다
    (실은 확인을 안 한 것).
  - 제안: 이 target 처럼 `spec/conventions/**` 자체를 고치는 draft 는 cross-spec 번들
    조립 시 해당 conventions 파일을 우선순위로 포함하도록 조립 로직을 조정 검토.

- **[없음/확인됨]** `code:` 소유 경계 — `review-citations.md` vs `swagger.md`/`api-convention.md §5.4`
  - target 위치: 변경안 (B) — `code:` 에 `dto-jsdoc-citation*.ts` 등재, "swagger.md 에는
    등재하지 않는다 — 의도다" 서술
  - 대조 대상: `spec/5-system/2-api-convention.md §5.4 검증 층` (두 검증자 표:
    `swagger-dto-contract-guard.ts`=선언↔선언, `response-contract.ts`=값↔선언) ·
    `spec/conventions/swagger.md` frontmatter `code:` (`swagger-dto-contract*.ts`,
    `response-contract*.ts`, `swagger-probe*.ts` 만 등재, `dto-jsdoc-citation` 없음)
  - 확인 결과: 실측으로 대조한바 **충돌 없음**. `dto-jsdoc-citation-guard.ts` 는
    `isResponseDtoFile()`(=`/dto/responses/` 경로 필터)을 재사용해 **응답 DTO 파일**만
    보되, 판정 축은 §5.4 의 두 검증자(required/nullable 축, 스키마-미선언-키 축)와
    **다른 축**(JSDoc 안 리뷰 인용 유무)이다. `api-convention.md §5.4` 도 `swagger.md
    §5-1` 도 이 축을 다루지 않으므로, target 이 두 문서의 `code:` 에 이 가드를 **등재하지
    않기로** 한 결정은 기존 경계와 일치한다. `spec/**.md` 전수 grep 결과 다른 어떤 spec
    도 현재 `dto-jsdoc-citation` 을 참조하지 않아 중복 소유 주장도 없다.

- **[없음/확인됨]** 자매 plan (`spec-draft-nullable-notation-followups.md`) 과의 `code:` 슬롯
  glob 폭 동기화
  - target 위치: 종결 조건 4번째 항목 — "자매 plan 동기화"
  - 대조 대상: `plan/in-progress/spec-draft-nullable-notation-followups.md` §"신규 검출
    3축 등재" (그 문서 394~411행)
  - 확인 결과: **이미 동기화돼 있다.** 자매 문서가 JSDoc 축 행에 정확히 같은 glob
    (`dto-jsdoc-citation*.ts`, `-guard` 접미 배제)을 쓰고 "JSDoc 축은
    `spec-draft-review-citations-enforcement.md` 가 선행 집행한다" 고 명시해, 같은
    `code:` 슬롯에 서로 다른 폭을 지시하는 상황은 이미 해소돼 있다. 다만 target 문서
    자체의 종결 조건 체크박스는 아직 미체크 상태라 — 산출물 동기화는 됐는데 target 의
    plan 상태가 그 사실을 반영 못 하고 있다(cross-spec 결함이 아니라 plan 위생 항목이라
    참고로만 남긴다).

- **[없음/확인됨]** `spec-impl-evidence.md §2.1` 선례 인용 축소(변경안 C)가 다른 참조를
  깨는지
  - target 위치: 변경안 (C)
  - 대조 대상: `spec/**.md` 전수에서 `review-citations` 문자열 참조
  - 확인 결과: `spec-impl-evidence.md:81` 단 한 곳만 `review-citations.md` 를 선례로
    인용하며, 이는 정확히 target 이 좁히려는 그 문장이다. 다른 spec 문서가 같은 선례를
    "문서 전체가 시행코드 없음" 이라는 넓은 의미로 재인용하는 곳은 없어, 축소가 다른
    영역에 stale reference 를 남기지 않는다.

- **[없음/확인됨]** 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC (관점 1~5)
  - target 은 엔티티·필드·endpoint·요구사항 ID·상태 머신·권한 구조를 전혀 새로 정의하지
    않는다 — 순수하게 두 conventions 문서(`review-citations.md` Rationale,
    `spec-impl-evidence.md §2.1` 선례 문구)의 사실관계 정정과 frontmatter `code:` 등재다.
    번들에 포함된 `spec/1-data-model.md`(User 등 전체 엔티티)와 대조해도 target 이 건드는
    필드·엔티티가 없어 해당 관점에서는 판단할 대상 자체가 없다. (참고: 이 draft 의
    "함께 처리할 것" §2 가 언급하는 "`User` 7컬럼 노출 금지 규범을 `1-data-model.md §2.1`
    또는 `secret-store.md §1.1` 에 추가" 는 이 draft 의 종결 조건이 **아니라고 명시**돼
    있고, 실측으로도 현재 두 파일 어디에도 아직 그 규범이 없다 — 자매 plan 이 여전히
    미착수 상태로 남아있다는 사실 확인일 뿐, target 자체의 결함은 아니다.)

## 요약

`spec-draft-review-citations-enforcement.md` 는 실질적으로 두 conventions 문서
(`review-citations.md`, `spec-impl-evidence.md §2.1`) 안에서만 완결되는 사실관계 정정이며,
제품 엔티티·API 계약·요구사항 ID·상태 전이·RBAC 등 다른 spec 영역과 부딪힐 표면을 새로
만들지 않는다. 유일하게 경계가 걸리는 지점 — `dto-jsdoc-citation-guard.ts` 를 어느 문서가
"소유" 하는가(review-citations.md vs swagger.md/api-convention.md §5.4) — 는 실제 가드
구현(`isResponseDtoFile` 재사용, JSDoc-인용 축 전용)과 대조한 결과 기존 §5.4 "두 검증자"
경계와 어긋나지 않고, 자매 plan(`spec-draft-nullable-notation-followups.md`)과의 `code:`
glob 폭 지시도 이미 일치한다. 유일한 실질 이슈는 **target 자체가 아니라 검토 파이프라인**이다
— cross-spec 번들이 target 이 고치는 conventions 파일 두 개를 예산 초과로 통째로 떨어뜨렸다.
직접 파일을 읽어 우회했지만, 이 갭이 반복되면 향후 라운드가 "확인 안 함" 을 "충돌 없음" 으로
오판할 위험이 있다.

## 위험도

NONE
