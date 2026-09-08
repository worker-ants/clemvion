# 정식 규약 준수 검토 — spec/5-system (impl-done, diff-base=origin/main)

검토 대상: 16개 파일 / 1041줄 diff (`spec/5-system/` 자체 델타는 0 — 코드 전용 PR, 전제 정상).
diff 는 다음을 포함: `http-exception.filter.ts` 유니크 위반 판정 통합, `integration-oauth.service.ts` 의
`pgErrorConstraint` 도입, `workflow-versions.service.ts` 타입 개명(`WorkflowVersionDetail` →
`WorkflowVersionDetailProjection`), `workspaces.service.ts` `listMembers` 의 DB-level `select` 투영
전환, 신규 repo-guard(`endpoint-path-conflict-wrap-guard`/`.spec.ts`/fixture), `tsconfig.build.json`
exclude 추가, frontend `workflows.ts` 미러 타입 주석 갱신.

## 발견사항

- **[WARNING] review 인용에 bare `hh_mm_ss` 재도입**
  - target 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 상단
    JSDoc — diff 상 `+ * (\`review/consistency/2026/09/06/13_39_25\` W3 · \`16_29_00\` W5).` 줄
  - 위반 규약: `spec/conventions/review-citations.md` §2 (인용 형태 표) — "bare 시각(`23_02_51`)"
    은 명시적으로 **금지**이며 허용 형태는 "전체 경로"(권장) 또는 "날짜 + 시각"(허용)뿐이다.
  - 상세: 이 줄은 이번 diff 가 **새로 추가**한 것이다(구 버전은 `13_39_25` W3 단일 인용만 있었다).
    추가된 두 번째 인용 `16_29_00` W5 는 날짜 없이 시각만 있어 §2 표의 "bare 시각" 형태와 정확히
    일치한다 — 앞 인용과 같은 문맥이라 사람은 2026-09-06 임을 추론할 수 있지만, §2 의 근거(§1 의
    "경로 인용은 git 이력으로 해소되지만 bare 는 어디로도 해소되지 않는다")를 그대로 적용하면
    이 값도 날짜 없이는 해소 불가능한 문자열이다. 다만 **같은 패턴이 이미 저장소 전역에
    광범위하게 퍼져 있다**(`websocket-events.types.spec.ts:404`, `use-widget-eager-start.test.ts:3390`,
    `use-session-generations.ts:106`, `spec-links.test.ts:53` 등 최소 4곳 이상) — 즉 이 diff 가
    새 위반 유형을 발명한 것이 아니라 기존에 사실상 용인되던 관례를 한 곳 더 늘린 것이다.
  - 제안: (a) target 을 `16_29_00` → `2026-09-06 16_29_00` 형태로 고쳐 §2 "허용" 형태로 맞추거나,
    (b) 이 축약("앞 인용과 같은 날짜를 공유하는 후속 bare 시각 나열")이 사실상 팀 관행으로 굳어진
    것이라면 `review-citations.md` §2 에 그 형태를 명시적으로 추가해 규약과 실제 관행의 간극을
    없앤다. §4("기존 bare 인용은 소급 정리 대상 아님")는 **기존** 인용에 대한 유예이지 신규 추가에
    대한 면제가 아니므로, 이 라인 자체는 정정 대상으로 본다.

## 그 외 확인했으나 위반 없음으로 판정한 항목 (근거 기록)

- **에러 코드/봉투 형식**: `webhook-trigger.e2e-spec.ts` 신규 케이스(B4)가 단언하는
  `error.code='RESOURCE_CONFLICT'` + `error.details={field:'endpoint_path',
  code:'TRIGGER_ENDPOINT_PATH_CONFLICT'}` 는 `spec/5-system/3-error-handling.md §1.10`(트리거
  endpointPath 충돌 세부 코드)과 정확히 일치한다. 신규 코드 신설이 아니라 기존 계약을 검증하는
  e2e 추가이므로 `error-codes.md` §1(UPPER_SNAKE_CASE)·§2(rename 정책)에 저촉되지 않는다.
