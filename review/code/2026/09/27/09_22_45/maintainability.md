# 유지보수성(Maintainability) 리뷰

대상: 응답 DTO 클래스 JSDoc 두 곳의 리뷰 인용을 `//` 로 옮기고 가드 동결 목록을 비우는 변경(`CHANGELOG.md`, `schedule-response.dto.ts`, `trigger-response.dto.ts`, `dto-jsdoc-citation-guard.ts`, `dto-jsdoc-citation.spec.ts`, plan 2건, `spec/conventions/review-citations.md`, `spec/conventions/swagger.md`). `review/consistency/**`·`review/code/**` 하위의 생성 리포트 파일(9~24번)은 프로세스 산출물이라 유지보수성 관점 분석 대상에서 제외했다.

## 발견사항

- **[INFO]** 두 자매 DTO 파일에 거의 동일한 설명 문장이 타입명만 바꿔 반복된다.
  - 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:10-11`, `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:13-14`
  - 상세: `// 자매 참조 타입(...)과 담는 필드가 다른 것은 의도다(아래 JSDoc) — review/consistency/2026/09/06/00_48_52 W2.` 문장이 참조 대상 타입명만 바꿔 두 파일에 그대로 복제됐다. 다만 이 파일 안에는 이미 같은 패턴(「왜 좁혔나」 서사 블록 등)이 두 파일에 대칭으로 존재하고, 두 DTO 자체가 의도적으로 거울상 구조(스케줄은 `name`만, 트리거는 `id`+`name`)이므로 이 저장소의 기존 관행과 일치한다.
  - 제안: 현재 각 1줄 규모라 추출할 실익은 없다. 다만 이런 거울상 주석이 앞으로 더 늘어나면(3곳 이상) 공통 서사를 규약 문서 쪽 앵커로 옮기고 양쪽에서 링크만 거는 것을 고려할 수 있다.

- **[INFO]** `EXPECTED_DTO_JSDOC_CITATIONS` 선언 바로 위 JSDoc이 38줄에 달해, 코드(빈 배열 리터럴 한 줄)보다 주석이 훨씬 무겁다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts:11-49`
  - 상세: 왜 이 가드가 필요한지, 세 번의 과거 위반 사례, 베이스라인이 0이 된 경위까지 프로시로 한 상수 선언에 응축돼 있다. 다만 이는 이 저장소가 `spec/conventions/review-citations.md`로 명시한 "내부 서사는 `//`/JSDoc에 남긴다"는 정책을 그대로 따른 것이고, 같은 파일의 `CITATION_PATTERNS`(가드 파일 쪽) 주석도 동일한 밀도를 이미 갖고 있어 새로 도입된 스타일 이탈이 아니다. 결함이 아니라 관찰 사항으로만 남긴다.

- **[INFO]** `spec/conventions/review-citations.md`에 새로 단 헤더 앵커(`#3--응답-dto-클래스-jsdoc-도-인용을-쓰지-않는다-2026-09-27`)를 표 안에서 직접 인용했다.
  - 위치: `spec/conventions/review-citations.md` §3 표 "응답 DTO 클래스" 행, `## Rationale` 신설 절 헤더
  - 상세: GitHub 스타일 슬러그 규칙(소문자화, `§`·em-dash·괄호 제거, 공백→하이픈)을 직접 계산해 대조해 보면 앵커 문자열이 실제 헤더와 정확히 일치한다(em-dash 앞뒤 공백이 겹쳐 `--`가 되는 부분까지 맞다). 깨진 링크는 아니다. 다만 날짜가 박힌 앵커(`-2026-09-27`)는 이 절이 다시 개정될 때 앵커 자체가 바뀔 수 있어, 향후 이 앵커를 참조하는 다른 문서가 생기면 stale link가 될 잠재 지점으로만 기록해 둔다.

이 외에 함수 길이·중첩·매직 넘버·순환 복잡도 관점에서 지적할 로직 변경은 없다 — 이번 diff는 프로덕션 로직을 건드리지 않고 (1) 두 클래스 JSDoc 끝의 리뷰 인용을 규약이 처방한 `//` 주석으로 옮기고, (2) 가드/테스트의 근거 주석을 필드/클래스로 정확히 갈라 바로잡고, (3) 테스트 상수 하나를 빈 배열로 되돌리고, (4) 짝 규약 문서 두 곳의 문장을 실측에 맞게 정정하는 것뿐이다. 네이밍(`EXPECTED_DTO_JSDOC_CITATIONS`, `findDtoJsDocCitations`, `ScheduleTriggerWorkflowRefDto`/`TriggerWorkflowRefDto`)과 기존 `//`-내부서사 / JSDoc-소비자용 분리 컨벤션도 일관되게 지켜졌다. plan 문서(`plan/in-progress/dto-class-jsdoc-citation.md`)의 뮤턴트 표에 3건(M1~M3)이 모두 KILLED로 실측돼 있어 테스트 유효성도 별도로 확인됐다.

## 요약

이번 변경은 로직이 아닌 주석/문서/테스트 상수 범위로 스코프가 매우 좁고, 저장소가 이미 확립한 "리뷰 인용은 `//`에, JSDoc은 공개 문서용"이라는 컨벤션을 정확히 적용했다. 발견된 사항은 모두 INFO 등급으로, 기존 관행과 일치하거나(거울상 DTO 주석 중복, 서사 중심의 무거운 JSDoc) 실측으로 반증되지 않은 잠재 관찰(날짜 박힌 앵커)에 그친다. 가독성·네이밍·일관성 모두 양호하며 유지보수성 관점에서 차단 사유는 없다.

## 위험도
NONE
