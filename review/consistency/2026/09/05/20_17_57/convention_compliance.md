# 정식 규약 준수 검토 — `spec-draft-notification-secret-storage.md`

검토 대상: `plan/in-progress/spec-draft-notification-secret-storage.md` (draft) 가 이번 라운드까지
실제로 적용한 `spec/conventions/secret-store.md` · `spec/5-system/14-external-interaction-api.md` §7.1 ·
`spec/5-system/2-api-convention.md` 편집분 (커밋 `790487f34` · `e456be491`).

## 발견사항

- **[WARNING]** §1.1 삽입으로 "다음 필드가 이 문단을 인용하려면…" 닫음 노트가 자기 대상에서 분리됨
  - target 위치: `spec/conventions/secret-store.md` §1, `Trigger.notification_secret_v2` 비대상
    문단의 항목 4 직후 ~ `### 1.1` ~ `## 2.` 사이 (파일 기준 60~109행)
  - 위반 규약: 명시된 단일 규약 문장은 아니지만, 이 파일 §1 자신이 반복해서 선언한 불변식
    — *"(a)~(c) 를 함께 만족하지 않는 세 번째 필드가 같은 문단을 근거로 예외를 얻는 것이 이
    등재의 실패 모드"* (itk_* 문단, `notification_secret_v2` 문단 두 곳에서 각각 명시) — 를
    지키는 **메커니즘 자체**가 훼손된다
  - 상세: `790487f34` 는 `notification_secret_v2` 비대상 문단의 마지막에 *"다음 필드가 이
    문단을 인용하려면 (1) 을 만족해야 한다"* 는 닫음 note 를 두어, 그 문단(항목 1~4) 바로
    아래 붙여 두었다. 이후 `e456be491` 이 그 사이에 `### 1.1 비대상 필드도 응답 바디에는
    나가지 않는다` 를 **삽입**하면서, 원래 나란히 있던 [본문(항목 4) → 닫음 note] 사이에
    새 섹션 전체가 끼어들었다. 현재 순서는:
    ```
    (notification_secret_v2 항목 1~4)
    ### 1.1 (새 섹션, 노출 금지 규범)
    ---
    > 다음 필드가 이 문단을 인용하려면 (1) 을 만족해야 한다 …
    ---
    ## 2. SecretResolver 인터페이스
    ```
    닫음 note 가 **§1.1 뒤**로 밀려나, 앞으로 이 파일을 읽는 사람(특히 "다음 필드" 를 추가할
    사람)이 그 note 를 §1.1 에 대한 것으로 오독하거나 아예 못 보고 지나칠 위험이 커졌다.
    또한 이 문서의 다른 모든 `## N` 최상위 섹션 경계는 `---` **1개**로 구분되는데(§2~§7
    경계 전부 확인, 예외 없음), §1 만 유일하게 `---` 가 **2개** 연속으로 등장하고 그 사이에
    분리된 note 하나만 떠 있다 — 이 파일 자체의 서식 관행과도 어긋난다.
  - 제안: 닫음 note(현재 103~105행)를 §1.1 삽입 지점 **위**, 즉 `notification_secret_v2`
    항목 4 바로 뒤로 다시 옮기고 `### 1.1` 은 그 note 뒤 · 단일 `---` 앞에 두는 순서로
    재배치한다. (기계적 anchor 링크는 영향 없음 — 텍스트 이동만으로 헤딩 앵커가 바뀌지
    않는다.)

- **[INFO]** 새 `### 1.1` 헤딩 바로 위에 빈 줄 없이 blockquote 잔여 줄(`>`)이 남음
  - target 위치: `spec/conventions/secret-store.md` 81~82행
  - 위반 규약: 특정 규약 문장은 없음 — 이 저장소 다른 conventions 문서(`review-citations.md`,
    `swagger.md` 등)의 서식 관행(섹션 헤딩 앞에 항상 빈 줄)과의 일관성 문제
  - 상세: 81행이 내용 없는 `>` 단독 줄이고 82행이 곧바로 `### 1.1` 헤딩이다. CommonMark 는
    ATX 헤딩이 blockquote 를 빈 줄 없이도 "interrupt" 할 수 있어 렌더링 자체는 깨지지
    않지만, 문서 전체에서 헤딩 앞에는 항상 빈 줄을 두는 관행과 다르다 — `e456be491` 이
    §1.1 을 끼워 넣으며 원래 있던 마지막 blockquote 줄 뒤의 공백 처리를 놓친 것으로 보인다.
  - 제안: 81행과 82행 사이에 빈 줄 1개 삽입.

