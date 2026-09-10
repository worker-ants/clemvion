# 신규 식별자 충돌 검토 — `spec-draft-doc-precision-batch-c.md`

## 검토 개요

target 은 `1-data-model.md`·`2-navigation/2-trigger-list.md`·`5-system/2-api-convention.md`·
`5-system/3-error-handling.md`·`conventions/review-citations.md`·`conventions/swagger.md`
6개 spec 파일에 대한 **문서 정밀도 교정 5건**(C-1~C-5)이다. 실측 결과 다섯 항목 모두
**새 요구사항 ID·새 엔티티/DTO·새 API endpoint·새 이벤트명·새 ENV/설정키를 도입하지 않는다** —
전부 기존에 이미 존재하는 식별자(코드 상수·컬럼명·가드 파일·config 키)를 spec 산문에
정확히 반영하거나, 기존 앵커로의 링크를 보강하거나, 기존 테스트 fixture 파일 경로를
`code:` frontmatter 에 소유 문서별로 재배치하는 작업이다. 항목별 실측은 아래와 같다.

### C-1 — "쿼리 범위 `select` 투영" 각주

`1-data-model.md:962-966` Rationale 표의 **채택 행 하위 각주**로 넣는 안이며 별도 표 행을
신설하지 않는다. 신규 용어 "쿼리 범위 `select` 투영"은 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에서 이미 쓰이던 표현이고(`grep` 확인), 코드 쪽 실체는 `CREATOR_PROJECTION`
(`codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:92`)로 —
기존에 존재하는 상수를 인용할 뿐 새 이름을 만들지 않는다. 오히려 이 각주 자체가
"1행의 기각된 `select: false`" 와 "채택된 쿼리별 `select` 옵션" 이라는 **이름이 비슷한 기존
두 개념의 혼동을 해소**하려는 목적이라, 신규 식별자 충돌 관점에서는 문제가 아니라 해당
문제의 교정이다.

### C-2 — `notification_secret_v2` 저장 형태 명시

변경안이 그대로 유지하는 `config.notification.signing.secret` 참조는 이미
`triggers.service.ts:437,794`·`secret-store.md:296` 등에서 쓰이는 **기존 필드명**이며,
`.secretRef`(canonical 참조)와는 이미 문서 전역에서 분리돼 쓰인다(`14-external-interaction-api.md:922`).
새로 추가되는 링크 앵커 `secret-store.md#1-uri-scheme`(실재: `## 1. URI Scheme`, line 16),
`secret-store.md#11-비대상-필드도-응답-바디에는-나가지-않는다`(실재: line 89),
`15-chat-channel.md#r-k-chat_channel_token_v2-컬럼-명명의-semantic-비대칭`(실재: line 640,
heading `### R-K. chat_channel_token_v2 컬럼 명명의 semantic 비대칭`) 모두 실제 heading 과
slug 가 일치한다. 새 식별자 없음.

### C-3 — `swagger.md` 인용 병기

추가되는 앵커 `swagger.md#1-4-nested--enum--union`(실재: line 90, `### 1-4. nested / enum / union`)
도 실제 heading 과 일치하며, 그 절이 실제로 `nullable: true` 근거와
`API 규약 §5.4` 역방향 링크를 담고 있음을 본문 확인(line 90-116)으로 검증했다. 새 식별자
없음 — 순수 cross-reference 보강.

### C-4 — `code:` 등재 정밀화

새로 등재하려는 6개 glob 은 전부 **저장소에 이미 존재하는 파일**이다(실측,
`.claude/worktrees/spec-doc-precision-batch-c-d9b990` 기준):
- `fixtures/dto/responses/optional-nullable.fixture.ts`
- `fixtures/user-eager-relation.fixture.ts` / `fixtures/user-relation-load.fixture.ts`
- `fixtures/dto/responses/jsdoc-citation.fixture.ts`
- `repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` + `.spec.ts`
- `fixtures/endpoint-path-save.fixture.ts`

