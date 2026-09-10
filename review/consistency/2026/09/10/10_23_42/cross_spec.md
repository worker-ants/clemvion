# Cross-Spec 일관성 검토 — `spec-draft-doc-precision-batch-c.md`

## 검토 범위

target(`plan/in-progress/spec-draft-doc-precision-batch-c.md`)이 제안하는 5건(C-1~C-5)을
각각 실제 `origin/main` 상태(`aa15503c7`, 현재 worktree HEAD 와 동일)와 대조했다. 각 항목이
인용하는 다른 영역 spec 파일·코드 심볼을 직접 열어 문구·앵커·존재 여부를 실측했다.

| 항목 | 대상 spec | 교차 확인한 다른 영역 |
|---|---|---|
| C-1 | `1-data-model.md` Rationale 표 | `5-system/2-api-convention.md §5.4`(구조 축/이름 축 용어), `workflow-versions.service.ts`(`CREATOR_PROJECTION`), `workspaces.service.ts`(`listMembers`), `user-entity-exposure-guard.ts` |
| C-2 | `1-data-model.md §2.8 Trigger` | `conventions/secret-store.md §1`, `5-system/15-chat-channel.md §R-K`, `data-flow/15-external-interaction.md §1.5`(승격 시 NULL 클리어) |
| C-3 | `5-system/2-api-convention.md §5.4` | `conventions/swagger.md §1-3`·`§1-4` |
| C-4 | `code:` 프런트매터 4개 문서 | `conventions/spec-impl-evidence.md`, `5-system/3-error-handling.md §1.10`, `2-navigation/2-trigger-list.md §3`, 실제 `repo-guards/__tests__/**` 파일 존재 여부 |
| C-5 | `5-system/3-error-handling.md` 3곳 | `5-system/2-api-convention.md:175`, `5-system/12-webhook.md:302`, `5-system/14-external-interaction-api.md:340` |

## 발견사항

교차 검토 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 6가지 전부에서
**CRITICAL/WARNING 급 충돌을 찾지 못했다.** 실측 결과는 모두 target 의 서술과 일치했다:

- C-1 이 재사용하는 "구조 축"/"이름 축" 용어는 `2-api-convention.md §5.4` 와 `1-data-model.md
  §2.1.1`이 이미 쓰는 것과 동일 — 새 용어 충돌 없음. `CREATOR_PROJECTION`
  (`workflow-versions.service.ts:92`)과 `WorkspacesService.listMembers`
  (`workspaces.service.ts:225` 의 `select:`) 둘 다 코드에 실존하며, 코드 주석의 "쿼리 하나의
  투영" 표현(`workspaces.service.ts:224`)이 draft 문구와 일치한다.
