# 보안(Security) Review — `trigger-workflow-ref-canary` (2라운드)

## 스코프와 방법

이 라운드는 1라운드(`review/code/2026/09/10/14_34_18`) 지적 13건(코드 수정 12 + `--impl-done`
요구 1)을 반영한 결과가 **새 보안 결함을 만들지 않았는지**가 초점이다. 검증은 두 커밋
`f71aa584e`(1라운드 대상 코드)와 `c696ace07`(현재 HEAD, 수정 반영 후)의 `git diff` 를 직접
비교해 "무엇이 바뀌었는가"만 좁혀 보는 방식으로 했다 — 조립 프롬프트 대신 실제 소스 파일
(`trigger-workflow-ref.ts`, `.spec.ts`, `trigger-workflow-ref.e2e-spec.ts`)을 `Read` 로 열어
줄 번호를 대조했고, 참조된 프로덕션 유틸(`common/utils/uuid.ts` 의 `isUuidShaped`)도 직접
읽어 정규식이 바뀐 게 실제로 있는지 확인했다. 저장소에 어떤 파일도 쓰거나 고치지 않았다 —
읽기 전용 검증만으로 충분했고, `git status --short` 는 이 리뷰 세션 자신의 출력 디렉터리
외에 아무것도 보고하지 않는다.

