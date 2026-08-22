# 보안(Security) 코드 리뷰

## 검토 범위 확인

`git show b2c604469 --stat` 로 실제 커밋 diff 를 대조한 결과, 코드 4개 파일의 변경분은 각각
+9 / +16 / +6(-2) / +6(-2) 줄이며 전부 JSDoc·인라인 주석·Swagger `description` 문자열
추가/치환이다. 조건문·분기·검증 로직·리턴값 등 실행 가능한 코드 라인은 0줄 변경됐다 —
plan(`plan/in-progress/masked-marker-cosmetic-followups.md`)의 "실행 동작 무변경" 주장과
diff 실측이 일치한다. 나머지 파일(`plan/**`, `review/consistency/**`, spec frontmatter
`code:` 목록 1줄 추가)도 문서/추적 산출물이며 실행 코드가 아니다.

### 발견사항

- **[INFO]** Swagger `description` 이 마스킹 마커 리터럴 3종을 명시적으로 나열
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24` (`inputOverride` `@ApiPropertyOptional` description)
  - 상세: `inputOverride` 필드 설명에 예약 마커 문자열(`***` / `[REDACTED]` / `[REDACTED_DEPTH]`)과 "부분 일치는 통과한다"는 경계 조건을 그대로 노출한다. 이 정보 자체는 신규 공개가 아니다 — 동일 내용이 이미 `spec/4-nodes/7-trigger/1-manual-trigger.md` §6·Rationale(본 diff 이전부터 존재, 이번 PR 은 frontmatter `code:` 한 줄만 추가) 과 프런트 `lib/utils/masked-markers.ts` 에 공개돼 있고, 거부 로직(raw 우선 검사 → resolve 후 재검사)도 이미 구현·배포된 동작이다. Swagger 문서화는 이미 관측 가능한 동작을 API 소비자에게 명시할 뿐이며, 우회 방법을 새로 알려주는 것도 아니다(부분 일치 통과는 마스킹의 본질상 불가피한 경계이지 결함이 아니다). 위협 모델 변화 없음.
  - 제안: 조치 불요. 참고로만 기록.

- **[INFO]** JSDoc 이 CI 가드 테스트 파일 경로를 인용
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:105-124` (`resolveTriggerParameters` 함수 JSDoc)
  - 상세: `repo-guards/__tests__/masked-reject-callers-guard.ts` 경로를 문서에 언급한다. 저장소 내부 CI 가드 파일 경로 노출은 공격 표면과 무관(레포 자체가 이미 공개/접근 가능한 코드베이스 컨텍스트이며, 가드는 소스 노출 여부와 무관하게 우회 불가한 정적 검사)하다.
  - 제안: 조치 불요.

인젝션·하드코딩 시크릿·인증/인가·입력 검증·암호화·에러 처리·의존성 관점에서 살펴봤으나
해당 로직 자체(마스킹 마커 거부 wrapper `resolveTriggerParametersRejectingMasked`, 컨트롤러의
`BadRequestException({ code, message, details })` 응답 구성, 스키마 검증 정규식
`^[A-Za-z_][A-Za-z0-9_]*$`)는 이번 diff 로 전혀 손대지 않았다 — 전부 이미 이전 커밋
(4287cdd5b, b677564e0 등)에서 검토·머지된 로직이다. 신규 사용자 입력 처리 경로, 신규 SQL/외부
호출, 신규 인증/인가 분기, 신규 암호화·해시 사용, 신규 에러 메시지 조합이 이번 변경에는 없다.

## 요약
이번 diff 는 `masked-marker-cosmetic-followups` plan 이 명시한 대로 Swagger 설명·JSDoc·인라인
주석 언어 통일에 한정된 순수 문서화 변경이며, 실행 코드·검증 로직·응답 스키마·에러 처리
동작은 한 줄도 바뀌지 않았다(git diff stat 실측으로 확인). Swagger 설명에 마스킹 마커 예약어를
명시한 것은 이미 spec·프런트에 공개된 기존 동작을 API 문서에 반영한 것뿐이라 신규 정보 노출이나
공격 표면 확대로 보기 어렵다. 하드코딩된 시크릿, 인젝션 벡터, 인증/인가 우회, 안전하지 않은
암호화, 민감정보 노출 등 보안 취약점은 발견되지 않았다.

## 위험도
NONE
