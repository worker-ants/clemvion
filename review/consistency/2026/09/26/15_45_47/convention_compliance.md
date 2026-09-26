# 정식 규약 준수 검토 — forbidden-helper-sentences (--impl-done)

## 검토 범위
- 대상 diff: `codebase/backend/src/common/swagger/forbidden-descriptions.ts`(+spec) ·
  `auth.controller.ts` · `executions.controller.ts` · `integrations.controller.ts` ·
  `workflow-test-datasets.controller.ts` · `workspaces.controller.ts` (7 files / 262 lines)
- spec 델타: 0 (plan `spec_impact: none` — 이 PR 은 `spec/conventions/swagger.md` §5-4 규약을
  코드에 맞추는 것이 목적이라 spec 변경이 없는 것이 정상)
- 대조한 정식 규약: `spec/conventions/swagger.md` §5-4 및 Rationale "§5-4 403 설명의 거부 코드",
  `spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드", `spec/5-system/13-replay-rerun.md`
  RR-PL-06, `spec/conventions/error-codes.md` §1(참고용 — 코드 자체는 이 PR 신설 아님)

## 발견사항

없음. 아래는 확인한 근거다.

- **명명 규약**: `forbiddenForRole`(camelCase 함수) 옆에 추가된 `forbiddenWithService(guard, service)` 는
  같은 명명 패턴(동사+대상)을 따른다. `FORBIDDEN_NOT_A_MEMBER`(SCREAMING_SNAKE 상수)와 충돌 없음.
  barrel(`common/swagger/index.ts`)의 `export * from './forbidden-descriptions'` 로 자동 노출돼
  별도 export 등재 누락 없음. 테스트 파일도 `.spec.ts` 로 동일 디렉토리의 `api-wrapped.spec.ts` 와
  같은 명명 패턴.
- **출력 포맷 규약 (§5-4)**: 대상 13곳(손으로 쓴 가드 문장 3 + 테스트 훅 2 + 헬퍼·서비스 이음 8)
  전부 확인 — 문장이 `FORBIDDEN_NOT_A_MEMBER` / `forbiddenForRole(role)` 로 시작하고, 서비스 문장은
  `forbiddenWithService` 한 곳에서 `" 또는 "` 로 이어진다. §5-4 예시 문구
  ("워크스페이스 멤버가 아님(`NOT_A_MEMBER`) 또는 Editor 이상 권한 필요(`EDITOR_REQUIRED`)")와
  실제 산출 문자열이 토큰 단위로 일치한다(`forbidden-descriptions.spec.ts` 신규 케이스로 회귀 고정).
  저장소 가드 `forbidden-response-codes`(`description.includes(code)` 서브스트링 판정)는 구두점을
  보지 않으므로 `, 또는` → ` 또는 ` 치환이 가드 판정에 영향을 주지 않음을 소스로 확인.
- **API 문서 규약**: `@ApiForbiddenResponse({ description: ... })` 데코레이터 사용 패턴 자체는
  건드리지 않고 `description` 값 생성 방식만 헬퍼로 통일 — §5-4 가 요구하는 "공용 헬퍼로 만들고
  서비스가 내는 403 은 그 뒤에 덧붙인다"를 그대로 구현. `@ApiExcludeEndpoint()` 테스트 훅 2곳도
  OpenAPI 비노출임에도 같은 헬퍼로 맞춰(plan에 "같은 형태의 결함" 으로 명시) 규약의 정신을 확장 적용.
- **금지 항목**: §5-4 가 금지하는 "가드 코드 없이 손으로 쓴 문구"(예: 종전 `owner 이상 권한 필요`,
  `대상 워크스페이스의 멤버가 아님(${NOT_A_MEMBER.code})` 인라인 보간)가 diff 전 구간에서 제거됨.
  `grep -rn ", 또는"` 로 잔존 확인 — 남은 인스턴스는 전부 401(로그인 실패 등) 설명이나 무관 주석이라
  §5-4 대상(403 가드 거부) 범위 밖.
- **문서 구조 규약**: spec 변경이 없어 Overview/본문/Rationale 3섹션·`0-`prefix·`_product-overview.md`
  규칙이 적용될 대상 자체가 없음. plan frontmatter `spec_impact: none` 은 bare 값으로 올바른 형식.

## 참고 (경계선상이나 위반은 아님 — INFO)

- **[INFO] 이음 구두점(` 또는 `) 결정의 근거 위치**
  - target 위치: `codebase/backend/src/common/swagger/forbidden-descriptions.ts` `forbiddenWithService` JSDoc
  - 관련 규약: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
  - 상세: `, 또는` → ` 또는 ` 통일이라는 설계 결정의 근거가 `spec/conventions/swagger.md` 의
    Rationale 이 아니라 코드 JSDoc 에만 있다. 다만 이 결정은 §5-4 규약이 이미 요구하는 "헬퍼로 만들고
    서비스 문장은 그 뒤에 덧붙인다"의 **구현 세부(문자 하나)** 이지 신규 규약이 아니며, plan 의
    "검토 경고 처리" 표에서 `--impl-prep` INFO2 로 이미 지적·처분됐다(의도적으로 JSDoc 배치 — "헬퍼를
    쓰는 사람이 읽는 자리"). spec 파일이 바뀌지 않았으므로 문서 구조 규약 위반은 아니고, §5-4 자체의
    문구를 갱신해야 할 만큼 실질적인 새 결정도 아니라고 판단해 CRITICAL/WARNING 으로 올리지 않음.
  - 제안: 그대로 두어도 무방. 추후 §5-4 를 개정할 일이 생기면 이 JSDoc 근거를 spec Rationale 로
    승격하는 것을 고려.

## 요약
이번 diff 는 `spec/conventions/swagger.md` §5-4(및 그 Rationale)가 이미 선언한 "403 설명은 공용
헬퍼로 만들고 서비스 문장은 그 뒤에 덧붙인다"는 규칙을, 지금까지 어긋나 있던 13개 자리(손으로 쓴 가드
문장 3·테스트 훅 2·`, 또는`으로 이어 붙이던 서비스 문장 8)에 맞춘 정정 PR 이다. 신설 헬퍼
`forbiddenWithService` 의 명명·위치·export 방식이 기존 `forbiddenForRole`/`FORBIDDEN_NOT_A_MEMBER`
패턴과 동형이고, 산출 문자열이 §5-4 예시 문구·저장소 가드(`forbidden-response-codes`)의 서브스트링
판정과 정확히 맞는다. spec 변경이 없는 코드 전용 PR 이라 문서 구조 규약이 적용될 지점도 없다. 정식
규약 위반은 발견되지 않았다.

## 위험도
NONE