**사전 존재 프로덕션 CRITICAL 2건은 이 diff 밖이다.** 1라운드가 이미 판정한 ① `chatChannel`
PATCH 가 bot-token single-path(R-CC-10)를 우회하는 문제, ② `ChatChannelCard` 저장이 항상
400 이 되는 문제는 트래커(`plan/complete/trigger-workflow-ref-canary.md` → 신규 CRITICAL 판정,
`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재돼 있고 이번 diff(테스트
파일 3개 + plan/review 문서)는 프로덕션 코드를 한 줄도 바꾸지 않는다. 재조사하지 않았다 — 아래
발견사항은 전부 **이번 라운드의 수정 자체**에 대한 것이다.

## 발견사항

- **[INFO]** case E docstring 신규 삽입 — 알려진 미수정 보안 정책 우회(R-CC-10)의 구체적 메커니즘이
  처음으로 `codebase/` 소스(테스트 파일)에 영구히 남는다
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:224-241` (case E 의 `⚠️` 경고
    블록, 13번째 수정으로 이번 라운드에 새로 추가됨)
  - 상세: 이 블록은 "`chatChannel` PATCH 가 `botToken` 을 필수로 받아 R-CC-10 single-path 를
    우회하고, grace 백업·전용 audit action·`chatChannelRotatedAt` 갱신을 모두 건너뛴다"는 사실을
    구체적 메커니즘까지 서술한다. 내용 자체는 새로운 정보가 아니다 — `plan/complete/trigger-workflow-ref-canary.md`
    와 1라운드 `api_contract.md`/`security.md`(`14_34_18`)에 이미 같은 상세가 있고, 이번 추가는
    `--impl-done`(`review/consistency/2026/09/10/15_23_41` rationale_continuity W1)이 "코드에
    아무 참조가 없으면 이 캐너리가 고쳐야 할 동작을 지키는 쪽으로 작동한다"는 근거로 요구한 것이라
    의도가 방어적이다. 다만 결과적으로 **미수정 취약점의 우회 경로 설명이 처음으로 `codebase/`
    (테스트) 파일에 커밋된다** — plan/review 문서는 성격상 "작업 기록"이지만 `codebase/` 는 빌드
    산출물과 더 가까운 위치라, 이 저장소의 접근 범위가 넓어지는 시나리오(외주 인력 온보딩, 저장소
    분리/공개 등)에서는 이 설명이 다른 문서보다 먼저 눈에 띌 수 있다. 이 저장소는 현재 비공개
    monorepo 이고 같은 정보가 이미 다른 committed 문서에도 있으므로 **한계적 위험(marginal risk)**
    은 낮다.
  - 제안: 이 PR 을 막을 사유는 아니다. 처방(PATCH 전용 `ChatChannelConfigDto`)이 들어오면 이
    docstring 도 함께 정리하도록 트래커 항목에 "코드 참조 정리"를 체크리스트 항목으로 남겨 두는
    정도면 충분하다.

- **[INFO]** 비밀 컬럼 3중 하드코딩 — 1라운드 WARNING 이 이번 라운드에서 "문서화 + 후속 등재"로만
  처분되고 구조적 결속은 여전히 없음(새 결함 아님, 상태 재확인)
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:66-83`
    (`TRIGGER_SECRET_COLUMNS` + 드리프트 경고 주석, 이번 라운드에 추가), 같은 목록의 세 번째
    독립 사본은 `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts:142-143`
  - 상세: 1라운드 `security.md` 의 WARNING("헬퍼·self-spec·프로덕션 3자리 독립 하드코딩")에 대해
    이번 라운드가 실제로 한 일은 (a) `TRIGGER_SECRET_COLUMNS` 주석에 "정본의 세 번째 독립
    사본"이라는 경고와 `CREATOR_PROJECTION` 선례를 추가하고, (b) repo-guard 로 세 목록 동일성을
    강제하는 처방을 백로그(`RESOLUTION.md` "코드 밖으로 이관 4건" #1)에 등재한 것뿐이다. 목록
    자체는 여전히 코드로 결속되지 않은 리터럴 3곳이다. `RESOLUTION.md` 에 이 유예가 명시적으로
    기록돼 있고(정본이 `export` 되지 않아 import 불가하다는 근거도 실측됨), 이번 라운드가 **새로
    악화시킨 것은 아니다** — 오히려 첫 라운드보다 위험 서술이 더 정확해졌다("한 칸 좁다"는 이전
    가설은 이미 기각됐고 이번엔 그 재확인만 반복). 그대로 재기록해 둔다.
  - 제안: 조치 불요(이번 diff 기준). repo-guard 후속 항목 진행 여부를 다음 라운드에서 추적할 것.

## 확인했으나 새로운 문제 없음 — 이번 라운드 수정의 보안 효과

- **`isUuidShaped` 로 정규식 교체** (`trigger-workflow-ref.ts:1`, `:126-128`): 기존 손으로 짠
  `UUID_PATTERN` 과 `common/utils/uuid.ts` 의 `UUID_SHAPE_PATTERN` 을 직접 대조했다 — 두 정규식
  문자열이 **완전히 동일**(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, `i`
  플래그)하다. 동작 변화 없음, ReDoS 위험 없음(중첩 정량자 없는 고정 길이 패턴). 순수 DRY.
- **`expectedWorkflowId` identity 검증 추가** (`trigger-workflow-ref.ts:94-96`, `:132-134`):
  `expect(ref.id).toBe(opts.expectedWorkflowId)` 는 엄격 동등 비교이고, e2e 4개 양성 케이스
  (B~E)가 전부 `workflowId` 를 넘기도록 갱신됐다(`trigger-workflow-ref.e2e-spec.ts:186-189,
  198-201, 211-214, 260-263`). "shape 만 맞는 엉뚱한 relation" 을 놓치던 실제 갭을 닫는 개선이며
  새 취약점을 만들지 않는다.
- **최상위 `dto === null` 가드 추가** (`trigger-workflow-ref.ts:104`): `toBeDefined()` 앞에
  `expect(dto).not.toBeNull()` 을 추가한 순서가 의미상 무관(둘 다 개별 단언이라 순서 상관없이
  `null` 이면 첫 단언에서 즉시 throw)하지만 결과적으로 부재 판정 우회 구멍을 닫는다. 회귀 없음.
- **self-spec 4건 추가**(비-문자열 `name`/`id`, 최상위 `null`, `expectedWorkflowId` 불일치,
  `trigger-workflow-ref.spec.ts:94-131`)와 **e2e 라벨/타임아웃 문서화**
  (`trigger-workflow-ref.e2e-spec.ts:59-74`)는 순수 테스트 강화·가독성 변경이며 인젝션·인증·
  암호화·에러 노출 등 다른 점검 관점에 영향을 주는 코드 경로 변경이 없다.
- 가짜 봇 토큰 리터럴(`'111:e2eWfRefBotToken'`)은 이번 라운드에서 값이 바뀌지 않았다 — 1라운드
  판정(기존 관례와 일치, 실제 시크릿 아님)이 그대로 유효하다.
- `secret_store` 고아 row에 대한 `afterAll` 문서화(`trigger-workflow-ref.e2e-spec.ts:145-158`)는
  주석 추가일 뿐 teardown 로직 자체는 변경되지 않았다 — 1라운드 판정(기존 파일과 동일 관례, 낮은
  실질 위험) 유지.

## 요약

이번 2라운드 diff(`f71aa584e`→`c696ace07`)는 1라운드가 지적한 13건 중 보안 관련 WARNING
("헬퍼·self-spec·프로덕션 3자리 하드코딩 시크릿 컬럼")을 문서화와 백로그 등재로 처분했고, 그
외 12건의 수정(`expectedWorkflowId` identity 고정, 최상위 `null` 가드, 정본 `isUuidShaped`
채택, self-spec 4건 보강, e2e 라벨/타임아웃 문서화)은 모두 테스트 강건성을 높이는 방향이며 새
인젝션·인증 우회·암호화 약화·정보 노출 벡터를 도입하지 않았다. `isUuidShaped` 로의 교체는
정규식이 기존과 완전히 동일함을 직접 대조로 확인했다. 유일하게 새로 주목할 점은 `--impl-done`
이 요구한 13번째 수정(case E docstring)이 이미 다른 문서에 존재하던 R-CC-10 우회 상세를 처음
`codebase/` 테스트 파일에 옮겨 적었다는 것인데, 의도가 방어적(계약 오독 방지)이고 같은 정보가
이미 커밋된 다른 문서에 있어 한계적 위험은 낮다. 프로덕션 사전 존재 CRITICAL 2건(chatChannel
PATCH bot-token 우회, `ChatChannelCard` 400)은 이 diff 범위 밖이며 트래커에 이미 등재돼 있어
재조사하지 않았다. 종합적으로 이번 라운드의 수정은 보안 관점에서 **순증(net positive)**이고
새로 만든 결함은 없다.

## 위험도

NONE — 이번 라운드 diff 자체가 만든 새 보안 결함 없음. INFO 두 건은 조치 불요이며 참고용으로만
기록한다.

STATUS: success
