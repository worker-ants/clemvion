# 신규 식별자 충돌 검토 — forbidden-helper-sentences

## 검토 범위 확인

- `git diff origin/main...HEAD --stat -- spec/` → 0개 파일. 이 PR 은 spec 을 바꾸지 않는다(plan `spec_impact: none` 과 일치).
- 구현 diff 7개 파일: `common/swagger/forbidden-descriptions.ts`(+spec), `auth.controller.ts`, `executions.controller.ts`,
  `integrations.controller.ts`, `workflow-test-datasets.controller.ts`, `workspaces.controller.ts`.
- 이 diff 가 **새로 도입하는 식별자는 사실상 하나** — 함수 `forbiddenWithService(guard, service)`
  (`codebase/backend/src/common/swagger/forbidden-descriptions.ts`). 나머지는 기존 식별자(`forbiddenForRole`,
  `FORBIDDEN_NOT_A_MEMBER`, 각 컨트롤러의 `FORBIDDEN_*` 모듈 상수)를 그대로 재사용하며, 손으로 쓰던 문자열 결합을
  헬퍼 호출로 바꾼 것뿐이다. 새 엔티티·DTO·API endpoint·이벤트명·ENV var·spec 파일 경로는 이 diff 에 없다.

## 발견사항

- **[INFO]** `forbiddenWithService` 가 `spec/conventions/swagger.md` §5-4 본문에 아직 이름으로 등장하지 않는다
  - target 신규 식별자: `forbiddenWithService`(`codebase/backend/src/common/swagger/forbidden-descriptions.ts:47`)
  - 기존 사용처: `spec/conventions/swagger.md:511` — "문장은 공용 헬퍼 `FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole(role)`(`common/swagger`)로
    만들고, 서비스가 내는 403 은 그 뒤에 덧붙인다" 라고만 적혀 있어, "덧붙인다" 를 수행하는 세 번째 헬퍼의 이름은 spec 에 없다.
  - 상세: 충돌은 아니다 — 이름이 겹치거나 다른 의미로 쓰이는 게 아니라, spec 이 구현보다 한 단계 추상적으로만 서술해 새
    식별자를 아직 안 실었을 뿐이다. plan 의 "안 하는 것" 절도 이 gap 을 의도적으로 남긴다고 밝힌다(형식 가드 확장 비용을
    피하려고). JSDoc(`forbiddenWithService` 위)이 이음 규칙 근거를 이미 담고 있어 실질적 정보 손실은 없다.
  - 제안: 충돌이 아니므로 이 PR 에서 조치 불필요. 다음에 §5-4 를 편집할 사람을 위해, 그 문장에 `forbiddenWithService` 를
    세 번째 헬퍼로 언급해두면(문서 갱신, planner 소관) 코드-스펙 이름 미러가 더 촘촘해진다.

- **[INFO]** `FORBIDDEN_` 접두 상수·함수가 저장소에 이미 다수 존재하지만 의미가 각기 다르다 — 이 PR 이 그 군집을 늘렸다
  - target 신규 식별자: 없음(참고용) — 이 PR 이 건드리는 `FORBIDDEN_MEMBER_OR_ORG_ADMIN` · `FORBIDDEN_EDITOR_OR_ORG_ADMIN` ·
    `FORBIDDEN_MEMBER_OR_ADMIN`(`integrations.controller.ts`) · `FORBIDDEN_OWNER_OR_PERSONAL`(`workspaces.controller.ts`) ·
    `FORBIDDEN_EDITOR_OR_NOT_OWNER`(`workflow-test-datasets.controller.ts`) 는 모두 **기존 식별자**로, 이번 diff 는 값 계산
    방식(문자열 결합 → `forbiddenWithService` 호출)만 바꿨다.
  - 기존 사용처: `codebase/backend/src/modules/mcp/mcp-client.service.ts:198` 의 `FORBIDDEN_HEADER_NAMES`(HTTP 헤더 차단 목록,
    403 설명과 무관)는 이번 diff 밖의 기존 식별자다.
  - 상세: 이름 접두어(`FORBIDDEN_`)가 겹치는 두 군집(403 설명 상수 vs 차단 헤더 이름 집합)이 저장소에 공존하지만, 모듈이
    다르고(`swagger`/컨트롤러 vs `mcp-client.service`) `Set` vs `string` 타입이 달라 실제 이름 충돌(같은 스코프에서 동일
    식별자가 다른 의미)은 없다. 이번 PR 이 새로 만든 것도 아니다.
  - 제안: 조치 불필요 — 관찰만.

## 요약

이 PR 은 spec 영역을 바꾸지 않고(diff 0), 구현에서도 새 엔티티·API endpoint·이벤트명·ENV var·config key·spec 파일 경로를
전혀 추가하지 않는다. 새로 도입되는 식별자는 `common/swagger/forbidden-descriptions.ts` 의 함수 `forbiddenWithService`
하나뿐이며, 저장소 전체(`git grep`)를 확인한 결과 이전에 다른 의미로 쓰인 동일 이름이 없고, barrel export(`common/swagger/index.ts`)
경유로도 중복 export 가 없다. `plan/complete/forbidden-helper-sentences.md`(이 plan 의 예정된 이동 경로, 다른 plan 문서가
선행 인용)도 아직 존재하지 않아 파일 경로 충돌이 없다. 유일한 관찰 지점은 spec 문서(§5-4)가 세 번째 헬퍼 이름을 아직
명시하지 않는다는 것이지만, 이는 이름 충돌이 아니라 문서 상세도의 차이이며 plan 이 스스로 그 gap 을 "안 하는 것"으로
문서화했다.

## 위험도

NONE
