# Cross-Spec 일관성 검토 — `spec-draft-notification-secret-storage.md` (4차, `20_17_57`)

## 검토 방법

target plan 문서(`plan/in-progress/spec-draft-notification-secret-storage.md`)는 이미 3 라운드의
`--spec` 검토(`19_08_19`→`19_40_29`→`19_59_16`)를 거쳐 그 결정이 **`spec/**`에 커밋으로 반영된
상태**다 (`790487f34`, `e456be491`). 번들 프롬프트는 컨텍스트 예산 초과로 `spec_impact` 대상
문서 다수(특히 `spec/5-system/14-external-interaction-api.md`)의 본문을 담지 못했으므로, 판정을
프롬프트에만 의존하지 않고 다음 파일을 직접 `Read`로 열어 교차 검증했다:

- `spec/conventions/secret-store.md`(§1·§1.1 전문)
- `spec/5-system/14-external-interaction-api.md`(§7.1·EIA-NX-12·§8.2)
- `spec/5-system/15-chat-channel.md`(R-K 원문, §4.2 DDL 주석)
- `spec/data-flow/15-external-interaction.md`(§1.5·§2.1)
- `spec/1-data-model.md`(§2.8 Trigger 필드 표)
- `spec/2-navigation/4-integration.md`(§9.1 — 미변경 확인)
- `spec/5-system/2-api-convention.md`(frontmatter `code:`·§5.4 검증 층 표)
- `spec/conventions/swagger.md`(frontmatter `code:`)
- `plan/in-progress/spec-draft-nullable-notation-followups.md`(후속 트래커 항목 실재 확인)
- `git show --stat`으로 두 커밋의 실제 변경 파일 집합 확인

## 발견사항

### 데이터 모델 — 정합 확인 (문제 없음)

`Trigger.notification_secret_v2`(평문, signing secret v2)와 `Trigger.chat_channel_token_v2`(ref,
bot token v2)의 의미 비대칭은 세 문서에서 **일관되게** 기술된다:

