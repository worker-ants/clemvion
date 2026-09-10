# 변경 범위(Scope) 리뷰 — `TriggerDto.workflow` 캐너리

## 검증 방법 요약

- `git diff --stat origin/main...HEAD` 로 전체 변경 파일 목록 확인
- `git diff --stat origin/main...HEAD -- 'codebase/**'` (+ 3개 신규 파일 제외 필터)로 `codebase/` 내
  다른 파일 변경 여부 확인
- `codebase/backend/src/modules/triggers/triggers.service.ts` 를 `origin/main` 과 diff — 뮤테이션
  잔존 여부 확인
- `codebase/backend` 패키지의 `npx prettier --check`(3.9.6, backend `package.json` 핀)로 3개
  신규 파일 포맷 재검증. 워크스페이스 루트에는 자체 `prettier` devDependency/바이너리가 없음을
  `package.json`/`node_modules/.bin` 로 확인
- `plan/in-progress/trigger-workflow-ref-canary.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
  전문 열람 — frontmatter `spec_impact`, 체크리스트, 신규 등재 항목 내용 대조
- `git status --short` 로 저장소 잔여 뮤테이션/미커밋 파일 확인
- `git show --stat f71aa584e` 로 실제 커밋에 포함된 파일 목록(12개) 확인

## 발견사항

없음 (CRITICAL/WARNING 없음). 아래는 참고용 INFO 두 건.

- **[INFO]** 신규 헬퍼 파일의 헤더 JSDoc 이 설계 근거·장래 명명 규칙·디렉터리 선정 이유까지
  포함해 상당히 길다(40줄).
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:1`~`40`
  - 상세: "의도 이상의 변경"이라기보다는 이 저장소의 기존 관례(Rationale 를 소스 근접 위치에
    남기는 방식, 자매 파일 `schedule-trigger-ref.ts` 도 유사 패턴 추정)를 따른 것으로 보이며,
    실제로 코드 동작에는 영향이 없다. 범위 위반으로 보지 않음.
  - 제안: 조치 불요. 다른 리뷰어(가독성/컨벤션 관점)가 판단할 사안.

- **[INFO]** 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 이번 PR 범위
  밖의 신규 항목 두 개가 열렸다 — ① `planner: 캐너리 착지 후속 3건`(§3 문장 정정·`code:` 등재·
  `PROJECT.md` 한 줄), ② `질문: chatChannel PATCH 가 bot token single-path 를 우회하나`.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (checklist, `TriggerDto.workflow`
    항목 직후 두 개의 신규 `- [ ]` 블록)
  - 상세: 둘 다 **코드 변경을 동반하지 않는 추적 항목**이고, plan 파일 자체는 developer 가 쓰기
    권한을 가진 영역(`plan/**`)이다. ①은 `--impl-prep` 세 checker 가 CRITICAL 로 막은 자기-반증형
    소정정 조건 1 불성립(그 문장은 planner 가 썼음)을 근거로 developer 가 직접 못 고치는 것을
    명시적으로 문서화한 것이고, ②는 구현 중 실측(400 에러 원인 조사)에서 우연히 발견한 잠재
    이슈를 "단정하지 않는다"고 명시하며 질문으로만 남겨 **캐너리 자체의 스코프는 넓히지 않았다**.
    즉 두 항목 모두 "이번 코드 변경"에 아무것도 추가하지 않고, 다음 턴이 놓치지 않도록 기록만
    남긴 것 — 이 저장소의 plan 위생 관례(다음 사람이 있지도 않은 작업을 쫓거나, 발견한 이슈를
    잃어버리는 것을 방지)에 부합한다.
  - 제안: 조치 불요.

## 점검 관점별 결과

1. **의도 이상의 변경**: 없음. `git diff --stat origin/main...HEAD -- 'codebase/**'` 에서 3개
   신규 파일을 제외한 나머지 매칭이 0건 — `codebase/` 안에서는 정확히 선언된 3개 신규 파일만
   변경됐다.
2. **불필요한 리팩토링**: 없음. 기존 파일(`triggers.service.ts` 포함) 어디에도 diff 가 없다.
3. **기능 확장(over-engineering)**: 없음. e2e 는 계획된 정확히 5개 `it()`(양성 4 + 생성 음성 1,
   생성 음성은 plain/chatChannel 두 서브경로를 한 테스트 안에서 각각 assert)만 포함하고, 헬퍼는
   plan 에 설계된 시그니처(`expectTriggerWorkflowRef(dto, { present })`)와 정확히 일치한다.
4. **무관한 수정**: 없음. `codebase/` 는 3개 신규 파일뿐이고, `spec/` 은 diff 에 전혀 등장하지
   않는다(`git diff --stat origin/main...HEAD` 전체 12개 변경 파일 중 `spec/` 경로 0건) — plan
   frontmatter 의 `spec_impact: none` 과 실제가 일치한다. plan 이 자기 서술대로 T-4(spec 문장
   정정)를 이 PR 에서 실제로 빼냈다는 것도 diff 로 확인됨.
5. **포맷팅 변경**: 없음. `codebase/backend` 패키지에서 `npx prettier --check` 로 3개 신규 파일이
   모두 backend 핀 버전(3.9.6)의 스타일을 만족함을 재확인했다. 워크스페이스 루트에는 자체
   prettier 디바인더리/의존성이 없어(`package.json` grep 0건) 루트에서 실행했을 경우 발생할 수
   있는 버전 drift(과거 3.8.4 vs 3.9.6 사례, `feedback_workspace_tool_version_drift.md`) 위험을
   원천 차단한 방식과 일치한다. 신규 3개 파일 외 다른 파일에 diff 가 없으므로 drive-by 리포맷도
   없다.
