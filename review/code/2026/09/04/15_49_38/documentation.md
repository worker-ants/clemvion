# 문서화(Documentation) 리뷰 — `ExecutionStatusDto` 5필드 `required` false→true (83→15→5 축소 최종본)

## 검증 방법

프롬프트 diff(46개 파일 표기, 실제 `git diff origin/main...HEAD --stat` = 45개 파일)는 두 겹으로
구성된다 — (a) 실질 코드+문서 변경 5개(`CHANGELOG.md`, `execution-status-response.dto.ts`,
`execution-status-response.dto.spec.ts`, `plan/in-progress/spec-draft-nullable-notation-followups.md`,
`plan/complete/spec-draft-scope-and-anchor-drift.md`), (b) 이전 두 코드 리뷰 라운드(`14_54_36`,
`15_22_06`)와 두 consistency-check 라운드(`15_16_28`, `15_42_35`)의 산출물 신규 커밋(40개 파일).
`execution-response.dto.ts`(`ExecutionDto` 10필드)는 net diff 에 없다 — flip 후 revert 로 순
변경분이 0임을 `git log`(`499675277`→`441761478`→`5a2acd664`)와 현재 파일 상태(`ApiPropertyOptional`
+ `?:` 그대로) 양쪽으로 직접 확인했다.

프롬프트가 컨텍스트 예산으로 자른 부분(`plan/complete/*` 전체 diff, 여러 `.md` 전체 파일 컨텍스트)은
워킹트리를 `Read`/`grep`/`git log`/`git show` 로 직접 열어 대조했다. 저장소에는 아무것도 쓰지
않았다 — `git status --short` 결과 이 리뷰 세션 자신의 출력 디렉터리(`review/code/.../15_49_38/`)
외 잔여물 없음.

## 발견사항

- **[INFO]** `CHANGELOG.md` 신규 항목이 `§5.4` 를 4회 언급하면서 같은 파일의 인접 항목들과 달리
  마크다운 링크로 걸지 않는다 — 내부 링크 스타일 비일관
  - 위치: `CHANGELOG.md:5,19,42`(신규 "`ExecutionStatusDto` 5곳..." 항목, plain text `§5.4`)
  - 상세: 바로 아래 있는 기존 항목("OpenAPI 선언과 TS 타입이 어긋난 9곳...", `CHANGELOG.md:83,103,125`
    부근, 이번 diff 가 건드리지 않은 이전 커밋)은 동일 절을 인용할 때
    `[API 규약 §5.4](spec/5-system/2-api-convention.md)` 형태의 클릭 가능한 링크를 쓴다. 신규
    항목은 같은 절을 4번 인용하면서(`3`·`5`·`19`·`42`행) 전부 plain text `§5.4`로만 쓴다. 실질
    누락은 아니고(관련 링크는 CHANGELOG 파일 안 다른 곳에 이미 존재), 같은 파일 내 스타일
    일관성 관점의 사소한 지적이다.
  - 제안: 선택 사항. 다음에 이 CHANGELOG 파일을 편집할 때 `[§5.4](spec/5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략)`
    형태로 통일해도 좋다. 이번 PR 을 막을 사안은 아니다.

## 검증한 항목 (문제 없음 확인 — 직접 재현)

1. **CHANGELOG 수치·서사 정확성(최종 상태 기준)** — 현재 `CHANGELOG.md` 최상단 항목은 "5곳"으로
   correctly 표기돼 있다(이전 리뷰 라운드가 대상으로 삼았던 "83곳"·"15곳" 버전은 모두 이후 커밋에서
   in-place 로 대체됐다 — `git log`상 `499675277`(83)→`441761478`(15)→`5a2acd664`(5) 순으로
   같은 `## Unreleased` 블록을 계속 고쳐 썼다). "2단계: 검증자 없는 응답 DTO 78곳" = 패스스루
   68 + `ExecutionDto` 10 산식도 plan 문서·CHANGELOG 양쪽에서 일치.
2. **JSDoc/독스트링 정확성** — `execution-status-response.dto.ts` 의 `durationMs`/`currentNode`/
   `context`/`result`/`error` 5필드 JSDoc 을 직접 열람. "종결 전에는 null (키 present — API 규약
   §5.4)", "completed 가 아니면 null (키 present)" 등 전부 `required:true`+`nullable:true` 로
   바뀐 실제 데코레이터와 정확히 부합한다. "선택적"/"생략 가능" 류의 모순되는 잔존 표현 없음.
