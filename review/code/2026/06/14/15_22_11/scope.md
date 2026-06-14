# 변경 범위(Scope) 리뷰

## 변경 의도

spec/2-navigation/6-config.md §A.3 호출 이력 구현:
- `Execution` 테이블에 `source_ip` / `response_code` 컬럼 추가 (V096 migration)
- `hooks.service` 에서 webhook/chat-channel 발화 시 두 값 캡처·전달
- `auth-configs.service.getUsage` 에 `periodCounts`(롤링 윈도 24h/7d/30d) 추가
- Frontend usage drawer 에 소스 IP·응답 코드 컬럼 + 기간별 막대 차트 추가

## 발견사항

### **[INFO]** `auth-config-response.dto.ts` — `ApiPropertyOptional` → `ApiProperty` 변경 (파일 4)
- 위치: `/codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` diff 1행, 507행
- 상세: `ApiPropertyOptional`이 `ApiProperty`로 교체되고 `ApiPropertyOptional` 임포트가 제거됐다. `lastUsedAt` 필드(`AuthConfigDto`·`AuthConfigUsageDto` 두 곳)가 `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })`로 변경됐는데, Swagger 스키마 표현이 미세하게 달라진다(`required` 배열 포함 여부). 실질 API 동작에는 영향이 없으나 §A.3 호출 이력과 직접 관련은 없는 DTO 장식 변경이다. `periodCounts` 추가에 따라 같은 파일을 수정하는 김에 포함된 것으로 보이며, 범위 일탈 수준보다는 편의 정리에 해당한다.
- 제안: 허용 가능(API 계약 의미 동일, nullable true 명시가 더 정확). 단, 리뷰어 혼란을 줄이려면 커밋 메시지에 "ApiPropertyOptional → ApiProperty 통일" 을 명시하면 좋다.

### **[INFO]** `hooks.service.ts` — `clientIp` 로컬 변수 추출 위치 이동 (파일 9)
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts`, `handleWebhook` +3행 (인증 블록 이전으로 이동)
- 상세: 기존에는 `extractClientIp(input.headers)` 를 인증 검증 시 인라인으로 호출했는데, 이제 함수 상단에서 `const clientIp = ...` 로 미리 추출하고 인증과 이력 영속 양쪽에서 재사용한다. §A.3 sourceIp 전달을 위해 필요한 최소한의 리팩토링이며 로직 변경이 없다. 범위 이탈로 볼 수 없다.
- 제안: 없음. 적절한 최소 리팩토링.

### **[INFO]** `plan/in-progress/spec-sync-config-gaps.md` 갱신 (파일 14)
- 위치: `/plan/in-progress/spec-sync-config-gaps.md`
- 상세: 미구현 섹션의 §A.3 3항목을 체크박스 완료로 갱신하고, 구현 내용·spec 동기화·테스트 항목을 기재했다. plan 파일 갱신은 프로젝트 규약상 developer 권한 범위(`plan/**` 쓰기 허용)에 포함되며, 구현 완료 후 plan 갱신은 의무다.
- 제안: 없음.

### **[INFO]** `review/consistency/...` 신규 파일 2건 포함 (파일 15, 16)
- 위치: `/review/consistency/2026/06/14/14_33_40/SUMMARY.md`, `_retry_state.json`
- 상세: impl-prep consistency-check 결과물이 diff에 포함됐다. 이는 PR 전 게이트 산출물로 커밋 포함이 프로젝트 규약에 맞다(review/ 는 gitignored 아님). 코드 변경과 무관하지만 관련 프로세스 산출물이며 의도적 포함이다.
- 제안: 없음.

## 요약

16개 파일 변경 전체가 §A.3 호출 이력 구현(DB 컬럼 추가·캡처 경로·서비스 로직·DTO·Frontend UI·i18n·테스트)과 그에 따른 plan 갱신·consistency-check 산출물로 구성된다. `auth-config-response.dto.ts`의 `ApiPropertyOptional` → `ApiProperty` 정리가 §A.3와 직접 연관은 없으나 같은 파일 수정 중 병행된 무해한 정확도 개선이고, `clientIp` 추출 위치 이동도 기능 변경이 없는 필요한 최소 리팩토링이다. 범위를 벗어난 코드 변경·불필요한 리팩토링·무관 파일 수정·포맷팅 노이즈는 발견되지 않는다.

## 위험도

NONE