- C-2 가 인용하는 `secret-store.md` 의 "grace 동안 신규 secret 은 컬럼에 평문" 문구와 "승격 시
  컬럼 null 클리어"(`data-flow/15-external-interaction.md:226`)는 실측대로다. 자매 행
  `chat_channel_token_v2` 가 reference(`15-chat-channel.md:285` "컬럼은 ref 만 보관 —
  plaintext 는 secret_store")라는 대비도 정확 — 두 필드의 저장 형태 등급 차이를 데이터
  모델에 옮기는 것이라 새 모순을 만들지 않는다.
- C-3 은 `swagger.md §1-3`(81~88행, `@ApiPropertyOptional({enum,default})` 예시만)과
  `§1-4`(90~128행, `nullable:true` 블록쿼트 + API 규약 §5.4 로의 역방향 링크)의 비대칭을
  정확히 짚었다. 정방향 링크만 병기 대상이며, 깨진 앵커는 아니다(둘 다 실재 heading).
- C-4 의 실측 표(fixture 5개, 가드 본체 13개 중 4개 미등재)에 등장하는 파일 6종
  (`optional-nullable.fixture.ts`, `user-eager-relation.fixture.ts`,
  `user-relation-load.fixture.ts`, `jsdoc-citation.fixture.ts`,
  `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`, `endpoint-path-save.fixture.ts`,
  `production-build-devdep-guard.ts`/`.spec.ts`) 전부 실제 경로에 존재를 확인했다. 제안하는
  등재처(`2-api-convention.md`+`swagger.md` 동시 등재, `review-citations.md`,
  `2-navigation/2-trigger-list.md`)는 기존에 **동일 패턴으로 이미 이중 등재된 선례**
  (`swagger-dto-contract*.ts`·`user-entity-exposure*.ts`·`user-secret-absence*.ts` 가 두
  문서 모두의 frontmatter 에 이미 있음, `#1289` 선례)와 정합하며, 다른 spec 파일이 같은 경로를
  선점 등록해 소유권이 겹치는 경우도 없었다(`grep -rn` 전수 확인 0건). `2-trigger-list.md`
  가 소유자라는 근거(`3-error-handling.md:234` "공용 카탈로그 가시성 등재"만, SoT 는
  `2-trigger-list.md#3-api`)도 기존 패턴(§1.5~§1.9 전부 "도메인 spec 이 SoT, §1 은 등재")과
  일치한다. `production-build-devdep*` 를 등재하지 않고 별 항목으로 미룬 것도
  `spec-impl-evidence.md` 의 카테고리(§2.1: 시행 코드 없는 문서형 convention) 반대 케이스라는
  분석이 맞다 — 억지로 특정 spec 파일에 끼워 넣지 않은 판단은 계층 책임을 흐리지 않는다.
- C-5 의 정본 UUID(`f3b6d2e0-9d4a-4b77-9d19-7a0f8f4c1e2b`)는 `2-api-convention.md:175` 와
  `12-webhook.md:302` 두 곳에 이미 동일하게 쓰이고 있어, `error-handling.md` 세 곳을 거기
  맞추는 것은 기존 정본과의 **불일치를 해소**하는 방향이다. EIA 문서의 `"3f2a…"`
  (`14-external-interaction-api.md:340`)를 제외한 판단도 근거가 있다 — 그것은 별도 포맷이
  아니라 줄임표 표기이고 주변 표가 이미 값들을 축약해서 쓰는 관례(예: 같은 문서 내 `uuid`
  placeholder 등)를 갖고 있다.

새로운 엔티티·필드·엔드포인트·요구사항 ID·상태 값·권한 규칙은 이 배치에서 하나도 도입되지
않는다 — 전부 기존 서술의 정밀도 보정(각주 추가·용어 병기·`code:` glob 세분화·예시 값 통일)
이라 "두 영역이 서로 다른 답을 준다"는 형태의 충돌이 발생할 표면 자체가 없다.

### INFO — C-1 각주 삽입 위치는 문서 렌더링으로 재확인 권장

C-1 의 변경안은 표의 마지막 행(`| **응답 경계 투영 + 검출 2축** | ... |`) 바로 다음에
빈 줄 없이/있이 블록쿼트(`>`)를 붙이는 형태다. GFM 표는 첫 비-`|` 라인에서 종료되므로 문법
자체는 깨지지 않지만, 표 직후 기존 설명 문단("두 축을 다 세운 이유")과 신규 블록쿼트가
연달아 오면 어느 것이 "채택 행에 대한 각주"이고 어느 것이 "표 전체에 대한 설명"인지 시각적
경계가 흐려질 수 있다. 체크리스트에 이미 있는 "문서 가드(`vitest src/lib/docs/__tests__`)"
실행으로 앵커·링크는 걸러지지만, 이 시각적 배치 자체는 그 가드의 검증 범위 밖이므로 최종
diff 에서 렌더링 결과를 눈으로 한 번 더 보는 것을 권장한다. (Cross-spec 충돌은 아니며, 같은
문서 내부의 편집 품질 이슈다.)

## 요약

target 의 5건(C-1~C-5)은 모두 이미 존재하는 다른 영역 spec·코드의 실측값에 맞춰 대상 문서를
정밀화하는 보정이며, 새로운 엔티티/API/요구사항 ID/상태 전이/RBAC/계층 책임을 도입하지 않는다.
인용된 교차 참조(용어 일치, 링크 앵커, 코드 심볼 존재, `code:` 이중 등재 선례, 정본 값 재사용)
를 전부 직접 열어 대조한 결과 실측과 어긋나는 서술을 찾지 못했다. Cross-spec 관점에서 이
배치를 그대로 채택해도 다른 영역과 모순되는 지점은 없다.

## 위험도

NONE
