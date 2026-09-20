# 정식 규약 준수 검토 — `spec/4-nodes/4-integration/` (--impl-prep, plan: ssrf-catch-instanceof)

## 검토 배경

대상 plan(`plan/in-progress/ssrf-catch-instanceof.md`)은 `spec_impact: none` — SSRF 가드 소비자 4곳(`http-request.handler.ts`, `http-redirect.ts`, `database-query.handler.ts`, `database-connection-tester.ts`)의 `catch` 를 `instanceof SsrfBlockedError` 로 좁혀 "판정"과 "다른 오류"를 가르는 순수 내부 리팩토링이다. 문서화된 wire 계약(에러 코드·envelope 형식)은 바뀌지 않는다고 선언되어 있으므로, 본 검토는 (a) 그 선언이 현재 spec 기술과 실제로 정합하는지, (b) 착수 대상 spec 영역 자체가 `spec/conventions/**` 를 이미 준수하고 있는지를 확인했다.

## 발견사항

- **[WARNING] 조립된 prompt 번들이 관련 정식 규약을 전부 컨텍스트 예산으로 탈락시킴**
  - target 위치: `_prompts/convention_compliance.md` 라인 2627~2696 (`egress-masking.md`·`error-codes.md`·`node-output.md`·`swagger.md`·`secret-store.md`·`spec-impl-evidence.md`·`node-cancellation.md`·`redis-keys.md`·`interaction-type-registry.md`·`rag-evaluation.md`·`user-guide-evidence.md`·`migrations.md` — 이 리뷰의 관점(1~4)에 직접 해당하는 규약 전부)와, 대상 문서 자신의 `_product-overview.md`(라인 2237~2245, PRD/요구사항 본문)까지 "컨텍스트 예산 초과로 생략됨"으로 절단됨
  - 위반 규약: 검토 관점 자체가 요구하는 입력 완전성 — 명시적 규약은 없으나, 이전에 동일 증상이 `feedback_consistency_spec_mode_budget.md` 로 기록된 재발 패턴
  - 상세: 번들은 `spec/conventions/cafe24-api-catalog/**` · `spec/conventions/makeshop-api-catalog/**` 산하 leaf 파일 250여 개(자동 생성된 필드 단위 API 레퍼런스 — `spec-impl-evidence.md` R-7 에 의해 애초에 frontmatter 검증 대상에서도 제외되는 파일들)를 온전히 실었고, 그 결과 이번 리뷰의 실질 판단 근거가 되어야 할 `node-output.md`(5필드 invariant·에러 envelope)·`error-codes.md`(명명 규율)·`egress-masking.md`(SSRF 가드와 무관함을 명시)·`spec-impl-evidence.md`(`code:` frontmatter 의무)는 전부 잘려나갔다. 이 순서로 조립되면 **점검 관점 1~5 중 어느 것도 실제 규약 원문 없이 판정**하게 되어 구조적으로 false-negative("위반 없음")를 낼 위험이 있다
  - 제안: 이번 실행에서는 `Read` 로 해당 규약 원본을 저장소에서 직접 읽어 보완했으나(아래 발견사항은 그 결과), 번들 조립 로직이 대상 영역과 무관한 대용량 생성 카탈로그보다 `spec/conventions/*.md`(flat, 비-카탈로그) 를 우선 배정하도록 예산 배분 순서를 조정할 것을 권고. 하드 블로킹 사안은 아니므로 WARNING