`spec/` 전수 grep(`grep -rln "endpoint-path"`)으로 확인한 결과 이 경로들은 **어느 spec 문서에도
아직 등재돼 있지 않다** — 따라서 target 이 이들을 각각 `2-api-convention.md`+`swagger.md`,
`review-citations.md`, `2-navigation/2-trigger-list.md` 에 배정해도 **다른 문서가 이미 소유권을
주장하는 경로와 겹치지 않는다.** `swagger-dto-contract*.ts`·`user-entity-exposure*.ts` 를
`2-api-convention.md`와 `swagger.md` 양쪽에 중복 등재하는 것도 기존에 이미 그렇게 돼 있는
패턴(두 문서 frontmatter 확인)과 동형이라 새로운 충돌이 아니다. `production-build-devdep*`
는 spec 등재 대상에서 **제외**하기로 한 처분이며, `grep -rln`으로 관련 키워드(`tsconfig.build.json`,
`devDependency` 등) 0건임을 확인해 "소유 spec 부재" 주장이 사실과 일치한다.

### C-5 — `requestId` 예시값 통일

`req_abc123`(`3-error-handling.md:265,284,475`)을 UUID(`f3b6d2e0-9d4a-4b77-9d19-7a0f8f4c1e2b`,
`2-api-convention.md:175`·`12-webhook.md:302` 기존 정본과 동일)로 바꾸는 것은 **새 식별자
도입이 아니라 기존에 이미 존재하던 두 표기(접두 문자열 vs UUID)의 불일치를 정본 쪽으로
수렴시키는 작업**이다. `14-external-interaction-api.md:340` 의 `"3f2a…"` 는 명시적으로 제외
대상이며, 이는 UUID 의 줄임 표기이지 다른 스키마가 아니라는 target 의 판단도 실측(EIA 문서
전반의 축약 관례)과 부합한다. 변경 후에도 저장소 전체에서 `requestId` 예시 형식이 서로
다른 의미로 쓰이는 잔여 사례는 없다(전수 grep 확인).

## 발견사항

없음 (CRITICAL/WARNING 없음).

- **[INFO]** "쿼리 범위 `select` 투영" 용어의 지속 일관성 권고
  - target 신규 식별자: `1-data-model.md ## Rationale` 채택 행 각주의 서술 표현 "쿼리 범위 `select` 투영"
  - 기존 사용처: 같은 표 1행의 "컬럼 `select: false`" (기각된 안)
  - 상세: 이 자체는 target 이 해결하려는 기존 혼동(이름은 비슷하나 성질이 반대)이며 이번
    각주가 그 구분을 명문화한다. 다만 이 표현이 이번 배치 이후 다른 spec 문서(예:
    `2-api-convention.md §5.4` 검증 층 서술)에서 재인용될 가능성이 있으므로, 향후 인용 시
    "엔티티 전역 `select: false`" vs "쿼리 범위 `select` 투영"이라는 대비 문구를 그대로
    유지해 재도입 오판을 반복하지 않도록 권고한다.
  - 제안: 별도 조치 불요 — 현재 문안이 이미 대비 표를 포함해 명확함. 후속 배치에서 이
    구분을 다시 설명할 때 동일 문구를 재사용할 것을 권장.

## 요약

target 5건(C-1~C-5)은 모두 기존 코드·설정·문서에 이미 존재하는 식별자(컬럼명 `notification_secret_v2`,
상수 `CREATOR_PROJECTION`, config 키 `config.notification.signing.secret`, 가드/픽스처 파일 경로,
`requestId` UUID 정본값)를 spec 산문에 정확히 반영하거나 소유 문서를 재배정하는 순수
정밀도 교정이며, 새로 도입되는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·
spec 파일 경로가 하나도 없다. `code:` 항목 재배치(C-4)도 실측상 다른 문서가 이미 점유한
경로와 겹치지 않아 소유권 충돌이 없으며, 앵커 링크(C-2·C-3)도 전부 실재 heading 에 정확히
착지한다. 신규 식별자 충돌 관점에서 이 target 은 위험이 없다.

## 위험도

NONE
