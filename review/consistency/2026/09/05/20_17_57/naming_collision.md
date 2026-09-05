# 신규 식별자 충돌 검토 — `spec-draft-notification-secret-storage.md`

## 점검 대상 식별자 (target 이 실제로 도입/등재한 것)

커밋 `790487f34` · `e456be491` (983fd0ade..HEAD) 로 이미 반영된 diff 를 직접 대조했다:

1. `spec/conventions/secret-store.md` 신규 `### 1.1` 절 — "비대상 필드도 응답 바디에는 나가지 않는다"
2. `spec/conventions/secret-store.md` §1 신규 비대상 예외 문단 — `Trigger.notification_secret_v2`
3. `spec/5-system/2-api-convention.md` frontmatter `code:` 신규 라인 —
   `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts`
4. `spec/5-system/14-external-interaction-api.md` §7.1 정정문 (신규 식별자 도입 없음, 기존 문장 교체)

`4-integration.md`·`1-data-model.md` 는 target 자신의 결정(W6/후속)에 따라 이번 커밋에 **미반영** —
검색 범위에서 제외.

## 발견사항

검토 관점 6개(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일경로)를 코퍼스
전체(`spec/**`, `codebase/backend/src/**`)에 대해 실측했다. **충돌 없음.**

### 확인한 항목별 근거

- **`### 1.1` 섹션 번호** — `secret-store.md` 안에서 유일한 `1.1`(`grep -n "^#\{1,4\} "` 전수
  확인, 다른 `§1.1` 없음). `§2.1`/`§3.1`/`§5.1` 등 기존 `N.M` 서브섹션 명명 관례와 동형이라
  번호 체계 충돌 없음. 외부에서 참조할 때도 항상 `secret-store.md §1.1` 로 파일 한정 — 다른
  문서의 동명 섹션과 혼동될 자리가 없다.
- **`Trigger.notification_secret_v2`** — `spec/1-data-model.md`·`14-external-interaction-api.md`·
  `15-chat-channel.md`·`data-flow/0-overview.md`·`data-flow/1-audit.md`·
  `data-flow/15-external-interaction.md`·엔티티/서비스 코드 전체에서 **동일 의미**(HMAC signing
  secret 의 rotation-grace 신규 값)로만 쓰인다. 자매 컬럼 `chat_channel_token_v2`(ref) 와의
  semantic 비대칭은 `chat-channel.md §R-K` 가 이미 결정해 등재해 둔 것이고, 이 target 은 그
  결정을 재사용할 뿐 새 의미를 얹지 않는다.
- **`R-K`** — `chat-channel.md` 안에서 유일한 Rationale 라벨(`grep -n "R-K"` 확인). 그 파일
  자신이 이미 "신규 Rationale 은 `R-CC-N` prefix, 기존 `R1~R9`/`R-K` 는 하위 호환 유지"라는
  ID 충돌 방지 규칙을 §606 부근에 명시해 두고 있어, target 이 `R-K` 를 인용하는 것은 기존
  등재를 재참조하는 것이지 새 ID 채번이 아니다.
- **`EIA-NX-12`** — 기존 ID 재참조뿐(§7.1 정정문의 "EIA-NX-12 와 혼동 방지" 각주). 새 ID
  아님. 오히려 target 은 `notification_secret_v2`(컬럼-평문)와 `EIA-NX-12`(rotate 응답 1회
  평문)의 **이름 유사로 인한 혼동 가능성**을 스스로 지적하고 각주로 구분선을 그었다 — 이것은
  이 checker 가 지적하려던 것을 target 이 선제적으로 처리한 사례.
- **`v2` 접미사 이중 의미** — `14-external-interaction-api.md:969` 는 서명 스킴 헤더의 `v2=`
  (아직 미발행)와 `notification_secret_v2` 컬럼의 `v2`가 **"이름만 겹친다"**는 각주를 이미
  갖고 있다. 이 각주는 target 이전부터 있던 것으로(983fd0ade 이전 커밋 확인), target 이 새로
  만든 충돌이 아니라 이미 문서화된 기존 구분이다.
- **`code:` glob 신규 등재** — `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts`
  는 실제 존재하는 파일(`swagger-dto-contract-guard.ts`·`swagger-dto-contract.spec.ts`)을
  가리키고, `spec/conventions/swagger.md` 의 `code:` 에도 동일 glob 이 이미 등재돼 있어(직전
  플래너 턴 983fd0ade 의 "양쪽 등재" 결정) 중복이 아니라 의도된 **양쪽 등재**다. 같은 파일
  안에서도 기존 라인과 정확히 중복되지 않고 알파벳 순서 위치도 올바르다.
- **§5.4 인용** — target 은 `secret-store.md`·`14-external-interaction-api.md` 양쪽에서
  "API 규약 §5.4 응답-계약 검증"을 인용한다. 실제로 `2-api-convention.md §5.4`(제목: "부재
  표현 — `null` vs 키 생략")는 `#### 검증 층` 하위 절에서 응답-계약 검증자 두 개를 다루고
  있어 인용이 정확하다 — 다른 문서의 별개 `§5.4`(예: `swagger.md` 는 `§5-1` 표기 체계라 번호
  형식 자체가 다름)와 혼동될 표기 중복이 아니다.
- **plan 파일 경로** — `plan/in-progress/spec-draft-notification-secret-storage.md` 는
  `spec-draft-*` 명명 관례를 따르고, 인접한 `spec-draft-eia-notification-payload-contract.md`
  (별개 주제: EIA payload 계약)와 파일명이 다르며 내용도 겹치지 않는다. 기존 파일 덮어쓰기
  없음.
- **신규 요구사항 ID 미채번** — target 은 `SS-SE-0X` 류의 새 보안 요구사항 ID, 새 엔티티/DTO명,
  새 API endpoint, 새 webhook/queue/SSE 이벤트명, 새 ENV var 를 **하나도 도입하지 않는다** —
  전부 기존 컬럼·기존 Rationale·기존 코드 경로에 대한 문서 정정과 예외 등재뿐이다. 따라서
  해당 4개 관점(요구사항 ID/엔티티·API endpoint/이벤트명/ENV)은 대상 자체가 없다.

## 요약

target 이 실제로 새로 도입하는 식별자는 `secret-store.md §1.1`(신규 섹션)과 그 안의
`Trigger.notification_secret_v2` 비대상 예외 항목, 그리고 `2-api-convention.md` frontmatter
의 `swagger-dto-contract*.ts` glob 등재 정도로 매우 좁다. 셋 다 코퍼스 전체(spec 39개 파일 +
backend 소스)에서 기존 사용처와 대조했을 때 의미 충돌·이름 재사용·중복 등재가 없었고, 오히려
`R-K` ID 충돌 방지 규칙·`EIA-NX-12` 구분 각주·`v2` 이중 의미 각주처럼 이 프로젝트가 이미
갖추고 있던 충돌 방지 장치들과 target 의 표현이 정합했다. 신규 식별자 충돌 관점에서 이
draft 를 막을 사유는 없다.

## 위험도
NONE
