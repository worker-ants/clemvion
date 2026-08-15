STATUS=success

===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 리뷰 — durationMs 종결 이벤트 배관 + 직전 리뷰 CRITICAL/WARNING 후속 조치

## 검토 방법

프롬프트에서 diff 가 생략된 파일(3, 4, 13, 16, 18, 19, 21, 22, 25, 26번)은 `git diff origin/main --stat`
로 변경 라인 규모를 확인하고, 필요한 파일은 `git diff origin/main -- <path>` / `git show <commit> --stat`
로 직접 열어 전문을 대조했다. 로컬 브랜치(`claude/eia-terminal-duration-outputs`)가
`origin/main` 대비 8개 커밋 앞서 있음을 `git log origin/main..HEAD` 로 확인해, 리뷰 대상
diff 전체(51개 파일)가 이 8개 커밋에 정확히 대응함을 검증했다.

## 발견사항

- **[INFO]** durationMs 작업과 무관한 선존 spec 오탈자 1줄 정정이 같은 브랜치에 포함
  - 위치: `spec/5-system/14-external-interaction-api.md` (Re-run API 경로 세그먼트,
    `/api/v1/executions/:id/re-run` → `/api/executions/:id/re-run`)
  - 상세: `git show cdaa4291d`로 확인한 결과 별도 독립 커밋(`fix(spec): 인접 두 줄이
    자기모순 — Re-run 경로에 금지된 /v1/ 세그먼트`)으로 완전히 격리돼 있다. 커밋 메시지가
    명시하듯, 이 오류는 `--impl-prep` consistency-check(`08_45_50`)가 **BLOCK: YES
    (CRITICAL 1)** 로 잡은 항목이고, CLAUDE.md 규약("developer 는 구현 착수 직전
    consistency-check --impl-prep 의무. Critical 발견 시 차단")에 따라 착수 전 반드시
    해소해야 했던 게이트다. 절차상 정당한 포함이며, 이번 라운드(직전 09_58_24 scope 리뷰가
    이미 같은 결론)에서도 재확인됐다.
  - 제안: 조치 불필요. 이미 별도 커밋으로 격리돼 있어 cherry-pick 분리도 쉽다.

- **[INFO]** 테스트 mock 확장 범위(`.setParameter`/`.returning()` 추가)가 실제 durationMs 로
  건드린 프로덕션 SQL 호출 지점(5곳)보다 넓게 퍼져 있음 — 실측 결과 정당함을 재확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    `mockExecutionRepo.createQueryBuilder` 파일 전역 기본 mock(약 289~297줄, `beforeEach`)
    및 이를 오버라이드하지 않는 다수 테스트
  - 상세: `git diff origin/main --stat`으로 프로덕션 diff 는 `execution-engine.service.ts`
    에 `.setParameter(` 5곳·`.returning(['id','duration_ms'])` 5곳만 추가했음을 확인했다.
    테스트 mock 추가는 이보다 훨씬 넓은 범위(19,000줄대 spec 파일 곳곳, NF-OB-07
    BusinessMetrics 테스트 등)에 걸쳐 있는데, `Read`로 직접 연 결과 이는 파일 전역
    `beforeEach` 기본 mock 객체(공유 fixture)에 메서드를 추가한 것이라 그 기본 mock을
    경유하는 모든 테스트에 자동 반영된 것뿐이다. 개별 테스트를 하나씩 손으로 확장한 것이
    아니라 공유 fixture 1곳을 넓힌 결과이므로 "의도 이상의 변경"으로 보기 어렵다.
  - 제안: 조치 불필요. 직전 라운드(`09_58_24` scope 리뷰)가 같은 항목을 이미 실측·판정했고
    이번 대조에서도 동일 결론이다.

## 그 외 확인한 항목 (문제 없음)

- **커밋 경계**: `git log origin/main..HEAD`로 확인한 8개 커받(`cdaa4291d` ~ `2e4c5c6e9`)
  전부가 "종결 이벤트 3종에 `durationMs` 를 채운다"는 단일 의도(및 그 후속 리뷰
  CRITICAL/WARNING 조치)에 직접 연결된다. 별개 기능·리팩터링이 섞인 커밋은 없었다.
- **핵심 소스 변경**: `execution-engine.service.ts`(388줄)·`retry-turn.service.ts`는
  16개 종결 emit 경로 각각에 `durationMs` 를 채우는 작업으로, `if (lastNodeId)` 블록 밖으로
  `finishedAt`/`durationMs` 계산을 옮긴 부분도 "노드 0개 그래프에서 durationMs 가
  비어 emit 되는" 결함을 막기 위해 직접 필요한 수정이며 무관한 리팩토링이 아니다.
  raw UPDATE 5경로에 `.setParameter`/`.returning()` 을 추가한 것도 동일 목적.
- **신규 헬퍼**(`terminal-duration.ts`/`.spec.ts`): 16개 emit 경로에 흩어질 뻔한 계산·null
  처리·SQL 폴백을 한 곳에 모으는 목적이 명확하고, 직전 PR(`error` 필드 통일, #1170)이
  같은 패턴을 쓴 선례가 plan에 근거로 남아 있다. 신규 export(`toFiniteNumber`,
  `TERMINAL_DURATION_MS_SQL`, `TERMINAL_FINISHED_AT_PARAM`)는 전부 durationMs 배관에
  실제로 쓰이며 미사용 공개 API 를 만들지 않았다.
- **타입 변경**(`chat-channel/types.ts`): `durationMs?: number` → `durationMs?: number | null`
  3곳 전부 동일 패턴. 주석이 다소 길지만(§6/consumer 계약/29개 fixture 근거) 이 저장소의
  기존 rationale-comment 관행과 일치하고, 실질적으로는 durationMs 타입 변경 하나만 반복
  설명한 것이라 "불필요한 주석"으로 보지 않는다.
- **imports**: `execution-engine.service.ts`/`retry-turn.service.ts`/`terminal-duration.spec.ts`
  전부 신규 헬퍼 함수를 쓰기 위한 추가 import 뿐이며, 삭제·정리성 import 변경은 없었다
  (`grep`으로 diff 내 `^+import`/`^-import` 라인 전수 확인).
- **설정 파일**: `package.json`/`tsconfig*`/CI workflow 등 어떤 설정 파일도 diff 에 없다
  (`*.json`/`*.yml`/`*.config.*` 패턴 확인 결과 `review/**/_retry_state.json` 세 개뿐이며,
  이는 리뷰 세션의 재시도 상태 산출물로 코드/설정과 무관).
- **spec 동반 변경**: `spec/3-workflow-editor/3-execution.md`·`spec/5-system/
  14-external-interaction-api.md`·`spec/conventions/chat-channel-adapter.md` 3개 spec
  문서 수정은 전부 plan(`eia-terminal-payload.md` "재판정 ④ / spec 동반 변경 (전수)" 표)이
  사전에 명시한 항목과 1:1 대응하며, durationMs 를 "미구현(Planned)"에서 "구현됨"으로
  갱신하는 것 이상의 서술 변경은 없었다. `spec_impact` frontmatter 에 추가된
  `spec/data-flow/3-execution.md` 는 실제 diff 가 없는데, plan 본문이 "이 시퀀스 다이어그램은
  이미 durationMs 를 cancelled 에도 쓰는 것처럼 표기돼 있었고 이 PR 구현이 그걸 사후적으로
  참으로 만든다"고 밝히고 있어 근거가 있다(수정 불필요를 스스로 설명).
- **review/·plan/ 산출물**: `review/code/2026/08/15/09_58_24/**`(직전 ai-review 라운드),
  `review/consistency/2026/08/15/{08_45_50,09_00_27,09_58_31}/**`(impl-prep/impl-done
  consistency 라운드), `plan/in-progress/*.md` 갱신은 전부 CLAUDE.md 가 명시한 강제
  워크플로(구현 착수 전 `--impl-prep`, 완료 후 `/ai-review` + resolution, `--impl-done`)의
  기대된 산출물이며 scope 이탈이 아니다.

## 요약

이번 diff(로컬 8개 커밋, `origin/main` 대비 51개 파일)는 "종결 이벤트(`completed`/
`failed`/`cancelled`) 3종 payload 에 `durationMs` 를 싣는다"는 단일 의도와, 그 구현에 대한
직전 ai-review(`09_58_24`, CRITICAL 1 / WARNING 11) 및 consistency(`09_58_31`) 라운드가
지적한 CRITICAL(int4 오버플로 클램프 부재)·WARNING(헬퍼 우회 6곳, JSON 구문 오류, 타입
nullable, CHANGELOG 고지 등)에 대한 후속 조치로 정확히 구성돼 있다. 무관한 파일·설정 변경,
사용하지 않는 import, 불필요한 리팩토링, 요청받지 않은 기능 확장은 발견되지 않았다. 유일하게
"다른 의도"로 보일 수 있는 변경(spec 의 `/v1/` 오탈자 정정 1줄)은 별도 커밋으로 격리돼 있고
프로젝트가 강제하는 impl-prep 게이트의 CRITICAL 차단을 해소하기 위한 절차상 필수 변경임을
커밋 메시지·게이트 산출물로 확인했다. 테스트 mock 이 실제 SQL 변경 지점보다 넓게 퍼진 것도
공유 `beforeEach` 기본 mock 구조에서 비롯된 필연적 파급으로, 직전 라운드의 실측 결론과
이번 재확인이 일치한다.

## 위험도

LOW
