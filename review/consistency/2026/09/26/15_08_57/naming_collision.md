# 신규 식별자 충돌 검토 — forbidden-helper-sentences (--impl-prep)

## 검토 대상

`plan/in-progress/forbidden-helper-sentences.md` (spec_impact: none, `spec/conventions/swagger.md` §5-4 는 이미
implemented 상태 규약이며 변경 없음). 이 plan 이 실제로 새로 도입하는 식별자는 다음 하나뿐이다:

- `common/swagger/forbidden-descriptions.ts` 에 추가될 함수 `forbiddenWithService(guard: string, service: string): string`
  — `${guard} 또는 ${service}` 형태로 가드 문장과 서비스 문장을 잇는다.

나머지 변경(13개 호출부 치환)은 기존 상수(`FORBIDDEN_NOT_A_MEMBER`)·함수(`forbiddenForRole`)를 그대로 쓰고, 기존
모듈 상수(`FORBIDDEN_MEMBER_OR_ORG_ADMIN` · `FORBIDDEN_EDITOR_OR_ORG_ADMIN` · `FORBIDDEN_MEMBER_OR_ADMIN` ·
`FORBIDDEN_OWNER_OR_PERSONAL` · `FORBIDDEN_EDITOR_OR_NOT_OWNER`)의 **값(문자열 조립 방식)만** 바꾸는 것이라 새
식별자를 만들지 않는다.

## 발견사항

- **[INFO]** `forbiddenWithService` 신규 식별자는 저장소 전역에서 grep 0건
  - target 신규 식별자: `forbiddenWithService(guard, service)` (`codebase/backend/src/common/swagger/forbidden-descriptions.ts` 신설 예정)
  - 기존 사용처: 없음 — `grep -rn "forbiddenWithService" codebase/ spec/ plan/` 결과 `plan/in-progress/forbidden-helper-sentences.md` 자기 자신 2곳만 매치, 코드베이스 0건
  - 상세: 같은 파일의 기존 export `FORBIDDEN_NOT_A_MEMBER`(상수) · `forbiddenForRole`(함수)와 이름이 겹치지 않고, `*WithService` 접미 패턴도 저장소에 선례가 없어(grep 0건) 새로 만드는 접미사다. camelCase 동사형 명명은 `forbiddenForRole` 과 같은 계열(`forbidden<수식어>`)이라 자매 함수로 자연스럽게 읽힌다.
  - 제안: 충돌 없음 — 그대로 진행 가능.

- **[INFO]** `FORBIDDEN_` 접두 상수가 이미 두 의미 영역에 존재 — target 이 만드는 충돌은 아님
  - target 신규 식별자: 해당 없음 (target 은 이 영역에 새 식별자를 추가하지 않음)
  - 기존 사용처: `codebase/backend/src/modules/mcp/mcp-client.service.ts:198` 의 `const FORBIDDEN_HEADER_NAMES` (아웃바운드 요청에서 금지하는 HTTP 헤더 이름 집합, module-private, export 없음) vs `codebase/backend/src/common/swagger/forbidden-descriptions.ts:19` 의 `FORBIDDEN_NOT_A_MEMBER` 및 각 controller 의 `FORBIDDEN_*` 403 설명 상수(403 Forbidden 응답 문장)
  - 상세: 두 계열 모두 `FORBIDDEN_` 접두를 쓰지만 의미가 다르다(하나는 "거부해야 할 헤더 이름 목록", 하나는 "403 응답 설명 문장"). 다만 `mcp-client.service.ts` 쪽은 module-private `const` 라 export 충돌·import 충돌은 발생하지 않고, target 이 이 이름을 새로 만들거나 export 범위를 넓히지도 않는다 — target 범위 밖의 기존 코드 상태이며 target 이 유발한 충돌이 아니다.
  - 제안: target 착수와 무관하게 조치 불필요. 향후 `FORBIDDEN_` 접두로 새 export 를 추가할 때만 `grep -rn "FORBIDDEN_" codebase/backend/src` 로 재확인 권장.

## 요약

target(`forbidden-helper-sentences` plan)이 실제로 도입하는 새 식별자는 `forbiddenWithService(guard, service)` 함수
하나뿐이며, 저장소 전체에서 grep 0건으로 기존 사용처와 충돌하지 않는다. 나머지 13개 편집 자리는 이미 존재하는
`FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole` · 각 모듈의 `FORBIDDEN_*` 상수를 재사용하거나 그 값만 바꾸는 것이라
신규 식별자를 만들지 않는다. 저장소에 이미 있는 `FORBIDDEN_HEADER_NAMES`(MCP 아웃바운드 헤더 차단 목록)는 같은
접두를 쓰지만 의미 영역이 다르고 module-private 이라 실질 충돌이 없으며, target 이 만든 것도 아니다. 요구사항 ID·
엔티티/DTO 명·API endpoint·이벤트명·환경변수·spec 파일 경로 축에서는 target 이 새로 도입하는 식별자가 없다
(spec_impact: none, 코드 전용 정합화).

## 위험도

NONE
