# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 형제 5건 중 4건이 지킨 `CHANGELOG.md` "Unreleased" 항목 관례를 이 PR 이 잇지 않는다
  - 위치: `/CHANGELOG.md` (신규 항목 부재 — 이 PR 의 diff 에 `CHANGELOG.md` 변경 없음)
  - 상세: 같은 결함 클래스(동시 DELETE 두 건이 감사 행을 두 번 남기는 문제)의 선행 PR 중
    workflow/workspace(#1369), trigger(#1370), schedule(#1371), integration(#1372) 네 건은
    각각 `CHANGELOG.md` 에 "## Unreleased — 동시 DELETE 두 건이 `X.deleted` 감사 행을 두 번
    남기던 것" 형태의 상세 항목(결함 설명 · 판별자가 형제와 다른 이유 · 고친 것 · 판별력 실측 ·
    남는 것)을 추가했다(`git log -- CHANGELOG.md` 로 확인). 이번 `auth-configs` PR 은 같은 형태의
    수정임에도 `CHANGELOG.md` 를 건드리지 않는다. 다만 바로 직전 형제(#1373, `member.removed`)도
    `CHANGELOG.md` 를 갱신하지 않은 것으로 확인돼(`git log -- CHANGELOG.md` 에 3ba663db2 없음)
    관례가 코드화된 필수 규약(SKILL.md 등에 명문화 없음)은 아니고, 최근 연속 2건이 생략한
    상태다 — 관례가 의도적으로 폐기된 것인지 우연히 두 번 누락된 것인지는 이 PR 만으로는
    판별 불가.
  - 제안: 관례를 유지한다면 이 PR 에도 형제 4건과 같은 형태의 항목을 추가한다. 관례를 더 이상
    따르지 않기로 했다면(예: `plan/complete/` 가 이력 SoT 라는 CLAUDE.md 원칙과의 정합을 위해)
    그 결정을 트래커(`spec-draft-nullable-notation-followups.md` 등)에 한 줄로 남겨 다음
    "여덟 번째"(`model-config`) · "아홉 번째"(`webauthn`) PR 작성자가 같은 질문을 반복하지
    않게 한다.

- **[INFO]** `spec/2-navigation/6-config.md` 의 DELETE 엔드포인트 서술에 "동시 삭제 → 두 번째
  404" 계약이 반영되지 않음 — 형제 `2-trigger-list.md` §4.4 와의 문서 밀도 비대칭
  - 위치: `spec/2-navigation/6-config.md` §3 API 표 (`DELETE /api/auth-configs/:id`) — 이번 PR
    범위 밖(파일 미변경)
  - 상세: 이 발견은 이미 `review/consistency/2026/09/21/14_41_01/convention_compliance.md` 와
    `SUMMARY.md` 가 INFO 로 등재하고 "규약 위반 아님·`spec_impact: none` 대로 이번 PR 을 막지
    않음" 으로 처분했다. 문서화 관점에서도 같은 결론이다 — API 계약 표에 있는 상태 코드
    자체는 바뀌지 않았고(기존에도 `RESOURCE_NOT_FOUND` 404 는 `findById` 경로에 이미 있었다)
    다만 "동시 요청 시 진 쪽이 404 를 받는다" 는 구체적 서술이 트리거 화면에만 있고
    `6-config.md` 엔 없는 비대칭이 이번 PR 로 7번째 인스턴스가 된다.
  - 제안: 조치 불요(이미 처분됨). `convention_compliance.md` 가 제안한 대로 plan 본문에
    "트리거와 달리 spec 본문 갱신은 하지 않는다" 는 근거를 한 줄 남기면 다음 리뷰어의
    재조사 비용을 줄인다.

- **[INFO]** `findById()` JSDoc 의 호출자 목록이 `remove()` 를 누락 — 이 PR 이 만든 문제는
  아니고 선재 상태
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `findById` 메서드
    JSDoc(`/** 내부 전용 — 평문 config 를 그대로 반환. verify / reveal / update / regenerate /
    usage 가 사용. */`)
  - 상세: `remove()` 는 이번 diff 이전부터 이미 `this.findById(id, workspaceId)` 를 호출해 왔다
    (diff 의 `-const config = await this.findById(id, workspaceId);` 줄이 그 증거). 즉 이 JSDoc
    의 호출자 열거는 이번 PR 이전부터 `remove` 를 빠뜨리고 있었고, 이번 PR 도 그 줄을 그대로
    둔다(`+await this.findById(id, workspaceId);` 로 형태만 바뀜).
  - 제안: 이번 PR 이 반드시 고쳐야 하는 것은 아니지만, 이미 `remove()` 본문을 만지는
    김에 `verify / reveal / update / regenerate / usage` 뒤에 `remove` 를 추가해 두면
    사소한 stale 을 없앨 수 있다.

## 요약

새 헬퍼 `throwAuthConfigNotFound()` 의 JSDoc, `remove()` 본문의 인라인 주석, 신규 e2e 스펙의
헤더 주석 모두 상세하고 실측(cascade 없음·ON DELETE SET NULL·204 성공 코드·§1.11 400 예외
자리와의 구분)으로 뒷받침돼 있으며, 인용한 파일·줄(`app.module.ts:213`, `roles.guard.ts:114-119`,
`V001__initial_schema.sql:210`, `spec/5-system/3-error-handling.md` §1.11)을 모두 직접 대조해
정확함을 확인했다. `plan/in-progress/authconfig-dup-delete.md` 는 착수 전 실측·재현·뮤테이션
결과를 체크리스트에 기록했고, 자신이 앞서 등재한 잘못된 근거(「RolesGuard 가 없다」)를 취소선
+ 정정 문단으로 투명하게 고쳐 rationale-continuity 관례를 모범적으로 따랐다. 유일한 실질적
공백은 형제 4건(#1369~#1372)이 지킨 `CHANGELOG.md` "Unreleased" 항목 관례를 이 PR 이(그리고
직전 형제 #1373 도) 잇지 않는다는 점이며, 이는 코드화된 필수 규약이 아니라 판단을 요하는
WARNING 으로 남긴다. 나머지 두 항목(`6-config.md` 문서 밀도 비대칭, `findById` JSDoc 의
선재 stale)은 이미 처분됐거나 이번 PR 범위 밖의 저위험 INFO 다.

## 위험도

LOW