6. **주석 변경**: 신규 파일 내부 주석/JSDoc 뿐이며 기존 파일 주석 변경 없음. 내용 자체는 위 INFO
   참고.
7. **임포트 변경**: 기존 파일 임포트 변경 없음. 신규 e2e 파일의 임포트(`@jest/globals`, `pg`,
   `node:crypto`, `supertest`, `expectTriggerWorkflowRef`, `./helpers/db`, `./helpers/auth`)는
   전부 파일 내에서 실사용됨을 확인(미사용 임포트 없음).
8. **설정 변경**: 없음. `package.json`·`tsconfig*`·`jest*.json`·`.eslintrc*`·`.prettierrc*` 등
   설정 파일 어디에도 diff 없음(`git diff --stat` 전체 목록에 미등장).

## 뮤테이션 테스트 잔존물 확인

- 계획서에 기록된 대로 `triggers.service.ts` 의 `chatChannel` 재조회 분기에서
  `relations: ['workflow']` 를 두 차례 제거해 뮤테이션 테스트를 수행했다는 서술이 plan 에 있다.
  `git diff origin/main...HEAD -- codebase/backend/src/modules/triggers/triggers.service.ts` 는
  **빈 결과**(diff 없음) — 해당 파일은 `origin/main` 과 바이트 단위로 동일하다. 커밋
  `f71aa584e` 의 `git show --stat` 목록에도 이 파일이 없음을 재확인했다.
- `git status --short` 는 이 리뷰 세션이 쓰기 시작한 `review/code/2026/09/10/14_34_18/` 자기 자신의
  untracked 항목 외에는 아무것도 보고하지 않는다 — 다른 잔존 뮤테이션/백업 파일 없음.
- 결론: 뮤테이션 원복이 깨끗하게 완료됐고 잔존물 없음.

## 반대 방향 스코프(과소 구현) 검토

Plan `## 무엇을 하지 않나` 및 `## 후속으로 넘기는 것`에 명시된 defer 3건(기존 3개 e2e 파일 트리거
단언 통합·스케줄 헬퍼 일반화·chatChannel PATCH 의 다른 축) + spec 계열 defer 3건(§3 문장 정정·
`code:` frontmatter 등재·`PROJECT.md` 한 줄) 을 각각 검토했다:

- **기존 e2e 통합/헬퍼 일반화**: 이번 캐너리(`workflow` 존재/부재 고정)의 정합성에 필수가 아니다.
  plan 이 명시한 이유(두 헬퍼가 검증 깊이·계약이 달라 합치면 한쪽이 다른 쪽 형태로 끌려간다)는
  스코프를 좁게 유지하는 근거로 타당하며, 이번 변경의 완결성에 영향 없음.
- **chatChannel PATCH 의 다른 축(hasBotToken·inboundSigningRef)**: 이 캐너리의 대상(`workflow`
  참조 유무)과 무관한 축이라 defer 가 적절. 포함했다면 오히려 "기능 확장"에 해당했을 것.
  포함하지 않아도 `workflow` 캐너리 자체의 완결성(생성 시 없음 / 그 외 있음, 5개 응답 경로 전수)에
  구멍이 없다 — plan 의 "경로 전수" 표가 트리거 shape 를 내보내는 4개 엔드포인트(5개 응답 형태)를
  전부 짚고 있다.
- **spec 계열 defer 3건**: `--impl-prep` 게이트가 자기-반증형 소정정 조건 1(그 문장을 developer
  자신이 쓴 것이 아니라 planner 가 씀)을 CRITICAL 로 3개 checker 독립적으로 판정한 데 따른 구조적
  제약이다. developer 권한(`spec/` read-only, 좁은 예외만 허용)상 이 PR 에서 실행 불가능한 것이지
  "누락"이 아니다. 캐너리 코드 자체의 동작·완결성과도 무관(문서 정정일 뿐 회귀 방어력에 영향 없음).

결론: defer 된 항목 중 이번 변경(캐너리)의 정합성·완결성에 실제로 필요한 것은 없다. 과소 구현으로
볼 사안 없음.

## 요약

`git diff --stat origin/main...HEAD -- 'codebase/**'` 를 신규 3개 파일로 필터링한 결과 매칭 0건 —
`codebase/` 안에서는 선언된 3개 신규 파일 외 어떤 프로덕션 코드·설정·포맷팅도 변경되지 않았다.
`spec/` 은 전체 diff 12개 파일 중 0건으로, plan 이 스스로 "T-4(spec 문장 정정)를 이 PR 에서
빼낸다"고 서술한 것과 실제 diff 가 정확히 일치하며 `spec_impact: none` 도 사실과 부합한다.
뮤테이션 테스트 대상이었던 `triggers.service.ts` 는 `origin/main` 과 바이트 단위로 동일함을
diff 없음으로 확인했고 저장소에 다른 잔존물도 없다. Prettier 포맷은 backend 패키지 핀 버전에서
재검증 통과했고, 루트 워크스페이스에는 애초에 별도 prettier 설치가 없어 drive-by 리포맷 위험도
구조적으로 배제된다. 반대 방향(과소 구현) 관점에서도 defer 된 6개 항목 전부 이번 변경의 완결성과
무관하거나 developer 권한 밖(spec 정정)이라 결함이 아니다. 트래커에 새로 열린 2개 항목은 코드
변경을 동반하지 않는 순수 기록이며 캐너리 자체 스코프를 넓히지 않았다. 종합적으로 이 변경은
서술된 의도(캐너리 3개 신규 파일)에 정확히 부합하며 범위 이탈 징후가 없다.

## 위험도

NONE
