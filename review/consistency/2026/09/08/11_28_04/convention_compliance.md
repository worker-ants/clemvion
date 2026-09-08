# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-followups-batch-a.md`

## 검토 방법

target 은 `spec/**` 6개 파일(+ 거버넌스 문서 3개)에 대한 **planner draft**(A-1~A-6, 6개 변경
항목)다. 각 항목이 (1) 삽입될 spec 본문이 실제 정식 규약(`spec/conventions/**`)의 명명·포맷·구조
규칙을 따르는지, (2) target 이 인용하는 SoT·앵커·실측이 저장소 현재 상태와 맞는지를 대조했다.
`spec/conventions/secret-store.md`·`swagger.md`·`spec-impl-evidence.md` 는 번들이 예산 초과로
절단돼 있어 저장소 원본을 직접 읽어 대조했다. `error-codes.md`·`review-citations.md` 는 번들
전문이 있어 그대로 대조했다. 주요 사실 주장(파일 경로, 앵커 slug, 코드 라인, 컬럼명, 가드 로직,
grep 결과)은 저장소에서 직접 재현해 검증했다.

## 발견사항

- **[INFO]** A-5(a) 규범 블록의 문서 구조가 자매 섹션(§2.17.2)과 다르다
  - target 위치: `## A-5. \`User\` 민감 7컬럼의 응답 노출 금지를 규약 문장으로` → 변경안 (a)
  - 위반 규약: 없음(강제 규칙 아님) — CLAUDE.md 문서 구조 권고(3섹션) 및 `1-data-model.md` 자체
    내부 관행과의 정합성 문제
  - 상세: 같은 문서의 `§2.17 AuthConfig`는 "마스킹·노출 정책"을 `#### 2.17.2 마스킹·노출 정책`
    이라는 **번호 붙은 하위 절**로 분리해 다른 spec(`6-config.md`, `secret-store.md`)이 그
    앵커(`#2172-마스킹노출-정책`)를 직접 인용한다. A-5(a)는 같은 성격의 규범(응답 노출 금지)을
    `§2.1 User` 표 아래 **번호 없는 blockquote**로 삽입한다 — `§2.1` 이 원래 번호 없는 후속
    문단(`WebAuthn ...`)만 갖고 있었으므로 국지적으로는 어색하지 않지만, `§2.17.2`와 나란히
    보면 같은 클래스의 정책(엔티티별 노출/마스킹 규범)이 저장소 안에서 서로 다른 구조로 쓰이게
    된다. `secret-store.md §1.1`이 이 블록을 상호 참조로 가리키므로, 번호 있는 하위 절이면
    앵커가 더 안정적이다.
  - 제안: 채택해도 무방하나, `#### 2.1.1 응답 노출 금지` 같은 번호 하위 절로 승격하면 향후
    `secret-store.md`·다른 문서의 상호 참조 앵커가 더 명시적이 된다. 필수 수정 사항은 아님.