- **`WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명**: 이 타입은 컨트롤러가 아니라
  서비스 내부 반환 타입이며, 실제 Swagger 응답은 별도 `dto/responses/workflow-version-response.dto.ts`
  의 `WorkflowVersionDto`/`WorkflowVersionListItemDto` 가 맡는다(`workflow-versions.controller.ts`
  확인). 따라서 `swagger.md` §1(DTO 패턴)·API 표면 명명 규약 대상이 아니며, 순수 내부 리네이밍은
  `error-codes.md` 류의 "client 계약" 안정성 정책과도 무관하다.
- **`workspaces.service.ts` `listMembers` 의 DB-level `select` 투영**: `select: { ..., user: { id:
  true, email: true, name: true } }` 는 `1-data-model.md §2.1.1` 이 열거한 `User` 민감 7컬럼
  (`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·
  `emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)을 모두 배제하며, 같은 문서가 명시적으로
  기각한 "컬럼 단위 `select: false`" 패턴이 아니라 "쿼리 단위 투영"이라 그 기각 사유(내부 소비
  경로의 fail-silent화)에도 해당하지 않는다. `user-entity-exposure.spec.ts` 자신의 코멘트가 이미
  이 형태를 "목록의 항목들이 지향할 형태"로 지목하고 있었고, 이번 변경이 그 방향을 실제로
  이행한 것이므로 규약 위반이 아니라 규약이 권장하는 방향으로의 이행이다.
- **신규 repo-guard 파일 명명** (`endpoint-path-conflict-wrap-guard.ts` + `.spec.ts` + fixture):
  "파서(순수 로직) / 소비 spec 분리" 패턴은 `user-entity-exposure-guard.ts`·
  `swagger-dto-contract-guard.ts` 자매 가드와 동일 규율이며, 별도 명명 규약 문서가 이 패턴을
  강제하진 않지만 기존 관행과 완전히 일치해 명명 규약 관점의 이질감이 없다.
- **`review-citations.md` §2 형태(전체 경로+지적 번호)**: 이번 diff 가 인용한 나머지 6곳
  (`review/code/2026/09/08/12_53_08` INFO#3·4·6·7, `review/code/2026/09/06/11_55_36` W1,
  `review/code/2026/09/06/19_31_04` INFO#2, `review/consistency/2026/09/06/16_29_00` W5 단독 등재분)은
  전부 "전체 경로 + 지적 번호"로 §2 "권장" 형태를 그대로 따른다. 위 첫 항목만 예외다.
- **DTO JSDoc 리뷰 인용 분리** (`review-citations.md` §3 / `swagger.md` §3): 이번 diff 가 리뷰
  인용을 넣은 자리(`workflow-versions.service.ts` 내부 타입 JSDoc, `*.spec.ts` 테스트 코멘트,
  `endpoint-path-conflict-wrap.spec.ts`/`-guard.ts` 코멘트)는 전부 `dto/responses/**` 바깥이거나
  OpenAPI 로 나가지 않는 타입/테스트라 §3 의 "응답 DTO JSDoc 에 서사 금지" 규칙 대상이 아니다.
- **`tsconfig.build.json` exclude 추가** (`**/__test-utils__/**`): 명명·출력 포맷 규약이 아니라
  빌드 설정이며, 대응하는 diff(`production-build-devdep.spec.ts`)의 주석이 "경로가 아니라 디렉터리
  이름으로 막는다"는 기존 두 선례(`repo-guards`, `shared/testing`)와 동일한 방식을 따른다고 밝히고
  있어 형식 일관성 위반이 없다.

## 요약

diff 는 대부분 백엔드 내부 구현(에러 판정 헬퍼 통합, DB 투영 전환, repo-guard 신설, 테스트 보강)이며
API 표면·에러 코드·DTO 명명 등 client 에 노출되는 축은 건드리지 않는다. 새로 추가되거나 변경된
식별자·타입명은 기존 관례(가드 파일 분리 패턴, 투영 타입 접미사, `select` 기반 민감 컬럼 배제)와
일치하고, 유일하게 트리거 endpointPath 충돌 e2e 케이스가 참조하는 에러 봉투 형식도 기존 spec
§1.10 계약과 정확히 일치한다. 유일한 이탈은 리뷰 인용 형식(`review-citations.md` §2)에서 bare
`hh_mm_ss` 를 재도입한 한 줄이며, 이는 이 저장소에 이미 광범위하게 퍼진 관행이라 신규 위반 유형은
아니지만 규약 문서와 실제 관행 사이의 간극을 계속 넓힌다.

## 위험도

LOW