3. **상대경로 링크 유효성 재검증** — `execution-status-response.dto.ts:145` 의
   `[Swagger 규약 §1-4](../../../../../../../spec/conventions/swagger.md)` 를 `os.path.normpath`
   로 직접 계산해 `spec/conventions/swagger.md` 로 해석됨과 실제 파일 존재를 확인했다.
4. **인용된 정본 예제와 코드 일치** — `spec/conventions/swagger.md` §1-4(94~109행)의
   `ExecutionStatusDto.context` 정본 코드 스니펫을 직접 열람. `context: ButtonsContextDto |
   NodeOutputContextDto | null;`(optional `?` 없음) — 이번 diff 로 반영된 실제 코드와 문자 그대로
   일치한다.
5. **plan 체크리스트 동기화** — `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
   "§5.4 drift 배치 — 1단계"가 `[x]`로, "2단계: 검증자가 없는 응답 DTO 78곳"이 `[ ]`로 정확히
   반영돼 있고, `## 종결 조건` 표(4행)도 실제 열린 항목과 일치한다.
6. **plan 라이프사이클 이동** — `spec-draft-scope-and-anchor-drift.md` 가
   `plan/in-progress/` → `plan/complete/` 로 이동했고, frontmatter `spec_impact` 가 리스트(Gate C
   형식)로 채워져 있음을 확인했다.
7. **plan 이 인용하는 사실 근거의 정확성** — "`AlertRuleDto.threshold: number` vs 엔티티
   `AlertRule.threshold: string`(numeric 컬럼)" 주장을 직접 grep 으로 재확인 — 정확히 일치
   (`alert-rule-response.dto.ts:22` = `number`, `alert-rule.entity.ts:35` = `string`).
   "`notifications` 4곳이 부분 `select:` 를 쓴다" 주장도 `notifications.service.ts` 에서 4개
   매치로 확인했다.
8. **테스트 인라인 주석 품질** — `execution-status-response.dto.spec.ts` 신설 `NULL_PRESENT_FIELDS`
   상수·`required` 단언 앞 JSDoc 이 "왜 이 테스트가 존재하는가"(회귀 재현·리뷰 인용)를 명시한다.
   "(리뷰 1R W2)"/"(리뷰 2R W3)" 형태의 라운드 인용은 이 저장소 전역에서 이미 널리 쓰이는 확립된
   관례임을 `codebase/backend/src` 전수 grep(20건 이상, `nullable-type-lie-cast-guard.ts` 등)으로
   확인했다 — 신규 패턴이 아니다.
9. **README/설정 문서·예제 코드** — 새 환경변수·설정·엔드포인트 없음, README 대상 아님. Swagger
   `example` 값(`example: 4242` 등)은 그대로이고 `required` 플래그만 바뀌어 예제 갱신 불요.
10. **커밋된 review 산출물 40건** — `review/code/**`·`review/consistency/**` 저장 위치는
    `CLAUDE.md` 정식 관례와 일치하고(`.gitignore` 는 `review/**/_prompts/` 만 제외), 이전 라운드
    산출물이 이후 커밋으로 대체된 CHANGELOG 상태를 대상으로 한 지적(예: "83곳 버전이 import 정리
    12파일을 언급 안 함")은 그 시점 기준으로는 정확했고 현재 상태에는 적용되지 않는다는 이전
    라운드 자체 판정(`15_22_06/documentation.md`)이 맞다 — 재검증 결과 동일 결론.

## 요약

이번 changeset 의 실질 코드 변경은 `ExecutionStatusDto` 5필드(`durationMs`/`currentNode`/
`context`/`result`/`error`)의 `@ApiPropertyOptional`→`@ApiProperty({nullable:true})` 전환과
대응 테스트·plan·CHANGELOG 갱신뿐이며, `ExecutionDto` 10필드는 두 차례 자기 반증(83→15→5) 끝에
완전히 원복돼 순 diff 에 남지 않았다. CHANGELOG·JSDoc·plan 체크리스트·swagger.md 정본 예제·
relative link 를 전부 현재 워킹트리 상태와 직접 대조 재현한 결과, 어느 하나도 코드와 어긋나지
않았고 오래된 주석이나 미갱신 문서도 발견되지 않았다. 유일한 지적은 CHANGELOG 신규 항목이 같은
파일의 인접 항목과 달리 `§5.4` 를 링크가 아닌 plain text 로 4회 인용한다는 스타일 비일관
INFO 뿐이며, 실질적 정보 누락은 아니다. 문서화 관점에서 조치가 필요한 CRITICAL/WARNING 은 없다.

## 위험도

NONE
