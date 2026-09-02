# 신규 식별자 충돌 검토 — `spec-draft-error-code-two-surfaces.md`

## 검토 개요

target 은 `spec/conventions/error-codes.md` §Overview "적용 범위" 문단 한 곳만 편집한다.
편집 내용은 **이미 존재하는** 두 식별자(`ErrorCode`, `EngineErrorCode`)를 대표 surface 로
나란히 서술하는 것이며, 새 요구사항 ID·새 엔티티/DTO·새 API endpoint·새 이벤트명·새
환경변수·새 spec 파일을 **하나도 도입하지 않는다**. 아래는 6개 점검 관점 각각의 실측 결과다.

## 관점별 실측

### 1. 요구사항 ID 충돌 — 해당 없음
target 은 번호 매김 요구사항을 신설하지 않는다. §Overview 서술 문단 편집뿐이다.

### 2. 엔티티/타입명 충돌 — 충돌 없음 (신규 식별자 아님)
`EngineErrorCode` 는 target 이 새로 만드는 이름이 아니라 **이미 코드에 존재하는** const 다.

```
codebase/backend/src/nodes/core/error-codes.ts:8    export const ErrorCode = {
codebase/backend/src/nodes/core/error-codes.ts:147  export const EngineErrorCode = {
codebase/backend/src/nodes/core/error-codes.ts:173  export type EngineErrorCodeValue = …
```

target 이 §Overview `:29` 에 적은 줄 번호(`ErrorCode` = 8, `EngineErrorCode` = 147)는 실측과
정확히 일치한다. 이 const 는 `plan/complete/exec-intake-followups.md` ARCH#5 (2026-08-31)에서
신설됐고, 이후 `review/code/2026/08/31/{20_27_29,20_43_35,21_23_45}/*.md` 5라운드 코드 리뷰와
`CHANGELOG.md:203` 에서 이미 같은 이름·같은 의미로 반복 참조돼 왔다. 저장소 전체에서
`EngineErrorCode` 라는 이름이 다른 의미로 쓰이는 자리는 없다 — target 은 **기존 실무를
규약 문서에 사후 등재**할 뿐이라 엔티티/타입명 충돌 여지가 없다.

### 3. API endpoint 충돌 — 해당 없음
target 은 endpoint 를 도입하지 않는다.

### 4. 이벤트/메시지명 충돌 — 해당 없음
target 은 webhook·queue·sse 이벤트를 도입하지 않는다.

### 5. 환경변수·설정키 충돌 — 해당 없음
target 은 ENV var·config key 를 도입하지 않는다.

### 6. 파일 경로 충돌 — 충돌 없음
- target plan 파일 `plan/in-progress/spec-draft-error-code-two-surfaces.md` — `plan/in-progress/`
  내 기존 파일과 겹치지 않음(`ls` 로 `*error-code*` 매치 2건 확인, 나머지 하나는 이 draft 의
  착수 근거 plan `spec-conventions-engine-error-code-surface.md` 로 서로 다른 파일).
- target 이 편집하는 spec 파일 `spec/conventions/error-codes.md` 는 **기존 파일 수정**이지
  신규 파일 생성이 아니다 — 경로 충돌 개념 자체가 적용되지 않는다.

## 부수 관찰 (충돌은 아니나 참고)

- **[INFO]** 병기 문구가 새로 쓰는 "노드 핸들러 층"/"엔진 층" 이라는 표현은 이 문서
  다른 곳에서 재사용되는 이름이 아니라 서술적 어구이며, 저장소 전체에서 다른 의미로
  쓰인 곳도 없다(grep 0건) — 식별자 충돌 대상이 아니다.
- **[INFO]** `spec/conventions/error-codes.md` 는 이미 "레이어"(loanword)라는 단어를
  다른 구분(§3 `:73` "목적 레이어가 다르다", `:109-114` "Code 노드 핸들러 내부 분류
  레이어" vs "엔진 레벨")에 쓰고 있다. target 은 같은 개념에 "층(layer)"(고유어)이라는
  다른 표기를 도입한다 — 식별자 충돌은 아니지만 같은 문서 안에서 "레이어"/"층" 두 표기가
  병존하게 된다. 신규 식별자 충돌 범주 밖이라 등급을 매기지 않으며, 필요하면 별도
  terminology 검토(예: `consistency_terminology`) 몫으로 남긴다.

## 요약

target 은 spec 파일을 새로 만들지 않고, 새 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·
환경변수를 하나도 도입하지 않는다. 유일하게 다루는 식별자 `EngineErrorCode` 는 target 이전에
이미 코드(`error-codes.ts:147`)와 5라운드 코드 리뷰·CHANGELOG 에서 같은 의미로 정착된 이름이고,
target 이 인용한 줄 번호·§3 `WORKER_HEARTBEAT_TIMEOUT` 행 등 실측 근거도 모두 소스와 일치한다.
저장소 전체를 대상으로 grep 했을 때 `EngineErrorCode` 가 다른 의미로 쓰이는 자리는 없었다.
신규 식별자 충돌 관점에서 이 target 은 사실상 "기존 식별자의 사후 문서화"이며 충돌 위험이
없다.

## 위험도
NONE
