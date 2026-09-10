# 보안(Security) Review — round 4

## 스코프 확인

`git diff HEAD~1 -- codebase/` 로 실측한 이번 라운드의 `codebase/` 델타는 아래 2파일, **총 37
insertions / 16 deletions, 전부 주석·docstring·라벨**이다. 실행 로직(단언 대상·API 호출·값 비교)은
한 글자도 바뀌지 않았다.

- `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` — 헤더 docstring 의 가드
  번호를 10개 → 11개로 정정하고 각 항목에 `①`~`⑪` 번호를 붙임, ⑤(`workflow` not-null)가 독립
  판별 불가능한 예외임을 설명하는 문단 추가, 인라인 `// ── 가드 N ──` 라벨 재번호(5→6, 6→7, 7→8,
  8→9, 9→10, 10→11).
- `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` — 파일 스코프 주석의 "고아 JSDoc
  세 번" → "네 번" 정정(자기 참조적 카운트 수정) + 정정 이력을 설명하는 한 문장 추가.

`TRIGGER_SECRET_COLUMNS`, `WORKFLOW_REF_KEYS`, `expectTriggerWorkflowRef` 함수 본문, import 문 —
전부 이번 커밋에서 미변경. 신규/변경 실행 코드가 없으므로 인젝션·인증/인가·암호화·에러 처리·의존성
축은 검토할 표면이 없다.

## 발견사항

없음.

### 점검한 항목 (요청된 초점)

1. **⑤ 예외 절이 적은 실패 메시지 형태(`keys [] ≠ ['id','name']`)가 노출인지** — 해당 문자열은
   `TriggerWorkflowRefDto` 의 필드명 `id`/`name` 을 인용한다. 이 DTO 는 헤더 주석 자신이 "이보다
   많아도 적어도 실패다" 라고 적듯 **API 응답에 이미 공개적으로 실리는 필드셋**이고(비밀 컬럼은
   `TRIGGER_SECRET_COLUMNS`로 별도 목록화되어 이 필드셋과 겹치지 않음), assert 실패 메시지 형태에
   대한 서술은 테스트 코드 자체의 동작을 설명하는 코멘트일 뿐 자격증명·토큰·내부 인프라 경로 등
   민감정보가 아니다. 이 문서화가 공격자에게 주는 신규 정보는 없다 — 노출 대상 스키마는 이미
   `TriggerWorkflowRefDto` 계약(및 이 파일의 `WORKFLOW_REF_KEYS` 상수)으로 공개돼 있다. **문제
   아님.**
2. **사전 존재 프로덕션 CRITICAL 2건 및 case E docstring 의 R-CC-10 경고** — 지시대로 재조사하지
   않았다. 이번 diff 는 `test/trigger-workflow-ref.e2e-spec.ts` 를 건드리지 않으며(변경 파일
   목록에 없음), 그 항목들은 2·3라운드에서 이미 등재·기결 처리됐다.

추가로 확인한 것: 두 파일 어디에도 신규 하드코딩 시크릿·자격증명·엔드포인트 URL·평문 전송 로직이
없고, 정규식/셸/SQL 조합이 도입되지 않았으며, 비밀 컬럼 목록(`TRIGGER_SECRET_COLUMNS`)의 값·순서
자체는 이번 커밋에서 변경되지 않았다(3중 사본 드리프트 리스크는 이전 라운드에서 이미 트래커에
등재된 기결 사안).

## 요약

이번 라운드의 `codebase/` 델타는 두 테스트 헬퍼 파일의 주석·docstring·인라인 라벨 정정뿐이며
실행 가능한 코드 변경이 전무하다. 요청된 초점인 ⑤ 예외 절의 실패 메시지 서술도 이미 공개된
DTO 필드셋(`id`, `name`)을 인용할 뿐이라 추가 노출로 볼 수 없다. 신규 보안 결함 없음.

## 위험도

NONE
