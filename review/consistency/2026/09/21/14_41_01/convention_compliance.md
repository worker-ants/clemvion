# 정식 규약 준수 검토 — `spec/2-navigation` (--impl-prep, `authconfig-dup-delete`)

## 범위와 방법

prompt 번들이 `spec/2-navigation/**` 중 `1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`
세 파일만 본문을 실었고, 나머지 15개 파일(`4-integration.md`·`6-config.md`·`_layout.md` 등)과
`spec/conventions/**` 대부분(예산 초과로 `audit-actions.md`·`cafe24-api-catalog/_overview.md`
외 전부 절단)은 "본문 생략됨" 이었다. 이번 작업(`authconfig-dup-delete`)의 실제 대상은
`AuthConfigsService.remove()`(`spec/2-navigation/6-config.md` Part A) 이므로, 생략된
`6-config.md` 와 관련 규약 원본(`error-codes.md`·`swagger.md`·`secret-store.md`·
`egress-masking.md`·`audit-actions.md`·`i18n-userguide.md`·`spec-impl-evidence.md`)을 저장소에서
직접 `Read` 해 대조했다. 아래 없음은 "위반 없음" 이 아니라 "이 범위에서 발견 못함" 이다.

## 발견사항

- **[INFO]** `auth_config.delete` 감사 액션·`RESOURCE_NOT_FOUND` 에러 코드 재사용 — 규약 준수 확인
  - target 위치: `plan/in-progress/authconfig-dup-delete.md` §A·§B (구현 예정 처방)
  - 근거 규약: `spec/conventions/audit-actions.md` §3 레지스트리(`auth_config` = 현재형 CRUD →
    `create`/`update`/`delete`/`regenerate`/`reveal`), `spec/conventions/error-codes.md` §1
    (의미 기반 명명 — 신규 조건이 아니면 새 코드를 신설하지 않는다)
  - 상세: 계획서가 쓰려는 `auth_config.delete` 감사 액션명은 §3 레지스트리에 이미 등재된 현재형과
    정확히 일치하고, 진 쪽 404 에 재사용하려는 `RESOURCE_NOT_FOUND` 는 같은 서비스의 `findById`
    가 이미 던지는 코드와 동일하다 — 형제 PR(#1370~#1373, 트리거/스케줄/통합/멤버)이 세운 처방과
    같은 형태다. 신규 도메인 코드를 만들지 않고 기존 계약을 재사용하는 선택은 §2(rename 대신
    의미가 갈릴 때만 신설)의 취지와 부합한다.
  - 제안: 없음 — 구현 시 이 명명을 그대로 따르면 규약 위반 소지가 없다.

- **[WARNING]** `1-workflow-list.md` frontmatter `pending_plans:` 에 이미 `complete/` 로 이동한
  plan 이 남아 있다
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:`
    (`plan/complete/workflow-duplicate-nodes-edges.md`)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`pending_plans` = "미구현 surface 를
    책임지는 plan 경로") · §3.1 R-11 (공유 트래커의 승격 신호는 "그 문서 몫의 미구현 surface 가
    0 이 된 commit" — 항목별로 판정해 해소되면 빼야 하며, 전량-complete 가드는 그 중간 상태를
    보지 못한다는 것을 R-11 스스로 명시)
  - 상세: 해당 plan(`plan/complete/workflow-duplicate-nodes-edges.md`)은 `status: complete` 이고
    `spec_impact` 에 `spec/2-navigation/1-workflow-list.md` 자신을 명시했다. 실제로 본문 §2.6
    "복제" 항목은 "노드·엣지를 포함한 캔버스 전체가 복사" 라고 **현재형·완료 서술**로 적혀 있어
    이 plan 이 책임지던 미구현 surface 는 이미 0 이다. 그런데 frontmatter 는 여전히 그 plan 경로를
    `pending_plans:` 에 걸어 두고 있다. build 가드(`spec-pending-plan-existence.test.ts`)는 경로
    "존재" 만 보고, `spec-status-lifecycle.test.ts` 의 (c) 규칙은 **전체** 항목이 complete 일 때만
    승격을 요구하므로 — 다른 항목(`plan/in-progress/marketplace-and-plugin-sdk.md`)이 아직
    in-progress 라 이 부분 stale 은 기계로 걸리지 않는다. `spec-impl-evidence.md` §3.1 이 바로 이
    갭("가드가 보던 자리를 사람이 본다")을 사람이 메우라고 명시한 자리다.
  - 제안: 다음에 `1-workflow-list.md` 를 만질 때 `workflow-duplicate-nodes-edges.md` 항목을
    `pending_plans:` 에서 제거한다(그 plan 이 책임지던 surface 가 이미 §2.6 본문에 반영돼 있음을
    승격 근거로 커밋에 남긴다, R-11 이 요구하는 방식). 이 PR(`authconfig-dup-delete`, `spec_impact:
    none`)의 직접 결함은 아니므로 이번 PR 을 막을 사유는 아니다.

- **[INFO]** `6-config.md` DELETE 엔드포인트에 동시-삭제 결과(상태 코드 쌍)가 문서화돼 있지 않음
  — 형제 화면과의 비대칭
  - target 위치: `spec/2-navigation/6-config.md` §3 API 표 (`DELETE | /api/auth-configs/:id`)
  - 근거: `spec/2-navigation/2-trigger-list.md` §4.4 는 동일 클래스의 결함을 고친 뒤 "동시 삭제:
    두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`" 를 본문에
    명시했다.
  - 상세: 이것은 `spec/conventions/**` 의 **직접** 위반은 아니다(어떤 conventions 파일도 "동시
    삭제 결과를 API 표에 명시하라" 고 규정하지 않는다) — 스타일 일관성 관찰이다.
    `authconfig-dup-delete` plan 은 `spec_impact: none` 을 선언했으므로 이번 PR 이 `6-config.md`
    를 갱신하지 않는 것 자체는 계획대로다. 다만 형제 PR(#1370 트리거)은 스펙 본문에 결과를
    남겼고 이번 처방은 스펙 갱신을 계획에서 제외했다는 비대칭은, 이후 이 결함 클래스를 다시
    감사할 때 "왜 트리거만 문서화됐나" 라는 재조사를 유발할 수 있다.
  - 제안: 규약 위반은 아니므로 이번 PR 을 막지 않는다. `plan_impact: none` 결정을 유지한다면
    plan 본문에 "트리거와 달리 §4.4 상당의 spec 본문 갱신은 하지 않는다" 는 근거를 한 줄 남기면
    다음 리뷰어의 재조사 비용을 줄인다.

- **[INFO]** `spec/2-navigation` 대상 문서들의 명명·출력 포맷은 검토 범위 안에서 규약 위반을
  찾지 못했다
  - 확인한 것: 에러 코드(`VALIDATION_ERROR`/`RESOURCE_CONFLICT`/`TRIGGER_ENDPOINT_PATH_CONFLICT`/
    `AUTH_CONFIG_NOT_FOUND`/`MODEL_CONFIG_INVALID`/`BOT_TOKEN_INVALID` 등)가
    `error-codes.md` §1 의 UPPER_SNAKE_CASE·의미 기반·도메인 prefix(권장) 원칙과 부합, DTO
    명명(`Update<Entity>Dto` top-level vs nested `<Domain><Role>Dto`)이 `swagger.md` §1-7 과
    부합, `***<last4>` 마스킹·`secret://` 비대상(AuthConfig.config) 서술이 `secret-store.md` §1
    비대상 콜아웃과 정확히 일치, `auth_config.*` 감사 액션 표기가 `audit-actions.md` §3 레지스트리와
    일치, `6-config.md`/`1-workflow-list.md`/`2-trigger-list.md` frontmatter `code:` 글롭이 실제
    저장소 경로에 매치(표본 점검, stale 없음)함을 확인했다.
  - 제안: 없음 — 다만 이 결론은 예산 초과로 생략된 15개 `2-navigation` 파일과 대다수
    `spec/conventions/**` 원문을 이번 라운드에 전수로 대조하지 못한 상태에서 내려졌다는 점을
    감안해 판정에 반영하기 바란다.

## 요약

이번 검토는 컨텍스트 예산 초과로 `spec/2-navigation` 15개 파일과 `spec/conventions/**` 대부분의
번들 본문이 생략된 상태에서 시작했고, 이번 작업의 실제 대상인 `6-config.md`(Authentication)와
연관 규약 원본(error-codes·swagger·secret-store·egress-masking·audit-actions·spec-impl-evidence)을
저장소에서 직접 읽어 보강했다. 그 범위 안에서 CRITICAL 급 정식 규약 위반은 발견하지 못했다 —
계획서가 재사용하려는 감사 액션명(`auth_config.delete`)과 에러 코드(`RESOURCE_NOT_FOUND`)는
기존 레지스트리·형제 PR 처방과 정확히 일치한다. 유일하게 실질적인 발견은
`1-workflow-list.md` frontmatter 의 stale `pending_plans` 항목(WARNING, 이번 PR 과 무관한
선재 drift)이며, 그 외에는 형제 화면 간 문서화 비대칭 1건을 INFO 로 남겼다. `spec_impact: none`
을 선언한 이번 plan 의 범위(`AuthConfigsService.remove()` 구현) 자체가 spec 문서를 건드리지
않으므로, 이 검토가 impl-prep 게이트를 막을 근거는 없다.

## 위험도

LOW
