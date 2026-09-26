# Rationale 연속성 검토 — post-status-openapi

## 검토 범위

이 PR 은 `spec/2-navigation/2-trigger-list.md` 등 scope 지정 spec 델타는 0개이고(정상 — 코드 전용 PR),
실제 변경은 (1) POST 액션 14곳의 실제 성공 코드를 광고(200)에 맞추는 `@HttpCode(HttpStatus.OK)` 추가,
(2) `DELETE /api/workspaces/:id/invitations/:invitationId` 의 OpenAPI 광고를 204→200 으로 정정(런타임은
불변), (3) 신규 정적 가드 `http-status-advertised`, (4) `spec/conventions/swagger.md` §2-4 Rationale 신설이다.
`plan/in-progress/post-status-openapi.md` · `spec/conventions/swagger.md` · 관련 spec 문서(`2-api-convention.md`
§3/§6, `11-mcp-client.md`, `2-navigation/4-integration.md`, `9-user-profile.md`)의 Rationale 절과 코드 diff
(`_code_diff.patch`, 31파일)를 절대경로로 직접 대조했다.

## 발견사항

없음 — CRITICAL/WARNING 없음.

### INFO-1. §2-4 신설 Rationale 자체가 미해결 갭(자원 미생성 POST 분류)을 명시적으로 인정 — 이미 트래커 등재됨

- target 위치: `spec/conventions/swagger.md` §2-4 하단 신설 Rationale "§2-4 광고한 성공 코드 ↔ 실제 성공 코드 — 왜
  가드로 세는가 (2026-09-26)" 마지막 문단
- 과거 결정 출처: `spec/5-system/2-api-convention.md` §3(POST = "리소스 생성, 액션 실행" 양쪽 용도) · §6(200/201 두
  줄만 존재, "액션이지만 부수적으로 행이 생기는 POST" 칸 없음)
- 상세: 이번 PR 이 POST 액션 14곳(`oauthBegin`·`acceptInvitation` 등 부수적으로 행이 생기는 경계 사례 포함)을
  200 으로 통일하면서, §6 표에는 그 판단을 뒷받침하는 명문 규칙이 아직 없다. 신설 Rationale 스스로 "표 문면이
  아니라 교차 추론(래퍼 표 예시·`@HttpCode(200)` POST 42개 중 광고 있는 40개 실측)"이었다고 인정한다.
- 이것이 문제가 되지 않는 이유: (a) 새 결정이 기존 Rationale 을 뒤집는 게 아니라 기존 Rationale 이 다루지
  않던 빈 칸을 실무적으로 메운 것이고, (b) `plan/in-progress/post-status-openapi.md` 의 `--impl-prep` 처리
  표(W4)와 `spec-draft-nullable-notation-followups.md`(2026-09-26 "상태 코드 표에 «자원을 만들지 않는 POST
  액션» 칸이 없다" 항목)에 명시적으로 등재되어 후속 planner 결정으로 미뤄져 있다 — "결정의 무근거 번복"이
  아니라 "무근거 상태를 인지하고 트래커에 넘긴" 사례다.
- 제안: 조치 불필요. 후속 planner 턴에서 §6/§2-4 표에 "자원을 만들지 않는 POST 액션 = 200" 행을 추가할 때
  이 신설 Rationale 을 인용하면 된다(이미 계획됨).

## 대조 결과 — Rationale 위반이 없는 이유

1. **기각된 대안의 재도입**: 없음. `swagger.md` Rationale 은 기존 §1-6/§1-7/§3 Rationale 과 중복·모순 없이
   별도 절로 추가됐고, 기존 "기각한 대안" 서술(§1-6 numeric, §1-7 Update 접두)을 재론하지 않는다.
2. **합의된 원칙 위반**: 없음. 신설 가드는 TypeScript AST(`ts` 모듈, `decoratorCallName`)로 데코레이터를
   읽는다 — 정규식이 아니다. `@Res()` SSE 핸들러(`sendMessage`)를 면제하지 않은 판단도 Nest 소스
   (`router-execution-context.js`)를 직접 확인한 근거를 문서에 남겼다. 저장소 관례(AST 우선, 근거 실측
   선행)를 따른다.
3. **결정의 무근거 번복**: 없음. 14곳의 실제 코드(201/204)와 기존 광고(200/204)가 애초에 **불일치(버그)**
   였다 — "결정을 뒤집는" 것이 아니라 광고와 실제 중 하나로 수렴시키는 버그 수정이다. 특히
   `preview-test`(`11-mcp-client.md:537` "HTTP 200 OK") · `:id/test`(`2-navigation/4-integration.md:843`
   "200 + {success:false}")는 **spec 본문이 이미 200 으로 서술**하고 있었고 코드가 그와 어긋나 있었다 —
   이번 PR 은 spec 을 뒤집는 게 아니라 코드를 spec 에 맞췄다.
4. **암묵적 가정 충돌**: 없음. `revokeInvitation` 런타임(200 `{data:{ok:true}}`)은 그대로 두고 광고만
   맞췄다 — 미결정 트래커 항목("`workspaces.controller.ts` 만 삭제 성공에 204 대신 200")을 이 PR 이
   선점하지 않는다는 계획된 경계가 diff 와 정확히 일치한다(코드에 런타임 상태 코드 변경 없음, 광고
   데코레이터만 `ApiNoContentResponse`→`ApiOkWrappedResponse` 로 교체).

## 요약

target 은 광고-실제 상태 코드 불일치라는 실측된 버그를 고치는 PR이며, 새 결정(200 통일)의 근거를
`swagger.md` 신설 Rationale 에 상세히 기록했고, 두 개의 실제 정책 결정(어느 코드가 "맞는" 것인가·삭제
성공 시 204 vs 200)은 의도적으로 트래커에 위임한 채 이 PR 이 선점하지 않는다는 경계를 코드·plan·spec
세 층에서 일관되게 지켰다. 기존 Rationale(§1-4/§1-6/§1-7/§3, api-convention §6 410/413/비페이징 컬렉션
등)과 충돌하는 지점은 발견되지 않았고, 오히려 두 자리(`preview-test`·`:id/test`)는 spec-코드 drift를
해소해 기존 spec 서술과 코드를 재정합시켰다.

## 위험도

NONE