- `chat-channel.md` R-K(원문 그대로 인용됨) — "두 컬럼은 의미상 직교"
- `14-external-interaction-api.md` §7.1 — R-K를 직접 링크하며 같은 문장 인용, EIA-NX-12("rotate
  응답 1회 평문")와 이 절("컬럼 자체가 평문")을 명시적으로 구분
- `data-flow/15-external-interaction.md` §1.5 — 승격 시 `secrets.rotate(canonical ref, v2)` +
  컬럼 `NULL` 클리어, §7.1의 "경유지" 서술과 정확히 대응
- `1-data-model.md` §2.8 — 두 컬럼 모두 SQL 마이그레이션(§7.1)과 필드명·타입 일치

`secret-store.md §1`의 신규 비대상 예외는 `itk_*` 문단의 (a)~(c)를 인용하지 않고 별도 근거
(1)~(4)를 세웠고, "다음 필드가 이 문단을 인용하려면 만족해야 할 조건"을 등재문에 함께 적어
§1의 기존 경고("같은 문단을 근거로 세 번째 필드가 예외를 얻는 것이 실패 모드")를 지켰다.

### API 계약 — 검증자 이중 등재 확인 (문제 없음)

`2-api-convention.md`의 frontmatter `code:`에 `swagger-dto-contract*.ts`가 이번 라운드에 추가돼
`swagger.md`의 동일 항목과 짝을 이룬다(둘 다 확인). §5.4 "검증 층" 표가 서술하는 "두 검증자
모두 양쪽 문서에 등재"라는 원칙과 실제 frontmatter가 일치한다.

`secret-store.md §1.1`이 신설한 "저장 위치 예외 ≠ 노출 예외" 규범은 `2-api-convention.md §5.4`
(응답-계약 검증)와 `swagger.md §5-1`(엔티티 패스스루 금지) 양쪽을 시행 축으로 명시 링크하며,
두 문서 어느 쪽과도 모순되지 않는다(§5.4는 "선언되지 않은 키가 응답에 있다"를 이미 위반으로
규정하고 있고, 이번 등재는 그 규정을 재확인할 뿐 새 규칙을 만들지 않는다).

`2-navigation/4-integration.md §9.1`은 실제로 **변경되지 않았다** — draft가 "선행 브랜치 머지
후 반영"으로 명시적으로 미룬 것과 일치하며, 미반영 상태가 draft의 결정과 어긋나지 않는다.

### 요구사항 ID — 충돌 없음

`EIA-NX-12`, `CCH-SE-04`, `SS-SE-01~06`, `R-K` 어느 것도 새로 재정의되지 않았다. §7.1의 정정문은
EIA-NX-12와 자신을 명시적으로 구분하는 한 줄("`EIA-NX-12`의 '1회 평문 반환'과 다른 것을
말한다")을 두어, 두 서술이 같은 ID 아래 혼동될 여지를 사전에 닫았다.

### 상태 전이 · RBAC · 계층 책임 — 해당 변경 없음

이번 draft는 엔티티 상태 머신이나 권한 모델을 건드리지 않는다. secret 유출 결함의 처리 책임을
"엔티티 그대로 반환하는 컨트롤러 경계에서 지운다"로 명시했고, `select:false` 비채택 이유(내부
회전·정리 경로가 조용히 깨진다)도 적었다 — 기존 `background_run_id`(REST 미노출, `select:false`
사용, `data-flow/8-notifications.md`)와 표면적으로 반대 선택이지만, 그쪽은 소비 경로가 단일
내부 쿼리(`findByBackgroundRun`)로 한정돼 명시적 `addSelect`가 가능한 반면 이쪽은 회전·승격·
읽기 경로가 다수라는 차이가 있어 **동일 필드의 다른 규칙**이 아니라 **다른 필드의 다른 소비
패턴**이다. 충돌로 보지 않는다(참고용 INFO 이하로 판단).

- **[INFO]** `1-data-model.md §2.8`의 `notification_secret_v2` 행이 저장 형태(평문)를 명시하지
  않아, 바로 아래 `chat_channel_token_v2` 행("Bot token rotation grace 기간… **reference**")과
  서술 밀도가 비대칭이다.
  - target 위치: draft "후속 (이 PR 밖)" 목록 — "`1-data-model.md §2.8`의 `notification_secret_v2`
    행에 저장 형태 한 줄 (INFO#2)"
  - 충돌 대상: `spec/1-data-model.md:240` (실측: `Text? | Secret rotation 기간(24h grace) 동안
    사용되는 신규 secret …` — "평문"이라는 단어 자체가 없음) vs `:245`의 명시적 "reference" 서술
  - 상세: 모순은 아니지만, 이번 draft 전체가 다루는 축(같은 이름 패턴의 두 컬럼이 평문/ref로
    갈린다)이 정작 데이터 모델 원표에는 반영되지 않은 상태로 남는다. `plan/in-progress/
    spec-draft-nullable-notation-followups.md`를 확인한 결과 이 항목은 **체크박스로 등재되지
    않았다** — 같은 draft가 등재한 다른 두 후속 항목("트리거 회전 secret이 응답에 나간다",
    "`4-integration.md §9.1` 포인터")은 그 파일에 체크박스로 있는데, 이 항목만 draft 본문
    prose에만 남아 있다.
  - 제안: 이번 PR 범위 밖이라는 판단 자체는 유지하되, 세 번째 후속 항목도
    `spec-draft-nullable-notation-followups.md`에 체크박스로 옮겨 트래커 누락을 방지할 것을
    권고한다(cross-spec 위험도로는 영향 없음 — 문서 서술 밀도 차이일 뿐 모순은 아니다).

## 요약

target draft가 이미 반영한 두 커밋(`790487f34`, `e456be491`)을 `secret-store.md`·
`14-external-interaction-api.md §7.1`·`chat-channel.md R-K`·`data-flow/15-external-interaction.md
§1.5`·`1-data-model.md §2.8`·`2-api-convention.md`·`swagger.md` 원문 대조로 직접 검증한 결과,
데이터 모델·API 계약·요구사항 ID 어느 축에서도 모순을 찾지 못했다. 세 차례의 선행 `--spec`
라운드가 이미 "이름의 존재를 설계 의도로 오독"한 첫 진단을 반증했고, 그 반증 이후의 등재
(예외 근거 (1)~(4), §1.1 신설, 검증자 이중 등재)가 서로 인용·링크로 촘촘히 엮여 있어 cross-spec
관점에서 추가로 되짚을 결함이 남아 있지 않다. 유일한 잔여 사항은 INFO 등급의 트래커 누락
하나로, spec 간 모순이 아니라 이미 스스로 인지한 후속 작업이 체크리스트에서 빠진 문서 위생
이슈다.

## 위험도

LOW
