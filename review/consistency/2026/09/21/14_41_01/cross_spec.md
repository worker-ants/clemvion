# Cross-Spec 일관성 검토 — `spec/2-navigation` (--impl-prep, authconfig-dup-delete)

## 검토 배경

대상 plan(`plan/in-progress/authconfig-dup-delete.md`)은 `AuthConfigsService.remove()` 의 동시
삭제 레이스(무락 `findById` → `remove(entity)` 가 0행이어도 던지지 않아 감사 행이 두 번 남는 결함)를
`#1370`~`#1373` 과 같은 형태로 고치는 **코드 전용** 작업이며 `spec_impact: none` 을 선언한다. 선행
형제 PR 다섯 건(workflow #1369 · trigger #1370 · schedule #1371 · integration #1372 · workspace
member #1373) 을 `git show --stat` 로 확인한 결과 전부 spec 파일 변경 없이 코드만 고쳤다 — 이번 건도
같은 전례를 따른다는 plan 의 전제가 실측과 일치한다.

context 예산 초과로 번들에서 절단된 `spec/2-navigation/6-config.md`(Authentication 절, AuthConfig 의
1차 SoT 화면 spec) 는 직접 `Read` 로 열어 확인했다. 아래는 그 내용과 `spec/1-data-model.md §2.17`,
`spec/5-system/1-auth.md`, `spec/data-flow/1-audit.md`, `spec/conventions/audit-actions.md`,
`spec/5-system/3-error-handling.md` 를 대조한 결과다.

## 발견사항

교차 영역 데이터 모델·API 계약·RBAC·에러 코드·감사 액션 명명을 대조한 결과 **모순은 발견되지
않았다**:

- **FK cascade 방향** — `Trigger.auth_config_id → AuthConfig` 는 `1-data-model.md:253`
  (`FK → AuthConfig (SET NULL · Webhook 인증)`) 과 `:975`(`FK ON DELETE SET NULL(인증 설정 삭제)`)
  양쪽이 일치하고, `2-trigger-list.md §4.3` 의 반대 방향(트리거 삭제 시 auth_config 는 안 지워짐)
  서술과도 상충하지 않는다. 이번 PR 이 다루는 결함(동시 삭제 레이스)과 직접 관련된 FK 의미는
  기존 spec 문서 간에 이미 정합적이다.
- **감사 액션 명명** — `auth_config.delete` 는 `5-system/1-auth.md:427`,
  `data-flow/1-audit.md:80`, `conventions/audit-actions.md` 세 곳 모두 동일 토큰으로 등재돼
  있고, 코드(`AUDIT_ACTIONS.AUTH_CONFIG_DELETE`)와도 일치한다.
- **에러 코드** — plan 이 진 쪽에 쓰기로 한 `RESOURCE_NOT_FOUND`(404) 는 `findById` 가 이미 던지는
  코드와 같고(`auth-configs.service.ts:130-137`), `5-system/3-error-handling.md:83` 의 일반 정의와도
  일치한다. `AUTH_CONFIG_NOT_FOUND`(400, `2-trigger-list.md` PATCH 의 `authConfigId` 미스매치
  전용) 와는 별개 코드·별개 시나리오이며, 혼동 가능성은 `5-system/15-chat-channel.md:434` 가 이미
  "이 두 자리를 혼동하지 말 것" 으로 선제 경고해 두고 있어 이번 PR 이 새로 만드는 모호성은 없다.
- **RBAC** — `6-config.md` §A.4/§3(Authentication API) 이 명시하는 "mutation(POST/PATCH/DELETE
  /regenerate/reveal) 은 Admin+" 는 `5-system/1-auth.md:385`(Auth Config 행: Owner/Admin=CRUD,
  Editor/Viewer=R) 와 정확히 일치한다. 이 PR 은 권한 체크 자체를 바꾸지 않는다(락 없는 원자적
  `DELETE` 로 치환할 뿐, `@Roles` 데코레이터·가드는 그대로).

## 관찰 (참고 — 이번 PR 을 막을 사안 아님)

- **[INFO] 동시 삭제 [204,404] 동작을 spec 본문에 명시하는 파일이 형제 자원 중 트리거뿐**
  - target 위치: `spec/2-navigation/6-config.md` §3 Authentication API 의 `DELETE
    /api/auth-configs/:id` 행 (동시 삭제에 대한 언급 없음)
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md:318`
    ("동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404
    RESOURCE_NOT_FOUND`")
  - 상세: `grep -rn "동시 삭제" spec/2-navigation/*.md spec/5-system/*.md` 결과 이 문구는
    `2-trigger-list.md` 에만 있다. `1-workflow-list.md`(§2.6/§3), `3-schedule.md`,
    `4-integration.md`, `6-config.md` 는 각각 대응하는 자원의 DELETE 가 코드 레벨로는 이제
    (또는 곧) 동일하게 `[204, 404]` 로 수렴했음에도(`#1369`~`#1373`, 그리고 이번 PR) 그 사실을
    spec 문장으로 명시하지 않는다. 모순은 아니다 — 각 spec 이 그 사실을 "말하지 않을" 뿐, "다르게
    말하고" 있지는 않다.
  - 제안: 이번 PR 의 범위는 아니다(코드 결함 수정이며 `spec_impact: none` 이 타당하다). 다만
    형제 patch 다섯 건이 반복적으로 같은 결함 클래스를 겪은 만큼, 후속으로 "리소스 DELETE 의
    동시 요청은 두 번째가 404 `RESOURCE_NOT_FOUND` 로 수렴한다" 는 문장을 `spec/conventions/`
    또는 `5-system/2-api-convention.md` 에 한 번 정착시키고 각 화면 spec 이 그것을 참조하게 하면,
    다음에 같은 자리가 발견될 때마다 spec 문장을 새로 쓸 필요가 없어진다(별도 plan 항목으로 적합 —
    이번 plan 의 "이 PR 이 하지 않는 것" 목록에 추가할 만하다).

## 요약

이번 target(`spec/2-navigation`, --impl-prep)은 `AuthConfigsService.remove()` 동시 삭제 감사 중복
결함을 고치는 코드 전용 작업이고, 선언된 `spec_impact: none` 은 관련 spec 문서(6-config.md 의
Authentication 절, data-model.md §2.17, 5-system/1-auth.md, data-flow/1-audit.md,
conventions/audit-actions.md, 5-system/3-error-handling.md)를 대조한 결과 타당하다 — FK
cascade 방향·감사 액션 명명·에러 코드·RBAC 매트릭스 어디에도 모순이 없다. 유일하게 눈에 띄는 것은
"동시 삭제 시 두 번째 요청은 404" 라는 동작이 형제 자원 중 트리거 spec 에만 문장으로 남아 있고 다른
자원(workflow/schedule/integration/auth-config)에는 없다는 문서 밀도 비대칭이지만, 이는 모순이
아니라 완성도 편차이며 이번 PR 을 막을 사안이 아니다.

## 위험도

NONE