- **[WARNING] `1-http-request.md` 의 `code:` 증거가 이번 plan 이 직접 수정할 파일을 누락**
  - target 위치: `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` (번들 라인 185~190) 및 §4 실행 로직 step 8~9 (라인 279~280, 리다이렉트 5홉 수동 follow + 매 홉 SSRF 재검증 서술)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로"
  - 상세: frontmatter 는 `http-request.handler.ts` / `http-request.schema.ts` / `http-safety.ts` / `sanitize-response-headers.util.ts` 만 열거하고, §4 step 9 가 서술하는 "3xx 응답 시 최대 5홉 수동 follow + 매 홉 SSRF 재검증"을 실제로 구현하는 `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` 는 목록에 없다. 이 파일은 `plan/in-progress/ssrf-catch-instanceof.md` 가 이번에 직접 수정 대상으로 지목한 파일이기도 하다(`outboundBlockReason`). `spec-code-paths.test.ts` 게이트는 기존 4개 항목만으로 이미 ≥1 매치를 통과하므로 빌드는 깨지지 않지만, spec 이 서술한 동작(redirect-follow SSRF 재검증)과 그 동작을 구현하는 파일 사이의 증거 사슬이 비어 있다
  - 제안: `code:` 에 `http-redirect.ts` 를 추가하는 것이 정확하나, `spec/` 쓰기는 `developer` 권한 밖이다(§자기-반증형 소정정 요건에도 해당 안 됨 — 예고 문장의 정정이 아니라 증거 목록 누락이므로). 이번 plan 은 `spec_impact: none` 을 유지해도 무방하나(동작 계약 자체는 안 바뀜), 후속 `project-planner` 턴에서 이 누락을 채워 넣을 것을 권고

- **[INFO] `0-common.md` 만 형제 문서들과 달리 명시적 `## Rationale` 섹션이 없음**
  - target 위치: `spec/4-nodes/4-integration/0-common.md` 전체 (§1~§7)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성(Overview/본문/Rationale) 권장" · `project-planner/SKILL.md` §Spec 문서 구조(3섹션 **권장**)
  - 상세: 같은 폴더의 `1-http-request.md`(§8 Rationale)·`2-database-query.md`(## Rationale)·`3-send-email.md`(§8 Rationale)·`4-cafe24.md`(§9 Rationale)·`5-makeshop.md`(§9 Rationale) 는 모두 별도 Rationale 섹션을 갖지만 `0-common.md` 는 결정 배경을 `> D4 결정`·`> **downscope 근거**` 같은 인라인 callout 으로만 흩어 놓는다. "권장" 규정이라 CRITICAL/WARNING 은 아니며, 5개 파일 서술 스타일의 국소 일관성 문제
  - 제안: 특별한 조치 불요. 이번 plan 범위(카탈로그 아님, 순수 catch 분류 리팩토링) 와 무관하므로 별도 후속 없이 참고만

## 요약

`spec/4-nodes/4-integration/` 의 실체 규약 준수 상태는 양호하다 — 에러 코드는 전부 `UPPER_SNAKE_CASE` + 도메인 prefix(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`/`MAKESHOP_INVALID_SHOP_UID`)를 따르고, D4 라우팅 결정("SSRF 차단·Integration resolve 실패는 throw 가 아니라 `port:'error'`")은 `node-output.md` Principle 3.2·§3.1 D4 콜아웃과 정확히 일치하며, 5필드 invariant·`config`/`output` 직교성·`meta.durationMs` 통일 인용도 `node-output.md` 원문과 부합한다. 검토 대상 plan(`ssrf-catch-instanceof`)이 다루는 내부 catch 분류 리팩토링은 이 계약을 바꾸지 않으므로 `spec_impact: none` 선언과 실제 spec 서술 사이에 모순이 없다. 다만 이번 검토를 준비한 prompt 번들 자체가 관련 규약 원문(node-output/error-codes/spec-impl-evidence 등)과 대상의 `_product-overview.md` 를 컨텍스트 예산으로 통째로 떨어뜨렸고, 이는 저장소가 직접 규약 파일을 열어 보완하지 않았다면 이번 게이트가 맹목적으로 "위반 없음"을 통과시켰을 구조적 위험이다. 또한 `1-http-request.md` 의 `code:` 증거 목록이 이번 plan 이 수정할 `http-redirect.ts` 를 누락하고 있어 완전성 갭이 있다.

## 위험도

LOW
