# 신규 식별자 충돌 검토 — auth-reauth-spec-accuracy

대상: `plan/in-progress/auth-reauth-spec-accuracy.md` (spec draft, `spec/5-system/1-auth.md` + `spec/5-system/3-error-handling.md` + `plan/in-progress/error-codes-catalog-sot.md` 변경)

## 방법론 메모
`prompt_file` 의 "검색 대상 코퍼스" 에는 `spec/0-overview.md`·`spec/1-data-model.md` 등 일부만 포함되고 실제 변경 대상인 `spec/5-system/1-auth.md`·`3-error-handling.md`·`plan/in-progress/error-codes-catalog-sot.md` 본문은 누락돼 있었다. 해당 파일들을 직접 Read/Grep 하고 관련 백엔드 소스(`sessions.service.ts`·`auth.service.ts`·`auth.controller.ts`)를 대조해 target 이 도입하는 식별자(에러 코드·Rationale 앵커 `§2.3.D`·§1.2.1 카탈로그 신규 행)의 충돌 여부를 확인했다.

## 발견사항

- **[INFO]** `PASSWORD_INVALID`(재인증/2FA 재확인) ↔ `INVALID_PASSWORD`(비밀번호 변경) 근접 명명 — 이미 target 이 명시적으로 구분
  - target 신규 식별자: 카탈로그 신규 등재 `PASSWORD_INVALID`(§1.2.1, 401)
  - 기존 사용처: `spec/5-system/1-auth.md:688` (`INVALID_PASSWORD` = `changePassword` 전용, `users.service.ts:61,76/84`), `spec/1-data-model.md:705`(`LoginHistory.failure_reason` 이벤트 문자열 `INVALID_PASSWORD`)
  - 상세: 두 코드는 단어 순서만 바뀐 근접 명명(`PASSWORD_INVALID` vs `INVALID_PASSWORD`)이며 의미도 다르다(재인증/재확인 실패 vs 비밀번호 변경 실패). 이 근접성은 target 이 새로 만든 것이 아니라 이미 프로덕션 코드에 존재하는 기존 명명 결정이다. `conventions/error-codes.md` §1 이 "클라이언트는 코드 값 자체의 의미로 분기하며 substring 파싱을 하지 않는다" 는 원칙을 명시하고 있어 실질 충돌 리스크는 낮다. target 은 §1.2.1 신규 표 행 설명 컬럼과 하단 주석 양쪽에 "**근접 명명 주의**: `PASSWORD_INVALID`(재인증·재확인)는 비밀번호 *변경* 실패 코드 `INVALID_PASSWORD` 와 **다른 코드**다" 를 이미 명시해 혼선을 사전 차단했다. 검증 결과 문제 없음.
  - 제안: 현재 문구 유지. 후속 `INVALID_PASSWORD` 정식 카탈로그 등재(plan 상 "범위 밖 — 별 후속") 시 동일한 상호 구분 문구를 그대로 재사용할 것.

- **[INFO]** 신규 Rationale 앵커 `§2.3.D` — 코퍼스 전체에서 사전 사용 이력 없음, 삽입 위치 검증 완료
  - target 신규 식별자: `spec/5-system/1-auth.md` Rationale 신규 서브섹션 `### 2.3.D — §2.3 재인증 흐름 정합화`
  - 기존 사용처: 없음 — `grep -rn "2\.3\.D\b" spec/ plan/` 결과 target 파일(`plan/in-progress/auth-reauth-spec-accuracy.md`) 자기 참조만 존재
  - 상세: `1-auth.md` Rationale 은 기존에 `### 2.3.A`(L661)·`### 2.3.B`(L665)·`### 2.3.C`(L673) 를 사용 중이며, 그 직후(L690, "revoke/재발급 실패가..." 문단 끝)와 `### 1.5.D`(L692) 사이에 `2.3.D` 를 삽입하는 것으로 target 이 명시한 위치는 실측과 일치한다. 시퀀스상 `2.3.A/B/C` 다음 글자인 `D` 를 잇는 자연스러운 확장이라 명명 충돌·순번 오염이 없다.
  - 제안: 변경 불요. 삽입 위치·명명 그대로 반영 가능.

- **[정보 — 확인 완료, 발견사항 아님]** 재인증 에러 코드 3종의 HTTP status ground truth 대조
  - `sessions.service.ts` `verifyReauth`(L244-291) 직접 대조 결과 `REAUTH_REQUIRED`=`BadRequestException`(400), `PASSWORD_INVALID`/`TOTP_INVALID`=`UnauthorizedException`(401), `REAUTH_NOT_AVAILABLE`=`ForbiddenException`(403) — target 의 "코드 검증" 표(§변경 1·2 draft) 값과 정확히 일치한다. 기존 `3-error-handling.md:64` 각주와 `error-codes-catalog-sot.md:52` 의 status 표기(REAUTH_REQUIRED 403·PASSWORD_INVALID 400)는 실제 코드와 다른 오기이며, target 의 2b)·변경3 이 이를 정정한다. 이는 "새 식별자가 다른 의미로 이미 쓰이는" 충돌이 아니라 동일 식별자의 문서화 오류 수정이라 naming_collision 범주의 블로킹 사유는 아니다(정확성 관점은 다른 checker 소관).

## 요약
target 이 새로 도입하는 식별자는 ① 카탈로그 표에 3행 추가되는 기존 코드(`REAUTH_REQUIRED`/`PASSWORD_INVALID`/`TOTP_INVALID`, 프로덕션에 이미 존재 — 신규 코드 발행 아님), ② 신규 Rationale 앵커 `§2.3.D` 뿐이다. 코퍼스 전체(spec/·plan/·conventions/·관련 백엔드 소스)를 대조한 결과 두 범주 모두 기존 사용처와 다른 의미로 충돌하는 사례는 없었다. `PASSWORD_INVALID`↔`INVALID_PASSWORD` 근접 명명은 프로덕션에 사전 존재하는 결정이며 target 이 이미 명시적 구분 문구로 방어했고, `§2.3.D` 앵커는 기존 `2.3.A/B/C` 시퀀스에 충돌 없이 이어진다. 새 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·환경변수·파일 경로 충돌은 발견되지 않았다(target 은 기존 파일 3개만 수정하며 신규 파일·신규 endpoint·신규 env var 를 도입하지 않는다).

## 위험도
LOW
