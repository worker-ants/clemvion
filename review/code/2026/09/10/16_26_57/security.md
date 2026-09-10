# Security Review — `trigger-workflow-ref-canary` (3라운드)

## 검증 방법 요약

- `git log --oneline` 로 3라운드 대상 커밋(`64334e708`, "2라운드 5건 반영")을 확인.
- `git diff c696ace07 64334e708 -- codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts
  codebase/backend/src/shared/testing/trigger-workflow-ref.ts
  codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 로 이번 라운드가 실제로 건드린 부분만
  추출 — 프롬프트 번들의 diff 는 origin/main 기준 누적분이라 이 커밋 간 diff 로 범위를 좁혔다.
- `git diff --stat c696ace07 64334e708` 전체 18개 파일 목록 확인 — `plan/**`·`review/**` 나머지는
  round-2 산출물의 자연스러운 기록(설명문·이전 리뷰 아티팩트)이며 코드 3파일 외 보안 관련 신규
  서술은 없음을 확인.
- 신규 fixture `{ id: { toString: () => WF_ID } }` 가 실제 응답 파싱 경로(`JSON.parse`)에서
  발생 가능한 shape 인지 검토.
- `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 전문 열람(266줄) — R-CC-10 관련
  case E docstring 의 경로 정정(`/triggers/...` → `/api/triggers/...`) 확인.
- `git status --short` 로 저장소 잔여 상태 확인 — 아래 관측 사항 참조.

## 이번 라운드 변경 요약 (커밋 `c696ace07` → `64334e708`)

1. `trigger-workflow-ref.ts` — 함수 JSDoc 중간에 있던 "왜 `test/helpers/` 가 아니라 여기인가"
   블록을 파일 최상단 `//` 파일-스코프 주석으로 이동(내용은 문자 그대로 동일, 위치만 이동).
2. `trigger-workflow-ref.spec.ts` — 10개 케이스를 헬퍼의 가드 실행 순서대로 재배열 + 그 규약을
   describe docstring 에 명시.
3. `trigger-workflow-ref.spec.ts` — `id` 비-문자열 판별 fixture 를 `id: 42` → `{ id: { toString:
   () => WF_ID } }` 로 교체(이전 fixture 가 vacuous 였다는 반증을 docstring 에 실측 표와 함께 기록).
4. `trigger-workflow-ref.e2e-spec.ts` — R-CC-10 우회 경고 블록의 엔드포인트 경로 `/triggers/:id/...`
   → `/api/triggers/:id/...` 로 정정.
5. `trigger-workflow-ref.e2e-spec.ts` / `trigger-workflow-ref.ts` — `assertMatchesContract`
   불충분 사유·`expectedWorkflowId` 필요 사유의 중복 서술을 헬퍼 쪽을 SoT 로 축약.

## 발견사항

없음 (CRITICAL/WARNING/INFO 신규 코드 결함 없음). 아래는 참고용 관측 한 건.

- **[INFO]** 저장소에 이 리뷰 세션과 무관해 보이는 **미커밋 변경**이 관측됐다 — 다른 결함으로
  판정하지 않음.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` (working tree, HEAD 대비
    미커밋). `git diff` 상 `expect(typeof ref.id).toBe('string');` 한 줄이 127번째 줄 자리에서
    빠져 있다(커밋된 버전에는 그대로 있음).
  - 상세: mtime 이 리뷰 시작 시각(`16:26:57`)보다 약 3분 뒤(`16:29:40`)로, 이 병렬 fan-out 의 다른
    reviewer(가능성이 높은 쪽은 `testing`)가 이번 라운드 fixture(`{ id: { toString: () => WF_ID
    } }`)의 판별력을 뮤테이션으로 재검증하는 중일 가능성이 높다 — plan 문서(`trigger-workflow-ref-canary.md`)에
    이미 같은 라인 제거로 "12/12 GREEN 유지 → RED 1건 → 원복 12/12 GREEN" 을 측정한 이력이 있다.
    **내가 만든 뮤테이션이 아니며, 지시에 따라 직접 되돌리지 않았다.** 커밋된 소스(HEAD)에는 해당
    단언이 정상적으로 남아 있으므로 이 리뷰의 판정에는 영향이 없다.
  - 제안: 오케스트레이터가 이 세션 종료 전 `git status --short` 로 잔여 뮤테이션이 원복됐는지
    최종 확인할 것. 위 §검증용 뮤테이션 규약 §N 항목(트래커에 이미 등재)이 지적하는 것과 같은
    형태의 노출이다.

## 점검 관점별 결과

1. **인젝션 취약점**: 해당 없음. 이번 라운드는 테스트 코드 재배치·fixture 교체·docstring 정리뿐이며
   신규 쿼리·명령·경로 조합 없음. `{ id: { toString: () => WF_ID } }` fixture 는 jest in-process
   단언에만 쓰이고, 응답 파싱은 `JSON.parse` 를 거치므로 실제 API 응답이 이런 shape(커스텀
   `toString` 을 가진 객체)를 만들어낼 경로가 없다 — 이 fixture 가 실제 인젝션·타입 혼동 공격면을
   여는 것이 아니라, 단언 자신의 판별력을 검증하는 순수 테스트 도구다.
2. **하드코딩된 시크릿**: 신규 하드코딩 없음. `botToken: '111:e2eWfRefBotToken'` 값은 이번 라운드
   diff 밖(기존 e2e 파일에 이미 있던 값)이고 e2e 전용 가짜 provider 토큰이다. `WF_ID` 상수도 고정
   테스트 UUID 로 실제 자격증명이 아니다.
3. **인증/인가**: 변경 없음. 이번 라운드는 인증/인가 경로를 건드리지 않는다.
4. **입력 검증**: 헬퍼(`expectTriggerWorkflowRef`)의 `id` 타입 판별 fixture 교체는 **테스트 자신의
   판별력**을 강화하는 변경이지 프로덕션 입력 검증 로직 변경이 아니다. `isUuidShaped` 자체는 이번
   라운드에서 수정되지 않았다.
5. **OWASP Top 10**: 해당 사항 없음.
6. **암호화**: 변경 없음.
7. **에러 처리**: 변경 없음. `TRIGGER_SECRET_COLUMNS` 관련 실패 메시지 서술(비밀 컬럼명을 실패
   메시지에 남긴다)은 이번 라운드에서 위치만 이동했고 내용·판단은 2라운드에서 이미 검토됨(재지적
   불요 — 처방이 트래커에 등재됨).
8. **의존성 보안**: 변경 없음.

## 사전 존재 프로덕션 CRITICAL 2건에 대해

지시에 따라 재조사하지 않았다. `chatChannel PATCH 가 bot-token single-path(R-CC-10) 우회` ·
`ChatChannelCard 편집-저장 400` 두 건은 이 diff 밖의 사전 존재 결함으로 `plan/in-progress/
spec-draft-nullable-notation-followups.md` 에 등재돼 있음을 확인만 했다. 이번 라운드가 건드린
R-CC-10 경로 문자열 정정(`/triggers/...` → `/api/triggers/...`)은 **경고 docstring 의 정확성
개선**일 뿐 그 결함 자체의 상태를 바꾸지 않는다.

## 요약

이번 3라운드 diff(`c696ace07` → `64334e708`)는 2라운드에서 지적된 5건(파일-스코프 주석 재배치,
self-spec 케이스 재배열, `id` 판별 fixture 교체, R-CC-10 경로 오탈자 정정, 계약 검증자/identity
근거 중복 축약)을 정확히 반영한 순수 테스트 인프라·문서 리팩터링이다. 신규 시크릿 하드코딩, 인젝션
표면, 인증/인가 변경, 에러 메시지 유출 등 보안 관련 신규 결함은 발견되지 않았다. 신규 fixture 는
실제 응답 파싱 경로에서 재현 불가능한 shape 를 이용한 순수 테스트 판별 장치이며 보안상 우려가
없다. 리뷰 도중 이 세션과 무관해 보이는 저장소 미커밋 변경(다른 reviewer 의 진행 중 뮤테이션으로
추정)을 관측했으며, 수정하지 않고 위에 명시했다 — 판정 자체에는 영향이 없다.

## 위험도

NONE

STATUS: success
