# 변경 범위(Scope) 검토 — guide-error-code-truth

## 검토 방법

프롬프트에 실린 28개 파일 전부(unified diff + 잘린 파일은 전체 컨텍스트 표기 확인)를 검토했고,
잘려서 표시되지 않은 파일(`CHANGELOG.md`, 다수 `.mdx`, `.ts`)은 diff 만으로 스코프 판단이
충분해 별도 `Read` 는 하지 않았다. 추가로 `grep` 으로 두 가지를 실측 검증했다:

- `TestConnectionResultDto`(파일 2, integrations 모듈) 가 실제로 `/api/integrations/:id/test`
  (`integrations.controller.ts`)에서 쓰이는 **살아있는 sibling DTO** 인지 — 맞다.
- `latencyMs` 문자열이 저장소 어디에도 이번 제거 뒤 dangling 참조로 남지 않는지
  (`swagger-dto-contract.spec.ts` 의 allowlist 포함) — 잔여 0건, allowlist 는 다른 필드용이라
  갱신 불요.

저장소 파일은 건드리지 않았다(`grep`/`Read` 만 사용, mutation 없음). `git status --short` 로
작업 트리 청결 확인 불필요(읽기 전용 검증만 수행).

## 배경 — 이 배치가 다루는 두 갈래

`plan/in-progress/guide-error-code-truth.md` 는 트래커 항목 하나("유저 가이드가 존재하지 않는
에러 코드 5종을 이름으로 적는다")를 닫는 작업인데, 착수 중 실측이 그 항목을 두 갈래로
쪼갰다: (1) 순수 문서 오류(§B·§C — 은퇴/지어낸 코드명 치환), (2) **런타임 결함**(§A —
`LlmService.testConnection` 이 `error` 필드를 내는데 DTO·프런트엔드는 `message` 를 읽어
실패 사유가 화면에 전혀 도달하지 않음). `CHANGELOG.md` 도 이 둘을 별도 `## Unreleased`
섹션으로 나눠 적고 있어, 작성자 스스로 스코프가 두 성격으로 갈렸음을 인지·고지하고 있다.

## 발견사항

- **[INFO]** `TestConnectionResultDto`(파일 2, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`)의 `latencyMs` 제거는 이번 스토리의 1차 대상(가이드 에러 코드 진위·LLM `testConnection`)과 다른 도메인(Integrations 노드의 `/api/integrations/:id/test`)의 DTO 를 건드린다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:457-462`(diff 게이트 기준)
  - 상세: 실측으로 확인한 근거(같은 `latencyMs` 유령 필드가 생산자 0건으로 존재)는 타당하고, plan 체크리스트("DTO 에서 `latencyMs` 제거 — 두 자매 DTO + FE 타입")·CHANGELOG("`latencyMs` 제거 — 두 DTO 모두 생산자가 0건")에 명시적으로 disclosure 돼 있어 은닉된 drive-by 는 아니다. 다만 이 파일은 LLM/model-config 도메인이 아니라 **Integrations 도메인**이라, "가이드 에러 코드 진위" 라는 원 트래커 제목만 보면 범위 밖으로 보일 수 있다. 이 변경엔 별도 회귀 테스트가 diff 에 보이지 않는다(선언만 제거, 소비자 0건이므로 낮은 리스크지만 스코프 관점에서는 "같은 결함 클래스라 함께 고친" 것이지 "가이드 문서 진위" 자체는 아님을 명확히 해 둔다).
  - 제안: 현재 수준(plan·CHANGELOG 에 명시)이면 충분 — 별도 조치 불요. 다만 리뷰 로그에 "왜 Integrations 도메인 파일이 이 diff 에 있는가"를 찾는 다음 사람을 위해 이 INFO 를 남긴다.

- **[INFO]** 같은 세션이 별도의 in-progress 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 3건의 새 planner 백로그 항목(§1 카탈로그 누락·`testConnection` shape 미문서화·`user-guide-evidence.md §2.1` 관계표 누락)을 추가로 등재했다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (diff 게이트 3204-3230 부근, 새 항목 3개)
  - 상세: 이 등재는 `--impl-prep` consistency-check(WARNING #1·#2·#4·#5) 의 직접 산출물이고, `developer` 권한 밖(spec 쓰기)인 항목을 코드로 고치지 않고 planner 인계로만 남긴 것은 CLAUDE.md 역할 경계를 정확히 지킨 처신이다 — 스코프 침해가 아니라 스코프를 지키기 위한 부산물이다. 다만 이 세 항목의 실체가 코드 diff 안에는 없고 문서 등재뿐이므로, "이 PR 이 왜 이렇게 많은 파일을 건드리는가"를 훑을 때 이 3건이 실제 구현이 아니라 등재임을 구분해 둔다.
  - 제안: 조치 불요(정상 workflow).

## 검토한 항목 중 문제 없음으로 판단한 것

- 가이드 mdx 8개 파일(files 7-14)의 변경은 plan §B/§C/§A 3갈래에 1:1 대응하고, 체크리스트에
  없는 여분의 mdx 수정은 없다.
- 신규 가드(`guide-error-code-existence.test.ts` · `guide-error-code-scan.ts`)는 plan §D 가
  명시적으로 요구한 산출물이며, 판정 축을 넓히거나 좁힌 이력이 코드 주석에 실측과 함께
  전부 기록돼 있어 기능이 은근슬쩍 확장된 흔적이 없다(over-engineering 아님 — 세 축 모두
  "베이스라인 0" 을 만들기 위해 필요한 최소 구조).
- `llm-model-config.controller.spec.ts`/`llm.service.spec.ts` 의 import 변경(`import type` →
  실제 import, 신규 import 다수)은 전부 새로 추가된 테스트 블록에서 실제로 소비되며 미사용
  import 는 없다.
- `model-configs.ts`/`model-configs.test.ts` 변경은 `latencyMs` 제거 한 줄과 그에 대응하는
  픽스처 교체뿐으로, 다른 API 클라이언트 함수는 건드리지 않았다.
- consistency-check 산출물(files 21-28)은 CLAUDE.md 가 요구하는 `--impl-prep` 의무 절차의
  표준 부산물이며, `spec/` 본문은 이 diff 어디에서도 수정되지 않았다(review 전용 파일만
  추가) — 역할 경계(`developer` 는 `spec/` read-only) 준수.
- CHANGELOG.md·plan 파일에 포맷팅-only 변경, 무관한 주석 삭제/추가, 설정 파일 변경은
  발견되지 않았다.

## 요약

이 배치는 트래커 항목 하나에서 출발했지만 실측 과정에서 "문서 오류"와 "런타임 결함(응답
필드 3중 불일치)" 두 갈래로 스스로 갈라졌고, 저자는 이를 CHANGELOG 의 별도 섹션·plan 의
별도 하위 항목(§A vs §B/§C)·consistency-check(`--impl-prep`) 로 각각 고지·검증했다. 코드
diff 의 모든 파일이 plan 체크리스트의 특정 항목에 대응되며, 체크리스트에 없는 임의
리팩토링·기능 확장·포맷팅 변경은 발견되지 않았다. 유일한 스코프 관찰점은 sibling
Integrations DTO(`TestConnectionResultDto`)의 `latencyMs` 제거가 원 트래커 제목("가이드
에러 코드")보다 넓은 도메인(런타임 계약)까지 번진 것인데, 이는 은닉되지 않고 plan·
CHANGELOG 양쪽에 명시적으로 근거(생산자 0건 실측)와 함께 기록돼 있어 심각한 스코프
위반으로 보지 않는다.

## 위험도

LOW