- **[INFO]** review-citations.md 예외가 정확히 적용됐음(참고용 — 조치 불요)
  - target 위치: A-2-1, A-4(b), A-3 Rationale 등 다수의 `hh_mm_ss` bare 인용
    (`10_13_23`, `13_06_22`, `11_14_39`, `09_53_09`, `12_28_02`, `13_18_59` 등)
  - 관련 규약: `spec/conventions/review-citations.md §3`
  - 상세: 이 규약은 `codebase/**`·`scripts/**`·`.github/**`·`spec/**` 문서에는 날짜 없는
    bare `hh_mm_ss` 인용을 금지하지만, **`plan/**` 문서는 명시적으로 대상 아님**("인용하는
    라운드와 같은 세션에서 쓰이고, 문서 자체가 그 맥락을 담는다")이라 target(=`plan/in-progress/`)
    자체에는 이 금지가 적용되지 않는다. 실제로 A-3·A-5의 "변경안" markdown 펜스 안에 **삽입될
    spec 본문 텍스트**에는 bare 인용이 전혀 없고(날짜 포함 인용만 사용), 날짜 없는 인용은 전부
    plan 레벨의 근거 설명(펜스 밖)에만 있다 — 규약의 "적용 범위"를 정확히 이해하고 지킨
    사례라 위반이 아니다.
  - 제안: 조치 불요. (분석 과정에서 확인한 준수 사례로 기록)

## 정합성 실측 (검토자가 직접 재현·확인한 사실 — 참고용)

아래는 CRITICAL/WARNING 판정에 이르지는 않지만, target 의 정식 규약 관련 주장이 실제 저장소
상태와 정확히 일치함을 직접 확인한 항목이다(정식 규약 위반 여부 판단의 근거가 됐다):

- `2-api-convention.md §5.4` 의 "검증 층" 표 문구 `두 검증자` — 실제 파일(`2-api-convention.md:227`)과
  `swagger.md:371`에서 그대로 확인. A-4 의 개수-비의존 문구 교체 제안은 두 파일의 **inline 텍스트**만
  바꾸고 헤더(앵커)는 그대로 유지하므로 기존 인입 링크를 깨지 않는다.
- `user-entity-exposure*.ts`/`user-entity-exposure-guard*.ts` 글롭 매칭 결과(2/2 vs 1/2) — 실제
  파일 목록(`user-entity-exposure-guard.ts`, `user-entity-exposure.spec.ts`)으로 재현, 일치.
- `2-api-convention.md`·`swagger.md` 의 `code:` frontmatter 어디에도 `user-entity-exposure`/
  `user-secret-absence` 글롭이 없음 — grep 으로 확인, A-4 의 "0건" 주장과 일치.
- `error-handling.md §1.8/§1.9` 가 "도메인 spec 참조" 패턴(도입 문장 + 표 + SoT 링크)으로
  구성돼 있고 §1.9 가 마지막 절임 — A-3(b) 의 §1.10 신설 제안이 이 패턴·번호 순서와 일치.
- `2-trigger-list.md:106` botToken 행이 "`hasBotToken: boolean` 만 노출"과 "마스킹 placeholder
  (`•••• <last4>`)"를 실제로 동시에 서술 — A-2-4 가 지적하는 자기모순이 원문에 그대로 존재.
- `secret-store.md:69-78`·`14-external-interaction-api.md:934-936` 이 지금도 "노출 창이 아직
  닫혀 있지 않다"는 낡은 현재형 서술을 유지 — A-6 이 지적하는 staleness 가 실재.
- `USER_SECRET_KEYS`(`user-secret-absence.ts`) 7개 키가 `1-data-model.md §2.1` 의 7개 컬럼과
  정확히 1:1 대응(camelCase↔snake_case) — A-5 의 컬럼 열거가 정확.
- `spec-pending-plan-existence.test.ts` 가 `fs.existsSync` 존재 검사만 수행 — A-2-2 의 "항목
  매칭은 안 본다" 주장과 정확히 일치.

## 요약

target 은 정식 규약(`spec/conventions/**`) 관점에서 **위반이 발견되지 않았다**. 6개 변경 항목이
삽입하는 spec 본문은 (1) 기존 명명 규약(`error-codes.md`의 `UPPER_SNAKE_CASE`·도메인 prefix,
`swagger.md`의 DTO/컨트롤러 데코레이터 패턴), (2) 출력 포맷 규약(`api-convention.md §5.3/§5.4`의
에러 봉투·부재 표현), (3) 앵커/헤더 slug 규칙과 정확히 정합했고, (4) `secret-store.md §1.1`이
이미 세운 "컬럼 수준 `select: false` 금지" 등 금지 항목을 재확인·준수했다. 인용 형식은
`review-citations.md §3`이 `plan/**`를 명시적으로 면제하는 조항을 정확히 활용했다. 유일한 지적은
A-5(a)의 규범 블록이 자매 섹션(§2.17.2)과 달리 번호 없는 blockquote 구조를 쓴다는 스타일 수준의
INFO 이며, 강제 규약 위반이 아니다. target 이 인용한 파일 경로·라인·grep 결과·가드 로직은
저장소 재현 검증에서 전부 일치했다.

## 위험도

LOW