- **[INFO]** `select:false` 표기 불일치 (공백 유무)
  - target 위치: `spec/conventions/secret-store.md` 72행(`select:false`, 공백 없음) vs
    95행(`select: false`, 공백 있음). 같은 불일치가 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    282·289·295·621행에도 이미 있다(선행 사례, 이 draft 가 만든 것은 아님)
  - 위반 규약: 없음 — TypeORM 옵션 표기의 산문 인용 스타일 문제로, `spec/conventions/**` 가
    강제하는 코드 스타일 규칙은 아니다
  - 상세: 같은 파일 안에서 같은 TypeORM 옵션을 두 가지 표기로 인용해 grep 일관성이 떨어진다.
    기능적 영향은 없다.
  - 제안: 우선순위 낮음. 다음에 그 문단을 손댈 때 `select: false`(공백 있음, 실제
    TypeORM 소스 표기와 일치)로 통일 권장.

## 검증 완료 항목 (위반 아님 — 기록)

- **명명 규약**: `notification_secret_v2`(snake_case 컬럼) · `notification-signing.v2`(kebab-case
  ref) · `wsk_` prefix 모두 기존 `secret-store.md §1` URI scheme 규칙 및 자매 필드
  (`chat_channel_token_v2`/`bot-token.v2`/`itk_`)와 일치한다.
- **API 문서 규약**: `secret-store.md §1.1` 이 인용하는 `spec/5-system/2-api-convention.md
  §5.4`(응답-계약 검증 앵커)와 `spec/conventions/swagger.md §5-1`(엔티티 패스스루 금지, 응답
  DTO 위치) 앵커 문자열을 직접 대조 — 둘 다 실제 헤딩과 일치하고 상호 역참조도 정합함
  (`swagger.md §5-1` → `2-api-convention.md §5.4`, 그 역도 성립).
- **API 문서 규약**: `2-api-convention.md` frontmatter `code:` 에 `swagger-dto-contract*.ts` ·
  `response-contract*.ts` · `swagger-probe*.ts` 세 정적/런타임 검증자가 모두 등재돼 있고, 실제
  경로(`codebase/backend/src/repo-guards/__tests__/`, `codebase/backend/src/shared/testing/`)에
  대응 파일이 존재함을 확인.
- **금지 항목**: `select: false` 를 컬럼 단위로 걸지 않기로 한 결정 — "내부 읽기 경로가 예외
  없이 조용히 깨진다" 는 근거가 이미 이 저장소가 `User.select:false` 사고(#1288 계열,
  `spec-draft-nullable-notation-followups.md`)에서 확립한 근거와 동일 축이라 **재사용이
  정당**하다(다른 규약 위반이 아니라 선례를 올바르게 따른 사례).
- **문서 구조 규약**: 대상 plan draft(`spec-draft-notification-secret-storage.md`) 자체는
  `## Rationale` 이 최종 섹션으로 배치돼 있어(이전 라운드 W2 반영 확인), 3섹션 권장 순서를
  따른다. `spec_impact` 는 YAML 리스트 형태로 Gate C 를 만족한다.
- **review-citations 규약**: 이번 두 커밋이 `spec/conventions/secret-store.md` 에 새로 추가한
  텍스트에는 bare `hh_mm_ss` 인용이 없다(모두 날짜 라벨 `(결정 2026-09-05)` 또는 파일-내부
  참조 형식). 같은 파일의 기존 `17_12_34`·`18_14_50` bare 인용은 이 draft 이전(#1179,
  `f5351e9c2`)에 이미 있던 것이라 `review-citations.md §4` 의 소급 정리 제외 대상이다 — 이
  draft 의 위반이 아니다.

## 요약

이번 라운드가 실제로 편집한 `spec/conventions/secret-store.md` §1 신설 예외·§1.1 신설 규범과
`spec/5-system/14-external-interaction-api.md` §7.1 정정 문구는 명명 규약·API 문서 규약(§5.4
↔ swagger §5-1 상호 참조, `code:` 등재)을 모두 충족하고, 금지 항목(`select:false` 회피 근거)도
기존 선례를 올바르게 재사용했다. 유일한 실질적 흠은 두 커밋에 걸쳐 §1 안에 콘텐츠를 순차
삽입하면서 생긴 **문서 내부 배치 문제**다 — `notification_secret_v2` 예외의 재사용 방지
닫음 note 가 새로 삽입된 §1.1 뒤로 밀려나 그 대상과 시각적으로 분리됐고, 이 파일 특유의
"섹션당 `---` 1개" 관행과도 어긋난다. Critical 급 위반은 없다.

## 위험도
LOW
